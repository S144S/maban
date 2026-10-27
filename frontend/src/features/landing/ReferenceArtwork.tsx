/** The supplied reference is kept intact. Only its non-interactive product art
 * and existing brand marks are framed here; all landing UI is native HTML. */
export function ReferenceArtwork({
  variant,
}: {
  variant: "hero" | "brand" | "symbol" | "footer-brand";
}) {
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
