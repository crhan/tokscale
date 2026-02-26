import { NextResponse } from "next/server";
import { db, users, groups, groupMembers } from "@/lib/db";
import { and, eq, sql } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userGroups = await db
      .select({
        id: groups.id,
        name: groups.name,
        slug: groups.slug,
        description: groups.description,
        avatarUrl: groups.avatarUrl,
        isPublic: groups.isPublic,
        role: groupMembers.role,
        memberCount: sql<number>`(
          SELECT CAST(COUNT(${groupMembers.id}) AS integer)
          FROM ${groupMembers}
          WHERE ${groupMembers.groupId} = ${groups.id}
        )`.as("member_count"),
      })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(and(eq(groupMembers.userId, user.id), eq(groups.isPublic, true)));

    return NextResponse.json({
      groups: userGroups,
    });
  } catch (error) {
    console.error("Fetch user groups error:", error);
    return NextResponse.json({ error: "Failed to fetch user groups" }, { status: 500 });
  }
}
