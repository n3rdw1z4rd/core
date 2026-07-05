# Math & RNG

`import { ... } from "@n3rdw1z4rd/core";`

## math.ts

Every function here is a from-scratch reimplementation - nothing calls native `Math.*`. `sin`/`cos` use a quadrant-reduced Taylor series (accurate to ~4.65e-7 across a full sweep); the rest are the obvious bit-twiddling/algebraic equivalents.

```ts
abs(n)
min(a, b)
max(a, b)
floor(n)
ceil(n)
round(n)                          // round to nearest integer
sqrt(n)
pow(base, exp)
hypot2(x, y)                      // sqrt(x*x + y*y)
hypot3(x, y, z)
imul(a, b)                        // 32-bit integer multiply
sin(n)
cos(n)
clamp(value, lo, hi)
deg2rad(value)
lerp(start, end, scale)
distance2d(x1, y1, x2, y2)
distance3d(x1, y1, z1, x2, y2, z2)
squaredDistance(x1, y1, x2, y2)
manhattanDistance(x1, y1, x2, y2)
roundTo(value, digits, base = 10) // arbitrary-precision round; distinct from round()
```

Also exports the constant `PI`, and a handful of plain readonly-field interfaces for shapes used elsewhere in the package - `XY`, `XYZ`, `XYZW`, `RGB`, `RGBA` (e.g. `{ readonly x: number, readonly y: number }`). These are structural shapes, not classes with methods - `Input.mousePosition`, `CanvasRenderer`'s draw methods, `TextureAtlas.getUv`, and `RandomNumberGenerator.randomUnitVector` all just use plain `[number, number]`/`[number, number, number, number]` tuples inline instead.

```ts
import { sin, cos, PI, clamp } from "@n3rdw1z4rd/core";

const x = cos(PI / 4);
const y = clamp(someValue, 0, 1);
```

## rng.ts

`RandomNumberGenerator` is a seeded PRNG (splitmix32-based). A ready-to-use singleton is exported as `rng`. (Note: this class was named `Rng` in earlier versions of this package - if you're upgrading, update any type annotations that referenced `Rng` directly. The `rng` singleton's name is unchanged.)

```ts
class RandomNumberGenerator {
    seed: number;              // get/set current seed
    readonly startingSeed: number;

    get nextf(): number;       // float in [0, 1)
    get nexti(): number;       // integer

    range(min: number, max?: number): number;
    randomUnitVector(): [number, number];
    parkMillerNormal(): number; // gaussian sample, mean 0.5 stddev 1/6
    choose(...args: any[]): any;
    shuffle(value: any[] | string): any[] | string;
    uid(length?: number): string;
    randomMatrix(size: number): number[][];
}

const rng: RandomNumberGenerator;
```

**`range(min, max)` is exclusive of `max`** (if you only pass one argument, it's treated as `max` with `min = 0`). This changed from inclusive in older published versions of this package - if you're upgrading, `rng.range(0, 10)` now returns a value in `[0, 10)` instead of `[0, 10]`.

```ts
import { rng } from "@n3rdw1z4rd/core";

rng.seed = 12345;               // make it deterministic
rng.range(0, 10);               // int in [0, 10)
rng.range(10);                  // same as range(0, 10)
rng.choose('a', 'b', 'c');      // pick one
rng.shuffle([1, 2, 3, 4]);      // shuffled copy... (sorts in place, returns same array)
rng.randomMatrix(5);            // 5x5 array of floats in [-1, 1] - used by the particle-life attraction matrix
```

`parkMillerNormal()` is the one function in this module that calls native `Math.log` (there's no pure natural-log implementation in `math.ts` yet) - everything else is built on the reimplemented `sin`/`cos`/`sqrt`.
