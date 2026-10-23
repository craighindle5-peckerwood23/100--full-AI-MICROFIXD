import net from 'node:net';
// BuildKit --network=none must fail a direct external TCP connect, even without DNS.
const connected=await new Promise(resolve=>{
 const socket=net.connect({host:'1.1.1.1',port:443});
 const finish=value=>{socket.destroy();resolve(value);};
 socket.once('connect',()=>finish(true));socket.once('error',()=>finish(false));socket.setTimeout(2000,()=>finish(false));
});
if(connected)throw new Error('REPAIR_RUNNER_EGRESS_NOT_ISOLATED');
for(const key of Object.keys(process.env))if(/SECRET|TOKEN|API_KEY|DATABASE_URL|SUPABASE_URL/.test(key))throw new Error('REPAIR_RUNNER_SECRET_PRESENT');
console.log('REPAIR_RUNNER_ISOLATION_PROBE_PASSED');
