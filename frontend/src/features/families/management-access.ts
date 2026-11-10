import type { Family, Member } from "./api";

export function canManageFamily(family: Family, members: Member[], userId: string) {
  const member = members.find(item => item.user_id === userId);
  return !!member && (family.owner_id === userId || member.relationship === "spouse");
}
