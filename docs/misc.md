# Misc

`import { ... } from "@n3rdw1z4rd/core";`

A couple of small standalone helpers that didn't fit any other category.

```ts
function isNullOrUndefined(target: any): boolean; // target === null || target === undefined

function getRedYellowGreenGradientHex(min: number, max?: number): string;
```

`getRedYellowGreenGradientHex` maps a value onto an 11-step red-to-green hex color gradient (useful for health bars, heatmaps, etc.) - call it with just one argument to treat it as a `0-1` percentage, or with both `min`/`max` to compute the percentage from a range:

```ts
import { getRedYellowGreenGradientHex } from "@n3rdw1z4rd/core";

healthBar.style.background = getRedYellowGreenGradientHex(currentHp, maxHp);
healthBar.style.background = getRedYellowGreenGradientHex(0.75); // same idea, pre-computed percentage
```
