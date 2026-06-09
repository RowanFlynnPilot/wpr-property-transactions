// Overall / Residential / Commercial grouping for the property-use selector.
// DOR's precise category (Single family, Multi-family, Commercial, Manufacturing,
// Agricultural, Undeveloped land, …) is kept for labels; this maps it to a group.
// Keep in sync with scraper/history.py (RESIDENTIAL_USES / COMMERCIAL_USES).
const RESIDENTIAL = new Set(["Single family", "Multi-family"]);
const COMMERCIAL = new Set(["Commercial", "Manufacturing"]);

export const USE_OPTIONS = ["Overall", "Residential", "Commercial"];

// Filter value -> the history series key (history stores "All" for Overall).
export function historyGroup(useFilter) {
  return useFilter === "Overall" ? "All" : useFilter;
}

// Does a record fall under the selected use filter?
export function matchesUse(record, useFilter) {
  if (useFilter === "Residential") return RESIDENTIAL.has(record.property_use);
  if (useFilter === "Commercial") return COMMERCIAL.has(record.property_use);
  return true; // Overall
}

// Which group a DOR category belongs to — for the colored use badge.
export function useGroupOf(propertyUse) {
  if (RESIDENTIAL.has(propertyUse)) return "Residential";
  if (COMMERCIAL.has(propertyUse)) return "Commercial";
  return "Other";
}
