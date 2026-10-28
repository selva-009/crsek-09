const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const ROOT=require('path').resolve(__dirname,'..'),PORT=8077;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end('nf');}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await new Promise(r=>server.listen(PORT,r));
 const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'],headless:'new'});
 const p=await b.newPage();await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
 await p.goto('http://localhost:'+PORT+'/',{waitUntil:'networkidle2'});
 await p.evaluate(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('crsek09_seen_tutorial','1');});
 await p.reload({waitUntil:'networkidle2'});
 await p.waitForSelector('#nameInput',{visible:true});await p.type('#nameInput','Selva');await p.click('#nameGo');
 await p.waitForSelector('#practiceBtn',{visible:true});await p.click('#practiceBtn');
 await wait(2500);
 const d=await p.evaluate(()=>{
   const v=window.__crsek.view3d, sc=v.scene;
   // find groups that look like people (have userData.joints)
   const people = sc.children.filter(c=>c.userData && c.userData.joints).map(c=>({
     role:c.userData.role, pos:[+c.position.x.toFixed(2),+c.position.y.toFixed(2),+c.position.z.toFixed(2)],
     vis:c.visible, kids:c.children.length,
     hipsY:+c.userData.joints.hips.position.y.toFixed(2),
     torsoRotX:+c.userData.joints.torso.rotation.x.toFixed(2)
   }));
   return {people, cam:[+v.camera.position.x.toFixed(1),+v.camera.position.y.toFixed(1),+v.camera.position.z.toFixed(1)], mode:v.cameraMode()};
 });
 console.log(JSON.stringify(d,null,1));
 await b.close();server.close();setTimeout(()=>process.exit(0),200);
})();
