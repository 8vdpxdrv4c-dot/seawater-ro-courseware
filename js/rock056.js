import * as THREE from 'three';

// ambientCG Rock056 (CC0), downloaded from the five user-specified CDN URLs.
// Actual source dimensions: 2048x1024, not the claimed 2048x2048.
// Natural terrain pass: preserve source 2:1 aspect at roughly10x5 world units.
// Existing UVs encode raw world XZ; one shared fragment warp samples ALL five maps.
export const ROCK056_MAPPING=Object.freeze({tileX:10,tileZ:5,rotation:.37,warpX:2.4,warpZ:1.6});
export function sampleRock056WorldUV(x,z){
  const c=Math.cos(ROCK056_MAPPING.rotation),s=Math.sin(ROCK056_MAPPING.rotation);
  const px=c*x-s*z,pz=s*x+c*z;
  return [(px+ROCK056_MAPPING.warpX*Math.sin(pz*.055+Math.sin(px*.027)*.65))/ROCK056_MAPPING.tileX,
    (pz+ROCK056_MAPPING.warpZ*Math.sin(px*.061+Math.sin(pz*.023)*.8))/ROCK056_MAPPING.tileZ];
}
let textures;
let ready=Promise.resolve();
function getTextures() {
  if(textures)return textures;
  const loader=new THREE.TextureLoader();
  const pending=[];
  const load=(kind,srgb=false)=>{
    let resolve,reject;
    pending.push(new Promise((ok,fail)=>{resolve=ok;reject=fail;}));
    const url=new URL(`../assets/materials/Rock056/Rock056_SQ_${kind}.jpg`,import.meta.url);
    const t=loader.load(url.href,resolve,undefined,err=>reject(new Error(`Rock056 ${kind} failed to load: ${err?.message||url.pathname}`)));
    t.name=`Rock056 ${kind}`;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1,1);
    t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;
    t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;
    t.generateMipmaps=true;t.anisotropy=8;
    return t;
  };
  textures={map:load('Color',true),normalMap:load('NormalDX'),roughnessMap:load('Roughness'),
    bumpMap:load('Displacement'),aoMap:load('AmbientOcclusion')};
  // r170 maps channel=2 to the real `uv2` vertex attribute (not the old r1xx uv2 assumption).
  textures.aoMap.channel=2;
  ready=Promise.all(pending);
  return textures;
}
export function waitForRock056(){return ready;}
export function createRock056Material(wet=false) {
  const mat=new THREE.MeshStandardMaterial({name:wet?'Rock056 • coastal mainland':'Rock056 • dunes',
    color:0xffffff,metalness:0,roughness:1,...getTextures(),normalScale:new THREE.Vector2(1,-1),
    aoMapIntensity:1,bumpScale:.01});
  mat.userData={materialId:'Rock056',tileWorldUnits:[10,5],sampling:'continuous-world-warp',heightMode:'combined-normal-and-bump',heightAmplitude:.01,wetness:wet};
  mat.onBeforeCompile=shader=>{
    shader.uniforms.uRockTile={value:new THREE.Vector2(ROCK056_MAPPING.tileX,ROCK056_MAPPING.tileZ)};
    shader.uniforms.uRockBend={value:new THREE.Vector2(ROCK056_MAPPING.warpX,ROCK056_MAPPING.warpZ)};
    shader.uniforms.uRockRotation={value:new THREE.Vector2(Math.cos(ROCK056_MAPPING.rotation),Math.sin(ROCK056_MAPPING.rotation))};
    // No extra texture taps, random atlas cells, hard UV seams, blur or sphere poles.
    // Capture original map UV BEFORE macro aliases; it already equals interpolated
    // world XZ because the mesh CPU mapping includes actual scale/yaw/translation.
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <uv_pars_fragment>',`#include <uv_pars_fragment>
        uniform vec2 uRockTile,uRockRotation,uRockBend;
        vec2 rock056BaseUV(){return vMapUv;}
        vec2 rock056NaturalUV(vec2 w){
          vec2 p=vec2(uRockRotation.x*w.x-uRockRotation.y*w.y,
                      uRockRotation.y*w.x+uRockRotation.x*w.y);
          vec2 bend=vec2(uRockBend.x*sin(p.y*.055+sin(p.x*.027)*.65),
                         uRockBend.y*sin(p.x*.061+sin(p.y*.023)*.8));
          return (p+bend)/uRockTile;
        }
        vec2 rock056SurfaceUv;
        #define vMapUv rock056SurfaceUv
        #define vNormalMapUv rock056SurfaceUv
        #define vRoughnessMapUv rock056SurfaceUv
        #define vBumpMapUv rock056SurfaceUv
        #define vAoMapUv rock056SurfaceUv
      `)
      .replace('void main() {','void main() {\n rock056SurfaceUv=rock056NaturalUV(rock056BaseUV());');

    // Three r170 ordinarily chooses normalMap OR bumpMap. Add the subtle height
    // derivative after the tangent-space DX normal so the fifth image actually contributes.
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
       #if defined(USE_BUMPMAP) && defined(USE_NORMALMAP_TANGENTSPACE)
         normal=perturbNormalArb(-vViewPosition,normal,dHdxy_fwd(),faceDirection);
       #endif`);
    if(wet) {
      shader.vertexShader=shader.vertexShader
        .replace('#include <common>','#include <common>\nattribute float wetness;\nvarying float vRockWet;')
        .replace('#include <begin_vertex>','#include <begin_vertex>\nvRockWet=wetness;');
      shader.fragmentShader=shader.fragmentShader
        .replace('#include <common>','#include <common>\nvarying float vRockWet;')
        .replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=mix(vec3(1.0),vec3(.76,.80,.83),clamp(vRockWet,0.0,1.0));')
        .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,max(.28,roughnessFactor*.68),clamp(vRockWet,0.0,1.0));');
    }
  };
  mat.customProgramCacheKey=()=>`rock056-natural-warp-v2-${wet?'wet':'dry'}`;
  return mat;
}
export function mapRock056WorldXZ(mesh,name) {
  mesh.name=name;
  mesh.userData.materialId='Rock056';
  mesh.userData.mapping='raw world-XZ UV/uv2; shared shader sampling10x5m tile, rotation.37rad, continuous4-sine warp';
  mesh.updateWorldMatrix(true,false);
  const pos=mesh.geometry.attributes.position;
  const uv=new THREE.Float32BufferAttribute(new Float32Array(pos.count*2),2);
  const v=new THREE.Vector3();
  for(let i=0;i<pos.count;i++) {
    v.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);
    uv.setXY(i,v.x,v.z);
  }
  mesh.geometry.setAttribute('uv',uv);
  mesh.geometry.setAttribute('uv2',uv.clone());
  return mesh;
}
