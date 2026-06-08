// When the tool is loaded inside an iframe, continuously report its content
// height to the host page so the embed can resize seamlessly (no inner scrollbar,
// no clipped content). The host listens for {type:"wpr-embed-height"} — see the
// embed snippet in the README. No-op when not framed.
export function initEmbedHeight(id = "wpr-property-transactions") {
  if (typeof window === "undefined" || window.parent === window) return;

  let last = 0;
  const post = () => {
    const height = Math.ceil(document.documentElement.scrollHeight);
    if (height === last) return;
    last = height;
    window.parent.postMessage({ type: "wpr-embed-height", id, height }, "*");
  };

  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(post).observe(document.documentElement);
  }
  window.addEventListener("load", post);
  window.addEventListener("resize", post);
  // Catch async content (lazy map, fonts, charts) settling in.
  [200, 800, 2000].forEach((t) => setTimeout(post, t));
}
