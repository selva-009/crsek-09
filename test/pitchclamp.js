global.window = global;
require(require('path').resolve(__dirname,'..','js','engine.js'));
const E = global.Engine;
const teams=[{name:'A',players:[{id:'a1',name:'A1'},{id:'a2',name:'A2'},{id:'a3',name:'A3'}]},
             {name:'B',players:[{id:'b1',name:'B1'},{id:'b2',name:'B2'},{id:'b3',name:'B3'}]}];
const r=new E.MatchRunner({format:2,overs:2,teams,forceBatFirst:true},()=>{});
r.start(); r.clearTimers(); r.chooseBat(true); r.clearTimers(); r.deliverySetup(); r.clearTimers();
// park everyone far away, put one fielder just off the strip with the ball on it
r.fielders.forEach((f,i)=>{ f.x = 60 + i; f.y = -40; });
const f = r.fielders.find(x=>!x.keeper);
f.x = 3.2; f.y = 2;
r.phase='inplay';
for (let i=0;i<60;i++){ r.ball={x:0,y:2,z:0.3,stopped:false,quality:0.6}; r.tickBall && r.tickBall(); }
console.log(JSON.stringify({x:+f.x.toFixed(2), y:+f.y.toFixed(2), offPitch: Math.abs(f.x) >= 2.69}));
process.exit(0);
