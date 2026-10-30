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

function concreteMap() {
  return canvasTex(512, 512, (g) => {
    g.fillStyle = "#b4b9b4";
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2400; i++) {
      const a = Math.random() * 0.05;
      g.fillStyle = Math.random() > 0.5 ? `rgba(130,140,150,${a})` : `rgba(255,255,255,${a})`;
      g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    g.strokeStyle = "rgba(150, 158, 166, 0.45)";
    g.lineWidth = 4;
    for (let i = 0; i <= 512; i += 128) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, 512);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i);
      g.lineTo(512, i);
      g.stroke();
    }
    for (let i = 0; i < 1800; i++) {
      const a = Math.random() * 0.06;
      g.fillStyle = `rgba(255,255,255,${a})`;
      g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
  });
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
  const valid = [];
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = x0 + (i / nx) * (x1 - x0);
      const z = z0 + (j / nz) * (z1 - z0);
      const sdf = islandSdf(x, z);
      const on = sdf <= 18;
      // Shore sits just under still water so the edge is a beach, not a rim.
      const y = sdf >= 0
        ? -0.22 - Math.min(sdf, 18) * 0.08
        : -0.22 + Math.min(1, -sdf / 12) * 0.2;
      valid.push(on);
      positions.push(x, y, z);
      uvs.push(x * 0.04, z * 0.04);
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

  const sandTex = canvasTex(512, 512, (g) => {
    g.fillStyle = "#8d5a2b";
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 5000; i++) {
      const a = 0.08 + Math.random() * 0.16;
      g.fillStyle = Math.random() > 0.55 ? `rgba(62,32,14,${a})` : `rgba(150,96,48,${a})`;
      g.fillRect(Math.random() * 512, Math.random() * 512, 3, 2);
    }
  });
  sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping;
  sandTex.repeat.set(8, 8);
  const sandMat = std(0xa56a38, 0.0, 0.94, { map: sandTex });
  // The plant sits on an island. Open ocean (js/ocean.js) surrounds it.
  const island = new THREE.Mesh(buildIslandGeometry(), sandMat);
  island.receiveShadow = true;
  island.castShadow = false;
  root.add(island);
  function dune(x, z, rx, ry, rz, rot) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 16), sandMat);
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
  dune(42, 36, 20, 2.3, 8, -0.25);
  dune(68, 30, 18, 2.8, 8, 0.4);
  dune(78, 14, 14, 2.6, 8, 0.2);
  dune(-8, 22, 14, 1.9, 6, 0.2);

  const cmap = concreteMap();
  cmap.wrapS = cmap.wrapT = THREE.RepeatWrapping;
  cmap.repeat.set(18, 10);
  const groundMat = std(0xb7bdb6, 0.02, 0.9, { map: cmap });
  const ground = new THREE.Mesh(new THREE.BoxGeometry(92, 0.8, 36), groundMat);
  ground.position.set(28, -0.4, 0);
  ground.receiveShadow = true;
  root.add(ground);

  addBox(root, 2.2, 3.2, 42, MAT.concreteDark, -16.2, -0.3, 0, null, true);

  const seaY = -0.18;
  const stain = new THREE.Mesh(
    new THREE.PlaneGeometry(38, 0.85),
    std(0x7d8680, 0.18, 0.42)
  );
  stain.rotation.y = Math.PI / 2;
  stain.position.set(-17.34, seaY + 0.42, 0);
  root.add(stain);

  function hill(x, z, rx, ry, rz, rot) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), std(0x8a5e32, 0.0, 0.94));
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
    addCyl(filter, 0.62, 0.62, 3.15, MAT.paint, 0.2, 2.05, z, "filter", true, 22);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), MAT.paint);
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
    addCyl(tank, 1.7, 1.7, 4.8, MAT.tank, x, 2.6, z, "tank", true, 28);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.7, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), MAT.tank);
    dome.position.set(x, 5.0, z);
    dome.castShadow = true;
    dome.userData.id = "tank";
    tank.add(dome);
    addCyl(tank, 0.08, 0.1, 0.5, MAT.steel, x, 5.7, z, "tank", false, 8);
    // level window
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(0.28, 2.2),
      new THREE.MeshBasicMaterial({ color: 0x9ee7ff, transparent: true, opacity: 0.85 })
    );
    win.position.set(x, 2.5, z + 1.71);
    tank.add(win);
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 1.45),
      new THREE.MeshBasicMaterial({ color: 0x1ec8d4, transparent: true, opacity: 0.95 })
    );
    water.position.set(x, 2.15, z + 1.73);
    tank.add(water);
    addBox(tank, 0.15, 4.2, 0.15, MAT.rail, x + 1.85, 2.3, z, "tank", false);
    contact(tank, 2.1, x, z);
    if (i === 1) rails(tank, x, z, 3.2, 3.2, 5.05, "tank");
  });
  addBox(tank, 3.2, 0.35, 6.4, MAT.concrete, 57.5, 0.18, 0.2, "tank");
  plaque(tank, "淡水（产品）", "淡水水箱", 57.5, 3.4, 4.3, 2.1, 0.9);
  register("tank", tank, [57.5, 6.2, 0.2], {
    pos: [60.5, 7.2, 14],
    target: [57.5, 3.0, 0.4],
    fov: 32,
  });

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
