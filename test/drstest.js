global.window = global;
require(require('path').resolve(__dirname,'..','js','engine.js'));
const E = global.Engine;
const out = {};
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
// 1. LBW opens a review window and blocks progress until resolved
let r = mk();
r.ball = { x: 0.95, y: 10, z: 0.4 };            // pitched wide: would miss
r.phase='inplay';
r.finishBall({kind:'lbw'});
out.windowOpens = { phase:r.phase, reviewsLeft:r.reviews.slice(), batter:r.pendingReview && r.pendingReview.batterName };
const beforeW = r.bat().score.w;
// 2. batting side reviews and wins it
r.callReview('a1');
out.overturned = { out:r.lastResult.wicket, note:r.lastResult.text, wicketsBefore:beforeW, wicketsAfter:r.bat().score.w,
                   batterOut:r.bat().players[0].out, reviewsLeft:r.reviews.slice(), phase:r.phase };

// 3. a clear LBW is upheld and the review is lost
let r2 = mk();
r2.ball = { x: 0.04, y: 10, z: 0.4 };
r2.phase='inplay'; r2.finishBall({kind:'lbw'});
r2.callReview('a1');
out.upheld = { out:r2.lastResult.wicket, note:r2.lastResult.text, reviewsLeft:r2.reviews.slice(), wickets:r2.bat().score.w };

// 4. umpire's call keeps the review and the wicket
let r3 = mk();
r3.ball = { x: 0.24, y: 10, z: 0.4 };
r3.phase='inplay'; r3.finishBall({kind:'lbw'});
r3.callReview('a1');
out.umpiresCall = { out:r3.lastResult.wicket, note:r3.lastResult.text, reviewsLeft:r3.reviews.slice() };

// 5. the fielding side cannot review, and a team with none left cannot either
let r4 = mk();
r4.ball = { x: 0.04, y: 10, z: 0.4 };
r4.phase='inplay'; r4.finishBall({kind:'lbw'});
r4.callReview('b1');                              // bowling side tries
out.fieldingSideBlocked = { stillReviewing:r4.phase==='review' };
r4.reviews[0] = 0;
r4.callReview('a1');
out.noReviewsLeft = { stillReviewing:r4.phase==='review' };

// 6. running the clock out just continues play
let r5 = mk();
r5.ball = { x: 0.04, y: 10, z: 0.4 };
r5.phase='inplay'; r5.finishBall({kind:'lbw'});
r5.resolveReview(false, null);
out.timeout = { out:r5.lastResult.wicket, note:r5.lastResult.text, phase:r5.phase };
console.log(JSON.stringify(out,null,1));

process.exit(0);   // engine timers keep the loop alive
