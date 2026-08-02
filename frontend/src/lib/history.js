// Helpers for reading the rolling 12-month history series.

// Index of the most recent month that actually has a median.
//
// The newest month in the window can legitimately be empty: the monthly rebuild
// runs on the 2nd, so the current month covers only the 1st-2nd, and if those
// days fall on a weekend or holiday no deeds were recorded at all. Indexing the
// array end would then report a $0 median and suppress the trend sentence, so
// every headline reads the latest month that has data instead.
//
// Returns -1 when the series is empty or all-null (callers render nothing).
export function latestIndexWithData(series) {
  if (!series?.length) return -1;
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] != null) return i;
  }
  return -1;
}
