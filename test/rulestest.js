global.window = global;
require(require('path').resolve(__dirname,'..','js','engine.js'));
const E = global.Engine;
const out = {};
const teams=[{name:'A',players:[{id:'a1',name:'A1'},{id:'a2',name:'A2'},{id:'a3',name:'A3'}]},
             {name:'B',players:[{id:'b1',name:'B1'},{id:'b2',name:'B2'},{id:'b3',name:'B3'}]}];
function mk(){
  const r=new E.MatchRunner({format:2,overs:2,teams,forceBatFirst:true},()=>{});
  r.start(); r.clearTimers(); r.chooseBat(true); r.clearTimers();
  r.deliverySetup(); r.clearTimers();
  return r;
}
// 1. fielders must never be on the cut strip
const r1=mk();
// a fielder chasing a ball on the strip must stop at the edge
const f1=r1.fielders.find(f=>!f.keeper);
f1.x=6; f1.y=2;
r1.phase='inplay';
r1.ball={x:0,y:2,z:0.3,stopped:false,quality:0.5};
for(let i=0;i<40;i++){ r1.ball={x:0,y:2,z:0.3,stopped:false,quality:0.5}; r1.tickBall && r1.tickBall(); }
out.chaserX = +f1.x.toFixed(2);
out.chaserOffPitch = Math.abs(f1.x) >= 2.7;
// and the return-to-position loop keeps them off the strip
r1.phase='result';
for(let i=0;i<60;i++){ if (r1._fieldTimer) r1._fieldTimer._onTimeout(); }
out.allOffPitch = r1.fielders.every(f=> f.keeper || Math.abs(f.y)>15 || Math.abs(f.x)>=2.7);

// 2. batsman cannot move behind the stumps
const r2=mk();
r2.moveBatsman('a1', 5, -5);
out.batsman = {x:+r2.batsman.x.toFixed(2), y:+r2.batsman.y.toFixed(2)};

// 3. byes when beaten and the ball runs past the keeper
const r3=mk();
r3.phase='inplay'; r3.pendingShot=null;
r3.ball={x:1,y:24,z:0.2,stopped:true,stoppedAt:{x:1,y:24},quality:0.4,extraRuns:0};
const before=r3.bat().score.extras||0;
r3.rollOut({x:1,y:24}); r3.clearTimers();
out.bye={kind:r3.lastResult&&r3.lastResult.kind, extrasAdded:(r3.bat().score.extras||0)-before};

console.log(JSON.stringify(out,null,1));
process.exit(0);
