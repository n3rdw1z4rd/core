# Noise

`import { ... } from '@n3rdw1z4rd/core';`

## Noise

A static-method wrapper around the `simplex-noise` npm package, seeded from this library's own `rng`, plus fractal Brownian motion helpers built on top.

```ts
interface FractalParams {
    octaves: number;
    frequency: number;
    persistence: number;
    amplitude: number;
    lacunarity: number;
}

class Noise {
    static noise2d(x: number, y: number): number;
    static noise3d(x: number, y: number, z: number): number;
    static noise4d(x: number, y: number, z: number, w: number): number;
    static fractal2d(x: number, y: number, params: FractalParams): number;
    static fractal3d(x: number, y: number, z: number, params: FractalParams): number;
}
```

```ts
import { Noise } from '@n3rdw1z4rd/core';

const elevation = Noise.fractal2d(x * 0.01, y * 0.01, {
    octaves: 4,
    frequency: 1,
    amplitude: 1,
    persistence: 0.5,
    lacunarity: 2,
});
```

The underlying 2D/3D/4D noise functions are lazily created and memoized as static fields the first time each is used, all seeded from `rng.nextf` - so re-seeding `rng` (via `rng.seed = ...`) before your first call to `Noise` will produce a deterministic noise field, but re-seeding after won't affect noise that's already been generated.

`CubeSphereGeometry.applyFractalBrownianMotion()` (see [threejs-meshes-and-textures.md](threejs-meshes-and-textures.md)) uses `Noise.noise3d` internally for its own, separate fBm implementation.

## SimplexNoise

A self-contained, dependency-free (aside from this package's own `rng`) port of Stefan Gustavson's reference simplex noise implementation. Unlike `Noise` above, this is a plain class you instantiate yourself - each instance gets its own permutation table seeded from `rng` at construction time.

```ts
class SimplexNoise {
    constructor();
    noise2d(x: number, y: number): number;
    noise3d(x: number, y: number, z: number): number;
}
```

```ts
import { SimplexNoise } from '@n3rdw1z4rd/core';

const noise = new SimplexNoise();
const n = noise.noise2d(x * 0.05, y * 0.05);
```

Use `Noise` for the common case (it's already wired to the well-tested `simplex-noise` package and gives you 4D + fractal helpers for free). `SimplexNoise` exists mainly for projects that want to avoid the `simplex-noise` peer dependency entirely.
