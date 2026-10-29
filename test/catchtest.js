const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8067;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.fbx':'application/octet-stream','.glb':'model/gltf-binary'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end('nf');}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await new Promise(r=>server.listen(PORT,r));
 const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'],headless:'new'});
 const p=await b.newPage();await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
 const errs=[];p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
 await p.goto('http://localhost:'+PORT+'/',{waitUntil:'networkidle2'});
 await p.evaluate(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('crsek09_seen_tutorial','1');});
 await p.reload({waitUntil:'networkidle2'});
 await p.waitForSelector('#nameInput',{visible:true});await p.type('#nameInput','Selva');await p.click('#nameGo');
 // wait for the FBX to parse
 let ready=false;
 for(let i=0;i<60;i++){
   ready=await p.evaluate(()=>!!(window.CatchAnim&&window.CatchAnim.ready));
   if(ready)break; await wait(200);
 }
 const meta=await p.evaluate(()=>({ready:!!CatchAnim.ready, clip:CatchAnim.clip&&CatchAnim.clip.name, dur:CatchAnim.clip&&+CatchAnim.clip.duration.toFixed(2), err:CatchAnim.error}));
 await p.waitForSelector('#practiceBtn',{visible:true});await p.click('#practiceBtn');
 await wait(2500);
 // trigger the catch and sample the keeper's arm over time
 const samples=await p.evaluate(async ()=>{
   const v=window.__crsek.view3d;
   v.playCatch();
   const out=[];
   const keeper=v.scene.children.find(c=>c.userData&&c.userData.role==='keep');
   for(let i=0;i<6;i++){
     await new Promise(r=>setTimeout(r,180));
     out.push({ t:i*180, arm:+keeper.userData.joints.armL.shoulder.rotation.x.toFixed(2),
                env:+(window.__crsek.view3d && 0)||0 });
   }
   return out;
 });
 await p.screenshot({path:require('path').resolve(__dirname,'catch.png')});
 console.log(JSON.stringify({meta, armOverTime:samples, errors:errs.slice(0,4)},null,1));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
