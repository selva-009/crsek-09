const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8063;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.fbx':'application/octet-stream'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end('nf');}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await new Promise(r=>server.listen(PORT,r));
 const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'],headless:'new'});
 const p=await b.newPage();await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
 const errs=[];p.on('pageerror',e=>errs.push(String(e).slice(0,180)));
 await p.goto('http://localhost:'+PORT+'/',{waitUntil:'networkidle2'});
 await p.evaluate(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('crsek09_seen_tutorial','1');});
 await p.reload({waitUntil:'networkidle2'});
 await p.waitForSelector('#nameInput',{visible:true});await p.type('#nameInput','Selva');await p.click('#nameGo');
 for(let i=0;i<80;i++){ const ok=await p.evaluate(()=>!!(window.MeshRig&&window.MeshRig.ready)); if(ok)break; await wait(200); }
 const rigReady=await p.evaluate(()=>!!(window.MeshRig&&window.MeshRig.ready));
 await p.waitForSelector('#practiceBtn',{visible:true});await p.click('#practiceBtn');
 await wait(3000);
 const info=await p.evaluate((rigReady)=>{
   const v=window.__crsek.view3d;
   const people=v.scene.children.filter(c=>c.userData&&(c.userData.isMesh||c.userData.joints));
   const meshPeople=people.filter(c=>c.userData.isMesh);
   const one=meshPeople[0];
   let skinned=0; if(one) one.traverse(o=>{ if(o.isSkinnedMesh) skinned++; });
   return {rigReady, total:people.length, meshPeople:meshPeople.length, skinnedPerPlayer:skinned,
           scale:one?+one.scale.x.toFixed(3):null};
 }, rigReady);
 await p.evaluate(()=>window.__crsek.view3d.setCameraMode('portrait',false));
 await wait(1500);
 await p.screenshot({path:require('path').resolve(__dirname,'meshgame.png')});
 console.log(JSON.stringify({info, errors:errs.slice(0,5)},null,1));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
