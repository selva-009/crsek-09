const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8065;
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
   obj.updateMatrixWorld(true);
   const meshes=[];
   obj.traverse(o=>{
     if(o.isSkinnedMesh||o.isMesh){
       const bb=new THREE.Box3().setFromObject(o); const sz=new THREE.Vector3(); bb.getSize(sz); const c=new THREE.Vector3(); bb.getCenter(c);
       meshes.push({name:o.name,type:o.type,
         size:[+sz.x.toFixed(1),+sz.y.toFixed(1),+sz.z.toFixed(1)],
         center:[+c.x.toFixed(1),+c.y.toFixed(1),+c.z.toFixed(1)],
         verts:o.geometry.attributes.position.count,
         mat:o.material&&o.material.type, color:o.material&&o.material.color?o.material.color.getHexString():null,
         hasMap:!!(o.material&&o.material.map), skinned:!!o.isSkinnedMesh});
     }
   });
   // render the largest skinned mesh framed on its own box
   const target = meshes.length ? obj.getObjectByName(meshes[0].name) : obj;
   const renderer=new THREE.WebGLRenderer({antialias:true});
   renderer.setSize(520,640); renderer.setClearColor(0x1a2530);
   document.body.innerHTML=''; document.body.appendChild(renderer.domElement);
   const scene=new THREE.Scene(); scene.add(obj);
   scene.add(new THREE.HemisphereLight(0xffffff,0x445566,1.4));
   const dl=new THREE.DirectionalLight(0xffffff,1.2); dl.position.set(2,5,3); scene.add(dl);
   const cam=new THREE.PerspectiveCamera(45,520/640,0.1,5000);
   const bb=new THREE.Box3().setFromObject(target); const c=new THREE.Vector3(); bb.getCenter(c); const sz=new THREE.Vector3(); bb.getSize(sz);
   const h=Math.max(sz.y,1);
   cam.position.set(c.x, c.y + h*0.1, c.z + h*1.9);
   cam.lookAt(c.x, c.y, c.z);
   renderer.render(scene,cam);
   return {meshes, framed:{center:[+c.x.toFixed(1),+c.y.toFixed(1),+c.z.toFixed(1)],size:[+sz.x.toFixed(1),+sz.y.toFixed(1),+sz.z.toFixed(1)]}};
 }, 'http://localhost:'+PORT+'/assets/anim/catch.fbx');
 await p.screenshot({path:require('path').resolve(__dirname,'mesh.png')});
 console.log(JSON.stringify(info,null,1));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
