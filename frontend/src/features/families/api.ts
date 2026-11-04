export type Access = "full" | "view";
export const accessLabels: Record<Access, string> = { full: "همه‌چی", view: "فقط دیدن" };
export type Relationship = "spouse" | "child" | "friend";
export const relationships: Record<Relationship, string> = { spouse: "همسر", child: "فرزند", friend: "دوست" };
export type Family = { id: string; name: string; owner_id: string; created_at: string };
export type Member = { user_id: string; name: string; access: Access; relationship: Relationship | null; joined_at: string };
export type Invitation = { id: string; access: Access; relationship: Relationship; status: "pending" | "accepted" | "revoked" | "expired"; expires_at: string };
export const invitationStatus = { pending: "در انتظار پذیرش", accepted: "پذیرفته شده", revoked: "لغو شده", expired: "منقضی شده" };
