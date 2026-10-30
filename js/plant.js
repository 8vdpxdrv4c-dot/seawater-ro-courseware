import * as THREE from "three";

const MAT = {};
const GEO = new Map();

function std(color, metalness, roughness, extra) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
}

function materials() {
  // Sunny coastal plant: pale concrete, specular metal, white tanks, safety-yellow metal accents.
  MAT.steel = std(0xb7c0c8, 0.94, 0.2);
  MAT.steelDark = std(0x8d979f, 0.9, 0.26);
  MAT.paint = std(0xc5ced4, 0.48, 0.3);
  MAT.paintDeep = std(0x9aa4ac, 0.52, 0.32);
  MAT.stainless = std(0xf4f7f8, 0.97, 0.11);
  MAT.tank = std(0xf7f8f9, 0.9, 0.14);
  MAT.concrete = std(0xe7e9ec, 0.02, 0.9);
  MAT.concreteDark = std(0xc9ccc8, 0.03, 0.92);
  MAT.motor = std(0x4a525a, 0.74, 0.3);
  MAT.yellow = std(0xf0c419, 0.64, 0.26);
  MAT.rubber = std(0x2c3136, 0.08, 0.74);
  MAT.flange = std(0xd8e0e8, 0.95, 0.14);
  MAT.intake = std(0xc45c58, 0.58, 0.3);
  MAT.rail = std(0xdfe6ee, 0.9, 0.18);
  MAT.chemA = std(0xd4923c, 0.28, 0.4);
  MAT.chemB = std(0x7a68b8, 0.28, 0.4);
  MAT.chemC = std(0x3aa3ae, 0.32, 0.38);
  MAT.membrane = std(0xd5ecf5, 0.05, 0.35, { transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false });
  MAT.tube = std(0xeaf8ff, 0.15, 0.22, { emissive: 0x8fdfff, emissiveIntensity: 0.06 });
  MAT.water = std(0x2aa4b4, 0.08, 0.16, { transparent: true, opacity: 0.62, roughness: 0.08 });
  MAT.lamp = std(0xfff6e8, 0.15, 0.35, { emissive: 0xffe2b0, emissiveIntensity: 0.32 });
  MAT.warmLamp = std(0xffe1c2, 0.15, 0.38, { emissive: 0xffc48a, emissiveIntensity: 0.2 });
  MAT.vessel = std(0xf4f7fa, 0.82, 0.16);
  MAT.hall = std(0xd7dee6, 0.42, 0.38);
  MAT.hallDark = std(0x8b97a3, 0.5, 0.36);
  MAT.flow = std(0x7ee7ff, 0.15, 0.28, { emissive: 0x3ecfff, emissiveIntensity: 1.15 });
  MAT.flowGold = std(0xffc56a, 0.25, 0.32, { emissive: 0xffb450, emissiveIntensity: 0.8 });
}

function geo(key, build) {
  let g = GEO.get(key);
  if (!g) {
    g = build();
    GEO.set(key, g);
  }
  return g;
}

function box(w, h, d) {
  return geo(`b${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d));
}
function cyl(rt, rb, h, seg = 20) {
  return geo(`c${rt}_${rb}_${h}_${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
}
function sph(r, ws = 20, hs = 12) {
  return geo(`s${r}_${ws}_${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
}

function put(parent, mesh, x, y, z, id, shadow = true) {
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  if (id) mesh.userData.id = id;
  parent.add(mesh);
  return mesh;
}

function addBox(parent, w, h, d, mat, x, y, z, id, shadow = true) {
  return put(parent, new THREE.Mesh(box(w, h, d), mat), x, y, z, id, shadow);
}
function addCyl(parent, rt, rb, h, mat, x, y, z, id, shadow = true, seg = 20) {
  return put(parent, new THREE.Mesh(cyl(rt, rb, h, seg), mat), x, y, z, id, shadow);
}

function contact(parent, r, x, z) {
  const m = new THREE.Mesh(
    geo(`disc${r}`, () => new THREE.CircleGeometry(r, 24)),
    new THREE.MeshBasicMaterial({ color: 0x5a636c, transparent: true, opacity: 0.22, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.025, z);
  m.renderOrder = 1;
  parent.add(m);
}

function rails(parent, x, z, w, d, y, id) {
  const posts = [
    [x - w / 2, z - d / 2],
    [x + w / 2, z - d / 2],
    [x - w / 2, z + d / 2],
    [x + w / 2, z + d / 2],
  ];
  posts.forEach(([px, pz]) => addCyl(parent, 0.035, 0.035, 0.9, MAT.rail, px, y + 0.45, pz, id, false, 8));
  addBox(parent, w, 0.04, 0.04, MAT.rail, x, y + 0.88, z - d / 2, id, false);
  addBox(parent, w, 0.04, 0.04, MAT.rail, x, y + 0.88, z + d / 2, id, false);
  addBox(parent, 0.04, 0.04, d, MAT.rail, x - w / 2, y + 0.88, z, id, false);
  addBox(parent, 0.04, 0.04, d, MAT.rail, x + w / 2, y + 0.88, z, id, false);
}

function flange(parent, r, x, y, z, axis, id) {
  const m = addCyl(parent, r, r, 0.08, MAT.flange, x, y, z, id, false, 16);
  if (axis === "x") m.rotation.z = Math.PI / 2;
  if (axis === "z") m.rotation.x = Math.PI / 2;
  return m;
}

function canvasTex(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function brickMap() {
  return canvasTex(512, 512, (g) => {
    g.fillStyle = "#2c3238";
    g.fillRect(0, 0, 512, 512);
    const bw = 62;
    const bh = 30;
    const gap = 5;
    const cols = Math.ceil(512 / (bw + gap)) + 2;
    const rows = Math.ceil(512 / (bh + gap)) + 2;
    for (let row = 0; row < rows; row++) {
      const off = (row % 2) * ((bw + gap) * 0.5);
      for (let col = -1; col < cols; col++) {
        const x = Math.round(col * (bw + gap) + off);
        const y = row * (bh + gap);
        const n = ((row * 13 + col * 7) % 9) / 9;
        const tone = Math.round(118 + n * 52);
        g.fillStyle = `rgb(${tone - 8},${tone - 2},${tone + 4})`;
        g.fillRect(x, y, bw, bh);
        g.fillStyle = `rgba(255,255,255,${0.05 + n * 0.06})`;
        g.fillRect(x + 2, y + 2, bw * 0.45, 2);
        g.fillStyle = "rgba(20,24,28,0.18)";
        g.fillRect(x, y + bh - 3, bw, 3);
        g.fillStyle = `rgba(30,34,38,${0.05 + n * 0.08})`;
        g.fillRect(x + 8 + (n * 20), y + 8, 2, 2);
      }
    }
  });
}

function beachMap() {
  return canvasTex(512, 512, (g) => {
    g.fillStyle = "#f6e4bc";
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 28; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 30 + Math.random() * 70;
      g.fillStyle = Math.random() > 0.5 ? "rgba(214,176,112,0.12)" : "rgba(255,248,230,0.2)";
      g.beginPath();
      g.ellipse(x, y, r, r * 0.55, Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 14000; i++) {
      const roll = Math.random();
      const a = 0.15 + Math.random() * 0.45;
      if (roll > 0.94) g.fillStyle = `rgba(176,132,72,${a * 0.45})`;
      else if (roll > 0.6) g.fillStyle = `rgba(210,170,110,${a * 0.35})`;
      else g.fillStyle = `rgba(255,250,236,${a * 0.7})`;
      const s = roll > 0.97 ? 3 : 1 + (roll > 0.8 ? 1 : 0);
      g.fillRect(Math.random() * 512, Math.random() * 512, s, s);
    }
  });
}

function pavedDeck(w, d) {
  const geo = new THREE.PlaneGeometry(w, d);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) * 0.16, pos.getY(i) * 0.16);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function softCircle() {
  return canvasTex(64, 64, (g) => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,0.95)");
    grd.addColorStop(0.35, "rgba(255,255,255,0.35)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  });
}

function plaqueTex(title, sub) {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = "#102033";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#7ee7ff";
    g.lineWidth = 8;
    g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = "#eaf6ff";
    g.font = "700 64px CourseHan, 'WenQuanYi Micro Hei', sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(title, w / 2, sub ? h * 0.4 : h / 2);
    if (sub) {
      g.fillStyle = "#9ad7e4";
      g.font = "500 36px CourseHan, 'WenQuanYi Micro Hei', sans-serif";
      g.fillText(sub, w / 2, h * 0.72);
    }
  });
}

function plaque(parent, title, sub, x, y, z, sx = 1.4, sy = 0.7) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(sx, sy),
    new THREE.MeshBasicMaterial({ map: plaqueTex(title, sub), transparent: true })
  );
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function glassMaterial(hex) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(hex) } },
    vertexShader: `
      varying vec3 vN; varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying vec3 vN; varying vec3 vW;
      void main() {
        vec3 V = normalize(cameraPosition - vW);
        float nd = abs(dot(normalize(vN), V));
        float rim = pow(1.0 - nd, 1.35);
        float alpha = mix(0.12, 0.78, rim);
        vec3 col = mix(uColor * 0.62, uColor, rim);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

const GLASS = {};
function glass(hex) {
  const k = hex.toString(16);
  if (!GLASS[k]) GLASS[k] = glassMaterial(hex);
  return GLASS[k];
}

function curveFrom(pts) {
  return new THREE.CatmullRomCurve3(
    pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
    false,
    "catmullrom",
    0.08
  );
}

// Island footprint in metres. Negative is inland, positive is offshore.
// West edge stays just seaward of the quay so the intake tower sits in open water.
function islandSdf(x, z) {
  function ellipse(cx, cz, rx, rz) {
    const nx = (x - cx) / rx;
    const nz = (z - cz) / rz;
    return (Math.hypot(nx, nz) - 1) * Math.min(rx, rz);
  }
  function smin(a, b, k) {
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - h * h * k * 0.25;
  }
  const yard = ellipse(42, 2, 64, 30);
  const north = ellipse(34, -40, 68, 32);
  const south = ellipse(34, 30, 50, 22);
  const west = ellipse(6, 6, 30, 24);
  return smin(smin(smin(yard, north, 26), south, 22), west, 18);
}

function islandHeightAt(x, z) {
  const sdf = islandSdf(x, z);
  if (sdf < 0) return 1.4 + Math.min(2.4, -sdf * 0.035);
  return -Math.min(30, 0.35 + sdf * 0.22);
}

function buildIslandGeometry() {
  const x0 = -50;
  const x1 = 130;
  const z0 = -100;
  const z1 = 74;
  const nx = 110;
  const nz = 100;
  const stride = nx + 1;
  const positions = [];
  const uvs = [];
  const wet = [];
  const valid = [];
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = x0 + (i / nx) * (x1 - x0);
      const z = z0 + (j / nz) * (z1 - z0);
      const sdf = islandSdf(x, z);
      const on = sdf <= 18;
      // Shore sits just under still water so the edge is a beach, not a rim.
      // Gentle shelf: sand stays just under the surface for a wide turquoise shallows.
      const y = sdf >= 0
        ? -0.2 - Math.min(sdf, 24) * 0.04
        : -0.2 + Math.min(1, -sdf / 10) * 0.18;
      valid.push(on);
      positions.push(x, y, z);
      uvs.push(x * 0.22, z * 0.22);
      wet.push(Math.min(1, Math.max(0, (sdf + 5.5) / 6.5)));
    }
  }
  const index = [];
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * stride + i;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      if (!valid[a] || !valid[b] || !valid[c] || !valid[d]) continue;
      index.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute("wetness", new THREE.Float32BufferAttribute(wet, 1));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

export function createPlant(scene) {
  materials();
  const root = new THREE.Group();
  scene.add(root);
  const pick = [];
  const tickers = [];
  const flows = [];
  const plaques = [];

  const sandTex = beachMap();
  sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping;
  const sandMat = new THREE.MeshStandardMaterial({
    color: 0xfff4df,
    map: sandTex,
    metalness: 0.02,
    roughness: 0.94,
  });
  sandMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float wetness;\nvarying float vWet;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWet = wetness;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vWet;")
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb *= mix(vec3(1.0), vec3(0.82, 0.68, 0.46), clamp(vWet, 0.0, 1.0));")
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = mix(0.92, 0.16, clamp(vWet, 0.0, 1.0));");
  };
  // The plant sits on an island. Open ocean (js/ocean.js) surrounds it.
  const island = new THREE.Mesh(buildIslandGeometry(), sandMat);
  island.receiveShadow = true;
  island.castShadow = false;
  root.add(island);
  const duneTex = sandTex.clone();
  duneTex.repeat.set(5, 5);
  const duneMat = sandMat.clone();
  duneMat.map = duneTex;
  function dune(x, z, rx, ry, rz, rot) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 16), duneMat);
    m.scale.set(rx, ry, rz);
    m.position.set(x, ry * 0.22, z);
    m.rotation.y = rot || 0;
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
  }
  // Low desert dunes in the opening foreground and along the coast.
  dune(-2, 26, 16, 2.2, 7, 0.35);
  dune(16, 34, 24, 1.7, 9, 0.15);
  dune(30, 34, 16, 2.1, 7, -0.25);
  dune(86, 16, 12, 2.2, 6, 0.4);
  dune(78, 8, 12, 2.2, 6, 0.2);
  dune(-8, 22, 14, 1.9, 6, 0.2);

  const bricks = brickMap();
  bricks.wrapS = bricks.wrapT = THREE.RepeatWrapping;
  const brickMat = std(0xc5ccd2, 0.08, 0.78, { map: bricks });
  const yardBase = new THREE.Mesh(new THREE.BoxGeometry(92, 0.76, 36), std(0x5c6368, 0.06, 0.88));
  yardBase.position.set(28, -0.42, 0);
  yardBase.receiveShadow = true;
  root.add(yardBase);
  const yard = new THREE.Mesh(pavedDeck(92, 36), brickMat);
  yard.position.set(28, 0.012, 0);
  yard.receiveShadow = true;
  root.add(yard);

  addBox(root, 2.2, 3.2, 42, std(0x5c6368, 0.06, 0.88), -16.2, -0.3, 0, null, true);
  const quayDeck = new THREE.Mesh(pavedDeck(2.05, 41.2), brickMat);
  quayDeck.position.set(-16.2, 1.34, 0);
  quayDeck.receiveShadow = true;
  root.add(quayDeck);

  // Two site-security officers. Loops stay on the brick yard, clear of tanks and the product channel.
  function makeGuard(vestColor) {
    const g = new THREE.Group();
    const navy = std(0x1a3d73, 0.12, 0.5);
    const vest = std(vestColor, 0.06, 0.4, { emissive: vestColor, emissiveIntensity: 0.18 });
    const skin = std(0xc48a62, 0.04, 0.64);
    const boot = std(0x1b1e22, 0.12, 0.58);
    const cap = std(0x142848, 0.22, 0.42);
    function shade(mesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    }
    function leg(side) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.1, 0.9, 0);
      const thigh = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.44, 8), navy));
      thigh.position.y = -0.22;
      const shoe = shade(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.2), boot));
      shoe.position.set(0, -0.46, 0.03);
      pivot.add(thigh, shoe);
      return pivot;
    }
    function arm(side) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.26, 1.38, 0);
      const limb = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.42, 6), navy));
      limb.position.y = -0.22;
      pivot.add(limb);
      return pivot;
    }
    const leftLeg = leg(-1);
    const rightLeg = leg(1);
    const leftArm = arm(-1);
    const rightArm = arm(1);
    const torso = shade(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.46, 0.18), navy));
    torso.position.y = 1.2;
    const vestMesh = shade(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.22), vest));
    vestMesh.position.y = 1.24;
    const belt = shade(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.055, 0.2), boot));
    belt.position.y = 1.0;
    const head = shade(new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), skin));
    head.position.y = 1.56;
    const capTop = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.06, 10), cap));
    capTop.position.y = 1.66;
    const brim = shade(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.1), cap));
    brim.position.set(0, 1.63, 0.08);
    g.add(leftLeg, rightLeg, leftArm, rightArm, torso, vestMesh, belt, head, capTop, brim);
    g.scale.setScalar(1.55);
    g.userData.limbs = { leftLeg, rightLeg, leftArm, rightArm };
    return g;
  }
  function patrol(guard, pts, speed, phase) {
    const curve = new THREE.CatmullRomCurve3(
      pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
      true,
      "catmullrom",
      0
    );
    const len = Math.max(curve.getLength(), 0.001);
    let dist = ((phase % 1) + 1) % 1 * len;
    const pos = new THREE.Vector3();
    const ahead = new THREE.Vector3();
    root.add(guard);
    tickers.push((t, dt) => {
      dist = ((dist + speed * dt) % len + len) % len;
      const u = dist / len;
      curve.getPointAt(u, pos);
      curve.getPointAt((u + 0.012) % 1, ahead);
      guard.position.set(pos.x, 0.02, pos.z);
      guard.rotation.y = Math.atan2(ahead.x - pos.x, ahead.z - pos.z);
      const swing = Math.sin(t * speed * 3.1 + phase * 8) * 0.48;
      const limbs = guard.userData.limbs;
      limbs.leftLeg.rotation.x = swing;
      limbs.rightLeg.rotation.x = -swing;
      limbs.leftArm.rotation.x = -swing * 0.62;
      limbs.rightArm.rotation.x = swing * 0.62;
    });
  }
  patrol(makeGuard(0xf0b429), [[-6, 0.02, 15.4], [50, 0.02, 15.4], [50, 0.02, -13.6], [-6, 0.02, -13.6]], 1.7, 0.05);
  patrol(makeGuard(0xe06a1c), [[10, 0.02, -6.4], [44, 0.02, -6.4], [44, 0.02, 8.6], [10, 0.02, 8.6]], 1.45, 0.4);

  const seaY = -0.18;
  const stain = new THREE.Mesh(
    new THREE.PlaneGeometry(38, 0.85),
    std(0x7d8680, 0.18, 0.42)
  );
  stain.rotation.y = Math.PI / 2;
  stain.position.set(-17.34, seaY + 0.42, 0);
  root.add(stain);

  function hill(x, z, rx, ry, rz, rot) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), duneMat);
    m.scale.set(rx, ry, rz);
    m.position.set(x, ry * 0.15, z);
    m.rotation.y = rot || 0;
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  }
  hill(10, -48, 38, 7, 16, 0.2);
  hill(48, -42, 26, 5.5, 12, 0.4);
  hill(78, -36, 22, 4, 14, 0);
  hill(-8, -40, 18, 4, 10, 0.6);

  // road
  addBox(root, 86, 0.04, 4.2, std(0x3a3f46, 0.18, 0.72), 28, 0.03, 12.2, null, true);
  for (let i = 0; i < 18; i++) {
    addBox(root, 1.6, 0.02, 0.12, std(0xf4f6f8, 0.05, 0.55), -8 + i * 4.4, 0.06, 12.2, null, false);
  }

  function pole(x, z) {
    addCyl(root, 0.08, 0.1, 6.2, MAT.steelDark, x, 3.1, z, null, false, 8);
    addBox(root, 1.1, 0.12, 0.28, MAT.steel, x, 6.15, z - 0.2, null, false);
    const lamp = addBox(root, 0.7, 0.08, 0.2, MAT.lamp, x, 6.02, z - 0.2, null, false);
    const pl = new THREE.PointLight(0xfff1d6, 0.32, 9, 2);
    pl.position.set(x, 5.7, z - 0.2);
    root.add(pl);
    return lamp;
  }
  [-6, 12, 30, 48, 64].forEach((x) => pole(x, 14.2));

  // A few safety-yellow runs, same places the mock picks out valves and headers.
  const y1 = addCyl(root, 0.11, 0.11, 9.5, MAT.yellow, 22.5, 2.55, 1.35, null, false, 12);
  y1.rotation.z = Math.PI / 2;
  const y2 = addCyl(root, 0.09, 0.09, 6.2, MAT.yellow, 33.5, 3.15, -0.85, null, false, 12);
  y2.rotation.z = Math.PI / 2;
  const y3 = addCyl(root, 0.08, 0.08, 3.4, MAT.yellow, 16.4, 2.15, -1.15, null, false, 10);
  y3.rotation.x = Math.PI / 2;

  // control room behind the train
  const room = new THREE.Group();
  room.position.set(18, 0, -10);
  root.add(room);
  addBox(room, 6.5, 3.2, 3.4, MAT.paintDeep, 0, 1.6, 0);
  addBox(room, 6.6, 0.2, 3.6, MAT.steelDark, 0, 3.3, 0, null, false);
  const winMat = std(0xd5e6f0, 0.04, 0.08, { emissive: 0xb7cddd, emissiveIntensity: 0.08 });
  addBox(room, 1.4, 1.1, 0.08, winMat, -1.6, 1.8, 1.72, null, false);
  addBox(room, 1.4, 1.1, 0.08, winMat, 1.6, 1.8, 1.72, null, false);
  addBox(room, 0.9, 2.1, 0.08, MAT.steelDark, 0, 1.05, 1.72, null, false);

  const units = {};
  function register(id, group, labelAt, pose) {
    group.updateMatrixWorld(true);
    const anchor = group.localToWorld(new THREE.Vector3(labelAt[0], labelAt[1], labelAt[2]));
    const label = anchor.clone();
    label.y += 1.15;
    units[id] = {
      id,
      anchor,
      label,
      pose,
    };
    group.traverse((o) => {
      if (o.isMesh && o.userData.id === id) pick.push(o);
    });
  }

  // ---------- intake ----------
  const intake = new THREE.Group();
  root.add(intake);
  // screen tower in the sea
  addBox(intake, 1.6, 5.2, 1.6, MAT.steelDark, -28, 1.4, 0, "intake");
  for (let i = 0; i < 7; i++) {
    addBox(intake, 0.06, 3.4, 0.08, MAT.stainless, -27.15, 1.5, -0.9 + i * 0.3, "intake", false);
  }
  addCyl(intake, 0.55, 0.55, 0.28, MAT.intake, -28, 4.15, 0.9, "intake", false);
  addCyl(intake, 0.55, 0.55, 0.28, MAT.intake, -28, 4.15, -0.9, "intake", false);
  addBox(intake, 2.2, 0.12, 2.2, MAT.steel, -28, 3.7, 0, "intake", false);
  rails(intake, -28, 0, 2, 2, 3.75, "intake");
  // trestle
  for (let x = -26; x <= -17; x += 3) {
    addCyl(intake, 0.12, 0.16, 2.2, MAT.concrete, x, -0.2, 0.8, null, false, 8);
    addCyl(intake, 0.12, 0.16, 2.2, MAT.concrete, x, -0.2, -0.8, null, false, 8);
  }
  addCyl(intake, 0.22, 0.22, 12, MAT.steel, -22.2, 1.15, 0, "intake", false).rotation.z = Math.PI / 2;
  // shore station
  addBox(intake, 5.2, 0.35, 4.2, MAT.concrete, -12.2, 0.18, 0, "intake");
  addBox(intake, 3.4, 2.5, 2.8, MAT.paintDeep, -12.4, 1.55, -0.3, "intake");
  addBox(intake, 1.2, 0.9, 0.06, winMat, -12.4, 1.7, 1.12, "intake", false);
  // low-pressure pumps
  const lp1 = addCyl(intake, 0.32, 0.32, 1.5, MAT.motor, -10.2, 0.7, 1.15, "intake");
  lp1.rotation.z = Math.PI / 2;
  const lp2 = addCyl(intake, 0.28, 0.32, 0.9, MAT.paint, -9.1, 0.7, 1.15, "intake");
  lp2.rotation.z = Math.PI / 2;
  contact(intake, 2.4, -12.2, 0);
  plaque(intake, "取水口", "格栅", -12.4, 3.15, 1.15, 1.5, 0.72);
  register("intake", intake, [-20, 3.2, 0], {
    pos: [-12, 5.2, 11],
    target: [-20, 1.8, 0.2],
    fov: 36,
  });

  // ---------- coagulation ----------
  const coag = new THREE.Group();
  root.add(coag);
  addBox(coag, 5.4, 1.35, 3.6, MAT.concrete, -5.6, 0.68, 0.2, "coag");
  const basinWater = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 3.0), MAT.water);
  basinWater.rotation.x = -Math.PI / 2;
  basinWater.position.set(-5.6, 1.28, 0.2);
  basinWater.userData.id = "coag";
  coag.add(basinWater);
  addBox(coag, 5.5, 0.16, 0.16, MAT.steel, -5.6, 1.42, -1.55, "coag", false);
  addBox(coag, 5.5, 0.16, 0.16, MAT.steel, -5.6, 1.42, 1.95, "coag", false);
  const mixer = new THREE.Group();
  mixer.position.set(-5.6, 1.3, 0.2);
  coag.add(mixer);
  const shaft = addCyl(mixer, 0.06, 0.06, 1.1, MAT.stainless, 0, 0.7, 0, "coag", false, 8);
  const paddle = addBox(mixer, 1.4, 0.06, 0.18, MAT.stainless, 0, 0.35, 0, "coag", false);
  addBox(coag, 1.6, 0.08, 0.2, MAT.steel, -5.6, 1.85, 0.2, "coag", false);
  tickers.push((t, dt) => {
    mixer.rotation.y += dt * (0.15 + flowState.amount * 0.9);
  });
  contact(coag, 3.2, -5.6, 0.2);
  register("coag", coag, [-5.6, 2.2, 0.2], {
    pos: [-2.2, 6.2, 11],
    target: [-5.6, 1.1, 0.2],
    fov: 34,
  });

  // ---------- multimedia filters ----------
  const filter = new THREE.Group();
  root.add(filter);
  addBox(filter, 7.2, 0.4, 6.4, MAT.concrete, 0.4, 0.2, 0, "filter");
  const fz = [-2.1, -0.7, 0.7, 2.1];
  fz.forEach((z) => {
    addCyl(filter, 0.62, 0.62, 3.15, MAT.vessel, 0.2, 2.05, z, "filter", true, 22);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), MAT.vessel);
    dome.position.set(0.2, 3.62, z);
    dome.castShadow = true;
    dome.userData.id = "filter";
    filter.add(dome);
    addCyl(filter, 0.08, 0.1, 0.7, MAT.steel, -0.55, 0.55, z, "filter", false, 8);
    addCyl(filter, 0.08, 0.1, 0.7, MAT.steel, 0.95, 0.55, z, "filter", false, 8);
    flange(filter, 0.16, 0.2, 3.95, z, "y", "filter");
    addBox(filter, 0.35, 0.5, 0.35, MAT.steelDark, 0.2, 1.2, z + 0.62, "filter", false);
  });
  addCyl(filter, 0.16, 0.16, 6.2, MAT.stainless, 0.2, 4.15, 0, "filter", false).rotation.x = Math.PI / 2;
  rails(filter, 0.4, 0, 6.4, 5.6, 0.4, "filter");
  contact(filter, 3.6, 0.4, 0);
  plaque(filter, "多介质过滤", "", 0.2, 2.3, 3.5, 1.8, 0.55);
  register("filter", filter, [0.4, 4.4, 0], {
    pos: [4.5, 6.4, 12.5],
    target: [0.4, 2.2, 0],
    fov: 34,
  });

  // ---------- dosing ----------
  const dose = new THREE.Group();
  root.add(dose);
  addBox(dose, 4.6, 0.28, 2.4, MAT.concrete, 8.2, 0.16, 2.2, "dose");
  const chems = [
    { z: 1.35, mat: MAT.chemA, name: "混凝" },
    { z: 2.2, mat: MAT.chemB, name: "阻垢" },
    { z: 3.05, mat: MAT.chemC, name: "还原" },
  ];
  chems.forEach((c) => {
    addCyl(dose, 0.38, 0.38, 1.35, c.mat, 7.5, 0.95, c.z, "dose", true, 18);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), c.mat);
    cap.position.set(7.5, 1.62, c.z);
    cap.userData.id = "dose";
    cap.castShadow = true;
    dose.add(cap);
    const tag = plaque(dose, c.name, "", 7.5, 1.15, c.z + 0.4, 0.7, 0.32);
    tag.position.z = c.z + 0.42;
    const pump = addBox(dose, 0.28, 0.28, 0.4, MAT.motor, 8.7, 0.48, c.z, "dose", false);
    pump.userData.id = "dose";
  });
  addBox(dose, 2.2, 0.9, 0.7, MAT.steelDark, 9.15, 0.7, 2.2, "dose");
  contact(dose, 2.4, 8.2, 2.2);
  register("dose", dose, [8.2, 2.5, 2.2], {
    pos: [11.5, 5.2, 9.5],
    target: [8.2, 1.2, 2.2],
    fov: 32,
  });

  // ---------- high pressure pump ----------
  const pump = new THREE.Group();
  root.add(pump);
  addBox(pump, 7.4, 0.4, 3.6, MAT.concrete, 16.2, 0.2, 0.2, "pump");
  // hazard curb
  const hazard = canvasTex(128, 32, (g, w, h) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? "#111" : "#e2b03a";
      g.beginPath();
      g.moveTo(i * 16, 0);
      g.lineTo(i * 16 + 16, 0);
      g.lineTo(i * 16 + 8, h);
      g.lineTo(i * 16 - 8, h);
      g.fill();
    }
  });
  const curb = new THREE.Mesh(
    new THREE.BoxGeometry(7.4, 0.18, 0.16),
    new THREE.MeshStandardMaterial({ map: hazard, roughness: 0.6, metalness: 0.1 })
  );
  curb.position.set(16.2, 0.48, 2.05);
  pump.add(curb);
  const motor = addCyl(pump, 0.58, 0.58, 2.3, MAT.motor, 14.7, 1.15, 0.15, "pump", true, 24);
  motor.rotation.z = Math.PI / 2;
  for (let i = 0; i < 6; i++) {
    const fin = addBox(pump, 0.04, 0.16, 1.25, MAT.steelDark, 13.9 + i * 0.22, 1.8, 0.15, "pump", false);
    fin.userData.id = "pump";
  }
  const couple = addCyl(pump, 0.28, 0.28, 0.45, MAT.yellow, 16.15, 1.15, 0.15, "pump", false, 16);
  couple.rotation.z = Math.PI / 2;
  const barrel = addCyl(pump, 0.5, 0.62, 1.7, MAT.stainless, 17.45, 1.15, 0.15, "pump", true, 24);
  barrel.rotation.z = Math.PI / 2;
  flange(pump, 0.28, 13.45, 1.15, 0.15, "x", "pump");
  flange(pump, 0.32, 18.45, 1.55, 0.15, "x", "pump");
  // cartridge filters
  [-0.55, 0.55].forEach((z) => {
    addCyl(pump, 0.22, 0.22, 1.15, MAT.stainless, 13.3, 1.0, z, "pump", false, 14);
    addBox(pump, 0.5, 0.08, 0.5, MAT.flange, 13.3, 1.6, z, "pump", false);
  });
  // gauge
  const gauge = new THREE.Group();
  gauge.position.set(16.4, 2.15, 1.35);
  pump.add(gauge);
  const face = canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#0c1a28";
    g.beginPath();
    g.arc(128, 128, 120, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#9ad7e4";
    g.lineWidth = 8;
    g.stroke();
    g.strokeStyle = "#3ecf8e";
    g.lineWidth = 14;
    g.beginPath();
    const a0 = Math.PI * 0.85;
    const a1 = Math.PI * 2.15;
    const t5 = 5 / 10;
    const t8 = 8 / 10;
    g.arc(128, 128, 96, a0 + (a1 - a0) * t5, a0 + (a1 - a0) * t8);
    g.stroke();
    g.fillStyle = "#d5e8f5";
    g.font = "600 28px CourseHan, 'WenQuanYi Micro Hei', sans-serif";
    g.textAlign = "center";
    g.fillText("MPa", 128, 156);
    g.font = "500 18px CourseHan, 'WenQuanYi Micro Hei', sans-serif";
    g.fillStyle = "#8fb4cc";
    g.fillText("0", 48, 176);
    g.fillText("10", 208, 176);
  });
  const dial = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 32),
    new THREE.MeshBasicMaterial({ map: face })
  );
  gauge.add(dial);
  const needle = new THREE.Mesh(
    new THREE.BoxGeometry(0.035, 0.32, 0.02),
    new THREE.MeshBasicMaterial({ color: 0xffb067 })
  );
  needle.position.y = 0.1;
  needle.geometry.translate(0, 0.08, 0.02);
  gauge.add(needle);
  addCyl(pump, 0.04, 0.04, 0.9, MAT.steel, 16.4, 1.65, 1.35, "pump", false, 8);
  plaque(pump, "P ≈ 5–8 MPa", "高压泵", 18.3, 2.35, 1.15, 1.7, 0.78);
  rails(pump, 16.2, 0.2, 6.8, 3.2, 0.4, "pump");
  contact(pump, 3.8, 16.2, 0.2);
  const readout = { mpa: 0.2 };
  tickers.push((t, dt) => {
    const live = flowState.amount > 0.08;
    const goal = live ? 6.35 + Math.sin(t * 0.7) * 0.28 : 0.15;
    readout.mpa += (goal - readout.mpa) * Math.min(1, dt * 1.4);
    const tt = THREE.MathUtils.clamp(readout.mpa / 10, 0, 1);
    needle.rotation.z = THREE.MathUtils.degToRad(-210 + tt * 240);
    if (live) couple.rotation.x += dt * 8 * flowState.amount;
  });
  register("pump", pump, [16.2, 2.6, 0.2], {
    pos: [16.2, 5.4, 10.5],
    target: [16.3, 1.5, 0.3],
    fov: 32,
  });

  // ---------- RO rack ----------
  const ro = new THREE.Group();
  root.add(ro);
  addBox(ro, 8.2, 0.4, 7.2, MAT.concrete, 28, 0.2, 0.4, "membrane");
  // frame
  [-2.6, 2.6].forEach((z) => {
    [-3.4, 3.4].forEach((x) => {
      addBox(ro, 0.14, 4.3, 0.14, MAT.steel, 28 + x, 2.35, z, "membrane", false);
    });
    addBox(ro, 6.9, 0.1, 0.1, MAT.steel, 28, 4.4, z, "membrane", false);
    addBox(ro, 6.9, 0.1, 0.1, MAT.steel, 28, 1.15, z, "membrane", false);
  });
  addBox(ro, 0.1, 0.1, 5.3, MAT.steel, 24.6, 4.4, 0, "membrane", false);
  addBox(ro, 0.1, 0.1, 5.3, MAT.steel, 31.4, 4.4, 0, "membrane", false);

  function closedVessel(x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const shell = new THREE.Mesh(cyl(0.34, 0.34, 5.5, 22), MAT.stainless);
    shell.rotation.z = -Math.PI / 2;
    shell.castShadow = true;
    shell.userData.id = "membrane";
    g.add(shell);
    const capL = new THREE.Mesh(cyl(0.36, 0.36, 0.16, 18), MAT.paintDeep);
    capL.rotation.z = -Math.PI / 2;
    capL.position.x = -2.8;
    capL.userData.id = "membrane";
    g.add(capL);
    const capR = capL.clone();
    capR.position.x = 2.8;
    capR.userData.id = "membrane";
    g.add(capR);
    ro.add(g);
  }
  const zs = [-2.0, -0.85, 0.3, 1.45];
  zs.forEach((z) => {
    closedVessel(28, 1.7, z);
    closedVessel(28, 3.15, z);
  });
  closedVessel(28, 3.15, 2.6);

  // cutaway vessel, opening toward +Z, axis along +X
  const cut = new THREE.Group();
  cut.position.set(28, 1.7, 2.7);
  ro.add(cut);
  const shellGeo = new THREE.CylinderGeometry(0.4, 0.4, 5.6, 36, 1, true, 1.05, Math.PI * 2 - 2.1);
  const shell = new THREE.Mesh(shellGeo, MAT.stainless);
  shell.rotation.z = -Math.PI / 2;
  shell.userData.id = "membrane";
  shell.castShadow = true;
  cut.add(shell);
  // end rings
  [-2.75, 2.75].forEach((x) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.045, 8, 24), MAT.paintDeep);
    ring.position.x = x;
    ring.rotation.y = Math.PI / 2;
    ring.userData.id = "membrane";
    cut.add(ring);
  });
  const mem = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 5.2, 24, 1, true), MAT.membrane);
  mem.rotation.z = -Math.PI / 2;
  mem.userData.id = "membrane";
  cut.add(mem);
  const pTube = new THREE.Mesh(cyl(0.075, 0.075, 5.5, 12), MAT.tube);
  pTube.rotation.z = -Math.PI / 2;
  pTube.userData.id = "membrane";
  cut.add(pTube);
  // spiral hint
  const hpts = [];
  const turns = 7;
  for (let i = 0; i <= turns * 20; i++) {
    const t = i / (turns * 20);
    const a = t * turns * Math.PI * 2;
    hpts.push(new THREE.Vector3(-2.5 + t * 5.0, Math.cos(a) * 0.2, Math.sin(a) * 0.2));
  }
  const helix = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hpts), 140, 0.012, 5, false),
    new THREE.MeshBasicMaterial({ color: 0xd8f4ff, transparent: true, opacity: 0.55 })
  );
  cut.add(helix);

  const saltN = 70;
  const waterN = 54;
  const saltPos = new Float32Array(saltN * 3);
  const waterPos = new Float32Array(waterN * 3);
  const saltPh = new Float32Array(saltN);
  const waterPh = new Float32Array(waterN);
  for (let i = 0; i < saltN; i++) saltPh[i] = Math.random();
  for (let i = 0; i < waterN; i++) waterPh[i] = Math.random();
  const saltGeo = new THREE.BufferGeometry();
  saltGeo.setAttribute("position", new THREE.BufferAttribute(saltPos, 3));
  const waterGeo = new THREE.BufferGeometry();
  waterGeo.setAttribute("position", new THREE.BufferAttribute(waterPos, 3));
  const sprite = softCircle();
  const saltPts = new THREE.Points(
    saltGeo,
    new THREE.PointsMaterial({
      size: 0.11,
      map: sprite,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      color: 0xffc48a,
      blending: THREE.NormalBlending,
    })
  );
  const waterPts = new THREE.Points(
    waterGeo,
    new THREE.PointsMaterial({
      size: 0.13,
      map: sprite,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      color: 0xd8fbff,
    })
  );
  cut.add(saltPts, waterPts);
  const fx = { emphasis: null };
  tickers.push((t, dt) => {
    const sp = flowState.amount * 0.22 * (fx.emphasis === "salt" ? 1.6 : 1);
    const wp = flowState.amount * 0.18;
    saltPts.material.size = fx.emphasis === "salt" ? 0.18 : 0.11;
    waterPts.material.size = fx.emphasis === "water" ? 0.2 : 0.13;
    for (let i = 0; i < saltN; i++) {
      saltPh[i] = (saltPh[i] + dt * sp) % 1;
      const a = saltPh[i] * Math.PI * 8 + i;
      const r = 0.3 + (i % 5) * 0.012;
      saltPos[i * 3] = -2.4 + saltPh[i] * 4.8;
      saltPos[i * 3 + 1] = Math.cos(a) * r;
      saltPos[i * 3 + 2] = Math.sin(a) * r;
    }
    for (let i = 0; i < waterN; i++) {
      waterPh[i] = (waterPh[i] + dt * wp) % 1;
      const u = waterPh[i];
      const x = -2.4 + u * 4.8;
      let r;
      if (u < 0.55) r = 0.3 - (u / 0.55) * 0.22;
      else r = 0.06;
      const a = i * 1.7;
      waterPos[i * 3] = x;
      waterPos[i * 3 + 1] = Math.cos(a) * r;
      waterPos[i * 3 + 2] = Math.sin(a) * r;
    }
    saltGeo.attributes.position.needsUpdate = true;
    waterGeo.attributes.position.needsUpdate = true;
  });

  // headers
  addCyl(ro, 0.14, 0.14, 5.4, MAT.stainless, 24.7, 2.4, 0.2, "membrane", false).rotation.x = Math.PI / 2;
  addCyl(ro, 0.12, 0.12, 5.4, MAT.stainless, 31.3, 1.15, 0.6, "membrane", false).rotation.x = Math.PI / 2;
  addCyl(ro, 0.12, 0.12, 5.4, std(0x8d6a45, 0.6, 0.35), 31.3, 3.3, -0.4, "membrane", false).rotation.x = Math.PI / 2;
  rails(ro, 28, 0.4, 7.6, 6.4, 0.4, "membrane");
  contact(ro, 4.2, 28, 0.4);
  const plate = plaque(ro, "H₂O 透过", "盐截留", 30.6, 2.55, 3.55, 1.8, 0.85);
  plate.userData.id = "membrane";
  register("membrane", ro, [28, 4.2, 1.2], {
    pos: [31.6, 3.6, 10.4],
    target: [28.2, 1.75, 2.4],
    fov: 30,
  });

  // ---------- energy recovery ----------
  const erd = new THREE.Group();
  root.add(erd);
  addBox(erd, 5.2, 0.35, 3.4, MAT.concrete, 40.2, 0.18, -1.4, "erd");
  const px = addCyl(erd, 0.55, 0.55, 2.4, MAT.stainless, 40.2, 1.35, -1.5, "erd", true, 24);
  px.rotation.z = Math.PI / 2;
  const rotor = addCyl(erd, 0.42, 0.42, 0.18, MAT.yellow, 40.2, 1.35, -1.5, "erd", false, 16);
  rotor.rotation.z = Math.PI / 2;
  // booster
  const boost = addCyl(erd, 0.28, 0.28, 1.1, MAT.motor, 41.8, 0.85, 0.35, "erd");
  boost.rotation.z = Math.PI / 2;
  addBox(erd, 0.7, 0.7, 0.7, MAT.paint, 38.6, 0.7, -0.2, "erd");
  flange(erd, 0.2, 38.85, 1.35, -1.5, "x", "erd");
  flange(erd, 0.2, 41.55, 1.35, -1.5, "x", "erd");
  rails(erd, 40.2, -1.4, 4.6, 3.0, 0.35, "erd");
  contact(erd, 2.8, 40.2, -1.4);
  plaque(erd, "能量回收", "浓水 → 进料", 40.2, 2.5, 0.5, 1.7, 0.75);
  tickers.push((t, dt) => {
    rotor.rotation.x += dt * (0.15 + flowState.amount * 3.2);
    boost.rotation.x += dt * 6 * flowState.amount;
  });
  register("erd", erd, [40.2, 2.3, -1.4], {
    pos: [40.2, 4.8, 8.2],
    target: [40.2, 1.3, -1.2],
    fov: 32,
  });

  // ---------- post treatment ----------
  const post = new THREE.Group();
  root.add(post);
  addBox(post, 5.6, 0.32, 3.2, MAT.concrete, 48.2, 0.16, 1.4, "post");
  addCyl(post, 0.7, 0.7, 2.6, MAT.paint, 47.3, 1.6, 1.2, "post", true, 20);
  addCyl(post, 0.55, 0.55, 2.2, MAT.stainless, 49.1, 1.4, 1.8, "post", true, 18);
  const silo = addCyl(post, 0.4, 0.46, 1.8, MAT.chemA, 49.3, 1.15, 0.15, "post");
  addBox(post, 1.4, 0.9, 0.7, MAT.steelDark, 47.4, 0.75, 2.5, "post");
  plaque(post, "后处理", "调 pH · 加矿", 48.2, 3.25, 2.4, 1.8, 0.75);
  contact(post, 3, 48.2, 1.4);
  register("post", post, [48.2, 3.2, 1.4], {
    pos: [50.5, 5.6, 9.4],
    target: [48.2, 1.6, 1.3],
    fov: 32,
  });

  // ---------- tanks ----------
  const tank = new THREE.Group();
  root.add(tank);
  [ -1.8, 2.2 ].forEach((z, i) => {
    const x = 57.5;
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.96, 28, 20), MAT.vessel);
    sphere.position.set(x, 2.22, z);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    sphere.userData.id = "tank";
    tank.add(sphere);
    addCyl(tank, 1.18, 1.42, 0.46, MAT.steelDark, x, 0.4, z, "tank", true, 20);
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.98, 0.045, 8, 28), MAT.steel);
    band.rotation.x = Math.PI / 2;
    band.position.set(x, 2.22, z);
    band.userData.id = "tank";
    tank.add(band);
    addCyl(tank, 0.07, 0.09, 0.35, MAT.steel, x, 4.28, z, "tank", false, 8);
    contact(tank, 2.3, x, z);
    if (i === 1) rails(tank, x, z, 3.6, 3.6, 0.42, "tank");
  });
  addBox(tank, 8.2, 0.28, 6.2, MAT.concrete, 57.5, 0.16, 0.2, "tank");
  plaque(tank, "淡水（产品）", "淡水水箱", 57.5, 2.4, 4.85, 2.1, 0.9);
  register("tank", tank, [57.5, 4.55, 0.2], {
    pos: [60.5, 7.2, 14],
    target: [57.5, 3.0, 0.4],
    fov: 32,
  });

  // Product water leaves the tanks and runs onto the beach, so treated water meeting land is obvious.
  const productMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      void main() {
        float along = vUv.y;
        float flow = 0.78 + 0.22 * sin(along * 18.0 - uTime * 1.6);
        float edge = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
        vec3 deep = vec3(0.2, 0.78, 0.92);
        vec3 bright = vec3(0.78, 0.97, 1.0);
        vec3 col = mix(deep, bright, flow);
        gl_FragColor = vec4(col, 0.92 * edge);
      }
    `,
  });
  tickers.push((t) => {
    productMat.uniforms.uTime.value = t;
  });
  function productSheet(x, z, w, len, y) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), productMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.renderOrder = 3;
    root.add(m);
  }
  productSheet(60.8, 11, 2.6, 14, 0.08);
  productSheet(63.4, 23, 4.2, 14, 0.05);
  productSheet(66.5, 35, 6.2, 14, 0.03);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(5.2, 32), productMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(68, 0.02, 44);
  pool.renderOrder = 3;
  root.add(pool);
  addBox(root, 1.8, 0.35, 1.2, std(0xd8e2e8, 0.2, 0.45), 61.2, 0.22, 12.4, null, false);

  // ---------- pipes ----------
  const pipeDefs = [
    {
      id: "sw1",
      kind: "sw",
      radius: 0.16,
      color: 0x7fd0d4,
      arrow: 0xb7fff6,
      speed: 0.16,
      pts: [
        [-28, 1.15, 0],
        [-22, 1.15, 0],
        [-16.5, 1.15, 0.4],
        [-14.2, 1.15, 1.1],
        [-10.6, 0.75, 1.15],
      ],
    },
    {
      id: "sw2",
      kind: "sw",
      radius: 0.16,
      color: 0x7fd0d4,
      arrow: 0xb7fff6,
      speed: 0.16,
      pts: [
        [-9.4, 0.85, 1.15],
        [-8.2, 2.55, 3.6],
        [-5.6, 2.55, 3.6],
        [-5.6, 1.45, 2.05],
      ],
    },
    {
      id: "sw3",
      kind: "sw",
      radius: 0.15,
      color: 0x7fd0d4,
      arrow: 0xb7fff6,
      speed: 0.15,
      pts: [
        [-3.0, 1.35, 0.2],
        [-1.2, 2.6, 3.4],
        [0.2, 4.15, 2.3],
        [0.2, 4.15, -2.2],
      ],
    },
    {
      id: "sw4",
      kind: "sw",
      radius: 0.16,
      color: 0x7fd0d4,
      arrow: 0xb7fff6,
      speed: 0.17,
      pts: [
        [0.9, 2.3, 0],
        [4.2, 2.55, 3.5],
        [8.6, 2.55, 3.5],
        [10.5, 2.4, 2.2],
        [13.2, 1.15, 0.4],
      ],
    },
    {
      id: "dose",
      kind: "chem",
      radius: 0.05,
      color: 0xc9b6e8,
      arrow: 0xe4d2ff,
      speed: 0.1,
      pts: [
        [8.9, 0.55, 2.2],
        [10.2, 1.4, 2.6],
        [11.4, 2.15, 3.2],
      ],
    },
    {
      id: "hp",
      kind: "hp",
      radius: 0.18,
      color: 0x9aecf2,
      arrow: 0xf2ffff,
      speed: 0.26,
      pts: [
        [18.5, 1.55, 0.15],
        [21.2, 2.7, 0.3],
        [24.2, 2.7, 0.2],
        [24.7, 2.4, 0.2],
      ],
    },
    {
      id: "perm",
      kind: "fw",
      radius: 0.12,
      color: 0xd5f1ff,
      arrow: 0xf7fdff,
      speed: 0.15,
      pts: [
        [31.3, 1.15, 2.4],
        [36.5, 1.35, 3.3],
        [43.5, 1.55, 2.6],
        [47.3, 2.4, 1.2],
      ],
    },
    {
      id: "fw",
      kind: "fw",
      radius: 0.13,
      color: 0xd5f1ff,
      arrow: 0xf7fdff,
      speed: 0.14,
      pts: [
        [49.2, 1.7, 1.6],
        [52.6, 2.6, 3.2],
        [56.2, 3.6, 2.4],
        [57.5, 4.3, 2.2],
      ],
    },
    {
      id: "product",
      kind: "fw",
      radius: 0.28,
      color: 0x9eebff,
      arrow: 0xf4feff,
      speed: 0.16,
      pts: [
        [57.5, 0.85, 2.4],
        [60.4, 0.55, 7.5],
        [61.2, 0.28, 12.2],
        [61.4, 0.12, 16.5],
      ],
    },
    {
      id: "brine",
      kind: "br",
      radius: 0.14,
      color: 0xe6b48a,
      arrow: 0xffd0a6,
      speed: 0.2,
      pts: [
        [31.3, 3.3, -0.4],
        [35.5, 2.5, -1.5],
        [38.8, 1.4, -1.5],
      ],
    },
    {
      id: "boost",
      kind: "hp",
      radius: 0.1,
      color: 0x8fd8c8,
      arrow: 0xd8fff4,
      speed: 0.18,
      pts: [
        [40.6, 1.15, -0.6],
        [41.6, 0.9, 0.35],
        [36.5, 2.3, 1.2],
        [26.5, 2.7, 0.6],
        [24.9, 2.5, 0.3],
      ],
    },
    {
      id: "outfall",
      kind: "br",
      radius: 0.14,
      color: 0xc9895c,
      arrow: 0xffc49a,
      speed: 0.18,
      pts: [
        [41.6, 1.25, -1.5],
        [44, 1.15, -4.6],
        [20, 1.05, -6.2],
        [-2, 0.9, -6.4],
        [-16, 0.45, -5.5],
        [-24, -0.2, -4.2],
        [-30, -0.6, -3.2],
      ],
    },
  ];

  pipeDefs.forEach((d) => {
    const curve = curveFrom(d.pts);
    const len = curve.getLength();
    const segs = Math.max(16, Math.ceil(len / 0.4));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, d.radius, 8, false), glass(d.color));
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    root.add(mesh);
    flows.push({
      curve,
      len,
      radius: d.radius,
      color: d.arrow,
      speed: d.speed,
      kind: d.kind,
    });
  });

  // diffuser
  for (let i = 0; i < 4; i++) {
    addCyl(root, 0.08, 0.1, 0.8, MAT.steel, -30, -0.2, -4.2 + i * 0.7, null, false, 8);
  }

  // Unit cone (radius 0.5, length 1). Instances scale to sit inside each pipe.
  const arrowGeo = new THREE.ConeGeometry(0.5, 1, 5);
  arrowGeo.translate(0, 0.32, 0);
  const dummy = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  const ax = new THREE.Vector3(1, 0, 0);
  const ay = new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const bin = new THREE.Vector3();
  const off = new THREE.Vector3();

  const flowMeshes = flows.map((f) => {
    const count = Math.max(5, Math.round(f.len / 2.35));
    const arrowR = f.radius * 0.36;
    const arrowL = Math.min(0.4, Math.max(0.12, f.radius * 2.35));
    const mat = new THREE.MeshBasicMaterial({
      color: f.color,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const arrows = new THREE.InstancedMesh(arrowGeo, mat, count);
    arrows.frustumCulled = false;
    arrows.renderOrder = 3;
    arrows.count = count;
    root.add(arrows);
    const pCount = Math.max(8, Math.round(f.len * 1.35));
    const pPos = new Float32Array(pCount * 3);
    const phases = new Float32Array(pCount);
    const angs = new Float32Array(pCount);
    const rads = new Float32Array(pCount);
    for (let i = 0; i < pCount; i++) {
      phases[i] = Math.random();
      angs[i] = Math.random() * Math.PI * 2;
      rads[i] = f.radius * (0.12 + Math.random() * 0.38);
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const pts = new THREE.Points(
      pg,
      new THREE.PointsMaterial({
        size: Math.min(0.2, f.radius * 0.95),
        map: sprite,
        transparent: true,
        opacity: f.kind === "br" ? 0.38 : 0.5,
        depthWrite: false,
        color: f.color,
        blending: THREE.NormalBlending,
        sizeAttenuation: true,
      })
    );
    pts.frustumCulled = false;
    pts.renderOrder = 3;
    root.add(pts);
    return { f, arrows, count, pCount, pPos, phases, angs, rads, pg, pts, fullP: pCount, fullA: count, arrowR, arrowL };
  });

  const flowState = { amount: 1, particleScale: 1, arrowOpacity: 1 };

  function placeOnCurve(curve, t, target) {
    const u = ((t % 1) + 1) % 1;
    curve.getPointAt(u, target);
    curve.getTangentAt(Math.min(u, 0.999), tangent);
    if (tangent.lengthSq() < 1e-6) tangent.set(1, 0, 0);
    else tangent.normalize();
  }

  tickers.push((t, dt, running) => {
    const rate = flowState.amount;
    flowMeshes.forEach((fm) => {
      const showA = Math.max(1, Math.round(fm.fullA * Math.max(0.45, flowState.particleScale)));
      const showP = Math.max(1, Math.round(fm.fullP * flowState.particleScale));
      fm.arrows.count = showA;
      fm.pts.material.opacity = (fm.f.kind === "br" ? 0.32 : 0.4) * flowState.arrowOpacity;
      fm.arrows.material.opacity = 0.92 * flowState.arrowOpacity;
      const shift = (t * fm.f.speed * rate) % 1;
      const inset = Math.min(0.08, (fm.arrowL * 0.55) / Math.max(fm.f.len, 0.5));
      const span = 1 - inset * 2;
      for (let i = 0; i < showA; i++) {
        const u0 = (i / showA + shift) % 1;
        placeOnCurve(fm.f.curve, inset + u0 * span, pos);
        dummy.position.copy(pos);
        dummy.quaternion.setFromUnitVectors(up, tangent);
        dummy.scale.set(fm.arrowR * 2, fm.arrowL, fm.arrowR * 2);
        dummy.updateMatrix();
        fm.arrows.setMatrixAt(i, dummy.matrix);
      }
      fm.arrows.instanceMatrix.needsUpdate = true;
      const attr = fm.pg.attributes.position;
      for (let i = 0; i < fm.pCount; i++) {
        if (i >= showP) {
          fm.pPos[i * 3 + 1] = -999;
          continue;
        }
        fm.phases[i] = (fm.phases[i] + dt * fm.f.speed * rate * 0.85) % 1;
        placeOnCurve(fm.f.curve, fm.phases[i], pos);
        const ref = Math.abs(tangent.y) > 0.85 ? ax : ay;
        nrm.crossVectors(tangent, ref).normalize();
        bin.crossVectors(tangent, nrm).normalize();
        off.copy(nrm).multiplyScalar(Math.cos(fm.angs[i]) * fm.rads[i]);
        off.addScaledVector(bin, Math.sin(fm.angs[i]) * fm.rads[i]);
        fm.pPos[i * 3] = pos.x + off.x;
        fm.pPos[i * 3 + 1] = pos.y + off.y;
        fm.pPos[i * 3 + 2] = pos.z + off.z;
      }
      attr.needsUpdate = true;
    });
  });

  // Industrial massing in process bands: silo row, hall and vents, pipe rack, shore spheres.
  // Scenery only — clickable unit ids stay on the RO train. Clear of both patrol loops.
  {
    const siloZ = -8.35;
    const siloX = [-12.8, -10.5, -8.2, -5.9, -3.6, -1.3, 1.0, 3.3];
    const siloH = [9.2, 10.6, 8.4, 11.2, 9.0, 10.4, 8.8, 10.0];
    siloX.forEach((x, i) => {
      const h = siloH[i];
      addCyl(root, 0.78, 0.78, h, MAT.vessel, x, h / 2 + 0.18, siloZ, null, true, 20);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.78, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), MAT.vessel);
      cap.position.set(x, h + 0.18, siloZ);
      cap.castShadow = true;
      root.add(cap);
      addCyl(root, 0.96, 1.12, 0.34, MAT.steelDark, x, 0.22, siloZ, null, true, 16);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.03, 6, 18), MAT.steel);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, h * 0.62, siloZ);
      ring.castShadow = true;
      root.add(ring);
    });
    const manifold = addCyl(root, 0.16, 0.16, 17.4, MAT.stainless, -4.75, 2.35, siloZ + 0.95, null, true, 12);
    manifold.rotation.z = Math.PI / 2;
    siloX.forEach((x) => {
      const drop = addCyl(root, 0.07, 0.07, 0.95, MAT.stainless, x, 2.35, siloZ + 0.48, null, false, 8);
      drop.rotation.x = Math.PI / 2;
    });

    // Long process hall plus a taller bay, north of the train and south of the outer patrol.
    addBox(root, 15.2, 5.15, 3.35, MAT.hall, 32.4, 2.72, -10.45, null, true);
    addBox(root, 15.5, 0.28, 3.65, MAT.hallDark, 32.4, 5.38, -10.45, null, true);
    addBox(root, 5.2, 7.2, 3.75, MAT.hall, 43.6, 3.75, -10.28, null, true);
    addBox(root, 5.5, 0.32, 4.05, MAT.hallDark, 43.6, 7.45, -10.28, null, true);
    addBox(root, 3.4, 4.05, 2.9, MAT.hallDark, 40.5, 2.18, -10.5, null, true);
    addBox(root, 1.3, 0.7, 1.1, MAT.steelDark, 30.2, 5.85, -10.5, null, true);
    addBox(root, 1.6, 0.9, 1.2, MAT.steelDark, 34.6, 5.95, -10.2, null, true);
    const glass = std(0xc5dcea, 0.2, 0.12, { emissive: 0x9fd4ea, emissiveIntensity: 0.18 });
    [-2.4, 0.4, 3.2].forEach((dx) => {
      addBox(root, 2.1, 1.35, 0.08, glass, 32.4 + dx, 2.55, -8.72, null, false);
    });
    addBox(root, 1.8, 1.7, 0.08, glass, 43.6, 3.3, -8.35, null, false);

    function stack(x, z, baseY, h) {
      addCyl(root, 0.34, 0.42, h, MAT.hallDark, x, baseY + h / 2, z, null, true, 12);
      addCyl(root, 0.5, 0.5, 0.16, MAT.steel, x, baseY + h, z, null, true, 12);
    }
    stack(29.4, -10.45, 5.5, 6.6);
    stack(43.6, -10.28, 7.6, 5.4);
    stack(35.8, -10.45, 5.5, 3.2);

    const steamSprite = softCircle();
    function steam(x, z, y0, n, rise) {
      const positions = new Float32Array(n * 3);
      const phases = Array.from({ length: n }, (_, i) => i / n);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({
        size: 0.85,
        map: steamSprite,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        color: 0xf4f7f8,
      }));
      pts.frustumCulled = false;
      root.add(pts);
      tickers.push((t) => {
        for (let i = 0; i < n; i++) {
          const p = (phases[i] + t * 0.1) % 1;
          positions[i * 3] = x + Math.sin(p * 7 + i) * p * 0.55;
          positions[i * 3 + 1] = y0 + p * rise;
          positions[i * 3 + 2] = z + Math.cos(p * 5 + i) * p * 0.4;
        }
        geo.attributes.position.needsUpdate = true;
      });
    }
    steam(29.4, -10.45, 12.2, 14, 5.2);
    steam(43.6, -10.28, 13.15, 14, 4.6);
    steam(-10.5, siloZ, 10.9, 8, 3.2);
    steam(-5.9, siloZ, 11.5, 8, 3.4);

    // Pipe rack behind the silo row. Teaching cameras sit on the south side, so this stays out of those shots.
    const rackZ = -11.25;
    [-8, -2, 4].forEach((x) => {
      addBox(root, 0.14, 2.05, 0.14, MAT.steelDark, x, 1.08, rackZ - 0.38, null, true);
      addBox(root, 0.14, 2.05, 0.14, MAT.steelDark, x, 1.08, rackZ + 0.38, null, true);
      addBox(root, 0.16, 0.1, 1.05, MAT.steel, x, 2.12, rackZ, null, false);
    });
    const header = addCyl(root, 0.22, 0.22, 16, MAT.stainless, -1, 1.55, rackZ - 0.12, null, true, 14);
    header.rotation.z = Math.PI / 2;
    const headerB = addCyl(root, 0.14, 0.14, 16, MAT.yellow, -1, 2.05, rackZ + 0.16, null, true, 12);
    headerB.rotation.z = Math.PI / 2;

    // Heavy sleeper run on the south brick edge, in front of the service road and behind every unit camera.
    [-2, 10, 22, 34, 46].forEach((x) => {
      addBox(root, 1.15, 0.28, 0.7, MAT.concreteDark, x, 0.18, 16.75, null, true);
    });
    const sleeper = addCyl(root, 0.42, 0.42, 54, MAT.stainless, 22, 0.62, 16.7, null, true, 16);
    sleeper.rotation.z = Math.PI / 2;
    const sleeperB = addCyl(root, 0.24, 0.24, 54, MAT.steel, 22, 1.15, 17.15, null, true, 14);
    sleeperB.rotation.z = Math.PI / 2;
    const sleeperC = addCyl(root, 0.13, 0.13, 54, MAT.yellow, 22, 1.05, 16.22, null, true, 10);
    sleeperC.rotation.z = Math.PI / 2;

    // White product spheres grouped on the east pad, off the dunes and the freshwater channel.
    [[65.2, -6.2, 2.15], [70.4, -3.2, 1.7], [72.4, -6.8, 1.35], [67.2, -0.4, 1.22], [62.0, -2.2, 1.05]].forEach(([x, z, r]) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), MAT.vessel);
      s.position.set(x, r + 0.18, z);
      s.castShadow = true;
      s.receiveShadow = true;
      root.add(s);
      addCyl(root, r * 0.58, r * 0.74, 0.34, MAT.steelDark, x, 0.22, z, null, true, 16);
      const eq = new THREE.Mesh(new THREE.TorusGeometry(r + 0.02, 0.035, 6, 20), MAT.steel);
      eq.rotation.x = Math.PI / 2;
      eq.position.set(x, r + 0.18, z);
      root.add(eq);
    });
    addBox(root, 0.16, 5.6, 0.16, MAT.steel, 70.4, 2.8, -9.5, null, true);
    addBox(root, 0.16, 5.6, 0.16, MAT.steel, 73.2, 2.8, -9.5, null, true);
    addBox(root, 3.2, 0.14, 0.16, MAT.yellow, 71.8, 5.55, -9.5, null, true);
    addBox(root, 0.07, 1.15, 0.07, MAT.steelDark, 71.8, 4.85, -9.5, null, false);

    function flowRun(x0, x1, z, mat, w = 0.12) {
      addBox(root, x1 - x0, 0.03, w, mat, (x0 + x1) / 2, 0.048, z, null, false);
    }
    function flowTap(x, z0, z1, mat) {
      addBox(root, 0.2, 0.03, Math.abs(z1 - z0), mat, x, 0.05, (z0 + z1) / 2, null, false);
    }
    flowRun(-14, 58, 4.85, MAT.flow, 0.72);
    flowRun(-12, 54, 5.85, MAT.flow, 0.28);
    flowRun(-12, 46, -5.15, MAT.flowGold, 0.55);
    [-12.2, -4.5, 4.8, 16.2, 28, 40.2, 52].forEach((x, i) => {
      flowTap(x, 4.85, 6.35, i % 2 ? MAT.flowGold : MAT.flow);
      if (x < 48) flowTap(x, -5.15, -6.15, i % 2 ? MAT.flow : MAT.flowGold);
    });
    flowTap(-9.6, -4.3, 3.5, MAT.flow);
    flowTap(21.8, 2.5, 4.85, MAT.flowGold);
  }

  // default focus: RO cutaway
  tickers.forEach((fn) => fn(0, 0.016, true));

  const focusDefault = new THREE.Vector3(28, 1.7, 2.6);

  return {
    root,
    pick,
    units,
    focusDefault,
    readout,
    fx,
    flowState,
    plaques,
    seabed: null,
    coast: { seaY, heightAt: islandHeightAt },
    tick(dt, t, running) {
      tickers.forEach((fn) => fn(t, dt, running));
    },
  };
}

export function redrawPlaques() {
  // Plaques are drawn at creation. Fonts load before createPlant in main.
}
