import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {vertexShader,fragmentShader} from './shaders/hologramShader';
import {ShaderProfiles,selectShaderProfile,type ShaderProfileName} from './ShaderProfiles';
import type {HIOInput,AvatarState,Profile} from '../types';

export class Renderer {
 readonly canvas:HTMLCanvasElement;
 private scene=new THREE.Scene();
 private camera=new THREE.PerspectiveCamera(34,1,.1,50);
 private gl:THREE.WebGLRenderer;
 private composer:EffectComposer;
 private bloom:UnrealBloomPass;
 private group=new THREE.Group();
 private material:THREE.ShaderMaterial;
 private meshes:THREE.Mesh[]=[];
 private rings:THREE.Mesh[]=[];
 private points?:THREE.Points;
 private dead=false;
 private observer:ResizeObserver;
 private contextLost=false;
 model:'loading'|'ready'|'failed'='loading';
 error?:string;
 profile:ShaderProfileName='full';
 private operator?:Profile;
 setProfile(profile:Profile|'auto'){this.operator=profile==='auto'?undefined:profile;}
 select(input:HIOInput){this.profile=selectShaderProfile(input.cognition,input.telemetry,this.operator);}
 private lose=(e:Event)=>{e.preventDefault();this.contextLost=true;this.error='Graphics context lost. Restart avatar to recover.';this.model='failed';};
 constructor(private container:HTMLElement,modelUrl?:string){
  this.gl=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  this.canvas=this.gl.domElement;this.canvas.className='mx-hologram-canvas';this.canvas.setAttribute('aria-label','Animated Microfixd holographic head');
  this.gl.setClearColor(0x000000,1);this.gl.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
  this.camera.position.set(0,.12,6.8);this.camera.lookAt(0,-.05,0);
  this.material=new THREE.ShaderMaterial({vertexShader,fragmentShader,transparent:true,depthWrite:true,side:THREE.FrontSide,uniforms:{time:{value:0},flickerIntensity:{value:0},noiseLevel:{value:.01},distortionLevel:{value:0},reveal:{value:1},minimal:{value:0},strictMode:{value:0},blink:{value:0},profileColor:{value:new THREE.Color(0,1,1)},tintMix:{value:0},opacity:{value:.85}}});
  this.scene.add(this.group);
  // Projector rings are actual scene geometry, independent of the facial mesh.
  for(let i=0;i<7;i++){
   const ring=new THREE.Mesh(new THREE.TorusGeometry(.65+i*.15,.003+(i===0?.006:0),6,160),new THREE.MeshBasicMaterial({color:new THREE.Color(i%3===0?0x8866ff:0x25dcf5).multiplyScalar(1.5),transparent:true,opacity:.85-i*.06}));
   ring.rotation.x=Math.PI/2;ring.position.y=-1.64+i*.009;this.scene.add(ring);this.rings.push(ring);
  }
  const emitter=new THREE.Mesh(new THREE.CylinderGeometry(.11,.15,.012,48),new THREE.MeshBasicMaterial({color:new THREE.Color(.1,3,3.5)}));emitter.position.y=-1.63;this.scene.add(emitter);
  const positions=new Float32Array(1600*3);
  // Seeded particle field: stable across mounts and captures.
  let seed=173;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<positions.length;i+=3){positions[i]=(random()-.5)*6;positions[i+1]=(random()-.5)*4.5;positions[i+2]=(random()-.5)*3-1;}
  const dust=new THREE.BufferGeometry();dust.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const stars=new THREE.Points(dust,new THREE.PointsMaterial({color:0x278fa6,size:.007,transparent:true,opacity:.23,depthWrite:false}));this.scene.add(stars);
  this.composer=new EffectComposer(this.gl);this.composer.addPass(new RenderPass(this.scene,this.camera));
  this.bloom=new UnrealBloomPass(new THREE.Vector2(512,512),.7,.5,.55);this.composer.addPass(this.bloom);this.composer.addPass(new OutputPass());
  container.appendChild(this.canvas);this.canvas.addEventListener('webglcontextlost',this.lose);
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);this.resize();
  void this.loadModel(modelUrl||new URL('../assets/head.glb',import.meta.url).href);
 }
 private resize(){const w=Math.max(1,this.container.clientWidth),h=Math.max(1,this.container.clientHeight);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.gl.setSize(w,h,false);this.composer.setSize(w,h);}
 async loadModel(url:string){
  try{
   const gltf=await new GLTFLoader().loadAsync(url);
   if(this.dead){gltf.scene.traverse(n=>{if(n instanceof THREE.Mesh){n.geometry.dispose();const mats=Array.isArray(n.material)?n.material:[n.material];mats.forEach(m=>m.dispose());}});return;}
   gltf.scene.updateMatrixWorld(true);
   const box=new THREE.Box3().setFromObject(gltf.scene),center=box.getCenter(new THREE.Vector3()),scale=3.2/box.getSize(new THREE.Vector3()).y;
   gltf.scene.traverse(node=>{
    if(!(node instanceof THREE.Mesh))return;
    const geometry=node.geometry.clone();geometry.applyMatrix4(node.matrixWorld);geometry.translate(-center.x,-center.y,-center.z);geometry.scale(scale,scale,scale);
    const pos=geometry.getAttribute('position');for(let i=0;i<pos.count;i++)pos.setX(i,pos.getX(i)*(.65+.35*THREE.MathUtils.smoothstep(pos.getY(i),-1.5,-.65)));
    const mats=Array.isArray(node.material)?node.material:[node.material];mats.forEach(m=>m.dispose());node.geometry.dispose();
    // This licensed scan has no original facial rig. Add bounded, explicitly derived targets.
    const base=geometry.getAttribute('position');const jaw=new Float32Array(base.count*3),smile=new Float32Array(base.count*3),brow=new Float32Array(base.count*3);
    for(let i=0;i<base.count;i++){
     const x=base.getX(i),y=base.getY(i),z=base.getZ(i);const front=THREE.MathUtils.smoothstep(z,.25,.65);
     const mouth=Math.exp(-((x/.38)**4)-((y-.02)/.32)**4)*front;
     jaw[i*3+1]=-.13*mouth*THREE.MathUtils.smoothstep(-y,-.06,.2);jaw[i*3+2]=.02*mouth;
     smile[i*3]=Math.sign(x)*.035*mouth;smile[i*3+1]=.025*mouth;
     brow[i*3+1]=-.025*Math.exp(-(((Math.abs(x)-.24)/.18)**2)-((y-.84)/.13)**2)*front;
    }
    geometry.morphTargetsRelative=true;geometry.morphAttributes.position=[new THREE.BufferAttribute(jaw,3),new THREE.BufferAttribute(smile,3),new THREE.BufferAttribute(brow,3)];
    geometry.morphAttributes.position.forEach((a:THREE.BufferAttribute,i:number)=>a.name=['jawOpen','mouthSmile','browFurrow'][i]);
    const mesh=new THREE.Mesh(geometry,this.material);mesh.updateMorphTargets();this.meshes.push(mesh);this.group.add(mesh);
    const pointGeometry=new THREE.BufferGeometry();pointGeometry.setAttribute('position',base.clone());
    this.points=new THREE.Points(pointGeometry,new THREE.PointsMaterial({color:0x45dbff,size:.012,transparent:true,opacity:.45,depthWrite:false,blending:THREE.AdditiveBlending}));this.group.add(this.points);
   });
   this.model='ready';
  }catch(e){if(!this.dead){this.model='failed';this.error=e instanceof Error?e.message:String(e);}}
 }
 update(state:AvatarState,time:number,reduced:boolean){
  if(this.dead||this.contextLost)return;
  const u=this.material.uniforms,p=ShaderProfiles[this.profile];u.profileColor.value.setRGB(...p.color);u.tintMix.value=this.profile==='diagnostic'?.6:this.profile==='error'?.8:0;u.opacity.value=state.alpha;this.bloom.strength=p.glow*1.3;
  u.time.value=reduced?0:time;u.flickerIntensity.value=this.profile==='minimal'||reduced?0:Math.max(p.flicker,state.flicker);
  u.noiseLevel.value=this.profile==='minimal'||reduced?0:Math.max(p.noise,state.noise);u.distortionLevel.value=this.profile==='minimal'||reduced?0:Math.max(p.distortion,state.distortion);
  u.reveal.value=state.bootProgress;u.minimal.value=this.profile==='minimal'?1:0;u.strictMode.value=['safe','strict'].includes(state.policyMode)?1:0;u.blink.value=state.blink;
  this.group.rotation.set(state.headPose.pitch,state.headPose.yaw,state.headPose.roll);
  this.group.position.y=reduced?0:Math.sin(time*.8)*.009;
  for(const mesh of this.meshes){for(const [name,value]of Object.entries(state.blendshapes)){const index=mesh.morphTargetDictionary?.[name];if(index!==undefined&&mesh.morphTargetInfluences)mesh.morphTargetInfluences[index]=value;}}
  if(this.points){this.points.visible=this.profile!=='minimal'&&state.bootProgress>.04;(this.points.material as THREE.PointsMaterial).opacity=state.bootProgress<.8?.7:.13;}
  this.group.visible=state.bootProgress>.02;
  this.bloom.enabled=this.profile!=='minimal';
  this.composer.render();
 }
 dispose(){
  if(this.dead)return;this.dead=true;this.observer.disconnect();this.canvas.removeEventListener('webglcontextlost',this.lose);
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  this.scene.traverse(n=>{if(n instanceof THREE.Mesh||n instanceof THREE.Points){geometries.add(n.geometry);(Array.isArray(n.material)?n.material:[n.material]).forEach(m=>materials.add(m));}});
  geometries.forEach(g=>g.dispose());materials.add(this.material);materials.forEach(m=>m.dispose());this.composer.passes.forEach(p=>p.dispose());this.composer.dispose();this.gl.dispose();this.gl.forceContextLoss();this.canvas.remove();
 }
}
