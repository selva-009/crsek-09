const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8079;
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
 // wait until we are the striker mid-flight, then pull the ball
 let shot=false;
 for(let i=0;i<220 && !shot;i++){
   const st=await p.evaluate(()=>{const a=window.__crsek,s=a.state;if(!s)return null;
     const t=document.getElementById('tossOverlay');if(!t.classList.contains('hidden')){document.getElementById('tossBat').click();}
     if(a.role==='bowl'&&s.phase==='delivery'){const x=document.querySelector('[data-act="release"]');if(x)x.click();}
     return {role:a.role,phase:s.phase};});
   if(st&&st.role==='bat'&&st.phase==='flight'){
     await p.evaluate(()=>{const b=document.querySelector('[data-shot="pull"]');if(b)b.click();});
     shot=true;break;
   }
   await wait(120);
 }
 await wait(140);   // mid-swing
 const info=await p.evaluate(()=>{
   const a=window.__crsek,s=a.state;
   return {phase:s&&s.phase, ball:s&&s.ball?{x:+s.ball.x.toFixed(1),y:+s.ball.y.toFixed(1),z:+s.ball.z.toFixed(2)}:null};
 });
 await p.screenshot({path:require('path').resolve(__dirname,'swing.png')});
 await wait(1200);
 const after=await p.evaluate(()=>{const a=window.__crsek,s=a.state;
   return {phase:s&&s.phase, last:s&&s.lastResult&&s.lastResult.text, ball:s&&s.ball?{x:+s.ball.x.toFixed(1),y:+s.ball.y.toFixed(1),z:+s.ball.z.toFixed(2)}:null};});
 console.log(JSON.stringify({shotFired:shot,midSwing:info,after,errors:errs.slice(0,4)},null,1));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
