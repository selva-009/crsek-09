const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8048;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.fbx':'application/octet-stream'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end('nf');}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await new Promise(r=>server.listen(PORT,r));
 const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'],headless:'new'});
 const p=await b.newPage();await p.setViewport({width:900,height:520,deviceScaleFactor:1});
 await p.goto('http://localhost:'+PORT+'/',{waitUntil:'networkidle2'});
 await p.evaluate(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('crsek09_seen_tutorial','1');});
 await p.reload({waitUntil:'networkidle2'});
 for(let i=0;i<80;i++){const ok=await p.evaluate(()=>!!(window.MeshRig&&window.MeshRig.ready));if(ok)break;await wait(200);}
 const info=await p.evaluate(()=>{
   const THREE=window.THREE, MR=window.MeshRig;
   const renderer=new THREE.WebGLRenderer({antialias:true});
   renderer.setSize(900,520); renderer.setClearColor(0x1b2733);
   document.body.innerHTML=''; document.body.appendChild(renderer.domElement);
   const scene=new THREE.Scene();
   scene.add(new THREE.HemisphereLight(0xffffff,0x445566,1.5));
   const dl=new THREE.DirectionalLight(0xffffff,1.3); dl.position.set(2,5,3); scene.add(dl);

   // A: raw source (no wrap, no pose)
   const a = MR.source.clone(true); a.visible = true; a.traverse(o=>o.visible=true);
   a.scale.setScalar(0.01); a.position.set(-1.6,0,0);

   // B: wrapped, no pose
   const bb = MR.create('#7fd1ae','bat'); bb.position.set(0,0,0);

   // C: wrapped + stance pose
   const cc = MR.create('#ffb4a2','bat'); cc.position.set(1.6,0,0);
   MR.apply(cc, {torsoX:0.30,torsoY:-0.85,hipsY:0.78,armLX:-1.05,armRX:-1.85,armLZ:0.35,armRZ:-0.30,
     elbowL:1.15,elbowR:1.55,hipLX:-0.45,hipRX:0.28,kneeL:0.72,kneeR:0.55,ankleL:0,ankleR:0,rootY:0,tilt:0});

   scene.add(a, bb, cc);
   // measure: head should be at the TOP of each box
   const box = (o)=>{ const bx=new THREE.Box3().setFromObject(o); return {minY:+bx.min.y.toFixed(2), maxY:+bx.max.y.toFixed(2)}; };
   // find a head bone per object to test orientation
   const headY = (o)=>{ let h=null; o.traverse(x=>{ if(x.isBone&&x.name==='mixamorigHead'&&!h) h=x; });
     if(!h) return null; const v=new THREE.Vector3(); h.getWorldPosition(v); return +v.y.toFixed(2); };

   const cam=new THREE.PerspectiveCamera(40,900/520,0.05,80);
   cam.position.set(0,1.2,5.4); cam.lookAt(0,0.9,0);
   renderer.render(scene,cam);
   return {A:{box:box(a), headY:headY(a)}, B:{box:box(bb), headY:headY(bb)}, C:{box:box(cc), headY:headY(cc)}};
 });
 await p.screenshot({path:require('path').resolve(__dirname,'orient.png')});
 console.log(JSON.stringify(info,null,1));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
