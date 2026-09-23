// Save data, between-day economy actions, and the in-shift simulation.
// No rendering here; the scene and UI read from this state.
import {
  ITEMS, RAW, COOK_TIME, MAX_PLATE, RECIPES, PRICE_TIERS, SPICY_BONUS, recipeNeeds,
  CUSTOMERS, VEGGIE_DAY, SPICY_DAY, DISHES_DAY, STATIONS, VENUES, STAFF, UPGRADES, EVENTS,
  MILESTONES, weeklyChallenge, CAREER_DAYS, BURN_WINDOW, CHOPS_NEEDED, SCRUBS_NEEDED, EMERGENCY_MULT,
} from './data.js';
import {
  defaultVenueState, occupancy, validateLayout, autoPlace, findPath, accessTargets, startCell,
  cellPos, cellKey, newStationId,
} from './layout.js';

const SAVE_KEY = 'cooking-tycoon-3d-save-v2';

// ======================= save =======================

export function newSave() {
  const s = {
    version: 2, day: 1, money: 20, rating: 3,
    known: ['toast', 'salad'],
    menu: [{ id: 'toast', tier: 'fair' }, { id: 'salad', tier: 'fair' }],
    stock: { bread: 12, lettuce: 12, tomato: 12 },
    upgrades: {}, staff: {},
    venue: 'diner', venues: { diner: defaultVenueState('diner') },
    stars: {}, lifetime: { earned: 0, served: 0, dishes: {}, spicy: 0, groups: 0 },
    flags: {}, milestones: {}, week: null,
    event: 'regular', marketing: false, nextBoost: 1,
    spend: { stock: 0, marketing: 0 }, lastReport: null, careerDone: false,
  };
  s.week = weeklyChallenge(1, s.known);
  return s;
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = { ...newSave(), ...JSON.parse(raw) };
    return s.version === 2 ? s : null;
  } catch {
    return null;
  }
}

export function writeSave(save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* storage unavailable: progress lasts for this tab only */
  }
}

// ======================= helpers =======================

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const weighted = (entries) => {
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of entries) if ((r -= w) <= 0) return k;
  return entries[entries.length - 1][0];
};
const upg = (save, id) => save.upgrades[id] || 0;
export const vstate = (save) => save.venues[save.venue];

export function neededRaws(save) {
  const raws = new Set();
  for (const id of save.known) for (const r of recipeNeeds(RECIPES[id]).raws) raws.add(r);
  if (save.day >= SPICY_DAY) raws.add('chili');
  return [...raws];
}

// Make sure every venue has a crate for each ingredient the kitchen uses.
export function ensureCrates(save) {
  const added = [];
  for (const [vid, vs] of Object.entries(save.venues)) {
    if (!vs) continue;
    const venue = VENUES[vid];
    for (const ing of neededRaws(save)) {
      const all = [...vs.layout, ...vs.stored];
      if (all.some((s) => s.type === 'crate' && s.ing === ing)) continue;
      const st = { id: newStationId(), type: 'crate', ing };
      const spot = autoPlace(venue, vs.layout, st);
      if (spot) vs.layout.push({ ...st, ...spot });
      else vs.stored.push(st);
      added.push(ing);
    }
  }
  for (const ing of neededRaws(save)) if (save.stock[ing] == null) save.stock[ing] = 0;
  return added;
}

export function stationCount(vs, type) {
  return [...vs.layout, ...vs.stored].filter((s) => s.type === type).length;
}

export function menuSlots(save) {
  return 3 + upg(save, 'menuBoard');
}

// Seats at the pass for the current venue/day.
export function seatCount(save) {
  const venue = VENUES[save.venue];
  const patio = save.venue === 'diner' && upg(save, 'patio');
  const base = save.day >= 3 ? 3 : 2;
  return Math.min(venue.maxSeats + (patio ? 2 : 0), base + upg(save, 'seats') + (patio ? 2 : 0));
}

export function dayConfig(save) {
  const day = save.day;
  const d = Math.min(day, 20);
  const venue = VENUES[save.venue];
  const ev = EVENTS[save.event] || EVENTS.regular;
  const menu = save.menu.filter((m) => save.known.includes(m.id));
  const pull = menu.length ? menu.reduce((a, m) => a + PRICE_TIERS[m.tier].pull, 0) / menu.length : 1;
  const popularity = Math.pow(save.rating / 3, 0.8) * pull * (save.marketing ? 1.3 : 1) * save.nextBoost * (ev.crowd || 1);
  const patio = save.venue === 'diner' && upg(save, 'patio');
  const types = Object.values(CUSTOMERS)
    .filter((c) => c.unlock <= day && c.weight > 0)
    .map((c) => {
      let w = c.weight * (venue.typeBias[c.id] ?? 1);
      if (ev.id === 'critics' && c.id === 'critic') w *= 6;
      if (c.id === 'group' && (ev.id === 'holiday' || patio)) w *= 2.5;
      return [c.id, w];
    });
  if (ev.id === 'critics' && !types.some(([id]) => id === 'critic')) types.push(['critic', 6]);
  const bonusRecipe = menu.length ? menu[(day * 7) % menu.length].id : 'toast';
  const shortage = ev.id === 'shortage' ? neededRaws(save).filter((r) => menu.some((m) => recipeNeeds(RECIPES[m.id]).raws.includes(r))) : [];
  return {
    day, venue, event: ev.id, freePlay: day > CAREER_DAYS,
    length: 75 + d * 4,
    interval: Math.max(3, 12 - d * 0.5) / popularity,
    popularity,
    seats: seatCount(save),
    patienceMult: Math.max(0.65, 1.05 - d * 0.025),
    goal: 30 + day * 22,
    menu, types,
    tipMult: venue.tipMult * (ev.tipMult || 1),
    repMult: ev.repMult || 1,
    rent: ev.id === 'outage' ? 0 : Math.round(venue.rent + day * venue.rentGrowth),
    wages: STAFF.filter((s) => save.staff[s.id]).reduce((a, s) => a + s.wage, 0),
    shortage: shortage.length ? shortage[(day * 3) % shortage.length] : null,
    bonus: { recipe: bonusRecipe, count: 2 + Math.floor(day / 3), reward: 15 + day * 5 },
    dishes: day >= DISHES_DAY,
  };
}

// Warnings shown on the planning screen before opening.
export function planWarnings(save) {
  const w = [];
  const vs = vstate(save);
  const placed = new Set(vs.layout.map((s) => (s.type === 'crate' ? `crate:${s.ing}` : s.type)));
  if (!save.menu.length) w.push('Your menu is empty — pick some dishes.');
  for (const m of save.menu) {
    const r = RECIPES[m.id];
    const need = recipeNeeds(r);
    for (const st of need.stations) if (!placed.has(st)) w.push(`${r.name} needs a ${STATIONS[st].name} in this kitchen.`);
    for (const raw of need.raws) {
      if (!placed.has(`crate:${raw}`)) w.push(`Place the ${ITEMS[raw].name} crate to cook ${r.name}.`);
    }
  }
  const low = neededRaws(save).filter((r) => save.menu.some((m) => recipeNeeds(RECIPES[m.id]).raws.includes(r)) && (save.stock[r] || 0) < 5);
  if (low.length) w.push(`Low stock: ${low.map((r) => ITEMS[r].emoji).join(' ')} (rush deliveries cost ${EMERGENCY_MULT}×)`);
  if (!placed.has('sink')) w.push('Place the sink so dirty plates can be washed.');
  return [...new Set(w)];
}

// ======================= between-day actions =======================
// Each returns an error string, or null on success.

export const actions = {
  buyStock(save, ing, n) {
    const cost = ITEMS[ing].cost * n;
    if (save.money < cost) return 'Not enough cash';
    save.money -= cost;
    save.stock[ing] = (save.stock[ing] || 0) + n;
    save.spend.stock += cost;
    return null;
  },
  sellStock(save, ing, n) {
    const have = save.stock[ing] || 0;
    const k = Math.min(n, have);
    if (!k) return 'Nothing to return';
    // Returns refund at half price.
    save.stock[ing] = have - k;
    const refund = Math.floor(ITEMS[ing].cost * k * 0.5);
    save.money += refund;
    save.spend.stock -= refund;
    return null;
  },
  // Buy enough of every menu ingredient for roughly `servings` dishes each.
  autoStock(save) {
    const cfg = dayConfig(save);
    const expected = Math.ceil((cfg.length / cfg.interval) * 1.3 + 2);
    const perDish = Math.max(3, Math.ceil(expected / Math.max(1, save.menu.length)));
    const want = {};
    for (const m of save.menu) {
      for (const p of RECIPES[m.id].parts) {
        const raw = recipeNeedsRaw(p);
        want[raw] = (want[raw] || 0) + perDish;
      }
    }
    if (save.day >= SPICY_DAY) want.chili = Math.max(want.chili || 0, 4);
    let spent = 0;
    for (const [ing, n] of Object.entries(want)) {
      const need = Math.max(0, n - (save.stock[ing] || 0));
      const afford = Math.min(need, Math.floor(save.money / ITEMS[ing].cost));
      if (afford > 0) {
        actions.buyStock(save, ing, afford);
        spent += afford * ITEMS[ing].cost;
      }
    }
    return spent ? null : 'Already stocked';
  },
  learnRecipe(save, id) {
    const r = RECIPES[id];
    if (save.known.includes(id)) return 'Already known';
    if (r.unlock > save.day) return `Available on day ${r.unlock}`;
    if (save.money < r.learn) return 'Not enough cash';
    save.money -= r.learn;
    save.known.push(id);
    if (save.menu.length < menuSlots(save)) save.menu.push({ id, tier: 'fair' });
    ensureCrates(save);
    return null;
  },
  toggleMenu(save, id) {
    const i = save.menu.findIndex((m) => m.id === id);
    if (i >= 0) {
      save.menu.splice(i, 1);
      return null;
    }
    if (save.menu.length >= menuSlots(save)) return 'Menu is full — buy a Bigger Menu Board';
    save.menu.push({ id, tier: 'fair' });
    return null;
  },
  setTier(save, id, tier) {
    const m = save.menu.find((x) => x.id === id);
    if (m) m.tier = tier;
    return null;
  },
  buyStation(save, type) {
    const def = STATIONS[type];
    const vs = vstate(save);
    if (stationCount(vs, type) >= def.max) return 'Kitchen has the max of these';
    if (save.money < def.cost) return 'Not enough cash';
    save.money -= def.cost;
    const st = { id: newStationId(), type };
    const spot = autoPlace(VENUES[save.venue], vs.layout, st);
    if (spot) vs.layout.push({ ...st, ...spot });
    else vs.stored.push(st);
    return null;
  },
  buyUpgrade(save, id) {
    const u = UPGRADES.find((x) => x.id === id);
    const lvl = upg(save, id);
    const cost = u.costs[lvl];
    if (cost == null) return 'Maxed out';
    if (save.money < cost) return 'Not enough cash';
    save.money -= cost;
    save.upgrades[id] = lvl + 1;
    return null;
  },
  hire(save, id) {
    const s = STAFF.find((x) => x.id === id);
    if (save.staff[id]) {
      save.staff[id] = false;
      return null;
    }
    if (s.unlock > save.day) return `Available on day ${s.unlock}`;
    if (save.money < s.fee) return 'Not enough cash';
    save.money -= s.fee;
    save.staff[id] = true;
    return null;
  },
  toggleMarketing(save) {
    if (save.marketing) {
      save.marketing = false;
      save.money += 30;
      save.spend.marketing -= 30;
      return null;
    }
    if (save.money < 30) return 'Not enough cash';
    save.marketing = true;
    save.money -= 30;
    save.spend.marketing += 30;
    return null;
  },
  buyTruck(save) {
    const v = VENUES.truck;
    if (save.venues.truck) return 'Already owned';
    if (save.day < v.unlock) return `Available on day ${v.unlock}`;
    if (save.money < v.cost) return 'Not enough cash';
    save.money -= v.cost;
    save.venues.truck = defaultVenueState('truck');
    ensureCrates(save);
    return null;
  },
  setVenue(save, id) {
    if (!save.venues[id]) return 'Not owned';
    save.venue = id;
    return null;
  },
};

function recipeNeedsRaw(part) {
  let k = part;
  while (ITEMS[k].from) k = ITEMS[k].from[0];
  return k;
}

// Does `contents` (ignoring chili) fit inside some menu recipe?
function fitsRecipe(contents, recipeIds) {
  const base = contents.filter((k) => k !== 'chili_chopped');
  return recipeIds.some((id) => {
    const need = [...RECIPES[id].parts];
    return base.every((k) => {
      const i = need.indexOf(k);
      if (i < 0) return false;
      need.splice(i, 1);
      return true;
    });
  });
}

// Identify a plated dish: { recipe, spicy } or null.
export function matchDish(contents) {
  const chili = contents.filter((k) => k === 'chili_chopped').length;
  if (chili > 1) return null;
  const sorted = contents.filter((k) => k !== 'chili_chopped').sort().join(',');
  const r = Object.values(RECIPES).find((x) => [...x.parts].sort().join(',') === sorted);
  if (!r || (chili && !r.spicy)) return null;
  return { recipe: r, spicy: chili === 1 };
}

// ======================= the shift =======================

export class Game {
  constructor(save, emit) {
    this.save = save;
    this.emit = emit; // (type, payload) => void
  }

  upg(id) {
    return upg(this.save, id);
  }

  startDay() {
    const save = this.save;
    ensureCrates(save);
    const cfg = dayConfig(save);
    this.cfg = cfg;
    this.venue = cfg.venue;
    this.layout = vstate(save).layout;
    this.occ = occupancy(this.venue, this.layout);
    this.tiers = Object.fromEntries(cfg.menu.map((m) => [m.id, m.tier]));
    this.stations = new Map();
    for (const s of this.layout) {
      const { x, z } = cellPos(this.venue, s.c, s.r);
      const st = { ...s, x, z };
      if (s.type === 'board') Object.assign(st, { item: null, progress: 0 });
      if (s.type === 'burner' || s.type === 'fryer') Object.assign(st, { item: null, t: 0, cookTime: 0, state: null, off: 0 });
      if (s.type === 'plate') st.plate = { contents: [] };
      if (s.type === 'sink') Object.assign(st, { dirty: 0, progress: 0 });
      this.stations.set(s.id, st);
    }
    const [c, r] = startCell(this.venue, this.occ);
    const p = cellPos(this.venue, c, r);
    this.chef = { c, r, x: p.x, z: p.z, path: [], queue: [], current: null, face: null, cooldown: 0 };
    this.time = cfg.length;
    this.spawnT = 1.5;
    this.hand = null;
    this.customers = [];
    this.returns = [];
    this.stats = {
      sales: 0, tips: 0, served: 0, customers: 0, lost: 0, burnt: 0, rushCost: 0, fines: 0,
      eventBonus: 0, bonusCount: 0, dishes: {}, spicy: 0, groups: 0, wasted: 0,
      startRating: save.rating, inspections: [],
    };
    this.staffT = { dish: 0, prep: 0, runner: 0 };
    this.outageT = rand(12, 20);
    this.inspectAt = cfg.event === 'inspector' ? [0.3, 0.7] : [];
    this.influencerDone = cfg.event !== 'influencer';
    this.nextBoost = 1;
    this.nextId = 1;
    this.ended = false;
    this.runnerAnim = null;
  }

  get open() {
    return this.time > 0;
  }

  get earned() {
    return this.stats.sales + this.stats.tips;
  }

  say(text, kind = 'info', at = null) {
    this.emit('toast', { text, kind, at });
    return false;
  }

  stationsOf(type) {
    return [...this.stations.values()].filter((s) => s.type === type);
  }

  // ---------- chef movement & action queue ----------

  queueAction(id) {
    const ch = this.chef;
    if (ch.queue.length >= 4) return this.say('Slow down, chef!', 'warn');
    ch.queue.push(id);
    this.emit('sfx', 'tap');
    return true;
  }

  updateChef(dt) {
    const ch = this.chef;
    ch.cooldown = Math.max(0, ch.cooldown - dt);
    if (!ch.current && !ch.path.length && ch.queue.length && ch.cooldown === 0) {
      const id = ch.queue.shift();
      const target = id === 'serve' ? 'serve' : this.stations.get(id);
      const path = target ? findPath(this.venue, this.occ, [ch.c, ch.r], accessTargets(this.venue, this.occ, target)) : null;
      if (!path) {
        this.say("Can't reach that!", 'warn');
      } else {
        ch.path = path;
        ch.current = id;
      }
    }
    if (ch.path.length) {
      const [c, r] = ch.path[0];
      const p = cellPos(this.venue, c, r);
      const dx = p.x - ch.x;
      const dz = p.z - ch.z;
      const dist = Math.hypot(dx, dz);
      const step = 4.2 * (1 + 0.2 * this.upg('shoes')) * dt;
      if (dist <= step) {
        ch.x = p.x;
        ch.z = p.z;
        ch.c = c;
        ch.r = r;
        ch.path.shift();
      } else {
        ch.x += (dx / dist) * step;
        ch.z += (dz / dist) * step;
      }
      ch.face = null;
      ch.dir = Math.atan2(dx, dz);
    }
    if (ch.current && !ch.path.length) {
      const id = ch.current;
      ch.current = null;
      ch.cooldown = 0.08;
      const s = this.stations.get(id);
      ch.face = s ? { x: s.x, z: s.z } : { x: ch.x, z: this.venue.z0 - 1.2 };
      this.interact(id);
      this.emit('interact', id);
    }
  }

  // ---------- interactions ----------

  interact(id) {
    if (id === 'serve') return this.serve();
    const s = this.stations.get(id);
    if (!s) return false;
    switch (s.type) {
      case 'crate': return this.useCrate(s);
      case 'board': return this.useBoard(s);
      case 'burner': case 'fryer': return this.useHeat(s);
      case 'plate': return this.usePlate(s);
      case 'sink': return this.useSink(s);
      case 'trash': return this.trash();
    }
    return false;
  }

  useCrate(s) {
    if (this.hand) return this.say('Hands full!', 'warn');
    const ing = s.ing;
    const stock = this.save.stock;
    if ((stock[ing] || 0) > 0) {
      stock[ing]--;
    } else {
      if (this.cfg.shortage === ing) return this.say(`Out of ${ITEMS[ing].name}! No deliveries today`, 'bad', s.id);
      const cost = ITEMS[ing].cost * EMERGENCY_MULT;
      this.save.money -= cost;
      this.stats.rushCost += cost;
      this.say(`Rush delivery −$${cost}`, 'warn', s.id);
    }
    this.hand = { kind: ing };
    this.emit('sfx', 'pick');
    return true;
  }

  useBoard(b) {
    const h = this.hand;
    if (h) {
      if (h.kind === 'plate') return this.say('Plates go on plate counters', 'warn');
      if (b.item) return this.say('Board is busy', 'warn');
      if (!ITEMS[h.kind].chop) return this.say(`Can't chop ${ITEMS[h.kind].name}`, 'warn');
      b.item = h.kind;
      b.progress = 0;
      this.hand = null;
      this.emit('sfx', 'place');
      return true;
    }
    if (!b.item) return this.say('Bring something to chop', 'info', b.id);
    if (ITEMS[b.item].chop) {
      this.chop(b);
      return true;
    }
    this.hand = { kind: b.item };
    b.item = null;
    b.progress = 0;
    this.emit('sfx', 'pick');
    return true;
  }

  chop(b) {
    b.progress = Math.min(1, b.progress + 1 / CHOPS_NEEDED);
    this.emit('sfx', 'chop');
    this.emit('chop', b.id);
    if (b.progress >= 1) {
      b.item = ITEMS[b.item].chop;
      this.emit('sfx', 'ding');
    }
  }

  useHeat(s) {
    const h = this.hand;
    const key = s.type === 'burner' ? 'cook' : 'fry';
    if (h) {
      if (h.kind === 'plate') return this.say('Plates go on plate counters', 'warn');
      if (s.item) return this.say(`${s.type === 'burner' ? 'Burner' : 'Fryer'} is busy`, 'warn');
      const def = ITEMS[h.kind];
      if (!def[key]) {
        if (def.fry) return this.say('That goes in the fryer 🛢️', 'warn');
        if (def.cook) return this.say('Cook that on a burner 🔥', 'warn');
        if (def.chop) return this.say('Chop it first 🔪', 'warn');
        return this.say(`Can't cook ${def.name}`, 'warn');
      }
      s.item = h.kind;
      s.t = 0;
      s.cookTime = COOK_TIME[h.kind];
      s.state = 'cooking';
      this.hand = null;
      this.emit('sfx', s.type === 'fryer' ? 'fry' : 'sizzle');
      return true;
    }
    if (!s.item) return this.say(s.type === 'burner' ? 'Cook bread, patties or diced tomato' : 'Fry cut potatoes or fish', 'info', s.id);
    if (s.state === 'cooking') return this.say('Still cooking…', 'info', s.id);
    this.hand = { kind: s.item };
    s.item = null;
    s.state = null;
    this.emit('sfx', 'pick');
    return true;
  }

  usePlate(p) {
    const h = this.hand;
    if (!p.plate) {
      if (h && h.kind === 'plate') {
        p.plate = { contents: h.contents };
        this.hand = null;
        this.emit('sfx', 'place');
        return true;
      }
      return this.say(h ? 'No plate here — wash one 🧽' : 'No plate — wash one at the sink', 'warn', p.id);
    }
    if (!h) {
      if (!p.plate.contents.length) return this.say('Add food to the plate', 'info', p.id);
      this.hand = { kind: 'plate', contents: p.plate.contents };
      p.plate = null;
      this.emit('sfx', 'pick');
      return true;
    }
    if (h.kind === 'plate') return this.say('Spot taken', 'warn');
    const def = ITEMS[h.kind];
    if (!def.plateable) {
      if (h.kind === 'burnt') return this.say('Trash that!', 'warn');
      return this.say(def.chop ? 'Chop it first 🔪' : def.fry ? 'Fry it first 🛢️' : 'Cook it first 🔥', 'warn');
    }
    if (p.plate.contents.length >= MAX_PLATE) return this.say('Plate is full', 'warn');
    p.plate.contents.push(h.kind);
    this.hand = null;
    this.emit('sfx', 'place');
    return true;
  }

  useSink(s) {
    const h = this.hand;
    if (h) {
      if (h.kind === 'plate' && !h.contents.length) return this.say('Put it on a plate counter', 'info');
      return this.say('Hands full!', 'warn');
    }
    if (!s.dirty) return this.say('No dirty dishes', 'info', s.id);
    s.progress = Math.min(1, s.progress + 1 / SCRUBS_NEEDED);
    this.emit('sfx', 'wash');
    this.emit('chop', s.id);
    if (s.progress >= 1) {
      s.dirty--;
      s.progress = 0;
      this.hand = { kind: 'plate', contents: [] };
      this.emit('sfx', 'ding');
    }
    return true;
  }

  trash() {
    const h = this.hand;
    if (!h) return this.say('Nothing to toss', 'info');
    if (h.kind === 'plate') {
      if (!h.contents.length) return this.say('Plate is already empty', 'info');
      this.stats.wasted += h.contents.length;
      h.contents = [];
    } else {
      this.stats.wasted++;
      this.hand = null;
    }
    this.emit('sfx', 'trash');
    return this.say('Wasted!', 'bad', this.stationsOf('trash')[0]?.id);
  }

  serve() {
    const h = this.hand;
    if (!h) return this.say('Pick up a finished plate', 'info', 'serve');
    if (h.kind !== 'plate') return this.say('Plate it first 🍽️', 'warn', 'serve');
    if (!h.contents.length) return this.say("That plate's empty!", 'warn', 'serve');
    if (!this.serveContents(h.contents)) return false;
    this.hand = null;
    return true;
  }

  // Try to hand a plate with `contents` to a matching customer.
  serveContents(contents, silent = false) {
    const dish = matchDish(contents);
    if (!dish) return silent ? false : this.say("That's not a dish!", 'bad', 'serve');
    const cands = [];
    for (const c of this.customers) {
      if (c.state === 'leaving' || c.type === 'inspector') continue;
      const o = c.orders.find((x) => !x.done && x.recipe === dish.recipe.id && x.spicy === dish.spicy);
      if (o) cands.push([c, o]);
    }
    if (!cands.length) {
      if (silent) return false;
      const plain = this.customers.some((c) => c.state !== 'leaving' && c.orders.some((o) => !o.done && o.recipe === dish.recipe.id));
      if (plain) return this.say(dish.spicy ? 'They wanted it mild!' : 'They wanted it spicy 🌶️!', 'warn', 'serve');
      return this.say(`Nobody ordered ${dish.recipe.name}`, 'warn', 'serve');
    }
    cands.sort((a, b) => a[0].patience - b[0].patience);
    const [c, o] = cands[0];
    this.payDish(c, o, dish);
    this.returnPlate();
    return true;
  }

  returnPlate() {
    this.returns.push({ t: this.cfg.dishes ? 4 : 1.5, dirty: this.cfg.dishes });
  }

  payDish(c, order, dish) {
    const save = this.save;
    const type = CUSTOMERS[c.type];
    const recipe = dish.recipe;
    const tier = PRICE_TIERS[this.tiers[recipe.id] || 'fair'];
    const price = Math.round(recipe.price * tier.mult) + (dish.spicy ? SPICY_BONUS : 0);
    const frac = Math.max(0, c.patience / c.max);
    const tip = Math.round(price * 0.6 * frac * type.tip * recipe.tip * (save.rating / 3) * (1 + 0.25 * this.upg('tips')) * this.cfg.tipMult);
    save.money += price + tip;
    this.stats.sales += price;
    this.stats.tips += tip;
    this.stats.served++;
    this.stats.dishes[recipe.id] = (this.stats.dishes[recipe.id] || 0) + 1;
    if (dish.spicy) this.stats.spicy++;
    if (recipe.id === this.cfg.bonus.recipe) this.stats.bonusCount++;
    order.done = true;
    this.emit('sfx', 'cash');
    this.emit('served', { c, total: price + tip });
    if (c.orders.every((o) => o.done)) {
      this.stats.customers++;
      if (c.type === 'group') this.stats.groups++;
      this.bumpRating(type.repGain * (frac > 0.5 ? 1 : 0.5) * this.cfg.repMult);
      if (c.type === 'influencer') {
        save.flags.influencerWon = true;
        this.nextBoost = 1.3;
        save.money += 30;
        this.stats.eventBonus += 30;
        this.say('📸 The influencer loved it! +$30', 'good', 'serve');
      }
      c.state = 'leaving';
      c.happy = true;
      c.leaveT = 2.2;
    }
  }

  bumpRating(d) {
    this.save.rating = Math.max(1, Math.min(5, this.save.rating + d));
  }

  // ---------- customers ----------

  freeSlots() {
    const used = new Set(this.customers.filter((c) => c.state !== 'leaving').map((c) => c.slot));
    const free = [];
    for (let s = 0; s < this.cfg.seats; s++) if (!used.has(s)) free.push(s);
    return free;
  }

  spawnCustomer(forced) {
    const free = this.freeSlots();
    if (!free.length || !this.cfg.menu.length) return false;
    const typeId = forced || weighted(this.cfg.types);
    const type = CUSTOMERS[typeId];
    const day = this.cfg.day;
    const menuIds = this.cfg.menu.map((m) => m.id);
    const veggie = typeId === 'casual' && day >= VEGGIE_DAY && Math.random() < 0.3 && menuIds.some((id) => RECIPES[id].veg);
    let pool = veggie ? menuIds.filter((id) => RECIPES[id].veg) : menuIds;
    if (typeId === 'critic' || typeId === 'influencer') {
      pool = [...pool].sort((a, b) => RECIPES[b].price - RECIPES[a].price).slice(0, 2);
    }
    const hasChili = this.layout.some((s) => s.type === 'crate' && s.ing === 'chili');
    const n = typeId === 'group' ? (Math.random() < 0.5 ? 2 : 3) : typeId === 'inspector' ? 0 : 1;
    const orders = [];
    for (let i = 0; i < n; i++) {
      const recipe = pick(pool);
      const spicy = day >= SPICY_DAY && hasChili && RECIPES[recipe].spicy && Math.random() < 0.25;
      orders.push({ recipe, spicy, done: false });
    }
    const tierPat = orders.length
      ? orders.reduce((a, o) => a + PRICE_TIERS[this.tiers[o.recipe] || 'fair'].patience, 0) / orders.length
      : 1;
    const max = typeId === 'inspector' ? 6 : type.patience * this.cfg.patienceMult * tierPat * (n > 1 ? 1 + 0.15 * n : 1);
    this.customers.push({
      id: this.nextId++, type: typeId, orders, veggie, slot: pick(free),
      patience: max, max, state: 'arriving', walk: 1.6, happy: false, leaveT: 0,
    });
    this.emit('sfx', typeId === 'inspector' ? 'whistle' : 'bell');
    if (typeId === 'inspector') this.say('📋 Health inspector arrived!', 'warn', 'serve');
    if (typeId === 'influencer') this.say('📸 An influencer walked in!', 'warn', 'serve');
    return true;
  }

  inspect() {
    let v = 0;
    for (const s of this.stations.values()) if (s.state === 'burnt') v++;
    const sink = this.stationsOf('sink')[0];
    if (sink && sink.dirty >= 3) v++;
    if (this.hand?.kind === 'burnt') v++;
    if (v === 0) {
      this.save.money += 20;
      this.stats.eventBonus += 20;
      this.bumpRating(0.15);
      this.save.flags.inspectionPassed = true;
      this.stats.inspections.push(true);
      this.emit('sfx', 'cash');
      this.say('✅ Inspection passed! +$20', 'good', 'serve');
    } else {
      const fine = 15 * v;
      this.save.money -= fine;
      this.stats.fines += fine;
      this.bumpRating(-0.15 * v);
      this.stats.inspections.push(false);
      this.emit('sfx', 'fail');
      this.say(`❌ ${v} violation${v > 1 ? 's' : ''}! Fined $${fine}`, 'bad', 'serve');
    }
  }

  // ---------- simulation ----------

  update(dt) {
    if (this.ended) return;
    const cfg = this.cfg;

    if (this.time > 0) {
      this.time = Math.max(0, this.time - dt);
      const frac = 1 - this.time / cfg.length;
      this.spawnT -= dt;
      let interval = cfg.interval;
      if (cfg.event === 'rush') {
        const wave = [[0.05, 0.2], [0.42, 0.55], [0.75, 0.88]].some(([a, b]) => frac >= a && frac <= b);
        interval = wave ? 1.4 : cfg.interval * 2.2;
        if (wave) this.spawnT = Math.min(this.spawnT, interval);
      }
      if (this.spawnT <= 0) this.spawnT = this.spawnCustomer() ? interval * rand(0.75, 1.25) : 1;
      if (this.inspectAt.length && frac >= this.inspectAt[0] && this.spawnCustomer('inspector')) this.inspectAt.shift();
      if (!this.influencerDone && frac >= 0.4 && this.spawnCustomer('influencer')) this.influencerDone = true;
      if (this.time === 0) this.emit('closing');
    }

    for (const c of this.customers) {
      if (c.state === 'arriving') {
        c.walk -= dt;
        if (c.walk <= 0) c.state = 'waiting';
      } else if (c.state === 'waiting') {
        c.patience -= dt;
        if (c.patience <= 0) {
          c.state = 'leaving';
          c.leaveT = 2.2;
          if (c.type === 'inspector') {
            c.happy = true;
            this.inspect();
            continue;
          }
          this.stats.lost++;
          this.bumpRating(-CUSTOMERS[c.type].repLoss * (cfg.repMult > 1 ? 1.2 : 1));
          this.emit('sfx', 'fail');
          this.emit('lost', { c });
          if (c.type === 'influencer') this.say('📸 Bad review posted…', 'bad', 'serve');
        }
      } else {
        c.leaveT -= dt;
      }
    }
    this.customers = this.customers.filter((c) => c.state !== 'leaving' || c.leaveT > 0);

    // Heat stations.
    const speed = 1 + 0.25 * this.upg('stove');
    for (const s of this.stations.values()) {
      if (s.type !== 'burner' && s.type !== 'fryer') continue;
      if (s.off > 0) {
        s.off = Math.max(0, s.off - dt);
        continue;
      }
      if (!s.item) continue;
      s.t += dt * (s.state === 'cooking' ? speed : 1);
      if (s.state === 'cooking' && s.t >= s.cookTime) {
        s.state = 'done';
        s.t = 0;
        s.item = ITEMS[s.item][s.type === 'burner' ? 'cook' : 'fry'];
        this.emit('sfx', 'ding');
        if (this.upg('autoPlater')) this.autoPlate(s);
      } else if (s.state === 'done' && s.t >= BURN_WINDOW) {
        s.state = 'burnt';
        s.item = 'burnt';
        this.stats.burnt++;
        this.bumpRating(-0.05);
        this.emit('sfx', 'fail');
        this.say('Burnt! 🔥', 'bad', s.id);
      }
    }
    if (cfg.event === 'outage' && this.time > 0) {
      this.outageT -= dt;
      if (this.outageT <= 0) {
        this.outageT = rand(16, 26);
        const heat = [...this.stations.values()].filter((s) => (s.type === 'burner' || s.type === 'fryer') && !s.off);
        if (heat.length) {
          const s = pick(heat);
          s.off = 8;
          this.emit('sfx', 'fail');
          this.say('⚡ Power cut!', 'warn', s.id);
        }
      }
    }

    // Plates coming back from the dining room.
    const sink = this.stationsOf('sink')[0];
    for (const r of this.returns) r.t -= dt;
    this.returns = this.returns.filter((r) => {
      if (r.t > 0) return true;
      if (r.dirty && sink) {
        sink.dirty++;
        return false;
      }
      const empty = this.stationsOf('plate').find((p) => !p.plate);
      if (!empty) {
        r.t = 0.5;
        return true;
      }
      empty.plate = { contents: [] };
      return false;
    });

    this.updateStaff(dt, sink);
    this.updateChef(dt);

    if (this.time === 0 && !this.customers.length) this.endDay();
  }

  updateStaff(dt, sink) {
    const staff = this.save.staff;
    const t = this.staffT;
    if (staff.dish && sink) {
      t.dish += dt;
      if (t.dish >= 2.2) {
        t.dish = 0;
        const empty = this.stationsOf('plate').find((p) => !p.plate);
        if (sink.dirty > 0 && empty) {
          sink.dirty--;
          empty.plate = { contents: [] };
          this.emit('sfx', 'wash');
          this.emit('staff', { id: 'dish', at: sink.id });
        }
      }
    }
    if (staff.prep) {
      t.prep += dt;
      if (t.prep >= 1.0) {
        t.prep = 0;
        const b = this.stationsOf('board').find((x) => x.item && ITEMS[x.item].chop);
        if (b) {
          this.chop(b);
          this.emit('staff', { id: 'prep', at: b.id });
        }
      }
    }
    if (staff.runner) {
      t.runner += dt;
      if (t.runner >= 1.4) {
        t.runner = 0;
        for (const p of this.stationsOf('plate')) {
          if (!p.plate || !p.plate.contents.length) continue;
          if (this.serveContents(p.plate.contents, true)) {
            p.plate = null;
            this.emit('staff', { id: 'runner', at: p.id });
            break;
          }
        }
      }
    }
  }

  autoPlate(s) {
    const ids = this.cfg.menu.map((m) => m.id);
    const plates = this.stationsOf('plate').filter((p) => p.plate).sort((a, b) => b.plate.contents.length - a.plate.contents.length);
    const target = plates.find((p) => p.plate.contents.length < MAX_PLATE && fitsRecipe([...p.plate.contents, s.item], ids));
    if (!target) return;
    target.plate.contents.push(s.item);
    s.item = null;
    s.state = null;
  }

  // ---------- end of day ----------

  endDay() {
    this.ended = true;
    const { stats, cfg, save } = this;
    let bonusPaid = 0;
    if (stats.bonusCount >= cfg.bonus.count) bonusPaid = cfg.bonus.reward;
    const outageBonus = cfg.event === 'outage' ? 25 : 0;
    save.money += bonusPaid + outageBonus - cfg.rent - cfg.wages;

    // Overnight spoilage.
    const spoiled = [];
    let spoiledValue = 0;
    const keep = Math.pow(0.5, this.upg('fridge'));
    for (const raw of Object.keys(save.stock)) {
      const lost = Math.floor((save.stock[raw] || 0) * ITEMS[raw].spoil * keep);
      if (lost > 0) {
        save.stock[raw] -= lost;
        spoiled.push(`${lost}${ITEMS[raw].emoji}`);
        spoiledValue += lost * ITEMS[raw].cost;
      }
    }

    // Lifetime + weekly challenge.
    const L = save.lifetime;
    L.earned += this.earned;
    L.served += stats.served;
    L.spicy = (L.spicy || 0) + stats.spicy;
    L.groups = (L.groups || 0) + stats.groups;
    for (const [k, v] of Object.entries(stats.dishes)) L.dishes[k] = (L.dishes[k] || 0) + v;
    let weekPaid = 0;
    const wk = save.week;
    if (wk && !wk.done) {
      wk.progress += stats.dishes[wk.recipe] || 0;
      if (wk.progress >= wk.target) {
        wk.done = true;
        weekPaid = wk.reward;
        save.money += weekPaid;
      }
    }

    let stars = 0;
    if (this.earned >= cfg.goal) stars++;
    if (this.earned >= cfg.goal * 1.5) stars++;
    if (this.earned >= cfg.goal && stats.lost === 0) stars++;
    save.stars[cfg.day] = Math.max(save.stars[cfg.day] || 0, stars);
    if (stats.lost === 0 && stats.customers >= 8) save.flags.perfectDay = true;

    // Milestones.
    const newMilestones = [];
    for (const m of MILESTONES) {
      if (save.milestones[m.id] || !m.check(save)) continue;
      save.milestones[m.id] = true;
      save.money += m.reward;
      newMilestones.push(m);
    }

    const ingredients = save.spend.stock + stats.rushCost;
    const income = this.earned + bonusPaid + outageBonus + stats.eventBonus + weekPaid + newMilestones.reduce((a, m) => a + m.reward, 0);
    const costs = ingredients + save.spend.marketing + cfg.rent + cfg.wages + stats.fines;
    const report = {
      day: cfg.day, event: cfg.event, venue: cfg.venue.id, goal: cfg.goal, stars,
      sales: stats.sales, tips: stats.tips, bonusPaid, bonus: cfg.bonus, eventBonus: stats.eventBonus + outageBonus,
      weekPaid, milestones: newMilestones.map((m) => ({ name: m.name, reward: m.reward })),
      ingredients, rushCost: stats.rushCost, marketing: save.spend.marketing, rent: cfg.rent, wages: cfg.wages, fines: stats.fines,
      profit: income - costs, served: stats.served, customers: stats.customers, lost: stats.lost, burnt: stats.burnt,
      wasted: stats.wasted, spoiled, spoiledValue, rating: save.rating, ratingDelta: save.rating - stats.startRating,
      inspections: stats.inspections,
    };

    save.spend = { stock: 0, marketing: 0 };
    save.marketing = false;
    save.nextBoost = this.nextBoost;
    save.event = 'regular';
    save.lastReport = report;
    save.day++;
    if (save.day > CAREER_DAYS) save.careerDone = true;
    if (!save.week || save.day > save.week.endDay) save.week = weeklyChallenge(save.day, save.known);
    ensureCrates(save);
    writeSave(save);
    this.emit('dayEnd', report);
  }
}

export { validateLayout, occupancy, cellKey, cellPos };
