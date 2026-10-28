const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8087;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end('nf');}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await new Promise(r=>server.listen(PORT,r));
 const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'],headless:'new'});
 const p=await b.newPage();await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
 const cdp=await p.target().createCDPSession();
 const errors=[];p.on('pageerror',e=>errors.push(String(e).slice(0,140)));
 await p.goto('http://localhost:'+PORT+'/',{waitUntil:'networkidle2'});
 await p.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await p.reload({waitUntil:'networkidle2'});
 await p.waitForSelector('#nameInput',{visible:true});await p.type('#nameInput','Selva');await p.click('#nameGo');
 await p.waitForSelector('#practiceBtn',{visible:true});await p.click('#practiceBtn');

 const touch=async(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts});
 const out={};

 // wait for batting
 for(let i=0;i<80;i++){
   const r=await p.evaluate(()=>{const a=window.__crsek,s=a.state;if(!s)return null;
     const t=document.getElementById('tossOverlay');if(!t.classList.contains('hidden')){document.getElementById('tossBat').click();}
     return {phase:s.phase,role:a.role};});
   if(r&&r.role==='bat'){out.roleAtStart=r.role;break;}
   await wait(200);
 }
 // --- stick geometry ---
 const padBox=await p.evaluate(()=>{const r=document.getElementById('pad').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2};});
 out.padSize={w:Math.round(padBox.w),h:Math.round(padBox.h)};

 // --- 1. drag inside the pad ---
 await touch('touchStart',[{x:padBox.cx,y:padBox.cy,id:1}]);
 await wait(60);
 const dead=await p.evaluate(()=>({x:+window.__crsek.pad.x.toFixed(2),y:+window.__crsek.pad.y.toFixed(2),mag:+window.__crsek.pad.mag.toFixed(2)}));
 out.centrePress=dead;   // should be 0 — deadzone
 await touch('touchMove',[{x:padBox.cx+30,y:padBox.cy-34,id:1}]);
 await wait(60);
 out.drag=await p.evaluate(()=>{
   const pad=window.__crsek.pad;
   const nub=document.getElementById('nub').style.transform;
   return {x:+pad.x.toFixed(2),y:+pad.y.toFixed(2),mag:+pad.mag.toFixed(2),dir:pad.dir(),nubMoved:/translate\(([-0-9.]+)px/.test(nub)&&!nub.includes('translate(0px')};
 });
 // drag beyond the rim: should clamp to the boundary, not lose the finger
 await touch('touchMove',[{x:padBox.cx+400,y:padBox.cy,id:1}]);
 await wait(60);
 out.clamped=await p.evaluate(()=>{const pad=window.__crsek.pad;return {mag:+pad.mag.toFixed(2),x:+pad.x.toFixed(2),stillActive:pad.pointerId!==null};});
 // --- 2. release snaps back ---
 await touch('touchEnd',[]);
 await wait(80);
 out.released=await p.evaluate(()=>{
   const pad=window.__crsek.pad;
   return {x:pad.x,y:pad.y,mag:pad.mag,active:pad.active,nub:document.getElementById('nub').style.transform};
 });

 // --- 3. page must not scroll while dragging ---
 await p.evaluate(()=>{window.scrollTo(0,0);});
 await touch('touchStart',[{x:padBox.cx,y:padBox.cy,id:2}]);
 await touch('touchMove',[{x:padBox.cx,y:padBox.cy-60,id:2}]);
 await touch('touchMove',[{x:padBox.cx,y:padBox.cy-140,id:2}]);
 await wait(60);
 out.scrollY=await p.evaluate(()=>window.scrollY);
 await touch('touchEnd',[]);

 // --- 4. touching a shot button must not move the stick, and must fire a shot ---
 let btn=null;
 for(let i=0;i<160;i++){
   const ready=await p.evaluate(()=>{const a=window.__crsek,s=a.state;if(!s)return false;
     if(a.role==='bat'&&s.phase==='flight'&&document.querySelector('[data-shot="drive"]'))return true;
     if(a.role==='bowl'&&s.phase==='delivery'){const x=document.querySelector('[data-act="release"]');if(x)x.click();}
     return false;});
   if(ready){
     btn=await p.evaluate(()=>{const b=document.querySelector('[data-shot="drive"]');const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
     break;
   }
   await wait(150);
 }
 if(!btn){out.shotFired='no batting window found';}
 if(btn){
 await touch('touchStart',[{x:btn.x,y:btn.y,id:3}]);
 await wait(40);
 out.padDuringButton=await p.evaluate(()=>{const pad=window.__crsek.pad;return {x:pad.x,y:pad.y,mag:pad.mag,active:pad.active};});
 await touch('touchEnd',[]);
 await wait(120);
 out.shotFired=await p.evaluate(()=>{const r=window.__crsek.runner;return !!(r&&r.pendingShot&&r.pendingShot.type);});
 }

 // --- 5. bowling layout + preview ---
 for(let i=0;i<220;i++){
   const r=await p.evaluate(()=>{const a=window.__crsek,s=a.state;if(!s)return null;
     if(a.role==='bowl'&&s.phase==='delivery'){
       const btn=document.querySelector('[data-act="release"]');
       const prev=!!(a.view3d&&a.view3d.scene&&a.view3d.scene.children.some(c=>c.type==='Line'&&c.visible));
       return {label:document.getElementById('padLabel').textContent,hasRelease:!!btn,preview:prev,btns:document.querySelectorAll('#buttons button').length};
     }
     return null;});
   if(r){out.bowling=r;break;}
   await p.evaluate(()=>{const a=window.__crsek,s=a.state;if(!s)return;
     if(a.role==='bat'&&s.phase==='flight'){const x=document.querySelector('[data-shot="drive"]');if(x)x.click();}});
   await wait(180);
 }
 out.errors=errors.slice(0,6);
 console.log(JSON.stringify(out,null,1));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
