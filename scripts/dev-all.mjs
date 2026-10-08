import {spawn} from 'node:child_process';

const children = ['dev','server'].map(name => {
  const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm',['run',name],{stdio:'inherit',shell:false});
  child.on('error',error => {console.error(`${name} failed:`,error);stop(1);});
  child.on('exit',code => {if (!stopping) stop(code || 0);});
  return child;
});
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
  process.exitCode = code;
}
process.on('SIGINT',()=>stop(130));
process.on('SIGTERM',()=>stop(143));
