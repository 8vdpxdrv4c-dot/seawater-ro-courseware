import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createPlant } from "./plant.js";
import { CONTENT, STAGES, ORDER } from "./content.js";

const $ = (id) => document.getElementById(id);
const canvas = $("c");
const q = new URLSearchParams(location.search);

const PANORAMA = { pos: [58, 16, 60], target: [6, 3.2, -1], fov: 44 };
const ESTABLISH = { pos: [16, 42, 88], target: [22, 1.2, -2], fov: 32 };

const settings = {
  quality: "mid",
  dof: true,
  aperture: 0.7,
  maxBlur: 5.6,
  focusManual: false,
  focusDist: 16,
  bloomS: 0.14,
  bloomT: 0.94,
  bloomR: 0.22,
  exposure: 0.84,
  light: 1,
  flow: 1,
  fps: false,
};

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = settings.exposure;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x8ec4ef, 1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ec4ef);
scene.fog = new THREE.Fog(0xc5ddf6, 380, 820);

const camera = new THREE.PerspectiveCamera(ESTABLISH.fov, 1, 0.25, 420);
camera.position.set(...ESTABLISH.pos);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.05).texture;
scene.environmentIntensity = 0.72;

const hemi = new THREE.HemisphereLight(0x7eb6ef, 0xe4c48e, 0.52);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff2d6, 2.25);
key.position.set(58, 34, 16);
key.target.position.set(12, 0, 2);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -80;
key.shadow.camera.right = 80;
key.shadow.camera.top = 62;
key.shadow.camera.bottom = -62;
key.shadow.camera.near = 2;
key.shadow.camera.far = 220;
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.018;
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0x9ec8f0, 0.28);
rim.position.set(-30, 22, -24);
scene.add(rim);
const warm = new THREE.DirectionalLight(0xffd2b0, 0.06);
warm.position.set(48, 10, 16);
scene.add(warm);
const baseLight = { hemi: hemi.intensity, key: key.intensity, rim: rim.intensity, warm: warm.intensity, env: scene.environmentIntensity };

const plant = createPlant(scene);
const selectRing = new THREE.Mesh(
  new THREE.TorusGeometry(1.15, 0.045, 8, 48),
  new THREE.MeshBasicMaterial({ color: 0x7ee7ff, transparent: true, opacity: 0.85 })
);
selectRing.rotation.x = Math.PI / 2;
selectRing.visible = false;
scene.add(selectRing);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.48;
controls.minPolarAngle = 0.12;
controls.minDistance = 4.5;
controls.maxDistance = 130;
controls.target.set(...ESTABLISH.target);
controls.mouseButtons = {
  LEFT: THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.PAN,
};
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), settings.bloomS, settings.bloomR, settings.bloomT);
composer.addPass(bloom);
const bokeh = new BokehPass(scene, camera, { focus: 20, aperture: 0, maxblur: 0 });
bokeh.enabled = false;
composer.addPass(bokeh);
composer.addPass(new OutputPass());

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const labelAnchor = new THREE.Vector3();

let running = true;
let runTime = 0;
let flowAmt = 1;
let current = null;
let dragging = false;
let closeShot = false;
let intro = q.get("intro") !== "0";
let introFlyStarted = false;
let fly = null;
let narrating = false;
let narrToken = 0;
let emphasis = null;
let showLabels = true;
let fpsSma = 0;
const dof = { ap: 0, mb: 0 };

const QUALITY = {
  low: { dpr: 0.85, shadow: 0, particles: 0.45, maxDpr: 1 },
  mid: { dpr: 1.15, shadow: 2048, particles: 0.75, maxDpr: 1.5 },
  high: { dpr: 1.5, shadow: 2048, particles: 1, maxDpr: 2 },
};

function pickQuality() {
  if (q.get("quality")) return q.get("quality");
  const cores = navigator.hardwareConcurrency || 4;
  const coarse = matchMedia("(pointer: coarse)").matches;
  if (coarse || cores <= 4) return "low";
  if (cores >= 8) return "high";
  return "mid";
}

function applyQuality(level) {
  settings.quality = QUALITY[level] ? level : "mid";
  const spec = QUALITY[settings.quality];
  const dpr = Math.min(spec.maxDpr, (window.devicePixelRatio || 1) * (spec.dpr / 1.15));
  const ratio = Math.max(0.7, Math.min(spec.maxDpr, dpr));
  renderer.setPixelRatio(ratio);
  composer.setPixelRatio(ratio);
  key.castShadow = spec.shadow > 0;
  if (spec.shadow) key.shadow.mapSize.set(spec.shadow, spec.shadow);
  renderer.shadowMap.enabled = spec.shadow > 0;
  plant.flowState.particleScale = spec.particles;
  document.querySelectorAll("#qseg button").forEach((b) => b.classList.toggle("on", b.dataset.q === settings.quality));
  resize();
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  // Keep the subject left of the knowledge panel on wide screens.
  if (w > 980) {
    const shift = current ? w * 0.16 : w * 0.06;
    camera.setViewOffset(w, h, shift, 0, w, h);
  } else {
    camera.clearViewOffset();
  }
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
}

function ease(k) {
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
}

function startFly(pose, dur = 1200) {
  fly = {
    t0: performance.now(),
    dur,
    fromP: camera.position.clone(),
    fromT: controls.target.clone(),
    fromF: camera.fov,
    toP: new THREE.Vector3(pose.pos[0], pose.pos[1], pose.pos[2]),
    toT: new THREE.Vector3(pose.target[0], pose.target[1], pose.target[2]),
    toF: pose.fov ?? camera.fov,
  };
  controls.enabled = false;
}

function updateFly(now) {
  if (!fly) return;
  const k = Math.min(1, (now - fly.t0) / fly.dur);
  const e = ease(k);
  camera.position.lerpVectors(fly.fromP, fly.toP, e);
  controls.target.lerpVectors(fly.fromT, fly.toT, e);
  camera.fov = fly.fromF + (fly.toF - fly.fromF) * e;
  camera.updateProjectionMatrix();
  if (k >= 1) {
    fly = null;
    controls.enabled = true;
  }
}

function fmt(t) {
  const s = Math.max(0, Math.floor(t));
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}

function setRunning(on) {
  running = on;
  $("btnRun").textContent = on ? "停止运行" : "开始运行";
  $("btnRun").classList.toggle("idle", !on);
  $("runrow").classList.toggle("stopped", !on);
  $("statusline").classList.toggle("stopped", !on && !narrating);
  $("statusState").textContent = narrating ? "讲解中" : on ? "运行中" : "已停止";
}

function renderPanel(id) {
  const data = CONTENT[id] || CONTENT.overview;
  current = CONTENT[id] ? id : null;
  $("kicker").textContent = data.kicker;
  $("statusTitle").textContent = data.title;
  $("lead").textContent = data.lead;
  $("bodyText").textContent = data.body;
  $("bullets").innerHTML = data.bullets.map((b) => `<li>${b}</li>`).join("");
  $("params").innerHTML = data.params.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
  $("rokeys").hidden = id !== "membrane";
  $("btnOverview").classList.toggle("on", !current);
  document.querySelectorAll(".chips button").forEach((b) => b.classList.toggle("on", b.dataset.go === id));
  document.querySelectorAll(".lb").forEach((el) => el.classList.toggle("on", el.dataset.id === id));
  document.querySelectorAll("#timeline .stage").forEach((stage) => {
    const hit = stage.querySelector(`[data-id="${id}"]`);
    stage.classList.toggle("on", !!hit);
  });
  document.querySelectorAll("#timeline .subs button").forEach((b) => b.classList.toggle("on", b.dataset.id === id));
  if (id === "pump" || !id) {
    const mpa = plant.readout.mpa;
    const dd = [...$("params").querySelectorAll("dd")].find((n) => n.previousElementSibling?.textContent.includes("压"));
    if (id === "pump") {
      const cell = $("params").querySelector("dd");
      if (cell) cell.textContent = `约 5–8 MPa · 示意 ${mpa.toFixed(1)}`;
    }
  }
}

function focusUnit(id, dur = 1200) {
  if (id === "overview" || !id) {
    current = null;
    renderPanel(null);
    startFly(PANORAMA, dur);
    return;
  }
  const unit = plant.units[id];
  if (!unit) return;
  renderPanel(id);
  startFly(unit.pose, dur);
}

function buildLabels() {
  const root = $("labels");
  ORDER.forEach((id, i) => {
    const u = plant.units[id];
    const data = CONTENT[id];
    const el = document.createElement("button");
    el.className = "lb glass";
    el.dataset.id = id;
    const sub = data.params[0] ? data.params[0][1] : "";
    const subText = id === "pump" ? "P ≈ 5–8 MPa" : id === "membrane" ? "H₂O 透过 / 盐截留" : id === "tank" ? "淡水（产品）" : sub;
    el.innerHTML = `<i>${i + 1}</i><span><span class="nm">${data.title}</span><span class="st">${subText}</span></span>`;
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      stopNarration();
      focusUnit(id);
    });
    root.appendChild(el);
    u.el = el;
  });
}

function buildTimeline() {
  const nav = $("timeline");
  STAGES.forEach((stage, idx) => {
    if (idx) {
      const a = document.createElement("span");
      a.className = "tarr";
      a.textContent = "→";
      nav.appendChild(a);
    }
    const wrap = document.createElement("div");
    wrap.className = "stage";
    wrap.dataset.stage = stage.id;
    const name = document.createElement("button");
    name.className = "stagename";
    name.textContent = stage.name;
    name.addEventListener("click", () => {
      stopNarration();
      focusUnit(stage.steps[0].id);
    });
    const subs = document.createElement("div");
    subs.className = "subs";
    stage.steps.forEach((step) => {
      const b = document.createElement("button");
      b.textContent = step.name;
      b.dataset.id = step.id;
      b.addEventListener("click", () => {
        stopNarration();
        focusUnit(step.id);
      });
      subs.appendChild(b);
    });
    wrap.append(name, subs);
    nav.appendChild(wrap);
  });
}

function placeLabels() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  ORDER.forEach((id) => {
    const u = plant.units[id];
    labelAnchor.copy(u.label);
    labelAnchor.project(camera);
    const x = (labelAnchor.x * 0.5 + 0.5) * w;
    const y = (-labelAnchor.y * 0.5 + 0.5) * h;
    const behind = labelAnchor.z > 1;
    u.el.style.transform = `translate(-50%, -120%) translate(${x}px, ${y}px)`;
    u.el.classList.toggle("hide", !showLabels || behind || x < -80 || x > w + 80 || y < -80 || y > h + 80);
    u.el.classList.toggle("quiet", !!current && current !== id);
  });
}

function updateDof(dt) {
  const dist = camera.position.distanceTo(controls.target);
  if (dist > 34) closeShot = false;
  else if (dist < 26) closeShot = true;
  const want = settings.dof && closeShot && !dragging && !intro;
  const apT = want ? settings.aperture : 0;
  const mbT = want ? settings.maxBlur : 0;
  const k = 1 - Math.exp(-dt * 5);
  dof.ap += (apT - dof.ap) * k;
  dof.mb += (mbT - dof.mb) * k;
  // Panel units follow the Haber courseware: aperture × 1e-4, max blur × 0.001.
  bokeh.uniforms.aperture.value = dof.ap * 1e-4;
  bokeh.uniforms.maxblur.value = dof.mb * 0.001;
  const focus = settings.focusManual ? settings.focusDist : dist;
  bokeh.uniforms.focus.value = focus;
  bokeh.enabled = settings.dof && dof.mb > 0.08;
  if (settings.focusManual) $("fdV").textContent = settings.focusDist.toFixed(1);
  else $("fdV").textContent = dist.toFixed(1);
  document.documentElement.dataset.ap = dof.ap.toFixed(2);
  document.documentElement.dataset.mb = dof.mb.toFixed(2);
  document.documentElement.dataset.dist = dist.toFixed(1);
  document.documentElement.dataset.bokeh = bokeh.enabled ? "1" : "0";
}

function onCanvasClick(ev) {
  if (intro) {
    intro = false;
    fly = null;
    controls.enabled = true;
  }
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(plant.pick, false);
  if (!hits.length) return;
  stopNarration();
  focusUnit(hits[0].object.userData.id);
}

let down = null;
canvas.addEventListener("pointerdown", (e) => {
  down = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener("pointerup", (e) => {
  if (!down) return;
  const dx = e.clientX - down.x;
  const dy = e.clientY - down.y;
  down = null;
  if (dx * dx + dy * dy > 16) return;
  onCanvasClick(e);
});
controls.addEventListener("start", () => {
  dragging = true;
  if (intro) {
    intro = false;
    fly = null;
    controls.enabled = true;
  }
});
controls.addEventListener("end", () => {
  dragging = false;
});

function stopNarration() {
  narrating = false;
  narrToken++;
  $("btnNarr").classList.remove("on");
  $("btnNarr").textContent = "自动讲解";
  $("statusline").classList.remove("talk");
  if (window.speechSynthesis) speechSynthesis.cancel();
  setRunning(running);
}

function speak(text) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      setTimeout(resolve, 5200);
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = 1.02;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    u.onend = finish;
    u.onerror = finish;
    speechSynthesis.speak(u);
    setTimeout(finish, 18000);
  });
}

async function startNarration() {
  if (narrating) {
    stopNarration();
    return;
  }
  narrating = true;
  const token = ++narrToken;
  $("btnNarr").classList.add("on");
  $("btnNarr").textContent = "停止讲解";
  $("statusline").classList.add("talk");
  $("statusState").textContent = "讲解中";
  const seq = ["overview", ...ORDER];
  for (const id of seq) {
    if (token !== narrToken) return;
    focusUnit(id === "overview" ? null : id, 1100);
    const data = id === "overview" ? CONTENT.overview : CONTENT[id];
    await speak(data.speech);
    if (token !== narrToken) return;
    await new Promise((r) => setTimeout(r, 700));
  }
  if (token !== narrToken) return;
  stopNarration();
  focusUnit(null);
}

let audioCtx = null;
let sfxGain = null;
let sfxOn = false;
function ensureAudio() {
  if (audioCtx) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  audioCtx = new Ctx();
  sfxGain = audioCtx.createGain();
  sfxGain.gain.value = 0;
  sfxGain.connect(audioCtx.destination);
  const osc = audioCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 58;
  const og = audioCtx.createGain();
  og.gain.value = 0.18;
  osc.connect(og);
  og.connect(sfxGain);
  osc.start();
  const bufferSize = 2 * audioCtx.sampleRate;
  const noiseBuf = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  const noise = audioCtx.createBufferSource();
  noise.buffer = noiseBuf;
  noise.loop = true;
  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 420;
  const ng = audioCtx.createGain();
  ng.gain.value = 0.35;
  noise.connect(filter);
  filter.connect(ng);
  ng.connect(sfxGain);
  noise.start();
}

function setSfx(on) {
  sfxOn = on;
  $("btnSfx").classList.toggle("on", on);
  if (on) {
    ensureAudio();
    if (audioCtx?.state === "suspended") audioCtx.resume();
  }
}

function resetAll() {
  stopNarration();
  runTime = 0;
  setRunning(true);
  flowAmt = 1;
  showLabels = true;
  $("btnLabels").classList.add("on");
  emphasis = null;
  plant.fx.emphasis = null;
  document.querySelectorAll("#rokeys button").forEach((b) => b.classList.remove("on"));
  intro = false;
  focusUnit(null, 900);
}

function bindSlider(id, key, label, digits = 2) {
  const input = $(id);
  input.addEventListener("input", () => {
    settings[key] = parseFloat(input.value);
    $(label).textContent = settings[key].toFixed(digits);
    applyLive();
  });
}

function applyLive() {
  renderer.toneMappingExposure = settings.exposure;
  bloom.strength = settings.bloomS;
  bloom.threshold = settings.bloomT;
  bloom.radius = settings.bloomR;
  const L = settings.light;
  hemi.intensity = baseLight.hemi * L;
  key.intensity = baseLight.key * L;
  rim.intensity = baseLight.rim * L;
  warm.intensity = baseLight.warm * L;
  scene.environmentIntensity = baseLight.env * L;
  plant.flowState.arrowOpacity = Math.min(1.2, settings.flow);
  $("rowAp").classList.toggle("dim", !settings.dof);
  $("rowMb").classList.toggle("dim", !settings.dof);
  $("rowFd").classList.toggle("dim", !settings.focusManual);
  $("tgDof").classList.toggle("on", settings.dof);
  $("tgFocus").classList.toggle("on", settings.focusManual);
  $("tgFps").classList.toggle("on", settings.fps);
  $("perf").style.display = settings.fps ? "block" : "none";
}

function bindUI() {
  $("btnOverview").addEventListener("click", () => {
    stopNarration();
    focusUnit(null);
  });
  document.querySelectorAll("[data-go]").forEach((b) => {
    b.addEventListener("click", () => {
      stopNarration();
      focusUnit(b.dataset.go);
    });
  });
  $("btnRun").addEventListener("click", () => setRunning(!running));
  $("btnNarr").addEventListener("click", () => startNarration());
  $("btnSfx").addEventListener("click", () => setSfx(!sfxOn));
  $("btnLabels").addEventListener("click", () => {
    showLabels = !showLabels;
    $("btnLabels").classList.toggle("on", showLabels);
  });
  $("btnReset").addEventListener("click", resetAll);
  $("btnFull").addEventListener("click", () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  });
  $("gear").addEventListener("click", () => {
    $("settings").classList.toggle("open");
    $("gear").classList.toggle("on");
  });
  $("setX").addEventListener("click", () => {
    $("settings").classList.remove("open");
    $("gear").classList.remove("on");
  });
  $("tgDof").addEventListener("click", () => {
    settings.dof = !settings.dof;
    applyLive();
  });
  $("tgFocus").addEventListener("click", () => {
    settings.focusManual = !settings.focusManual;
    if (settings.focusManual) {
      settings.focusDist = camera.position.distanceTo(controls.target);
      $("focusDist").value = settings.focusDist.toFixed(1);
    }
    applyLive();
  });
  $("focusDist").addEventListener("input", () => {
    settings.focusManual = true;
    settings.focusDist = parseFloat($("focusDist").value);
    $("fdV").textContent = settings.focusDist.toFixed(1);
    applyLive();
  });
  $("tgFps").addEventListener("click", () => {
    settings.fps = !settings.fps;
    applyLive();
  });
  document.querySelectorAll("#qseg button").forEach((b) => {
    b.addEventListener("click", () => applyQuality(b.dataset.q));
  });
  bindSlider("aperture", "aperture", "apV");
  bindSlider("maxblur", "maxBlur", "mbV", 1);
  bindSlider("bloomS", "bloomS", "bsV");
  bindSlider("bloomT", "bloomT", "btV");
  bindSlider("bloomR", "bloomR", "brV");
  bindSlider("exposure", "exposure", "exV");
  bindSlider("light", "light", "liV");
  bindSlider("flow", "flow", "flV");
  $("btnResetSet").addEventListener("click", () => {
    Object.assign(settings, {
      dof: true,
      aperture: 0.7,
      maxBlur: 5.6,
      focusManual: false,
      bloomS: 0.14,
      bloomT: 0.94,
      bloomR: 0.22,
      exposure: 0.84,
      light: 1,
      flow: 1,
    });
    $("aperture").value = 0.7;
    $("maxblur").value = 5.6;
    $("bloomS").value = 0.14;
    $("bloomT").value = 0.94;
    $("bloomR").value = 0.22;
    $("exposure").value = 0.84;
    $("light").value = 1;
    $("flow").value = 1;
    ["apV", "mbV", "bsV", "btV", "brV", "exV", "liV", "flV"].forEach((id, i) => {
      const v = [0.7, 5.6, 0.14, 0.94, 0.22, 0.84, 1, 1][i];
      $(id).textContent = i === 1 ? v.toFixed(1) : v.toFixed(2);
    });
    applyQuality(pickQuality());
    applyLive();
  });
  document.querySelectorAll("#rokeys button").forEach((b) => {
    b.addEventListener("click", () => {
      emphasis = emphasis === b.dataset.emp ? null : b.dataset.emp;
      plant.fx.emphasis = emphasis;
      document.querySelectorAll("#rokeys button").forEach((n) => n.classList.toggle("on", n.dataset.emp === emphasis));
    });
  });
  addEventListener("keydown", (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      stopNarration();
      const list = [null, ...ORDER];
      let i = list.indexOf(current);
      i = e.key === "ArrowRight" ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
      focusUnit(list[i]);
    } else if (e.key === "Escape") {
      stopNarration();
      focusUnit(null);
    } else if (e.key === " ") {
      e.preventDefault();
      setRunning(!running);
    }
  });
}

function bootOut() {
  const boot = $("boot");
  boot.style.opacity = "0";
  setTimeout(() => {
    boot.style.display = "none";
  }, 600);
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  const now = performance.now();
  if (intro && !introFlyStarted && t > 0.2) {
    introFlyStarted = true;
    startFly(PANORAMA, 2800);
  }
  if (introFlyStarted && !fly) intro = false;
  updateFly(now);
  controls.update();
  if (running) runTime += dt;
  const targetFlow = running ? 1 : 0;
  flowAmt += (targetFlow - flowAmt) * (1 - Math.exp(-dt * 2.2));
  plant.flowState.amount = flowAmt * settings.flow;
  plant.tick(dt, t, running);
  if (current && plant.units[current]) {
    const a = plant.units[current].anchor;
    selectRing.visible = true;
    selectRing.position.set(a.x, 0.06, a.z);
    const radii = { intake: 3.2, coag: 3, filter: 3.6, dose: 2.3, pump: 3.7, membrane: 4.3, erd: 2.8, post: 2.9, tank: 4 };
    const pulse = 1 + Math.sin(t * 3) * 0.035;
    selectRing.scale.setScalar((radii[current] || 3) * pulse);
  } else {
    selectRing.visible = false;
  }
  updateDof(dt);
  if (sfxGain) {
    const g = sfxOn && running ? 0.045 : 0;
    sfxGain.gain.setTargetAtTime(g, audioCtx.currentTime, 0.08);
  }
  {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w > 980) camera.setViewOffset(w, h, current ? w * 0.16 : w * 0.06, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  placeLabels();
  if (current === "pump") {
    const cell = $("params").querySelector("dd");
    if (cell) cell.textContent = `约 5–8 MPa · 示意 ${plant.readout.mpa.toFixed(1)}`;
  }
  $("timer").textContent = `${running ? "运行中" : "已停止"} ${fmt(runTime)}`;
  composer.render();
  if (settings.fps) {
    const fps = dt > 0 ? 1 / dt : 0;
    fpsSma = fpsSma ? fpsSma * 0.9 + fps * 0.1 : fps;
    $("perf").textContent = `${fpsSma.toFixed(0)} fps`;
  }
}

async function main() {
  try {
    if (document.fonts?.ready) await document.fonts.ready;
  } catch (err) {
    /* system fonts still cover Chinese */
  }
  buildLabels();
  buildTimeline();
  bindUI();
  applyQuality(pickQuality());
  applyLive();
  setRunning(true);
  renderPanel(null);
  resize();
  addEventListener("resize", resize);
  const jump = q.get("unit");
  if (jump && plant.units[jump]) {
    intro = false;
    focusUnit(jump, 1);
    fly = null;
    const pose = plant.units[jump].pose;
    camera.position.set(...pose.pos);
    controls.target.set(...pose.target);
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
    controls.enabled = true;
  } else if (!intro) {
    camera.position.set(...PANORAMA.pos);
    controls.target.set(...PANORAMA.target);
    camera.fov = PANORAMA.fov;
    camera.updateProjectionMatrix();
  }
  plant.tick(0.016, 0, true);
  bootOut();
  clock.getDelta();
  requestAnimationFrame(frame);
}

main().catch((err) => {
  $("boot").textContent = "场景未能启动";
  console.error(err);
});
