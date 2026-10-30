const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8059;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.fbx':'application/octet-stream'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end('nf');}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
(async()=>{
 await new Promise(r=>server.listen(PORT,r));
 const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'],headless:'new'});
 const p=await b.newPage();await p.setViewport({width:560,height:640,deviceScaleFactor:2});
 await p.goto('http://localhost:'+PORT+'/',{waitUntil:'networkidle2'});
 await p.evaluate(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('crsek09_seen_tutorial','1');});
 await p.reload({waitUntil:'networkidle2'});
 for(let i=0;i<80;i++){const ok=await p.evaluate(()=>!!(window.MeshRig&&window.MeshRig.ready));if(ok)break;await new Promise(r=>setTimeout(r,200));}
 const info=await p.evaluate(()=>{
   const THREE=window.THREE;
   const renderer=new THREE.WebGLRenderer({antialias:true});
   renderer.setSize(560,640); renderer.setClearColor(0x1d2b33);
   document.body.innerHTML=''; document.body.appendChild(renderer.domElement);
   const scene=new THREE.Scene();
   scene.add(new THREE.HemisphereLight(0xffffff,0x445566,1.6));
   const dl=new THREE.DirectionalLight(0xffffff,1.4); dl.position.set(2,5,3); scene.add(dl);

   const mk=(x)=>{ const w=window.MeshRig.create('#7fd1ae','bat');
     if(x){ w.children[0].rotation.x = x; }
     return w; };
   const a=mk(0), bq=mk(Math.PI), c=mk(-Math.PI/2);
   a.position.set(-1.2,0,0); bq.position.set(0,0,0); c.position.set(1.2,0,0);
   scene.add(a,bq,c);

   const pose = (w,state)=>{ const tgt = {
     torsoX:0.10,torsoY:-0.22,hipsY:0.90,armLX:-0.35,armRX:-0.55,armLZ:0.08,armRZ:-0.08,
     elbowL:0.45,elbowR:0.75,hipLX:-0.12,hipRX:0.10,kneeL:0.18,kneeR:0.18,ankleL:0,ankleR:0,rootY:0,tilt:0};
     window.MeshRig.apply(w, tgt); };
   pose(a); pose(bq); pose(c);

   const cam=new THREE.PerspectiveCamera(45,560/640,0.05,60);
   cam.position.set(0,1.3,4.6); cam.lookAt(0,0.9,0);
   const bb=new THREE.Box3().setFromObject(a); const s2=new THREE.Vector3(); bb.getSize(s2);
   window.__box=[+s2.x.toFixed(2),+s2.y.toFixed(2),+s2.z.toFixed(2)];
   renderer.render(scene,cam);
   return {box:window.__box};
 });
 await p.screenshot({path:require('path').resolve(__dirname,'rig.png')});
 console.log(JSON.stringify(info));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
