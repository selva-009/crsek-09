const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8058;
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
 // wait for the batting stance
 for(let i=0;i<80;i++){
   const ph=await p.evaluate(()=>{const a=window.__crsek,s=a.state;if(!s)return null;
     const t=document.getElementById('tossOverlay');if(!t.classList.contains('hidden')){document.getElementById('tossBat').click();}
     return s.phase;});
   if(ph==='delivery')break; await wait(150);
 }
 await wait(2500);
 await p.evaluate(()=>window.__crsek.view3d.setCameraMode('side',false)); await wait(4000);
 await p.screenshot({path:require('path').resolve(__dirname,'stance.png')});
 // now capture the bowler mid run-up
 await p.evaluate(()=>window.__crsek.view3d.setCameraMode('side',false));
 for(let i=0;i<60;i++){
   const ph=await p.evaluate(()=>window.__crsek.state&&window.__crsek.state.phase);
   if(ph==='delivery')break; await wait(120);
 }
 await wait(400);
 await p.screenshot({path:require('path').resolve(__dirname,'bowler.png')});
 console.log(JSON.stringify({errors:errs.slice(0,3)}));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
