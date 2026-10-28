const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8073;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary'};
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
 await p.waitForSelector('#practiceBtn',{visible:true});await p.click('#practiceBtn');
 await wait(2500);
 const d=await p.evaluate(()=>{
   const THREE=window.THREE, v=window.__crsek.view3d;
   const people=v.scene.children.filter(c=>c.userData&&c.userData.isGLB);
   const one=people[0];
   const model=one.children[0];
   const box=new THREE.Box3().setFromObject(model);
   const size=new THREE.Vector3(); box.getSize(size);
   return {
     people:people.length,
     personPos:[+one.position.x.toFixed(2),+one.position.y.toFixed(2),+one.position.z.toFixed(2)],
     modelScale:+model.scale.x.toFixed(4),
     modelPos:[+model.position.x.toFixed(2),+model.position.y.toFixed(2),+model.position.z.toFixed(2)],
     worldSize:[+size.x.toFixed(2),+size.y.toFixed(2),+size.z.toFixed(2)],
     childTypes:model.children.map(c=>c.type).slice(0,6)
   };
 });
 console.log(JSON.stringify(d,null,1));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
