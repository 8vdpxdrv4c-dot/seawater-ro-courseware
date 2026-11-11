import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Static engineering detail, batched per lesson unit. No animation, pipe-route,
// picking ID, or teaching cutaway is replaced. Fasteners are instances, not objects.
const geometries = new Map();
const up = new THREE.Vector3(0, 1, 0);
function cached(key, make) {
  if (!geometries.has(key)) geometries.set(key, make());
  return geometries.get(key);
}
class Kit {
  constructor(parent, id, M) { this.parent=parent; this.id=id; this.M=M; this.batches=new Map(); this.dummy=new THREE.Object3D(); }
  add(geometry, material, p, scale=[1,1,1], rotation=[0,0,0], cast=true) {
    const key=geometry.uuid+material.uuid+(cast?'S':'N');
    if(!this.batches.has(key)) this.batches.set(key,{geometry,material,matrices:[],cast});
    const o=this.dummy; o.position.set(...p); o.rotation.set(...rotation); o.scale.set(...scale); o.updateMatrix();
    this.batches.get(key).matrices.push(o.matrix.clone());
  }
  box(p, size, mat=this.M.steelDark, cast=true) {
    this.add(cached('rounded-unit',()=>new RoundedBoxGeometry(1,1,1,2,.035)),mat,p,size,[0,0,0],cast);
  }
  cylinder(p,r,h,mat=this.M.stainless,axis='y',cast=true) {
    this.add(cached('unit-cylinder',()=>new THREE.CylinderGeometry(1,1,1,32)),mat,p,[r,h,r],
      axis==='x'?[0,0,Math.PI/2]:axis==='z'?[Math.PI/2,0,0]:[0,0,0],cast);
  }
  ball(p,size,mat=this.M.vessel) { this.add(cached('unit-sphere',()=>new THREE.SphereGeometry(1,32,16)),mat,p,size); }
  ring(p,r,t,mat=this.M.stainless,axis='y') {
    const key=`torus-${r}-${t}`;
    this.add(cached(key,()=>new THREE.TorusGeometry(r,t,8,32)),mat,p,[1,1,1],
      axis==='x'?[0,Math.PI/2,0]:axis==='y'?[Math.PI/2,0,0]:[0,0,0],false);
  }
  rod(a,b,r,mat=this.M.steelDark) {
    const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),o=this.dummy;
    const v=B.clone().sub(A);o.position.copy(A).add(B).multiplyScalar(.5);o.scale.set(r,v.length(),r);
    o.quaternion.setFromUnitVectors(up,v.normalize());o.updateMatrix();
    const geometry=cached('unit-cylinder',()=>new THREE.CylinderGeometry(1,1,1,32));
    const key=geometry.uuid+mat.uuid+'S';
    if(!this.batches.has(key)) this.batches.set(key,{geometry,material:mat,matrices:[],cast:true});
    this.batches.get(key).matrices.push(o.matrix.clone());
  }
  flange(p,r,axis='x') {
    this.cylinder(p,r,.075,this.M.flange,axis,false);
    const shift=axis==='x'?[.046,0,0]:axis==='z'?[0,0,.046]:[0,.046,0];
    const v=(u,w,offset=0)=>axis==='x'?[p[0]+offset,p[1]+u,p[2]+w]:axis==='z'?[p[0]+u,p[1]+w,p[2]+offset]:[p[0]+u,p[1]+offset,p[2]+w];
    this.ring(p,r*.88,.012,this.M.rubber,axis);
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4, q=v(Math.cos(a)*r*.76,Math.sin(a)*r*.76);
      q[0]+=shift[0];q[1]+=shift[1];q[2]+=shift[2];
      const geo=cached('hex-bolt',()=>new THREE.CylinderGeometry(1,1,1,6));
      this.add(geo,this.M.steelDark,q,[r*.09,.035,r*.09],axis==='x'?[0,0,Math.PI/2]:axis==='z'?[Math.PI/2,0,0]:[0,0,0],false);
    }
  }
  // Rounded orthogonal service pipe; tangents are straight, corners are quadratic elbows.
  pipe(points,r=.075,mat=this.M.stainless) {
    const pts=points.map(p=>new THREE.Vector3(...p)).filter((p,i,a)=>i===0||p.distanceToSquared(a[i-1])>1e-10); if(pts.length<2)return; const path=new THREE.CurvePath();let from=pts[0];
    for(let i=1;i<pts.length-1;i++) {
      const c=pts[i],a=pts[i-1],b=pts[i+1],radius=Math.min(.22,c.distanceTo(a)*.25,c.distanceTo(b)*.25);
      const enter=c.clone().add(a.clone().sub(c).normalize().multiplyScalar(radius));
      const exit=c.clone().add(b.clone().sub(c).normalize().multiplyScalar(radius));
      path.add(new THREE.LineCurve3(from,enter));path.add(new THREE.QuadraticBezierCurve3(enter,c,exit));from=exit;
    }
    path.add(new THREE.LineCurve3(from,pts.at(-1)));
    const geometry=new THREE.TubeGeometry(path,Math.max(16,points.length*8),r,10,false);
    // Each shaped service pipe is unique. Merge pipes with the same material into one geometry at flush.
    const key='pipe'+mat.uuid;
    if(!this.batches.has(key))this.batches.set(key,{pipes:[],material:mat,cast:true});
    this.batches.get(key).pipes.push(geometry);
  }
  valve(p,r=.12,axis='x') {
    this.cylinder(p,r*1.2,r*2.5,this.M.paintDeep,axis);
    this.rod(p,[p[0],p[1]+r*2.9,p[2]],r*.23,this.M.stainless);
    const c=[p[0],p[1]+r*3,p[2]];
    this.ring(c,r*1.8,r*.15,this.M.valve,'y');
    this.rod([c[0]-r*1.7,c[1],c[2]],[c[0]+r*1.7,c[1],c[2]],r*.12,this.M.valve);
    this.rod([c[0],c[1],c[2]-r*1.7],[c[0],c[1],c[2]+r*1.7],r*.12,this.M.valve);
  }
  gauge(p,r=.15) {
    this.cylinder(p,r,.08,this.M.flange,'z',false);
    this.cylinder([p[0],p[1],p[2]+.047],r*.83,.012,this.M.dial,'z',false);
    this.rod([p[0],p[1],p[2]+.062],[p[0]+r*.46,p[1]+r*.38,p[2]+.062],r*.035,this.M.motor);
    for(let i=0;i<9;i++) {
      const a=-Math.PI*.2+i*Math.PI*1.4/8;
      this.rod([p[0]+Math.cos(a)*r*.66,p[1]+Math.sin(a)*r*.66,p[2]+.06],
        [p[0]+Math.cos(a)*r*.75,p[1]+Math.sin(a)*r*.75,p[2]+.06],r*.018,this.M.motor);
    }
    this.rod([p[0],p[1]-.3,p[2]],[p[0],p[1]-.1,p[2]],.025,this.M.stainless);
  }
  foot(p,w=.3) {
    this.box(p,[w,.08,w],this.M.steelDark);
    for(const x of [-.32,.32]) for(const z of [-.32,.32])this.cylinder([p[0]+w*x,p[1]+.055,p[2]+w*z],.022,.035,this.M.flange,'y',false);
  }
  flush() {
    const detail=new THREE.Group();detail.name=`${this.id} • batched industrial detail`;detail.userData.detail=true;
    for(const batch of this.batches.values()) {
      let mesh;
      if(batch.pipes) {
        const positions=[],normals=[],uvs=[];
        for(const geometry of batch.pipes) {
          const g=geometry.toNonIndexed();positions.push(...g.attributes.position.array);normals.push(...g.attributes.normal.array);uvs.push(...g.attributes.uv.array);g.dispose();geometry.dispose();
        }
        const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
        g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.computeBoundingSphere();
        mesh=new THREE.Mesh(g,batch.material);
      } else {
        mesh=new THREE.InstancedMesh(batch.geometry,batch.material,batch.matrices.length);
        batch.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
      }
      mesh.castShadow=batch.cast;mesh.receiveShadow=true;mesh.userData.id=this.id;detail.add(mesh);
    }
    this.parent.add(detail);
  }
}
export function decorateUnit(id, group, M) {
  const k=new Kit(group,id,M);
  if(id==='filter') {
    for(const z of [-2.1,-.7,.7,2.1]) {
      k.ball([.2,.57,z],[.62,.27,.62]);
      for(const y of [1.0,3.15]) k.ring([.2,y,z],.625,.026,M.steelDark,'y');
      k.cylinder([.2,2.55,z+.63],.22,.10,M.flange,'z'); k.flange([.2,2.55,z+.7],.23,'z');
      k.pipe([[.2,3.95,z],[.2,4.15,z]],.08); k.gauge([.65,3.45,z+.35],.105);
      k.pipe([[-.42,1.05,z],[-1.35,1.05,z],[-1.35,.73,z]],.095);
      k.flange([-1.0,1.05,z],.17);k.valve([-1.35,.78,z],.09,'y');
      for(const x of [-.55,.95])k.foot([x,.43,z],.24);
    }
    k.pipe([[-1.35,.72,-2.3],[-1.35,.72,2.6],[1.9,.72,2.6]],.12,M.paintDeep);
  }
  if(id==='pump') {
    // Actual foot-mounted motor + multistage pump, not a featureless cylinder.
    for(const x of [14.05,15.35,17.0,18.0]) for(const z of [-.32,.62]) {
      k.box([x,.52,z],[.38,.18,.34],M.rubber);k.foot([x,.42,z],.42);
    }
    for(const z of [-.46,.76])k.box([16.1,.61,z],[5.3,.16,.18],M.steelDark);
    for(let i=0;i<12;i++) {
      const a=i*Math.PI/6;
      k.box([14.6,1.15+Math.cos(a)*.575,.15+Math.sin(a)*.575],[1.84,.055,.065],M.motor);
    }
    k.cylinder([13.5,1.15,.15],.60,.13,M.steelDark,'x');
    for(let i=0;i<6;i++)k.ring([16.72+i*.28,1.15,.15],.53,.025,M.flange,'x');
    k.flange([16.56,1.15,.15],.60);k.flange([18.3,1.15,.15],.57);
    k.box([14.75,1.86,-.12],[.7,.32,.65],M.paintDeep);
    for(const x of [14.53,14.96]) k.cylinder([x,1.86,-.48],.055,.12,M.rubber,'z',false);
    k.pipe([[18.0,1.55,.15],[18.0,2.05,.15],[18.9,2.05,.15],[18.9,1.25,.15]],.16);
    k.flange([18.55,2.05,.15],.25);k.valve([18.85,1.55,.15],.13,'y');
    for(const z of [-.55,.55]) {
      k.ball([13.3,1.59,z],[.22,.12,.22],M.stainless);k.ring([13.3,1.58,z],.245,.022,M.steelDark);
    }
    k.ring([16.4,2.15,1.35],.43,.035,M.flange,'z');
  }
  if(id==='membrane') {
    const vessels=[]; for(const z of [-2,-.85,.3,1.45])for(const y of [1.7,3.15])vessels.push([28,y,z]);vessels.push([28,3.15,2.6]);
    for(const [x,y,z] of vessels) {
      for(const end of [-1,1]) {
        const ex=x+end*2.82;
        k.flange([ex,y,z],.375);
        k.cylinder([ex+end*.09,y,z],.095,.14,M.paintDeep,'x');
        k.cylinder([ex+end*.09,y+.23,z],.065,.14,M.stainless,'x');
        k.ring([ex-end*.14,y,z],.345,.025,M.steelDark,'x');
      }
      for(const dx of [-1.65,1.65]) {
        k.ring([x+dx,y,z],.345,.02,M.steelDark,'x');
        k.box([x+dx,y-.43,z],[.36,.17,.62],M.paintDeep);
      }
      // Offset ports carry feed/concentrate along the shell. The CENTER port
      // carries only permeate, separately down to the original low product header.
      const serviceZ=z>2.5?3.15:z;
      k.pipe([[25.04,y+.23,z],[24.96,y+.23,serviceZ],[24.1,y+.23,serviceZ],[24.1,2.4,serviceZ]],.06);
      k.pipe([[30.96,y+.23,z],[31.04,y+.23,serviceZ],[32.25,y+.23,serviceZ],[32.25,3.3,serviceZ]],.06,M.concentrate);
      k.pipe([[30.99,y,z],[31.08,y,serviceZ],[31.08,1.15,serviceZ],[31.85,1.15,serviceZ]],.045,M.paint);
    }
    for(const x of [24.6,31.4]) for(const z of [-2.6,2.6]) {
      k.foot([x,.47,z],.45);

    }
    for(const x of [24.6,31.4])k.box([x,2.74,0],[.20,.14,5.3],M.paintDeep);
    for(const z of [-2.6]) {
      k.rod([24.65,.65,z],[27,4.32,z],.035,M.steelDark);
      k.rod([28.9,.65,z],[31.35,4.32,z],.035,M.steelDark);
    }
    // Central skid crossmembers and instrument block are kept behind the +Z cutaway.
    for(const y of [1.18,2.74]) for(const x of [26.35,29.65])k.box([x,y,-.2],[.16,.13,5.25],M.paintDeep);
    k.gauge([24.15,3.7,2.0],.145);k.gauge([31.8,3.7,2.0],.145);
    k.valve([24.1,2.4,-2.2],.11,'z');k.valve([32.25,3.3,-2.2],.11,'z');
  }
  if(id==='erd') {
    for(const x of [39.4,41]) {
      k.flange([x,1.35,-1.5],.57);
      for(const z of [-1.82,-1.18]){k.box([x,.57,z],[.45,.2,.28],M.paintDeep);k.foot([x,.39,z],.4);}
    }
    for(const z of [-2,-1])k.pipe([[39.1,1.35,z],[38.6,1.35,z],[38.6,.75,z],[38.2,.75,z]],.10);
    k.gauge([40.1,2.15,-.95],.15);
  }
  if(id==='post') {
    for(const [x,z,r,top] of [[47.3,1.2,.7,2.9],[49.1,1.8,.55,2.5]]) {
      k.ball([x,top,z],[r,.18,r],M.paint);k.ring([x,.6,z],r+.015,.027,M.steelDark);
      k.flange([x,top+.16,z],r*.3,'y');k.foot([x,.38,z],r*1.5);
      k.pipe([[x,1.0,z+r],[x,1.0,z+r+.35],[x+.55,1.0,z+r+.35]],.075);k.gauge([x,2.1,z+r+.07],.115);
    }
  }
  if(id==='tank') {
    for(const z of [-1.8,2.2]) {
      k.flange([57.5,4.19,z],.3,'y'); k.cylinder([57.5,4.33,z],.18,.12,M.paintDeep,'y');
      k.pipe([[59.4,2.2,z],[60,2.2,z],[60,.65,z],[59.5,.65,z]],.11);
      k.flange([60,1.0,z],.2,'y');k.valve([60,1.35,z],.11,'y');
      // Ladder beside each service hatch, with a fixed top handhold.
      for(const dz of [-.28,.28])k.rod([55.36,.42,z+dz],[55.36,4.60,z+dz],.028,M.stainless);
      for(let i=0;i<12;i++)k.rod([55.36,.65+i*.31,z-.28],[55.36,.65+i*.31,z+.28],.022,M.steelDark);
      k.foot([55.36,.39,z-.28],.23);k.foot([55.36,.39,z+.28],.23);
      k.box([56.35,4.36,z],[1.95,.07,.64],M.paintDeep);
    }
  }
  if(id==='coag') {
    k.box([-5.6,2.23,.2],[.5,.65,.5],M.motor);
    k.cylinder([-5.6,2.57,.2],.24,.09,M.steelDark,'y');
    for(const x of [-7.3,-3.9])k.foot([x,1.49,1.95],.22);
  }
  if(id==='dose') {
    for(const z of [1.35,2.2,3.05]) {
      k.cylinder([7.5,1.99,z],.11,.11,M.rubber);k.ring([7.5,.5,z],.38,.02,M.steelDark);
      k.pipe([[7.82,.66,z],[8.5,.66,z],[8.5,.48,z]],.025,M.paintDeep);
      k.cylinder([8.7,.63,z],.09,.12,M.flange,'y');
    }
  }
  if(id==='intake') {
    for(const x of [-10.65,-9.75,-9.1])k.foot([x,.28,1.15],.35);
    k.flange([-8.64,.7,1.15],.35); k.box([-10.25,1.08,1.15],[.45,.25,.45],M.motor);
  }
  k.flush();
}
