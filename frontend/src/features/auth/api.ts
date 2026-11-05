export type User = {
  id: string; phone: string; first_name: string; last_name: string;
  role: "user" | "admin"; active: boolean; created_at: string;
};

export { api, ApiError, errorMessage } from "@/lib/http";
