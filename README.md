# Crsek-09

Real-time multiplayer cricket in the browser, built around one idea: in Duo and Squad
modes nobody controls eleven cricketers. Everyone controls the one player whose turn it is.

Built for phones first (portrait or landscape, touch controls), runs on desktop too.

## Play

Open the published URL on two devices, or open it twice on one machine.

- **Practice vs AI** — a full 2-over match against bots, no network needed.
- **Create Room** — you host. Share the 4-letter code or the invite link (`?room=CODE`).
- **Join Room** — enter a friend's code.
- **Quick Match** — joins the first open public game, or hosts one and waits for a real player.

Pick Solo (1 v 1), Duo (2 v 2) or Squad (4 v 4), and 2, 5 or 10 overs. Empty slots fill
with bots, so a match always starts. Humans always bat before bots.

## The squad mechanics

**Batting.** Teammates bat in order, one at a time. Only the player on strike has a bat:
drag the joystick to aim, tap Drive / Loft / Pull / Sweep / Defend to swing. Timing decides
everything — swing as the ball arrives, not before. The non-striker is a real second player
who can call the extra run. When the striker is out, the next teammate in the order walks in.

**Bowling.** One bowler per over, rotating across the human bowlers. Pick line with the
joystick, pick length and type, then stop the release meter in the green. A loose release
produces wides and half-trackers the batter can put away.

**Fielding.** Every other player is given one fielder: move with the joystick, CATCH when the
ball comes near, DIVE to extend reach. The keeper is always AI so nobody is stuck behind
the stumps.

## Architecture

```
index.html          screens: name, home, room, queue, match, result
css/style.css       mobile-first broadcast-style UI
js/engine.js        authoritative cricket engine — rules, ball physics, bots (host only)
js/net.js           PeerJS wrapper: room host/guest, public matchmaking slots
js/view.js          canvas renderer (top-down field, ball arc, fielder markers)
js/main.js          lobby, role-aware controls, intent routing, HUD
```

**The host device is the server.** It owns all match state and runs the rules engine and the
ball simulation. Guests send intents only — `{delivery}`, `{shot}`, `{move}`, `{action}`,
`{run}` — and the engine validates each one against the current phase and the sender's role,
so a non-striker cannot score a shot and a fielder cannot bowl. The host broadcasts state
snapshots at ~20 Hz plus discrete events (delivery, shot, result, innings break, match end).

**No game server required.** PeerJS (WebRTC) carries the traffic peer-to-peer. A 4-letter
room code maps to a deterministic peer id, so joining needs no backend. Public matchmaking
uses 8 advertised slots: a host claims the first free slot id, a joiner scans all 8 at once
and takes the first that opens.

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

## Rules implemented

Toss and bat/bowl choice; configurable overs; legal balls plus wides; boundaries 4 and 6;
runs by running (with a called extra run and run-out risk); bowled, caught, run out, stumped;
strike rotation on odd runs and at over end; batting order and next-man-in; innings break and
target; chase, tie, win; full scorecard with per-batter and per-bowler figures.

## Not in this build

- Voice chat (quick-chat presets only)
- Bots do not take over a disconnected player's slot mid-match
- No LBW/DRS heuristics, no free-hit after a no-ball
- No cosmetics, progression or accounts

## Next stages

1. A small Node + Socket.IO relay so matchmaking and reconnection do not depend on WebRTC.
2. Reconnect: bind a player id to a seat and hand the seat back on rejoin.
3. Richer fielding: throw target selection and direct run-out control.
4. 3D presentation, animation and crowd audio.
5. Native wrapper (Capacitor) for Android/iOS stores.
