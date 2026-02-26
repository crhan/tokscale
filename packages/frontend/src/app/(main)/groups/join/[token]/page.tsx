"use client";

import { useState, useEffect } from "react";
import NextLink from "next/link";
import { useRouter, useParams } from "next/navigation";
import styled from "styled-components";

const Container = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg-default);
  padding: 24px;
`;

const Card = styled.div`
  max-width: 400px;
  width: 100%;
  padding: 32px;
  border-radius: 16px;
  border: 1px solid var(--color-border-default);
  background-color: var(--color-bg-default);
  text-align: center;
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 8px;
  color: var(--color-fg-default);
`;

const Description = styled.p`
  font-size: 14px;
  color: var(--color-fg-muted);
  margin-bottom: 24px;
`;

const JoinButton = styled.button`
  width: 100%;
  padding: 12px 20px;
  background-color: #0073ff;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s;

  &:hover:not(:disabled) {
    background-color: #005fcc;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.p`
  color: #f85149;
  font-size: 14px;
  margin-bottom: 16px;
`;

const SuccessMessage = styled.p`
  color: #3fb950;
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
`;

const StyledLink = styled(NextLink)`
  display: inline-block;
  margin-top: 16px;
  font-size: 14px;
  color: #0073ff;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

export default function JoinGroupPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    groupName: string;
    groupSlug: string;
  } | null>(null);

  const handleJoin = async () => {
    setIsJoining(true);
    setError(null);

    try {
      const res = await fetch(`/api/groups/join/${params.token}`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to join group");
      }

      setSuccess({
        groupName: data.group.name,
        groupSlug: data.group.slug,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsJoining(false);
    }
  };

  if (success) {
    return (
      <Container>
        <Card>
          <SuccessMessage>
            You&apos;ve joined {success.groupName}!
          </SuccessMessage>
          <StyledLink href={`/groups/${success.groupSlug}`}>
            Go to group →
          </StyledLink>
        </Card>
      </Container>
    );
  }

  return (
    <Container>
      <Card>
        <Title>Join Group</Title>
        <Description>
          You&apos;ve been invited to join a group on Tokscale
        </Description>

        {error && <ErrorMessage>{error}</ErrorMessage>}

        <JoinButton onClick={handleJoin} disabled={isJoining}>
          {isJoining ? "Joining..." : "Accept Invite"}
        </JoinButton>

        <StyledLink href="/groups">← Back to groups</StyledLink>
      </Card>
    </Container>
  );
}
