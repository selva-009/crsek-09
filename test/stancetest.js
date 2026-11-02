const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8050;
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
 // wait for guard, press READY, then look at the stance
 let ready=false;
 for(let i=0;i<120;i++){
   const st=await p.evaluate(()=>{const a=window.__crsek,s=a.state;if(!s)return null;
     const t=document.getElementById('tossOverlay');if(!t.classList.contains('hidden')){document.getElementById('tossBat').click();}
     const rb=document.querySelector('[data-act="ready"]');
     if(rb){const r=rb.getBoundingClientRect();
       const o={bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2,pointerId:7,pointerType:'touch',isPrimary:true};
       rb.dispatchEvent(new PointerEvent('pointerdown',o)); rb.dispatchEvent(new PointerEvent('pointerup',o));}
     return {phase:s.phase, role:a.role, ready:s.batsman&&s.batsman.ready};});
   if(st&&st.ready){ready=true;break;}
   await wait(150);
 }
 await wait(700);   // long enough to blend into the stance, short enough to beat the ball
 const pose=await p.evaluate(()=>{const s=window.__crsek.view3d.scene.children.find(c=>c.userData&&c.userData.role==='bat');
   const j=s.userData.joints;
   return {knee:+j.legL.knee.rotation.x.toFixed(2), torsoY:+j.torso.rotation.y.toFixed(2),
           armR:+j.armR.shoulder.rotation.x.toFixed(2), hipsY:+j.hips.position.y.toFixed(2)};});
 await p.screenshot({path:path.resolve(__dirname,'stance_now.png')});
 console.log(JSON.stringify({ready, pose, errors:errs.slice(0,3)}));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
