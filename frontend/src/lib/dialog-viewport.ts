// Mobile keyboards can shrink/pan the visual viewport without resizing the layout viewport.
export function trackDialogViewport(container: HTMLElement, view: Window = window) {
  const viewport = view.visualViewport;
  if (!viewport) return () => {};
  let frame = 0;
  let revealFocus = true;

  function update() {
    frame = 0;
    container.style.height = `${viewport!.height}px`;
    container.style.top = `${viewport!.offsetTop}px`;
    if (revealFocus) {
      const content = container.querySelector<HTMLElement>('[data-slot="dialog-content"]');
      const active = container.ownerDocument.activeElement;
      if (content && active && content.contains(active)) {
        const field = active.getBoundingClientRect();
        const sheet = content.getBoundingClientRect();
        const top = sheet.top + 12;
        const bottom = sheet.bottom - 12;
        // Scroll only the sheet; scrollIntoView can also pan the page on iOS.
        if (field.bottom > bottom) content.scrollTop += field.bottom - bottom;
        else if (field.top < top) content.scrollTop -= top - field.top;
      }
    }
    revealFocus = false;
  }
  function schedule(reveal: boolean) {
    revealFocus ||= reveal;
    if (!frame) frame = view.requestAnimationFrame(update);
  }
  const resize = () => schedule(true);
  const scroll = () => schedule(false);
  viewport.addEventListener("resize", resize);
  viewport.addEventListener("scroll", scroll);
  view.addEventListener("resize", resize);
  container.addEventListener("focusin", resize);
  update();
  return () => {
    view.cancelAnimationFrame(frame);
    viewport.removeEventListener("resize", resize);
    viewport.removeEventListener("scroll", scroll);
    view.removeEventListener("resize", resize);
    container.removeEventListener("focusin", resize);
  };
}
