const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8068;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.fbx':'application/octet-stream'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end('nf');}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
(async()=>{
 await new Promise(r=>server.listen(PORT,r));
 const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'],headless:'new'});
 const p=await b.newPage();
 await p.goto('http://localhost:'+PORT+'/',{waitUntil:'domcontentloaded'});
 await p.addScriptTag({url:'https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js'});
 await p.addScriptTag({url:'https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js'});
 await p.addScriptTag({url:'https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/loaders/FBXLoader.js'});
 const data=await p.evaluate(async (url)=>{
   const THREE=window.THREE;
   const obj=await new Promise((res,rej)=>new THREE.FBXLoader().load(url,res,undefined,rej));
   const clip=obj.animations.find(a=>a.duration>0.1);
   const mixer=new THREE.AnimationMixer(obj);
   mixer.clipAction(clip).play();
   const want=['mixamorigLeftArm','mixamorigRightArm','mixamorigLeftForeArm','mixamorigRightForeArm','mixamorigSpine','mixamorigHead','mixamorigHips'];
   const bones={};
   obj.traverse(o=>{ if(o.isBone && want.includes(o.name) && !bones[o.name]) bones[o.name]=o; });
   const rows=[];
   for (let i=0;i<=6;i++){
     mixer.update(clip.duration/6);
     obj.updateMatrixWorld(true);
     const row={t:+(i/6).toFixed(2)};
     Object.keys(bones).forEach(k=>{
       const q=bones[k].quaternion;
       row[k.replace('mixamorig','')]=[+q.x.toFixed(2),+q.y.toFixed(2),+q.z.toFixed(2)];
     });
     rows.push(row);
   }
   return {clip:{name:clip.name,dur:+clip.duration.toFixed(2),tracks:clip.tracks.length}, bones:Object.keys(bones), rows};
 }, 'http://localhost:'+PORT+'/assets/anim/catch.fbx');
 console.log(JSON.stringify(data,null,1));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
