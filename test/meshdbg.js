const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8062;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.fbx':'application/octet-stream'};
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
 for(let i=0;i<80;i++){ const ok=await p.evaluate(()=>!!(window.MeshRig&&window.MeshRig.ready)); if(ok)break; await wait(200); }
 await p.evaluate(()=>{window.__crsek.settings.players='classic';window.__crsekPlayerModel='classic';});
 await p.waitForSelector('#practiceBtn',{visible:true});await p.click('#practiceBtn');
 await wait(2500);
 const d=await p.evaluate(()=>{
   const THREE=window.THREE, v=window.__crsek.view3d;
   const mesh=v.scene.children.filter(c=>c.userData&&c.userData.isMesh);
   const proc=v.scene.children.filter(c=>c.userData&&c.userData.joints);
   const one=mesh[0];
   const bb=one?new THREE.Box3().setFromObject(one):new THREE.Box3(); const sz=new THREE.Vector3(); bb.getSize(sz);
   return {meshPeople:mesh.length, procPeople:proc.length,
     pos:one?[+one.position.x.toFixed(2),+one.position.y.toFixed(2),+one.position.z.toFixed(2)]:null,
     scale:one?+one.scale.x.toFixed(4):null,
     worldSize:[+sz.x.toFixed(2),+sz.y.toFixed(2),+sz.z.toFixed(2)],
     cam:[+v.camera.position.x.toFixed(2),+v.camera.position.y.toFixed(2),+v.camera.position.z.toFixed(2)],
     mode:v.cameraMode()};
 });
 await p.evaluate(()=>window.__crsek.view3d.setCameraMode('portrait',false));
 await wait(9000);
 const c2=await p.evaluate(()=>{const v=window.__crsek.view3d;return [+v.camera.position.x.toFixed(1),+v.camera.position.y.toFixed(1),+v.camera.position.z.toFixed(1)];});
 await p.screenshot({path:require('path').resolve(__dirname,'meshportrait.png')});
 console.log(JSON.stringify({d, portraitCam:c2},null,1));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
