global.window = global;
require(require('path').resolve(__dirname,'..','js','engine.js'));
const E = global.Engine;
let now = 1e12;
const realNow = Date.now;
Date.now = () => now;

function mk(){
  const teams=[{name:'A',players:[{id:'a1',name:'A1'},{id:'a2',name:'A2'},{id:'a3',name:'A3'}]},
               {name:'B',players:[{id:'b1',name:'B1'},{id:'b2',name:'B2'},{id:'b3',name:'B3'}]}];
  const r=new E.MatchRunner({format:2,overs:2,teams,forceBatFirst:true},()=>{});
  r.start(); r.clearTimers(); r.chooseBat(true); r.clearTimers();
  r.deliverySetup(); r.clearTimers();
  r.setDelivery(r.bowler().id,{line:0,length:'good',type:'pace',release:0.55});
  r.clearTimers();
  return r;
}
// remove fielders so we measure pure projectile motion
function clearField(r){ r.fielders = []; }

function run(type, dir, quality, ballZ){
  const r = mk(); clearField(r);
  r.ball = { x: 0, y: 10, z: ballZ };
  r.pendingShot = { type, dir, quality, foot:'neutral' };
  r.startInPlay(r.pendingShot);
  let maxZ = 0, bounces = 0, lastZ = r.ball.z, t = 0;
  const samples = [];
  for (let i=0;i<400;i++){
    now += 16; t += 0.016;
    r.clearTimers();
    if (r.phase !== 'inplay') break;
    r.tickBall(); r.clearTimers();
    if (!r.ball) break;
    maxZ = Math.max(maxZ, r.ball.z);
    if (lastZ > 0.05 && r.ball.z <= 0.05) bounces++;
    lastZ = r.ball.z;
    if (i % 20 === 0) samples.push({t:+t.toFixed(2), x:+r.ball.x.toFixed(1), y:+r.ball.y.toFixed(1), z:+r.ball.z.toFixed(2)});
  }
  const b = r.ball || {};
  return {
    type, outcome: r.lastResult ? r.lastResult.kind : r.phase,
    maxZ:+maxZ.toFixed(2), bounces, dist:+Math.hypot(b.x||0, b.y||0).toFixed(1),
    angle: Math.round(Math.atan2(b.x||0, -(b.y||0) - -10) * 180 / Math.PI),
    stopped: !!b.stopped, nan: !isFinite(b.x) || !isFinite(b.y) || !isFinite(b.z),
    samples: samples.slice(0,4)
  };
}
const out = {};
out.drive = run('drive', 0, 1, 0.75);
out.loft  = run('loft', 0, 1, 0.85);
out.defend= run('defend', 0, 1, 0.8);
out.pull  = run('pull', 0, 1, 1.15);
out.cut   = run('cut', 0, 1, 1.0);
out.sweep = run('sweep', 0, 1, 0.45);
out.mistimed = run('drive', 0, 0.1, 0.75);
out.summary = Object.fromEntries(Object.entries(out).filter(([k])=>k!=='summary').map(([k,v])=>[k,{
  outcome:v.outcome, maxZ:v.maxZ, bounces:v.bounces, dist:v.dist, angle:v.angle, stopped:v.stopped, nan:v.nan
}]));
Date.now = realNow;
console.log(JSON.stringify(out.summary,null,1));
console.log('samples loft:', JSON.stringify(out.loft.samples));
process.exit(0);
