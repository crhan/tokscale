"use client";

import { useEffect, useState } from "react";
import { useRouter } from "nextjs-toploader/app";
import styled from "styled-components";
import { Switch } from "@/components/Switch";
import { CopyIcon, CheckIcon } from "@/components/ui/Icons";

const Container = styled.div`
  max-width: 560px;
  margin: 0 auto;
  padding-top: 24px;
`;

const BackLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: var(--color-fg-muted);
  text-decoration: none;
  margin-bottom: 24px;

  &:hover {
    color: var(--color-fg-default);
  }
`;

const Title = styled.h1`
  font-size: 30px;
  font-weight: bold;
  margin-bottom: 32px;
  color: var(--color-fg-default);
`;

const SectionTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--color-fg-default);
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 40px;
`;

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-fg-default);
`;

const Input = styled.input`
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--color-border-default);
  background-color: var(--color-bg-subtle);
  color: var(--color-fg-default);
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: #0073ff;
    box-shadow: 0 0 0 2px rgba(0, 115, 255, 0.2);
  }
`;

const TextArea = styled.textarea`
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--color-border-default);
  background-color: var(--color-bg-subtle);
  color: var(--color-fg-default);
  font-size: 14px;
  resize: vertical;
  min-height: 80px;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: #0073ff;
    box-shadow: 0 0 0 2px rgba(0, 115, 255, 0.2);
  }
`;

const ToggleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ToggleLabel = styled.div``;

const ToggleTitle = styled.p`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-fg-default);
`;

const ToggleDescription = styled.p`
  font-size: 12px;
  color: var(--color-fg-muted);
`;

const SaveButton = styled.button`
  padding: 10px 20px;
  background-color: #0073ff;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s;
  align-self: flex-start;

  &:hover:not(:disabled) {
    background-color: #005fcc;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const InviteCodeSection = styled.div`
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--color-border-default);
  background-color: var(--color-bg-default);
  margin-bottom: 40px;
`;

const InviteCodeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const InviteCodeValue = styled.code`
  flex: 1;
  padding: 8px 12px;
  border-radius: 8px;
  background-color: var(--color-bg-subtle);
  font-size: 13px;
  color: var(--color-fg-default);
  overflow: hidden;
  text-overflow: ellipsis;
`;

const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border: 1px solid var(--color-border-default);
  background: transparent;
  color: var(--color-fg-muted);
  cursor: pointer;
  border-radius: 8px;
  transition: all 150ms;

  &:hover {
    border-color: #0073ff;
    color: var(--color-fg-default);
  }
`;

const DangerZone = styled.div`
  padding: 20px;
  border-radius: 12px;
  border: 1px solid #f85149;
  background: rgba(248, 81, 73, 0.05);
`;

const DangerTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: #f85149;
  margin-bottom: 8px;
`;

const DangerDescription = styled.p`
  font-size: 14px;
  color: var(--color-fg-muted);
  margin-bottom: 16px;
`;

const DangerButton = styled.button`
  padding: 8px 16px;
  background-color: #f85149;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    background-color: #da3633;
  }
`;

const ErrorMessage = styled.p`
  color: #f85149;
  font-size: 14px;
`;

const SuccessMessage = styled.p`
  color: #3fb950;
  font-size: 14px;
`;

interface GroupSettingsClientProps {
  group: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    isPublic: boolean;
    avatarUrl: string | null;
    inviteCode: string | null;
  };
  userRole: string;
}

export default function GroupSettingsClient({
  group,
  userRole,
}: GroupSettingsClientProps) {
  const router = useRouter();
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description || "");
  const [isPublic, setIsPublic] = useState(group.isPublic);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const isOwner = userRole === "owner";
  const inviteUrl = group.inviteCode
    ? `${origin}/groups/join/${group.inviteCode}`
    : null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/groups/${group.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          isPublic,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      const updated = await res.json();
      setSuccess("Settings saved");

      // If slug changed, redirect
      if (updated.slug !== group.slug) {
        router.push(`/groups/${updated.slug}/settings`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = prompt(
      `Type "${group.name}" to confirm deletion:`
    );
    if (confirmed !== group.name) return;

    try {
      const res = await fetch(`/api/groups/${group.slug}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/groups");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete");
      }
    } catch {
      setError("Failed to delete group");
    }
  };

  const handleCopyInvite = () => {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Container>
      <BackLink href={`/groups/${group.slug}`}>← Back to group</BackLink>
      <Title>Group Settings</Title>

      <SectionTitle>General</SectionTitle>
      <Form onSubmit={handleSave}>
        <FieldGroup>
          <Label>Group Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            required
          />
        </FieldGroup>

        <FieldGroup>
          <Label>Description</Label>
          <TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
          />
        </FieldGroup>

        <ToggleRow>
          <ToggleLabel>
            <ToggleTitle>Public Group</ToggleTitle>
            <ToggleDescription>
              {isPublic
                ? "Anyone can see this group and its leaderboard"
                : "Only members can see this group"}
            </ToggleDescription>
          </ToggleLabel>
          <Switch
            checked={isPublic}
            onChange={setIsPublic}
            leftLabel=""
            rightLabel=""
          />
        </ToggleRow>

        {error && <ErrorMessage>{error}</ErrorMessage>}
        {success && <SuccessMessage>{success}</SuccessMessage>}

        <SaveButton type="submit" disabled={isSaving || !name.trim()}>
          {isSaving ? "Saving..." : "Save Changes"}
        </SaveButton>
      </Form>

      {inviteUrl && (
        <>
          <SectionTitle>Invite Link</SectionTitle>
          <InviteCodeSection>
            <InviteCodeRow>
              <InviteCodeValue>{inviteUrl}</InviteCodeValue>
              <IconButton onClick={handleCopyInvite} title="Copy invite link">
                {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
              </IconButton>
            </InviteCodeRow>
          </InviteCodeSection>
        </>
      )}

      {isOwner && (
        <>
          <SectionTitle>Danger Zone</SectionTitle>
          <DangerZone>
            <DangerTitle>Delete Group</DangerTitle>
            <DangerDescription>
              This action is irreversible. All members will be removed and group
              data will be permanently deleted.
            </DangerDescription>
            <DangerButton onClick={handleDelete}>Delete Group</DangerButton>
          </DangerZone>
        </>
      )}
    </Container>
  );
}
