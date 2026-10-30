const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8057;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.fbx':'application/octet-stream'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end('nf');}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await new Promise(r=>server.listen(PORT,r));
 const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'],headless:'new'});
 const p=await b.newPage();await p.setViewport({width:520,height:900,isMobile:true,hasTouch:true,deviceScaleFactor:2});
 await p.goto('http://localhost:'+PORT+'/',{waitUntil:'networkidle2'});
 await p.evaluate(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('crsek09_seen_tutorial','1');});
 await p.reload({waitUntil:'networkidle2'});
 await p.waitForSelector('#nameInput',{visible:true});await p.type('#nameInput','Selva');await p.click('#nameGo');
 await p.waitForSelector('#practiceBtn',{visible:true});await p.click('#practiceBtn');
 for(let i=0;i<60;i++){const ph=await p.evaluate(()=>{const a=window.__crsek,s=a.state;if(!s)return null;
   const t=document.getElementById('tossOverlay');if(!t.classList.contains('hidden')){document.getElementById('tossBat').click();}
   return s.phase;}); if(ph==='delivery')break; await wait(150);}
 // frame the striker closely from the side using a manual camera override
 const pose=await p.evaluate(()=>{
   const v=window.__crsek.view3d, THREE=window.THREE;
   const s=v.scene.children.find(c=>c.userData&&c.userData.role==='bat');
   const j=s.userData.joints;
   return {knee:+j.legL.knee.rotation.x.toFixed(2), hip:+j.legL.hip.rotation.x.toFixed(2),
           torsoY:+j.torso.rotation.y.toFixed(2), armR:+j.armR.shoulder.rotation.x.toFixed(2),
           hipsY:+j.hips.position.y.toFixed(2), bat:!!j.bat};
 });
 // side-on render of the striker
 await p.evaluate(()=>{
   const v=window.__crsek.view3d, THREE=window.THREE;
   const s=v.scene.children.find(c=>c.userData&&c.userData.role==='bat');
   const cam=v.camera;
   cam.position.set(s.position.x + 2.6, 1.5, s.position.z + 1.2);
   cam.lookAt(s.position.x, 1.0, s.position.z);
   v.renderer.render(v.scene, cam);
   v.__freezeCam = true;
 });
 await p.screenshot({path:require('path').resolve(__dirname,'side.png')});
 console.log(JSON.stringify({pose}));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
