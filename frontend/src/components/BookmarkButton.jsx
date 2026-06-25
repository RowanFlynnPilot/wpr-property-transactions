import { useEffect, useRef, useState } from "react";

// Browsers don't allow a page to add a bookmark programmatically, so this button
// pops device-specific instructions instead. In the WordPress embed, the keyboard
// shortcut bookmarks the parent page (wausaupilotandreview.com/property-transactions/),
// which is what the reader wants.
function instructions() {
  const ua = navigator.userAgent || "";
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  if (coarse || /Android|iPhone|iPad|iPod|Mobile/i.test(ua)) {
    return "Open your browser’s menu, then tap “Add Bookmark” or “Add to Home Screen.”";
  }
  const mac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || ua);
  return `Press ${mac ? "⌘" : "Ctrl"} + D to bookmark this page so you can check back each week.`;
}

export default function BookmarkButton() {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const ref = useRef(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () =>
    setOpen((o) => {
      const next = !o;
      if (next) setMsg(instructions());
      return next;
    });

  return (
    <div className="bookmark" ref={ref}>
      <button
        type="button"
        className="bookmark-btn"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span aria-hidden="true">☆</span> Bookmark
      </button>
      {open && (
        <div className="bookmark-pop" role="dialog" aria-label="How to bookmark this page">
          {msg}
        </div>
      )}
    </div>
  );
}
