global.window = global;
require(require('path').resolve(__dirname,'..','js','engine.js'));
const E = global.Engine;
const out = {};
function mk(){
  const teams=[{name:'A',players:[{id:'a1',name:'A1'},{id:'a2',name:'A2'},{id:'a3',name:'A3'}]},
               {name:'B',players:[{id:'b1',name:'B1'},{id:'b2',name:'B2'},{id:'b3',name:'B3'}]}];
  const r=new E.MatchRunner({format:2,overs:2,teams,forceBatFirst:true},()=>{});
  r.start(); r.clearTimers(); r.chooseBat(true); r.clearTimers();
  return r;
}
function deliver(r, d){
  r.deliverySetup(); r.clearTimers();
  r.setDelivery(r.bowler().id, d);
  r.clearTimers();
  return r.pendingDelivery.traj;
}
// trajectory: sample the flight path
let r=mk();
const traj = deliver(r,{line:0.2,length:'good',type:'swing',release:0.55});
const samples=[];
for(let i=0;i<=10;i++){
  r.ballStart = Date.now() - (traj.duration*1000)*(i/10);
  r.phase='flight';
  r.tickDelivery(); r.clearTimers();
  if(r.phase!=='flight'){ samples.push({p:+(i/10).toFixed(1),arrived:true}); break; }
  samples.push({p:+(i/10).toFixed(1), y:+r.ball.y.toFixed(1), z:+r.ball.z.toFixed(2), x:+r.ball.x.toFixed(2)});
}
out.trajectory = {duration:+traj.duration.toFixed(2), pitchAt:+traj.pPitch.toFixed(2), samples};
out.trajectoryChecks = {
  travelsDownPitch: samples[0].y < samples[5].y,
  bounces: samples.some(s=>s.z>0.3 && s.p>traj.pPitch),
  swingDeviates: Math.abs(samples[samples.length-2].x - 0.2) > 0.05
};

// length changes where it pitches and how high it bounces
const yorker = deliver(mk(),{line:0,length:'yorker',type:'pace',release:0.55});
const short  = deliver(mk(),{line:0,length:'short',type:'pace',release:0.55});
out.lengths = {
  yorkerPitchP: +yorker.pPitch.toFixed(2), shortPitchP: +short.pPitch.toFixed(2),
  yorkerBounce: +yorker.bounceH.toFixed(2), shortBounce: +short.bounceH.toFixed(2),
  distinct: yorker.pPitch > short.pPitch && short.bounceH > yorker.bounceH
};

// timing: perfect contact scores better than a mistimed swing
function shoot(offset){
  const r2=mk();
  const t=deliver(r2,{line:0,length:'good',type:'pace',release:0.55});
  r2.ballStart = Date.now() - (t.contactAt+offset)*1000;
  r2.setShot('a1',{type:'drive',dir:0});
  return r2.pendingShot ? +r2.pendingShot.quality.toFixed(2) : null;
}
out.timing = {perfect:shoot(0), early:shoot(-0.18), late:shoot(0.18)};

// shot direction: pull goes leg side, cut goes off side, drive stays straight
function dirOf(type, aim){
  const r3=mk();
  const t=deliver(r3,{line:0,length:'good',type:'pace',release:0.55});
  r3.ballStart=Date.now()-(t.contactAt)*1000;
  r3.setShot('a1',{type,dir:aim});
  r3.phase='inplay';
  r3.startInPlay(r3.pendingShot); r3.clearTimers();
  const b=r3.ball;
  const a=Math.atan2(b.vx, -b.vy)*180/Math.PI;   // launch direction
  return Math.round(a);
}
out.shotDirections = { drive:dirOf('drive',0), pull:dirOf('pull',0), cut:dirOf('cut',0), sweep:dirOf('sweep',0), loft:dirOf('loft',0) };

// no-ball still behaves with the new trajectory
let rn=mk();
const tn=deliver(rn,{line:0,length:'good',type:'pace',release:0.02});
rn.ballStart=Date.now()-(tn.duration*1000)-50; rn.tickDelivery(); rn.clearTimers();
out.noBall={kind:rn.lastResult.kind, freeHit:rn.freeHit, score:rn.bat().score.r, balls:rn.balls};

console.log(JSON.stringify(out,null,1));

process.exit(0);   // engine timers keep the loop alive
