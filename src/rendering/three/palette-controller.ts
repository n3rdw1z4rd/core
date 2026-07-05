import { Color, Vector3, type ColorRepresentation } from 'three';
import type { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js' with { 'resolution-mode': 'import' };
import { clamp } from '../../math';

export interface ColorSelectionOptions {
    signal: AbortSignal,
}

export interface ColorSelectionResult {
    sRGBHex: ColorRepresentation,
}

export interface EyeDropper {
    new(): EyeDropper,
    open: (options?: ColorSelectionOptions) => Promise<ColorSelectionResult>,
};

declare global {
    interface Window {
        EyeDropper?: EyeDropper;
    }
}

export type PaletteControllerOnChange = (colorIndex: number) => void;

export interface PaletteController {
    $innerDiv: HTMLDivElement;
    colorButtons: HTMLElement[];
    colorButtonSize: number;
    selectedBorderStyle: string;
    currentColorIndex: number;
    colorPalette: ColorRepresentation[];
    updatePaletteColors(): void;
    setSelectedColor(colorIndex?: number): void;
    findClosestColorMatchIndex(color: ColorRepresentation): number;
}

export async function CreatePaletteController(
    parentGui: GUI,
    colorPalette: ColorRepresentation[],
    onChange?: PaletteControllerOnChange,
    folderName: string = 'palette',
): Promise<PaletteController> {
    const { Controller } = await import('three/examples/jsm/libs/lil-gui.module.min.js');

    class PaletteControllerImpl extends Controller implements PaletteController {
        $innerDiv: HTMLDivElement;

        colorButtons: HTMLElement[] = [];
        colorButtonSize: number = 20;

        selectedBorderStyle: string = '2px dashed black';

        currentColorIndex: number = 0;

        eyedropperButton?: { disable: (disabled?: boolean) => void };

        colorPalette: ColorRepresentation[];

        private _onColorChange?: PaletteControllerOnChange;

        constructor() {
            const parent = parentGui.addFolder(folderName);

            super(parent, {}, '', 'function');

            this.colorPalette = colorPalette;
            this._onColorChange = onChange;

            this.$widget.style.setProperty('display', 'flex');
            this.$widget.style.setProperty('justify-content', 'center');

            this.$innerDiv = document.createElement('div');
            this.$innerDiv.style.setProperty('display', 'flex');
            this.$innerDiv.style.setProperty('flex-wrap', 'wrap');
            this.$innerDiv.style.setProperty('width', `${this.colorButtonSize * Math.floor(Math.sqrt(this.colorPalette.length)) + 2}px`);

            this.$innerDiv.appendChild(this.$name);
            this.$widget.appendChild(this.$innerDiv);

            this.colorPalette.forEach((color: ColorRepresentation) => this._createColorButton(color));

            if (window.EyeDropper) {
                this.eyedropperButton = parent.add({
                    eyedropper: () => {
                        this.eyedropperButton?.disable(true);

                        new window.EyeDropper!()
                            .open()
                            .then(({ sRGBHex }: ColorSelectionResult) => {
                                const i = this.findClosestColorMatchIndex(sRGBHex);

                                this.setSelectedColor(i);
                                this._onColorChange?.(i);
                            })
                            .finally(() => this.eyedropperButton?.disable(false))
                            .catch(() => { });
                    }
                }, 'eyedropper').name('findClosestColor');
            }

            this.name('');
            this.updateDisplay();
        }

        private _onColorButtonClicked(i: number, button: number) {
            if (button === 0) {
                this.setSelectedColor(i);
                this._onColorChange?.(i);
                this.colorButtons[i].blur();
            } else if (button === 2 && window.EyeDropper) {
                new window.EyeDropper()
                    .open()
                    .then(({ sRGBHex }: ColorSelectionResult) => {
                        this.colorPalette[i] = sRGBHex;

                        this.colorButtons[i].setAttribute('title', `${sRGBHex}`);
                        this.colorButtons[i].style.setProperty('background', sRGBHex as string);

                        this.setSelectedColor(i);
                        this._onColorChange?.(i);
                        this.colorButtons[i].blur();
                    })
                    .finally(() => this.eyedropperButton?.disable(false))
                    .catch(() => { });
            }
        }

        private _createColorButton(color: ColorRepresentation) {
            const i = this.colorButtons.length;

            const colorButton = document.createElement('div');
            colorButton.setAttribute('id', `colorButton${i}`);
            colorButton.setAttribute('title', `${color}`);

            colorButton.style.setProperty('width', `${this.colorButtonSize}px`);
            colorButton.style.setProperty('height', `${this.colorButtonSize}px`);
            colorButton.style.setProperty('background', color as string);
            colorButton.addEventListener('pointerup', (ev: MouseEvent) => this._onColorButtonClicked(i, ev.button));

            this.colorButtons.push(colorButton);
            this.$innerDiv.appendChild(colorButton);
        }

        updatePaletteColors() {
            this.colorPalette.forEach((color: ColorRepresentation, i: number) => {
                if (i < this.colorButtons.length) {
                    this.colorButtons[i].setAttribute('title', `${color}`);
                    this.colorButtons[i].style.setProperty('background', color as string);
                } else {
                    this._createColorButton(color);
                }
            });
        }

        setSelectedColor(colorIndex: number = 0) {
            this.colorButtons[this.currentColorIndex].style.removeProperty('border');
            this.currentColorIndex = clamp(colorIndex, 0, this.colorPalette.length);
            this.colorButtons[this.currentColorIndex].style.setProperty('border', this.selectedBorderStyle);
        }

        findClosestColorMatchIndex(color: ColorRepresentation): number {
            const pickedColor = new Color(color);
            const pickedVector = new Vector3().setFromColor(pickedColor);

            interface ColorDistance { d: number, i: number }

            const list: ColorDistance[] = [];

            this.colorPalette.forEach((paletteColorString: ColorRepresentation, i: number) => {
                const paletteColor = new Color(paletteColorString);
                const paletteVector = new Vector3().setFromColor(paletteColor);
                const d = paletteVector.distanceTo(pickedVector);

                list.push({ i, d });
            });

            list.sort((a: ColorDistance, b: ColorDistance) => (a.d - b.d));

            const closest = list.shift();

            return closest?.i ?? 0;
        }
    }

    return new PaletteControllerImpl();
}
