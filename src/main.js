import { KitchenScene } from './scene.js';
import { Game, newSave, loadSave, writeSave, matchRecipe } from './game.js';
import {
  ITEMS, RECIPES, RECIPE_LIST, CUSTOMERS, UPGRADES, HOW_TO, CAREER_DAYS, BURN_WINDOW, dayConfig, dayNews,
} from './data.js';
import { sfx, unlockAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const scene = new KitchenScene($('game'));

let save = loadSave();
let game = null;
let mode = 'menu'; // menu | playing | paused | between

// ---------- events from the game ----------

function onGameEvent(type, p) {
  switch (type) {
    case 'sfx': sfx(p); break;
    case 'chop': scene.playChop(); break;
    case 'toast': popAt(p.at ? scene.stationAnchor(p.at) : scene.chef.position.clone().setY(2.2), p.text, p.kind); break;
    case 'served': {
      const head = scene.customerHead(p.c.id);
      popAt(head || scene.stationAnchor('serve'), `+$${p.total}`, 'good');
      break;
    }
    case 'lost': {
      const head = scene.customerHead(p.c.id);
      popAt(head || scene.stationAnchor('serve'), 'Left angry!', 'bad');
      break;
    }
    case 'closing': popScreen('Kitchen closing — finish your orders!', 'warn'); break;
    case 'dayEnd': setTimeout(() => showBetween(p), 700); break;
  }
}

// ---------- popups ----------

function popAt(v, text, kind = 'info') {
  if (!v) return;
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

// ---------- input ----------

$('game').addEventListener('pointerdown', (e) => {
  unlockAudio();
  if (mode !== 'playing') return;
  const id = scene.pick(e.clientX, e.clientY);
  if (!id) return;
  scene.walkTo(id);
  game.interact(id);
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

function updateLabels() {
  for (const el of labelEls.values()) el.dataset.seen = '';
  if (game && mode !== 'menu') {
    const up = (v, dy) => v.clone().setY(v.y + dy);
    for (const item of ['bread', 'lettuce', 'tomato', 'patty']) {
      const a = scene.stationAnchor(`crate:${item}`);
      place(label(`crate:${item}`), up(a, 0.1), 'lbl small', `${ITEMS[item].emoji} ${ITEMS[item].name}`);
    }
    game.boards.forEach((b, i) => {
      const a = scene.stationAnchor(`board:${i}`);
      let html = '🔪 Board';
      let cls = 'lbl small';
      if (b.item && ITEMS[b.item].chop) html = `Tap to chop${bar(b.progress)}`, cls = 'lbl';
      else if (b.item) html = `✓ ${ITEMS[b.item].name}`, cls = 'lbl match';
      place(label(`board:${i}`), up(a, 0.55), cls, html);
    });
    game.burners.forEach((b, i) => {
      const a = scene.stationAnchor(`burner:${i}`);
      let html = '🔥 Stove';
      let cls = 'lbl small';
      if (b.state === 'cooking') html = `Cooking${bar(b.t / b.cookTime)}`, cls = 'lbl';
      else if (b.state === 'done') html = `Ready!${bar(1 - b.t / BURN_WINDOW)}`, cls = 'lbl ready';
      else if (b.state === 'burnt') html = '☠️ Burnt', cls = 'lbl burnt';
      place(label(`burner:${i}`), up(a, 0.6), cls, html);
    });
    game.plates.forEach((p, i) => {
      const a = scene.stationAnchor(`plate:${i}`);
      const r = p.contents.length ? matchRecipe(p.contents) : null;
      let html = '🍽️';
      let cls = 'lbl small';
      if (r) html = `✓ ${r.emoji}`, cls = 'lbl match';
      else if (p.contents.length) html = p.contents.map((k) => ITEMS[k].emoji).join(' '), cls = 'lbl';
      place(label(`plate:${i}`), up(a, 0.55), cls, html);
    });
    place(label('serve'), up(scene.stationAnchor('serve'), 0.35), 'lbl serve', 'SERVE');
    place(label('trash'), up(scene.stationAnchor('trash'), 0.1), 'lbl small', '🗑️ Trash');

    for (const c of game.customers) {
      const head = scene.customerHead(c.id);
      if (!head) continue;
      let html;
      let cls = 'bubble';
      if (c.state === 'leaving') html = c.happy ? '😋' : '😠', cls = 'bubble mood';
      else html = `${RECIPES[c.recipe].emoji}${bar(c.patience / c.max)}`;
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
const steps = (r) => r.parts.map((k) => HOW_TO[k].join('')).join(' + ');
const handText = (h) => {
  if (!h) return 'Hands empty';
  if (h.kind === 'plate') {
    const r = matchRecipe(h.contents);
    return r ? `Plate: ${r.emoji} ${r.name}` : `Plate: ${h.contents.map((k) => ITEMS[k].emoji).join(' ')}`;
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
  const waiting = g.customers.filter((c) => c.state !== 'leaving');
  const ordered = new Set(waiting.map((c) => c.recipe));
  if (!waiting.length && !h) return 'Customers will line up at the pass (back). Watch the tickets up top!';
  if (!h) {
    if (g.plates.some((p) => { const r = matchRecipe(p.contents); return r && ordered.has(r.id); })) return 'Plate complete! Tap it to pick it up.';
    if (g.burners.some((b) => b.state === 'done')) return 'Ding! Tap the burner to grab it before it burns.';
    if (g.boards.some((b) => b.item && ITEMS[b.item].chop)) return 'Keep tapping the board to chop 🔪';
    if (g.boards.some((b) => b.item)) return 'Chopped! Tap the board to pick it up.';
    return 'Check a ticket, then tap a crate (left) to grab an ingredient.';
  }
  if (h.kind === 'plate') return matchRecipe(h.contents) ? 'Tap the SERVE pass to hand it over!' : 'Not a full dish yet — set the plate back down and add more.';
  if (h.kind === 'burnt') return 'Toss it in the trash 🗑️ (bottom right).';
  if (h.kind === 'bread') return 'Toast it on a burner (right), or plate it as a burger bun.';
  if (h.kind === 'tomato_chopped') return 'Plate it for a salad, or cook it on a burner for soup.';
  const d = ITEMS[h.kind];
  if (d.chop) return 'Tap a cutting board (front) to chop it.';
  if (d.cook) return 'Tap a burner (right) to cook it.';
  return 'Tap a plate (by the pass) to add it.';
}

function updateHUD() {
  const g = game;
  $('hud-day').textContent = g.cfg.freePlay ? `Day ${g.cfg.day} ∞` : `Day ${g.cfg.day}/${CAREER_DAYS}`;
  const t = $('hud-time');
  t.textContent = g.time > 0 ? `⏱ ${fmtTime(g.time)}` : 'Closing';
  t.classList.toggle('urgent', g.time > 0 && g.time < 15);
  $('hud-money').textContent = `$${save.money}`;
  $('hud-rating').textContent = `★ ${save.rating.toFixed(1)}`;
  const goal = $('hud-goal');
  goal.textContent = `Goal $${Math.max(0, g.stats.earned)}/${g.cfg.goal}`;
  goal.classList.toggle('done', g.stats.earned >= g.cfg.goal);
  const b = g.cfg.bonus;
  const bonus = $('hud-bonus');
  bonus.textContent = `Bonus: ${Math.min(g.stats.bonusCount, b.count)}/${b.count} ${RECIPES[b.recipe].emoji} → +$${b.reward}`;
  bonus.classList.toggle('done', g.stats.bonusCount >= b.count);

  const tickets = g.customers
    .filter((c) => c.state !== 'leaving')
    .sort((a, b2) => a.slot - b2.slot)
    .map((c) => {
      const r = RECIPES[c.recipe];
      const type = CUSTOMERS[c.type];
      const color = `#${type.color.toString(16).padStart(6, '0')}`;
      return `<div class="ticket" style="--c:${color}">
        <div class="t-head"><span class="t-emoji">${r.emoji}</span>${r.name}</div>
        <div class="t-type">${type.name}</div>
        <div class="t-steps">${steps(r)}</div>
        ${bar(c.patience / c.max)}
      </div>`;
    })
    .join('');
  setHTML($('tickets'), tickets);
  setHTML($('hand'), handText(g.hand));

  const tut = $('tutorial');
  const showTut = g.cfg.day <= 2;
  tut.classList.toggle('hidden', !showTut);
  if (showTut) setHTML(tut, `💡 ${tutorialHint()}`);
}

// ---------- screens ----------

function show(screen) {
  for (const id of ['screen-menu', 'screen-between', 'screen-pause', 'screen-howto']) {
    $(id).classList.toggle('hidden', id !== screen);
  }
  $('hud').classList.toggle('hidden', !(mode === 'playing' || mode === 'paused'));
}

function showMenu() {
  mode = 'menu';
  game = null;
  scene.reset();
  $('btn-continue').classList.toggle('hidden', !save);
  if (save) $('btn-continue').textContent = `Continue — Day ${save.day}`;
  show('screen-menu');
}

function showBetween(result) {
  mode = 'between';
  let html = '';
  if (result) {
    const stars = '★'.repeat(result.stars) + '☆'.repeat(3 - result.stars);
    const finale = result.day === CAREER_DAYS
      ? '<p><b>🎉 Career complete!</b> Your kitchen is a local legend. Free play continues with endless days.</p>'
      : '';
    html = `<h2>Day ${result.day} Complete</h2>
      <div class="result-stars">${stars}</div>
      ${finale}
      <div class="result-grid">
        <div>Earned<b>$${result.earned}</b></div>
        <div>Goal<b>$${result.goal}</b></div>
        <div>Served<b>${result.served}</b></div>
        <div>Walk-outs<b>${result.lost}</b></div>
        <div>Burnt<b>${result.burnt}</b></div>
        <div>Rating<b>★ ${result.rating.toFixed(1)}</b></div>
      </div>
      ${result.bonusPaid ? `<p>Bonus goal hit: <b>+$${result.bonusPaid}</b></p>` : ''}`;
  } else {
    html = `<h2>Welcome back, Chef!</h2><p class="sub">Rating ★ ${save.rating.toFixed(1)} · Days starred: ${Object.values(save.stars).reduce((a, b) => a + b, 0)}★</p>`;
  }
  $('day-result').innerHTML = html;
  renderShop();
  const cfg = dayConfig(save.day, save.upgrades);
  const news = dayNews(save.day);
  $('next-day').innerHTML = `<b>Next: Day ${save.day}${cfg.freePlay ? ' (Free Play)' : ''}</b><br>
    Goal $${cfg.goal} · ${Math.round(cfg.length)}s shift · ${cfg.seats} customer spots<br>
    Menu: ${cfg.recipes.map((id) => RECIPES[id].emoji).join(' ')}
    ${news.length ? '<br>' + news.map((n) => `✨ ${n}`).join('<br>') : ''}`;
  $('btn-start').textContent = `Start Day ${save.day}`;
  show('screen-between');
}

function renderShop() {
  $('shop-money').textContent = `$${save.money}`;
  $('shop').innerHTML = UPGRADES.map((u) => {
    const lvl = save.upgrades[u.id] || 0;
    const maxed = lvl >= u.costs.length;
    const locked = save.day < u.unlock;
    const cost = u.costs[lvl];
    const btn = locked
      ? `<button disabled>Day ${u.unlock}</button>`
      : maxed
        ? '<button disabled>MAX</button>'
        : `<button data-buy="${u.id}" ${save.money < cost ? 'disabled' : ''}>$${cost}</button>`;
    return `<div class="shop-item ${locked ? 'locked' : ''}">
      <div class="info"><div class="name">${u.name}</div><div class="desc">${u.desc}</div>
      <div class="lvl">${'■'.repeat(lvl)}${'□'.repeat(u.costs.length - lvl)}</div></div>${btn}</div>`;
  }).join('');
}

$('shop').addEventListener('click', (e) => {
  const id = e.target.dataset?.buy;
  if (!id) return;
  const u = UPGRADES.find((x) => x.id === id);
  const lvl = save.upgrades[id] || 0;
  const cost = u.costs[lvl];
  if (cost == null || save.money < cost) return;
  save.money -= cost;
  save.upgrades[id] = lvl + 1;
  writeSave(save);
  sfx('cash');
  renderShop();
});

function startDay() {
  unlockAudio();
  scene.reset();
  game = new Game(save, onGameEvent);
  game.startDay();
  mode = 'playing';
  show(null);
  popScreen(`Day ${save.day} — Open for business!`, 'good');
}

function pause(bookOnly = false) {
  if (mode !== 'playing') return;
  mode = 'paused';
  $('pause-title').textContent = bookOnly ? 'Recipe Book' : 'Paused';
  $('book').innerHTML = RECIPE_LIST.map((r) => {
    const locked = r.unlock > save.day;
    return `<div class="recipe ${locked ? 'locked' : ''}">
      <div class="r-name">${r.emoji} ${r.name} <span style="float:right">$${r.price}</span></div>
      <div class="r-steps">${locked ? `Unlocks on day ${r.unlock}` : steps(r)}</div></div>`;
  }).join('') + '<div class="recipe"><div class="r-steps">🔪 = chop on a board · 🔥 = cook on a burner · then plate &amp; serve</div></div>';
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
  startDay();
});
$('btn-continue').addEventListener('click', () => showBetween(null));
$('btn-howto').addEventListener('click', () => show('screen-howto'));
$('btn-howto-close').addEventListener('click', () => show('screen-menu'));
$('btn-start').addEventListener('click', startDay);
$('btn-menu').addEventListener('click', showMenu);
$('btn-pause').addEventListener('click', () => pause(false));
$('btn-book').addEventListener('click', () => pause(true));
$('btn-resume').addEventListener('click', resume);
$('btn-quit').addEventListener('click', () => {
  // Quitting mid-day forfeits that day; money earned so far is kept.
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
  if (mode === 'playing' && game) game.update(dt);
  if (game) {
    scene.sync(game, mode === 'playing' ? dt : 0);
    if (mode === 'playing' || mode === 'paused') updateHUD();
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
