import type { Group } from '../services/db/types';
import type { UserProfile } from '../services/auth/types';

/**
 * Resolves the member ID for the current authenticated user inside a specific group.
 * Matches by Firebase UID first, then falls back to case-insensitive email address mapping.
 */
export const getMemberIdForUser = (group: Group | null, user: UserProfile | null): string => {
  if (!group || !user) return '';
  
  const member = group.members.find(
    (m) =>
      m.id === user.uid ||
      (m.email && user.email && m.email.toLowerCase() === user.email.toLowerCase())
  );
  
  return member ? member.id : user.uid;
};

/**
 * Checks if a given memberId belongs to the current authenticated user.
 */
export const isCurrentUserMember = (
  memberId: string,
  group: Group | null,
  user: UserProfile | null
): boolean => {
  if (!group || !user) return false;
  const myId = getMemberIdForUser(group, user);
  return memberId === myId;
};
