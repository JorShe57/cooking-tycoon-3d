// Kitchen grid: station placement, validation and chef pathfinding.
import { VENUES } from './data.js';

let uid = 0;
export const newStationId = () => `s${Date.now().toString(36)}${(uid++).toString(36)}`;

export const cellKey = (c, r) => `${c},${r}`;
export const cellPos = (venue, c, r) => ({ x: venue.x0 + c, z: venue.z0 + r });

export function defaultVenueState(venueId) {
  const v = VENUES[venueId];
  return {
    layout: v.layout.map(([type, c, r, ing]) => ({ id: newStationId(), type, c, r, ...(ing ? { ing } : {}) })),
    stored: [],
  };
}

export function occupancy(venue, layout) {
  const occ = new Map();
  for (const s of layout) occ.set(cellKey(s.c, s.r), s);
  return occ;
}

const inside = (venue, c, r) => c >= 0 && r >= 0 && c < venue.cols && r < venue.rows;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function freeNeighbors(venue, occ, c, r) {
  const out = [];
  for (const [dc, dr] of DIRS) {
    const nc = c + dc;
    const nr = r + dr;
    if (inside(venue, nc, nr) && !occ.has(cellKey(nc, nr))) out.push([nc, nr]);
  }
  return out;
}

// Free cells connected to the serve row (row 0).
export function reachableCells(venue, occ) {
  const seen = new Set();
  const queue = [];
  for (let c = 0; c < venue.cols; c++) {
    if (!occ.has(cellKey(c, 0))) {
      seen.add(cellKey(c, 0));
      queue.push([c, 0]);
    }
  }
  while (queue.length) {
    const [c, r] = queue.shift();
    for (const [nc, nr] of freeNeighbors(venue, occ, c, r)) {
      const k = cellKey(nc, nr);
      if (!seen.has(k)) {
        seen.add(k);
        queue.push([nc, nr]);
      }
    }
  }
  return seen;
}

export function validateLayout(venue, layout) {
  const occ = occupancy(venue, layout);
  if (occ.size !== layout.length) return { ok: false, reason: 'Two stations share a spot' };
  const reach = reachableCells(venue, occ);
  if (!reach.size) return { ok: false, reason: 'The chef needs room to reach the pass' };
  for (const s of layout) {
    if (!inside(venue, s.c, s.r)) return { ok: false, reason: 'Out of bounds' };
    const ok = freeNeighbors(venue, occ, s.c, s.r).some(([c, r]) => reach.has(cellKey(c, r)));
    if (!ok) return { ok: false, reason: 'That would block a station' };
  }
  return { ok: true };
}

// First spot (edges first) where a new station keeps the layout valid.
export function autoPlace(venue, layout, station) {
  const cells = [];
  for (let r = 0; r < venue.rows; r++) {
    for (let c = 0; c < venue.cols; c++) {
      const edge = c === 0 || c === venue.cols - 1 || r === venue.rows - 1;
      cells.push({ c, r, score: (edge ? 0 : 10) + (r === 0 ? 5 : 0) + Math.abs(c - (venue.cols - 1) / 2) * -0.1 });
    }
  }
  cells.sort((a, b) => a.score - b.score);
  const occ = occupancy(venue, layout);
  for (const cell of cells) {
    if (occ.has(cellKey(cell.c, cell.r))) continue;
    const trial = [...layout, { ...station, c: cell.c, r: cell.r }];
    if (validateLayout(venue, trial).ok) return { c: cell.c, r: cell.r };
  }
  return null;
}

// BFS from a cell to the nearest of `targets` (Set of cell keys). Returns cells to walk.
export function findPath(venue, occ, from, targets) {
  const startKey = cellKey(from[0], from[1]);
  if (targets.has(startKey)) return [];
  const prev = new Map([[startKey, null]]);
  const queue = [from];
  while (queue.length) {
    const [c, r] = queue.shift();
    for (const [nc, nr] of freeNeighbors(venue, occ, c, r)) {
      const k = cellKey(nc, nr);
      if (prev.has(k)) continue;
      prev.set(k, cellKey(c, r));
      if (targets.has(k)) {
        const path = [];
        let cur = k;
        while (cur && cur !== startKey) {
          path.unshift(cur.split(',').map(Number));
          cur = prev.get(cur);
        }
        return path;
      }
      queue.push([nc, nr]);
    }
  }
  return null;
}

export function accessTargets(venue, occ, stationOrServe) {
  const t = new Set();
  if (stationOrServe === 'serve') {
    for (let c = 0; c < venue.cols; c++) if (!occ.has(cellKey(c, 0))) t.add(cellKey(c, 0));
  } else {
    for (const [c, r] of freeNeighbors(venue, occ, stationOrServe.c, stationOrServe.r)) t.add(cellKey(c, r));
  }
  return t;
}

// A central reachable cell for the chef to start the day on.
export function startCell(venue, occ) {
  const reach = [...reachableCells(venue, occ)].map((k) => k.split(',').map(Number));
  const mid = [(venue.cols - 1) / 2, (venue.rows - 1) / 2];
  reach.sort((a, b) => Math.hypot(a[0] - mid[0], a[1] - mid[1]) - Math.hypot(b[0] - mid[0], b[1] - mid[1]));
  return reach[0] || [0, 0];
}
