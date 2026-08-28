import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  as?: "div" | "section" | "li" | "article";
  className?: string;
  style?: CSSProperties;
}

export function Reveal({ children, delay = 0, as = "div", className = "", style }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Tag = as as "div";
  return (
    <Tag
      ref={ref as never}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms`, ...style }}
    >
      {children}
    </Tag>
  );
}

/** Trigger only once its subtree scrolls into view; render prop receives `inView`. */
export function InView({ children, rootMargin = "0px 0px -10% 0px", threshold = 0.2 }: {
  children: (inView: boolean, ref: (el: HTMLElement | null) => void) => ReactNode;
  rootMargin?: string;
  threshold?: number;
}) {
  const [inView, setInView] = useState(false);
  const nodeRef = useRef<HTMLElement | null>(null);

  const setRef = (el: HTMLElement | null) => {
    nodeRef.current = el;
  };

  useEffect(() => {
    const el = nodeRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setInView(true); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { setInView(true); io.disconnect(); break; }
      }
    }, { threshold, rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin, threshold]);

  return <>{children(inView, setRef)}</>;
}
