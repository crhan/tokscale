"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "nextjs-toploader/app";
import styled from "styled-components";
import { TabBar } from "@/components/TabBar";
import { LeaderboardSkeleton } from "@/components/Skeleton";

const Section = styled.div`
  margin-bottom: 40px;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 16px;

  @media (max-width: 480px) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

const Title = styled.h1`
  font-size: 30px;
  font-weight: bold;
  color: var(--color-fg-default);
`;

const Description = styled.p`
  margin-bottom: 24px;
  color: var(--color-fg-muted);
`;

const CreateButton = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background-color: #0073ff;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: background-color 0.15s;
  white-space: nowrap;

  &:hover {
    background-color: #005fcc;
  }
`;

const TabSection = styled.div`
  margin-bottom: 24px;
`;

const GroupGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;

  @media (min-width: 640px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: 1024px) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const GroupCard = styled.div`
  padding: 20px;
  border-radius: 12px;
  border: 1px solid var(--color-border-default);
  background-color: var(--color-bg-default);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #0073ff;
    background-color: rgba(0, 115, 255, 0.03);
  }
`;

const GroupName = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: var(--color-fg-default);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const GroupDescription = styled.p`
  font-size: 14px;
  color: var(--color-fg-muted);
  margin-bottom: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const GroupMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--color-fg-subtle);
`;

const Badge = styled.span<{ $variant?: "public" | "private" | "role" }>`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;

  ${({ $variant }) =>
    $variant === "public"
      ? `background: rgba(63, 185, 80, 0.1); color: #3FB950;`
      : $variant === "private"
        ? `background: rgba(248, 81, 73, 0.1); color: #F85149;`
        : `background: rgba(0, 115, 255, 0.1); color: #0073FF;`}
`;

const EmptyState = styled.div`
  padding: 48px;
  text-align: center;
  border-radius: 16px;
  border: 1px solid var(--color-border-default);
  background-color: var(--color-bg-default);
`;

const EmptyMessage = styled.p`
  margin-bottom: 8px;
  color: var(--color-fg-muted);
  font-size: 16px;
`;

const EmptyHint = styled.p`
  font-size: 14px;
  color: var(--color-fg-subtle);
`;

type Tab = "my" | "discover";

interface GroupItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  memberCount?: number;
  role?: string;
}

interface GroupsResponse {
  groups: GroupItem[];
  pagination: {
    page: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
  };
}

interface GroupsClientProps {
  currentUser: { id: string; username: string } | null;
}

export default function GroupsClient({ currentUser }: GroupsClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(currentUser ? "my" : "discover");
  const [data, setData] = useState<GroupsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const abortController = new AbortController();
    setIsLoading(true);

    const url = tab === "my" ? "/api/groups?my=true&limit=50" : "/api/groups?limit=50";
    fetch(url, { signal: abortController.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((result) => {
        if (!abortController.signal.aborted) {
          setData(result);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError" && !abortController.signal.aborted) {
          setData(null);
        }
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => abortController.abort();
  }, [tab]);

  const tabs = currentUser
    ? [
        { id: "my" as Tab, label: "My Groups" },
        { id: "discover" as Tab, label: "Discover" },
      ]
    : [{ id: "discover" as Tab, label: "Public Groups" }];

  return (
    <>
      <Section>
        <HeaderRow>
          <Title>Groups</Title>
          {currentUser && (
            <CreateButton href="/groups/new">+ Create Group</CreateButton>
          )}
        </HeaderRow>
        <Description>
          Create or join groups to compete on team leaderboards
        </Description>
      </Section>

      <TabSection>
        <TabBar tabs={tabs} activeTab={tab} onTabChange={(t) => setTab(t)} />
      </TabSection>

      {isLoading ? (
        <LeaderboardSkeleton />
      ) : !data?.groups.length ? (
        <EmptyState>
          <EmptyMessage>
            {tab === "my" ? "You haven't joined any groups yet" : "No public groups found"}
          </EmptyMessage>
          <EmptyHint>
            {tab === "my"
              ? "Create a group or ask someone to invite you"
              : "Be the first to create a public group!"}
          </EmptyHint>
        </EmptyState>
      ) : (
        <GroupGrid>
          {data.groups.map((group) => (
            <GroupCard
              key={group.id}
              onClick={() => router.push(`/groups/${group.slug}`)}
            >
              <GroupName>{group.name}</GroupName>
              <GroupDescription>
                {group.description || "No description"}
              </GroupDescription>
              <GroupMeta>
                <span>{group.memberCount ?? "–"} members</span>
                <Badge $variant={group.isPublic ? "public" : "private"}>
                  {group.isPublic ? "Public" : "Private"}
                </Badge>
                {group.role && <Badge $variant="role">{group.role}</Badge>}
              </GroupMeta>
            </GroupCard>
          ))}
        </GroupGrid>
      )}
    </>
  );
}
