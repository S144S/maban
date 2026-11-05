/** Decorative, scalable artwork shared by the welcome and authentication scenes. */
export function FinanceIllustration({ compact = false }: { compact?: boolean }) {
  return <svg className={`finance-illustration${compact ? " finance-illustration-compact" : ""}`} viewBox="0 0 400 300" fill="none" aria-hidden="true">
    <g stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="202" cy="267" rx="132" ry="9" fill="var(--illustration-paper)" />
      <path d="M95 124 266 97Q285 94 289 114L307 232Q309 248 291 251L115 266Q96 267 94 249L82 146Q80 130 95 124Z" fill="var(--illustration-paper)" />
      <path d="m99 127 160-24M107 145l166-25M112 249l165-16" />
      <path d="M94 150q-1-14 14-16l183-18q17-1 18 16l9 109q1 16-16 17l-182 13q-16 1-17-15Z" fill="var(--scene-peach)" />
      <path d="m113 151 178-18M120 252l178-13" strokeDasharray="3 7" />
      <path d="m278 175 37-3 4 44-37 3q-17 0-18-20t14-24Z" fill="var(--illustration-paper)" />
      <circle cx="285" cy="196" r="6" fill="currentColor" />
      <path d="m141 117-16-57 66-19 20 69" fill="var(--illustration-paper)" />
      <path d="m138 66 43-13 13 45-44 13Z" fill="var(--scene-lime)" />
      <ellipse cx="165" cy="82" rx="9" ry="12" transform="rotate(-17 165 82)" />
      <path d="M217 114V70m0 20q-41 4-39-29 34-7 39 29Zm0-10q-2-38 36-39 4 34-36 39Z" fill="var(--scene-lime)" />
      <circle cx="276" cy="53" r="22" fill="var(--illustration-paper)" />
      <path d="M276 40v26m6-21q-15-6-13 3 0 4 7 5t6 7q-3 5-12 1M60 96l5-13 5 13 13 5-13 5-5 13-5-13-13-5Zm270 28 3-9 4 9 9 3-9 4-4 9-3-9-9-4ZM58 197l13-4m-5-13 3 7M323 67l9-9m-16 3 2-12" />
      <path d="M159 193q6-12 12-1m28-4q7-12 13-1m-34 19q10 10 21-2" />
    </g>
  </svg>;
}
