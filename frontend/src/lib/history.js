// Helpers for reading the rolling 12-month history series.

// Index of the most recent COMPLETE month that has a median — the month every
// headline reports.
//
// The current calendar month is always partial: DOR posts recordings with a
// days-to-weeks lag, so early in a month its median rests on a few dozen sales
// and swings week to week (it has been empty outright when the 1st-2nd fell on
// a weekend). Headlining it made the KPI number wobble with every refresh, so
// headlines skip it; the trend chart and table still show it, labelled partial.
//
// Returns -1 when no complete month has data (callers render nothing).
export function latestCompleteIndex(months, series, today = new Date()) {
  const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  for (let i = (series?.length ?? 0) - 1; i >= 0; i--) {
    if (months[i] < current && series[i] != null) return i;
  }
  return -1;
}
