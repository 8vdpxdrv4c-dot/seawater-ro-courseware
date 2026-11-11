import * as THREE from "three";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
// Visual shaders adapted from the user-provided 32KB reference (2026-11-11).
// No rain, lightning animation, HUD, demo controls, or demo objects are imported.
export const SKY_PALETTE = {
  sunDir:       new THREE.Vector3(0.916, 0.225, 0.331).normalize(),
  sunColor:     new THREE.Color(1.0, 0.72, 0.42),
  zenith:       new THREE.Color(0.055, 0.085, 0.13),
  horizon:      new THREE.Color(0.95, 0.55, 0.28),
  horizonAway:  new THREE.Color(0.16, 0.22, 0.30)
};

// Preserve the reference sun elevation and palette, but rotate its azimuth by
// 148 degrees so its warm horizon sits over this plant's NW ocean (not behind
// the opening camera on the mainland). The same vector drives shadow + FFT water.
export const COASTAL_SUN_DIRECTION=SKY_PALETTE.sunDir.clone().applyAxisAngle(new THREE.Vector3(0,1,0),THREE.MathUtils.degToRad(148));

function makeNoiseTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  let t = 2654435769;
  const rnd = () => {
    t ^= t << 13; t >>>= 0; t ^= t >> 17; t ^= t << 5; t >>>= 0;
    return t / 4294967296;
  };
  for (let i = 0; i < size * size; i++) {
    data[i * 4 + 0] = rnd() * 256; data[i * 4 + 1] = rnd() * 256;
    data[i * 4 + 2] = rnd() * 256; data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false; tex.colorSpace = THREE.NoColorSpace; tex.needsUpdate = true;
  return tex;
}

const SKY_COMMON = /* glsl */`
  uniform sampler2D tNoise;
  float n2(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return texture2D(tNoise, (i + f + 0.5) / 256.0).r;
  }
  float fbm5(vec2 p) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 5; i++) { s += a * n2(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 17.3; a *= 0.5; }
    return s / 0.96875;
  }
  float fbm3(vec2 p) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 3; i++) { s += a * n2(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 17.3; a *= 0.5; }
    return s / 0.875;
  }
`;

const SKY_HORIZON = /* glsl */`
  uniform vec3 uSunDir, uZen, uHor, uHorAway, uSunCol;
  float skyToSun(vec3 d) {
    return clamp(dot(normalize(d.xz + vec2(1e-5)), normalize(uSunDir.xz)) * 0.5 + 0.5, 0.0, 1.0);
  }
  vec3 horizonColor(vec3 d) {
    float ts = skyToSun(d);
    // Warmth is azimuthal (entire sun-facing horizon), not the disc. Keep every
    // mix under 1.0 so this band cannot pass the bloom threshold (~1.20).
    vec3 c = mix(uHorAway, uHorAway * 1.15 + vec3(0.04, 0.025, 0.016), smoothstep(0.2, 0.75, ts));
    c = mix(c, uHor * vec3(0.90, 0.82, 0.72), pow(ts, 6.0));
    c = mix(c, vec3(0.98, 0.70, 0.40), pow(ts, 34.0));
    return c;
  }
`;

const SKY_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
    gl_Position = p.xyww;
  }
`;

const SKY_FRAG = /* glsl */`
  precision highp float;
  varying vec3 vDir;
  uniform float uTime, uEnv, uFlash;
  uniform vec3  uFlashDir;
  ${SKY_COMMON}
  ${SKY_HORIZON}

  void main() {
    vec3 d = normalize(vDir);
    float h = max(d.y, 0.0);
    float mu = dot(d, uSunDir);
    float s = max(mu, 0.0);
    float ts = skyToSun(d);

    vec3 hc = horizonColor(d);
    vec3 midC = mix(vec3(0.15, 0.24, 0.36), vec3(0.72, 0.50, 0.34), pow(ts, 3.0));
    vec3 clearC = mix(hc, midC, smoothstep(0.0, 0.17, h));
    clearC = mix(clearC, vec3(0.085, 0.145, 0.24), smoothstep(0.10, 0.5, h));

    // Tight golden aureole only — no wide-angle Mie lobes (pow 4/16 etc. lit a huge
    // sky sector that then fed UnrealBloom and washed the right side of the frame).
    float sunAng = acos(clamp(mu, -1.0, 1.0));
    float aureole =
      exp(-(sunAng * sunAng) / (0.016 * 0.016)) * 0.16 +
      exp(-(sunAng * sunAng) / (0.038 * 0.038)) * 0.05;
    clearC += uSunCol * vec3(1.0, 0.78, 0.48) * aureole;

    vec2 cuv = d.xz / (h + 0.10) * vec2(0.62, 0.95);
    vec2 wind = vec2(-0.012, 0.004) * uTime;
    vec2 q = cuv + wind;
    float warp = fbm3(q * 0.45 + 7.1);
    vec2 qq = q + (warp - 0.5) * 1.3;
    float dens = fbm5(qq);
    float ridg = 1.0 - abs(2.0 * fbm3(qq * 3.1 + 5.0) - 1.0);
    dens = dens * 0.86 + (ridg - 0.6) * 0.16 * smoothstep(0.03, 0.25, h);
    float big = n2(q * 0.19 + 3.7);
    float body = dens * 0.74 + big * 0.36;
    float cov = smoothstep(0.31, 0.50, body);

    float edge = mix(0.030, 0.285, pow(ts, 1.7));
    float rag = (n2(q * 0.9 + 11.0) - 0.5) * 0.16 + (dens - 0.5) * 0.10;
    float deck = smoothstep(edge - 0.035, edge + 0.11, h + rag * (0.35 + ts));
    cov *= deck;

    float hole = smoothstep(0.972, 0.9985, mu + (dens - 0.5) * 0.012);
    cov *= 1.0 - 0.93 * hole;

    float scud = smoothstep(0.55, 0.85, fbm3(q * vec2(0.55, 1.9) + 31.0)) *
                 (1.0 - deck) * smoothstep(0.02, 0.10, h) * 0.55 * (1.0 - 0.8 * hole);

    vec2 sd = normalize(uSunDir.xz);
    float densS = fbm5(qq + sd * 0.22);
    float relief = clamp((dens - densS) * 4.5 + 0.5, 0.0, 1.0);
    float thick = smoothstep(0.40, 0.72, body);

    vec3 cool = mix(vec3(0.155, 0.195, 0.255), vec3(0.030, 0.042, 0.064), thick);
    cool *= 0.55 + 0.9 * relief * relief;
    cool += vec3(0.07, 0.10, 0.15) * pow(1.0 - thick, 3.0);

    float nearSun = pow(ts, 5.0) * exp(-max(h - edge, 0.0) * 4.5) * 0.9 + pow(s, 7.0) * 0.9;
    // Keep relief/rim hierarchy, but drop the 5+ HDR cloud-face peaks that could bloom.
    vec3 warm = (uHor * vec3(1.05, 0.70, 0.48)) * nearSun * (0.05 + 1.5 * relief * relief * relief);
    float rim = cov * (1.0 - cov) * 4.0;
    warm += uSunCol * rim * pow(ts, 4.0) * (0.35 + 0.7 * pow(s, 6.0)) * (1.0 - 0.85 * hole);
    vec3 cloudC = cool + warm;

    float fl = uFlash * pow(max(dot(d, uFlashDir), 0.0), 5.0);
    cloudC += vec3(0.55, 0.68, 1.0) * fl * (0.4 + 2.2 * dens * dens);

    cloudC = mix(cloudC, hc * 0.55 + cloudC * 0.45, exp(-h * 11.0));

    vec3 col = mix(clearC, cloudC, cov * 0.985);
    vec3 scudC = mix(vec3(0.10, 0.11, 0.14), uHor * 0.85, pow(ts, 3.0)) + uSunCol * pow(s, 24.0) * 0.15;
    col = mix(col, scudC, scud);

    float veil = (1.0 - cov * 0.92) * (1.0 - scud * 0.7);

    // Small warm-white photosphere. ~0.40° (real sun is 0.27°). Tight limb,
    // modest HDR so bloom stays a compact golden glow instead of a screen wash.
    const float SUN_R = 0.0070;
    float diskSoft = SUN_R * 0.14;
    float disk = 1.0 - smoothstep(SUN_R - diskSoft, SUN_R + diskSoft, sunAng);
    float nr = clamp(sunAng / SUN_R, 0.0, 1.0);
    float limb = 1.0 - 0.35 * nr * nr;
    vec3 photosphere = mix(vec3(1.00, 0.97, 0.90), vec3(1.00, 0.86, 0.62), smoothstep(0.25, 1.0, nr));
    float corona = exp(-pow(max(sunAng - SUN_R, 0.0) / 0.0055, 1.4));
    float sunFade = veil * (1.0 - uEnv);
    col += photosphere * disk * limb * 5.5 * sunFade;
    col += vec3(1.0, 0.78, 0.48) * corona * 0.45 * sunFade;

    if (d.y < 0.0) {
      float t = clamp(-d.y * 5.0, 0.0, 1.0);
      vec3 low = mix(uHorAway * 0.42, vec3(0.060, 0.064, 0.070), uEnv);
      low += uHor * 0.55 * pow(ts, 6.0) * exp(d.y * 7.0);
      // Horizon line must not re-introduce a 3+ HDR strip (was hc + 1.5*sunCol).
      vec3 hz = min(hc + uSunCol * pow(s, 48.0) * 0.2, vec3(0.98));
      col = mix(hz, low, smoothstep(0.0, 1.0, t));
    }
    // Env/PMREM probe only: compress sky HDR so IBL cannot carry a blown horizon.
    // Visible sky is unchanged (uEnv=0). Disc is already excluded via sunFade.
    col = mix(col, min(col, vec3(0.95)), uEnv);
    gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
  }
`;

export const SunFlareShader = {
  uniforms: {
    tDiffuse:     { value: null },
    uIntensity:   { value: 1.0 },
    uSunUV:       { value: new THREE.Vector2(0.5, 0.5) },
    uSunInFront:  { value: 0 },
    uGeomVis:     { value: 1 },
    uAspect:      { value: 1 },
    uResolution:  { value: new THREE.Vector2(1, 1) }
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uIntensity, uSunInFront, uGeomVis, uAspect;
    uniform vec2 uSunUV, uResolution;
    varying vec2 vUv;

    float probeTap(vec2 sunUV, vec2 d, float r, inout float n) {
      vec2 uv = sunUV + vec2(d.x / max(uAspect, 1e-4), d.y) * r;
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
      vec3 c = texture2D(tDiffuse, uv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      n += 1.0;
      return smoothstep(1.2, 4.0, l);
    }
    float sunProbe(vec2 sunUV) {
      float acc = 0.0;
      float n = 0.0;
      float r = 0.005;
      acc += probeTap(sunUV, vec2( 0.00,  0.00), r, n);
      acc += probeTap(sunUV, vec2( 1.00,  0.00), r, n);
      acc += probeTap(sunUV, vec2(-1.00,  0.00), r, n);
      acc += probeTap(sunUV, vec2( 0.00,  1.00), r, n);
      acc += probeTap(sunUV, vec2( 0.00, -1.00), r, n);
      acc += probeTap(sunUV, vec2( 0.71,  0.71), r, n);
      acc += probeTap(sunUV, vec2(-0.71,  0.71), r, n);
      acc += probeTap(sunUV, vec2( 0.71, -0.71), r, n);
      acc += probeTap(sunUV, vec2(-0.71, -0.71), r, n);
      return n > 0.0 ? acc / n : 0.0;
    }

    // One diameter through the sun (two opposite blades). Width and length are
    // in aspect-corrected screen units, so rays stay thin at every distance.
    float spikeLine(vec2 p, float ang, float width, float len) {
      float c = cos(ang), s = sin(ang);
      float perp = abs(p.x * s - p.y * c);
      return exp(-perp * perp / (width * width)) * exp(-dot(p, p) / (len * len));
    }

    void main() {
      vec3 base = texture2D(tDiffuse, vUv).rgb;
      if (uSunInFront < 0.5) {
        gl_FragColor = vec4(base, 1.0);
        return;
      }

      vec2 outAmt = max(max(uSunUV - vec2(1.0), -uSunUV), 0.0);
      float off = max(outAmt.x, outAmt.y);
      float edgeFade = 1.0 - smoothstep(0.0, 0.22, off);

      float onScreen = step(0.0, uSunUV.x) * step(uSunUV.x, 1.0) * step(0.0, uSunUV.y) * step(uSunUV.y, 1.0);
      float probe = mix(1.0, sunProbe(uSunUV), onScreen);
      float vis = probe * uGeomVis * edgeFade * uIntensity;
      if (vis < 0.002) {
        gl_FragColor = vec4(base, 1.0);
        return;
      }

      vec2 p = (vUv - uSunUV) * vec2(uAspect, 1.0);
      const float WIDTH = 0.0022;
      const float LEN = 0.072;
      const float ROT = 0.2618;
      float spike = 0.0;
      spike += spikeLine(p, ROT, WIDTH, LEN);
      spike += spikeLine(p, ROT + 1.0471976, WIDTH, LEN);
      spike += spikeLine(p, ROT + 2.0943951, WIDTH, LEN);
      vec3 flare = vec3(1.00, 0.96, 0.88) * min(spike, 1.0) * 0.28;
      gl_FragColor = vec4(base + flare * vis, 1.0);
    }
  `
};


export function createReferenceSky(renderer) {
  const noiseTex = makeNoiseTexture();
  const uniforms = {
    tNoise: {value:noiseTex}, uTime:{value:0}, uEnv:{value:0}, uFlash:{value:0},
    uFlashDir:{value:new THREE.Vector3(-.5,.5,-.7).normalize()},
    uSunDir:{value:COASTAL_SUN_DIRECTION.clone()}, uZen:{value:SKY_PALETTE.zenith.clone()},
    uHor:{value:SKY_PALETTE.horizon.clone()}, uHorAway:{value:SKY_PALETTE.horizonAway.clone()},
    uSunCol:{value:SKY_PALETTE.sunColor.clone()},
  };
  const material = new THREE.ShaderMaterial({uniforms, vertexShader:SKY_VERT, fragmentShader:SKY_FRAG,
    side:THREE.BackSide, depthWrite:false, depthTest:false, fog:false, toneMapped:false});
  const background = new THREE.Mesh(new THREE.BoxGeometry(2,2,2), material);
  background.name='Reference • slate cloudbank / amber horizon';
  background.frustumCulled=false; background.renderOrder=-1000; background.userData.sky=true;
  // Static clouds: one common sky for visible background, ocean and IBL. No rebakes per frame.
  const cubeSize=256;
  const cubeRT=new THREE.WebGLCubeRenderTarget(cubeSize, {type:THREE.HalfFloatType,
    minFilter:THREE.LinearMipmapLinearFilter, magFilter:THREE.LinearFilter,
    generateMipmaps:true, depthBuffer:false});
  cubeRT.texture.colorSpace=THREE.NoColorSpace;
  const bakeUniforms=THREE.UniformsUtils.clone(uniforms);
  bakeUniforms.tNoise.value=noiseTex; bakeUniforms.uEnv.value=1;
  bakeUniforms.uFace={value:0};
  const bakeFrag=SKY_FRAG.replace('varying vec3 vDir;', `varying vec2 vUv;
    uniform int uFace;
    vec3 faceDir(vec2 uv) {
      vec2 c=uv*2.0-1.0;
      if(uFace==0) return vec3(1.0,-c.y,-c.x);
      if(uFace==1) return vec3(-1.0,-c.y,c.x);
      if(uFace==2) return vec3(c.x,1.0,c.y);
      if(uFace==3) return vec3(c.x,-1.0,-c.y);
      if(uFace==4) return vec3(c.x,-c.y,1.0);
      return vec3(-c.x,-c.y,-1.0);
    }`).replace('normalize(vDir)', 'normalize(faceDir(vUv))');
  const bakeMaterial=new THREE.ShaderMaterial({uniforms:bakeUniforms,
    vertexShader:'varying vec2 vUv; void main(){vUv=uv; gl_Position=vec4(position.xy,0.0,1.0);}',
    fragmentShader:bakeFrag, depthTest:false, depthWrite:false, toneMapped:false});
  const bakeScene=new THREE.Scene();
  const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),bakeMaterial); quad.frustumCulled=false; bakeScene.add(quad);
  const previous=renderer.getRenderTarget(), face=renderer.getActiveCubeFace(), mip=renderer.getActiveMipmapLevel();
  for(let i=0;i<6;i++) {
    cubeRT.texture.generateMipmaps=i===5;
    bakeUniforms.uFace.value=i; renderer.setRenderTarget(cubeRT,i); renderer.render(bakeScene,new THREE.Camera());
  }
  renderer.setRenderTarget(previous,face,mip);
  const pmrem=new THREE.PMREMGenerator(renderer);
  const envRT=pmrem.fromCubemap(cubeRT.texture); pmrem.dispose();
  quad.geometry.dispose(); bakeMaterial.dispose();
  return {background, cube:cubeRT.texture, cubeSize,
    sunDir:uniforms.uSunDir.value,
    sunColor:new THREE.Vector3(1,.72,.42).multiplyScalar(.95),
    environment:envRT.texture, uniforms,
    dispose(){background.geometry.dispose();material.dispose();noiseTex.dispose();cubeRT.dispose();envRT.dispose();}};
}

export function createReferenceFlare(camera, sunDir, occluders) {
  const pass=new ShaderPass(SunFlareShader); pass.material.toneMapped=false;
  pass.uniforms.uIntensity.value=.72;
  const ndc=new THREE.Vector3(), view=new THREE.Vector3(), ray=new THREE.Raycaster(); ray.far=300;
  let visibility=1, nextProbe=0;
  return {pass, update(time) {
    camera.updateMatrixWorld();
    view.copy(sunDir).transformDirection(camera.matrixWorldInverse);
    const front=view.z<0;
    ndc.copy(sunDir).multiplyScalar(1000).add(camera.position).project(camera);
    pass.uniforms.uSunUV.value.set(ndc.x*.5+.5,ndc.y*.5+.5);
    pass.uniforms.uSunInFront.value=front?1:0;
    // The nine-tap HDR shader probe handles cloud/object edges. A throttled geometry
    // ray suppresses flare over bright foreground paint; no per-frame full-scene traversal.
    if(front && time>=nextProbe) {
      ray.set(camera.position,sunDir);
      visibility=ray.intersectObjects(occluders,false).length?0:1; nextProbe=time+.12;
    }
    pass.uniforms.uGeomVis.value=front?visibility:0;
    pass.uniforms.uAspect.value=camera.aspect;
  }};
}
