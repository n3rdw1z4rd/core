# Three.js / lil-gui Widgets

`import { ... } from '@n3rdw1z4rd/core/three';` (or the top-level barrel)

## CreatePaletteController

A [lil-gui](https://lil-gui.georgealways.com/) color-swatch grid widget for picking an index into a flat color palette (e.g. a [`VoxelMesh`](threejs-meshes-and-textures.md)'s `colorPalette`). It's a plain factory function rather than a directly-`new`-able class, and decoupled from any specific app/engine - it just takes a color array reference and an `onChange` callback.

```ts
type PaletteControllerOnChange = (colorIndex: number) => void;

interface PaletteController {
    $innerDiv: HTMLDivElement;
    colorButtons: HTMLElement[];
    colorButtonSize: number;
    selectedBorderStyle: string;
    currentColorIndex: number;
    colorPalette: ColorRepresentation[];
    updatePaletteColors(): void;                              // call after externally mutating colorPalette
    setSelectedColor(colorIndex?: number): void;
    findClosestColorMatchIndex(color: ColorRepresentation): number;
}

function CreatePaletteController(
    parentGui: GUI,
    colorPalette: ColorRepresentation[],
    onChange?: PaletteControllerOnChange,
    folderName?: string, // default 'palette'
): Promise<PaletteController>;
```

```ts
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { CreatePaletteController } from '@n3rdw1z4rd/core/three';

const gui = new GUI();

const controller = await CreatePaletteController(gui, voxelMesh.colorPalette, (index) => {
    currentPaintColor = index;
});
```

**This is `async`** - unlike most of this package's classes, you can't `new` it directly. lil-gui ships as an ESM-only module under `three/examples/jsm`, and the widget's implementation class extends lil-gui's `Controller`, so its constructor is defined inside the factory function after a dynamic `import()` resolves (the same reason `ThreeJsBoilerPlate.enableOrbitControls()` is async - see [threejs-bootstrap.md](threejs-bootstrap.md)).

Left-clicking a swatch selects it (fires `onChange`). Right-clicking a swatch opens the browser's [EyeDropper API](https://developer.mozilla.org/en-US/docs/Web/API/EyeDropper) (Chromium-only, `window.EyeDropper` guarded - the widget silently omits eyedropper functionality where it's unsupported) and overwrites that swatch's color with the picked one. A separate "find closest color" button (also eyedropper-gated) picks a color from the screen and selects whichever existing palette entry is nearest to it in RGB space, without modifying the palette.
