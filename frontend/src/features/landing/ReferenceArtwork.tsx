/** Scalable brand artwork; the legacy bitmap is only used for product imagery. */
export function ReferenceArtwork({
  variant,
}: {
  variant: "hero" | "brand" | "symbol" | "footer-brand";
}) {
  if (variant !== "hero") {
    return <span className={`reference-art reference-${variant}`} aria-hidden="true">
      <span className="brand-mark" />
      {variant !== "symbol" && <span className="brand-wordmark">مابان</span>}
    </span>;
  }
  return (
    <span className={`reference-art reference-${variant}`}>
      <img
        src="/assets/maban-reference.png"
        alt={
          variant === "hero"
            ? "پیش‌نمایش اپلیکیشن مابان روی دو گوشی؛ نمای بودجه‌ها و حساب خانواده"
            : ""
        }
        width="1221"
        height="1288"
        fetchPriority={variant === "hero" ? "high" : undefined}
        draggable={false}
      />
    </span>
  );
}
