"use client";

import { useState, useEffect, useCallback, memo, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "nextjs-toploader/app";
import styled from "styled-components";
import { TabBar } from "@/components/TabBar";
import { LeaderboardSkeleton } from "@/components/Skeleton";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Switch } from "@/components/Switch";
import { useSettings } from "@/lib/useSettings";
import type { GroupLeaderboardData } from "@/lib/groups/getGroupLeaderboard";

// ============================================================================
// STYLED COMPONENTS (matching LeaderboardClient patterns)
// ============================================================================

const Section = styled.div`
  margin-bottom: 40px;
`;

const GroupHeader = styled.div`
  margin-bottom: 32px;
`;

const GroupTitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 8px;

  @media (max-width: 640px) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

const GroupName = styled.h1`
  font-size: 30px;
  font-weight: bold;
  color: var(--color-fg-default);
`;

const GroupActions = styled.div`
  display: flex;
  gap: 8px;
`;

const ActionButton = styled.a`
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--color-border-default);
  background: transparent;
  color: var(--color-fg-muted);
  font-size: 13px;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.15s;

  &:hover {
    border-color: #0073ff;
    color: var(--color-fg-default);
  }
`;

const ActionLink = styled(ActionButton).attrs({ as: Link })``;

const PrimaryActionButton = styled(ActionButton)`
  background-color: #0073ff;
  border-color: #0073ff;
  color: #fff;

  &:hover {
    background-color: #005fcc;
    border-color: #005fcc;
    color: #fff;
  }
`;

const GroupDescription = styled.p`
  color: var(--color-fg-muted);
  margin-bottom: 16px;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;

  @media (min-width: 480px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  @media (min-width: 768px) {
    display: flex;
  }
`;

const StatCard = styled.div`
  flex: 1;
  border-radius: 12px;
  border: 1px solid var(--color-border-default);
  padding: 12px;
  background-color: var(--color-bg-default);
`;

const StatLabel = styled.p`
  font-size: 12px;
  color: var(--color-fg-muted);
`;

const StatValue = styled.p`
  font-size: 16px;
  font-weight: bold;
  color: var(--color-fg-default);
`;

const StatValuePrimary = styled(StatValue)`
  color: var(--color-primary);
`;

const TabSection = styled.div`
  margin-bottom: 24px;
`;

const SortToggleContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-bottom: 16px;
`;

const SortLabel = styled.span`
  font-size: 12px;
  color: var(--color-fg-muted);
  font-weight: 500;
`;

const TableContainer = styled.div`
  border-radius: 16px;
  border: 1px solid var(--color-border-default);
  overflow: hidden;
  background-color: var(--color-bg-default);
`;

const TableWrapper = styled.div`
  overflow-x: auto;
`;

const Table = styled.table`
  width: 100%;
  min-width: 500px;

  @media (max-width: 560px) {
    min-width: unset;
  }
`;

const TableHead = styled.thead`
  border-bottom: 1px solid var(--color-border-default);
  background-color: var(--color-bg-elevated);
`;

const TableHeaderCell = styled.th`
  padding: 12px;
  text-align: left;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-fg-muted);

  @media (min-width: 640px) {
    padding: 12px 24px;
  }

  &.text-right {
    text-align: right;
  }

  &.hidden-mobile {
    display: none;
    @media (min-width: 768px) {
      display: table-cell;
    }
  }
`;

const TableBody = styled.tbody``;

const TableRow = styled.tr`
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 1px solid var(--color-border-default);

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: rgba(20, 26, 33, 0.6);
  }
`;

const TableCell = styled.td`
  padding: 10px 12px;
  white-space: nowrap;
  vertical-align: middle;

  @media (min-width: 640px) {
    padding: 10px 24px;
  }

  &.text-right {
    text-align: right;
  }

  &.hidden-mobile {
    display: none;
    @media (min-width: 768px) {
      display: table-cell;
    }
  }
`;

const RankBadge = styled.span`
  font-size: 16px;
  font-weight: bold;
  color: var(--color-fg-muted);

  &[data-rank="1"] {
    color: #eab308;
  }
  &[data-rank="2"] {
    color: #9ca3af;
  }
  &[data-rank="3"] {
    color: #d97706;
  }
`;

const UserContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;

  @media (min-width: 640px) {
    gap: 12px;
  }
`;

const UserInfo = styled.div`
  min-width: 0;
`;

const UserDisplayName = styled.p`
  font-weight: 500;
  font-size: 14px;
  color: var(--color-fg-default);
  overflow: hidden;
  text-overflow: ellipsis;

  @media (min-width: 640px) {
    font-size: 16px;
  }
`;

const Username = styled.p`
  font-size: 12px;
  color: var(--color-fg-muted);
  overflow: hidden;
  text-overflow: ellipsis;

  @media (min-width: 640px) {
    font-size: 14px;
  }
`;

const RoleBadge = styled.span<{ $role: string }>`
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 500;
  margin-left: 6px;

  ${({ $role }) =>
    $role === "owner"
      ? `background: rgba(234, 179, 8, 0.15); color: #EAB308;`
      : $role === "admin"
        ? `background: rgba(0, 115, 255, 0.1); color: #0073FF;`
        : `display: none;`}
`;

const TokenValue = styled.span`
  font-weight: 500;
  font-size: 14px;
  color: var(--color-primary);

  @media (min-width: 640px) {
    font-size: 16px;
  }
`;

const CostValue = styled.span`
  font-weight: 500;
  font-size: 14px;
  color: var(--color-fg-default);

  @media (min-width: 640px) {
    font-size: 16px;
  }
`;

const EmptyState = styled.div`
  padding: 32px;
  text-align: center;
`;

const EmptyMessage = styled.p`
  color: var(--color-fg-muted);
`;

// ============================================================================
// TYPES
// ============================================================================

type Period = "all" | "month" | "week";

interface GroupInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  memberCount: number;
}

interface GroupDetailClientProps {
  group: GroupInfo;
  userRole: string | null;
  currentUser: { id: string; username: string } | null;
  initialLeaderboard: GroupLeaderboardData;
}

// ============================================================================
// COMPONENT
// ============================================================================

const LeaderboardRow = memo(function LeaderboardRow({
  user,
  isCurrentUser,
  onRowClick,
}: {
  user: GroupLeaderboardData["users"][0];
  isCurrentUser: boolean;
  onRowClick: (username: string) => void;
}) {
  return (
    <TableRow
      onClick={() => onRowClick(user.username)}
      style={
        isCurrentUser
          ? {
              background: "rgba(0, 115, 255, 0.05)",
              boxShadow: "inset 4px 0 0 #0073FF",
            }
          : undefined
      }
    >
      <TableCell>
        <RankBadge data-rank={user.rank <= 3 ? user.rank : undefined}>
          #{user.rank}
        </RankBadge>
      </TableCell>
      <TableCell>
        <UserContainer>
          <img
            src={
              user.avatarUrl ||
              `https://github.com/${user.username}.png`
            }
            alt={user.username}
            width={36}
            height={36}
            style={{
              borderRadius: "50%",
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
          <UserInfo>
            <UserDisplayName>
              {user.displayName || user.username}
              <RoleBadge $role={user.role}>{user.role}</RoleBadge>
            </UserDisplayName>
            <Username>@{user.username}</Username>
          </UserInfo>
        </UserContainer>
      </TableCell>
      <TableCell className="text-right hidden-mobile">
        <CostValue>{formatCurrency(user.totalCost)}</CostValue>
      </TableCell>
      <TableCell className="text-right">
        <TokenValue>{formatNumber(user.totalTokens)}</TokenValue>
      </TableCell>
    </TableRow>
  );
});

export default function GroupDetailClient({
  group,
  userRole,
  currentUser,
  initialLeaderboard,
}: GroupDetailClientProps) {
  const router = useRouter();
  const [data, setData] = useState<GroupLeaderboardData>(initialLeaderboard);
  const [period, setPeriod] = useState<Period>("all");
  const [isLoading, setIsLoading] = useState(false);

  const { leaderboardSortBy, setLeaderboardSort, mounted } = useSettings();
  const effectiveSortBy = mounted ? leaderboardSortBy : "tokens";

  const isAdmin = userRole === "owner" || userRole === "admin";
  const hasEverFetched = useRef(false);

  const fetchLeaderboard = useCallback(
    async (p: Period, sortBy: string) => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/groups/${group.slug}/leaderboard?period=${p}&sortBy=${sortBy}&limit=50`
        );
        if (res.ok) {
          setData(await res.json());
        }
      } finally {
        setIsLoading(false);
      }
    },
    [group.slug]
  );

  useEffect(() => {
    if (!hasEverFetched.current && period === "all" && effectiveSortBy === "tokens") {
      hasEverFetched.current = true;
      return;
    }
    hasEverFetched.current = true;
    fetchLeaderboard(period, effectiveSortBy);
  }, [period, effectiveSortBy, fetchLeaderboard]);

  const handleRowClick = useCallback(
    (username: string) => {
      router.push(`/u/${username}`);
    },
    [router]
  );

  return (
    <>
      <GroupHeader>
        <GroupTitleRow>
          <GroupName>{group.name}</GroupName>
          <GroupActions>
            {isAdmin && (
              <>
                <ActionLink href={`/groups/${group.slug}/members`}>Members</ActionLink>
                <ActionLink href={`/groups/${group.slug}/settings`}>Settings</ActionLink>
              </>
            )}
            {userRole && userRole !== "owner" && (
              <ActionButton
                as="button"
                onClick={async () => {
                  if (!confirm("Leave this group?")) return;
                  const res = await fetch(`/api/groups/${group.slug}/leave`, {
                    method: "POST",
                  });
                  if (res.ok) router.push("/groups");
                }}
              >
                Leave
              </ActionButton>
            )}
          </GroupActions>
        </GroupTitleRow>
        {group.description && (
          <GroupDescription>{group.description}</GroupDescription>
        )}
      </GroupHeader>

      <Section>
        <StatsGrid>
          <StatCard>
            <StatLabel>Members</StatLabel>
            <StatValue>{data.stats.totalMembers}</StatValue>
          </StatCard>
          <StatCard>
            <StatLabel>Total Tokens</StatLabel>
            <StatValuePrimary>
              {formatNumber(data.stats.totalTokens)}
            </StatValuePrimary>
          </StatCard>
          <StatCard>
            <StatLabel>Total Cost</StatLabel>
            <StatValue>{formatCurrency(data.stats.totalCost)}</StatValue>
          </StatCard>
        </StatsGrid>
      </Section>

      <TabSection>
        <TabBar
          tabs={[
            { id: "all" as Period, label: "All Time" },
            { id: "month" as Period, label: "This Month" },
            { id: "week" as Period, label: "This Week" },
          ]}
          activeTab={period}
          onTabChange={(tab) => setPeriod(tab)}
        />
      </TabSection>

      <SortToggleContainer>
        <SortLabel>Sort by:</SortLabel>
        <Switch
          checked={effectiveSortBy === "cost"}
          onChange={(checked) =>
            setLeaderboardSort(checked ? "cost" : "tokens")
          }
          leftLabel="Tokens"
          rightLabel="Cost"
        />
      </SortToggleContainer>

      {isLoading ? (
        <LeaderboardSkeleton />
      ) : (
        <TableContainer>
          {data.users.length === 0 ? (
            <EmptyState>
              <EmptyMessage>
                No submissions from group members yet
              </EmptyMessage>
            </EmptyState>
          ) : (
            <TableWrapper>
              <Table>
                <TableHead>
                  <tr>
                    <TableHeaderCell>Rank</TableHeaderCell>
                    <TableHeaderCell>User</TableHeaderCell>
                    <TableHeaderCell className="text-right hidden-mobile">
                      Cost
                    </TableHeaderCell>
                    <TableHeaderCell className="text-right">
                      Tokens
                    </TableHeaderCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {data.users.map((user) => (
                    <LeaderboardRow
                      key={user.userId}
                      user={user}
                      isCurrentUser={
                        !!(
                          currentUser &&
                          user.username === currentUser.username
                        )
                      }
                      onRowClick={handleRowClick}
                    />
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
          )}
        </TableContainer>
      )}
    </>
  );
}
