export type Plant = { id: string; name: string; species: string; location: string; note: string; assignee_id: string | null; photo_url: string | null };
export const careLabels = { watered: "آب دادم", not_needed: "هنوز نیاز به آب نداشت", fertilized: "کود دادم", soil_changed: "خاکش رو عوض کردم", repotted: "گلدونش رو عوض کردم", examined: "بردمش معاینه" };
export type CareAction = keyof typeof careLabels;
export type CareEvent = { id: string; actor_id: string; actor_name: string; action: CareAction; note: string; performed_at: string };
