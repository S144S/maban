import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpLeft,
  Bell,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  Gem,
  LockKeyhole,
  Menu,
  MonitorSmartphone,
  ShoppingBasket,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReferenceArtwork } from "./ReferenceArtwork";
import { ProductPreview } from "./ProductPreview";
import { HomeDoodle, HomeStory } from "./HomeStory";
import { useEntranceMotion } from "./useEntranceMotion";
import "./landing.css";

const questions = [
  [
    "برای شروع چی لازم دارم؟",
    "با شمارهٔ موبایل و کد تأیید حساب بسازین و خانواده‌تون رو ایجاد کنین. بعد می‌تونین اعضا رو دعوت کنین و درآمد، خرج یا اولین لیست خرید رو ثبت کنین.",
  ],
  [
    "اگه یه خرج رو دیر یادم اومد چی؟",
    "تاریخ خرج به‌صورت پیش‌فرض زمان ثبتشه. می‌تونین تاریخش رو تغییر بدین تا خرید چند روز پیش هم با تاریخ درست توی حساب‌وکتاب و گزارش‌ها بیاد.",
  ],
  [
    "کدوم اطلاعات رو اعضای خانواده می‌بینن؟",
    "درآمدها، خرج‌ها و لیست‌های خرید در فضای خانواده مشترکن. سرمایه‌گذاری‌ها و دارایی‌ها شخصی‌ان. یادآورها هم شخصی‌ان؛ برای ارسال پیامک یادآوری به دیگران، خودتون اعضای خانواده رو انتخاب می‌کنین.",
  ],
  [
    "مابان به حساب بانکی وصل می‌شه؟",
    "نه، درآمدها و خرج‌ها رو خودتون ثبت می‌کنین. مابان ابزار مدیریت و گزارش حساب‌وکتابه و خدمات بانکی، انتقال پول یا مشاورهٔ سرمایه‌گذاری ارائه نمی‌ده.",
  ],
  [
    "پیامک یادآوری هزینه داره؟",
    "بله، هزینهٔ پیامک از اعتبار کیف پول خدمات خانواده کم می‌شه و به تعداد گیرنده‌ها و بخش‌های پیامک بستگی داره. تعرفه و اعتبار رو می‌تونین داخل مابان ببینین.",
  ],
  [
    "باید اپلیکیشن نصب کنم؟",
    "نه، مابان توی مرورگر موبایل و کامپیوتر باز می‌شه. می‌تونین از گزینهٔ نصب یا افزودن به صفحهٔ اصلی مرورگرتون هم استفاده کنین. برای کار با مابان به اینترنت نیاز دارین.",
  ],
];
const information = {
  privacy: {
    title: "دربارهٔ حریم خصوصی",
    text: "اطلاعات حساب کاربری و داده‌هایی که در مابان ثبت می‌کنین روی سرور نگهداری می‌شن. درآمدها، خرج‌ها و خریدهای هر خانواده در دسترس اعضای همون خانواده‌ان؛ سرمایه‌گذاری‌ها و دارایی‌ها شخصی‌ان. یادآورها شخصی‌ان و می‌تونین اعضای خانواده رو به‌عنوان گیرندهٔ پیامک انتخاب کنین. شمارهٔ گیرنده و متن پیامک برای ارسال در اختیار سرویس پیامک قرار می‌گیره. رمز عبور به‌صورت هش نگهداری می‌شه. مابان به حساب بانکی شما متصل نیست. فونت‌های صفحه از CDN بارگیری می‌شن. اطلاعات بخش «نمایش نمونه» فقط در حافظهٔ همین صفحه‌ان و با تازه‌سازی پاک می‌شن.",
  },
  terms: {
    title: "دربارهٔ استفاده از مابان",
    text: "مابان برای ثبت و مرور اطلاعات مالی، خریدها و یادآورهای شماست. درستی اطلاعات واردشده رو بررسی کنین؛ گزارش‌ها بر اساس همین اطلاعات ساخته می‌شن. مابان خدمات بانکی یا مشاورهٔ مالی ارائه نمی‌ده و سود سرمایه‌گذاری رو تضمین نمی‌کنه. پیامک یادآوری از اعتبار کیف پول خدمات خانواده استفاده می‌کنه و هزینه‌اش به تعداد گیرنده‌ها و بخش‌های پیامک بستگی داره. اعداد نمایش نمونه ساختگی‌ان و به حساب کاربری شما ارتباطی ندارن.",
  },
};

export function LandingPage() {
  const mainRef = useEntranceMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState<keyof typeof information | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const menuToggle = useRef<HTMLButtonElement>(null);
  const navigation = (
    <>
      <a href="#features" onClick={() => setMenuOpen(false)}>
        امکانات مابان
      </a>
      <a href="#start" onClick={() => setMenuOpen(false)}>
        چطور شروع کنم؟
      </a>
      <a href="#questions" onClick={() => setMenuOpen(false)}>
        پرسش‌ها
      </a>
    </>
  );
  function openPanel(next: keyof typeof information) {
    opener.current = document.activeElement as HTMLElement;
    setPanel(next);
  }
  return (
    <div
      className="maban-landing"
      id="home"
      onKeyDown={(event) => {
        if (menuOpen && event.key === "Escape") {
          setMenuOpen(false);
          menuToggle.current?.focus();
        }
      }}
    >
      <a className="skip-link" href="#main">
        رفتن به محتوای اصلی
      </a>
      <header className="landing-container landing-header">
        <a href="#home" aria-label="مابان، صفحهٔ اصلی">
          <ReferenceArtwork variant="brand" />
        </a>
        <nav className="landing-desktop-nav" aria-label="ناوبری اصلی">
          {navigation}
        </nav>
        <div className="landing-header-actions">
          <Button asChild variant="ghost" className="landing-login">
            <a href="/login">ورود</a>
          </Button>
          <Button asChild>
            <a href="/signup">شروع با مابان</a>
          </Button>
          <Button
            ref={menuToggle}
            variant="ghost"
            size="icon"
            className="landing-menu-toggle"
            aria-label={menuOpen ? "بستن فهرست" : "باز کردن فهرست"}
            aria-controls="landing-mobile-nav"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </header>
      {menuOpen && (
        <nav
          id="landing-mobile-nav"
          className="landing-container landing-mobile-nav"
          aria-label="ناوبری موبایل"
        >
          {navigation}
          <a href="/login">ورود به حساب کاربری</a>
        </nav>
      )}
      <main id="main" ref={mainRef} tabIndex={-1}>
        <section
          className="landing-container landing-hero"
          aria-labelledby="landing-title"
        >
          <div className="landing-hero-copy" data-entrance>
            <h1 id="landing-title">
              حساب‌وکتاب خونه،
              <br />
              <span>ساده‌تر از همیشه</span>
            </h1>
            <p>
              از خرج‌های روزمره تا خریدهای خونه؛ پول‌هاتون رو یک‌جا ببینین و
              حساب‌وکتاب رو با هم پیش ببرین.
            </p>
            <div className="landing-hero-actions">
              <Button size="lg" asChild>
                <a href="/signup">
                  ساخت حساب کاربری <ArrowLeft />
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#demo">مابان رو امتحان کنین</a>
              </Button>
            </div>
            <p className="landing-device-note">
              <MonitorSmartphone aria-hidden="true" size={18} />
              روی موبایل و کامپیوتر، توی مرورگر شما
            </p>
          </div>
          <div className="landing-hero-stage" data-entrance>
            <HomeStory />
            <ProductPreview />
          </div>
        </section>

        <section
          className="landing-container landing-principles"
          aria-label="مابان در یک نگاه"
        >
          <div>
            <Users aria-hidden="true" />
            <p>
              <strong>حساب‌وکتاب، کنار هم</strong>
              <span>درآمد و خرج مشترک خانواده</span>
            </p>
          </div>
          <div>
            <ShoppingBasket aria-hidden="true" />
            <p>
              <strong>خریدها، سر و سامون‌گرفته</strong>
              <span>از لیست خرید تا ثبت هزینه</span>
            </p>
          </div>
          <div>
            <ChartNoAxesCombined aria-hidden="true" />
            <p>
              <strong>پول‌ها، روشن و خوانا</strong>
              <span>گزارش بر اساس ثبت‌های شما</span>
            </p>
          </div>
        </section>

        <section
          className="landing-container landing-section"
          id="features"
          aria-labelledby="features-title"
          data-entrance
        >
          <div className="landing-section-heading">
            <h2 id="features-title">
              برای ریز و درشتِ
              <br />
              زندگی روزمره
            </h2>
            <p>
              چیزهایی که معمولاً بین چندتا دفتر، پیام و یادداشت پخش می‌شن، اینجا
              کنار هم قرار می‌گیرن.
            </p>
          </div>
          <div className="landing-feature-grid">
            <article className="landing-feature landing-feature-finance">
              <span className="landing-feature-icon">
                <Wallet aria-hidden="true" />
              </span>
              <h3>هر خرج، سر جای خودش</h3>
              <p>
                درآمد و هزینه رو با دسته‌بندی ثبت کنین، برای دسته‌ها سقف ماهانه
                بذارین و گزارش بازهٔ دلخواهتون رو ببینین.
              </p>
              <div className="landing-date-example">
                <span>
                  <Check aria-hidden="true" size={18} />
                  خرجی رو دیر یادتون اومده؟
                </span>
                <strong>خرید دو روز پیش، با تاریخ دو روز پیش.</strong>
                <small>تاریخ خرج موقع ثبت قابل تغییره.</small>
              </div>
            </article>
            <article className="landing-feature landing-feature-shopping">
              <span className="landing-feature-icon">
                <ShoppingBasket aria-hidden="true" />
              </span>
              <h3>یه لیست برای خریدهای خونه</h3>
              <p>
                لیست بسازین، تعداد و توضیح اضافه کنین و خریدها رو با هم تیک
                بزنین. آخر خرید هم می‌تونین هزینهٔ کل لیست رو ثبت کنین.
              </p>
              <ul className="landing-list-example" aria-label="نمونهٔ لیست خرید">
                <li>
                  <Check aria-hidden="true" />
                  <span>شیر</span>
                  <small>۲ عدد</small>
                </li>
                <li>
                  <Check aria-hidden="true" />
                  <span>نان</span>
                  <small>۳ عدد</small>
                </li>
                <li>
                  <ShoppingBasket aria-hidden="true" />
                  <span>میوه</span>
                  <small>برای هفته</small>
                </li>
              </ul>
            </article>
            <article className="landing-feature landing-feature-compact">
              <span className="landing-feature-icon">
                <Bell aria-hidden="true" />
              </span>
              <div>
                <h3>کارهای مهم یادتون بمونه</h3>
                <p>
                  یادآور شخصی و تکرارشونده بسازین. برای خودتون و اعضایی که
                  انتخاب می‌کنین، پیامک یادآوری تنظیم کنین.
                </p>
                <small>
                  پیامک با هزینه از کیف پول خدمات خانواده ارسال می‌شه.
                </small>
              </div>
            </article>
            <article className="landing-feature landing-feature-compact">
              <span className="landing-feature-icon">
                <Gem aria-hidden="true" />
              </span>
              <div>
                <h3>یه نگاه هم به داشته‌هاتون</h3>
                <p>
                  سرمایه‌گذاری‌هایی مثل طلا، ارز و سهام، و دارایی‌هایی مثل خونه
                  و ماشین رو در بخش شخصی خودتون ثبت و مرور کنین.
                </p>
                <small>جدا از درآمد و خرج مشترک خانواده.</small>
              </div>
            </article>
          </div>
        </section>

        <section
          className="landing-sharing"
          aria-labelledby="sharing-title"
          data-entrance
        >
          <div className="landing-container landing-sharing-inner">
            <div>
              <HomeDoodle />
              <h2 id="sharing-title">
                کنار هم،
                <br />
                با مرزهای روشن
              </h2>
              <p>
                خانواده‌تون رو بسازین و عزیزاتون رو دعوت کنین. معلومه چی مشترکه
                و چی برای خود شماست.
              </p>
            </div>
            <div className="landing-sharing-details">
              <article>
                <Users aria-hidden="true" />
                <div>
                  <h3>برای خانواده</h3>
                  <p>
                    درآمدها، خرج‌ها و لیست‌های خرید بین اعضای همون خانواده
                    مشترکن.
                  </p>
                </div>
              </article>
              <article>
                <LockKeyhole aria-hidden="true" />
                <div>
                  <h3>برای خودتون</h3>
                  <p>
                    سرمایه‌گذاری‌ها و دارایی‌ها شخصی‌ان. برای پیامک یادآورها،
                    خودتون گیرنده‌های خانواده رو انتخاب می‌کنین.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section
          className="landing-container landing-section"
          id="start"
          aria-labelledby="start-title"
          data-entrance
        >
          <div className="landing-section-heading">
            <h2 id="start-title">
              از یه ثبت ساده
              <br />
              شروع کنین
            </h2>
            <p>
              لازم نیست همهٔ حساب‌وکتاب رو یک‌باره مرتب کنین. از خرید امروز یا
              درآمد این ماه شروع کنین.
            </p>
          </div>
          <ol className="landing-steps">
            {[
              [
                "۱",
                "حسابتون رو بسازین",
                "با شمارهٔ موبایل ثبت‌نام کنین و وارد مابان بشین.",
              ],
              [
                "۲",
                "خانواده رو کنار هم بیارین",
                "خانواده بسازین و اعضا رو دعوت کنین تا حساب‌وکتاب رو با هم پیش ببرین.",
              ],
              [
                "۳",
                "اولین خرج رو ثبت کنین",
                "مبلغ، دسته‌بندی و تاریخ رو وارد کنین؛ بعد تغییر حساب و گزارش رو ببینین.",
              ],
            ].map(([number, title, text]) => (
              <li key={number}>
                <span aria-hidden="true">{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          className="landing-container landing-section landing-questions"
          id="questions"
          aria-labelledby="questions-title"
          data-entrance
        >
          <div>
            <h2 id="questions-title">
              شاید سؤال شما
              <br />
              هم همین باشه
            </h2>
            <p>چند نکته قبل از شروع با مابان.</p>
          </div>
          <div className="landing-faq">
            {questions.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <ChevronDown aria-hidden="true" size={19} />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section
          className="landing-container landing-final"
          aria-labelledby="final-title"
          data-entrance
        >
          <div>
            <h2 id="final-title">
              حساب‌وکتاب روشن‌تر،
              <br />
              از همین امروز.
            </h2>
            <p>یه جای مشترک برای پول‌ها و کارهای خونه.</p>
            <HomeDoodle />
          </div>
          <div>
            <Button size="lg" asChild>
              <a href="/signup">
                شروع با مابان <ArrowLeft />
              </a>
            </Button>
            <a className="landing-existing-account" href="/login">
              حساب دارین؟ وارد بشین <ArrowUpLeft size={16} aria-hidden="true" />
            </a>
          </div>
        </section>
      </main>
      <footer className="landing-container landing-footer">
        <div>
          <a href="#home" aria-label="مابان، بازگشت به بالا">
            <ReferenceArtwork variant="brand" />
          </a>
          <p>حساب‌وکتاب خونه، ساده‌تر از همیشه</p>
        </div>
        <nav aria-label="پیوندهای پایانی">
          <a href="#features">امکانات مابان</a>
          <button onClick={() => openPanel("privacy")}>حریم خصوصی</button>
          <button onClick={() => openPanel("terms")}>شرایط استفاده</button>
        </nav>
        <p className="landing-footer-note">برای امروز، برای فردا، کنار هم.</p>
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
            opener.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{panel ? information[panel].title : ""}</DialogTitle>
            <DialogDescription className="landing-dialog-copy">
              {panel ? information[panel].text : ""}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
