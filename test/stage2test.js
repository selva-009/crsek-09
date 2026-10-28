global.window = global;
require(require('path').resolve(__dirname,'..','js','engine.js'));
const E = global.Engine;
const out = {};
function mk(overs){
  const teams=[{name:'A',players:[{id:'a1',name:'A1'},{id:'a2',name:'A2'},{id:'a3',name:'A3'}]},
               {name:'B',players:[{id:'b1',name:'B1'},{id:'b2',name:'B2'},{id:'b3',name:'B3'}]}];
  const r=new E.MatchRunner({format:2,overs:overs||2,teams,forceBatFirst:true},()=>{});
  r.start(); r.clearTimers(); r.chooseBat(true); r.clearTimers();
  return r;
}
// 1. bowler quota
let r = mk(2);
out.quota = { maxOvers: r.maxOversPerBowler() };
r.teams[1].players.forEach(p => p.bOvers = 1);   // all at quota
const idx = (r.pickBowler(), r.bowlerIdx);
out.quota.allAtQuotaStillPicks = typeof idx === 'number';
r.teams[1].players[0].bOvers = 0;
r.pickBowler();
out.quota.prefersUnderQuota = r.bowlerIdx === 0;

// 2. partnership
let p = mk(2);
p.phase='inplay'; p.finishBall({kind:'runs', runs:4}); p.clearTimers();
p.phase='inplay'; p.finishBall({kind:'runs', runs:2}); p.clearTimers();
const after = { runs: p.partnerRuns, balls: p.partnerBalls };
p.phase='inplay'; p.finishBall({kind:'bowled'}); p.clearTimers();
out.partnership = { after: after, afterWicket: { runs: p.partnerRuns, balls: p.partnerBalls } };

// 3. pause / resume
let q = mk(2);
q.deliverySetup(); q.clearTimers();
q.pause();
const paused = { paused: q.paused, timers: q.timers.length };
q.resume();
out.pause = { paused: paused, resumed: q.paused === false, phaseAfterResume: q.phase };

// 4. snapshot exposes the new fields
let z = mk(2);
const snap = z.snapshot();
out.snapshot = { hasPartnership: !!snap.partnership, maxBowlerOvers: snap.maxBowlerOvers, paused: snap.paused };
console.log(JSON.stringify(out,null,1));

process.exit(0);   // engine timers keep the loop alive
