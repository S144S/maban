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
import { useEntranceMotion } from "./useEntranceMotion";

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
    text: "حساب‌وکتاب روشن، کنار عزیزاتون",
  },
  {
    icon: BarChart3,
    title: "بودجه و هدف‌گذاری",
    text: "برای خرج‌ها و هدف‌هاتون برنامه بچینین",
  },
  {
    icon: PieChart,
    title: "گزارش‌های ساده و کاربردی",
    text: "ببینین پول‌هاتون کجا خرج می‌شه",
  },
  {
    icon: LockKeyhole,
    title: "خصوصی و امن",
    text: "با انتخاب شما، شخصی یا مشترک",
  },
];
const questions = [
  [
    "مابان به درد چه کسایی می‌خوره؟",
    "برای خانواده‌ها، زوج‌ها و هر کسی که می‌خواد حساب‌وکتابش رو راحت‌تر پیش ببره و برای هدف‌هاش برنامه داشته باشه.",
  ],
  [
    "الان می‌تونم حساب بسازم؟",
    "هنوز داریم مابان رو آماده می‌کنیم. فعلاً با «شروع رایگان» می‌تونین نسخهٔ نمایشی رو امتحان کنین؛ ثبت‌نام، ورود و حساب مشترک هنوز فعال نیست.",
  ],
  [
    "اطلاعات بانکی هم لازمه؟",
    "نه، هیچ اطلاعات بانکی لازم نیست. این نمونه به هیچ بانکی وصل نیست و اطلاعاتش ساختگیه.",
  ],
  [
    "اطلاعات نسخهٔ نمایشی ذخیره می‌شه؟",
    "نه، خریدهای نمونه فقط توی حافظهٔ همین صفحه می‌مونن. با بستن نمونه یا تازه‌سازی صفحه پاک می‌شن.",
  ],
];
const info = {
  login: {
    title: "به مابان خوش اومدین",
    text: "ورود و ثبت‌نام هنوز فعال نیست. تا حساب‌های کاربری آماده بشن، می‌تونین بدون واردکردن اطلاعات شخصی، نسخهٔ نمایشی رو امتحان کنین.",
  },
  intro: {
    title: "یه خونه، یه تصویر روشن از پول‌ها",
    text: "ایدهٔ مابان ساده‌ست: درآمدها و هزینه‌ها رو یک‌جا ببینین، برای ماهتون برنامه بچینین و برای هدف‌های مشترک کنار هم پس‌انداز کنین. توی نسخهٔ نمایشی می‌تونین یه خرید ثبت کنین و تغییر بودجه رو ببینین.",
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
  const mainRef = useEntranceMotion();
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
        برای کیاست؟
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
        <main id="main" ref={mainRef}>
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-copy" data-entrance>
              <span className="section-pill">
                <span className="friendly-emoji" aria-hidden="true">
                  🌱
                </span>{" "}
                حساب‌وکتاب، کنار هم
              </span>
              <h1 id="hero-title">
                با مابان،
                <br />
                پول‌هاتون رو با هم
                <br />
                بهتر مدیریت کنین
              </h1>
              <p>
                مابان کنارتونه تا درآمدها، خرج‌ها و هدف‌هاتون رو یک‌جا ببینین؛
                با عزیزاتون برنامه بچینین و راحت‌تر حساب‌وکتاب کنین.
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
                  "شروع بدون ثبت‌نام",
                  "ساده و راحت",
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
          <section
            className="container features-section"
            id="features"
            data-entrance
          >
            <div className="features-copy">
              <span className="section-pill">
                <span className="friendly-emoji" aria-hidden="true">
                  🎯
                </span>{" "}
                برای برنامه‌های شما
              </span>
              <h2>
                حساب‌وکتاب خونه،
                <br />
                ساده‌تر از همیشه
              </h2>
              <ul>
                {[
                  "درآمد و هزینه‌هاتون رو راحت ثبت کنین",
                  "خرج‌های مشترک رو با هم تقسیم کنین",
                  "برای خرج‌های هر ماه بودجه بذارین",
                  "برای هدف‌های کوچیک و بزرگ پس‌انداز کنین",
                  "با گزارش‌های ساده، از حساب‌هاتون باخبر باشین",
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
          <section
            className="container audience-section"
            id="audience"
            data-entrance
          >
            <div className="audience-copy">
              <h2>مابان به درد چه کسایی می‌خوره؟</h2>
              <div className="audience-cards">
                <article>
                  <UserRound />
                  <p>
                    هر کسی که می‌خواد
                    <br />
                    حواسش به پول‌هاش باشه
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
                    کسایی که می‌خوان
                    <br />
                    به هدف‌هاشون نزدیک‌تر بشن
                  </p>
                </article>
              </div>
            </div>
            <blockquote id="about">
              <span aria-hidden="true">”</span>
              <p>
                بیاین دربارهٔ پول راحت‌تر حرف بزنیم؛
                <br />
                قدم‌به‌قدم، بدون قضاوت.
              </p>
            </blockquote>
          </section>
          <section className="closing" data-entrance>
            <Button
              variant="inverse"
              size="lg"
              onClick={() => openPanel("demo")}
            >
              <ArrowRight data-icon="inline-start" />
              شروع رایگان
            </Button>
            <div>
              <h2>
                همین حالا مابان رو امتحان کنین{" "}
                <span className="friendly-emoji" aria-hidden="true">
                  ✨
                </span>
              </h2>
              <p>یه قدم کوچیک برای حساب‌وکتاب راحت‌تر، کنار عزیزاتون.</p>
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
                ? "بدون ثبت‌نام امتحان کنین. اطلاعات نمونه‌ان و ذخیره نمی‌شن."
                : panel === "faq"
                  ? "سؤالی دارین؟ از اینجا شروع کنیم."
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
