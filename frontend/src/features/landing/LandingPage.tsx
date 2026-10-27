import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  CirclePlay,
  LockKeyhole,
  Menu,
  PieChart,
  Plus,
  Users,
  X,
  Sprout,
  UserRound,
  Apple,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BudgetPreview } from "./BudgetPreview";
import { ProductHighlights } from "./ProductHighlights";
import { ReferenceArtwork } from "./ReferenceArtwork";

type Panel =
  | "demo"
  | "intro"
  | "login"
  | "faq"
  | "privacy"
  | "terms"
  | "contact"
  | null;
const benefits = [
  {
    icon: Users,
    title: "فضای مالی مشترک",
    text: "مدیریت شفاف هزینه‌ها با عزیزانتان",
  },
  {
    icon: BarChart3,
    title: "بودجه و هدف‌گذاری",
    text: "کنترل هزینه‌ها و رسیدن به اهداف مالی",
  },
  {
    icon: PieChart,
    title: "گزارش‌های ساده و کاربردی",
    text: "تصویر روشن از وضعیت مالی‌تان",
  },
  {
    icon: LockKeyhole,
    title: "خصوصی و امن",
    text: "با انتخاب شما، شخصی یا مشترک",
  },
];
const questions = [
  [
    "مابان برای چه کسانی است؟",
    "برای خانواده‌ها، زوج‌ها و هر کسی که می‌خواهد هزینه‌ها و هدف‌های مالی‌اش را با نظم بیشتری مدیریت کند.",
  ],
  [
    "آیا همین حالا می‌توانم حساب بسازم؟",
    "مابان در حال توسعه است. فعلاً شروع رایگان، نسخهٔ نمایشی را باز می‌کند؛ ثبت‌نام، ورود و حساب‌های مشترک هنوز فعال نیستند.",
  ],
  [
    "آیا اطلاعات بانکی لازم است؟",
    "خیر. این نمونه به هیچ بانکی متصل نیست و فقط با اطلاعات ساختگی کار می‌کند.",
  ],
  [
    "اطلاعات نسخهٔ نمایشی ذخیره می‌شوند؟",
    "خیر. خریدهای نمونه فقط در حافظهٔ همین صفحه می‌مانند و با بستن نمونه یا تازه‌سازی صفحه پاک می‌شوند.",
  ],
];
const info = {
  login: {
    title: "به مابان خوش آمدید",
    text: "ورود و ثبت‌نام هنوز فعال نیست. تا آماده‌شدن حساب‌های کاربری، می‌توانید بدون واردکردن اطلاعات شخصی، نسخهٔ نمایشی را امتحان کنید.",
  },
  intro: {
    title: "یک خانه، یک تصویر روشن از پول‌ها",
    text: "ایدهٔ مابان ساده است: درآمدها و هزینه‌ها را یک‌جا ببینید، برای ماهتان بودجه تعیین کنید و برای هدف‌های مشترک کنار هم پس‌انداز کنید. در نمونهٔ تعاملی می‌توانید اثر ثبت یک خرید روی بودجه را ببینید.",
  },
  privacy: {
    title: "حریم خصوصی در نسخهٔ نمایشی",
    text: "این صفحه حساب کاربری، فرم اطلاعات شخصی یا اتصال بانکی ندارد. داده‌های دمو ساختگی‌اند، فقط در حافظهٔ صفحه قرار دارند و ذخیره نمی‌شوند. فونت‌ها از سرویس CDN بارگیری می‌شوند. سیاست کامل حریم خصوصی پیش از راه‌اندازی حساب‌های واقعی منتشر خواهد شد.",
  },
  terms: {
    title: "شرایط استفاده از پیش‌نمایش",
    text: "این نسخه برای آشنایی با مابان است و خدمات مالی یا بانکی ارائه نمی‌دهد. اعداد و گزارش‌ها نمونه‌اند. شرایط استفادهٔ محصول نهایی پیش از شروع ثبت‌نام منتشر خواهد شد.",
  },
  contact: {
    title: "ارتباط با مابان",
    text: "مابان هنوز در مرحلهٔ توسعه است. مسیر رسمی پشتیبانی هم‌زمان با راه‌اندازی حساب‌های کاربری در همین صفحه اعلام می‌شود.",
  },
};

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [active, setActive] = useState("#home");
  const opener = useRef<HTMLElement | null>(null);
  const menuToggle = useRef<HTMLButtonElement | null>(null);
  const openPanel = (next: Panel) => {
    opener.current = document.activeElement as HTMLElement;
    setMenuOpen(false);
    setPanel(next);
  };
  const follow = (href: string) => {
    setActive(href);
    setMenuOpen(false);
  };
  const navigation = (
    <>
      <a
        href="#home"
        className={active === "#home" ? "nav-active" : undefined}
        aria-current={active === "#home" ? "page" : undefined}
        onClick={() => follow("#home")}
      >
        خانه
      </a>
      <a
        href="#features"
        className={active === "#features" ? "nav-active" : undefined}
        onClick={() => follow("#features")}
      >
        امکانات
      </a>
      <a
        href="#audience"
        className={active === "#audience" ? "nav-active" : undefined}
        onClick={() => follow("#audience")}
      >
        برای چه کسانی؟
      </a>
      <button onClick={() => openPanel("faq")}>سؤالات متداول</button>
      <a
        href="#about"
        className={active === "#about" ? "nav-active" : undefined}
        onClick={() => follow("#about")}
      >
        دربارهٔ ما
      </a>
    </>
  );
  return (
    <>
      <a className="skip-link" href="#main">
        رفتن به محتوای اصلی
      </a>
      <div id="home" className="landing-top">
        <header className="container header-inner">
          <a
            className="brand-link"
            href="#home"
            aria-label="مابان، صفحهٔ اصلی"
            onClick={() => follow("#home")}
          >
            <ReferenceArtwork variant="brand" />
          </a>
          <nav className="desktop-nav" aria-label="ناوبری اصلی">
            {navigation}
          </nav>
          <div className="header-actions">
            <Button
              variant="outline"
              className="login-button"
              onClick={() => openPanel("login")}
            >
              ورود
            </Button>
            <Button onClick={() => openPanel("demo")}>شروع رایگان</Button>
            <Button
              variant="ghost"
              size="icon"
              className="mobile-toggle"
              ref={menuToggle}
              aria-label={menuOpen ? "بستن فهرست" : "باز کردن فهرست"}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </header>
        {menuOpen && (
          <nav
            id="mobile-nav"
            className="mobile-nav container"
            aria-label="ناوبری موبایل"
          >
            {navigation}
            <button onClick={() => openPanel("login")}>ورود به مابان</button>
          </nav>
        )}
        <main id="main">
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-copy">
              <span className="section-pill">مدیریت مالی شخصی و خانوادگی</span>
              <h1 id="hero-title">
                با مابان،
                <br />
                پول‌هاتون رو باهم
                <br />
                بهتر مدیریت کنید
              </h1>
              <p>
                مابان به شما و عزیزانتان کمک می‌کند درآمدها، هزینه‌ها، بودجه‌ها
                و اهداف مالی‌تان را ساده، شفاف و در یک فضای مشترک مدیریت کنید.
              </p>
              <div className="hero-actions">
                <Button size="lg" onClick={() => openPanel("demo")}>
                  <ArrowRight data-icon="inline-start" />
                  شروع رایگان
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => openPanel("intro")}
                >
                  <CirclePlay data-icon="inline-start" />
                  معرفی مابان
                </Button>
              </div>
              <div className="hero-notes">
                {[
                  "راه‌اندازی سریع",
                  "استفادهٔ آسان",
                  "ویژهٔ خانواده و زوج‌ها",
                ].map((text) => (
                  <span key={text}>
                    <Check />
                    {text}
                  </span>
                ))}
              </div>
            </div>
            <ReferenceArtwork variant="hero" />
          </section>
          <section className="benefit-band" aria-label="مزایای مابان">
            <div className="container benefits">
              {benefits.map(({ icon: Icon, title, text }) => (
                <article key={title}>
                  <span className="benefit-icon">
                    <Icon size={28} strokeWidth={2.4} />
                  </span>
                  <div>
                    <h2>{title}</h2>
                    <p>{text}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="container features-section" id="features">
            <div className="features-copy">
              <span className="section-pill">امکانات مابان</span>
              <h2>
                همه‌چیز برای یک مدیریت مالی
                <br />
                آرام و هوشمند
              </h2>
              <ul>
                {[
                  "ثبت سریع و سادهٔ درآمد و هزینه",
                  "تقسیم هزینه‌ها بین اعضای خانواده",
                  "تعریف بودجه‌های ماهانه و دسته‌بندی هزینه‌ها",
                  "هدف‌گذاری برای خریدها و برنامه‌های مهم",
                  "گزارش‌های تصویری و قابل فهم",
                ].map((text) => (
                  <li key={text}>
                    <Check />
                    {text}
                  </li>
                ))}
              </ul>
            </div>
            <ProductHighlights />
          </section>
          <section className="container audience-section" id="audience">
            <div className="audience-copy">
              <h2>مابان برای چه کسانی است؟</h2>
              <div className="audience-cards">
                <article>
                  <UserRound />
                  <p>
                    هر کسی که به دنبال
                    <br />
                    مدیریت بهتر پول است
                  </p>
                </article>
                <article>
                  <Users />
                  <p>
                    خانواده‌ها
                    <br />و زوج‌ها
                  </p>
                </article>
                <article>
                  <Sprout />
                  <p>
                    کسانی که می‌خواهند
                    <br />
                    به اهداف مالی‌شان برسند
                  </p>
                </article>
              </div>
            </div>
            <blockquote id="about">
              <span aria-hidden="true">”</span>
              <p>
                با مابان، گفتگو دربارهٔ پول
                <br />
                ساده‌تر، شفاف‌تر و بدون استرس می‌شود.
              </p>
            </blockquote>
          </section>
          <section className="closing">
            <Button
              variant="inverse"
              size="lg"
              onClick={() => openPanel("demo")}
            >
              <ArrowRight data-icon="inline-start" />
              شروع رایگان
            </Button>
            <div>
              <h2>همین حالا مابان را امتحان کنید</h2>
              <p>مدیریت مالی آگاهانه، کنار کسانی که براتون مهم‌اند.</p>
            </div>
            <div className="app-tile" aria-hidden="true">
              <ReferenceArtwork variant="symbol" />
            </div>
          </section>
        </main>
      </div>
      <footer className="site-footer">
        <div className="container footer-inner">
          <a
            href="#home"
            className="footer-brand"
            aria-label="مابان، بازگشت به بالا"
          >
            <ReferenceArtwork variant="footer-brand" />
          </a>
          <p>اپلیکیشن مدیریت مالی شخصی و خانوادگی</p>
          <nav aria-label="پیوندهای پایانی">
            <a href="#about" onClick={() => follow("#about")}>
              دربارهٔ ما
            </a>
            <button onClick={() => openPanel("contact")}>تماس با ما</button>
            <button onClick={() => openPanel("privacy")}>حریم خصوصی</button>
            <button onClick={() => openPanel("terms")}>قوانین استفاده</button>
          </nav>
          <div className="store-links">
            <span>به‌زودی در</span>
            <span className="store-badge" lang="en" dir="ltr">
              <Play size={17} />
              Google Play
            </span>
            <span className="store-badge" lang="en" dir="ltr">
              <Apple size={18} />
              App Store
            </span>
          </div>
        </div>
      </footer>
      <Dialog
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <DialogContent
          dir="rtl"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            (opener.current?.isConnected
              ? opener.current
              : menuToggle.current
            )?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {panel === "demo"
                ? "نسخهٔ نمایشی مابان"
                : panel === "faq"
                  ? "سؤالات متداول"
                  : panel
                    ? info[panel].title
                    : ""}
            </DialogTitle>
            <DialogDescription>
              {panel === "demo"
                ? "بدون ثبت‌نام امتحان کنید. اطلاعات نمونه‌اند و ذخیره نمی‌شوند."
                : panel === "faq"
                  ? "پاسخ‌های روشن، قبل از شروع."
                  : panel
                    ? info[panel].text
                    : ""}
            </DialogDescription>
          </DialogHeader>
          {panel === "demo" && <BudgetPreview />}
          {panel === "faq" && (
            <div className="faq-list">
              {questions.map(([q, a]) => (
                <details key={q}>
                  <summary>
                    {q}
                    <Plus size={19} />
                  </summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          )}
          {(panel === "intro" || panel === "login") && (
            <Button onClick={() => setPanel("demo")}>
              امتحان نسخهٔ نمایشی
              <ArrowLeft data-icon="inline-end" />
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
