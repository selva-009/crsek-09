const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8045;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.fbx':'application/octet-stream'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end('nf');}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await new Promise(r=>server.listen(PORT,r));
 const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'],headless:'new'});
 const p=await b.newPage();await p.setViewport({width:900,height:560,deviceScaleFactor:1});
 await p.goto('http://localhost:'+PORT+'/',{waitUntil:'networkidle2'});
 await p.evaluate(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('crsek09_seen_tutorial','1');});
 await p.reload({waitUntil:'networkidle2'});
 for(let i=0;i<80;i++){const ok=await p.evaluate(()=>!!(window.MeshRig&&window.MeshRig.ready));if(ok)break;await wait(200);}
 const info=await p.evaluate(()=>{
   const THREE=window.THREE, MR=window.MeshRig;
   const renderer=new THREE.WebGLRenderer({antialias:true});
   renderer.setSize(900,560); renderer.setClearColor(0x1b2733);
   document.body.innerHTML=''; document.body.appendChild(renderer.domElement);
   const scene=new THREE.Scene();
   scene.add(new THREE.HemisphereLight(0xffffff,0x445566,1.6));
   const dl=new THREE.DirectionalLight(0xffffff,1.4); dl.position.set(2,5,4); scene.add(dl);

   // F: scale the model itself, detached bind mode
   const f = MR.create('#7fd1ae','bat');
   f.scale.setScalar(1);
   f.traverse(o=>{ if(o.isSkinnedMesh){ o.scale.setScalar(0.01); o.bindMode='detached'; } });
   f.traverse(o=>{ if(o.isBone){ o.position.multiplyScalar(0.01); } });
   f.updateMatrixWorld(true);
   f.position.set(-1.2,0,0);

   // G: leave at native cm scale, put the whole thing in a group scaled 0.01, detached bind
   const g = MR.create('#ffb4a2','bat');
   g.traverse(o=>{ if(o.isSkinnedMesh){ o.bindMode='detached'; } });
   g.updateMatrixWorld(true);
   g.position.set(1.2,0,0);

   scene.add(f,g);
   const cam=new THREE.PerspectiveCamera(40,900/560,0.05,200);
   cam.position.set(0,1.3,5.2); cam.lookAt(0,0.95,0);
   renderer.render(scene,cam);
   return {ok:true};
 });
 await p.screenshot({path:require('path').resolve(__dirname,'orient3.png')});
 console.log(JSON.stringify(info));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
