global.window = global;
require(require('path').resolve(__dirname,'..','js','engine.js'));
const E = global.Engine;
const teams=[{name:'A',players:[{id:'a1',name:'A1'},{id:'a2',name:'A2'},{id:'a3',name:'A3'}]},
             {name:'B',players:[{id:'b1',name:'B1'},{id:'b2',name:'B2'},{id:'b3',name:'B3'}]}];
const r=new E.MatchRunner({format:2,overs:2,teams,forceBatFirst:true},()=>{});
r.start();r.clearTimers();r.chooseBat(true);r.clearTimers();
const orig=Math.random; Math.random=()=>0.0;   // force the direct hit
r.phase='inplay';
r.ball={stopped:true,heldBy:'a1',stoppedAt:{x:2,y:6},extraRuns:1};
r.throwAtStumps('a1','striker');
r.clearTimers();
const res={kind:r.lastResult&&r.lastResult.kind,text:r.lastResult&&r.lastResult.text,wkts:r.bat().score.w};
// and a throw from a player who is not holding the ball must be ignored
const r2=new E.MatchRunner({format:2,overs:2,teams,forceBatFirst:true},()=>{});
r2.start();r2.clearTimers();r2.chooseBat(true);r2.clearTimers();
r2.phase='inplay'; r2.ball={stopped:true,heldBy:'a2',stoppedAt:{x:2,y:6}};
r2.throwAtStumps('a1','striker'); r2.clearTimers();
const ignored={phase:r2.phase,wickets:r2.bat().score.w};
Math.random=orig;
console.log(JSON.stringify({directHit:res,unauthorisedThrow:ignored},null,1));

process.exit(0);   // engine timers keep the loop alive
