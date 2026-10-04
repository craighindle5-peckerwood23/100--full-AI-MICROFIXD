import { parentPort, workerData } from 'node:worker_threads';
import { getQuickJS } from 'quickjs-emscripten';
import { transform } from 'esbuild';
try {
  let source=workerData.code;
  if (workerData.lang==='typescript') source=(await transform(source,{loader:'ts',target:'es2022'})).code;
  const QuickJS=await getQuickJS();
  const runtime=QuickJS.newRuntime();
  runtime.setMemoryLimit(16*1024*1024);
  runtime.setMaxStackSize(512*1024);
  const deadline=Date.now()+1000;
  runtime.setInterruptHandler(()=>Date.now()>deadline);
  const vm=runtime.newContext();
  try {
    // Logging stays inside the guest heap; no host function is exposed.
    const setup=vm.evalCode('globalThis.__output=[];globalThis.console={log:(...args)=>__output.push(args.map(String).join(" "))};');
    setup.dispose();
    const result=vm.evalCode(source,'approved-sandbox.js');
    if(result.error){const err=vm.dump(result.error);result.error.dispose();throw new Error(JSON.stringify(err));}
    result.value.dispose();
    if(runtime.hasPendingJob()) throw new Error('Asynchronous jobs are not supported in this sandbox');
    const output=vm.evalCode('__output.join("\\n").slice(0,65536)');
    const stdout=vm.getString(output.value);output.dispose();
    parentPort.postMessage({success:true,stdout,stderr:'',exit_code:0});
  } finally { vm.dispose();runtime.dispose(); }
} catch(err) { parentPort.postMessage({success:false,stdout:'',stderr:String(err).slice(0,1000),exit_code:1}); }
