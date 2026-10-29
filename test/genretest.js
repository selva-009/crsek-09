global.window = global;
require(require('path').resolve(__dirname,'..','js','engine.js'));
const E = global.Engine;
const out = {};
const teams=[{name:'A',players:[{id:'a1',name:'A1'},{id:'a2',name:'A2'},{id:'a3',name:'A3'}]},
             {name:'B',players:[{id:'b1',name:'B1'},{id:'b2',name:'B2'},{id:'b3',name:'B3'}]}];
function mk(){
  const ev=[];
  const r=new E.MatchRunner({format:2,overs:2,teams,forceBatFirst:true},(t,p)=>ev.push({t,p}));
  r.start(); r.clearTimers(); r.chooseBat(true); r.clearTimers();
  r.deliverySetup(); r.clearTimers();
  r.setDelivery(r.bowler().id,{line:0,length:'good',type:'pace',release:0.55});
  r.clearTimers();
  return {r, ev};
}
// 1. timing label in the shot event
function timingAt(offset){
  const {r,ev}=mk();
  const t=r.pendingDelivery.traj;
  r.ballStart = Date.now() - (t.contactAt+offset)*1000;
  r.setShot('a1',{type:'drive',dir:0,foot:'neutral'});
  r.onArrival(); r.clearTimers();          // the ball reaches the bat
  const shot=ev.find(e=>e.t==='shot');
  return shot ? shot.p.shot.timing : null;
}
out.timingLabels = { perfect: timingAt(0), early: timingAt(-0.18), late: timingAt(0.18) };

// 2. throw accuracy changes the run-out chance
function throwAt(acc){
  const {r}=mk();
  r.phase='inplay';
  r.ball={stopped:true,heldBy:'a1',stoppedAt:{x:3,y:6},extraRuns:1};
  const real=Math.random; Math.random=()=>0.5;   // deterministic midpoint
  r.throwAtStumps('a1','striker',acc);
  Math.random=real;
  r.clearTimers();
  return r.lastResult ? r.lastResult.kind : 'none';
}
out.throwMeter = { green: throwAt(0.95), orange: throwAt(0.6), wild: throwAt(0.05) };

// 3. cancel run undoes a called run
const {r:rc}=mk();
rc.phase='inplay';
rc.ball={x:10,y:0,z:0.1,extraRuns:0,stopped:false};
rc.callRun('a1');
const afterCall = rc.ball.extraRuns;
rc.cancelRun('a1');
out.cancelRun = { afterCall: afterCall, afterCancel: rc.ball.extraRuns };
console.log(JSON.stringify(out,null,1));
process.exit(0);
