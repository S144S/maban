import { useEffect, useState, type ReactNode } from "react";
import { authHref } from "./navigation";
import { Button } from "@/components/ui/button";
import { api, ApiError, errorMessage, type User } from "./api";

export function ProtectedPage({ children, admin = false }: { children: (user: User) => ReactNode; admin?: boolean }) {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    api<{ user: User }>("/users/me", { signal: controller.signal }).then(data => setUser(data.user)).catch(error => {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 401) window.location.replace(authHref("/login"));
      else { setUser(null); setError(errorMessage(error)); }
    });
    return () => controller.abort();
  }, [attempt]);
  // Revalidate when returning to a tab; a session revoked elsewhere must not keep its stale UI.
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") setAttempt(n => n + 1); };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) refresh(); };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", restore);
    return () => { document.removeEventListener("visibilitychange", refresh); window.removeEventListener("pageshow", restore); };
  }, []);
  if (!user) return <main className="account-shell" dir="rtl"><p role="status">{error || "در حال بررسی حساب…"}</p>{error && <Button onClick={() => setAttempt(n => n + 1)}>تلاش دوباره</Button>}</main>;
  if (admin && user.role !== "admin") return <main className="account-shell"><h1>دسترسی ندارین</h1><p>این بخش برای مدیر کاربرانه.</p><a href="/dashboard">بازگشت به داشبورد</a></main>;
  return children(user);
}
