// Static game content: items, recipes, customers, upgrades and day pacing.

export const ITEMS = {
  bread: { name: 'Bread', emoji: '🍞', plateable: true, cook: 'toast', cookTime: 4 },
  lettuce: { name: 'Lettuce', emoji: '🥬', chop: 'lettuce_chopped' },
  tomato: { name: 'Tomato', emoji: '🍅', chop: 'tomato_chopped' },
  patty: { name: 'Raw Patty', emoji: '🥩', cook: 'patty_cooked', cookTime: 6 },
  lettuce_chopped: { name: 'Chopped Lettuce', emoji: '🥬', tag: '🔪', plateable: true },
  tomato_chopped: { name: 'Diced Tomato', emoji: '🍅', tag: '🔪', plateable: true, cook: 'soup', cookTime: 7 },
  toast: { name: 'Toast', emoji: '🍞', tag: '🔥', plateable: true },
  patty_cooked: { name: 'Cooked Patty', emoji: '🥩', tag: '🔥', plateable: true },
  soup: { name: 'Tomato Soup', emoji: '🍲', plateable: true },
  burnt: { name: 'Burnt Mess', emoji: '💨', tag: '☠️' },
};

// How each plated ingredient is made, for the recipe book / tickets.
export const HOW_TO = {
  bread: ['🍞'],
  toast: ['🍞', '🔥'],
  lettuce_chopped: ['🥬', '🔪'],
  tomato_chopped: ['🍅', '🔪'],
  patty_cooked: ['🥩', '🔥'],
  soup: ['🍅', '🔪', '🔥'],
};

export const RECIPES = {
  toast: { id: 'toast', name: 'Toast', emoji: '🍞', parts: ['toast'], price: 8, tip: 1.0, unlock: 1 },
  salad: { id: 'salad', name: 'Garden Salad', emoji: '🥗', parts: ['lettuce_chopped', 'tomato_chopped'], price: 13, tip: 1.1, unlock: 1 },
  soup: { id: 'soup', name: 'Tomato Soup', emoji: '🍲', parts: ['soup'], price: 15, tip: 1.15, unlock: 2 },
  burger: { id: 'burger', name: 'Burger', emoji: '🍔', parts: ['bread', 'patty_cooked', 'lettuce_chopped'], price: 24, tip: 1.3, unlock: 4 },
};
export const RECIPE_LIST = Object.values(RECIPES);

export const CUSTOMERS = {
  casual: { id: 'casual', name: 'Casual', patience: 55, tip: 1.0, repGain: 0.05, repLoss: 0.15, unlock: 1, color: 0x4f9dde },
  rushed: { id: 'rushed', name: 'Rushed', patience: 30, tip: 1.8, repGain: 0.06, repLoss: 0.2, unlock: 3, color: 0xf2a33a },
  critic: { id: 'critic', name: 'Critic', patience: 45, tip: 1.3, repGain: 0.35, repLoss: 0.6, unlock: 5, color: 0x8e5cc4 },
};
export const CUSTOMER_LIST = Object.values(CUSTOMERS);

export const UPGRADES = [
  { id: 'stove', name: 'Turbo Burners', desc: 'Stove cooks 25% faster per level.', costs: [60, 150], unlock: 1 },
  { id: 'seats', name: 'More Seating', desc: '+1 customer spot at the pass.', costs: [80, 180], unlock: 2 },
  { id: 'tips', name: 'Tip Jar', desc: '+25% tips per level.', costs: [50, 120, 240], unlock: 1 },
  { id: 'prepSlot', name: 'Extra Cutting Board', desc: 'Adds a second prep board.', costs: [90], unlock: 2 },
  { id: 'autoPlater', name: 'Auto-Plater', desc: 'Finished stove food slides onto a matching plate.', costs: [220], unlock: 4 },
  { id: 'helper', name: 'Prep Helper', desc: 'Hire a helper who chops anything left on a board.', costs: [260], unlock: 6 },
];

export const CAREER_DAYS = 10;
export const MAX_SEATS = 4;
export const BURN_WINDOW = 7; // seconds a finished item survives on the stove
export const CHOPS_NEEDED = 4;

export function dayConfig(day, upgrades = {}) {
  const d = Math.min(day, 16);
  const recipes = RECIPE_LIST.filter((r) => r.unlock <= day).map((r) => r.id);
  const types = CUSTOMER_LIST.filter((c) => c.unlock <= day).map((c) => c.id);
  const baseSeats = day >= 3 ? 3 : 2;
  const bonusRecipe = recipes[(day * 7) % recipes.length];
  return {
    day,
    freePlay: day > CAREER_DAYS,
    length: 70 + d * 5,
    interval: Math.max(4, 12 - d * 0.75),
    seats: Math.min(MAX_SEATS, baseSeats + (upgrades.seats || 0)),
    patienceMult: Math.max(0.65, 1.05 - d * 0.03),
    goal: 30 + day * 22,
    recipes,
    types,
    bonus: { recipe: bonusRecipe, count: 2 + Math.floor(day / 3), reward: 15 + day * 5 },
  };
}

// What's new on a given day, for the next-day preview.
export function dayNews(day) {
  const news = [];
  for (const r of RECIPE_LIST) if (r.unlock === day) news.push(`New recipe: ${r.emoji} ${r.name}`);
  for (const c of CUSTOMER_LIST) if (c.unlock === day && day > 1) news.push(`New customer: ${c.name}`);
  for (const u of UPGRADES) if (u.unlock === day && day > 1) news.push(`Shop: ${u.name} available`);
  if (day === 3) news.push('A third customer spot opens');
  if (day === CAREER_DAYS + 1) news.push('Free play: endless days, rising difficulty');
  return news;
}
