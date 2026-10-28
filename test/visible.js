const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8090;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end('nf');}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await new Promise(r=>server.listen(PORT,r));
 const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'],headless:'new'});
 const p=await b.newPage();await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
 await p.goto('http://localhost:'+PORT+'/',{waitUntil:'networkidle2'});
 await p.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await p.reload({waitUntil:'networkidle2'});
 await p.waitForSelector('#nameInput',{visible:true});await p.type('#nameInput','Selva');await p.click('#nameGo');
 await p.waitForSelector('#practiceBtn',{visible:true});await p.click('#practiceBtn');
 const samples=[]; let done=false; let guard=0;
 while(!done && guard<260){
   const r=await p.evaluate(()=>{
     const a=window.__crsek,s=a.state;if(!s||!a.view3d)return null;
     const t=document.getElementById('tossOverlay');if(!t.classList.contains('hidden')){document.getElementById('tossBat').click();}
     const cam=a.view3d.camera;
     const proj=(x,y,z)=>{const v=new window.THREE.Vector3(x,z,y).project(cam);return {x:v.x,y:v.y,z:v.z};};
     const inFrame=(pt)=>Math.abs(pt.x)<=1&&Math.abs(pt.y)<=1&&pt.z<1;
     const striker=s.teams[s.batTeam].players.find(pl=>pl.id===s.strikerId);
     const out={phase:s.phase,role:a.role,cam:a.view3d.cameraMode()};
     out.ball = s.ball ? inFrame(proj(s.ball.x,s.ball.y,s.ball.z||0)) : null;
     out.striker = inFrame(proj(0,10,1));
     out.bowler = inFrame(proj(0,-11,1));
     out.fieldersInFrame = (s.fielders||[]).filter(f=>inFrame(proj(f.x,f.y,1))).length;
     out.fieldersTotal = (s.fielders||[]).length;
     return out;
   });
   if(r && r.phase==='inplay'){ samples.push(r); if(samples.length>=3) done=true; }
   await p.evaluate(()=>{const a=window.__crsek,s=a.state;if(!s)return;
     if(a.role==='bat'&&s.phase==='flight'){const x=document.querySelector('[data-shot="loft"]');if(x)x.click();}
     else if(a.role==='bowl'&&s.phase==='delivery'){const x=document.querySelector('[data-act="release"]');if(x)x.click();}});
   await wait(220); guard++;
 }
 if(samples.length) await p.screenshot({path:require('path').resolve(__dirname,'shot_chase.png'});
 console.log(JSON.stringify({samples,guard},null,1));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
