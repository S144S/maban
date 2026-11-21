import { Bell, Check, ShoppingBasket, Users, Wallet } from "lucide-react";

function Squirrel({
  x,
  y,
  shirt,
  small = false,
  mirrored = false,
}: {
  x: number;
  y: number;
  shirt: string;
  small?: boolean;
  mirrored?: boolean;
}) {
  const scale = small ? 0.75 : 1;
  return (
    <g
      transform={`translate(${x} ${y}) scale(${mirrored ? -scale : scale} ${scale})`}
    >
      <path
        className="story-squirrel-fur"
        d="M-13 50C-45 53-55 29-53 5C-52-12-44-19-48-31C-53-47-33-56-21-44C-8-32-13-15-28-8C-41-2-38 17-29 23C-23 27-16 27-11 36Z"
      />
      <path d="M-36-38C-23-43-18-27-29-21C-47-12-51 21-34 35Q-27 41-20 40" />
      <path className={shirt} d="M-25 58L-20 25Q0 10 20 25L26 58Z" />
      <path className="story-face" d="M-10 58L-9 31Q0 24 9 31L11 58Z" />
      <path
        className="story-squirrel-fur"
        d="M-17-9C-29-13-25-29-16-27Q-8-26-9-17Q0-20 9-17C8-26 16-30 22-25Q29-17 17-9C25-1 25 12 16 19Q0 30-16 19C-25 12-25-1-17-9Z"
      />
      <path
        className="story-face"
        d="M-12 11C-13 4-6 2 0 6C6 2 13 4 12 11Q11 21 0 22Q-11 21-12 11Z"
      />
      <path d="M-19-21Q-22-18-18-15M19-21Q22-18 18-15" />
      <ellipse
        className="story-squirrel-nose"
        cx="-8"
        cy="0"
        rx="1.5"
        ry="2.5"
      />
      <ellipse
        className="story-squirrel-nose"
        cx="8"
        cy="0"
        rx="1.5"
        ry="2.5"
      />
      <ellipse className="story-squirrel-nose" cx="0" cy="8" rx="3" ry="2" />
      <path className="story-face" d="M-4 15L4 15L3 21L-3 21Z" />
      <path d="M0 10L0 13M-7 13Q0 18 7 13M0 16L0 20M-16 9L-23 7M16 9L23 7M-16 40L-12 48M16 40L12 48" />
    </g>
  );
}

/** Original vector artwork. Labels remain HTML so Persian shaping and zoom stay native. */
export function HomeStory() {
  return (
    <div
      className="landing-home-story"
      aria-label="خانواده‌ای از سنجاب‌ها دور میز خونه؛ خریدها، درآمد و خرج و یادآورها کنار هم"
      role="img"
    >
      <svg
        className="landing-home-art"
        viewBox="0 0 600 460"
        fill="none"
        aria-hidden="true"
      >
        <g
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            className="story-ground"
            d="M52 391C124 365 177 377 253 382C356 389 430 363 551 393L543 420C377 438 209 442 60 416Z"
          />
          <path
            className="story-connection"
            d="M108 115C151 112 170 140 195 165M485 122C455 123 430 140 408 166M110 300C140 306 162 307 185 304M488 310C452 317 435 309 413 299"
          />
          <path
            className="story-roof"
            d="M144 202L294 73Q300 68 306 73L457 202L444 218L300 98L157 219Z"
          />
          <path className="story-chimney" d="M381 133L380 91L406 91L407 155" />
          <path className="story-smoke" d="M390 76C375 61 408 58 397 42" />
          <path
            className="story-wall"
            d="M171 207L300 100L429 208L429 387Q300 401 171 387Z"
          />
          <path d="M184 384L416 384M195 369L405 369" />
          <circle className="story-window" cx="300" cy="162" r="24" />
          <path d="M276 162L324 162M300 138L300 186" />
          <path
            className="story-interior"
            d="M200 220Q300 210 400 220L400 369L200 369Z"
          />
          <path d="M215 220L215 264M385 220L385 263" />
          <path className="story-lamp" d="M215 238L203 259L228 259Z" />
          <path className="story-lamp" d="M385 238L373 259L397 259Z" />
          <g className="story-family">
            <Squirrel x={247} y={278} shirt="story-shirt-one" />
            <Squirrel x={353} y={278} shirt="story-shirt-two" mirrored />
            <Squirrel x={300} y={295} shirt="story-shirt-three" small />
          </g>
          <path
            className="story-table"
            d="M213 336L386 336L390 346L210 346ZM225 346L224 369M373 346L375 369"
          />
          <path
            className="story-notebook"
            d="M271 335L282 324L315 324L324 335Z"
          />
          <path d="M298 325L299 334M332 325L342 325L342 335L332 335ZM342 327Q350 326 349 331Q348 334 343 332" />
          <path className="story-pot" d="M114 354L141 354L136 386L119 386Z" />
          <path d="M127 354L127 317" />
          <path
            className="story-leaf"
            d="M127 342Q104 341 105 321Q126 322 127 342ZM127 331Q126 309 147 309Q148 328 127 331Z"
          />
          <path
            className="story-bag"
            d="M458 347L488 348L493 385L453 385ZM465 348L465 339Q473 327 481 339L481 348"
          />
          <path d="M465 364L472 371L483 357" />
          <path
            className="story-sun"
            d="M91 211L91 229M82 220L100 220M493 218L493 230M487 224L499 224M320 39L320 50M314 45L326 45"
          />
          <path d="M75 377L80 372M519 375L523 381M299 412Q330 415 353 410" />
        </g>
      </svg>
      <span className="landing-story-chip story-chip-family">
        <Users aria-hidden="true" />
        خانوادهٔ شما
      </span>
      <span className="landing-story-chip story-chip-wallet">
        <Wallet aria-hidden="true" />
        درآمد و خرج
      </span>
      <span className="landing-story-chip story-chip-shopping">
        <ShoppingBasket aria-hidden="true" />
        خریدهای خونه <Check aria-hidden="true" className="story-chip-check" />
      </span>
      <span className="landing-story-chip story-chip-reminder">
        <Bell aria-hidden="true" />
        یادآورها
      </span>
      <span className="landing-story-caption" aria-hidden="true">
        همه‌چیز، دورِ یه خونه.
      </span>
    </div>
  );
}

export function HomeDoodle() {
  return (
    <svg
      className="landing-home-doodle"
      viewBox="0 0 180 150"
      fill="none"
      aria-hidden="true"
    >
      <g
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 78L85 24Q90 19 95 24L157 78L148 87L90 37L31 87Z" />
        <path d="M40 80L40 130L140 130L140 80M76 130L76 94Q90 82 104 94L104 130M64 61L64 30L47 30L47 73" />
        <path d="M83 65Q72 55 77 48Q83 42 90 51Q96 41 103 48Q111 56 90 71Z" />
        <path d="M17 119L17 132M11 125L23 125M156 42L156 54M150 48L162 48M58 141Q90 145 125 140" />
      </g>
    </svg>
  );
}
