import type {AudioFrame} from '../types';
const shapes:Record<string,Record<string,number>>={sil:{jawOpen:0},PP:{jawOpen:0,mouthPucker:.3},FF:{jawOpen:.15},TH:{jawOpen:.25},DD:{jawOpen:.3},kk:{jawOpen:.4},CH:{jawOpen:.25,mouthPucker:.4},SS:{jawOpen:.16},nn:{jawOpen:.2},RR:{jawOpen:.25,mouthPucker:.3},aa:{jawOpen:.85},E:{jawOpen:.4,mouthSmile:.3},I:{jawOpen:.2,mouthSmile:.5},O:{jawOpen:.55,mouthPucker:.7},U:{jawOpen:.25,mouthPucker:.9}};
export function mapViseme(audio?:AudioFrame):Record<string,number>|null {
 if(!audio?.speaking||!audio.visemes)return null;
 const cue=audio.visemes.find(v=>Number.isFinite(v.atMs)&&Number.isFinite(v.durationMs)&&v.durationMs>0&&audio.playbackMs>=v.atMs&&audio.playbackMs<v.atMs+v.durationMs);
 return {...(shapes[cue?.value||'sil']||shapes.sil)};
}
