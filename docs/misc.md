# Misc

`import { ... } from "@n3rdw1z4rd/core";`

A handful of small standalone helpers that didn't fit any other category.

```ts
function isNullOrUndefined(target: any): boolean; // target === null || target === undefined
function isPositiveString(target: string): boolean; // target.length > 0

function getRedYellowGreenGradientHex(min: number, max?: number): string;

function GetUrlParams(): KeyValue; // parses location.search into a plain object
```

`getRedYellowGreenGradientHex` maps a value onto an 11-step red-to-green hex color gradient (useful for health bars, heatmaps, etc.) - call it with just one argument to treat it as a `0-1` percentage, or with both `min`/`max` to compute the percentage from a range:

```ts
import { getRedYellowGreenGradientHex } from "@n3rdw1z4rd/core";

healthBar.style.background = getRedYellowGreenGradientHex(currentHp, maxHp);
healthBar.style.background = getRedYellowGreenGradientHex(0.75); // same idea, pre-computed percentage
```

`GetUrlParams` reads the current page's query string into a plain key/value object:

```ts
import { GetUrlParams } from "@n3rdw1z4rd/core";

const params = GetUrlParams(); // e.g. "?level=3&debug=true" -> { level: '3', debug: 'true' }
```
