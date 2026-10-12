import React,{useEffect,useRef}from'react';
import type{ShellViewModel}from'../../integration/ShellAPI';

function energyFor(emotion:ShellViewModel['emotion']){switch(emotion){case'error':return 1.35;case'executing':return 1.2;case'thinking':return 1.1;case'waiting':return .95;case'overloaded':return 1.25;default:return .85}}

export function HolographicHeadCanvas({vm}:{vm:ShellViewModel}){
  const ref=useRef<HTMLCanvasElement>(null);
  const state=useRef({vm});
  state.current.vm=vm;
  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;
    const gl=canvas.getContext('webgl2',{alpha:true,antialias:true,premultipliedAlpha:false});if(!gl)return;
    const vert=`#version 300 es
    in vec2 aPosition;out vec2 vUv;
    void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
    const frag=`#version 300 es
    precision highp float;
    out vec4 outColor;in vec2 vUv;
    uniform vec2 uResolution;uniform float uTime,uYaw,uPitch,uEnergy,uMouth,uBlink;
    mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
    float sdEllipsoid(vec3 p,vec3 r){float k0=length(p/r);float k1=length(p/(r*r));return k0*(k0-1.)/k1;}
    float sdCapsule(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-r;}
    float mapHead(vec3 p){
      p.xz=rot(uYaw)*p.xz;p.yz=rot(uPitch)*p.yz;
      float skull=sdEllipsoid(p-vec3(0.,.28,0.),vec3(.68,.86,.62));
      float jaw=sdEllipsoid(p-vec3(0.,-.26,.04),vec3(.54,.58,.52));
      float face=min(skull,jaw);
      float neck=sdCapsule(p,vec3(0.,-.78,.02),vec3(0.,-1.38,.04),.28);
      float shoulder=sdEllipsoid(p-vec3(0.,-1.47,.12),vec3(1.18,.28,.42));
      float nose=sdEllipsoid(p-vec3(0.,.03,-.57),vec3(.12,.22,.16));
      return min(min(face,nose),min(neck,shoulder));
    }
    vec3 normalAt(vec3 p){vec2 e=vec2(.003,0.);return normalize(vec3(mapHead(p+e.xyy)-mapHead(p-e.xyy),mapHead(p+e.yxy)-mapHead(p-e.yxy),mapHead(p+e.yyx)-mapHead(p-e.yyx)));}
    float hash21(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(p.x*p.y);}
    void main(){
      vec2 uv=(gl_FragCoord.xy*2.-uResolution.xy)/max(uResolution.y,1.);
      vec3 ro=vec3(0.,-.08,3.55),rd=normalize(vec3(uv.x,uv.y,-2.35));
      float t=0.,d=0.;vec3 p;bool hit=false;
      for(int i=0;i<92;i++){p=ro+rd*t;d=mapHead(p);if(abs(d)<.0025){hit=true;break;}t+=max(abs(d)*.72,.008);if(t>7.)break;}
      vec3 col=vec3(0.);float alpha=0.;
      float scan=.78+.22*sin(gl_FragCoord.y*.72+uTime*9.);
      if(hit){
        vec3 n=normalAt(p);vec3 light=normalize(vec3(-.45,.7,.65));
        float diff=max(dot(n,light),0.);float fres=pow(1.-max(dot(n,-rd),0.),2.4);
        float core=.16+diff*.42+fres*1.45;
        vec3 cyan=vec3(.05,.92,1.);vec3 violet=vec3(.42,.18,1.);
        float side=.5+.5*n.x;col=mix(cyan,violet,side)*core*uEnergy;
        float eyeY=.23;float eyeMask=0.;
        vec2 q=vec2(p.x,p.y);
        eyeMask+=exp(-120.*length(q-vec2(-.23,eyeY))*length(q-vec2(-.23,eyeY)));
        eyeMask+=exp(-120.*length(q-vec2(.23,eyeY))*length(q-vec2(.23,eyeY)));
        eyeMask*=smoothstep(.3,.95,uBlink);
        col+=vec3(.7,1.,1.)*eyeMask*1.8;
        float mouth=exp(-150.*abs(p.y+.28))*exp(-35.*abs(p.x));
        col+=vec3(.1,.9,1.)*mouth*(.25+uMouth*1.3);
        alpha=clamp(.36+diff*.25+fres*.42,0.,.9)*scan;
      }
      float aura=exp(-3.2*length(vec2(uv.x,uv.y+.12)))*(.25+.15*sin(uTime*1.7));
      col+=vec3(.02,.55,1.)*aura*uEnergy;
      alpha=max(alpha,aura*.16);
      float particles=step(.9935,hash21(floor(gl_FragCoord.xy/2.)+floor(uTime*6.)))*smoothstep(.25,1.2,length(uv));
      col+=particles*vec3(.12,.8,1.);alpha=max(alpha,particles*.45);
      outColor=vec4(col,alpha);
    }`;
    const compile=(type:number,source:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'shader compile failed');return s};
    let program:WebGLProgram;
    try{program=gl.createProgram()!;gl.attachShader(program,compile(gl.VERTEX_SHADER,vert));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,frag));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'shader link failed')}catch(error){console.error('[cognitive-shell] WebGL hologram unavailable',error);return}
    const buffer=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const loc=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);gl.useProgram(program);
    const U=(name:string)=>gl.getUniformLocation(program,name);
    const uResolution=U('uResolution'),uTime=U('uTime'),uYaw=U('uYaw'),uPitch=U('uPitch'),uEnergy=U('uEnergy'),uMouth=U('uMouth'),uBlink=U('uBlink');
    let raf=0;let blink=1;let blinkTarget=1;let nextBlink=performance.now()+1800;
    const resize=()=>{const dpr=Math.min(window.devicePixelRatio||1,2);const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);const rw=Math.round(w*dpr),rh=Math.round(h*dpr);if(canvas.width!==rw||canvas.height!==rh){canvas.width=rw;canvas.height=rh;gl.viewport(0,0,rw,rh)}};
    const render=(now:number)=>{resize();const current=state.current.vm;if(now>nextBlink){blinkTarget=0;nextBlink=now+2200+Math.random()*2200}blink+=(blinkTarget-blink)*.32;if(blinkTarget===0&&blink<.08)blinkTarget=1;
      gl.useProgram(program);gl.uniform2f(uResolution,canvas.width,canvas.height);gl.uniform1f(uTime,now/1000);gl.uniform1f(uYaw,current.pose.yaw*Math.PI/180);gl.uniform1f(uPitch,current.pose.pitch*Math.PI/180);gl.uniform1f(uEnergy,energyFor(current.emotion));gl.uniform1f(uMouth,current.mouth==='speaking'?(.55+.45*Math.sin(now*.035)):0);gl.uniform1f(uBlink,blink);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,6);raf=requestAnimationFrame(render)};
    raf=requestAnimationFrame(render);
    return()=>{cancelAnimationFrame(raf);gl.deleteBuffer(buffer);gl.deleteProgram(program)};
  },[]);
  return <canvas ref={ref} className="mx-hologram-canvas" aria-label="Microfixd volumetric holographic cognitive presence"/>;
}