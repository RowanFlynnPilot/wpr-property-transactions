import { Suspense, useEffect, useRef, useState } from "react";

// Defer a below-the-fold section until the reader scrolls near it, so its code
// (the chart library, the map) isn't part of the initial page load.
//
// Works inside the WordPress embed too: IntersectionObserver's implicit root is
// the TOP-LEVEL viewport even from a cross-origin iframe, so "near the screen"
// means near what the reader actually sees, not the iframe's ~10,000px height.
//
// `minHeight` reserves roughly the section's height so the page doesn't jump
// when it arrives. Pair with React.lazy children.
export default function LoadWhenVisible({ minHeight, label, children }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible || !ref.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "800px 0px" } // start loading well before it scrolls in
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [visible]);

  const placeholder = (
    <div ref={ref} className="section-loading" style={{ minHeight }}>
      {label}
    </div>
  );
  if (!visible) return placeholder;
  return <Suspense fallback={<div className="section-loading" style={{ minHeight }}>{label}</div>}>{children}</Suspense>;
}
