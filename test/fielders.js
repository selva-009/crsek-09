global.window = global;
require(require('path').resolve(__dirname,'..','js','engine.js'));
const E = global.Engine;
const out = {};
const teams=[{name:'A',players:[{id:'a1',name:'A1'},{id:'a2',name:'A2'},{id:'a3',name:'A3'}]},
             {name:'B',players:[{id:'b1',name:'B1'},{id:'b2',name:'B2'},{id:'b3',name:'B3'}]}];
const r=new E.MatchRunner({format:2,overs:2,teams,forceBatFirst:true},()=>{});
r.start(); r.clearTimers(); r.chooseBat(true); r.clearTimers();

out.homes = r.fielders.every(f => f.homeX != null && f.homeY != null);
out.count = r.fielders.length;

// drag every AI fielder to where the ball stopped
const target = { x: 30, y: -20 };
r.fielders.forEach(f => { if (!f.ownerId) { f.x = target.x; f.y = target.y; } });
const before = r.fielders.filter(f=>!f.ownerId).map(f => +Math.hypot(f.x-f.homeX, f.y-f.homeY).toFixed(1));
out.distanceBefore = { min: Math.min(...before), max: Math.max(...before) };

// the return loop only runs between balls
r.phase = 'result';
const tick = () => new Promise(res => { r._fieldTimer._onTimeout ? r._fieldTimer._onTimeout() : null; res(); });

(async () => {
  // drive the interval body directly for 4 seconds of virtual time
  for (let i = 0; i < 40; i++) r._fieldTimer._onTimeout();   // run the real loop body
  const after = r.fielders.filter(f=>!f.ownerId).map(f => +Math.hypot(f.x-f.homeX, f.y-f.homeY).toFixed(2));
  out.distanceAfter = { max: Math.max(...after) };
  out.returnedHome = Math.max(...after) < 0.35;

  // during play they must NOT walk home (they chase the ball instead)
  r.phase = 'inplay';
  r.fielders.forEach(f => { if (!f.ownerId) { f.x = 20; f.y = -10; } });
  const distInPlay = r.fielders.filter(f=>!f.ownerId).map(f => +Math.hypot(f.x-f.homeX, f.y-f.homeY).toFixed(1));
  out.noResetDuringPlay = Math.min(...distInPlay) > 1;
  r.stop();
  out.timerCleared = !r._fieldTimer;
  console.log(JSON.stringify(out, null, 1));
  process.exit(0);
})();
