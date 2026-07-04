// Chart palette — the one place JS-side colors live (CSS colors live in
// tokens.css). Teal is the WPR data accent shared across WPR widgets; amber
// highlights the selection against teal bars.
export const TEAL = "#3a867c";
export const TEAL_BRIGHT = "#4aaba7";
export const TEAL_DARK = "#2f6f66"; // selected map bubble / hover states
export const AMBER = "#c8922e";

// Recharts chrome, matched to the white newspaper base.
export const GRID = "#e8e8e6"; // CartesianGrid lines
export const AXIS = "#a8a8a4"; // axis strokes / tick text
export const LABEL = "#55554f"; // in-chart value labels

// Donut palette — long enough for the DOR category breakdown (Single family,
// Commercial, Manufacturing, Agricultural, Undeveloped land, …). Cycles if a
// feed ever carries more slices.
export const DONUT_COLORS = [
  TEAL, AMBER, TEAL_BRIGHT, "#32373c", "#9ab8b1",
  "#a8643c", "#6b8f3a", "#7a6f9b", "#cfae6a", "#5b8c9e",
];
