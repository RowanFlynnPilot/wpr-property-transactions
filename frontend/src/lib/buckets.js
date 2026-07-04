import { moneyCompact } from "./format.js";

// Price-distribution buckets (whole dollars), open-ended top bucket. Shared by
// the KPI "typical price range" card and the price-range histogram so the two
// always read consistently.
export const BUCKETS = [
  [0, 100_000],
  [100_000, 200_000],
  [200_000, 300_000],
  [300_000, 500_000],
  [500_000, 1_000_000],
  [1_000_000, Infinity],
];

export const bucketLabel = ([lo, hi]) =>
  hi === Infinity ? `${moneyCompact(lo)}+` : `${moneyCompact(lo)}–${moneyCompact(hi)}`;
