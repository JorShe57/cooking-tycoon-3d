// Pure game state + rules. No rendering here; the scene and UI read from this.
import {
  ITEMS, RECIPES, CUSTOMERS, BURN_WINDOW, CHOPS_NEEDED, CAREER_DAYS, dayConfig,
} from './data.js';

const SAVE_KEY = 'cooking-tycoon-3d-save-v1';

export function newSave() {
  return { day: 1, money: 0, rating: 3, upgrades: {}, stars: {}, careerDone: false };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? { ...newSave(), ...JSON.parse(raw) } : null;
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

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Does `contents` fit inside some recipe's parts (as a multiset)?
function fitsRecipe(contents, recipeIds) {
  return recipeIds.some((id) => {
    const need = [...RECIPES[id].parts];
    return contents.every((k) => {
      const i = need.indexOf(k);
      if (i < 0) return false;
      need.splice(i, 1);
      return true;
    });
  });
}

export function matchRecipe(contents) {
  const sorted = [...contents].sort().join(',');
  return Object.values(RECIPES).find((r) => [...r.parts].sort().join(',') === sorted) || null;
}

export class Game {
  constructor(save, emit) {
    this.save = save;
    this.emit = emit; // (type, payload) => void
  }

  upg(id) {
    return this.save.upgrades[id] || 0;
  }

  startDay() {
    const cfg = dayConfig(this.save.day, this.save.upgrades);
    this.cfg = cfg;
    this.time = cfg.length;
    this.spawnT = 1.5;
    this.hand = null;
    this.boards = Array.from({ length: 1 + this.upg('prepSlot') }, () => ({ item: null, progress: 0 }));
    this.burners = [0, 1].map(() => ({ item: null, t: 0, cookTime: 0, state: null }));
    this.plates = [0, 1].map(() => ({ contents: [] }));
    this.customers = [];
    this.stats = { earned: 0, served: 0, lost: 0, burnt: 0, bonusCount: 0, startRating: this.save.rating };
    this.helperT = 0;
    this.nextId = 1;
    this.ended = false;
  }

  get open() {
    return this.time > 0;
  }

  // ---------- player interaction ----------

  interact(id) {
    const [kind, idxStr] = id.split(':');
    const idx = Number(idxStr);
    switch (kind) {
      case 'crate': return this.takeFromCrate(idxStr);
      case 'board': return this.useBoard(idx);
      case 'burner': return this.useBurner(idx);
      case 'plate': return this.usePlate(idx);
      case 'serve': return this.serve();
      case 'trash': return this.trash();
    }
    return false;
  }

  say(text, kind = 'info', at = null) {
    this.emit('toast', { text, kind, at });
    return false;
  }

  takeFromCrate(item) {
    if (this.hand) return this.say('Hands full!', 'warn');
    this.hand = { kind: item };
    this.emit('sfx', 'pick');
    return true;
  }

  useBoard(i) {
    const b = this.boards[i];
    if (!b) return false;
    const h = this.hand;
    if (h) {
      if (h.kind === 'plate') return this.say('Plates go on the pass', 'warn');
      if (b.item) return this.say('Board is busy', 'warn');
      if (!ITEMS[h.kind].chop) return this.say(`Can't chop ${ITEMS[h.kind].name}`, 'warn');
      b.item = h.kind;
      b.progress = 0;
      this.hand = null;
      this.emit('sfx', 'place');
      return true;
    }
    if (!b.item) return this.say('Bring lettuce or tomato to chop', 'info');
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
    this.emit('chop');
    if (b.progress >= 1) {
      b.item = ITEMS[b.item].chop;
      this.emit('sfx', 'ding');
    }
  }

  useBurner(i) {
    const s = this.burners[i];
    const h = this.hand;
    if (h) {
      if (h.kind === 'plate') return this.say('Plates go on the pass', 'warn');
      if (s.item) return this.say('Burner is busy', 'warn');
      const def = ITEMS[h.kind];
      if (!def.cook) return this.say(`Can't cook ${def.name}`, 'warn');
      s.item = h.kind;
      s.t = 0;
      s.cookTime = def.cookTime;
      s.state = 'cooking';
      this.hand = null;
      this.emit('sfx', 'sizzle');
      return true;
    }
    if (!s.item) return this.say('Cook bread, patties or diced tomato', 'info');
    if (s.state === 'cooking') return this.say('Still cooking…', 'info');
    this.hand = { kind: s.item };
    s.item = null;
    s.state = null;
    this.emit('sfx', 'pick');
    return true;
  }

  usePlate(i) {
    const p = this.plates[i];
    const h = this.hand;
    if (!h) {
      if (!p.contents.length) return this.say('Add food to the plate', 'info');
      this.hand = { kind: 'plate', contents: p.contents };
      p.contents = [];
      this.emit('sfx', 'pick');
      return true;
    }
    if (h.kind === 'plate') {
      if (p.contents.length) return this.say('Spot taken', 'warn');
      p.contents = h.contents;
      this.hand = null;
      this.emit('sfx', 'place');
      return true;
    }
    const def = ITEMS[h.kind];
    if (!def.plateable) {
      return this.say(def.chop ? 'Chop it first 🔪' : h.kind === 'burnt' ? 'Trash that!' : 'Cook it first 🔥', 'warn');
    }
    if (p.contents.length >= 3) return this.say('Plate is full', 'warn');
    p.contents.push(h.kind);
    this.hand = null;
    this.emit('sfx', 'place');
    return true;
  }

  serve() {
    const h = this.hand;
    if (!h) return this.say('Pick up a finished plate', 'info');
    if (h.kind !== 'plate') return this.say('Plate it first 🍽️', 'warn');
    const recipe = matchRecipe(h.contents);
    if (!recipe) return this.say("That's not on the menu!", 'bad');
    const waiting = this.customers.filter((c) => c.state !== 'leaving' && c.recipe === recipe.id);
    if (!waiting.length) return this.say(`Nobody ordered ${recipe.name}`, 'warn');
    const c = waiting.reduce((a, b) => (a.patience < b.patience ? a : b));
    this.hand = null;
    this.pay(c, recipe);
    return true;
  }

  pay(c, recipe) {
    const type = CUSTOMERS[c.type];
    const frac = Math.max(0, c.patience / c.max);
    const tipBoost = 1 + 0.25 * this.upg('tips');
    const tip = Math.round(recipe.price * 0.6 * frac * type.tip * recipe.tip * (this.save.rating / 3) * tipBoost);
    const total = recipe.price + tip;
    this.save.money += total;
    this.stats.earned += total;
    this.stats.served++;
    if (recipe.id === this.cfg.bonus.recipe) this.stats.bonusCount++;
    this.bumpRating(type.repGain * (frac > 0.5 ? 1 : 0.5));
    c.state = 'leaving';
    c.happy = true;
    c.leaveT = 2.2;
    this.emit('sfx', 'cash');
    this.emit('served', { c, total, tip });
  }

  trash() {
    if (!this.hand) return this.say('Nothing to toss', 'info');
    this.hand = null;
    this.save.money = Math.max(0, this.save.money - 2);
    this.stats.earned -= 2;
    this.emit('sfx', 'trash');
    this.say('Wasted food −$2', 'bad', 'trash');
    return true;
  }

  bumpRating(d) {
    this.save.rating = Math.max(1, Math.min(5, this.save.rating + d));
  }

  // ---------- simulation ----------

  spawnCustomer() {
    const used = new Set(this.customers.filter((c) => c.state !== 'leaving').map((c) => c.slot));
    const free = [];
    for (let s = 0; s < this.cfg.seats; s++) if (!used.has(s)) free.push(s);
    if (!free.length) return false;
    const typeId = pick(this.cfg.types);
    const type = CUSTOMERS[typeId];
    // Critics order from the fanciest dishes on today's menu.
    const pool = typeId === 'critic' ? this.cfg.recipes.slice(-2) : this.cfg.recipes;
    const max = type.patience * this.cfg.patienceMult;
    this.customers.push({
      id: this.nextId++, type: typeId, recipe: pick(pool), slot: pick(free),
      patience: max, max, state: 'arriving', walk: 1.6, happy: false, leaveT: 0,
    });
    this.emit('sfx', 'bell');
    return true;
  }

  update(dt) {
    if (this.ended) return;

    if (this.time > 0) {
      this.time = Math.max(0, this.time - dt);
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = this.spawnCustomer() ? this.cfg.interval * rand(0.75, 1.25) : 1;
      }
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
          this.stats.lost++;
          this.bumpRating(-CUSTOMERS[c.type].repLoss);
          this.emit('sfx', 'fail');
          this.emit('lost', { c });
        }
      } else {
        c.leaveT -= dt;
      }
    }
    this.customers = this.customers.filter((c) => c.state !== 'leaving' || c.leaveT > 0);

    const speed = 1 + 0.25 * this.upg('stove');
    this.burners.forEach((s, i) => {
      if (!s.item) return;
      s.t += dt * (s.state === 'cooking' ? speed : 1);
      if (s.state === 'cooking' && s.t >= s.cookTime) {
        s.state = 'done';
        s.t = 0;
        s.item = ITEMS[s.item].cook;
        this.emit('sfx', 'ding');
        if (this.upg('autoPlater')) this.autoPlate(s);
      } else if (s.state === 'done' && s.t >= BURN_WINDOW) {
        s.state = 'burnt';
        s.item = 'burnt';
        this.stats.burnt++;
        this.bumpRating(-0.05);
        this.emit('sfx', 'fail');
        this.say('Burnt! 🔥', 'bad', `burner:${i}`);
      }
    });

    if (this.upg('helper')) {
      this.helperT += dt;
      if (this.helperT >= 1.1) {
        this.helperT = 0;
        const b = this.boards.find((x) => x.item && ITEMS[x.item].chop);
        if (b) this.chop(b);
      }
    }

    if (this.time === 0 && !this.customers.length) this.endDay();
  }

  autoPlate(s) {
    const plates = [...this.plates].sort((a, b) => b.contents.length - a.contents.length);
    const target = plates.find((p) => p.contents.length < 3 && fitsRecipe([...p.contents, s.item], this.cfg.recipes));
    if (!target) return;
    target.contents.push(s.item);
    s.item = null;
    s.state = null;
  }

  endDay() {
    this.ended = true;
    const { stats, cfg, save } = this;
    let bonusPaid = 0;
    if (stats.bonusCount >= cfg.bonus.count) {
      bonusPaid = cfg.bonus.reward;
      save.money += bonusPaid;
    }
    let stars = 0;
    if (stats.earned >= cfg.goal) stars++;
    if (stats.earned >= cfg.goal * 1.5) stars++;
    if (stats.earned >= cfg.goal && stats.lost === 0) stars++;
    save.stars[cfg.day] = Math.max(save.stars[cfg.day] || 0, stars);
    const result = { ...stats, day: cfg.day, goal: cfg.goal, stars, bonusPaid, bonus: cfg.bonus, rating: save.rating };
    save.day++;
    if (save.day > CAREER_DAYS) save.careerDone = true;
    writeSave(save);
    this.emit('dayEnd', result);
  }
}
