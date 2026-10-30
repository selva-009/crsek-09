const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8056;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.fbx':'application/octet-stream'};
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
 // reach our guard
 let guarding=null;
 for(let i=0;i<120;i++){
   guarding=await p.evaluate(()=>{const a=window.__crsek,s=a.state;if(!s)return null;
     const t=document.getElementById('tossOverlay');if(!t.classList.contains('hidden')){document.getElementById('tossBat').click();}
     return {phase:s.phase, role:a.role, ready:s.batsman&&s.batsman.ready, hasBtn:!!document.querySelector('[data-act="ready"]')};});
   if(guarding&&guarding.role==='bat'&&guarding.phase==='delivery')break;
   await wait(150);
 }
 const before=await p.evaluate(()=>({x:window.__crsek.state.batsman.x, ready:window.__crsek.state.batsman.ready}));
 // shuffle across with the engine call the stick uses
 await p.evaluate(()=>{const a=window.__crsek;a.runner.moveBatsman(a.pid, 0.6, 0.2);});
 await wait(200);
 const moved=await p.evaluate(()=>({x:+window.__crsek.state.batsman.x.toFixed(2), y:+window.__crsek.state.batsman.y.toFixed(2)}));
 // press READY
 await p.evaluate(()=>{
   const b=document.querySelector('[data-act="ready"]'); if(!b) return;
   const r=b.getBoundingClientRect();
   const opts={bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2,pointerId:9,pointerType:'touch',isPrimary:true};
   b.dispatchEvent(new PointerEvent('pointerdown',opts));
   b.dispatchEvent(new PointerEvent('pointerup',opts));
 });
 await wait(1600);
 const after=await p.evaluate(()=>({ready:window.__crsek.state.batsman.ready, phase:window.__crsek.state.phase,
   btnGone:!document.querySelector('[data-act="ready"]'), shotBtns:!!document.querySelector('[data-shot="drive"]')}));
 console.log(JSON.stringify({guarding:{phase:guarding&&guarding.phase, hasBtn:guarding&&guarding.hasBtn},
   before, moved, after, errors:errs.slice(0,3)},null,1));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
