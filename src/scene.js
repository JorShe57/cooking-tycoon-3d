// Three.js kitchen: builds the 3D world and mirrors game state into meshes.
import * as THREE from 'three';
import { CUSTOMERS } from './data.js';

const C = {
  floorA: 0xf3e9d8, floorB: 0xe2d3bb, dining: 0xb9855a, wall: 0xf7d9b0,
  counter: 0xe9edf2, counterTop: 0x5b6b7c, wood: 0xc28a4e, woodDark: 0x8a5a2e,
  steel: 0xb8c2cc, stove: 0x2e3440, plate: 0xffffff, bell: 0xf2c14e,
};

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...extra });
const box = (w, h, d, color, extra) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, extra));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
const cyl = (rt, rb, h, color, seg = 20) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
const sphere = (r, color) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), mat(color));
  m.castShadow = true;
  return m;
};

// ---------- food meshes ----------

export function makeItem(kind) {
  const g = new THREE.Group();
  switch (kind) {
    case 'bread': {
      const b = box(0.46, 0.2, 0.32, 0xe0b36a);
      b.position.y = 0.1;
      const top = cyl(0.16, 0.16, 0.46, 0xd49a4a);
      top.rotation.z = Math.PI / 2;
      top.scale.set(1, 1, 1);
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

export function makePlate(contents) {
  const g = new THREE.Group();
  const plate = cyl(0.36, 0.3, 0.05, C.plate, 28);
  plate.position.y = 0.025;
  g.add(plate);
  // Burgers stack; everything else sits side by side.
  const isBurger = contents.includes('bread') && contents.includes('patty_cooked');
  if (isBurger) {
    const order = ['bread', 'patty_cooked', 'lettuce_chopped'];
    let y = 0.05;
    const bottom = box(0.4, 0.08, 0.4, 0xe0b36a);
    bottom.position.y = y + 0.04;
    g.add(bottom);
    y += 0.08;
    for (const k of order.slice(1)) {
      if (!contents.includes(k)) continue;
      const m = makeItem(k);
      m.position.y = y;
      g.add(m);
      y += k === 'patty_cooked' ? 0.09 : 0.08;
    }
    const bun = sphere(0.22, 0xd49a4a);
    bun.scale.set(1, 0.5, 1);
    bun.position.y = y + 0.02;
    g.add(bun);
  } else {
    contents.forEach((k, i) => {
      const m = makeItem(k);
      const n = contents.length;
      m.scale.setScalar(n > 1 ? 0.7 : 0.9);
      m.position.set(n > 1 ? (i - (n - 1) / 2) * 0.22 : 0, 0.05, 0);
      g.add(m);
    });
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
  const eyeMat = mat(0x222222);
  for (const x of [-0.08, 0.08]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeMat);
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

function makeCustomer(typeId) {
  const t = CUSTOMERS[typeId];
  const skins = [0xf1c9a5, 0xd8a47f, 0xa26f4b, 0x6e4a33, 0xffdcb8];
  const g = makePerson(t.color, { skin: skins[Math.floor(Math.random() * skins.length)] });
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
  } else {
    const hair = sphere(0.25, 0x5a3a22);
    hair.scale.set(1, 0.55, 1);
    hair.position.y = 1.36;
    g.add(hair);
  }
  return g;
}

// ---------- the kitchen ----------

export const SLOT_X = [-1.8, -0.6, 0.6, 1.8];
const CUSTOMER_Z = -4.3;

export class KitchenScene {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2b2135);
    this.scene.fog = new THREE.Fog(0x2b2135, 18, 32);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.target = new THREE.Vector3(0, 0, -1.1);

    this.raycaster = new THREE.Raycaster();
    this.stations = new Map(); // id -> { group, anchor(Vector3 for items), stand(Vector3 for chef), slot(Group), key }
    this.hitMeshes = [];
    this.customerMeshes = new Map();
    this.time = 0;
    this.chopAnim = 0;
    this.bounce = new Map();

    this.buildLights();
    this.buildRoom();
    this.buildStations();

    this.chef = makeChef();
    this.chef.position.set(0, 0, 0.2);
    this.chefTarget = this.chef.position.clone();
    this.chefFace = null;
    this.scene.add(this.chef);
    this.heldKey = '';

    this.helper = makePerson(0x57b36b, { skin: 0xd8a47f });
    const band = cyl(0.25, 0.25, 0.08, 0xf2c14e);
    band.position.y = 1.4;
    this.helper.add(band);
    this.helper.position.set(2.3, 0, 0.75);
    this.helper.rotation.y = -Math.PI / 2;
    this.helper.visible = false;
    this.scene.add(this.helper);

    this.resize();
  }

  buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6b5a78, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.9);
    sun.position.set(4, 10, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const s = sun.shadow.camera;
    s.left = -7; s.right = 7; s.top = 7; s.bottom = -7; s.near = 1; s.far = 30;
    sun.shadow.bias = -0.0015;
    this.scene.add(sun);
  }

  buildRoom() {
    // Checkered kitchen floor.
    const floor = new THREE.Group();
    for (let x = -3; x < 3; x++) {
      for (let z = -3; z < 3; z++) {
        const t = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat((x + z) & 1 ? C.floorA : C.floorB));
        t.rotation.x = -Math.PI / 2;
        t.position.set(x + 0.5, 0, z + 0.5);
        t.receiveShadow = true;
        floor.add(t);
      }
    }
    this.scene.add(floor);
    // Dining area behind the pass.
    const dining = new THREE.Mesh(new THREE.PlaneGeometry(14, 5), mat(C.dining));
    dining.rotation.x = -Math.PI / 2;
    dining.position.set(0, -0.01, -5.5);
    dining.receiveShadow = true;
    this.scene.add(dining);
    const back = box(14, 3, 0.3, C.wall);
    back.position.set(0, 1.5, -7.2);
    this.scene.add(back);
    // A few decorative tables.
    for (const x of [-3.5, 3.5]) {
      const top = cyl(0.55, 0.55, 0.06, C.woodDark);
      top.position.set(x, 0.75, -5.8);
      const leg = cyl(0.06, 0.06, 0.75, 0x444444);
      leg.position.set(x, 0.37, -5.8);
      this.scene.add(top, leg);
    }
    // Low side walls framing the kitchen.
    for (const x of [-3.2, 3.2]) {
      const w = box(0.2, 0.5, 6.2, 0xd6c4a8);
      w.position.set(x, 0.25, -0.1);
      this.scene.add(w);
    }
  }

  addStation(id, group, { anchor, stand, hit, face }) {
    group.userData.stationId = id;
    this.scene.add(group);
    const hitMesh = new THREE.Mesh(
      new THREE.BoxGeometry(hit[0], hit[1], hit[2]),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    hitMesh.position.copy(group.position).add(new THREE.Vector3(0, hit[1] / 2, 0));
    hitMesh.userData.stationId = id;
    this.scene.add(hitMesh);
    this.hitMeshes.push(hitMesh);
    const slot = new THREE.Group();
    slot.position.copy(anchor);
    this.scene.add(slot);
    this.stations.set(id, { group, anchor, stand, face, slot, key: null, hit: hitMesh });
  }

  counter(x, z, w = 1.1, d = 1.1, top = C.counterTop) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const base = box(w, 0.85, d, C.counter);
    base.position.y = 0.425;
    const t = box(w + 0.06, 0.08, d + 0.06, top);
    t.position.y = 0.89;
    g.add(base, t);
    return g;
  }

  buildStations() {
    const V = (x, y, z) => new THREE.Vector3(x, y, z);

    // Ingredient crates (left wall).
    const crates = [['bread', -1.5], ['lettuce', -0.4], ['tomato', 0.7], ['patty', 1.8]];
    for (const [item, z] of crates) {
      const g = this.counter(-2.5, z, 1.0, 1.0);
      const crate = box(0.8, 0.3, 0.8, C.wood);
      crate.position.y = 1.08;
      g.add(crate);
      for (let i = 0; i < 3; i++) {
        const m = makeItem(item);
        m.scale.setScalar(0.8);
        m.position.set(-0.2 + i * 0.2, 1.2, (i % 2) * 0.16 - 0.08);
        m.rotation.y = i;
        g.add(m);
      }
      this.addStation(`crate:${item}`, g, { anchor: V(-2.5, 1.5, z), stand: V(-1.5, 0, z), hit: [1.1, 1.4, 1.05], face: V(-2.5, 0, z) });
    }

    // Stove (right wall): two burners.
    [-1.5, -0.4].forEach((z, i) => {
      const g = this.counter(2.5, z, 1.0, 1.0, C.stove);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 8, 28), mat(0x111111));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.95;
      const glow = new THREE.Mesh(new THREE.CircleGeometry(0.27, 28), mat(0x331111, { emissive: 0x000000 }));
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.94;
      const knob = cyl(0.06, 0.06, 0.06, 0xdddddd);
      knob.rotation.z = Math.PI / 2;
      knob.position.set(-0.53, 0.6, 0);
      g.add(ring, glow, knob);
      g.userData.glow = glow;
      this.addStation(`burner:${i}`, g, { anchor: V(2.5, 0.95, z), stand: V(1.5, 0, z), hit: [1.1, 1.2, 1.05], face: V(2.5, 0, z) });
    });
    // Spare counter where the helper works when hired, plus the trash.
    this.scene.add(this.counter(2.5, 0.7, 1.0, 1.0));
    {
      const g = new THREE.Group();
      g.position.set(2.5, 0, 1.8);
      const bin = cyl(0.38, 0.32, 0.9, 0x7c8691);
      bin.position.y = 0.45;
      const lid = cyl(0.41, 0.41, 0.06, 0x5a636d);
      lid.position.y = 0.93;
      const handle = box(0.2, 0.05, 0.05, 0x333a42);
      handle.position.y = 0.99;
      g.add(bin, lid, handle);
      this.addStation('trash', g, { anchor: V(2.5, 1.1, 1.8), stand: V(1.5, 0, 1.8), hit: [1.0, 1.2, 1.0], face: V(2.5, 0, 1.8) });
    }

    // Prep boards (front counter).
    [-0.65, 0.65].forEach((x, i) => {
      const g = this.counter(x, 2.2, 1.25, 0.9);
      const board = box(0.9, 0.05, 0.6, C.wood);
      board.position.y = 0.95;
      const knife = box(0.4, 0.02, 0.06, C.steel, { metalness: 0.7, roughness: 0.3 });
      knife.position.set(0.3, 0.99, 0.22);
      knife.rotation.y = 0.4;
      g.add(board, knife);
      g.userData.knife = knife;
      this.addStation(`board:${i}`, g, { anchor: V(x, 0.98, 2.2), stand: V(x, 0, 1.25), hit: [1.3, 1.2, 1.0], face: V(x, 0, 2.2) });
    });

    // Plating counter (in front of the pass).
    [-0.65, 0.65].forEach((x, i) => {
      const g = this.counter(x, -2.35, 1.25, 0.8, 0x8fa3b5);
      this.addStation(`plate:${i}`, g, { anchor: V(x, 0.94, -2.35), stand: V(x, 0, -1.45), hit: [1.3, 1.2, 0.9], face: V(x, 0, -2.35) });
    });

    // Serve window / pass with bell and heat lamps.
    {
      const g = new THREE.Group();
      g.position.set(0, 0, -3.2);
      const base = box(5.2, 1.0, 0.5, 0xb05a3c);
      base.position.y = 0.5;
      const top = box(5.4, 0.08, 0.7, 0xe9edf2);
      top.position.y = 1.04;
      const bellBase = cyl(0.12, 0.12, 0.04, 0x333333);
      bellBase.position.set(1.7, 1.1, 0);
      const bell = sphere(0.12, C.bell);
      bell.scale.set(1, 0.8, 1);
      bell.position.set(1.7, 1.17, 0);
      bell.material.metalness = 0.8;
      bell.material.roughness = 0.25;
      g.add(base, top, bellBase, bell);
      for (const x of [-1.6, 0, 1.6]) {
        const lamp = cyl(0.12, 0.22, 0.18, 0xf2a33a);
        lamp.position.set(x, 2.1, 0);
        const cord = cyl(0.01, 0.01, 0.8, 0x222222, 4);
        cord.position.set(x, 2.6, 0);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
        bulb.position.set(x, 2.0, 0);
        g.add(lamp, cord, bulb);
      }
      this.addStation('serve', g, { anchor: V(0, 1.1, -3.2), stand: V(0, 0, -1.45), hit: [5.2, 1.4, 0.8], face: V(0, 0, -3.2) });
    }
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // Fit the kitchen (about 7 wide, 9 deep on screen) for any aspect ratio.
    const halfW = 3.8;
    const halfH = 5.0;
    // On tall phone screens the HUD covers the top, so aim further back to push
    // the kitchen down into the free space above the bottom bar.
    this.target.z = aspect < 0.8 ? -2.7 : -1.1;
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const dist = Math.max(halfH / tanV, halfW / (tanV * aspect));
    const dir = new THREE.Vector3(0, 0.86, 0.52).normalize();
    this.camera.position.copy(this.target).addScaledVector(dir, dist);
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
    this.viewW = w;
    this.viewH = h;
  }

  pick(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.hitMeshes.filter((m) => m.visible), false);
    return hits.length ? hits[0].object.userData.stationId : null;
  }

  project(v) {
    const p = v.clone().project(this.camera);
    return { x: (p.x + 1) / 2 * this.viewW, y: (1 - p.y) / 2 * this.viewH, behind: p.z > 1 };
  }

  walkTo(id) {
    const s = this.stations.get(id);
    if (!s) return;
    this.chefTarget.copy(s.stand);
    this.chefFace = s.face;
    this.bounce.set(id, 0.25);
  }

  playChop() {
    this.chopAnim = 0.2;
  }

  stationAnchor(id) {
    return this.stations.get(id)?.anchor;
  }

  customerHead(id) {
    const m = this.customerMeshes.get(id);
    return m ? m.position.clone().add(new THREE.Vector3(0, 1.95, 0)) : null;
  }

  // Mirror game state into the scene.
  sync(game, dt) {
    this.time += dt;
    const setSlot = (id, key, build) => {
      const s = this.stations.get(id);
      if (!s || s.key === key) return;
      s.key = key;
      s.slot.clear();
      const m = build();
      if (m) s.slot.add(m);
    };

    // Boards (second board only when upgraded).
    this.stations.forEach((s, id) => {
      if (!id.startsWith('board:')) return;
      const i = Number(id.split(':')[1]);
      const on = i < game.boards.length;
      s.group.visible = on;
      s.hit.visible = on;
      s.slot.visible = on;
      if (!on) return;
      const b = game.boards[i];
      setSlot(id, b.item || '', () => (b.item ? makeItem(b.item) : null));
    });

    game.burners.forEach((b, i) => {
      const id = `burner:${i}`;
      setSlot(id, b.item || '', () => (b.item ? makeItem(b.item) : null));
      const s = this.stations.get(id);
      const glow = s.group.userData.glow;
      const hot = !!b.item;
      const flicker = hot ? 0.6 + Math.sin(this.time * 12 + i) * 0.15 : 0;
      glow.material.emissive.setHex(b.state === 'done' ? 0xff7a00 : b.state === 'burnt' ? 0x550000 : 0xff2a00);
      glow.material.emissiveIntensity = flicker;
      // Shake food that is about to burn.
      s.slot.position.x = s.anchor.x + (b.state === 'done' ? Math.sin(this.time * 40) * 0.02 : 0);
    });

    game.plates.forEach((p, i) => {
      setSlot(`plate:${i}`, p.contents.join(','), () => makePlate(p.contents));
    });

    this.helper.visible = !!game.upg('helper');

    // Station tap bounce.
    for (const [id, t] of this.bounce) {
      const s = this.stations.get(id);
      const nt = t - dt;
      const k = nt > 0 ? 1 + Math.sin((nt / 0.25) * Math.PI) * 0.06 : 1;
      s.group.scale.setScalar(k);
      if (nt <= 0) this.bounce.delete(id);
      else this.bounce.set(id, nt);
    }

    this.syncChef(game, dt);
    this.syncCustomers(game, dt);
  }

  syncChef(game, dt) {
    const chef = this.chef;
    const d = this.chefTarget.clone().sub(chef.position);
    d.y = 0;
    const dist = d.length();
    const speed = 7;
    let moving = false;
    if (dist > 0.02) {
      const step = Math.min(dist, speed * dt);
      chef.position.addScaledVector(d.normalize(), step);
      chef.rotation.y = lerpAngle(chef.rotation.y, Math.atan2(d.x, d.z), Math.min(1, dt * 14));
      moving = true;
    } else if (this.chefFace) {
      const f = this.chefFace.clone().sub(chef.position);
      chef.rotation.y = lerpAngle(chef.rotation.y, Math.atan2(f.x, f.z), Math.min(1, dt * 12));
    }
    const body = chef.userData.body;
    chef.position.y = moving ? Math.abs(Math.sin(this.time * 16)) * 0.08 : 0;
    this.chopAnim = Math.max(0, this.chopAnim - dt);
    body.rotation.x = this.chopAnim > 0 ? Math.sin((this.chopAnim / 0.2) * Math.PI) * 0.25 : 0;

    const key = game.hand ? (game.hand.kind === 'plate' ? 'p:' + game.hand.contents.join(',') : game.hand.kind) : '';
    if (key !== this.heldKey) {
      this.heldKey = key;
      const hands = chef.userData.hands;
      hands.clear();
      const m = makeHeld(game.hand);
      if (m) {
        m.scale.setScalar(0.85);
        hands.add(m);
      }
    }

    if (this.helper.visible) {
      this.helper.position.y = Math.abs(Math.sin(this.time * 3)) * 0.04;
    }
  }

  syncCustomers(game, dt) {
    const alive = new Set();
    for (const c of game.customers) {
      alive.add(c.id);
      let m = this.customerMeshes.get(c.id);
      if (!m) {
        m = makeCustomer(c.type);
        m.position.set(5, 0, CUSTOMER_Z);
        this.scene.add(m);
        this.customerMeshes.set(c.id, m);
      }
      const tx = c.state === 'leaving' ? -6 : SLOT_X[c.slot];
      const dx = tx - m.position.x;
      const speed = c.state === 'leaving' ? 5 : 4.5;
      const moving = Math.abs(dx) > 0.03;
      if (moving) m.position.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
      m.position.y = moving ? Math.abs(Math.sin(this.time * 14 + c.id)) * 0.1 : 0;
      const want = moving ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : 0;
      m.rotation.y = lerpAngle(m.rotation.y, want, Math.min(1, dt * 10));
      // Impatient customers tap their feet.
      if (!moving && c.state === 'waiting' && c.patience / c.max < 0.3) {
        m.rotation.z = Math.sin(this.time * 20) * 0.05;
      } else m.rotation.z = 0;
    }
    for (const [id, m] of this.customerMeshes) {
      if (!alive.has(id)) {
        this.scene.remove(m);
        this.customerMeshes.delete(id);
      }
    }
  }

  // Remove everything transient between days.
  reset() {
    for (const m of this.customerMeshes.values()) this.scene.remove(m);
    this.customerMeshes.clear();
    this.chef.position.set(0, 0, 0.2);
    this.chefTarget.copy(this.chef.position);
    this.chefFace = null;
    this.stations.forEach((s) => { s.key = null; });
  }

  // Menu backdrop: chef idles and the camera sways gently.
  idle(dt) {
    this.time += dt;
    this.chef.rotation.y = Math.sin(this.time * 0.8) * 0.6;
    this.chef.position.y = Math.abs(Math.sin(this.time * 2)) * 0.05;
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
