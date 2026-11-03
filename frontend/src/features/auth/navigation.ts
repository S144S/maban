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
  const next = entryUrl.pathname === "/families" || new URLSearchParams(entryUrl.search).get("next") === "/families";
  return next ? `${path}?next=/families` : path;
}
export function afterAuth() {
  const token = invitationToken();
  if (token) return `/invite#token=${token}`;
  return new URLSearchParams(entryUrl.search).get("next") === "/families" ? "/families" : "/dashboard";
}
