global.window = global;
require(require('path').resolve(__dirname,'..','js/engine.js'));
const E = global.Engine;
const out = {};
const teams=[{name:'A',players:[{id:'a1',name:'A1'},{id:'a2',name:'A2'},{id:'a3',name:'A3'}]},
             {name:'B',players:[{id:'b1',name:'B1'},{id:'b2',name:'B2'},{id:'b3',name:'B3'}]}];
const r=new E.MatchRunner({format:2,overs:10,teams,forceBatFirst:true},()=>{});
r.start(); r.clearTimers(); r.chooseBat(true); r.clearTimers();
out.captains = r.captains;
out.powerplayEarly = r.inPowerplay();
const before = r.fielders.map(f=>({k:f.key, d:+Math.hypot(f.homeX, f.homeY-10).toFixed(1)}));
// captain sets an attacking field between deliveries
r.phase='delivery';
r.setFieldPreset('b1','attacking');
const after = r.fielders.map(f=>({k:f.key, d:+Math.hypot(f.homeX, f.homeY-10).toFixed(1)}));
out.preset = r.fieldPreset;
out.slip = {before: before.find(f=>f.k==='slip').d, after: after.find(f=>f.k==='slip').d};
// a non-captain cannot change it
r.setFieldPreset('b2','defensive');
out.blockedForNonCaptain = r.fieldPreset === 'attacking';
// powerplay keeps at most two outfielders deep
const deep = r.fielders.filter(f=>!f.keeper && Math.hypot(f.homeX, f.homeY-10) > 27).length;
out.deepFieldersInPowerplay = deep;
out.powerplayFlag = r.snapshot().powerplay;
console.log(JSON.stringify(out,null,1));
process.exit(0);
