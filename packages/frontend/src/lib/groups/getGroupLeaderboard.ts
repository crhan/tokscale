import { unstable_cache } from "next/cache";
import { db, users, submissions, groupMembers } from "@/lib/db";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";
import type { Period, SortBy } from "@/lib/leaderboard/getLeaderboard";

export interface GroupLeaderboardUser {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  totalTokens: number;
  totalCost: number;
  submissionCount: number;
  lastSubmission: string;
  role: string;
}

export interface GroupLeaderboardData {
  users: GroupLeaderboardUser[];
  pagination: {
    page: number;
    limit: number;
    totalUsers: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  stats: {
    totalTokens: number;
    totalCost: number;
    totalMembers: number;
  };
  period: Period;
  sortBy: SortBy;
}

function getDateFilter(period: Period) {
  const now = new Date();

  if (period === "week") {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return and(
      gte(submissions.createdAt, weekAgo),
      lte(submissions.createdAt, now)
    );
  }

  if (period === "month") {
    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return and(
      gte(submissions.createdAt, monthAgo),
      lte(submissions.createdAt, now)
    );
  }

  return undefined;
}

async function fetchGroupLeaderboardData(
  groupId: string,
  period: Period,
  page: number,
  limit: number,
  sortBy: SortBy = "tokens"
): Promise<GroupLeaderboardData> {
  const offset = (page - 1) * limit;
  const dateFilter = getDateFilter(period);

  const orderByColumn =
    sortBy === "cost"
      ? sql`SUM(CAST(${submissions.totalCost} AS DECIMAL(12,4)))`
      : sql`SUM(${submissions.totalTokens})`;

  // Main query: join submissions with group_members to scope to group
  const leaderboardQuery = db
    .select({
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      totalTokens: sql<number>`SUM(${submissions.totalTokens})`.as(
        "total_tokens"
      ),
      totalCost: sql<number>`SUM(CAST(${submissions.totalCost} AS DECIMAL(12,4)))`.as(
        "total_cost"
      ),
      submissionCount: sql<number>`COALESCE(SUM(${submissions.submitCount}), 0)`.as(
        "submission_count"
      ),
      lastSubmission: sql<string>`MAX(${submissions.createdAt})`.as(
        "last_submission"
      ),
      role: groupMembers.role,
    })
    .from(submissions)
    .innerJoin(users, eq(submissions.userId, users.id))
    .innerJoin(
      groupMembers,
      and(
        eq(groupMembers.userId, submissions.userId),
        eq(groupMembers.groupId, groupId)
      )
    )
    .where(dateFilter)
    .groupBy(
      users.id,
      users.username,
      users.displayName,
      users.avatarUrl,
      groupMembers.role
    )
    .orderBy(desc(orderByColumn))
    .limit(limit)
    .offset(offset);

  // Member count + total stats for this group
  const [results, memberCount, groupStats] = await Promise.all([
    leaderboardQuery,
    db
      .select({ count: sql<number>`COUNT(*)`.as("count") })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId)),
    db
      .select({
        totalTokens: sql<number>`SUM(${submissions.totalTokens})`,
        totalCost: sql<number>`SUM(CAST(${submissions.totalCost} AS DECIMAL(12,4)))`,
        submittedUserCount: sql<number>`COUNT(DISTINCT ${submissions.userId})`,
      })
      .from(submissions)
      .innerJoin(
        groupMembers,
        and(
          eq(groupMembers.userId, submissions.userId),
          eq(groupMembers.groupId, groupId)
        )
      )
      .where(dateFilter),
  ]);
  const totalMembers = Number(memberCount[0]?.count) || 0;
  const totalSubmittedUsers = Number(groupStats[0]?.submittedUserCount) || 0;
  const totalPages = Math.ceil(totalSubmittedUsers / limit);

  return {
    users: results.map((row, index) => ({
      rank: offset + index + 1,
      userId: row.userId,
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      totalTokens: Number(row.totalTokens) || 0,
      totalCost: Number(row.totalCost) || 0,
      submissionCount: Number(row.submissionCount) || 0,
      lastSubmission: row.lastSubmission,
      role: row.role,
    })),
    pagination: {
      page,
      limit,
      totalUsers: totalSubmittedUsers,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
    stats: {
      totalTokens: Number(groupStats[0]?.totalTokens) || 0,
      totalCost: Number(groupStats[0]?.totalCost) || 0,
      totalMembers,
    },
    period,
    sortBy,
  };
}

export function getGroupLeaderboardData(
  groupId: string,
  period: Period = "all",
  page: number = 1,
  limit: number = 50,
  sortBy: SortBy = "tokens"
): Promise<GroupLeaderboardData> {
  return unstable_cache(
    () => fetchGroupLeaderboardData(groupId, period, page, limit, sortBy),
    [`group-leaderboard:${groupId}:${period}:${page}:${limit}:${sortBy}`],
    {
      tags: [
        "group-leaderboard",
        `group-leaderboard:${groupId}`,
        `group-leaderboard:${groupId}:${period}`,
      ],
      revalidate: 60,
    }
  )();
}
