const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8074;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end('nf');}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await new Promise(r=>server.listen(PORT,r));
 const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'],headless:'new'});
 const p=await b.newPage();await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
 const errs=[];p.on('pageerror',e=>errs.push(String(e).slice(0,160)));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,160));});
 await p.goto('http://localhost:'+PORT+'/',{waitUntil:'networkidle2'});
 await p.evaluate(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('crsek09_seen_tutorial','1');});
 await p.reload({waitUntil:'networkidle2'});
 await p.waitForSelector('#nameInput',{visible:true});await p.type('#nameInput','Selva');await p.click('#nameGo');
 const loaded=await p.evaluate(()=>window.PlayerAsset?{ok:!!window.PlayerAsset.gltf,clips:window.PlayerAsset.clips,err:window.PlayerAsset.error}:{no:true});
 await p.waitForSelector('#practiceBtn',{visible:true});await p.click('#practiceBtn');
 await wait(3000);
 const info=await p.evaluate(()=>{
   const v=window.__crsek.view3d;
   const people=v.scene.children.filter(c=>c.userData&&(c.userData.joints||c.userData.isGLB));
   const glb=people.filter(c=>c.userData.isGLB);
   const skinned=glb.length?glb[0].children[0]:null;
   return {usingGLB:v.usingGLB, people:people.length, glbPeople:glb.length,
     hasMixer:!!(glb[0]&&glb[0].userData.mixer),
     skinnedCount: skinned? (()=>{let n=0; skinned.traverse(o=>{if(o.isSkinnedMesh)n++}); return n})():0};
 });
 await p.evaluate(()=>window.__crsek.view3d.setCameraMode('portrait',false));
 await wait(1200);
 await p.screenshot({path:require('path').resolve(__dirname,'glb.png')});
 console.log(JSON.stringify({asset:loaded, scene:info, errors:errs.slice(0,5)},null,1));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
