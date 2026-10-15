import React,{useEffect,useRef}from'react';
import type{ShellViewModel}from'../../integration/ShellAPI';

function energyFor(emotion:ShellViewModel['emotion']){
  switch(emotion){case'error':return 1.35;case'executing':return 1.2;case'thinking':return 1.1;case'waiting':return .95;case'overloaded':return 1.25;default:return .85}
}

export function HolographicHeadCanvas({vm}:{vm:ShellViewModel}){
  const ref=useRef<HTMLCanvasElement>(null);
  const state=useRef({vm});state.current.vm=vm;
  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;
    const gl=canvas.getContext('webgl2',{alpha:true,antialias:true,premultipliedAlpha:false,preserveDrawingBuffer:false});if(!gl)return;
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
    float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
    float smax(float a,float b,float k){return -smin(-a,-b,k);}
    float hash21(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(p.x*p.y);}
    float hash31(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}

    float mapHead(vec3 p){
      p.xz=rot(uYaw)*p.xz;p.yz=rot(uPitch)*p.yz;
      float skull=sdEllipsoid(p-vec3(0.,.30,.02),vec3(.64,.82,.59));
      float jaw=sdEllipsoid(p-vec3(0.,-.24,-.01),vec3(.50,.55,.47));
      float face=smin(skull,jaw,.18);
      float cheekL=sdEllipsoid(p-vec3(-.30,-.03,-.38),vec3(.22,.22,.18));
      float cheekR=sdEllipsoid(p-vec3(.30,-.03,-.38),vec3(.22,.22,.18));
      face=smin(face,min(cheekL,cheekR),.08);
      float noseBridge=sdEllipsoid(p-vec3(0.,.09,-.53),vec3(.105,.26,.13));
      float noseTip=sdEllipsoid(p-vec3(0.,-.02,-.62),vec3(.14,.12,.13));
      face=smin(face,smin(noseBridge,noseTip,.06),.05);
      float chin=sdEllipsoid(p-vec3(0.,-.56,-.23),vec3(.24,.16,.19));
      face=smin(face,chin,.08);
      float earL=sdEllipsoid(p-vec3(-.61,.05,.0),vec3(.10,.22,.07));
      float earR=sdEllipsoid(p-vec3(.61,.05,.0),vec3(.10,.22,.07));
      face=smin(face,min(earL,earR),.06);
      float eyeL=sdEllipsoid(p-vec3(-.235,.205,-.535),vec3(.15,.075,.09));
      float eyeR=sdEllipsoid(p-vec3(.235,.205,-.535),vec3(.15,.075,.09));
      float sockets=min(eyeL,eyeR);
      face=smax(face,-sockets,.045);
      float mouthCut=sdEllipsoid(p-vec3(0.,-.315,-.475),vec3(.25,.035+.035*uMouth,.055));
      face=smax(face,-mouthCut,.035);
      float neck=sdCapsule(p,vec3(0.,-.72,.06),vec3(0.,-1.36,.10),.275);
      float shoulder=sdEllipsoid(p-vec3(0.,-1.45,.16),vec3(1.18,.29,.43));
      return smin(smin(face,neck,.12),shoulder,.16);
    }

    vec3 normalAt(vec3 p){
      vec2 e=vec2(.0022,0.);
      return normalize(vec3(
        mapHead(p+e.xyy)-mapHead(p-e.xyy),
        mapHead(p+e.yxy)-mapHead(p-e.yxy),
        mapHead(p+e.yyx)-mapHead(p-e.yyx)
      ));
    }

    float ao(vec3 p,vec3 n){
      float occ=0.,sca=1.;
      for(int i=0;i<5;i++){float h=.018+.045*float(i);float d=mapHead(p+n*h);occ+=(h-d)*sca;sca*=.72;}
      return clamp(1.-occ*4.2,0.,1.);
    }

    void main(){
      vec2 uv=(gl_FragCoord.xy*2.-uResolution.xy)/max(uResolution.y,1.);
      vec3 ro=vec3(0.,-.06,3.55),rd=normalize(vec3(uv.x,uv.y,-2.35));
      float t=0.,d=0.;vec3 p=vec3(0.);bool hit=false;
      for(int i=0;i<132;i++){p=ro+rd*t;d=mapHead(p);if(abs(d)<.0018){hit=true;break;}t+=max(abs(d)*.68,.0055);if(t>7.)break;}

      vec3 col=vec3(0.);float alpha=0.;
      float scan=.82+.18*sin(gl_FragCoord.y*.82+uTime*10.5);
      float microScan=.94+.06*sin(gl_FragCoord.y*2.3-uTime*14.);

      if(hit){
        vec3 n=normalAt(p);
        vec3 l1=normalize(vec3(-.55,.72,.62)),l2=normalize(vec3(.62,.16,.72));
        float diff1=max(dot(n,l1),0.),diff2=max(dot(n,l2),0.);
        float fres=pow(1.-max(dot(n,-rd),0.),2.8);
        float occ=ao(p,n);
        vec3 cyan=vec3(.025,.82,1.),violet=vec3(.36,.12,1.),ice=vec3(.72,1.,1.);
        float side=.5+.5*n.x;
        vec3 base=mix(cyan,violet,side*.72+.12*sin(p.y*3.+uTime*.3));
        float material=.11+diff1*.36+diff2*.16+fres*1.65;
        col=base*material*occ*uEnergy;

        float faceFront=smoothstep(-.1,.72,-n.z);
        float topoX=abs(fract((p.x+.9)*10.)-.5);
        float topoY=abs(fract((p.y+1.7)*11.)-.5);
        float topo=smoothstep(.47,.495,max(topoX,topoY))*faceFront;
        col+=mix(cyan,violet,.5+.5*sin(p.y*5.))*topo*.22*uEnergy;

        vec2 q=vec2(p.x,p.y);
        float eyeL=exp(-130.*dot(q-vec2(-.235,.205),q-vec2(-.235,.205)));
        float eyeR=exp(-130.*dot(q-vec2(.235,.205),q-vec2(.235,.205)));
        float eyes=(eyeL+eyeR)*smoothstep(.04,.42,uBlink);
        col+=ice*eyes*(1.5+.35*sin(uTime*2.));
        float mouth=exp(-180.*abs(p.y+.315))*exp(-32.*abs(p.x));
        col+=cyan*mouth*(.18+uMouth*1.45);

        float dataNoise=step(.91,hash31(floor((p+2.)*26.)));
        float dissolve=smoothstep(.18,.82,(-p.z+.05)+.18*sin(p.y*7.+uTime*.8));
        col+=dataNoise*dissolve*vec3(.2,.9,1.)*.55;

        alpha=clamp((.34+diff1*.2+diff2*.08+fres*.52)*occ,0.,.94)*scan*microScan;
      }

      float silhouette=0.;
      if(!hit){
        float glowT=t;vec3 gp=ro+rd*min(glowT,4.4);
        float gd=abs(mapHead(gp));
        silhouette=exp(-10.*gd);
      }
      col+=silhouette*vec3(.03,.46,1.)*.16*uEnergy;alpha=max(alpha,silhouette*.08);

      float aura=exp(-2.65*length(vec2(uv.x*.86,uv.y+.12)))*(.18+.08*sin(uTime*1.55));
      col+=mix(vec3(.01,.34,1.),vec3(.28,.08,1.),.5+.5*uv.x)*aura*uEnergy;
      alpha=max(alpha,aura*.11);

      vec2 cell=floor(gl_FragCoord.xy/2.);
      float spark=step(.9958,hash21(cell+floor(uTime*5.)));
      float rimBand=smoothstep(.25,1.15,length(vec2(uv.x,uv.y+.08)));
      col+=spark*rimBand*vec3(.15,.9,1.)*(.7+.3*sin(uTime*8.+cell.x));
      alpha=max(alpha,spark*.5);

      float beam=exp(-7.*abs(uv.x))*.018*smoothstep(-1.2,.3,-uv.y);
      col+=beam*vec3(.05,.65,1.);alpha=max(alpha,beam);

      outColor=vec4(col,alpha);
    }`;

    const compile=(type:number,source:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'shader compile failed');return s};
    let program:WebGLProgram;
    try{
      program=gl.createProgram()!;
      gl.attachShader(program,compile(gl.VERTEX_SHADER,vert));
      gl.attachShader(program,compile(gl.FRAGMENT_SHADER,frag));
      gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'shader link failed');
    }catch(error){console.error('[cognitive-shell] WebGL hologram unavailable',error);return}

    const buffer=gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const loc=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);gl.useProgram(program);
    const U=(name:string)=>gl.getUniformLocation(program,name);
    const uResolution=U('uResolution'),uTime=U('uTime'),uYaw=U('uYaw'),uPitch=U('uPitch'),uEnergy=U('uEnergy'),uMouth=U('uMouth'),uBlink=U('uBlink');

    let raf=0,blink=1,blinkTarget=1,nextBlink=performance.now()+1800;
    const resize=()=>{const dpr=Math.min(window.devicePixelRatio||1,2);const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);const rw=Math.round(w*dpr),rh=Math.round(h*dpr);if(canvas.width!==rw||canvas.height!==rh){canvas.width=rw;canvas.height=rh;gl.viewport(0,0,rw,rh)}};
    const render=(now:number)=>{
      resize();const current=state.current.vm;
      if(now>nextBlink){blinkTarget=0;nextBlink=now+2200+Math.random()*2200}
      blink+=(blinkTarget-blink)*.32;if(blinkTarget===0&&blink<.08)blinkTarget=1;
      gl.useProgram(program);
      gl.uniform2f(uResolution,canvas.width,canvas.height);
      gl.uniform1f(uTime,now/1000);
      gl.uniform1f(uYaw,current.pose.yaw*Math.PI/180);
      gl.uniform1f(uPitch,current.pose.pitch*Math.PI/180);
      gl.uniform1f(uEnergy,energyFor(current.emotion));
      gl.uniform1f(uMouth,current.mouth==='speaking'?(.55+.45*Math.sin(now*.035)):0);
      gl.uniform1f(uBlink,blink);
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,6);
      raf=requestAnimationFrame(render);
    };
    raf=requestAnimationFrame(render);
    return()=>{cancelAnimationFrame(raf);gl.deleteBuffer(buffer);gl.deleteProgram(program)};
  },[]);
  return <canvas ref={ref} className="mx-hologram-canvas" aria-label="Microfixd high-detail volumetric holographic cognitive presence"/>;
}
