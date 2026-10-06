import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {config} from './config.js';
import {createMcp,createApp} from './server.js';
import {Repository} from './github.js';
import {Memory} from './memory.js';
import {indexRepository} from './indexer.js';
const cfg=config();
if(process.argv.includes('--index')){console.error(JSON.stringify(await indexRepository(new Repository(cfg),new Memory(cfg),process.env.MCP_INDEX_VECTORS!=='false')));}
else if(process.argv.includes('--stdio')){await createMcp(cfg,cfg.writes).connect(new StdioServerTransport());}
else{if(!cfg.token)throw new Error('MCP_TOKEN required for HTTP transport');if(cfg.writeToken&&cfg.writeToken===cfg.token)throw new Error('Read and write credentials must differ');const server=createApp(cfg).listen(Number(process.env.PORT)||3002,'0.0.0.0',()=>console.error('Microfixd GitHub MCP listening'));for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));}
