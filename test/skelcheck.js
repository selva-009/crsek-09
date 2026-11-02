const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8047;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.fbx':'application/octet-stream'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end('nf');}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await new Promise(r=>server.listen(PORT,r));
 const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'],headless:'new'});
 const p=await b.newPage();await p.setViewport({width:400,height:400,deviceScaleFactor:1});
 await p.goto('http://localhost:'+PORT+'/',{waitUntil:'networkidle2'});
 await p.evaluate(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('crsek09_seen_tutorial','1');});
 await p.reload({waitUntil:'networkidle2'});
 for(let i=0;i<80;i++){const ok=await p.evaluate(()=>!!(window.MeshRig&&window.MeshRig.ready));if(ok)break;await wait(200);}
 const d=await p.evaluate(()=>{
   const THREE=window.THREE, MR=window.MeshRig;
   const hasSU = !!(THREE.SkeletonUtils && THREE.SkeletonUtils.clone);
   const clone = MR.create('#7fd1ae','bat');
   let srcMesh=null, dstMesh=null;
   MR.source.traverse(o=>{ if(o.isSkinnedMesh && /surface/i.test(o.name) && !srcMesh) srcMesh=o; });
   clone.traverse(o=>{ if(o.isSkinnedMesh && !dstMesh) dstMesh=o; });
   const sameBones = srcMesh && dstMesh && srcMesh.skeleton.bones[0] === dstMesh.skeleton.bones[0];
   return {hasSkeletonUtils:hasSU,
     srcBones: srcMesh?srcMesh.skeleton.bones.length:0,
     dstBones: dstMesh?dstMesh.skeleton.bones.length:0,
     shareBones: !!sameBones,
     srcBindMode: srcMesh?srcMesh.bindMode:null,
     dstBindMode: dstMesh?dstMesh.bindMode:null};
 });
 console.log(JSON.stringify(d,null,1));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
