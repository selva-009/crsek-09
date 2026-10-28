const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8084;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end('nf');}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await new Promise(r=>server.listen(PORT,r));
 const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'],headless:'new'});
 const p=await b.newPage();await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
 const cdp=await p.target().createCDPSession();
 await p.goto('http://localhost:'+PORT+'/',{waitUntil:'networkidle2'});
 await p.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await p.reload({waitUntil:'networkidle2'});
 await p.waitForSelector('#nameInput',{visible:true});await p.type('#nameInput','Selva');await p.click('#nameGo');
 await p.waitForSelector('#practiceBtn',{visible:true});await p.click('#practiceBtn');
 const touch=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts});
 const out={};
 // get to a delivery, then hold the ball in flight so the tap has a stable window
 for(let i=0;i<220;i++){
   const ok=await p.evaluate(()=>{const a=window.__crsek,s=a.state;if(!s)return false;
     const t=document.getElementById('tossOverlay');if(!t.classList.contains('hidden')){document.getElementById('tossBat').click();}
     if(a.role==='bowl'&&s.phase==='delivery'){const x=document.querySelector('[data-act="release"]');if(x)x.click();}
     return a.role==='bat'&&s.phase==='flight'&&!!document.querySelector('[data-shot="cut"]');});
   if(ok)break;
   await wait(110);
 }
 // hold the ball at the contact point so the tap has a stable window
 await p.evaluate(()=>{const r=window.__crsek.runner;
   if(!r.pendingDelivery||!r.pendingDelivery.traj)return;
   r.clearTimers(); r.pendingShot=null; r.phase='flight';
   r.ballStart=Date.now()-r.pendingDelivery.traj.contactAt*1000;
   window.__crsekCount.shot=0;});
 const btn=await p.evaluate(()=>{const r=document.querySelector('[data-shot="cut"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
 const padBox=await p.evaluate(()=>{const r=document.getElementById('pad').getBoundingClientRect();return {cx:r.x+r.width/2,cy:r.y+r.height/2};});
 // aim with one thumb (up-left) and tap CUT with the other
 const p1={x:padBox.cx-30,y:padBox.cy-30,id:1};
 await touch('touchStart',[p1]);
 await wait(40);
 await touch('touchStart',[p1,{x:btn.x,y:btn.y,id:2}]);
 await wait(60);
 out.stickHeld=await p.evaluate(()=>({x:+window.__crsek.pad.x.toFixed(2),y:+window.__crsek.pad.y.toFixed(2),mag:+window.__crsek.pad.mag.toFixed(2)}));
 await touch('touchEnd',[{x:btn.x,y:btn.y,id:2}]);   // lift the shot finger, keep aiming
 await wait(90);
 out.counts=await p.evaluate(()=>Object.assign({},window.__crsekCount));
 out.shot=await p.evaluate(()=>{const r=window.__crsek.runner;
   return r.pendingShot?{type:r.pendingShot.type,dir:r.pendingShot.dir,foot:r.pendingShot.foot,q:+r.pendingShot.quality.toFixed(2)}:null;});
 out.stickStillHeld=await p.evaluate(()=>({x:+window.__crsek.pad.x.toFixed(2),y:+window.__crsek.pad.y.toFixed(2),mag:+window.__crsek.pad.mag.toFixed(2),active:window.__crsek.pad.active}));
 await touch('touchEnd',[]);
 await wait(120);
 out.landing=await p.evaluate(()=>{const r=window.__crsek.runner;
   if(!r.ball||!r.ball.landing)return null;
   const a=Math.atan2(r.ball.landing.x,-(r.ball.landing.y-10))*180/Math.PI;
   return {angle:Math.round(a),phase:r.phase};});
 console.log(JSON.stringify(out,null,1));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
