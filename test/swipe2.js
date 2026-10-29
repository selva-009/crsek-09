const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8071;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end('nf');}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await new Promise(r=>server.listen(PORT,r));
 const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'],headless:'new'});
 const p=await b.newPage();await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 await p.goto('http://localhost:'+PORT+'/',{waitUntil:'networkidle2'});
 await p.evaluate(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('crsek09_seen_tutorial','1');});
 await p.reload({waitUntil:'networkidle2'});
 await p.waitForSelector('#nameInput',{visible:true});await p.type('#nameInput','Selva');await p.click('#nameGo');
 await p.evaluate(()=>{const s=window.__crsek.settings;s.ctl='swipe';});
 await p.click('#practiceBtn');
 await wait(2500);
 const res=await p.evaluate(()=>{
   const a=window.__crsek, r=a.runner;
   // force a batting window
   r.clearTimers(); r.pendingShot=null; r.phase='flight';
   if (r.pendingDelivery && r.pendingDelivery.traj) {
     r.ballStart = Date.now() - r.pendingDelivery.traj.contactAt*1000 + 300;
   }
   a.role = 'bat';
   const cv = document.getElementById('pitch3d');
   const fire = (type, x, y) => cv.dispatchEvent(new PointerEvent(type, {
     clientX:x, clientY:y, bubbles:true, pointerId:1, pointerType:'touch', isPrimary:true
   }));
   fire('pointerdown', 195, 560);
   fire('pointerup', 198, 470);
   const tag = document.getElementById('timingTag');
   return { phase:r.phase, shot: r.pendingShot ? {type:r.pendingShot.type, dir:r.pendingShot.dir} : null,
            role:a.role, ctl:a.settings.ctl, hasCanvas: !!cv,
            timingTag: { text: tag.textContent, cls: tag.className } };
 });
 console.log(JSON.stringify(res,null,1));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
