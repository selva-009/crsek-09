const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8061;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.fbx':'application/octet-stream'};
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
 for(let i=0;i<80;i++){const ok=await p.evaluate(()=>!!(window.MeshRig&&window.MeshRig.ready));if(ok)break;await wait(200);}
 await p.waitForSelector('#practiceBtn',{visible:true});await p.click('#practiceBtn');
 // let one ball be bowled so fielders have reacted
 for(let i=0;i<120;i++){
   const ph=await p.evaluate(()=>{const a=window.__crsek,s=a.state;if(!s)return null;
     const t=document.getElementById('tossOverlay');if(!t.classList.contains('hidden')){document.getElementById('tossBat').click();}
     if(a.role==='bowl'&&s.phase==='delivery'){const x=document.querySelector('[data-act="release"]');if(x)x.click();}
     return s.phase;});
   if(ph==='ready')break; await wait(150);
 }
 // spread check: how many fielders are away from their home spot?
 const spread=await p.evaluate(()=>{
   const r=window.__crsek.runner;
   return r.fielders.map(f=>({n:f.name, d:+Math.hypot(f.x-f.homeX,f.y-f.homeY).toFixed(1), keeper:!!f.keeper}));
 });
 await p.evaluate(()=>window.__crsek.view3d.setCameraMode('top',false));
 await wait(9000);
 await p.screenshot({path:require('path').resolve(__dirname,'vis_top.png')});
 await p.evaluate(()=>window.__crsek.view3d.setCameraMode('portrait',false));
 await wait(9000);
 await p.screenshot({path:require('path').resolve(__dirname,'vis_batter.png')});
 const moved=spread.filter(f=>f.d>2).map(f=>f.n);
 console.log(JSON.stringify({fieldersMovedFromHome:moved, count:moved.length, errors:errs.slice(0,4)},null,1));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
