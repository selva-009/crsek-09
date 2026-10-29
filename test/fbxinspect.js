const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8070;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.fbx':'application/octet-stream'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end('nf');}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
(async()=>{
 await new Promise(r=>server.listen(PORT,r));
 const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'],headless:'new'});
 const p=await b.newPage();
 p.on('pageerror',e=>console.log('PAGEERR',String(e).slice(0,200)));
 await p.goto('http://localhost:'+PORT+'/',{waitUntil:'domcontentloaded'});
 await p.addScriptTag({url:'https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js'});
 await p.addScriptTag({url:'https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js'});
 await p.addScriptTag({url:'https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/loaders/FBXLoader.js'});
 const info=await p.evaluate(async (url)=>{
   const loader=new THREE.FBXLoader();
   const obj=await new Promise((res,rej)=>loader.load(url,res,undefined,rej));
   const clips=(obj.animations||[]).map(a=>({name:a.name,dur:+a.duration.toFixed(2),tracks:a.tracks.length}));
   const bones=[];
   obj.traverse(o=>{ if(o.isBone) bones.push(o.name); });
   let meshes=0, skinned=0;
   obj.traverse(o=>{ if(o.isMesh) meshes++; if(o.isSkinnedMesh) skinned++; });
   const box=new THREE.Box3().setFromObject(obj); const size=new THREE.Vector3(); box.getSize(size);
   // sample key bone local rotations at the middle of the clip
   const mixer=new THREE.AnimationMixer(obj);
   const action=mixer.clipAction(obj.animations[0]); action.play();
   mixer.update(obj.animations[0].duration*0.55);
   const key=['mixamorigHips','mixamorigSpine','mixamorigLeftArm','mixamorigLeftForeArm','mixamorigRightArm','mixamorigRightForeArm','mixamorigHead','mixamorigLeftUpLeg','mixamorigLeftLeg'];
   const rot={};
   obj.traverse(o=>{ if(o.isBone && key.includes(o.name.replace(':',''))) {
     const q=o.quaternion;
     rot[o.name]=[+q.x.toFixed(3),+q.y.toFixed(3),+q.z.toFixed(3),+q.w.toFixed(3)];
   }});
   return {clips, bones:bones.length, meshes, skinned, size:[+size.x.toFixed(2),+size.y.toFixed(2),+size.z.toFixed(2)], rot, firstBones:bones.slice(0,8)};
 }, 'http://localhost:'+PORT+'/assets/anim/catch.fbx');
 console.log(JSON.stringify({clips:info.clips,bones:info.bones,meshes:info.meshes,skinned:info.skinned,size:info.size,rot:info.rot},null,1));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
