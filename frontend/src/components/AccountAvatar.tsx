import { useId } from "react";

/** Small, scalable chipmunk portrait for the account shortcut. */
export function AccountAvatar() {
  const clipId = useId();
  return <svg viewBox="0 0 80 80" fill="none" aria-hidden="true" focusable="false">
    <defs><clipPath id={clipId}><circle cx="40" cy="40" r="40" /></clipPath></defs>
    <g clipPath={`url(#${clipId})`}>
      <path fill="var(--scene-lime)" d="M0 0h80v80H0z" />
      <path fill="var(--primary)" d="M13 82c1-18 10-25 27-25s26 7 27 25" />
      <path stroke="var(--primary-foreground)" strokeWidth="2" strokeLinecap="round" d="m30 66 4 12m16-12-4 12" />
      <g stroke="var(--foreground)" strokeWidth="2" strokeLinejoin="round">
        <ellipse cx="20" cy="24" rx="10" ry="12" fill="var(--scene-peach)" />
        <ellipse cx="60" cy="24" rx="10" ry="12" fill="var(--scene-peach)" />
        <path fill="var(--scene-rose)" stroke="none" d="M16 25c-3-10 9-11 9 1Zm39 1c0-12 12-11 9-1Z" />
        <path fill="var(--scene-peach)" d="M15 39c0-12 8-21 20-22l-2-8 10 6 7-5-1 9c10 3 16 10 16 21l4 9c-1 12-15 20-29 20S12 61 11 49Z" />
      </g>
      <path fill="var(--illustration-paper)" d="M40 48c-7-13-23-8-23 3 0 9 11 15 23 15s23-6 23-15c0-11-16-16-23-3Z" />
      <ellipse cx="29" cy="37" rx="8" ry="10" fill="var(--illustration-paper)" />
      <ellipse cx="51" cy="37" rx="8" ry="10" fill="var(--illustration-paper)" />
      <ellipse cx="31" cy="38" rx="4.5" ry="6.5" fill="var(--foreground)" />
      <ellipse cx="49" cy="38" rx="4.5" ry="6.5" fill="var(--foreground)" />
      <circle cx="32" cy="35" r="1.8" fill="var(--illustration-paper)" />
      <circle cx="50" cy="35" r="1.8" fill="var(--illustration-paper)" />
      <path d="M34 47c0-4 12-4 12 0 0 3-4 5-6 5s-6-2-6-5Z" fill="var(--foreground)" />
      <path d="M30 54q10 13 20 0" fill="var(--foreground)" stroke="var(--foreground)" strokeWidth="2" strokeLinecap="round" />
      <path d="M36 55h8v6h-8z" fill="var(--illustration-paper)" />
      <path d="M40 55v5M23 26l9-2m16 0 9 2" stroke="var(--foreground)" strokeWidth="1.5" strokeLinecap="round" />
    </g>
  </svg>;
}
