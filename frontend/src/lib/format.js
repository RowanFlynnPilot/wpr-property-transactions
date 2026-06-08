// Small formatting helpers shared across the UI. Pure functions, no state.

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function money(n) {
  return USD.format(n ?? 0);
}

// Compact dollars for axis ticks / dense labels: 226730 -> "$227k", 3750000 -> "$3.8M".
export function moneyCompact(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

// ISO "2026-06-01" -> "Jun 1, 2026". Parsed as local to avoid TZ off-by-one.
export function prettyDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

// "Wausau, City of" -> "Wausau" for compact chart/map labels.
export function shortMuni(name) {
  return name.replace(/,\s*(City|Village|Town) of$/, "").trim();
}
