// Kitchen editor: move, place and store stations on the grid.
import { STATIONS, VENUES, ITEMS } from './data.js';
import { vstate, writeSave } from './game.js';
import { validateLayout, occupancy, cellKey } from './layout.js';

const $ = (id) => document.getElementById(id);

const label = (s) => (s.type === 'crate' ? `${ITEMS[s.ing].emoji} ${ITEMS[s.ing].name}` : `${STATIONS[s.type].emoji} ${STATIONS[s.type].name}`);

export function createBuilder({ scene, getSave, toast, sfx, onDone }) {
  let selected = null; // { from: 'layout'|'stored', id }

  const vs = () => vstate(getSave());
  const venue = () => VENUES[getSave().venue];

  function refresh() {
    scene.setLayout(vs().layout);
    scene.selectedId = selected?.from === 'layout' ? selected.id : null;
    const stored = vs().stored;
    $('build-palette').innerHTML = stored.length
      ? stored.map((s) => `<button class="pal ${selected?.id === s.id ? 'on' : ''}" data-pal="${s.id}">${label(s)}</button>`).join('')
      : '<div class="muted" style="color:#fff;opacity:.8;padding:6px">Stored stations appear here. Buy more in the 🛒 Shop.</div>';
    const sel = selected && [...vs().layout, ...stored].find((s) => s.id === selected.id);
    $('btn-store').disabled = !(selected?.from === 'layout' && sel && !STATIONS[sel.type].fixed);
    $('build-hint').textContent = sel
      ? selected.from === 'stored'
        ? `Tap an empty tile to place ${label(sel)}.`
        : `${label(sel)} selected — tap an empty tile to move it${STATIONS[sel.type].fixed ? '' : ', or Store it'}.`
      : 'Tap a station to pick it up, then tap an empty tile to move it. Keep walks short!';
  }

  function tryPlace(cell) {
    const state = vs();
    const layout = state.layout;
    const st = selected.from === 'layout' ? layout.find((s) => s.id === selected.id) : state.stored.find((s) => s.id === selected.id);
    if (!st) return;
    const trial = layout.filter((s) => s.id !== st.id).concat({ ...st, c: cell[0], r: cell[1] });
    const res = validateLayout(venue(), trial);
    scene.showCell(cell, res.ok);
    if (!res.ok) {
      toast(res.reason, 'bad');
      sfx('error');
      return;
    }
    state.layout = trial;
    if (selected.from === 'stored') state.stored = state.stored.filter((s) => s.id !== st.id);
    selected = null;
    sfx('place');
    writeSave(getSave());
    refresh();
  }

  function onTap(x, y) {
    const id = scene.pick(x, y);
    const layout = vs().layout;
    if (id && id !== 'serve' && layout.some((s) => s.id === id)) {
      if (selected?.id === id) selected = null;
      else selected = { from: 'layout', id };
      scene.showCell(null);
      sfx('pick');
      refresh();
      return;
    }
    const cell = scene.pickCell(x, y);
    if (!cell) return;
    const occ = occupancy(venue(), layout);
    if (occ.has(cellKey(cell[0], cell[1]))) return;
    if (!selected) {
      scene.showCell(cell, true);
      return;
    }
    tryPlace(cell);
  }

  $('build-palette').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pal]');
    if (!b) return;
    selected = selected?.id === b.dataset.pal ? null : { from: 'stored', id: b.dataset.pal };
    sfx('tap');
    refresh();
  });

  $('btn-store').addEventListener('click', () => {
    if (selected?.from !== 'layout') return;
    const state = vs();
    const st = state.layout.find((s) => s.id === selected.id);
    if (!st || STATIONS[st.type].fixed) return;
    state.layout = state.layout.filter((s) => s.id !== st.id);
    const { c, r, ...rest } = st;
    state.stored.push(rest);
    selected = null;
    sfx('trash');
    writeSave(getSave());
    refresh();
  });

  $('btn-build-done').addEventListener('click', () => {
    selected = null;
    scene.showCell(null);
    onDone();
  });

  return {
    enter() {
      selected = null;
      refresh();
    },
    onTap,
  };
}
