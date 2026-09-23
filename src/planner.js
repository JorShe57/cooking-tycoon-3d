// Between-day planning screen: report, events, menu & prices, stock, shop, staff, goals.
import {
  ITEMS, RECIPES, RECIPE_LIST, PRICE_TIERS, SPICY_DAY, VEGGIE_DAY, DISHES_DAY, recipeNeeds, howToText,
  STATIONS, BUYABLE_STATIONS, VENUES, STAFF, UPGRADES, EVENTS, eventChoices, MILESTONES, rankFor, RANKS,
  CAREER_DAYS, EMERGENCY_MULT,
} from './data.js';
import {
  actions, dayConfig, planWarnings, menuSlots, stationCount, vstate, neededRaws, writeSave, seatCount,
} from './game.js';

const $ = (id) => document.getElementById(id);
const money = (n) => `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString()}`;
const stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

const TABS = [
  ['report', '📊 Report'], ['plan', '📅 Plan'], ['menu', '🍽 Menu'], ['stock', '📦 Stock'],
  ['shop', '🛒 Shop'], ['staff', '👥 Staff'], ['goals', '🏆 Goals'],
];

// Mechanics introduced on a given day (shown on the plan tab).
export function dayNews(day) {
  const news = [];
  for (const r of RECIPE_LIST) if (r.unlock === day && r.learn) news.push(`New recipe to learn: ${r.emoji} ${r.name}`);
  if (day === 2) news.push('Shop: More Seating & Extra boards available');
  if (day === 3) news.push('Plates now come back dirty — wash them at the sink 🧽', 'Rushed customers & day events begin');
  if (day === 4) news.push('Burgers, Auto-Plater and the Prep Cook unlock');
  if (day === 5) news.push('Deep Fryer 🛢️ for sale — Fries unlock', 'Critics start visiting 🎩');
  if (day === 6) news.push('Groups order 2–3 dishes at once', 'Hire a Runner 🏃');
  if (day === VEGGIE_DAY) news.push('Veggie customers 🌱 only order veg dishes', 'Open the Patio for more seats');
  if (day === SPICY_DAY) news.push('Spicy orders 🌶️: add chopped chili to the plate (+$4)');
  if (day === VENUES.truck.unlock) news.push('🚚 The Food Truck is for sale!');
  if (day === CAREER_DAYS + 1) news.push('Free play: endless days, rising difficulty');
  return news;
}

export function createPlanner({ getSave, onOpen, onKitchen, onVenueChange, toast, sfx }) {
  let tab = 'plan';

  const act = (fn, ...args) => {
    const err = fn(getSave(), ...args);
    if (err) {
      toast(err, 'bad');
      sfx('error');
    } else {
      sfx('buy');
      writeSave(getSave());
    }
    render();
    return !err;
  };

  function renderTabs() {
    const save = getSave();
    const warn = planWarnings(save).length > 0;
    $('plan-tabs').innerHTML = TABS.filter(([id]) => id !== 'report' || save.lastReport)
      .map(([id, label]) => `<button class="tab ${id === tab ? 'on' : ''}" data-tab="${id}">${label}${id === 'plan' && warn ? '<span class="dot"></span>' : ''}</button>`)
      .join('');
  }

  // ---------- tabs ----------

  function reportTab(save) {
    const r = save.lastReport;
    if (!r) return '<p class="muted">No report yet.</p>';
    const ev = EVENTS[r.event];
    const line = (label, v) => `<tr><td>${label}</td><td class="${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}">${v > 0 ? '+' : ''}${money(v)}</td></tr>`;
    const finale = r.day === CAREER_DAYS ? '<div class="ok-box">🎉 <b>Career complete!</b> Your restaurant is a local legend. Keep playing in free play.</div>' : '';
    const rows = [
      line('Sales', r.sales), line('Tips', r.tips),
      r.bonusPaid ? line(`Daily bonus (${r.bonus.count} ${RECIPES[r.bonus.recipe].emoji})`, r.bonusPaid) : '',
      r.eventBonus ? line(`${ev.emoji} Event bonus`, r.eventBonus) : '',
      r.weekPaid ? line('Weekly challenge', r.weekPaid) : '',
      ...r.milestones.map((m) => line(`🏆 ${m.name}`, m.reward)),
      line('Ingredients', -r.ingredients),
      r.rushCost ? `<tr class="sub"><td>incl. rush deliveries</td><td>${money(r.rushCost)}</td></tr>` : '',
      r.marketing ? line('Marketing', -r.marketing) : '',
      line('Rent', -r.rent),
      r.wages ? line('Staff wages', -r.wages) : '',
      r.fines ? line('Fines', -r.fines) : '',
    ].join('');
    return `${finale}
      <div class="center"><div class="muted">${ev.emoji} ${ev.name} · ${VENUES[r.venue].name}</div>
      <div class="big-stars">${stars(r.stars)}</div>
      <div class="muted">Goal ${money(r.goal)} in sales · earned ${money(r.sales + r.tips)}</div></div>
      <div class="sec"><h3>Profit &amp; Loss</h3><div class="card"><table class="pl">${rows}
        <tr class="total"><td>Profit</td><td class="${r.profit >= 0 ? 'pos' : 'neg'}">${money(r.profit)}</td></tr></table></div></div>
      <div class="sec"><h3>Service</h3><div class="card">
        <span class="pill good">🍽 ${r.served} dishes</span><span class="pill good">🙂 ${r.customers} happy</span>
        <span class="pill ${r.lost ? 'bad' : ''}">😠 ${r.lost} walk-outs</span>
        <span class="pill ${r.burnt ? 'bad' : ''}">🔥 ${r.burnt} burnt</span>
        <span class="pill ${r.wasted ? 'bad' : ''}">🗑 ${r.wasted} wasted</span>
        ${r.inspections.length ? `<span class="pill">📋 ${r.inspections.map((x) => (x ? '✅' : '❌')).join('')}</span>` : ''}
        <div class="muted" style="margin-top:6px">Rating ★ ${r.rating.toFixed(2)} (${r.ratingDelta >= 0 ? '+' : ''}${r.ratingDelta.toFixed(2)})
        ${r.spoiled.length ? ` · Spoiled overnight: ${r.spoiled.join(' ')} (${money(r.spoiledValue)})` : ''}</div>
      </div></div>`;
  }

  function planTab(save) {
    const cfg = dayConfig(save);
    const rank = rankFor(save.lifetime.earned);
    const next = rank.next;
    const start = RANKS[rank.index][0];
    const pct = next ? Math.min(100, ((save.lifetime.earned - start) / (next[0] - start)) * 100) : 100;
    const warnings = planWarnings(save);
    const choices = eventChoices(save.day);
    if (!choices.includes(save.event)) save.event = 'regular';
    const news = dayNews(save.day);
    const expected = Math.round(cfg.length / cfg.interval);
    const wk = save.week;
    const venues = Object.keys(save.venues).filter((v) => save.venues[v]);
    return `
      ${warnings.length ? `<div class="warn-box">⚠️ ${warnings.join('<br>⚠️ ')}</div>` : '<div class="ok-box">✅ Kitchen ready to open.</div>'}
      ${news.length ? `<div class="card">${news.map((n) => `✨ ${n}`).join('<br>')}</div>` : ''}
      ${venues.length > 1 ? `<div class="sec"><h3>Location</h3><div class="seg">${venues.map((v) => `<button data-venue="${v}" class="${save.venue === v ? 'on' : ''}">${v === 'truck' ? '🚚' : '🏠'} ${VENUES[v].name}</button>`).join('')}</div></div>` : ''}
      <div class="sec"><h3>Today's event</h3>
        ${choices.map((id) => {
          const e = EVENTS[id];
          return `<div class="card event-card ${save.event === id ? 'on' : ''}" data-event="${id}"><div class="row"><div class="big">${e.emoji}</div>
            <div class="grow"><div class="name">${e.name}</div><div class="desc">${e.desc}</div><span class="pill good">${e.reward}</span></div></div></div>`;
        }).join('')}
      </div>
      <div class="sec"><h3>Forecast</h3><div class="card">
        <span class="pill">⏱ ${cfg.length}s shift</span><span class="pill">🪑 ${cfg.seats} spots</span>
        <span class="pill">👥 ~${expected} customers</span><span class="pill">🎯 Goal ${money(cfg.goal)}</span>
        <span class="pill bad">🏠 Rent ${money(cfg.rent)}</span>${cfg.wages ? `<span class="pill bad">👥 Wages ${money(cfg.wages)}</span>` : ''}
        ${save.nextBoost > 1 ? '<span class="pill good">📸 Viral boost +30%</span>' : ''}
        <div class="row" style="margin-top:8px"><div class="grow"><div class="name">📣 Flyers</div><div class="desc">+30% customers today for $30.</div></div>
        <button class="buy ${save.marketing ? 'red' : ''}" data-marketing="1">${save.marketing ? 'Cancel' : '$30'}</button></div>
      </div></div>
      <div class="sec"><h3>Restaurant rank</h3><div class="card">
        <div class="name">⭐ ${rank.name}</div>
        ${next ? `<div class="desc">Next: ${next[1]} at ${money(next[0])} lifetime sales (${money(save.lifetime.earned)})</div><div class="progress"><i style="width:${pct}%"></i></div>` : '<div class="desc">Top rank reached!</div>'}
      </div></div>
      ${wk ? `<div class="sec"><h3>Weekly challenge</h3><div class="card"><div class="name">${wk.done ? '✅' : '🗓'} Serve ${wk.target} ${RECIPES[wk.recipe].emoji} ${RECIPES[wk.recipe].name} by day ${wk.endDay}</div>
        <div class="desc">${Math.min(wk.progress, wk.target)}/${wk.target} · reward ${money(wk.reward)}${save.menu.some((m) => m.id === wk.recipe) ? '' : ' · not on your menu!'}</div>
        <div class="progress"><i style="width:${Math.min(100, (wk.progress / wk.target) * 100)}%"></i></div></div></div>` : ''}`;
  }

  function menuTab(save) {
    const slots = menuSlots(save);
    const on = new Map(save.menu.map((m) => [m.id, m]));
    const known = RECIPE_LIST.filter((r) => save.known.includes(r.id));
    const unknown = RECIPE_LIST.filter((r) => !save.known.includes(r.id));
    return `<div class="muted" style="margin-bottom:8px">Menu ${save.menu.length}/${slots} dishes. Bargain prices bring more (and more patient) customers; Premium earns more per plate.</div>
      ${known.map((r) => {
        const m = on.get(r.id);
        const needs = recipeNeeds(r).stations.filter((s) => s !== 'plate').map((s) => STATIONS[s].emoji).join('');
        return `<div class="card"><div class="row"><div style="font-size:26px">${r.emoji}</div><div class="grow">
          <div class="name">${r.name} ${r.veg ? '🌱' : ''}</div>
          <div class="desc">${r.parts.map(howToText).join(' + ')} · needs ${needs || '—'}</div></div>
          <button class="buy ${m ? 'red' : ''}" data-menu="${r.id}">${m ? 'Remove' : 'Add'}</button></div>
          ${m ? `<div class="seg">${Object.entries(PRICE_TIERS).map(([id, t]) => `<button data-tier="${r.id}:${id}" class="${m.tier === id ? 'on' : ''}">${t.name} ${money(Math.round(r.price * t.mult))}</button>`).join('')}</div>` : ''}
        </div>`;
      }).join('')}
      <div class="sec" style="margin-top:12px"><h3>Learn recipes</h3>
      ${unknown.map((r) => {
        const locked = r.unlock > save.day;
        return `<div class="card ${locked ? 'lock' : ''}"><div class="row"><div style="font-size:26px">${r.emoji}</div><div class="grow">
          <div class="name">${r.name} · ${money(r.price)}</div><div class="desc">${r.parts.map(howToText).join(' + ')}</div></div>
          <button class="buy" data-learn="${r.id}" ${locked || save.money < r.learn ? 'disabled' : ''}>${locked ? `Day ${r.unlock}` : money(r.learn)}</button></div></div>`;
      }).join('') || '<p class="muted">You know every recipe!</p>'}</div>`;
  }

  function stockTab(save) {
    const raws = neededRaws(save);
    const used = new Set(save.menu.flatMap((m) => recipeNeeds(RECIPES[m.id]).raws));
    if (save.day >= SPICY_DAY) used.add('chili');
    return `<div class="muted" style="margin-bottom:8px">Buy ingredients before opening. Out of stock mid-shift = rush delivery at ${EMERGENCY_MULT}× price. Some items spoil overnight (a Walk-in Fridge helps).</div>
      <button class="btn small primary" data-autostock="1" style="margin-bottom:10px">⚡ Auto-stock for today's menu</button>
      ${raws.map((k) => {
        const it = ITEMS[k];
        const n = save.stock[k] || 0;
        return `<div class="card ${used.has(k) ? '' : 'lock'}"><div class="row"><div style="font-size:24px">${it.emoji}</div><div class="grow">
          <div class="name">${it.name} <span class="pill ${n < 5 && used.has(k) ? 'bad' : ''}">${n} in stock</span></div>
          <div class="desc">${money(it.cost)} each${it.spoil ? ` · spoils ${Math.round(it.spoil * 100)}%/night` : ' · keeps'}${used.has(k) ? '' : ' · not on menu'}</div></div></div>
          <div class="stepper" style="margin-top:6px"><button data-sell="${k}">−5</button><div class="grow"></div>
          <button data-stock="${k}:5">+5</button><button data-stock="${k}:10">+10</button><button data-stock="${k}:20">+20</button></div></div>`;
      }).join('')}`;
  }

  function shopTab(save) {
    const vs = vstate(save);
    const venue = VENUES[save.venue];
    const equip = BUYABLE_STATIONS.map((t) => {
      const d = STATIONS[t];
      const have = stationCount(vs, t);
      const locked = d.unlock > save.day;
      const maxed = have >= d.max;
      return `<div class="card ${locked ? 'lock' : ''}"><div class="row"><div style="font-size:24px">${d.emoji}</div><div class="grow">
        <div class="name">${d.name} <span class="pill">${have}/${d.max}</span></div><div class="desc">Placed automatically — rearrange in 🛠 Kitchen.</div></div>
        <button class="buy" data-station="${t}" ${locked || maxed || save.money < d.cost ? 'disabled' : ''}>${locked ? `Day ${d.unlock}` : maxed ? 'MAX' : money(d.cost)}</button></div></div>`;
    }).join('');
    const ups = UPGRADES.filter((u) => !u.venue || u.venue === save.venue || save.upgrades[u.id]).map((u) => {
      const lvl = save.upgrades[u.id] || 0;
      const maxed = lvl >= u.costs.length;
      const locked = u.unlock > save.day;
      const cost = u.costs[lvl];
      return `<div class="card ${locked ? 'lock' : ''}"><div class="row"><div class="grow">
        <div class="name">${u.name} <span class="pill">${'■'.repeat(lvl)}${'□'.repeat(u.costs.length - lvl)}</span></div><div class="desc">${u.desc}</div></div>
        <button class="buy" data-upgrade="${u.id}" ${locked || maxed || save.money < cost ? 'disabled' : ''}>${locked ? `Day ${u.unlock}` : maxed ? 'MAX' : money(cost)}</button></div></div>`;
    }).join('');
    const truck = VENUES.truck;
    const truckCard = save.venues.truck
      ? '<div class="card"><div class="name">🚚 Food Truck — owned</div><div class="desc">Switch locations on the Plan tab. Tips +35%, lots of rushed customers, cramped kitchen.</div></div>'
      : `<div class="card ${save.day < truck.unlock ? 'lock' : ''}"><div class="row"><div style="font-size:24px">🚚</div><div class="grow"><div class="name">Food Truck</div>
        <div class="desc">A second location: tiny kitchen, rushed crowds, +35% tips, cheaper rent.</div></div>
        <button class="buy" data-truck="1" ${save.day < truck.unlock || save.money < truck.cost ? 'disabled' : ''}>${save.day < truck.unlock ? `Day ${truck.unlock}` : money(truck.cost)}</button></div></div>`;
    return `<div class="sec"><h3>Equipment · ${venue.name}</h3>${equip}</div>
      <div class="sec"><h3>Upgrades</h3>${ups}</div>
      <div class="sec"><h3>Expansion</h3>${truckCard}</div>`;
  }

  function staffTab(save) {
    return `<div class="muted" style="margin-bottom:8px">Staff help during service. Hiring costs a one-time fee; wages are paid at the end of every day.</div>
      ${STAFF.map((s) => {
        const hired = !!save.staff[s.id];
        const locked = s.unlock > save.day;
        return `<div class="card ${locked ? 'lock' : ''}"><div class="row"><div style="font-size:26px">${s.emoji}</div><div class="grow">
          <div class="name">${s.name} ${hired ? '<span class="pill good">Hired</span>' : ''}</div><div class="desc">${s.desc}</div>
          <div class="desc">Wage ${money(s.wage)}/day${hired ? '' : ` · hire fee ${money(s.fee)}`}</div></div>
          <button class="buy ${hired ? 'red' : ''}" data-hire="${s.id}" ${locked || (!hired && save.money < s.fee) ? 'disabled' : ''}>${locked ? `Day ${s.unlock}` : hired ? 'Let go' : 'Hire'}</button></div></div>`;
      }).join('')}`;
  }

  function goalsTab(save) {
    const rank = rankFor(save.lifetime.earned);
    const done = MILESTONES.filter((m) => save.milestones[m.id]).length;
    const starTotal = Object.values(save.stars).reduce((a, b) => a + b, 0);
    return `<div class="card"><div class="name">⭐ ${rank.name}</div><div class="desc">Lifetime sales ${money(save.lifetime.earned)} · ${save.lifetime.served} dishes · ${starTotal}★ earned</div></div>
      <div class="sec" style="margin-top:10px"><h3>Milestones ${done}/${MILESTONES.length}</h3>
      ${MILESTONES.map((m) => `<div class="card ${save.milestones[m.id] ? '' : 'lock'}"><div class="row"><div>${save.milestones[m.id] ? '✅' : '🏆'}</div>
        <div class="grow"><div class="name">${m.name}</div><div class="desc">${m.desc}</div></div><span class="pill good">${money(m.reward)}</span></div></div>`).join('')}</div>`;
  }

  function render() {
    const save = getSave();
    if (tab === 'report' && !save.lastReport) tab = 'plan';
    $('plan-title').textContent = save.day > CAREER_DAYS ? `Day ${save.day} · Free Play` : `Day ${save.day} of ${CAREER_DAYS}`;
    $('plan-money').textContent = money(save.money);
    renderTabs();
    const body = { report: reportTab, plan: planTab, menu: menuTab, stock: stockTab, shop: shopTab, staff: staffTab, goals: goalsTab }[tab](save);
    const el = $('plan-body');
    const keep = el.dataset.tab === tab ? el.scrollTop : 0;
    el.innerHTML = body;
    el.dataset.tab = tab;
    el.scrollTop = keep;
    const warn = planWarnings(save);
    const blocking = !save.menu.length;
    $('btn-open').disabled = blocking;
    $('btn-open').textContent = `Open Day ${save.day} ▶${warn.length ? ' ⚠️' : ''}`;
  }

  $('plan-tabs').addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (!t) return;
    tab = t.dataset.tab;
    sfx('tap');
    render();
  });

  $('plan-body').addEventListener('click', (e) => {
    const el = e.target.closest('[data-event],[data-marketing],[data-venue],[data-menu],[data-tier],[data-learn],[data-stock],[data-sell],[data-autostock],[data-station],[data-upgrade],[data-truck],[data-hire]');
    if (!el || el.disabled) return;
    const d = el.dataset;
    const save = getSave();
    if (d.event) {
      save.event = d.event;
      sfx('tap');
      writeSave(save);
      render();
    } else if (d.marketing) act(actions.toggleMarketing);
    else if (d.venue) {
      if (act(actions.setVenue, d.venue)) onVenueChange();
    } else if (d.menu) act(actions.toggleMenu, d.menu);
    else if (d.tier) act(actions.setTier, ...d.tier.split(':'));
    else if (d.learn) {
      if (act(actions.learnRecipe, d.learn)) onVenueChange();
    } else if (d.stock) {
      const [k, n] = d.stock.split(':');
      act(actions.buyStock, k, Number(n));
    } else if (d.sell) act(actions.sellStock, d.sell, 5);
    else if (d.autostock) act(actions.autoStock);
    else if (d.station) {
      if (act(actions.buyStation, d.station)) onVenueChange();
    } else if (d.upgrade) {
      if (act(actions.buyUpgrade, d.upgrade)) onVenueChange();
    } else if (d.truck) {
      if (act(actions.buyTruck)) toast('🚚 Food Truck bought! Switch to it on the Plan tab.', 'good');
    } else if (d.hire) act(actions.hire, d.hire);
  });

  $('btn-open').addEventListener('click', () => onOpen());
  $('btn-kitchen').addEventListener('click', () => onKitchen());

  return {
    show(startTab) {
      if (startTab) tab = startTab;
      render();
    },
    render,
  };
}

export { seatCount, DISHES_DAY };
