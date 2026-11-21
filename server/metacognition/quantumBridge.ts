type Gate={gate:'h'|'x'|'z'|'rz'|'cx';targets:number[];angle?:number};
interface Circuit {qubits:number;operations:Gate[]}
export function parseCircuit(input:unknown):Circuit {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('INVALID_QUANTUM_CIRCUIT');
  const c=input as Circuit;
  if(!Number.isInteger(c.qubits)||c.qubits<1||c.qubits>10||!Array.isArray(c.operations)||c.operations.length>256)throw new Error('QUANTUM_SIMULATION_LIMIT');
  if(c.operations.some(op=>!op||!['h','x','z','rz','cx'].includes(op.gate)||!Array.isArray(op.targets)||op.targets.length!==(op.gate==='cx'?2:1)||new Set(op.targets).size!==op.targets.length||op.targets.some(q=>!Number.isInteger(q)||q<0||q>=c.qubits)||op.gate==='rz'&&(typeof op.angle!=='number'||!Number.isFinite(op.angle))))throw new Error('UNSUPPORTED_QUANTUM_OPERATION');
  return {qubits:c.qubits,operations:c.operations.map(op=>({gate:op.gate,targets:[...op.targets],...(op.gate==='rz'?{angle:op.angle}:{})}))};
}
/** Exact ideal state-vector simulation on a classical CPU; no hardware or quantum advantage claim. */
export function simulateQuantumCircuit(input:unknown){
  const c=parseCircuit(input),size=2**c.qubits,re=new Float64Array(size),im=new Float64Array(size);re[0]=1;
  for(const op of c.operations){
    const bit=1<<op.targets[0];
    if(op.gate==='cx'){
      const target=1<<op.targets[1];for(let i=0;i<size;i++)if((i&bit)&&!(i&target)){const j=i|target;[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}
    }else if(op.gate==='rz'){
      for(let i=0;i<size;i++){const angle=(i&bit?1:-1)*op.angle!/2,cos=Math.cos(angle),sin=Math.sin(angle),r=re[i];re[i]=r*cos-im[i]*sin;im[i]=r*sin+im[i]*cos;}
    }else for(let i=0;i<size;i++)if(!(i&bit)){
      const j=i|bit;
      if(op.gate==='h'){const r=re[i],m=im[i];re[i]=(r+re[j])/Math.SQRT2;im[i]=(m+im[j])/Math.SQRT2;re[j]=(r-re[j])/Math.SQRT2;im[j]=(m-im[j])/Math.SQRT2;}
      else if(op.gate==='x'){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}
      else {re[j]=-re[j];im[j]=-im[j];}
    }
  }
  const probabilities=Array.from({length:size},(_,i)=>({basis:i.toString(2).padStart(c.qubits,'0'),probability:re[i]**2+im[i]**2})).filter(v=>v.probability>1e-14);
  const python=`# Classical ideal quantum-circuit simulator; Python 3 standard library only.\nimport json, math, cmath\nc = json.loads(${JSON.stringify(JSON.stringify(c))})\ns = [0j] * (1 << c['qubits'])\ns[0] = 1+0j\nfor op in c['operations']:\n    b = 1 << op['targets'][0]\n    if op['gate'] == 'cx':\n        t = 1 << op['targets'][1]\n        for i in range(len(s)):\n            if i & b and not i & t:\n                s[i], s[i|t] = s[i|t], s[i]\n    elif op['gate'] == 'rz':\n        for i in range(len(s)):\n            s[i] *= cmath.exp(1j * (1 if i & b else -1) * op['angle']/2)\n    else:\n        for i in range(len(s)):\n            if i & b: continue\n            j = i | b\n            if op['gate'] == 'h': s[i], s[j] = (s[i]+s[j])/math.sqrt(2), (s[i]-s[j])/math.sqrt(2)\n            elif op['gate'] == 'x': s[i], s[j] = s[j], s[i]\n            else: s[j] = -s[j]\nprint(json.dumps({format(i, '0'+str(c['qubits'])+'b'): abs(a)**2 for i,a in enumerate(s) if abs(a)**2 > 1e-14}))\n`;
  return {mode:'classical_ideal_simulation',quantum_hardware_verified:false,qubits:c.qubits,operations:c.operations.length,
    probabilities,normalization:probabilities.reduce((sum,p)=>sum+p.probability,0),bit_order:'q[n-1]...q[0]',
    resources:{complex_amplitudes:size,minimum_float64_state_bytes:size*16,time_complexity:'O(gates * 2^qubits)'},
    classical_python:python,limitations:['Maximum 10 qubits and 256 gates.','Supported gates: h, x, z, rz, cx.','No noise model, physical hardware, mid-circuit measurement, or quantum speedup.']};
}
