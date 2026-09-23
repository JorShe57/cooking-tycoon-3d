import { KitchenScene } from './scene.js';
import { Game, newSave, loadSave, writeSave, matchDish, vstate, ensureCrates } from './game.js';
import {
  ITEMS, RECIPES, RECIPE_LIST, CUSTOMERS, VENUES, EVENTS, CAREER_DAYS, BURN_WINDOW, howToText,
  SPICY_DAY, DISHES_DAY, VEGGIE_DAY,
} from './data.js';
import { sfx, unlockAudio } from './audio.js';
import { createPlanner } from './planner.js';
import { createBuilder } from './build.js';

const $ = (id) => document.getElementById(id);
const scene = new KitchenScene($('game'));

let save = loadSave();
let game = null;
let mode = 'menu'; // menu | playing | paused | plan | build
let introT = 0;

// ---------- popups ----------

function popAt(v, text, kind = 'info') {
  if (!v) return popScreen(text, kind);
  const { x, y } = scene.project(v);
  addPop(x, y, text, kind);
}
function popScreen(text, kind) {
  addPop(window.innerWidth / 2, window.innerHeight * 0.45, text, kind);
}
function addPop(x, y, text, kind) {
  const el = document.createElement('div');
  el.className = `pop ${kind}`;
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  $('popups').appendChild(el);
  setTimeout(() => el.remove(), 1250);
}
const toast = (text, kind = 'info') => popScreen(text, kind);

// ---------- events from the game ----------

function onGameEvent(type, p) {
  switch (type) {
    case 'sfx': sfx(p); break;
    case 'chop': scene.playChop(); scene.pulse(p); break;
    case 'interact': scene.pulse(p); break;
    case 'staff': scene.staffEvent(p.id); scene.pulse(p.at); break;
    case 'toast': {
      const at = p.at ? scene.stationAnchor(p.at) : null;
      popAt(at || scene.chef.position.clone().setY(2.2), p.text, p.kind);
      break;
    }
    case 'served':
      popAt(scene.customerHead(p.c.id) || scene.stationAnchor('serve'), `+$${p.total}`, 'good');
      break;
    case 'lost':
      popAt(scene.customerHead(p.c.id) || scene.stationAnchor('serve'), 'Left angry!', 'bad');
      break;
    case 'closing': popScreen('Kitchen closing — finish your orders!', 'warn'); break;
    case 'dayEnd':
      setTimeout(() => {
        sfx('cash');
        openPlanner('report');
      }, 900);
      break;
  }
}

// ---------- input ----------

$('game').addEventListener('pointerdown', (e) => {
  unlockAudio();
  if (mode === 'build') return builder.onTap(e.clientX, e.clientY);
  if (mode !== 'playing') return;
  const id = scene.pick(e.clientX, e.clientY);
  if (id) game.queueAction(id);
});

// ---------- world labels ----------

const labelEls = new Map();
function label(key) {
  let el = labelEls.get(key);
  if (!el) {
    el = document.createElement('div');
    el.dataset.html = '';
    $('labels').appendChild(el);
    labelEls.set(key, el);
  }
  el.dataset.seen = '1';
  return el;
}
function place(el, v, cls, html) {
  const p = scene.project(v);
  el.style.left = `${p.x}px`;
  el.style.top = `${p.y}px`;
  if (el.className !== cls) el.className = cls;
  if (el.dataset.html !== html) {
    el.dataset.html = html;
    el.innerHTML = html;
  }
}
const bar = (frac) => {
  const pct = Math.round(Math.max(0, Math.min(1, frac)) * 20) * 5;
  const cls = frac < 0.3 ? 'low' : frac < 0.6 ? 'mid' : '';
  return `<div class="bar"><i class="${cls}" style="width:${pct}%"></i></div>`;
};
const dishText = (d) => (d ? `${d.recipe.emoji}${d.spicy ? '🌶️' : ''}` : '');

function stationLabel(st) {
  switch (st.type) {
    case 'crate': {
      const n = save.stock[st.ing] || 0;
      return [n ? 'lbl small' : 'lbl small warnlbl', `${ITEMS[st.ing].emoji} ${n}`, 0.05];
    }
    case 'board':
      if (st.item && ITEMS[st.item].chop) return ['lbl', `Chop${bar(st.progress)}`, 0.55];
      if (st.item) return ['lbl match', `✓ ${ITEMS[st.item].emoji}`, 0.55];
      return ['lbl small', '🔪', 0.45];
    case 'burner':
    case 'fryer': {
      const icon = st.type === 'burner' ? '🔥' : '🛢️';
      if (st.off) return ['lbl off', '⚡ Off', 0.6];
      if (st.state === 'cooking') return ['lbl', `${icon}${bar(st.t / st.cookTime)}`, 0.6];
      if (st.state === 'done') return ['lbl ready', `Ready!${bar(1 - st.t / BURN_WINDOW)}`, 0.6];
      if (st.state === 'burnt') return ['lbl burnt', '☠️ Burnt', 0.6];
      return ['lbl small', icon, 0.45];
    }
    case 'plate': {
      if (!st.plate) return ['lbl small warnlbl', 'No plate', 0.35];
      const d = st.plate.contents.length ? matchDish(st.plate.contents) : null;
      if (d) return ['lbl match', `✓ ${dishText(d)}`, 0.55];
      if (st.plate.contents.length) return ['lbl', st.plate.contents.map((k) => ITEMS[k].emoji).join(''), 0.55];
      return ['lbl small', '🍽️', 0.35];
    }
    case 'sink':
      if (st.dirty) return [st.dirty >= 3 ? 'lbl ready' : 'lbl', `🧽 ×${st.dirty}${st.progress ? bar(st.progress) : ''}`, 0.6];
      return ['lbl small', '🧽', 0.35];
    case 'trash':
      return ['lbl small', '🗑️', 0.1];
  }
  return null;
}

function updateLabels() {
  for (const el of labelEls.values()) el.dataset.seen = '';
  if (game && (mode === 'playing' || mode === 'paused')) {
    const up = (v, dy) => v.clone().setY(v.y + dy);
    for (const st of game.stations.values()) {
      const a = scene.stationAnchor(st.id);
      const l = a && stationLabel(st);
      if (l) place(label(st.id), up(a, l[2]), l[0], l[1]);
    }
    place(label('serve'), up(scene.stationAnchor('serve'), 0.35), 'lbl serve', 'SERVE');

    // Queued taps.
    const q = [game.chef.current, ...game.chef.queue].filter(Boolean);
    const seen = new Map();
    q.forEach((id, i) => {
      const a = scene.stationAnchor(id);
      if (!a) return;
      const k = seen.get(id) || 0;
      seen.set(id, k + 1);
      place(label(`q:${id}:${k}`), up(a, 1.05 + k * 0.28), 'qbadge', `${i + 1}`);
    });

    for (const c of game.customers) {
      const head = scene.customerHead(c.id);
      if (!head) continue;
      let html;
      let cls = 'bubble';
      if (c.state === 'leaving') {
        html = c.happy ? (c.type === 'inspector' ? '📋' : '😋') : '😠';
        cls = 'bubble mood';
      } else if (c.type === 'inspector') html = `📋${bar(c.patience / c.max)}`;
      else {
        const todo = c.orders.filter((o) => !o.done).map((o) => RECIPES[o.recipe].emoji + (o.spicy ? '🌶️' : '')).join('');
        html = `${c.veggie ? '🌱' : ''}${c.type === 'influencer' ? '📸' : ''}${todo}${bar(c.patience / c.max)}`;
      }
      place(label(`c:${c.id}`), head, cls, html);
    }
  }
  for (const [k, el] of labelEls) {
    if (!el.dataset.seen) {
      el.remove();
      labelEls.delete(k);
    }
  }
}

// ---------- HUD ----------

const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const steps = (r) => r.parts.map(howToText).join(' + ');
const handText = (h) => {
  if (!h) return 'Hands empty';
  if (h.kind === 'plate') {
    if (!h.contents.length) return '🍽️ Clean plate';
    const d = matchDish(h.contents);
    return d ? `Plate: ${d.recipe.emoji} ${d.recipe.name}${d.spicy ? ' 🌶️' : ''}` : `Plate: ${h.contents.map((k) => ITEMS[k].emoji).join(' ')}`;
  }
  const d = ITEMS[h.kind];
  return `${d.emoji}${d.tag || ''} ${d.name}`;
};
const setHTML = (el, html) => {
  if (el.dataset.html !== html) {
    el.dataset.html = html;
    el.innerHTML = html;
  }
};

function tutorialHint() {
  const g = game;
  const h = g.hand;
  const waiting = g.customers.filter((c) => c.state !== 'leaving' && c.type !== 'inspector');
  const plates = g.stationsOf('plate');
  if (!waiting.length && !h) return 'Customers line up at the pass (back). Their orders show up as tickets.';
  if (!h) {
    if (plates.some((p) => p.plate && matchDish(p.plate.contents))) return 'Dish complete! Tap the plate to pick it up.';
    if (g.stationsOf('burner').some((b) => b.state === 'done')) return 'Ding! Tap the burner to grab it before it burns.';
    if (g.stationsOf('board').some((b) => b.item && ITEMS[b.item].chop)) return 'Tap the board again to chop 🔪';
    if (g.stationsOf('board').some((b) => b.item)) return 'Chopped! Tap the board to pick it up.';
    return 'Tap a crate to grab an ingredient. Taps queue up — you can tap several stations in a row!';
  }
  if (h.kind === 'plate') return matchDish(h.contents) ? 'Tap the SERVE pass to hand it over!' : 'Not a full dish yet — set the plate down on a counter.';
  if (h.kind === 'burnt') return 'Toss it in the trash 🗑️.';
  if (h.kind === 'bread') return 'Toast it on a burner 🔥 — or plate it as a burger bun.';
  if (h.kind === 'tomato_chopped') return 'Plate it for a salad, or cook it on a burner for soup.';
  const d = ITEMS[h.kind];
  if (d.chop) return 'Tap a cutting board 🔪 to chop it.';
  if (d.cook) return 'Tap a burner 🔥 to cook it.';
  if (d.fry) return 'Tap the fryer 🛢️.';
  return 'Tap a plate counter 🍽️ to add it.';
}

const DAY_TIPS = {
  [DISHES_DAY]: '🧽 New: served plates come back dirty to the sink. Tap the sink to scrub, then put the plate on an empty counter.',
  5: '🛢️ New: the Deep Fryer (buy it in the Shop) fries cut potatoes and fish.',
  6: '👥 New: groups order several dishes at once — serve them all for a big tip.',
  [VEGGIE_DAY]: '🌱 New: veggie customers only order veg dishes.',
  [SPICY_DAY]: '🌶️ New: chop a chili and add it to the plate for spicy orders (+$4).',
};

function updateHUD() {
  const g = game;
  $('hud-day').textContent = g.cfg.freePlay ? `Day ${g.cfg.day} ∞` : `Day ${g.cfg.day}/${CAREER_DAYS}`;
  const t = $('hud-time');
  t.textContent = g.time > 0 ? `⏱ ${fmtTime(g.time)}` : 'Closing';
  t.classList.toggle('urgent', g.time > 0 && g.time < 15);
  $('hud-money').textContent = `$${Math.round(save.money)}`;
  $('hud-rating').textContent = `★ ${save.rating.toFixed(1)}`;
  const ev = EVENTS[g.cfg.event];
  const evEl = $('hud-event');
  evEl.classList.toggle('hidden', g.cfg.event === 'regular');
  evEl.className = `chip event ${g.cfg.event === 'regular' ? 'hidden' : ''}`;
  evEl.textContent = `${ev.emoji} ${ev.name}${g.cfg.shortage ? ` · no ${ITEMS[g.cfg.shortage].emoji} deliveries` : ''}`;
  const goal = $('hud-goal');
  goal.textContent = `🎯 $${Math.round(g.earned)}/${g.cfg.goal}`;
  goal.classList.toggle('done', g.earned >= g.cfg.goal);
  const b = g.cfg.bonus;
  const bonus = $('hud-bonus');
  bonus.textContent = `Bonus ${Math.min(g.stats.bonusCount, b.count)}/${b.count} ${RECIPES[b.recipe].emoji} +$${b.reward}`;
  bonus.classList.toggle('done', g.stats.bonusCount >= b.count);

  const tickets = g.customers
    .filter((c) => c.state !== 'leaving' && c.type !== 'inspector')
    .sort((a, b2) => a.slot - b2.slot)
    .map((c) => {
      const type = CUSTOMERS[c.type];
      const color = `#${type.color.toString(16).padStart(6, '0')}`;
      const next = c.orders.find((o) => !o.done);
      return `<div class="ticket" style="--c:${color}">
        <div class="t-type">${c.veggie ? '🌱 ' : ''}${type.name}</div>
        ${c.orders.map((o) => `<div class="t-order ${o.done ? 'done' : ''}">${RECIPES[o.recipe].emoji} ${RECIPES[o.recipe].name}${o.spicy ? ' 🌶️' : ''}</div>`).join('')}
        ${next ? `<div class="t-steps">${steps(RECIPES[next.recipe])}${next.spicy ? ' + 🌶️🔪' : ''}</div>` : ''}
        ${bar(c.patience / c.max)}
      </div>`;
    })
    .join('');
  setHTML($('tickets'), tickets);
  setHTML($('hand'), handText(g.hand));

  const tut = $('tutorial');
  const tip = introT > 0 ? DAY_TIPS[g.cfg.day] : null;
  const showTut = g.cfg.day <= 2 || !!tip;
  tut.classList.toggle('hidden', !showTut);
  if (showTut) setHTML(tut, tip || `💡 ${tutorialHint()}`);
}

// ---------- screens ----------

const SCREENS = ['screen-menu', 'screen-plan', 'screen-pause', 'screen-howto'];
function show(screen) {
  for (const id of SCREENS) $(id).classList.toggle('hidden', id !== screen);
  $('hud').classList.toggle('hidden', !(mode === 'playing' || mode === 'paused'));
  $('build-ui').classList.toggle('hidden', mode !== 'build');
}

function backdrop(s) {
  const venue = VENUES[s.venue];
  scene.setVenue(venue, { patio: s.venue === 'diner' && !!s.upgrades.patio });
  scene.setLayout(vstate(s).layout);
  scene.clearCustomers();
}

function showMenu() {
  mode = 'menu';
  game = null;
  backdrop(save || newSave());
  $('btn-continue').classList.toggle('hidden', !save);
  if (save) $('btn-continue').textContent = `Continue — Day ${save.day}`;
  show('screen-menu');
}

const planner = createPlanner({
  getSave: () => save,
  onOpen: () => startDay(),
  onKitchen: () => enterBuild(),
  onVenueChange: () => backdrop(save),
  toast,
  sfx,
});

const builder = createBuilder({
  scene,
  getSave: () => save,
  toast,
  sfx,
  onDone: () => {
    scene.setBuildMode(false);
    openPlanner();
  },
});

function openPlanner(tab) {
  mode = 'plan';
  game = null;
  ensureCrates(save);
  backdrop(save);
  planner.show(tab);
  show('screen-plan');
}

function enterBuild() {
  mode = 'build';
  backdrop(save);
  scene.setBuildMode(true);
  builder.enter();
  show(null);
}

function startDay() {
  unlockAudio();
  backdrop(save);
  game = new Game(save, onGameEvent);
  game.startDay();
  writeSave(save);
  mode = 'playing';
  introT = 12;
  show(null);
  const ev = EVENTS[game.cfg.event];
  popScreen(game.cfg.event === 'regular' ? `Day ${save.day} — Open for business!` : `${ev.emoji} ${ev.name}!`, 'good');
}

function pause(bookOnly = false) {
  if (mode !== 'playing') return;
  mode = 'paused';
  $('pause-title').textContent = bookOnly ? 'Recipe Book' : 'Paused';
  $('book').innerHTML = RECIPE_LIST.map((r) => {
    const known = save.known.includes(r.id);
    const onMenu = save.menu.some((m) => m.id === r.id);
    return `<div class="recipe ${known ? '' : 'locked'}">
      <div class="r-name">${r.emoji} ${r.name} ${r.veg ? '🌱' : ''}${onMenu ? ' <span class="pill good">on menu</span>' : ''}<span style="float:right">$${r.price}</span></div>
      <div class="r-steps">${known ? steps(r) : `Learn it in the planner (day ${r.unlock}+)`}</div></div>`;
  }).join('') + '<div class="recipe"><div class="r-steps">🔪 chop on a board · 🔥 cook on a burner · 🛢️ fry in the fryer · 🌶️ add chopped chili for spicy</div></div>';
  show('screen-pause');
}
function resume() {
  if (mode !== 'paused') return;
  mode = 'playing';
  show(null);
}

$('btn-new').addEventListener('click', () => {
  if (save && !confirm('Start a new game? Your current progress will be replaced.')) return;
  save = newSave();
  writeSave(save);
  openPlanner('plan');
});
$('btn-continue').addEventListener('click', () => openPlanner('plan'));
$('btn-howto').addEventListener('click', () => show('screen-howto'));
$('btn-howto-close').addEventListener('click', () => show(mode === 'menu' ? 'screen-menu' : null));
$('btn-pause').addEventListener('click', () => pause(false));
$('btn-book').addEventListener('click', () => pause(true));
$('btn-resume').addEventListener('click', resume);
$('btn-quit').addEventListener('click', () => {
  // Quitting mid-day forfeits the rest of the shift; money earned so far is kept.
  writeSave(save);
  showMenu();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause(false);
});
window.addEventListener('resize', () => scene.resize());

// ---------- main loop ----------

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (mode === 'playing' && game) {
    game.update(dt);
    introT = Math.max(0, introT - dt);
  }
  if (game && (mode === 'playing' || mode === 'paused')) {
    scene.sync(game, mode === 'playing' ? dt : 0);
    updateHUD();
  } else if (mode === 'build') {
    scene.syncBuild(dt);
  } else {
    scene.idle(dt);
  }
  updateLabels();
  scene.render();
  requestAnimationFrame(frame);
}

showMenu();
requestAnimationFrame(frame);

// Expose for quick debugging in the browser console.
window.__ct = { scene, get game() { return game; }, get save() { return save; } };
