// Three.js kitchen: builds the 3D world from the venue + layout and mirrors
// game state into meshes each frame.
import * as THREE from 'three';
import { CUSTOMERS } from './data.js';
import { cellPos, occupancy, freeNeighbors } from './layout.js';

const C = {
  floorA: 0xf3e9d8, floorB: 0xe2d3bb, dining: 0xb9855a, wall: 0xf7d9b0,
  counter: 0xe9edf2, counterTop: 0x5b6b7c, wood: 0xc28a4e, woodDark: 0x8a5a2e,
  steel: 0xb8c2cc, stove: 0x2e3440, plate: 0xffffff, bell: 0xf2c14e,
};

const matCache = new Map();
const mat = (color, extra) => {
  if (extra) return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...extra });
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05 }));
  return matCache.get(color);
};
const box = (w, h, d, color, extra) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, extra));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
const cyl = (rt, rb, h, color, seg = 20, extra) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color, extra));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
const sphere = (r, color, extra) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), mat(color, extra));
  m.castShadow = true;
  return m;
};

const cached = new Set();
function disposeTree(obj) {
  if (cached.size !== matCache.size) matCache.forEach((m) => cached.add(m));
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && !cached.has(o.material)) o.material.dispose();
  });
}

// ---------- food meshes ----------

export function makeItem(kind) {
  const g = new THREE.Group();
  switch (kind) {
    case 'bread': {
      const b = box(0.46, 0.2, 0.32, 0xe0b36a);
      b.position.y = 0.1;
      const top = cyl(0.16, 0.16, 0.46, 0xd49a4a);
      top.rotation.z = Math.PI / 2;
      top.position.y = 0.2;
      g.add(b, top);
      break;
    }
    case 'toast': {
      const b = box(0.4, 0.08, 0.4, 0xb8742e);
      b.position.y = 0.04;
      const crust = box(0.44, 0.07, 0.44, 0x7a4518);
      crust.position.y = 0.03;
      g.add(crust, b);
      break;
    }
    case 'lettuce': {
      const s = sphere(0.22, 0x6cc24a);
      s.scale.set(1, 0.85, 1);
      s.position.y = 0.19;
      const s2 = sphere(0.16, 0x9be071);
      s2.position.set(0.05, 0.3, 0.04);
      g.add(s, s2);
      break;
    }
    case 'lettuce_chopped': {
      for (let i = 0; i < 7; i++) {
        const p = box(0.12, 0.04, 0.12, i % 2 ? 0x6cc24a : 0x9be071);
        p.position.set(Math.cos(i * 2.4) * 0.14, 0.03 + (i % 3) * 0.03, Math.sin(i * 2.4) * 0.14);
        p.rotation.y = i;
        g.add(p);
      }
      break;
    }
    case 'tomato': {
      const s = sphere(0.19, 0xe23b2e);
      s.scale.set(1, 0.88, 1);
      s.position.y = 0.17;
      const st = cyl(0.02, 0.03, 0.08, 0x3f8f2f, 6);
      st.position.y = 0.36;
      g.add(s, st);
      break;
    }
    case 'tomato_chopped': {
      for (let i = 0; i < 5; i++) {
        const p = cyl(0.09, 0.09, 0.05, 0xe23b2e, 12);
        p.position.set(Math.cos(i * 1.26) * 0.13, 0.03 + (i % 2) * 0.03, Math.sin(i * 1.26) * 0.13);
        g.add(p);
      }
      break;
    }
    case 'patty': {
      const p = cyl(0.2, 0.2, 0.09, 0xd9606a);
      p.position.y = 0.05;
      g.add(p);
      break;
    }
    case 'patty_cooked': {
      const p = cyl(0.2, 0.2, 0.09, 0x6b3a1f);
      p.position.y = 0.05;
      g.add(p);
      break;
    }
    case 'soup': {
      const bowl = cyl(0.24, 0.15, 0.18, 0xf5f5f5);
      bowl.position.y = 0.09;
      const s = cyl(0.21, 0.21, 0.02, 0xd9481f);
      s.position.y = 0.17;
      g.add(bowl, s);
      break;
    }
    case 'potato': {
      const s = sphere(0.18, 0xb58a52);
      s.scale.set(1.3, 0.85, 1);
      s.position.y = 0.15;
      g.add(s);
      break;
    }
    case 'potato_cut': {
      for (let i = 0; i < 8; i++) {
        const p = box(0.05, 0.05, 0.3, 0xf1e3a8);
        p.position.set((i % 4) * 0.07 - 0.1, 0.03 + Math.floor(i / 4) * 0.05, 0);
        p.rotation.y = (i - 4) * 0.08;
        g.add(p);
      }
      break;
    }
    case 'fries': {
      const cup = cyl(0.16, 0.12, 0.24, 0xd63a2f, 12);
      cup.position.y = 0.12;
      g.add(cup);
      for (let i = 0; i < 9; i++) {
        const f = box(0.04, 0.24, 0.04, 0xf6c343);
        f.position.set(Math.cos(i * 0.7) * 0.08, 0.3, Math.sin(i * 0.7) * 0.08);
        f.rotation.z = (i % 3 - 1) * 0.15;
        g.add(f);
      }
      break;
    }
    case 'fish': {
      const b = sphere(0.18, 0x7b9bb5);
      b.scale.set(1.6, 0.6, 0.8);
      b.position.y = 0.11;
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.18, 4), mat(0x5f7f99));
      tail.rotation.z = Math.PI / 2;
      tail.position.set(-0.34, 0.11, 0);
      g.add(b, tail);
      break;
    }
    case 'fish_fried': {
      const b = sphere(0.18, 0xd99a3c);
      b.scale.set(1.7, 0.6, 0.9);
      b.position.y = 0.1;
      g.add(b);
      break;
    }
    case 'chili': {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.36, 10), mat(0xd6261e));
      c.rotation.z = Math.PI / 2.4;
      c.position.y = 0.08;
      const st = cyl(0.02, 0.02, 0.06, 0x3f8f2f, 6);
      st.position.set(0.17, 0.14, 0);
      g.add(c, st);
      break;
    }
    case 'chili_chopped': {
      for (let i = 0; i < 6; i++) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.015, 6, 10), mat(0xd6261e));
        r.rotation.x = Math.PI / 2;
        r.position.set(Math.cos(i) * 0.09, 0.03, Math.sin(i) * 0.09);
        g.add(r);
      }
      break;
    }
    case 'burnt': {
      const s = sphere(0.2, 0x1d1d1d);
      s.scale.set(1.1, 0.55, 1);
      s.position.y = 0.1;
      g.add(s);
      break;
    }
  }
  return g;
}

export function makePlate(contents, dirty = false) {
  const g = new THREE.Group();
  const plate = cyl(0.36, 0.3, 0.05, dirty ? 0xc9b89a : C.plate, 28);
  plate.position.y = 0.025;
  g.add(plate);
  const isBurger = contents.includes('bread') && contents.includes('patty_cooked');
  const chili = contents.includes('chili_chopped');
  if (isBurger) {
    let y = 0.05;
    const bottom = box(0.4, 0.08, 0.4, 0xe0b36a);
    bottom.position.y = y + 0.04;
    g.add(bottom);
    y += 0.08;
    for (const k of ['patty_cooked', 'lettuce_chopped', 'chili_chopped']) {
      if (!contents.includes(k)) continue;
      const m = makeItem(k);
      m.position.y = y;
      g.add(m);
      y += k === 'patty_cooked' ? 0.09 : 0.06;
    }
    const bun = sphere(0.22, 0xd49a4a);
    bun.scale.set(1, 0.5, 1);
    bun.position.y = y + 0.02;
    g.add(bun);
  } else {
    const main = contents.filter((k) => k !== 'chili_chopped');
    main.forEach((k, i) => {
      const m = makeItem(k);
      const n = main.length;
      m.scale.setScalar(n > 2 ? 0.55 : n > 1 ? 0.7 : 0.9);
      const a = (i / n) * Math.PI * 2;
      m.position.set(n > 1 ? Math.cos(a) * 0.14 : 0, 0.05, n > 1 ? Math.sin(a) * 0.12 : 0);
      g.add(m);
    });
    if (chili) {
      const m = makeItem('chili_chopped');
      m.position.y = 0.18;
      m.scale.setScalar(0.8);
      g.add(m);
    }
  }
  return g;
}

function makeHeld(hand) {
  if (!hand) return null;
  return hand.kind === 'plate' ? makePlate(hand.contents) : makeItem(hand.kind);
}

// ---------- characters ----------

function makePerson(bodyColor, opts = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.5, 6, 14), mat(bodyColor));
  body.position.y = 0.6;
  body.castShadow = true;
  const head = sphere(0.24, opts.skin ?? 0xf1c9a5);
  head.position.y = 1.25;
  for (const x of [-0.08, 0.08]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat(0x222222));
    e.position.set(x, 1.28, 0.21);
    g.add(e);
  }
  g.add(body, head);
  g.userData.body = body;
  return g;
}

function makeChef() {
  const g = makePerson(0xffffff, { skin: 0xe8b88f });
  const hatBase = cyl(0.2, 0.2, 0.14, 0xffffff);
  hatBase.position.y = 1.47;
  const puff = sphere(0.24, 0xffffff);
  puff.scale.set(1, 0.75, 1);
  puff.position.y = 1.64;
  const scarf = cyl(0.2, 0.26, 0.08, 0xe0473c);
  scarf.position.y = 1.02;
  const apron = box(0.42, 0.5, 0.05, 0x3b6ea5);
  apron.position.set(0, 0.55, 0.26);
  g.add(hatBase, puff, scarf, apron);
  const hands = new THREE.Group();
  hands.position.set(0, 0.95, 0.45);
  g.add(hands);
  g.userData.hands = hands;
  return g;
}

function makeStaff(color) {
  const g = makePerson(color, { skin: 0xd8a47f });
  g.scale.setScalar(0.85);
  const cap = sphere(0.25, color);
  cap.scale.set(1, 0.4, 1);
  cap.position.y = 1.38;
  g.add(cap);
  return g;
}

const SKINS = [0xf1c9a5, 0xd8a47f, 0xa26f4b, 0x6e4a33, 0xffdcb8];
function makeOnePerson(typeId) {
  const t = CUSTOMERS[typeId];
  const g = makePerson(t.color, { skin: SKINS[Math.floor(Math.random() * SKINS.length)] });
  if (typeId === 'critic') {
    const brim = cyl(0.3, 0.3, 0.03, 0x1b1b1b);
    brim.position.y = 1.44;
    const top = cyl(0.18, 0.18, 0.3, 0x1b1b1b);
    top.position.y = 1.6;
    const monocle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 16), mat(C.bell, { metalness: 0.8 }));
    monocle.position.set(0.08, 1.28, 0.23);
    g.add(brim, top, monocle);
  } else if (typeId === 'rushed') {
    const cap = sphere(0.25, 0xd9442b);
    cap.scale.set(1, 0.45, 1);
    cap.position.y = 1.38;
    const bill = box(0.26, 0.03, 0.2, 0xd9442b);
    bill.position.set(0, 1.36, 0.25);
    g.add(cap, bill);
  } else if (typeId === 'inspector') {
    const hat = cyl(0.22, 0.26, 0.12, 0x39424f);
    hat.position.y = 1.45;
    const board = box(0.26, 0.34, 0.03, 0xc28a4e);
    board.position.set(0.22, 0.8, 0.28);
    board.rotation.x = -0.4;
    const paper = box(0.22, 0.28, 0.01, 0xffffff);
    paper.position.set(0.22, 0.8, 0.3);
    paper.rotation.x = -0.4;
    g.add(hat, board, paper);
  } else if (typeId === 'influencer') {
    const hair = sphere(0.26, 0xffd35c);
    hair.scale.set(1, 0.6, 1);
    hair.position.y = 1.36;
    const phone = box(0.12, 0.2, 0.02, 0x222222);
    phone.position.set(0.22, 1.1, 0.3);
    g.add(hair, phone);
  } else {
    const hair = sphere(0.25, [0x5a3a22, 0x222222, 0xa0522d, 0xd9b36b][Math.floor(Math.random() * 4)]);
    hair.scale.set(1, 0.55, 1);
    hair.position.y = 1.36;
    g.add(hair);
  }
  return g;
}

function makeCustomer(c) {
  if (c.type !== 'group') return makeOnePerson(c.type);
  const g = new THREE.Group();
  const n = c.orders.length;
  for (let i = 0; i < n; i++) {
    const p = makeOnePerson('casual');
    p.userData.body.material = mat([0x3fa66a, 0x4f9dde, 0xe0873c][i % 3]);
    p.scale.setScalar(0.72);
    p.position.set((i - (n - 1) / 2) * 0.36, 0, i === 1 ? -0.2 : 0);
    g.add(p);
  }
  return g;
}

// ---------- station meshes ----------

function counter(topColor = C.counterTop, baseColor = C.counter) {
  const g = new THREE.Group();
  const base = box(0.94, 0.85, 0.94, baseColor);
  base.position.y = 0.425;
  const t = box(1.0, 0.08, 1.0, topColor);
  t.position.y = 0.89;
  g.add(base, t);
  return g;
}

function buildStationMesh(s) {
  let g;
  const extra = {};
  switch (s.type) {
    case 'crate': {
      g = counter();
      const crate = box(0.8, 0.3, 0.8, C.wood);
      crate.position.y = 1.08;
      g.add(crate);
      for (let i = 0; i < 3; i++) {
        const m = makeItem(s.ing);
        m.scale.setScalar(0.75);
        m.position.set(-0.2 + i * 0.2, 1.2, (i % 2) * 0.16 - 0.08);
        m.rotation.y = i;
        g.add(m);
      }
      extra.anchorY = 1.5;
      break;
    }
    case 'board': {
      g = counter();
      const board = box(0.8, 0.05, 0.6, C.wood);
      board.position.y = 0.95;
      const knife = box(0.4, 0.02, 0.06, C.steel, { metalness: 0.7, roughness: 0.3 });
      knife.position.set(0.25, 0.99, 0.28);
      knife.rotation.y = 0.4;
      g.add(board, knife);
      extra.anchorY = 0.98;
      break;
    }
    case 'burner': {
      g = counter(C.stove);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 8, 28), mat(0x111111));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.95;
      const glow = new THREE.Mesh(new THREE.CircleGeometry(0.27, 28), mat(0x331111, { emissive: 0x000000 }));
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.94;
      g.add(ring, glow);
      extra.glow = glow;
      extra.anchorY = 0.95;
      break;
    }
    case 'fryer': {
      g = counter(0x8c96a1, 0xaab4be);
      const rim = box(0.8, 0.1, 0.8, 0x6b7680, { metalness: 0.6, roughness: 0.4 });
      rim.position.y = 0.96;
      const oil = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.66), mat(0xc9962b, { emissive: 0x000000, roughness: 0.2 }));
      oil.rotation.x = -Math.PI / 2;
      oil.position.y = 1.02;
      const handle = box(0.06, 0.06, 0.4, 0x222222);
      handle.position.set(0, 1.1, 0.5);
      g.add(rim, oil, handle);
      extra.glow = oil;
      extra.anchorY = 1.0;
      break;
    }
    case 'plate': {
      g = counter(0x8fa3b5);
      extra.anchorY = 0.94;
      break;
    }
    case 'sink': {
      g = counter(0xb7c4cf);
      const basin = box(0.64, 0.06, 0.6, 0x5b6f80, { metalness: 0.5, roughness: 0.3 });
      basin.position.y = 0.91;
      const water = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.54), mat(0x9fd3f0, { transparent: true, opacity: 0.8 }));
      water.rotation.x = -Math.PI / 2;
      water.position.y = 0.945;
      const tap = cyl(0.03, 0.03, 0.35, C.steel, 8, { metalness: 0.8, roughness: 0.25 });
      tap.position.set(0, 1.1, -0.36);
      const spout = cyl(0.025, 0.025, 0.2, C.steel, 8, { metalness: 0.8, roughness: 0.25 });
      spout.rotation.x = Math.PI / 2;
      spout.position.set(0, 1.26, -0.27);
      g.add(basin, water, tap, spout);
      extra.anchorY = 0.96;
      break;
    }
    case 'trash': {
      g = new THREE.Group();
      const bin = cyl(0.38, 0.32, 0.9, 0x7c8691);
      bin.position.y = 0.45;
      const lid = cyl(0.41, 0.41, 0.06, 0x5a636d);
      lid.position.y = 0.93;
      const handle = box(0.2, 0.05, 0.05, 0x333a42);
      handle.position.y = 0.99;
      g.add(bin, lid, handle);
      extra.anchorY = 1.1;
      break;
    }
    default:
      g = counter();
      extra.anchorY = 1;
  }
  return { group: g, ...extra };
}

// ---------- the kitchen ----------

export class KitchenScene {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2b2135);
    this.scene.fog = new THREE.Fog(0x2b2135, 20, 36);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.target = new THREE.Vector3();

    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.stations = new Map();
    this.hitMeshes = [];
    this.customerMeshes = new Map();
    this.time = 0;
    this.chopAnim = 0;
    this.bounce = new Map();

    this.buildLights();
    this.roomGroup = new THREE.Group();
    this.stationGroup = new THREE.Group();
    this.gridGroup = new THREE.Group();
    this.scene.add(this.roomGroup, this.stationGroup, this.gridGroup);

    this.chef = makeChef();
    this.scene.add(this.chef);
    this.heldKey = '';

    this.staff = {
      dish: makeStaff(0x4fb3c4),
      prep: makeStaff(0x57b36b),
      runner: makeStaff(0xe0873c),
    };
    this.staffPulse = { dish: 0, prep: 0, runner: 0 };
    for (const m of Object.values(this.staff)) {
      m.visible = false;
      this.scene.add(m);
    }

    const hl = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.96), new THREE.MeshBasicMaterial({ color: 0x3fa66a, transparent: true, opacity: 0.5, depthWrite: false }));
    hl.rotation.x = -Math.PI / 2;
    hl.position.y = 0.02;
    hl.visible = false;
    this.highlight = hl;
    this.scene.add(hl);

    this.buildMode = false;
    this.selectedId = null;
  }

  buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6b5a78, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.9);
    sun.position.set(4, 10, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const s = sun.shadow.camera;
    s.left = -8; s.right = 8; s.top = 8; s.bottom = -8; s.near = 1; s.far = 30;
    sun.shadow.bias = -0.0015;
    this.scene.add(sun);
  }

  // ---------- room ----------

  setVenue(venue, { patio = false } = {}) {
    const key = `${venue.id}:${patio}`;
    if (this.venueKey === key) return;
    this.venueKey = key;
    this.venue = venue;
    disposeTree(this.roomGroup);
    this.roomGroup.clear();
    const R = this.roomGroup;
    const { cols, rows, x0, z0 } = venue;
    const xMin = x0 - 0.5;
    const xMax = x0 + cols - 0.5;
    const zMax = z0 + rows - 0.5;
    this.passZ = z0 - 1.15;
    this.custZ = this.passZ - 1.15;
    const isTruck = venue.id === 'truck';

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const t = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat(isTruck ? ((c + r) & 1 ? 0xb8c2cc : 0xa3adb8) : (c + r) & 1 ? C.floorA : C.floorB));
        t.rotation.x = -Math.PI / 2;
        t.position.set(x0 + c, 0, z0 + r);
        t.receiveShadow = true;
        R.add(t);
      }
    }
    // Strip between the kitchen and the pass.
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(cols, 1.0), mat(isTruck ? 0xa3adb8 : C.floorB));
    strip.rotation.x = -Math.PI / 2;
    strip.position.set((xMin + xMax) / 2, 0, z0 - 1);
    strip.receiveShadow = true;
    R.add(strip);

    // Outside / dining floor.
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(22, 8), mat(isTruck ? 0x7f8c6a : C.dining));
    outside.rotation.x = -Math.PI / 2;
    outside.position.set(0, -0.01, this.passZ - 4);
    outside.receiveShadow = true;
    R.add(outside);

    if (isTruck) {
      // Truck body around the kitchen.
      const red = 0xd9442b;
      for (const x of [xMin - 0.1, xMax + 0.1]) {
        const w = box(0.2, 1.0, rows + 1.4, red);
        w.position.set(x, 0.5, z0 + rows / 2 - 1);
        R.add(w);
        for (const z of [z0 + 0.2, z0 + rows - 1]) {
          const wheel = cyl(0.42, 0.42, 0.3, 0x222222, 18);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(x + Math.sign(x) * 0.2, 0.3, z);
          R.add(wheel);
        }
      }
      const front = box(cols + 0.4, 0.5, 0.2, red);
      front.position.set((xMin + xMax) / 2, 0.25, zMax + 0.1);
      R.add(front);
      // Striped awning edge along the serving hatch (kept low-profile so customers stay visible).
      for (let i = 0; i < cols * 2; i++) {
        const stripe = box(0.5, 0.08, 0.25, i % 2 ? 0xffffff : 0xf2c14e);
        stripe.position.set(xMin + 0.25 + i * 0.5, 1.9, this.passZ + 0.45);
        R.add(stripe);
      }
      for (let i = 0; i < 6; i++) {
        const tree = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.6, 8), mat(0x3f8f4f));
        tree.position.set(-6 + i * 2.4, 0.8, this.passZ - 5.5 - (i % 2));
        R.add(tree);
      }
    } else {
      const back = box(22, 3, 0.3, C.wall);
      back.position.set(0, 1.5, this.passZ - 4);
      R.add(back);
      for (const x of [xMin - 0.1, xMax + 0.1]) {
        const w = box(0.2, 0.5, rows + 1.2, 0xd6c4a8);
        w.position.set(x, 0.25, z0 + rows / 2 - 1.1);
        R.add(w);
      }
      const tables = patio ? [-5.2, -3.8, 3.8, 5.2] : [-4, 4];
      for (const x of tables) {
        const top = cyl(0.55, 0.55, 0.06, C.woodDark);
        top.position.set(x, 0.75, this.passZ - 2);
        const leg = cyl(0.06, 0.06, 0.75, 0x444444);
        leg.position.set(x, 0.37, this.passZ - 2);
        R.add(top, leg);
        if (patio) {
          const pole = cyl(0.03, 0.03, 1.6, 0xeeeeee, 6);
          pole.position.set(x, 1.5, this.passZ - 2);
          const umb = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.4, 10), mat(Math.abs(x) > 4.5 ? 0xe0473c : 0x3fa66a));
          umb.position.set(x, 2.3, this.passZ - 2);
          R.add(pole, umb);
        }
      }
      if (patio) {
        for (let i = 0; i < 10; i++) {
          const bush = sphere(0.3, 0x4f9d4f);
          bush.position.set(-6.5 + i * 1.45, 0.25, this.passZ - 3.6);
          R.add(bush);
        }
      }
    }

    // Serve pass.
    const pass = new THREE.Group();
    pass.position.set((xMin + xMax) / 2, 0, this.passZ);
    const base = box(cols - 0.2, 1.0, 0.5, isTruck ? 0xd9442b : 0xb05a3c);
    base.position.y = 0.5;
    const top = box(cols, 0.08, 0.7, 0xe9edf2);
    top.position.y = 1.04;
    const bell = sphere(0.12, C.bell, { metalness: 0.8, roughness: 0.25 });
    bell.scale.set(1, 0.8, 1);
    bell.position.set(cols / 2 - 0.6, 1.17, 0);
    pass.add(base, top, bell);
    if (!isTruck) {
      for (const x of [-(cols / 2) + 1.2, 0, cols / 2 - 1.2]) {
        const lamp = cyl(0.12, 0.22, 0.18, 0xf2a33a);
        lamp.position.set(x, 2.1, 0);
        const cord = cyl(0.01, 0.01, 0.8, 0x222222, 4);
        cord.position.set(x, 2.6, 0);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
        bulb.position.set(x, 2.0, 0);
        pass.add(lamp, cord, bulb);
      }
    }
    R.add(pass);
    this.passHit = new THREE.Mesh(new THREE.BoxGeometry(cols, 1.4, 0.9), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    this.passHit.position.set((xMin + xMax) / 2, 0.7, this.passZ);
    this.passHit.userData.stationId = 'serve';
    R.add(this.passHit);
    this.passAnchor = new THREE.Vector3((xMin + xMax) / 2, 1.1, this.passZ);

    // Build-mode grid lines.
    this.gridGroup.clear();
    const lineMat = new THREE.LineBasicMaterial({ color: 0x3fa66a, transparent: true, opacity: 0.8 });
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.94, 0.94)), lineMat);
        e.rotation.x = -Math.PI / 2;
        e.position.set(x0 + c, 0.015, z0 + r);
        this.gridGroup.add(e);
      }
    }
    this.gridGroup.visible = this.buildMode;
    this.resize();
  }

  // ---------- stations ----------

  setLayout(layout) {
    disposeTree(this.stationGroup);
    this.stationGroup.clear();
    this.stations.clear();
    this.hitMeshes = [this.passHit];
    this.layout = layout;
    this.occ = occupancy(this.venue, layout);
    for (const s of layout) {
      const { x, z } = cellPos(this.venue, s.c, s.r);
      const built = buildStationMesh(s);
      const g = built.group;
      g.position.set(x, 0, z);
      this.stationGroup.add(g);
      const hit = new THREE.Mesh(new THREE.BoxGeometry(1, 1.3, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      hit.position.set(x, 0.65, z);
      hit.userData.stationId = s.id;
      this.stationGroup.add(hit);
      this.hitMeshes.push(hit);
      const slot = new THREE.Group();
      slot.position.set(x, built.anchorY, z);
      this.stationGroup.add(slot);
      this.stations.set(s.id, {
        def: s, group: g, slot, glow: built.glow, key: null,
        anchor: new THREE.Vector3(x, built.anchorY, z), base: new THREE.Vector3(x, 0, z),
      });
    }
    this.placeStaff();
  }

  // Put staff next to the station they work at.
  placeStaff() {
    const spotNear = (type, fallback) => {
      const s = this.layout.find((x) => x.type === type);
      if (!s) return fallback;
      const n = freeNeighbors(this.venue, this.occ, s.c, s.r)[0];
      if (!n) return fallback;
      const p = cellPos(this.venue, n[0], n[1]);
      const q = cellPos(this.venue, s.c, s.r);
      return { x: p.x + (q.x - p.x) * 0.15 + 0.25, z: p.z + (q.z - p.z) * 0.15 + 0.25, face: q };
    };
    const v = this.venue;
    this.staffSpots = {
      dish: spotNear('sink', { x: v.x0, z: v.z0 + v.rows - 1 }),
      prep: spotNear('board', { x: v.x0, z: v.z0 + v.rows - 1 }),
      runner: { x: v.x0 + v.cols - 1 - 0.1, z: v.z0 - 0.75, face: { x: v.x0 + v.cols - 1, z: this.passZ } },
    };
  }

  // ---------- camera & picking ----------

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.viewW = w;
    this.viewH = h;
    if (!this.venue) return;
    const v = this.venue;
    const front = v.z0 + v.rows - 0.3;
    const back = this.custZ - 0.4;
    const halfW = v.cols / 2 + 0.55;
    const halfH = (front - back) / 2 + 1.4;
    const cx = v.x0 + (v.cols - 1) / 2;
    this.target.set(cx, 0, (front + back) / 2 + (aspect < 0.8 ? -2.1 : 0.1));
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const dist = Math.max(halfH / tanV, halfW / (tanV * aspect));
    const dir = new THREE.Vector3(0, 0.86, 0.52).normalize();
    this.camera.position.copy(this.target).addScaledVector(dir, dist);
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
  }

  ray(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
  }

  pick(clientX, clientY) {
    this.ray(clientX, clientY);
    const hits = this.raycaster.intersectObjects(this.hitMeshes, false);
    return hits.length ? hits[0].object.userData.stationId : null;
  }

  pickCell(clientX, clientY) {
    this.ray(clientX, clientY);
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, p)) return null;
    const c = Math.round(p.x - this.venue.x0);
    const r = Math.round(p.z - this.venue.z0);
    if (c < 0 || r < 0 || c >= this.venue.cols || r >= this.venue.rows) return null;
    return [c, r];
  }

  project(v) {
    const p = v.clone().project(this.camera);
    return { x: ((p.x + 1) / 2) * this.viewW, y: ((1 - p.y) / 2) * this.viewH };
  }

  stationAnchor(id) {
    if (id === 'serve') return this.passAnchor;
    return this.stations.get(id)?.anchor;
  }

  customerHead(id) {
    const m = this.customerMeshes.get(id);
    return m ? m.position.clone().add(new THREE.Vector3(0, 1.95, 0)) : null;
  }

  slotX(slot, seats) {
    const v = this.venue;
    const cx = v.x0 + (v.cols - 1) / 2;
    const spacing = Math.min(1.25, (v.cols - 2) / Math.max(1, seats - 1));
    return cx + (slot - (seats - 1) / 2) * spacing;
  }

  playChop() {
    this.chopAnim = 0.2;
  }

  pulse(id) {
    if (this.stations.has(id)) this.bounce.set(id, 0.25);
  }

  // ---------- build mode ----------

  setBuildMode(on) {
    this.buildMode = on;
    this.gridGroup.visible = on;
    this.highlight.visible = false;
    this.chef.visible = !on;
    for (const m of Object.values(this.staff)) if (on) m.visible = false;
    for (const m of this.customerMeshes.values()) this.scene.remove(m);
    this.customerMeshes.clear();
    this.selectedId = null;
  }

  // Show the hovered/target cell: green if OK, red if not.
  showCell(cell, ok) {
    if (!cell) {
      this.highlight.visible = false;
      return;
    }
    const p = cellPos(this.venue, cell[0], cell[1]);
    this.highlight.position.set(p.x, 0.02, p.z);
    this.highlight.material.color.setHex(ok ? 0x3fa66a : 0xd64040);
    this.highlight.visible = true;
  }

  syncBuild(dt) {
    this.time += dt;
    for (const [id, s] of this.stations) {
      const lifted = id === this.selectedId;
      s.group.position.y = lifted ? 0.3 + Math.sin(this.time * 6) * 0.05 : 0;
      s.slot.position.y = s.anchor.y + s.group.position.y;
    }
  }

  // ---------- per-frame sync with the game ----------

  sync(game, dt) {
    this.time += dt;
    const setSlot = (s, key, build) => {
      if (s.key === key) return;
      s.key = key;
      disposeTree(s.slot);
      s.slot.clear();
      const m = build();
      if (m) s.slot.add(m);
    };

    for (const [id, vis] of this.stations) {
      const st = game.stations.get(id);
      if (!st) continue;
      switch (st.type) {
        case 'board':
          setSlot(vis, st.item || '', () => (st.item ? makeItem(st.item) : null));
          break;
        case 'burner':
        case 'fryer': {
          setSlot(vis, st.item || '', () => (st.item ? makeItem(st.item) : null));
          const hot = !!st.item && !st.off;
          const flicker = hot ? 0.6 + Math.sin(this.time * 12 + vis.anchor.x) * 0.15 : 0;
          const col = st.type === 'fryer' ? (st.state === 'done' ? 0xffb000 : 0xff8a00) : st.state === 'done' ? 0xff7a00 : st.state === 'burnt' ? 0x550000 : 0xff2a00;
          vis.glow.material.emissive.setHex(col);
          vis.glow.material.emissiveIntensity = st.type === 'fryer' ? flicker * 0.5 : flicker;
          vis.slot.position.x = vis.anchor.x + (st.state === 'done' ? Math.sin(this.time * 40) * 0.02 : 0);
          vis.slot.position.y = vis.anchor.y + (st.type === 'fryer' && st.state === 'cooking' ? -0.08 + Math.sin(this.time * 20) * 0.01 : 0);
          break;
        }
        case 'plate':
          setSlot(vis, st.plate ? `p:${st.plate.contents.join(',')}` : '', () => (st.plate ? makePlate(st.plate.contents) : null));
          break;
        case 'sink':
          setSlot(vis, `d:${Math.min(st.dirty, 5)}`, () => {
            if (!st.dirty) return null;
            const g = new THREE.Group();
            for (let i = 0; i < Math.min(st.dirty, 5); i++) {
              const p = makePlate([], true);
              p.position.set(0.18, 0.05 + i * 0.06, 0.1);
              p.scale.setScalar(0.7);
              g.add(p);
            }
            return g;
          });
          break;
      }
    }

    // Tap bounce.
    for (const [id, t] of this.bounce) {
      const s = this.stations.get(id);
      const nt = t - dt;
      const k = nt > 0 ? 1 + Math.sin((nt / 0.25) * Math.PI) * 0.06 : 1;
      if (s) s.group.scale.setScalar(k);
      if (nt <= 0) this.bounce.delete(id);
      else this.bounce.set(id, nt);
    }

    this.syncChef(game, dt);
    this.syncStaff(game, dt);
    this.syncCustomers(game, dt);
  }

  syncChef(game, dt) {
    const chef = this.chef;
    const ch = game.chef;
    const moving = ch.path.length > 0;
    chef.position.x = ch.x;
    chef.position.z = ch.z;
    let want = chef.rotation.y;
    if (moving && ch.dir != null) want = ch.dir;
    else if (ch.face) want = Math.atan2(ch.face.x - ch.x, ch.face.z - ch.z);
    chef.rotation.y = lerpAngle(chef.rotation.y, want, Math.min(1, dt * 14));
    chef.position.y = moving ? Math.abs(Math.sin(this.time * 16)) * 0.08 : 0;
    this.chopAnim = Math.max(0, this.chopAnim - dt);
    chef.userData.body.rotation.x = this.chopAnim > 0 ? Math.sin((this.chopAnim / 0.2) * Math.PI) * 0.25 : 0;

    const h = game.hand;
    const key = h ? (h.kind === 'plate' ? `p:${h.contents.join(',')}` : h.kind) : '';
    if (key !== this.heldKey) {
      this.heldKey = key;
      const hands = chef.userData.hands;
      disposeTree(hands);
      hands.clear();
      const m = makeHeld(h);
      if (m) {
        m.scale.setScalar(0.85);
        hands.add(m);
      }
    }
  }

  staffEvent(id) {
    this.staffPulse[id] = 0.35;
  }

  syncStaff(game, dt) {
    for (const [id, m] of Object.entries(this.staff)) {
      const on = !!game.save.staff[id] && !this.buildMode;
      m.visible = on;
      if (!on) continue;
      const spot = this.staffSpots[id];
      m.position.set(spot.x, 0, spot.z);
      if (spot.face) m.rotation.y = Math.atan2(spot.face.x - spot.x, spot.face.z - spot.z);
      this.staffPulse[id] = Math.max(0, this.staffPulse[id] - dt);
      m.position.y = this.staffPulse[id] > 0 ? Math.sin((this.staffPulse[id] / 0.35) * Math.PI) * 0.25 : Math.abs(Math.sin(this.time * 3 + spot.x)) * 0.03;
    }
  }

  syncCustomers(game, dt) {
    const alive = new Set();
    const seats = game.cfg.seats;
    for (const c of game.customers) {
      alive.add(c.id);
      let m = this.customerMeshes.get(c.id);
      if (!m) {
        m = makeCustomer(c);
        m.position.set(this.venue.x0 + this.venue.cols + 3, 0, this.custZ);
        this.scene.add(m);
        this.customerMeshes.set(c.id, m);
      }
      const tx = c.state === 'leaving' ? this.venue.x0 - 5 : this.slotX(c.slot, seats);
      const dx = tx - m.position.x;
      const moving = Math.abs(dx) > 0.03;
      if (moving) m.position.x += Math.sign(dx) * Math.min(Math.abs(dx), (c.state === 'leaving' ? 5 : 4.5) * dt);
      m.position.y = moving ? Math.abs(Math.sin(this.time * 14 + c.id)) * 0.1 : 0;
      const want = moving ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : 0;
      m.rotation.y = lerpAngle(m.rotation.y, want, Math.min(1, dt * 10));
      m.rotation.z = !moving && c.state === 'waiting' && c.patience / c.max < 0.3 ? Math.sin(this.time * 20) * 0.05 : 0;
    }
    for (const [id, m] of this.customerMeshes) {
      if (!alive.has(id)) {
        this.scene.remove(m);
        this.customerMeshes.delete(id);
      }
    }
  }

  clearCustomers() {
    for (const m of this.customerMeshes.values()) this.scene.remove(m);
    this.customerMeshes.clear();
  }

  // Menu backdrop: chef idles in the middle of the kitchen.
  idle(dt) {
    this.time += dt;
    if (this.venue) {
      this.chef.position.set(this.venue.x0 + (this.venue.cols - 1) / 2, Math.abs(Math.sin(this.time * 2)) * 0.05, this.venue.z0 + 1);
    }
    this.chef.rotation.y = Math.sin(this.time * 0.8) * 0.6;
    for (const m of Object.values(this.staff)) m.visible = false;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
