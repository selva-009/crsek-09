const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8060;
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
 for(let i=0;i<80;i++){const ok=await p.evaluate(()=>!!(window.MeshRig&&window.MeshRig.ready));if(ok)break;await wait(200);}
 await p.waitForSelector('#practiceBtn',{visible:true});await p.click('#practiceBtn');
 await wait(4000);
 const d=await p.evaluate(()=>{
   const THREE=window.THREE, v=window.__crsek.view3d;
   const people=v.scene.children.filter(c=>c.userData&&(c.userData.isMesh||c.userData.joints));
   const mesh=people.filter(c=>c.userData.isMesh);
   const striker=mesh[0];
   const head=new THREE.Vector3(); 
   let headBone=null; striker.traverse(o=>{ if(o.isBone&&o.name==='mixamorigHead'&&!headBone) headBone=o; });
   if(headBone) headBone.getWorldPosition(head);
   const ndc=head.clone().project(v.camera);
   const rarm=striker.userData.bones&&striker.userData.bones['mixamorigRightArm'];
   const hasDrive=!!striker.userData.drive;
   let batFound=false; striker.traverse(o=>{ if(o.isMesh&&o.geometry&&o.geometry.type==='BoxGeometry') batFound=true; });
   return {meshPeople:mesh.length,
     strikerPos:[+striker.position.x.toFixed(1),+striker.position.y.toFixed(1),+striker.position.z.toFixed(1)],
     strikerRole:striker.userData.role, hasDrive, batFound,
     headWorld:[+head.x.toFixed(1),+head.y.toFixed(1),+head.z.toFixed(1)],
     headNDC:[+ndc.x.toFixed(2),+ndc.y.toFixed(2)],
     cam:[+v.camera.position.x.toFixed(1),+v.camera.position.y.toFixed(1),+v.camera.position.z.toFixed(1)],
     fov:+v.camera.fov.toFixed(0), mode:v.cameraMode(),
     rarmQ:rarm?[+rarm.quaternion.x.toFixed(2),+rarm.quaternion.y.toFixed(2),+rarm.quaternion.z.toFixed(2),+rarm.quaternion.w.toFixed(2)]:null};
 });
 console.log(JSON.stringify(d,null,1));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
