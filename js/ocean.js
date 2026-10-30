import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { OceanSim, defaultOceanParams } from "../vendor/ultra-water/water/OceanSim.js";
import { OceanSurface } from "../vendor/ultra-water/water/OceanSurface.js";
import { bakeShoreMap } from "../vendor/ultra-water/water/shoreMap.js";
import { bakeWaterTextures } from "../vendor/ultra-water/water/bakeTextures.js";
import { WaveCaustics } from "../vendor/ultra-water/water/Caustics.js";
import { PlanarReflection } from "../vendor/ultra-water/engine/PlanarReflection.js";
import { SkySystem } from "../vendor/ultra-water/scene/sky.js";

const REFLECT_LAYER = 1;

const PROFILES = {
  low: { angular: 112, reflect: false, reflectScale: 0.32, glint: 0, caustics: false },
  mid: { angular: 168, reflect: true, reflectScale: 0.42, glint: 0.75, caustics: true },
  high: { angular: 224, reflect: true, reflectScale: 0.5, glint: 0.85, caustics: true },
};

class OpaquePass extends Pass {
  constructor(ocean) {
    super();
    this.ocean = ocean;
    this.needsSwap = false;
    this.clear = false;
  }
  setSize(w, h) {
    this.ocean.setSize(w, h);
  }
  render(renderer, writeBuffer, readBuffer) {
    this.ocean.renderOpaque(renderer, readBuffer);
  }
}

class WaterPass extends Pass {
  constructor(ocean) {
    super();
    this.ocean = ocean;
    this.needsSwap = true;
    this.clear = false;
  }
  setSize(w, h) {
    this.ocean.setSize(w, h);
  }
  render(renderer, writeBuffer, readBuffer) {
    this.ocean.compositeWater(renderer, readBuffer, writeBuffer);
  }
}

export function createCoastalOcean({ renderer, scene, camera, coast, seabed }) {
  const sky = new SkySystem(renderer);
  sky.update();
  sky.background.userData.sky = true;
  scene.add(sky.background);

  const shore = bakeShoreMap((x, z) => coast.heightAt(x, z), 560, 384);
  const params = defaultOceanParams();
  Object.assign(params, {
    windSpeed: 8.4,
    windDirection: 180,
    fetchKm: 110,
    spreadBlend: 0.82,
    windSwell: 0.32,
    shortWavesFade: 0.045,
    capillaryFade: 0.07,
    waveScale: 1,
    swellScale: 0.75,
    swellWindSpeed: 7.2,
    swellDirection: 180,
    swellFetchKm: 800,
    swellSwell: 0.9,
    choppiness: 0.78,
    foamRecovery: 0.45,
    timeScale: 1,
  });

  const sim = new OceanSim(renderer, params);
  const caustics = seabed ? new WaveCaustics(renderer, sim) : null;
  const foam = bakeWaterTextures(renderer);

  const skyLite = {
    cube: sky.cube,
    cubeSize: sky.cubeSize,
    sunDir: sky.sunDir,
    sunColor: sky.sunColor,
  };

  const surface = new OceanSurface(sim, shore, skyLite, {
    angular: PROFILES.mid.angular,
    seaLevel: coast.seaY,
  });
  surface.uniforms.uFoamTex.value = foam.foam;
  surface.uniforms.uShoreWave.value.set(0.62, 28, 1.05, 1);
  surface.uniforms.uWaveDamp.value.set(14, 0.8);
  surface.uniforms.uScatterColor.value.set(0.02, 0.08, 0.1);
  surface.uniforms.uFoam.value.set(0.28, 2.4, 0.9, 1);
  surface.uniforms.uOptics.value.set(0.02, 0.05, 0.04, 1 / 2800);
  surface.uniforms.uGlint.value = PROFILES.mid.glint;
  surface.uniforms.uCamSide.value = -1;

  if (seabed) {
    seabed.uniforms.uCaustics.value = caustics.uniforms.uCaustics.value;
    seabed.uniforms.uCausticsDeep.value = caustics.uniforms.uCausticsDeep.value;
    seabed.uniforms.uCausticSun.value.copy(skyLite.sunDir);
  }

  scene.traverse((obj) => {
    if (obj.userData && obj.userData.sky) return;
    if (obj.isLight || obj.isMesh || obj.isInstancedMesh) obj.layers.enable(REFLECT_LAYER);
  });

  const reflection = new PlanarReflection(REFLECT_LAYER);
  reflection.scale = PROFILES.mid.reflectScale;
  surface.uniforms.uReflMatrix.value = reflection.textureMatrix;

  const emptyRT = new THREE.WebGLRenderTarget(16, 16, {
    type: THREE.HalfFloatType,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
  });
  const saved = renderer.getRenderTarget();
  renderer.setRenderTarget(emptyRT);
  renderer.setClearColor(0x000000, 0);
  renderer.clear(true, false, false);
  renderer.setRenderTarget(saved);
  renderer.setClearColor(0x8ec4ef, 1);

  const waterScene = new THREE.Scene();
  waterScene.add(surface.mesh);

  const copyQuad = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: { t: { value: null } },
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform sampler2D t; void main(){ gl_FragColor = texture2D(t, vUv); }`,
  }));

  const ocean = {
    renderer,
    scene,
    camera,
    sunDir: sky.sunDir,
    sim,
    caustics,
    surface,
    reflection,
    waterScene,
    copyQuad,
    emptyRT,
    rt: null,
    level: "mid",
    reflect: true,
    causticsOn: true,
    elapsed: 0,
    hold: 6,
    hot: 0,
    ms: 0,
    dropped: false,
    frame: 0,
    _clear: new THREE.Color(),
    opaquePass: null,
    waterPass: null,

    setSize(w, h) {
      const width = Math.max(1, w | 0);
      const height = Math.max(1, h | 0);
      if (this.rt && this.rt.width === width && this.rt.height === height) return;
      this.rt?.dispose();
      const depth = new THREE.DepthTexture(width, height);
      depth.format = THREE.DepthFormat;
      depth.type = THREE.UnsignedIntType;
      depth.minFilter = THREE.NearestFilter;
      depth.magFilter = THREE.NearestFilter;
      this.rt = new THREE.WebGLRenderTarget(width, height, {
        type: THREE.HalfFloatType,
        depthTexture: depth,
        depthBuffer: true,
        stencilBuffer: false,
      });
      this.rt.texture.colorSpace = THREE.NoColorSpace;
      this.surface.uniforms.uSceneColor.value = this.rt.texture;
      this.surface.uniforms.uSceneDepth.value = depth;
      this.surface.uniforms.uResolution.value.set(width, height);
      this.reflection.setSize(width, height);
    },

    setQuality(level, manual = false) {
      const profile = PROFILES[level] ? level : "mid";
      const spec = PROFILES[profile];
      this.level = profile;
      if (manual) {
        this.hold = 8;
        this.hot = 0;
      }
      this.reflect = spec.reflect;
      this.causticsOn = spec.caustics;
      this.reflection.scale = spec.reflectScale;
      this.surface.setAngular(spec.angular);
      this.surface.uniforms.uGlint.value = spec.glint;
      if (this.rt) this.reflection.setSize(this.rt.width, this.rt.height);
    },

    update(dt, time, cam) {
      this.elapsed += dt;
      this.ms = this.ms ? this.ms * 0.9 + dt * 1000 * 0.1 : dt * 1000;
      if (this.hold > 0) this.hold -= dt;
      if (this.elapsed > 4 && this.hold <= 0 && !this.dropped && this.ms > 42) {
        this.hot += dt;
        if (this.hot > 2.4 && this.level !== "low") {
          this.dropped = true;
          this.setQuality(this.level === "high" ? "mid" : "low", false);
        }
      } else if (this.ms < 30) {
        this.hot = 0;
      }

      this.sim.update(dt);
      this.frame += 1;
      if (this.caustics && this.causticsOn && (this.level === "high" || this.frame % 2 === 0)) {
        this.caustics.update(skyLite.sunDir);
      }
      this.surface.update(cam, time);
      this.surface.uniforms.uCamSide.value = cam.position.y > coast.seaY + 0.35 ? -1 : 0;
      this.renderReflection();
    },

    renderReflection() {
      if (!this.reflect) {
        this.surface.uniforms.uReflection.value = this.emptyRT.texture;
        return;
      }
      const r = this.renderer;
      const prevTarget = r.getRenderTarget();
      const prevFace = r.getActiveCubeFace();
      const prevMip = r.getActiveMipmapLevel();
      const prevAlpha = r.getClearAlpha();
      r.getClearColor(this._clear);
      const prevBg = this.scene.background;
      const prevShadow = r.shadowMap.enabled;
      this.scene.background = null;
      r.shadowMap.enabled = false;
      this.reflection.render(r, this.scene, this.camera);
      this.scene.background = prevBg;
      r.shadowMap.enabled = prevShadow;
      r.setClearColor(this._clear, prevAlpha);
      r.setRenderTarget(prevTarget, prevFace, prevMip);
      this.surface.uniforms.uReflection.value = this.reflection.target.texture;
    },

    renderOpaque(renderer, dest) {
      this.setSize(dest.width, dest.height);
      const prev = renderer.getRenderTarget();
      const prevFace = renderer.getActiveCubeFace();
      const prevMip = renderer.getActiveMipmapLevel();
      const prevAuto = renderer.autoClear;
      renderer.autoClear = true;
      renderer.setRenderTarget(this.rt);
      renderer.clear(true, true, true);
      renderer.render(this.scene, this.camera);
      this.copyQuad.material.uniforms.t.value = this.rt.texture;
      renderer.setRenderTarget(dest);
      renderer.clear(true, true, true);
      this.copyQuad.render(renderer);
      renderer.autoClear = prevAuto;
      renderer.setRenderTarget(prev, prevFace, prevMip);
    },

    compositeWater(renderer, bloomed, dest) {
      const prev = renderer.getRenderTarget();
      const prevFace = renderer.getActiveCubeFace();
      const prevMip = renderer.getActiveMipmapLevel();
      const prevAuto = renderer.autoClear;
      renderer.autoClear = false;
      this.copyQuad.material.uniforms.t.value = bloomed.texture;
      renderer.setRenderTarget(dest);
      this.copyQuad.render(renderer);
      renderer.render(this.waterScene, this.camera);
      renderer.autoClear = prevAuto;
      renderer.setRenderTarget(prev, prevFace, prevMip);
    },
  };

  ocean.opaquePass = new OpaquePass(ocean);
  ocean.waterPass = new WaterPass(ocean);
  return ocean;
}
