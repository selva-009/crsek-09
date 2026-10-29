const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8072;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end('nf');}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await new Promise(r=>server.listen(PORT,r));
 const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'],headless:'new'});
 const p=await b.newPage();await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
 const cdp=await p.target().createCDPSession();
 const errs=[];p.on('pageerror',e=>errs.push(String(e).slice(0,150)));
 await p.goto('http://localhost:'+PORT+'/',{waitUntil:'networkidle2'});
 await p.evaluate(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('crsek09_seen_tutorial','1');});
 await p.reload({waitUntil:'networkidle2'});
 await p.waitForSelector('#nameInput',{visible:true});await p.type('#nameInput','Selva');await p.click('#nameGo');
 // switch to swipe controls through the settings sheet
 await p.waitForSelector('#settingsBtn',{visible:true});await p.evaluate(()=>document.getElementById('settingsBtn').click());
 await wait(200);
 await p.evaluate(()=>{const s=document.getElementById('setCtl');s.value='swipe';s.dispatchEvent(new Event('change'));});
 await wait(150);
 await p.evaluate(()=>document.getElementById('settingsClose').click());
 await p.click('#practiceBtn');
 const out={};
 await p.evaluate(()=>{
   window.__pe=[];
   const cv=document.getElementById('pitch3d');
   ['pointerdown','pointerup','pointermove','touchstart','touchend'].forEach(t=>
     cv.addEventListener(t,()=>window.__pe.push(t),true));
 });
 // wait for our turn, then swipe up on the canvas mid-flight
 let swiped=false;
 for(let i=0;i<220 && !swiped;i++){
   const st=await p.evaluate(()=>{const a=window.__crsek,s=a.state;if(!s)return null;
     const t=document.getElementById('tossOverlay');if(!t.classList.contains('hidden')){document.getElementById('tossBat').click();}
     if(a.role==='bowl'&&s.phase==='delivery'){const x=document.querySelector('[data-act="release"]');if(x)x.click();}
     return {role:a.role,phase:s.phase,ctl:a.settings.ctl};});
   if(st&&st.role==='bat'&&st.phase==='flight'){
     // hold the ball in flight so the swipe has a stable window
     await p.evaluate(()=>{const r=window.__crsek.runner;
       if(!r.pendingDelivery||!r.pendingDelivery.traj)return;
       r.clearTimers(); r.pendingShot=null; r.phase='flight';
       r.ballStart=Date.now()-r.pendingDelivery.traj.contactAt*1000+250;});
     await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:195,y:500,id:1}]});
     await wait(40);
     await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:198,y:420,id:1}]});
     await wait(30);
     await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
     await wait(120);
     out.shot=await p.evaluate(()=>{const r=window.__crsek.runner;return r&&r.pendingShot?{type:r.pendingShot.type,dir:r.pendingShot.dir}:null;});
     out.tag=await p.evaluate(()=>{const e=document.getElementById('timingTag');return {text:e.textContent,cls:e.className};});
     out.swipeHint=await p.evaluate(()=>!!document.querySelector('.swipe-hint'));
     swiped=true; break;
   }
   await wait(140);
 }
 out.events=await p.evaluate(()=>window.__pe.slice(0,10));
 out.roleAtSwipe=await p.evaluate(()=>({role:window.__crsek.role,phase:window.__crsek.state&&window.__crsek.state.phase,ctl:window.__crsek.settings.ctl}));
 out.errors=errs.slice(0,4);
 console.log(JSON.stringify(out,null,1));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
