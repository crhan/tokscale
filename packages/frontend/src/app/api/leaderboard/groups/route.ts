import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { db, groups, groupMembers, submissions, users } from "@/lib/db";
import type { Period, SortBy } from "@/lib/leaderboard/getLeaderboard";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";

const VALID_PERIODS: Period[] = ["all", "month", "week"];
const VALID_SORT_BY: SortBy[] = ["tokens", "cost"];

function parseIntSafe(value: string | null, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : defaultValue;
}

function getDateFilter(period: Period) {
  const now = new Date();

  if (period === "week") {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return { start: weekAgo, end: now };
  }

  if (period === "month") {
    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 30);
    return { start: monthAgo, end: now };
  }

  return null;
}

async function fetchGroupLeaderboardData(
  period: Period,
  sortBy: SortBy,
  page: number,
  limit: number
) {
  const offset = (page - 1) * limit;
  const dateFilter = getDateFilter(period);

  const submissionJoinCondition = dateFilter
    ? and(
        eq(submissions.userId, groupMembers.userId),
        gte(submissions.createdAt, dateFilter.start),
        lte(submissions.createdAt, dateFilter.end)
      )
    : eq(submissions.userId, groupMembers.userId);

  const orderByColumn =
    sortBy === "cost"
      ? sql`COALESCE(SUM(CAST(${submissions.totalCost} AS DECIMAL(12,4))), 0)`
      : sql`COALESCE(SUM(${submissions.totalTokens}), 0)`;

  const [items, totalResult, statsResult] = await Promise.all([
    db
      .select({
        rank: sql<number>`ROW_NUMBER() OVER (ORDER BY ${orderByColumn} DESC, ${groups.id} ASC)`.as("rank"),
        groupId: groups.id,
        name: groups.name,
        slug: groups.slug,
        description: groups.description,
        avatarUrl: groups.avatarUrl,
        memberCount: sql<number>`COUNT(DISTINCT ${users.id})`.as("member_count"),
        totalTokens: sql<number>`COALESCE(SUM(${submissions.totalTokens}), 0)`.as("total_tokens"),
        totalCost: sql<number>`COALESCE(SUM(CAST(${submissions.totalCost} AS DECIMAL(12,4))), 0)`.as("total_cost"),
      })
      .from(groups)
      .innerJoin(groupMembers, eq(groupMembers.groupId, groups.id))
      .innerJoin(users, eq(users.id, groupMembers.userId))
      .leftJoin(submissions, submissionJoinCondition)
      .where(eq(groups.isPublic, true))
      .groupBy(groups.id, groups.name, groups.slug, groups.description, groups.avatarUrl)
      .orderBy(desc(orderByColumn), asc(groups.id))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(DISTINCT ${groups.id})`.as("count") })
      .from(groups)
      .innerJoin(groupMembers, eq(groupMembers.groupId, groups.id))
      .innerJoin(users, eq(users.id, groupMembers.userId))
      .where(eq(groups.isPublic, true)),
    db
      .select({
        totalTokens: sql<number>`COALESCE(SUM(group_totals.total_tokens), 0)`.as("total_tokens"),
        totalCost: sql<number>`COALESCE(SUM(group_totals.total_cost), 0)`.as("total_cost"),
      })
      .from(
        db
          .select({
            groupId: groups.id,
            totalTokens: sql<number>`COALESCE(SUM(${submissions.totalTokens}), 0)`.as("total_tokens"),
            totalCost: sql<number>`COALESCE(SUM(CAST(${submissions.totalCost} AS DECIMAL(12,4))), 0)`.as(
              "total_cost"
            ),
          })
          .from(groups)
          .innerJoin(groupMembers, eq(groupMembers.groupId, groups.id))
          .innerJoin(users, eq(users.id, groupMembers.userId))
          .leftJoin(submissions, submissionJoinCondition)
          .where(eq(groups.isPublic, true))
          .groupBy(groups.id)
          .as("group_totals")
      ),
  ]);

  const totalGroups = Number(totalResult[0]?.count) || 0;
  const totalPages = Math.ceil(totalGroups / limit);

  return {
    groups: items.map((
      group: {
        rank: number;
        groupId: string;
        name: string;
        slug: string;
        description: string | null;
        avatarUrl: string | null;
        memberCount: number;
        totalTokens: number;
        totalCost: number;
      },
      index: number
    ) => ({
      rank: Number(group.rank) || offset + index + 1,
      groupId: group.groupId,
      name: group.name,
      slug: group.slug,
      description: group.description,
      avatarUrl: group.avatarUrl,
      memberCount: Number(group.memberCount) || 0,
      totalTokens: Number(group.totalTokens) || 0,
      totalCost: Number(group.totalCost) || 0,
    })),
    pagination: {
      page,
      limit,
      totalGroups,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
    stats: {
      totalGroups,
      totalTokens: Number(statsResult[0]?.totalTokens) || 0,
      totalCost: Number(statsResult[0]?.totalCost) || 0,
    },
    period,
    sortBy,
  };
}

function getGroupLeaderboardData(
  period: Period,
  sortBy: SortBy,
  page: number,
  limit: number
) {
  return unstable_cache(
    () => fetchGroupLeaderboardData(period, sortBy, page, limit),
    [`group-leaderboard:${period}:${sortBy}:${page}:${limit}`],
    {
      tags: ["group-leaderboard", `group-leaderboard:${period}`],
      revalidate: 60,
    }
  )();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const periodParam = searchParams.get("period") || "all";
    const period: Period = VALID_PERIODS.includes(periodParam as Period)
      ? (periodParam as Period)
      : "all";

    const sortByParam = searchParams.get("sortBy") || "tokens";
    const sortBy: SortBy = VALID_SORT_BY.includes(sortByParam as SortBy)
      ? (sortByParam as SortBy)
      : "tokens";

    const page = Math.max(1, parseIntSafe(searchParams.get("page"), 1));
    const limit = Math.min(100, Math.max(1, parseIntSafe(searchParams.get("limit"), 20)));

    const data = await getGroupLeaderboardData(period, sortBy, page, limit);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Group leaderboard error:", error);
    return NextResponse.json({ error: "Failed to fetch group leaderboard" }, { status: 500 });
  }
}
