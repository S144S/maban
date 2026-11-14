// Invitation secrets stay in URL fragments: they are not sent in HTTP request URLs.
// Capture entry context so the accessibility skip link cannot replace the invitation.
const entryUrl = new URL(window.location.href);
export function invitationToken() {
  const hash = new URLSearchParams(entryUrl.hash.slice(1));
  const token = hash.get("invite") ?? hash.get("token") ?? "";
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : "";
}
export function authHref(path: "/login" | "/signup") {
  const token = invitationToken();
  if (token) return `${path}#invite=${token}`;
  const next = returnPath();
  return next ? `${path}?next=${next.includes("?") ? encodeURIComponent(next) : next}` : path;
}
function returnPath() {
  const requested = new URLSearchParams(entryUrl.search).get("next");
  const walletReturn = requested?.match(/^\/wallet\?family=([0-9a-fA-F-]{36})$/);
  const path = ["/families", "/wallet"].find(path => entryUrl.pathname === path || requested === path)
    ?? (walletReturn ? "/wallet" : undefined);
  const family = entryUrl.pathname === "/wallet" ? entryUrl.searchParams.get("family") : walletReturn?.[1];
  return path === "/wallet" && family && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(family)
    ? `/wallet?family=${family}` : path;
}
export function afterAuth() {
  const token = invitationToken();
  if (token) return `/invite#token=${token}`;
  return returnPath() ?? "/dashboard";
}
