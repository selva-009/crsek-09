const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8064;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.fbx':'application/octet-stream'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end('nf');}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
(async()=>{
 await new Promise(r=>server.listen(PORT,r));
 const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'],headless:'new'});
 const p=await b.newPage();await p.setViewport({width:520,height:640,deviceScaleFactor:2});
 await p.goto('http://localhost:'+PORT+'/',{waitUntil:'domcontentloaded'});
 await p.addScriptTag({url:'https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js'});
 await p.addScriptTag({url:'https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js'});
 await p.addScriptTag({url:'https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/loaders/FBXLoader.js'});
 const info=await p.evaluate(async (url)=>{
   const THREE=window.THREE;
   const obj=await new Promise((res,rej)=>new THREE.FBXLoader().load(url,res,undefined,rej));
   // hide the inner joint mesh, keep the surface
   // keep the joint mesh: it is the connective geometry between segments
   // pose the skeleton the surface mesh is actually bound to
   let surface=null;
   obj.traverse(o=>{ if(o.isSkinnedMesh && /surface/i.test(o.name)) surface=o; });
   if(!surface) obj.traverse(o=>{ if(o.isSkinnedMesh && !surface) surface=o; });
   const bones={};
   (surface.skeleton.bones||[]).forEach(bn=>{ if(!bones[bn.name]) bones[bn.name]=bn; });

   // keep each bone's bind rotation and apply our delta on top of it
   const bind={};
   Object.keys(bones).forEach(n=>{ bind[n]=bones[n].quaternion.clone(); });
   const tmpQ=new THREE.Quaternion(), tmpE=new THREE.Euler();
   const set=(n,x,y,z)=>{ const b=bones[n]; if(!b) return;
     tmpE.set(x||0,y||0,z||0); tmpQ.setFromEuler(tmpE);
     b.quaternion.copy(bind[n]).multiply(tmpQ);
   };
   // test which axis brings the arms down: left via Z, right via X
   set('mixamorigLeftArm',0,0,1.30);
   set('mixamorigRightArm',1.30,0,0);
   set('mixamorigLeftForeArm',0,0,0.30); set('mixamorigRightForeArm',0.30,0,0);
   set('mixamorigLeftUpLeg',0.05,0,0.06); set('mixamorigRightUpLeg',0.05,0,-0.06);
   set('mixamorigLeftLeg',-0.12,0,0); set('mixamorigRightLeg',-0.12,0,0);
   obj.updateMatrixWorld(true);

   // scale to 1.8 m via a wrapper group (skinned meshes dislike direct scaling)
   const wrap=new THREE.Group();
   wrap.add(obj);
   wrap.scale.setScalar(0.01);        // scale the wrapper, never the skinned object
   wrap.updateMatrixWorld(true);
   const bb=new THREE.Box3().setFromObject(wrap); const sz=new THREE.Vector3(); bb.getSize(sz);
   const ctr=new THREE.Vector3(); bb.getCenter(ctr);

   const renderer=new THREE.WebGLRenderer({antialias:true});
   renderer.setSize(520,640); renderer.setClearColor(0x1a2530);
   document.body.innerHTML=''; document.body.appendChild(renderer.domElement);
   const scene=new THREE.Scene(); scene.add(wrap);
   scene.add(new THREE.HemisphereLight(0xffffff,0x445566,1.5));
   const dl=new THREE.DirectionalLight(0xffffff,1.3); dl.position.set(2,5,3); scene.add(dl);
   const cam=new THREE.PerspectiveCamera(45,520/640,0.01,100);
   cam.position.set(ctr.x+0.8, ctr.y+0.15, ctr.z+2.4); cam.lookAt(ctr.x, ctr.y, ctr.z);
   renderer.render(scene,cam);
   return {surface:surface&&surface.name, boneCount:(surface.skeleton.bones||[]).length, hasLeftArm:!!bones['mixamorigLeftArm'], scaledSize:[+sz.x.toFixed(2),+sz.y.toFixed(2),+sz.z.toFixed(2)], center:[+ctr.x.toFixed(2),+ctr.y.toFixed(2),+ctr.z.toFixed(2)], bones:Object.keys(bones).length};
 }, 'http://localhost:'+PORT+'/assets/anim/catch.fbx');
 await p.screenshot({path:require('path').resolve(__dirname,'pose.png')});
 console.log(JSON.stringify(info));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
