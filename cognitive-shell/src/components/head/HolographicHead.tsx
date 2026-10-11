import React from'react';
import type{ShellViewModel}from'../../integration/ShellAPI';
import{HolographicHeadCanvas}from'./HolographicHeadCanvas';
export function HolographicHead({vm}:{vm:ShellViewModel}){
  return <div className={'mx-head mx-head-volumetric '+vm.emotion} aria-label={'Microfixd cognitive presence '+vm.emotion}>
    <div className="mx-hologram-depth"><HolographicHeadCanvas vm={vm}/></div>
    <div className="mx-holo-scanlines" aria-hidden/>
    <div className="mx-holo-rim" aria-hidden/>
    <div className="mx-projection mx-projection-live" aria-hidden/>
  </div>
}