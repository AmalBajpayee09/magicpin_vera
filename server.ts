import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createApp } from './src/api';
import { EngineStore } from './src/engine/store';

async function startServer() {
  const store=new EngineStore(process.env.PRELOAD_DATASET==='true',process.env.STATE_FILE || path.resolve('data/state.json'));
  const app=createApp(store);
  if(process.env.ENABLE_DASHBOARD==='true') {
    if(process.env.NODE_ENV!=='production') {
      const {createServer}=await import('vite');
      const vite=await createServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);
    } else {
      app.use(express.static(path.resolve('dist')));app.get('/',(_req,res)=>res.sendFile(path.resolve('dist/index.html')));
    }
  }
  const port=Number(process.env.PORT || 8080),host=process.env.HOST || '0.0.0.0';
  if(!Number.isInteger(port)||port<1||port>65535) throw new Error('Invalid PORT');
  const server=app.listen(port,host,()=>console.log(JSON.stringify({event:'server_started',host,port,version:'5.0.0'})));
  server.on('error',()=>{console.error('Server failed to bind; check HOST/PORT.');process.exitCode=1;});
  for(const sig of ['SIGTERM','SIGINT'] as const) process.on(sig,()=>server.close(()=>process.exit(0)));
}
startServer().catch(()=>{console.error('Startup failed; check configuration and state file.');process.exitCode=1;});
