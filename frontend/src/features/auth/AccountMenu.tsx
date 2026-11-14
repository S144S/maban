import { useEffect, useRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LogOut, UserRound, Wallet } from "lucide-react";
import { AccountAvatar } from "@/components/AccountAvatar";
import { api, ApiError, errorMessage } from "@/lib/http";
import "./account-menu.css";

export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const [backendVersion, setBackendVersion] = useState<string | null>(null);
  const [versionUnavailable, setVersionUnavailable] = useState(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setVersionUnavailable(false);
    void api<{ version: string }>("/health", { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) {
        if (typeof result.version !== "string" || !/^\d+\.\d+\.\d+$/.test(result.version)) {
          setVersionUnavailable(true);
          return;
        }
        setBackendVersion(result.version);
      }
    }).catch(() => { if (!controller.signal.aborted) setVersionUnavailable(true); });
    return () => controller.abort();
  }, [open]);

  async function logout() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await api("/auth/logout", { method: "POST" });
      window.location.replace("/login");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        window.location.replace("/login");
      } else {
        setError(errorMessage(err));
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <DropdownMenu.Root dir="rtl" modal={false} open={open} onOpenChange={setOpen}>
    <DropdownMenu.Trigger asChild>
      <button type="button" className="account-menu-trigger" aria-label="منوی حساب کاربری" title="حساب کاربری"><AccountAvatar /></button>
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content className="account-menu-content" sideOffset={8} align="end" collisionPadding={12} aria-label="حساب کاربری">
        <DropdownMenu.Item asChild disabled={busy} className="account-menu-item">
          <a href="/account" onClick={event => { if (pending.current) event.preventDefault(); }}><UserRound size={20} aria-hidden="true" />پروفایل من</a>
        </DropdownMenu.Item>
        <DropdownMenu.Separator className="account-menu-separator" />
        <DropdownMenu.Item asChild disabled={busy} className="account-menu-item">
          <a href="/wallet" onClick={event => { if (pending.current) event.preventDefault(); }}><Wallet size={20} aria-hidden="true" />کیف پول خانواده</a>
        </DropdownMenu.Item>
        <DropdownMenu.Item className="account-menu-item" disabled={busy} onSelect={event => { event.preventDefault(); void logout(); }}>
          <LogOut size={20} aria-hidden="true" />خروج
        </DropdownMenu.Item>
        {busy && <p className="account-menu-feedback" role="status">در حال خروج…</p>}
        {error && <p className="account-menu-feedback account-menu-error" role="alert">{error}</p>}
        <DropdownMenu.Separator className="account-menu-separator" />
        <DropdownMenu.Label className="account-menu-version">
          نسخهٔ: <bdi dir="ltr">{versionUnavailable ? "در دسترس نیست" : backendVersion ?? "…"}</bdi>
        </DropdownMenu.Label>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>;
}
