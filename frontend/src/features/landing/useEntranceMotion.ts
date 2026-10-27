import { useEffect, useRef } from "react";

/** Content stays visible without observers or motion support. */
export function useEntranceMotion() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const targets = root.querySelectorAll("[data-entrance]");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("has-entered");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12 },
    );
    const sync = () => {
      observer.disconnect();
      if (preference.matches) {
        targets.forEach((target) => target.classList.add("has-entered"));
      } else {
        targets.forEach((target) => {
          if (!target.classList.contains("has-entered"))
            observer.observe(target);
        });
      }
    };
    sync();
    preference.addEventListener("change", sync);
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", sync);
    };
  }, []);
  return ref;
}
