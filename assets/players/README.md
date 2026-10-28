# Player assets

Drop a rigged character here named exactly **player.glb** and the game will use it
instead of the built-in procedural players.

## What the loader expects

- A glTF 2.0 binary (`.glb`) with a **skinned humanoid** and at least one animation clip.
- Any scale: the model is normalised to 1.8 m tall and grounded on its feet automatically.
- Clips are matched by name. Any of these substrings will map to a game state:

| Game state | Clip names it looks for |
|---|---|
| standing | `idle`, `stand`, `breathing` |
| walking | `walk` |
| running | `run`, `jog`, `sprint` |
| batting | `swing`, `bat`, `hit` |
| bowling | `bowl`, `pitch`, `throw` |
| diving | `dive`, `fall` |
| catching | `catch`, `reach` |
| celebrating | `celebrate`, `cheer`, `victory` |

A missing clip falls back to `idle`, and a missing file falls back to the procedural rig,
so the game never breaks.

## Where to get one

**Mixamo** (mixamo.com) is free with an Adobe account and is the practical source: pick a
character, download as glTF, then download the animations you want and merge them, or use
the combined download. Adobe's terms permit commercial use — check the current terms on
their site before shipping.

**Licence note:** nothing from Mixamo, Kenney or Quaternius is included in this repository.
The pipeline was tested with Khronos' CesiumMan (CC-BY 4.0), which is deliberately not
shipped — it is a walk-cycle test figure, not a cricketer.
