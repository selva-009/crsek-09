const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8051;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.fbx':'application/octet-stream'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end('nf');}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await new Promise(r=>server.listen(PORT,r));
 const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'],headless:'new'});
 const p=await b.newPage();await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const errs=[];p.on('pageerror',e=>errs.push(String(e).slice(0,150)));
 await p.goto('http://localhost:'+PORT+'/',{waitUntil:'networkidle2'});
 await p.evaluate(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('crsek09_seen_tutorial','1');});
 await p.reload({waitUntil:'networkidle2'});
 await p.waitForSelector('#nameInput',{visible:true});await p.type('#nameInput','Selva');await p.click('#nameGo');
 await p.waitForSelector('#practiceBtn',{visible:true});await p.click('#practiceBtn');
 let hit=false, camDuring=null;
 for(let i=0;i<140 && !hit;i++){
   const st=await p.evaluate(()=>{const a=window.__crsek,s=a.state;if(!s)return null;
     const t=document.getElementById('tossOverlay');if(!t.classList.contains('hidden')){document.getElementById('tossBat').click();}
     const rb=document.querySelector('[data-act="ready"]'); if(rb){const r=rb.getBoundingClientRect();
       const o={bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2,pointerId:7,pointerType:'touch',isPrimary:true};
       rb.dispatchEvent(new PointerEvent('pointerdown',o)); rb.dispatchEvent(new PointerEvent('pointerup',o));}
     if(a.role==='bowl'&&s.phase==='delivery'){const x=document.querySelector('[data-act="release"]');if(x)x.click();}
     if(a.role==='bat'&&s.phase==='flight'){const x=document.querySelector('[data-shot="loft"]');if(x)x.click();}
     return {phase:s.phase, role:a.role, ball:s.ball?{x:+s.ball.x.toFixed(1),y:+s.ball.y.toFixed(1)}:null};});
   if(!st){await wait(120);continue;}
   if(st.phase==='inplay'&&st.ball&&Math.hypot(st.ball.x,st.ball.y-10)>14){
     await wait(120);
     camDuring=await p.evaluate(()=>{const v=window.__crsek.view3d;return [+v.camera.position.x.toFixed(1),+v.camera.position.y.toFixed(1),+v.camera.position.z.toFixed(1)];});
     await p.screenshot({path:path.resolve(__dirname,'chase.png')});
     hit=true;break;
   }
   await wait(120);
 }
 console.log(JSON.stringify({hit, camDuring, errors:errs.slice(0,3)}));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
