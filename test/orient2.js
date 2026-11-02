const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8046;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.fbx':'application/octet-stream'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end('nf');}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await new Promise(r=>server.listen(PORT,r));
 const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'],headless:'new'});
 const p=await b.newPage();await p.setViewport({width:960,height:560,deviceScaleFactor:1});
 await p.goto('http://localhost:'+PORT+'/',{waitUntil:'networkidle2'});
 await p.evaluate(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('crsek09_seen_tutorial','1');});
 await p.reload({waitUntil:'networkidle2'});
 for(let i=0;i<80;i++){const ok=await p.evaluate(()=>!!(window.MeshRig&&window.MeshRig.ready));if(ok)break;await wait(200);}
 const info=await p.evaluate(()=>{
   const THREE=window.THREE, MR=window.MeshRig;
   const renderer=new THREE.WebGLRenderer({antialias:true});
   renderer.setSize(960,560); renderer.setClearColor(0x1b2733);
   document.body.innerHTML=''; document.body.appendChild(renderer.domElement);
   const scene=new THREE.Scene();
   scene.add(new THREE.HemisphereLight(0xffffff,0x445566,1.6));
   const dl=new THREE.DirectionalLight(0xffffff,1.4); dl.position.set(2,5,4); scene.add(dl);

   // D: wrap-scaled clone, then REBIND each skinned mesh to its scaled world matrix
   const d = MR.create('#7fd1ae','bat');
   d.updateMatrixWorld(true);
   d.traverse(o=>{ if(o.isSkinnedMesh){ o.bindMode='attached'; o.bind(o.skeleton, o.matrixWorld); } });
   d.position.set(-1.3,0,0);

   // E: no wrap scale — bake 0.01 into geometry and bone positions instead
   const e = MR.create('#ffb4a2','bat');
   e.scale.setScalar(1);
   e.updateMatrixWorld(true);
   e.traverse(o=>{ if(o.isSkinnedMesh){ o.geometry.scale(0.01,0.01,0.01); } });
   e.traverse(o=>{ if(o.isBone){ o.position.multiplyScalar(0.01); } });
   e.updateMatrixWorld(true);
   e.traverse(o=>{ if(o.isSkinnedMesh){ o.bind(o.skeleton, o.matrixWorld); } });
   e.position.set(1.3,0,0);

   scene.add(d,e);
   const box=(o)=>{const bx=new THREE.Box3().setFromObject(o);return {minY:+bx.min.y.toFixed(2),maxY:+bx.max.y.toFixed(2),w:+(bx.max.x-bx.min.x).toFixed(2)};};
   const cam=new THREE.PerspectiveCamera(40,960/560,0.05,80);
   cam.position.set(0,1.2,5.6); cam.lookAt(0,0.95,0);
   renderer.render(scene,cam);
   return {D:box(d), E:box(e)};
 });
 await p.screenshot({path:require('path').resolve(__dirname,'orient2.png')});
 console.log(JSON.stringify(info,null,1));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
