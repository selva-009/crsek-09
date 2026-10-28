# Crsek-09

Real-time multiplayer cricket, built around one idea: in Duo and Squad modes nobody controls
eleven cricketers. Everyone controls the one player whose turn it is.

This repository is the **playable web prototype** — a 3D stadium rendered with Three.js, a real
authoritative match engine, and genuine peer-to-peer multiplayer. It is the concept build that
the production Unity game will be measured against.

## Play

Open the published URL on two devices, or open it twice on one machine.

- **Practice vs AI** — a full match against bots, no network needed.
- **Create Room** — you host. Share the 4-letter code or the invite link (`?room=CODE`).
- **Join Room** — enter a friend's code.
- **Quick Match** — joins the first open public game, or hosts one and waits for a real player.

Pick Solo (1 v 1), Duo (2 v 2) or Squad (4 v 4), and 2, 5 or 10 overs. Empty slots fill with
bots so a match always starts. Humans always bat before bots.

## Controls

| Role | Controls |
|---|---|
| Batting (striker only) | Stick aims and sets footwork — push up for front foot, down for back foot. Then Drive / Loft / Pull / Cut / Sweep / Defend. Each shot has its own side and trajectory; timing beats power, and the wrong foot on a length costs accuracy. |
| Non-striker | **CALL THE RUN** to steal an extra run while the ball is live. |
| Bowling | Stick sets line (left/right) and length (up = yorker, down = short) with a dashed preview line on the pitch. Type and speed buttons, **RELEASE** stops the meter in the green. |
| Fielding | Stick moves your fielder, magnitude is sprint. One contextual button changes with the situation (CATCH / DIVE / PICK UP / THROW / SPRINT), plus a fixed DIVE. |
| Throwing | When you pick the ball up, **THROW · STRIKER'S END** / **NON-STRIKER'S END** goes for the run-out. |

Top-right buttons: scorecard, quick chat, pause, camera (broadcast / batter / top-down), and 3D ↔ 2D.

**Settings** (from the home screen or the pause menu): joystick sensitivity, sound on/off, graphics
quality (auto/high/low) and default camera. All persist in local storage.

**Tutorial** — a five-step walkthrough on first run, replayable from the home screen.

**Batting order** — in a private room the host reorders players within their team before the match
starts, and that order becomes the batting order.

## What is implemented

**Match engine** — toss and bat/bowl choice; configurable overs; legal balls, wides and no-balls;
free hits; boundaries 4 and 6; runs by running with a called extra run and run-out risk; bowled,
caught, LBW, run out, stumped; strike rotation on odd runs and at over end; batting order with
next-man-in; innings break and target; chase, tie and win; per-batter and per-bowler scorecard;
player of the match.

**Shot physics** — the ball leaves the bat with a real velocity vector: speed from contact quality,
elevation from the shot type (a drive leaves at 8°, a loft at 27°), direction from the shot's bias
plus your aim. From there it is integrated frame-rate independently with gravity, bounce restitution
(0.42) and rolling friction, so a perfect loft clears the 66 m rope at 66 m while a defensive push
dies 4 m away and a pull lands at 61 m for three. Only a clean hit goes for six.

**Delivery physics** — the delivery is simulated, not faked: the ball leaves the hand at 2.2 m, pitches
at a point set by the length (a yorker lands at 9.5 m, a bouncer at 3.4 m), bounces to a height the
length dictates (0.28 m for a yorker, 1.7 m for a short ball), and moves laterally through the air
with swing and off the pitch with spin. Whether you are bowled or trapped LBW comes from where the
ball actually finished — line and height at the stumps — not from a dice roll. Shots bounce too:
ground strokes skip off the surface, lofted ones land and roll.

**3D presentation** — oval ground with mowing stripes and boundary rope, 30-yard circle, pitch
with creases, stumps and bails, tiered stands with a crowd, floodlights, low-poly players with
procedural run, bowl and bat-swing animation, ball flight with height, shadow and landing marker.
The camera cuts automatically to your role — over the striker's shoulder when you bat, broadcast
when you bowl — and during a shot it frames the ball together with the two nearest fielders so the
chase stays on screen on a narrow phone. The ◎ button overrides it; 3D ↔ 2D is one tap away.

**Performance** — pixel ratio is capped and shadows only switch on for devices reporting enough
cores and a high-density screen. If average frame time slips past ~28 ms the renderer drops
resolution first and shadows second. Rendering pauses while the tab is hidden.

**Umpires and DRS** — two on-field umpires stand on the field (bowler's end and square leg). An LBW
opens a seven-second review window for the batting side: one review per team per innings, kept if
the review succeeds. The third umpire runs ball tracking on the same delivery data the on-field
umpire saw and returns one of three verdicts — hitting (out stands, review lost), missing (not out,
wicket rolled back, review kept) or umpire's call (out stands, review kept). The projected path is
drawn to the stumps in 3D.

**Multiplayer** — host-authoritative peer-to-peer over WebRTC. Private rooms with codes and invite
links, public matchmaking slots, reconnection (a dropped player's seat is covered by a bot and
handed straight back when they rejoin), quick chat, kit colours per player, local career stats.

## Touch input

`js/input.js` is a small input layer rather than a decorative circle:

- **Pointer capture** — the finger that grabs the stick keeps it even if it slides off the pad, so a fast swipe never drops your aim.
- **Deadzone** at 15% so a resting thumb does not send input, with a normalised vector out.
- **Snap-back** on release, with the nub and a direction arrow following the thumb.
- **One finger per stick** — a second finger tapping a shot button cannot steal or reset the stick, which is verified in `test/btntest3.js` by holding the stick and tapping a shot with a second finger.
- **No page scroll or zoom** — `touch-action: none` on the pad, `preventDefault` on pointer events, and a document-level guard against pinch and double-tap zoom.

The same stick is re-purposed per role: aim and footwork when batting, line and length when bowling, movement when fielding.

## Characters

Characters are the one place this build is honestly short of "realistic". Asset hosts (Mixamo,
Quaternius, Kenney) are unreachable from the sandbox this was built in, so nothing has been
integrated and no account exists. What is here is the best procedural approximation: jointed rigs
built in `view3d.js` — hips, torso, shoulders, elbows, hips, knees and feet, with a helmet, grille, peak, pads, gloves, shoes and a two-part bat. Poses blend toward targets each frame (stance, swing, run, bowl, dive, catch, throw, celebrate) rather than snapping between states. They are stylised, not photoreal: see the external assets note below for what that would take.

## Architecture

```
index.html          screens: name, home, room, queue, match, result
css/style.css       mobile-first broadcast-style UI
js/engine.js        authoritative engine — rules, ball physics, bots (host only)
js/net.js           PeerJS wrapper: room host/guest, public slots, reconnection
js/view3d.js        Three.js stadium, players and animation
js/view.js          classic 2D canvas renderer (fallback / 2D mode)
js/main.js          lobby, role-aware controls, intent routing, HUD, stats
```

**The host device is the server.** It owns all match state and runs the rules engine and the ball
simulation. Guests send intents only — `delivery`, `shot`, `move`, `action`, `run` — and the
engine validates each one against the current phase and the sender's role, so a non-striker cannot
score a shot, a fielder cannot bowl, and only the player holding the ball can throw at the stumps.
The host broadcasts state snapshots at ~20 Hz plus discrete events (delivery, shot, throw, result,
innings break, match end).

**No game server required.** PeerJS (WebRTC) carries the traffic peer-to-peer; a 4-letter room code
maps to a deterministic peer id. Public matchmaking uses 8 advertised slots: a host claims the
first free slot id, a joiner scans all 8 at once and takes the first that opens.

To run against your own signalling server, set this before the app scripts load:

```js
window.CRSEK_PEER = { host: 'signal.example.com', port: 443, path: '/', secure: true };
```

## Run locally

Any static server works:

```bash
cd crsek-09 && python3 -m http.server 8080
# open http://localhost:8080
```

## Testing

The suite lives in `test/` and runs without a browser for the engine, with headless Chromium for the
rest:

```bash
cd test && npm install          # puppeteer-core only
npm run test:engine             # rules, trajectory, DRS, bowler quota, partnership, pause
npm run test:input              # joystick capture, deadzone, multi-touch isolation
npm run test:match              # a full 3D match to the result screen
npm run test:multiplayer        # two peers, room sync, disconnect, reconnect
```

The build is checked three ways before each deploy:

- `test/physics.js` — launch and flight: each shot leaves at its own angle (drive 12°, pull −65°,
  cut 105°, sweep −122°), a loft is the only shot that clears the rope, a drive lands at 32 m, a
  defensive push at 4 m, a mistimed edge at 5 m, and no trajectory produces NaN.
- `test/drstest.js` — DRS: the window opens on an LBW and blocks play, a missing ball overturns the
  wicket and returns the batter, a hitting ball is upheld and costs the review, umpire's call keeps
  both the wicket and the review, the fielding side cannot review, a team with no reviews left
  cannot review, and letting the clock run out simply continues play.
- `test/drsui.js` — the same flow in a real browser: the review card appears with a countdown, the
  REVIEW button sends the decision upstairs, and the verdict, 3D tracking line and DRS counter update.
- `test/rules2.js` — trajectory and feel: the ball travels down the pitch, pitches, bounces and
  swings; a yorker and a bouncer pitch at different points and bounce to different heights; perfect
  timing scores 1.0 against 0.1 for early or late; Drive / Pull / Cut / Sweep leave at 12°, −65°,
  105° and −122°.
- `test/visible.js` — projects every player through the live camera and asserts the ball, striker
  and nearest fielders are inside the frame during a shot.
- `test/rules.js` — drives the engine headlessly in Node: no-ball awards one extra and a free
  hit without counting the ball, a free hit blocks a wicket, a wide costs one and is re-bowled,
  odd runs rotate strike, a wicket brings the next batter in and credits the bowler, innings
  break sets the target, match end picks a player of the match.
- `test/throwtest.js` — a throw from the player holding the ball can produce a run-out; a throw
  from anyone else is ignored.
- `test/test8.js` — two real browser peers: room join, identical state on both screens, forced
  disconnect (seat covered by a bot), reconnect (seat handed back), no console errors.

`test/fakepeer.js` substitutes a BroadcastChannel signalling shim so the real netcode can be
driven across tabs where WebRTC is unavailable (as in CI sandboxes).

## External assets — what would actually make the players realistic

The current characters are hand-built geometry. Three.js can render realistic humans fine — it supports skinned glTF meshes with bone rigs — but realistic humans have to be *authored*, and procedural boxes and cylinders cannot become anatomically correct characters with facial rigs and mocap-quality animation. That needs external assets, so per your instruction, here is the request before anything is integrated:

| Option | Source | Cost / licence | Requirements | Why it would help |
|---|---|---|---|---|
| **Mixamo** (Adobe) | mixamo.com | Free, needs a free Adobe account. Adobe's terms permit use of characters and animations in commercial projects; confirm the current terms on their site before shipping. | Adobe account; downloads as FBX, converted to glTF for the web | Rigged humans plus a large mocap library (batting, bowling, running, diving, catching, throwing, celebrating) that matches the animation list you asked for |
| **Ready Player Me** | readyplayer.me | Free tier for avatars; commercial use depends on plan — check their pricing page | Account and API key for automated creation | Realistic, customisable avatars (faces, hair, kit) exported as glTF |
| **Kenney / Quaternius character packs** | kenney.nl, quaternius.com | CC0 — free for commercial use, no account | None | Stylised low-poly rigged characters with animation sets, safe for mobile budgets |

My recommendation: **Mixamo for the animation set** and either Mixamo characters or a CC0 pack for the meshes, converted to glTF. It gives the animation coverage you listed (front-foot and back-foot shots, run-ups, releases, dives, throws, celebrations) without hand-animating anything. The cost is weight: 17 skinned characters at once is heavy on Android, so it would need LOD levels, fewer on-screen fielders or instancing, and the asset bundle would grow from ~0 KB to a few MB.

I have not integrated any of these — no account exists, no key is configured, and nothing here should assume one is. Say which option you want and I'll wire the loader and the LOD budget.

## Not in this build

- Voice chat is wired in `net.js` (mesh audio over the same peer connection) but has no UI yet.
- No dedicated relay server: if a network blocks WebRTC, room joins fail with a visible error.
- No accounts — career stats and kit live in local storage.
- Bots do not bat for a human who is present but idle.

## Production path: Unity

The web prototype is the concept and the rules reference. The shipping game should be Unity + C#,
because the target is Android/iOS and the requirements — real-time physics, animation blending,
stadium art, mobile input, native store distribution — are what Unity is built for. The web
build stays online as a playable demo and design tool.

Recommended Unity stack: Unity 2022 LTS (URP) · Netcode for GameObjects with a dedicated
authoritative server (Linux build on a small VPS) or Unity Relay for matchmaking · Unity Input
System with on-screen virtual joysticks for touch · Addressables for stadium/kit assets ·
Cinemachine for the broadcast camera.

Port order, each stage playable before the next:

1. **Rules core in C#** — port `engine.js` to plain C# classes (`MatchState`, `BallResolver`,
   `Innings`) with no Unity dependency, plus the same Node rule tests rewritten as NUnit.
2. **One-pitch prototype** — batter, bowler, keeper and fielders as capsules, ball with Rigidbody
   physics, scoreboard HUD. Single player, one over.
3. **Roles and controls** — bat timing, bowling meter, fielding joystick, throw targets.
4. **Networked Duo/Squad** — server-authoritative match runner mirroring the intent/state protocol
   already used here: clients send intents, the server validates role and phase, state snapshots go
   out at 20 Hz.
5. **Rooms, matchmaking, reconnection** — lobby UI, room codes, backfill with bots.
6. **Presentation** — stadium art, animation rigs, crowd and audio, camera cuts and replays.
7. **Mobile hardening** — input latency, thermal budget, battery, store builds.
