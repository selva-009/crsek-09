const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8075;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end('nf');}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await new Promise(r=>server.listen(PORT,r));
 const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'],headless:'new'});
 const p=await b.newPage();await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
 const errs=[];p.on('pageerror',e=>errs.push(String(e).slice(0,150)));
 await p.goto('http://localhost:'+PORT+'/',{waitUntil:'networkidle2'});
 await p.evaluate(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('crsek09_seen_tutorial','1');});
 await p.reload({waitUntil:'networkidle2'});
 await p.waitForSelector('#nameInput',{visible:true});await p.type('#nameInput','Selva');await p.click('#nameGo');
 await p.waitForSelector('#practiceBtn',{visible:true});await p.click('#practiceBtn');
 // play one ball so the fielders scatter, then wait for the gap between balls
 for(let i=0;i<200;i++){
   const ph=await p.evaluate(()=>{const a=window.__crsek,s=a.state;if(!s)return null;
     const t=document.getElementById('tossOverlay');if(!t.classList.contains('hidden')){document.getElementById('tossBat').click();}
     if(a.role==='bowl'&&s.phase==='delivery'){const x=document.querySelector('[data-act="release"]');if(x)x.click();}
     if(a.role==='bat'&&s.phase==='flight'){const x=document.querySelector('[data-shot="drive"]');if(x)x.click();}
     return s.phase;});
   if(ph==='ready') break;
   await wait(150);
 }
 await wait(2500);   // let them jog back
 const sample=async()=>p.evaluate(()=>{
   const v=window.__crsek.view3d;
   const people=v.scene.children.filter(c=>c.userData&&c.userData.joints&&c.userData.role==='field'&&c.visible);
   return people.slice(0,4).map(c=>({
     knee:+c.userData.joints.legL.knee.rotation.x.toFixed(2),
     hip:+c.userData.joints.legL.hip.rotation.x.toFixed(2),
     pos:[+c.position.x.toFixed(1),+c.position.z.toFixed(1)]
   }));
 });
 const a1=await sample(); await wait(300); const a2=await sample();
 const moved = a1.map((f,i)=>({
   kneeDelta:+Math.abs(f.knee-a2[i].knee).toFixed(3),
   posDelta:+Math.hypot(f.pos[0]-a2[i].pos[0], f.pos[1]-a2[i].pos[1]).toFixed(2)
 }));
 const st=await p.evaluate(()=>{const s=window.__crsek.state;
   const homes=window.__crsek.runner.fielders.map(f=>({d:+Math.hypot(f.x-f.homeX,f.y-f.homeY).toFixed(1), own:!!f.ownerId}));
   return {phase:s.phase, maxDistFromHome:Math.max(...homes.map(h=>h.d))};});
 await p.screenshot({path:require('path').resolve(__dirname,'fielders.png')});
 console.log(JSON.stringify({state:st, animStability:moved, errors:errs.slice(0,4)},null,1));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
