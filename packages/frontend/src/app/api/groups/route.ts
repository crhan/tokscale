import { NextResponse } from "next/server";
import { db, groups, groupMembers } from "@/lib/db";
import { desc, eq, sql } from "drizzle-orm";
import { getSessionFromHeader } from "@/lib/auth/session";
import { generateUniqueSlug } from "@/lib/groups/slug";

function parseIntSafe(value: string | null, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : defaultValue;
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeader(request);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let body: { name?: string; description?: string; isPublic?: boolean };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Group name is required" }, { status: 400 });
    }

    if (name.length > 100) {
      return NextResponse.json({ error: "Group name must be 100 characters or less" }, { status: 400 });
    }

    const slug = await generateUniqueSlug(name);

    const [createdGroup] = await db.transaction(async (tx) => {
      const [newGroup] = await tx
        .insert(groups)
        .values({
          name,
          slug,
          description: body.description?.trim() || null,
          isPublic: body.isPublic ?? true,
          createdBy: session.id,
        })
        .returning();

      await tx.insert(groupMembers).values({
        groupId: newGroup.id,
        userId: session.id,
        role: "owner",
      });

      return [newGroup];
    });

    return NextResponse.json(createdGroup);
  } catch (error) {
    console.error("Create group error:", error);
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const myOnly = searchParams.get("my") === "true";
    const page = Math.max(1, parseIntSafe(searchParams.get("page"), 1));
    const limit = Math.min(100, Math.max(1, parseIntSafe(searchParams.get("limit"), 20)));
    const offset = (page - 1) * limit;

    const session = await getSessionFromHeader(request);

    if (myOnly && !session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (myOnly && session) {
      const [items, totalResult] = await Promise.all([
        db
          .select({
            id: groups.id,
            name: groups.name,
            slug: groups.slug,
            description: groups.description,
            avatarUrl: groups.avatarUrl,
            isPublic: groups.isPublic,
            createdBy: groups.createdBy,
            createdAt: groups.createdAt,
            updatedAt: groups.updatedAt,
            role: groupMembers.role,
            memberCount: sql<number>`CAST((SELECT COUNT(*) FROM "group_members" WHERE "group_members"."group_id" = ${groups.id}) AS integer)`.as(
              "member_count"
            ),
          })
          .from(groupMembers)
          .innerJoin(groups, eq(groupMembers.groupId, groups.id))
          .where(eq(groupMembers.userId, session.id))
          .orderBy(desc(groups.updatedAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`COUNT(*)`.as("count") })
          .from(groupMembers)
          .where(eq(groupMembers.userId, session.id)),
      ]);

      const total = Number(totalResult[0]?.count) || 0;
      return NextResponse.json({
        groups: items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: offset + items.length < total,
          hasPrev: page > 1,
        },
      });
    }

    const [items, totalResult] = await Promise.all([
      db
        .select({
          id: groups.id,
          name: groups.name,
          slug: groups.slug,
          description: groups.description,
          avatarUrl: groups.avatarUrl,
          isPublic: groups.isPublic,
          createdBy: groups.createdBy,
          createdAt: groups.createdAt,
          updatedAt: groups.updatedAt,
          memberCount: sql<number>`CAST(COUNT(${groupMembers.id}) AS integer)`.as("member_count"),
        })
        .from(groups)
        .leftJoin(groupMembers, eq(groupMembers.groupId, groups.id))
        .where(eq(groups.isPublic, true))
        .groupBy(groups.id)
        .orderBy(desc(groups.updatedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`COUNT(*)`.as("count") })
        .from(groups)
        .where(eq(groups.isPublic, true)),
    ]);

    const total = Number(totalResult[0]?.count) || 0;
    return NextResponse.json({
      groups: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + items.length < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("List groups error:", error);
    return NextResponse.json({ error: "Failed to fetch groups" }, { status: 500 });
  }
}
