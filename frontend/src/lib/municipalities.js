// Approximate centroids for Marathon County municipalities, keyed by the exact
// DOR municipality string. Used only to place community-level aggregate markers
// on the map — the editorial policy publishes NO per-record coordinates, so
// approximate municipal centers are the correct granularity here, not precise
// points. Coordinates are decimal degrees (lat, lon), hand-set to ~community level.
//
// Adding a county? Extend this table with that county's municipalities.

export const MUNI_CENTROIDS = {
  "Wausau, City of": [44.9591, -89.6301],
  "Weston, Village of": [44.8908, -89.5429],
  "Kronenwetter, Village of": [44.8244, -89.5807],
  "Rothschild, Village of": [44.8819, -89.6201],
  "Mosinee, City of": [44.793, -89.7032],
  "Mosinee, Town of": [44.804, -89.66],
  "Reid, Town of": [44.928, -89.451],
  "Maine, Village of": [45.0269, -89.6629],
  "Halsey, Town of": [44.78, -89.95],
  "Day, Town of": [44.97, -89.86],
  "Hamburg, Town of": [45.104, -89.78],
  "Texas, Town of": [45.03, -89.62],
  "Rib Mountain, Village of": [44.9163, -89.6884],
  "Weston, Town of": [45.13, -90.05],
  "Holton, Town of": [45.13, -89.85],
  "Knowlton, Town of": [44.72, -89.75],
  "Mcmillan, Town of": [44.78, -90.05],
  "Plover, Town of": [45.1, -90.05],
  "Marathon City, Village of": [44.9319, -89.8362],
  "Edgar, Village of": [44.9219, -89.9624],
  "Marathon, Town of": [44.943, -89.83],
  "Frankfort, Town of": [44.71, -90.05],
  "Hatley, Village of": [44.8763, -89.3318],
  "Rib Falls, Town of": [44.98, -89.85],
  "Easton, Town of": [44.87, -89.43],
  "Stratford, Village of": [44.8016, -90.079],
};

// County center, used to frame the initial map view.
export const MARATHON_CENTER = [44.9, -89.75];
