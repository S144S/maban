import { AccountAvatar } from "@/components/AccountAvatar";

/** Vector family portrait using the same chipmunk character as the account avatar. */
export function SquirrelFamily() {
  return <svg viewBox="0 0 180 140" fill="none" aria-hidden="true" focusable="false">
    <path d="M37 109C8 111 5 84 14 68c9-17 27-16 32-5 6 14-12 24-16 15-8 14 4 23 17 22M143 109c29 2 32-25 23-41-9-17-27-16-32-5-6 14 12 24 16 15 8 14-4 23-17 22" fill="var(--scene-peach)" stroke="var(--foreground)" strokeWidth="2" strokeLinejoin="round" />
    <svg x="22" y="14" width="76" height="88" viewBox="0 0 80 80"><AccountAvatar /></svg>
    <svg x="84" y="14" width="76" height="88" viewBox="0 0 80 80"><AccountAvatar /></svg>
    <circle cx="90" cy="101" r="34" fill="var(--illustration-paper)" />
    <svg x="61" y="72" width="58" height="58" viewBox="0 0 80 80"><AccountAvatar /></svg>
    <path d="M84 14c-7-9-17 0 6 12 23-12 13-21 6-12l-6 5Z" fill="var(--scene-rose)" stroke="var(--foreground)" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>;
}
