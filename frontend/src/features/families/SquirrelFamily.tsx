/** A compact family illustration, drawn as whole characters rather than cropped avatars. */
function Chipmunk({ x, y, scale = 1, shirt }: { x: number; y: number; scale?: number; shirt: string }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} stroke="var(--foreground)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 78C-5 81-12 64-8 47c3-14 17-20 23-11 8 12-10 18-8 28 1 5 6 7 13 6" fill="var(--scene-peach)" />
    <path d="M5 48c-5 12-2 19 5 22" stroke="var(--illustration-paper)" strokeWidth="5" />
    <path d="M16 83c-1-21 5-34 20-34s22 13 20 34Z" fill={shirt} />
    <path d="M20 82h10m12 0h10" strokeWidth="5" />
    <path d="M18 62l-5 11m40-11 5 11" />
    <ellipse cx="18" cy="15" rx="8" ry="10" fill="var(--scene-peach)" />
    <ellipse cx="54" cy="15" rx="8" ry="10" fill="var(--scene-peach)" />
    <path d="M17 18v-5m38 5v-5" stroke="var(--scene-rose)" strokeWidth="5" />
    <path d="M12 34c0-15 9-24 24-24s24 9 24 24c5 13-7 24-24 24S7 47 12 34Z" fill="var(--scene-peach)" />
    <path d="M31 12l5 17 5-17" fill="var(--illustration-paper)" stroke="none" />
    <path d="M36 40c-8-10-19-5-19 3 0 7 9 12 19 12s19-5 19-12c0-8-11-13-19-3Z" fill="var(--illustration-paper)" stroke="none" />
    <ellipse cx="26" cy="32" rx="2.5" ry="3.5" fill="var(--foreground)" stroke="none" />
    <ellipse cx="46" cy="32" rx="2.5" ry="3.5" fill="var(--foreground)" stroke="none" />
    <path d="M32 40q4-3 8 0l-4 4Z" fill="var(--foreground)" />
    <path d="M30 47q6 6 12 0" />
    <path d="M22 24l6-1m16 0 6 1" />
  </g>;
}

export function SquirrelFamily() {
  return <svg viewBox="0 0 220 150" fill="none" aria-hidden="true" focusable="false">
    <ellipse cx="110" cy="132" rx="86" ry="7" fill="var(--border)" />
    <Chipmunk x={30} y={34} shirt="var(--scene-rose)" />
    <g transform="translate(220 0) scale(-1 1)"><Chipmunk x={30} y={34} shirt="var(--scene-lime)" /></g>
    <Chipmunk x={85} y={72} scale={0.7} shirt="var(--scene-peach)" />
    <path d="M110 28c-19-11-14-22-6-19 3 1 5 4 6 6 1-2 3-5 6-6 8-3 13 8-6 19Z" fill="var(--scene-rose)" stroke="var(--foreground)" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>;
}
