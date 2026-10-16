# Microfixd Cognitive Shell + HIO

A React 19 host shell and reusable Three.js holographic interface organ. The package contains the compiled ES module, styles and bundled head geometry. It does not contain a backend, credentials or an autonomous command executor.

```ts
import '@microfixd/cognitive-shell/style.css';
import {initShell,attachChannels,createMicrofixdHostAdapter} from '@microfixd/cognitive-shell';
const shell=initShell({mountSelector:'#microfixd',embedded:true});
const channels=createMicrofixdHostAdapter({token:operatorToken});
const detach=attachChannels(shell,channels);
// On host disposal:
detach();channels.close();shell.destroy();
```

For a head without the shell, construct `new HIO(container)`, call `start()` and ingest typed cognition, emotion, telemetry or audio frames. Always call `dispose()` when the host unmounts. `setProfile('auto')` restores automatic selection after an operator override (`minimal`, `full`, `diagnostic`).

Timed audio frames use `{utteranceId,speaking,playbackMs,visemes:[{atMs,durationMs,value}]}`. The existing Microfixd host currently supplies speaking-state transitions, not provider phoneme timing. The UI reports that distinction. Model deformations are limited derived jaw, smile and brow targets.

The library is compiled for bundlers and externalizes React, ReactDOM and their runtime entrypoints. Hosts must use a single React runtime. The Microfixd repository's Vite configuration deduplicates React and ReactDOM explicitly.

## Model attribution

Infinite, 3D Head Scan by **Lee Perry-Smith / Infinite Realities**, distributed under [Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by/3.0/), based on work at www.triplegangers.com, obtained from the [Three.js r180 examples](https://github.com/mrdoob/three.js/tree/r180/examples/models/gltf/LeePerrySmith). Geometry is normalized and tapered, and bounded facial deformations and hologram materials are added by Microfixd. Original license is included at `src/hio/assets/LICENSE.txt`. Preserve this attribution in redistributed packages and provide appropriate attribution in your host interface or documentation.
