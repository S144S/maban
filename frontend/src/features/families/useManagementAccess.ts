import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/http";
import type { Family, Member } from "./api";
import { canManageFamily } from "./management-access";

export function useManagementAccess(userId: string, selected: string, page: string) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ scope: string; allowed: boolean; error: string } | null>(null);
  const scope = `${userId}:${selected}`;
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const { families } = await api<{ families: Family[] }>("/families", { signal: controller.signal });
      const family = families.find(item => item.id === selected) ?? families[0];
      let allowed = false;
      if (family) {
        const { members } = await api<{ members: Member[] }>(`/families/${family.id}`, { signal: controller.signal });
        allowed = canManageFamily(family, members, userId);
      }
      if (!controller.signal.aborted) setResult({ scope, allowed, error: "" });
    }
    void load().catch(error => {
      if (!controller.signal.aborted) setResult({ scope, allowed: false, error: errorMessage(error) });
    });
    return () => controller.abort();
  }, [scope, selected, userId, page, revision]);
  return {
    allowed: result?.scope === scope && result.allowed,
    loading: result?.scope !== scope,
    error: result?.scope === scope ? result.error : "",
    retry: () => setRevision(value => value + 1),
  };
}
