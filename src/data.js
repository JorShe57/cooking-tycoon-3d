// Static game content: items, recipes, customers, stations, staff, upgrades,
// events, milestones and day pacing. Tune the game here.

// ---------- ingredients & food ----------
// raw items come from crates and cost money; `chop`/`cook`/`fry` say what a
// station turns them into; `from` records how a processed item was made.
export const ITEMS = {
  bread: { name: 'Bread', emoji: '🍞', raw: true, cost: 1, spoil: 0, plateable: true, cook: 'toast' },
  lettuce: { name: 'Lettuce', emoji: '🥬', raw: true, cost: 1, spoil: 0.5, chop: 'lettuce_chopped' },
  tomato: { name: 'Tomato', emoji: '🍅', raw: true, cost: 1, spoil: 0.2, chop: 'tomato_chopped' },
  patty: { name: 'Raw Patty', emoji: '🥩', raw: true, cost: 3, spoil: 0.3, cook: 'patty_cooked' },
  potato: { name: 'Potato', emoji: '🥔', raw: true, cost: 1, spoil: 0, chop: 'potato_cut' },
  fish: { name: 'Fish', emoji: '🐟', raw: true, cost: 4, spoil: 0.5, fry: 'fish_fried' },
  chili: { name: 'Chili', emoji: '🌶️', raw: true, cost: 1, spoil: 0.2, chop: 'chili_chopped' },

  lettuce_chopped: { name: 'Chopped Lettuce', emoji: '🥬', tag: '🔪', plateable: true, from: ['lettuce', 'chop'] },
  tomato_chopped: { name: 'Diced Tomato', emoji: '🍅', tag: '🔪', plateable: true, cook: 'soup', from: ['tomato', 'chop'] },
  potato_cut: { name: 'Cut Potato', emoji: '🥔', tag: '🔪', fry: 'fries', from: ['potato', 'chop'] },
  chili_chopped: { name: 'Chopped Chili', emoji: '🌶️', tag: '🔪', plateable: true, from: ['chili', 'chop'] },
  toast: { name: 'Toast', emoji: '🍞', tag: '🔥', plateable: true, from: ['bread', 'cook'] },
  patty_cooked: { name: 'Cooked Patty', emoji: '🥩', tag: '🔥', plateable: true, from: ['patty', 'cook'] },
  soup: { name: 'Tomato Soup', emoji: '🍲', plateable: true, from: ['tomato_chopped', 'cook'] },
  fries: { name: 'Fries', emoji: '🍟', plateable: true, from: ['potato_cut', 'fry'] },
  fish_fried: { name: 'Fried Fish', emoji: '🐟', tag: '🛢️', plateable: true, from: ['fish', 'fry'] },
  burnt: { name: 'Burnt Mess', emoji: '💨', tag: '☠️' },
};
export const RAW = Object.keys(ITEMS).filter((k) => ITEMS[k].raw);
export const COOK_TIME = { bread: 4, patty: 6, tomato_chopped: 7, potato_cut: 6, fish: 7 };
export const STEP_EMOJI = { chop: '🔪', cook: '🔥', fry: '🛢️' };
export const MAX_PLATE = 4;

// Walk back from a plated item to its raw ingredient and the steps on the way.
export function howTo(kind) {
  const steps = [];
  let k = kind;
  while (ITEMS[k].from) {
    steps.unshift(ITEMS[k].from[1]);
    k = ITEMS[k].from[0];
  }
  return { raw: k, steps };
}
export const howToText = (kind) => {
  const h = howTo(kind);
  return ITEMS[h.raw].emoji + h.steps.map((s) => STEP_EMOJI[s]).join('');
};

// ---------- recipes ----------
export const RECIPES = {
  toast: { id: 'toast', name: 'Toast', emoji: '🍞', parts: ['toast'], price: 8, tip: 1.0, unlock: 1, learn: 0, veg: true, spicy: false },
  salad: { id: 'salad', name: 'Garden Salad', emoji: '🥗', parts: ['lettuce_chopped', 'tomato_chopped'], price: 13, tip: 1.1, unlock: 1, learn: 0, veg: true, spicy: true },
  soup: { id: 'soup', name: 'Tomato Soup', emoji: '🍲', parts: ['soup'], price: 15, tip: 1.15, unlock: 2, learn: 40, veg: true, spicy: true },
  burger: { id: 'burger', name: 'Burger', emoji: '🍔', parts: ['bread', 'patty_cooked', 'lettuce_chopped'], price: 24, tip: 1.3, unlock: 4, learn: 120, veg: false, spicy: true },
  fries: { id: 'fries', name: 'Fries', emoji: '🍟', parts: ['fries'], price: 11, tip: 1.0, unlock: 5, learn: 60, veg: true, spicy: true },
  fishchips: { id: 'fishchips', name: 'Fish & Chips', emoji: '🐠', parts: ['fish_fried', 'fries'], price: 30, tip: 1.35, unlock: 6, learn: 150, veg: false, spicy: true },
  club: { id: 'club', name: 'Veggie Club', emoji: '🥪', parts: ['toast', 'lettuce_chopped', 'tomato_chopped'], price: 21, tip: 1.2, unlock: 7, learn: 100, veg: true, spicy: false },
};
export const RECIPE_LIST = Object.values(RECIPES);
export const SPICY_BONUS = 4;

export const PRICE_TIERS = {
  low: { name: 'Bargain', mult: 0.8, patience: 1.2, pull: 1.15 },
  fair: { name: 'Fair', mult: 1.0, patience: 1.0, pull: 1.0 },
  high: { name: 'Premium', mult: 1.3, patience: 0.8, pull: 0.85 },
};

// Which stations and raw ingredients a recipe needs.
export function recipeNeeds(r) {
  const stations = new Set(['plate']);
  const raws = new Set();
  for (const p of r.parts) {
    const h = howTo(p);
    raws.add(h.raw);
    for (const s of h.steps) stations.add(s === 'chop' ? 'board' : s === 'cook' ? 'burner' : 'fryer');
  }
  return { stations: [...stations], raws: [...raws] };
}

// ---------- customers ----------
export const CUSTOMERS = {
  casual: { id: 'casual', name: 'Casual', patience: 55, tip: 1.0, repGain: 0.05, repLoss: 0.15, unlock: 1, weight: 5, color: 0x4f9dde },
  rushed: { id: 'rushed', name: 'Rushed', patience: 30, tip: 1.8, repGain: 0.06, repLoss: 0.2, unlock: 3, weight: 2, color: 0xf2a33a },
  critic: { id: 'critic', name: 'Critic', patience: 45, tip: 1.3, repGain: 0.35, repLoss: 0.6, unlock: 5, weight: 1, color: 0x8e5cc4 },
  group: { id: 'group', name: 'Group', patience: 75, tip: 1.25, repGain: 0.12, repLoss: 0.3, unlock: 6, weight: 1.4, color: 0x3fa66a },
  influencer: { id: 'influencer', name: 'Influencer', patience: 40, tip: 2.0, repGain: 0.3, repLoss: 0.8, unlock: 99, weight: 0, color: 0xff5fa2 },
  inspector: { id: 'inspector', name: 'Inspector', patience: 6, tip: 0, repGain: 0, repLoss: 0, unlock: 99, weight: 0, color: 0x6b7a8f },
};
export const VEGGIE_DAY = 7; // some casual customers only eat veg dishes
export const SPICY_DAY = 8; // customers start asking for 🌶️
export const DISHES_DAY = 3; // plates come back dirty and need the sink

// ---------- stations ----------
export const STATIONS = {
  crate: { name: 'Crate', emoji: '📦', cost: 0 },
  board: { name: 'Cutting Board', emoji: '🔪', cost: 90, max: 3, unlock: 1 },
  burner: { name: 'Burner', emoji: '🔥', cost: 100, max: 4, unlock: 1 },
  fryer: { name: 'Deep Fryer', emoji: '🛢️', cost: 220, max: 2, unlock: 5 },
  plate: { name: 'Plate Counter', emoji: '🍽️', cost: 50, max: 4, unlock: 1 },
  sink: { name: 'Sink', emoji: '🧽', cost: 0, fixed: true },
  trash: { name: 'Trash', emoji: '🗑️', cost: 0, fixed: true },
};
export const BUYABLE_STATIONS = ['board', 'burner', 'fryer', 'plate'];

// ---------- venues ----------
// Kitchen grid: cols x rows cells of 1 unit; x = x0 + col, z = z0 + row.
// Row 0 touches the serve pass; the chef serves from any free row-0 cell.
export const VENUES = {
  diner: {
    id: 'diner', name: 'Corner Diner', cols: 7, rows: 5, x0: -3, z0: -2, rent: 5, rentGrowth: 1,
    tipMult: 1, maxSeats: 4, typeBias: {},
    layout: [
      ['crate', 0, 1, 'bread'], ['crate', 0, 2, 'lettuce'], ['crate', 0, 3, 'tomato'],
      ['plate', 2, 0], ['plate', 4, 0], ['burner', 6, 1], ['burner', 6, 2],
      ['sink', 6, 3], ['trash', 6, 4], ['board', 2, 4],
    ],
  },
  truck: {
    id: 'truck', name: 'Food Truck', cols: 6, rows: 4, x0: -2, z0: -1, rent: 3, rentGrowth: 0.5,
    tipMult: 1.35, maxSeats: 3, typeBias: { rushed: 3, casual: 0.6 }, cost: 600, unlock: 9,
    layout: [
      ['crate', 0, 1, 'bread'], ['crate', 0, 2, 'lettuce'], ['crate', 0, 3, 'tomato'], ['plate', 2, 0], ['plate', 3, 0],
      ['burner', 5, 1], ['sink', 5, 2], ['trash', 5, 3], ['board', 2, 3],
    ],
  },
};

// ---------- staff ----------
export const STAFF = [
  { id: 'dish', name: 'Dishwasher', emoji: '🧽', desc: 'Washes dirty plates and returns them to empty counters.', fee: 30, wage: 12, unlock: 3, color: 0x4fb3c4 },
  { id: 'prep', name: 'Prep Cook', emoji: '🔪', desc: 'Chops anything left on a cutting board.', fee: 40, wage: 15, unlock: 4, color: 0x57b36b },
  { id: 'runner', name: 'Runner', emoji: '🏃', desc: 'Carries finished plates to the right customer.', fee: 60, wage: 22, unlock: 6, color: 0xe0873c },
];

// ---------- upgrades ----------
export const UPGRADES = [
  { id: 'stove', name: 'Turbo Heat', desc: 'Burners & fryers cook 25% faster per level.', costs: [60, 150, 300], unlock: 1 },
  { id: 'shoes', name: 'Comfy Shoes', desc: 'Chef walks 20% faster per level.', costs: [50, 120], unlock: 1 },
  { id: 'tips', name: 'Tip Jar', desc: '+25% tips per level.', costs: [50, 120, 240], unlock: 1 },
  { id: 'seats', name: 'More Seating', desc: '+1 customer spot at the pass.', costs: [80, 180], unlock: 2 },
  { id: 'menuBoard', name: 'Bigger Menu Board', desc: '+1 dish on the menu (base 3).', costs: [70, 160, 300], unlock: 3 },
  { id: 'fridge', name: 'Walk-in Fridge', desc: 'Halves overnight spoilage per level.', costs: [80, 180], unlock: 3 },
  { id: 'autoPlater', name: 'Auto-Plater', desc: 'Finished food slides onto a matching plate.', costs: [220], unlock: 4 },
  { id: 'patio', name: 'Open the Patio', desc: 'Diner: +2 customer spots and more groups.', costs: [400], unlock: 7, venue: 'diner' },
];

// ---------- day events ----------
export const EVENTS = {
  regular: { id: 'regular', name: 'Regular Day', emoji: '☀️', desc: 'A normal shift.', reward: 'No bonus' },
  rush: { id: 'rush', name: 'Rush Hour', emoji: '⏰', desc: 'Customers arrive in big waves with quiet gaps.', reward: '+25% tips', tipMult: 1.25 },
  inspector: { id: 'inspector', name: 'Health Inspection', emoji: '📋', desc: 'An inspector drops by twice. Burnt food or piled-up dishes = fines.', reward: '+$20 per clean check' },
  influencer: { id: 'influencer', name: 'Influencer Night', emoji: '📸', desc: 'A food influencer visits. Wow them and tomorrow gets busier.', reward: '+$30 & +30% customers tomorrow' },
  outage: { id: 'outage', name: 'Power Flicker', emoji: '⚡', desc: 'Burners and fryers cut out now and then.', reward: 'Rent waived + $25' },
  shortage: { id: 'shortage', name: 'Supply Shortage', emoji: '🚚', desc: 'No rush deliveries for one ingredient today.', reward: '+15% tips', tipMult: 1.15 },
  holiday: { id: 'holiday', name: 'Holiday Crowd', emoji: '🎉', desc: 'Lots more customers and bigger groups.', reward: 'Busier day', crowd: 1.4 },
  critics: { id: 'critics', name: "Critics' Convention", emoji: '🎩', desc: 'Critics everywhere. Ratings swing harder.', reward: '+50% rating gains', repMult: 1.5 },
};
export const EVENT_UNLOCK = { rush: 3, inspector: 3, influencer: 4, outage: 4, shortage: 5, holiday: 5, critics: 6 };

export function eventChoices(day) {
  if (day < 3) return ['regular'];
  const pool = Object.keys(EVENT_UNLOCK).filter((e) => EVENT_UNLOCK[e] <= day);
  // Deterministic per day so reloading doesn't reroll.
  const a = pool[(day * 7) % pool.length];
  let b = pool[(day * 13 + 3) % pool.length];
  if (b === a) b = pool[(pool.indexOf(a) + 1) % pool.length];
  return ['regular', a, b].filter((v, i, arr) => arr.indexOf(v) === i);
}

// ---------- milestones, ranks, weekly challenges ----------
export const MILESTONES = [
  { id: 'serve10', name: 'First Rush', desc: 'Serve 10 dishes', reward: 25, check: (s) => s.lifetime.served >= 10 },
  { id: 'serve50', name: 'Line Cook', desc: 'Serve 50 dishes', reward: 75, check: (s) => s.lifetime.served >= 50 },
  { id: 'serve200', name: 'Head Chef', desc: 'Serve 200 dishes', reward: 200, check: (s) => s.lifetime.served >= 200 },
  { id: 'star3', name: 'Perfect Service', desc: 'Earn a 3-star day', reward: 50, check: (s) => Object.values(s.stars).some((v) => v >= 3) },
  { id: 'burger25', name: 'Burger Joint', desc: 'Serve 25 burgers', reward: 100, check: (s) => (s.lifetime.dishes.burger || 0) >= 25 },
  { id: 'fish20', name: 'By the Sea', desc: 'Serve 20 Fish & Chips', reward: 120, check: (s) => (s.lifetime.dishes.fishchips || 0) >= 20 },
  { id: 'spicy15', name: 'Feel the Heat', desc: 'Serve 15 spicy dishes', reward: 90, check: (s) => (s.lifetime.spicy || 0) >= 15 },
  { id: 'groups10', name: 'Party Planner', desc: 'Serve 10 groups', reward: 90, check: (s) => (s.lifetime.groups || 0) >= 10 },
  { id: 'inspect', name: 'Spotless', desc: 'Pass a health inspection', reward: 60, check: (s) => s.flags.inspectionPassed },
  { id: 'influence', name: 'Gone Viral', desc: 'Win over an influencer', reward: 80, check: (s) => s.flags.influencerWon },
  { id: 'rating45', name: 'Five-Star Vibes', desc: 'Reach a ★4.5 rating', reward: 150, check: (s) => s.rating >= 4.5 },
  { id: 'earn1k', name: 'Small Business', desc: 'Earn $1,000 in sales', reward: 100, check: (s) => s.lifetime.earned >= 1000 },
  { id: 'earn5k', name: 'Tycoon', desc: 'Earn $5,000 in sales', reward: 300, check: (s) => s.lifetime.earned >= 5000 },
  { id: 'staff3', name: 'Full Crew', desc: 'Hire all three staff', reward: 100, check: (s) => STAFF.every((st) => s.staff[st.id]) },
  { id: 'truck', name: 'On the Road', desc: 'Buy the Food Truck', reward: 150, check: (s) => !!s.venues.truck },
];

export const RANKS = [
  [0, 'Food Stall'], [500, 'Corner Diner'], [1500, 'Local Favorite'], [4000, 'Bistro'],
  [8000, 'Famous Kitchen'], [15000, 'Legendary Restaurant'],
];
export const rankFor = (earned) => {
  let i = 0;
  while (i + 1 < RANKS.length && earned >= RANKS[i + 1][0]) i++;
  return { name: RANKS[i][1], next: RANKS[i + 1] || null, index: i };
};

export function weeklyChallenge(day, known) {
  const week = Math.floor((day - 1) / 5);
  const pool = known.filter((id) => id !== 'toast');
  const recipe = pool.length ? pool[(week * 5 + 2) % pool.length] : 'salad';
  return { week, recipe, target: 8 + week * 4, reward: 60 + week * 40, endDay: week * 5 + 5, progress: 0, done: false };
}

// ---------- pacing ----------
export const CAREER_DAYS = 20;
export const BURN_WINDOW = 7;
export const CHOPS_NEEDED = 4;
export const SCRUBS_NEEDED = 3;
export const EMERGENCY_MULT = 3;
