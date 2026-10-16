export const vertexShader=`
#include <common>
#include <morphtarget_pars_vertex>
varying vec3 vPosition;varying vec3 vNormal;varying vec3 vView;
uniform float time;uniform float distortionLevel;
void main(){
 #include <morphinstance_vertex>
 #include <beginnormal_vertex>
 #include <morphnormal_vertex>
 #include <begin_vertex>
 #include <morphtarget_vertex>
 transformed.x+=sin(transformed.y*30.+time*2.)*distortionLevel;
 vPosition=transformed;vNormal=normalize(normalMatrix*objectNormal);
 vec4 mv=modelViewMatrix*vec4(transformed,1.);vView=-mv.xyz;
 gl_Position=projectionMatrix*mv;
}`;
export const fragmentShader=`
varying vec3 vPosition;varying vec3 vNormal;varying vec3 vView;
uniform float time;uniform float flickerIntensity;uniform float noiseLevel;uniform float reveal;uniform float minimal;uniform float strictMode;uniform float blink;uniform vec3 profileColor;uniform float tintMix;uniform float opacity;
float hash(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
void main(){
 vec3 n=normalize(vNormal);float facing=max(dot(n,normalize(vView)),0.);float rim=pow(1.-facing,2.4);
 float height=(vPosition.y+1.6)/3.2;
 if(height>reveal*1.25)discard;
 float forming=smoothstep(.2,.8,reveal);
 if(hash(floor(vPosition*100.))>forming&&reveal<.8)discard;
 vec3 cyan=vec3(.02,.78,1.);vec3 violet=vec3(.48,.16,1.);
 vec3 color=mix(cyan,violet,smoothstep(-.3,1.,vPosition.x)*(1.-strictMode*.7));
 float light=max(dot(n,normalize(vec3(-.7,.7,1.))),0.);
 float scan=.89+.11*sin(vPosition.y*215.-time*1.5);
 vec3 grid=abs(fract(vPosition*24.)-.5)/max(fwidth(vPosition*24.),vec3(.001));
 float lines=1.-min(min(grid.x,grid.y)*2.4,1.);
 float points=step(.993,hash(floor(vPosition*95.)));
 float intensity=.018+light*.08+rim*1.05+lines*.18+points*.13;
 intensity*=scan*(1.-sin(time*3.)*flickerIntensity);
 intensity+=hash(vPosition+time*.02)*noiseLevel;
 // Eye apertures on the normalized anatomical scan. No detached floating eyes.
 float eyes=exp(-pow((abs(vPosition.x)-.245)/.13,4.)-pow((vPosition.y-.70)/.039,2.));
 eyes*=smoothstep(.25,.6,vPosition.z)*(1.-blink*.9);
 color=mix(color,profileColor,tintMix)*intensity+vec3(.35,1.,1.)*eyes*1.8;
 color+=cyan*exp(-abs(height-reveal*1.25)*160.)*.8;
 gl_FragColor=vec4(color,clamp(.36+rim*.55+lines*.12+eyes*.4,.0,.95)*mix(.8,1.,minimal)*opacity*(.08+.92*smoothstep(-1.6,-.7,vPosition.y)));
}`;
