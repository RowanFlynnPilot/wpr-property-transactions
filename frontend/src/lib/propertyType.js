// Display labels for the DOR property TYPE (structure) and USE (class).
// The raw DOR strings are verbose ("Land and buildings/improvements"), which in a
// table costs width the party-name columns need, so they're shortened here.
// Shared by TransactionTable and MarketBreakdown so both read the same.

const TYPE_LABEL = {
  "Land and buildings/improvements": "Land & buildings",
  "Buildings/improvements only": "Buildings only",
  "Land only": "Land only",
  Condominium: "Condominium",
};

export const typeLabel = (t) => TYPE_LABEL[t] || t;

export const useLabel = (u) => u || "Unclassified";
