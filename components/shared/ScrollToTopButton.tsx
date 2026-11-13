"use client";

import { RefObject, useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

// Hiện nút khi đã cuộn quá khoảng một màn hình. Không truyền `target` thì theo dõi cuộn của cả trang (window).
export function ScrollToTopButton({ target, className = "" }: { target?: RefObject<HTMLElement | null>; className?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = target?.current ?? null;
    const source: HTMLElement | Window = element ?? window;
    const update = () => {
      const scrolled = element ? element.scrollTop : window.scrollY;
      const viewport = element ? element.clientHeight : window.innerHeight;
      setVisible(scrolled > Math.max(400, viewport));
    };
    update();
    source.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      source.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [target]);

  if (!visible) return null;
  const scrollToTop = () => (target?.current ?? window).scrollTo({ top: 0, behavior: "smooth" });
  return <button type="button" className={`scroll-top-button ${className}`.trim()} onClick={scrollToTop} aria-label="Cuộn lên đầu trang"><ArrowUp size={20} strokeWidth={2.4} /></button>;
}
