import { BufferGeometry, Line, LineBasicMaterial, Material, Vector3, type Object3D } from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.pointerEvents = 'none';
document.body.appendChild(labelRenderer.domElement);

window.addEventListener('resize', () => {
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

function addDebugLabel(object: Object3D, text: string) {
    const div = document.createElement('div');
    div.textContent = text;
    div.style.cssText = `
        color: #0f0;
        font: 11px monospace;
        padding: 1px 4px;
        background: rgba(0,0,0,0.7);
        border-radius: 3px;
        white-space: nowrap;
    `;

    const label = new CSS2DObject(div);
    label.position.set(0, 1, 0);
    object.add(label);
    return label;
}

// remove all debug labels easily later
function removeDebugLabel(object: Object3D, label: CSS2DObject) {
    object.remove(label);
    label.element.remove();
}

const FONT_SIZE = 12;

export interface DebugLabel {
    div: HTMLDivElement;
    label: CSS2DObject;
    line: Line;
}

export class DebugRenderer extends CSS2DRenderer {
    private _labels = new Set<DebugLabel>();

    get width(): number { return this.domElement.clientWidth; }
    get height(): number { return this.domElement.clientHeight; }

    constructor() {
        super();

        this.setSize(window.innerWidth, window.innerHeight);
        this.domElement.style.position = 'absolute';
        this.domElement.style.top = '0px';
        this.domElement.style.pointerEvents = 'none';
    }

    resize(width?: number, height?: number): boolean {
        let resized = false;

        width = width ?? this.domElement.parentElement?.clientWidth ?? this.width;
        height = height ?? this.domElement.parentElement?.clientHeight ?? this.height;

        if (this.width !== width || this.height !== height) {
            this.setSize(width, height);
            resized = true;
        }

        return resized;
    }

    createLabel(text: string | string[], offset?: Vector3): DebugLabel {
        if (!Array.isArray(text)) text = [text];

        offset = offset ?? new Vector3(0, -1, 0);

        const div = document.createElement('div');

        div.innerHTML = text.join('<br>');

        div.style.cssText = `
            color: #888;
            font: ${FONT_SIZE}px monospace;
            padding: 4px 8px;
            background: rgba(0,0,0,0.7);
            border-radius: 4px;
            border: 1px dashed #fff;
            white-space: nowrap;
        `;

        const label = new CSS2DObject(div);
        // label.position.set(0, 1, 0);

        const lineGeometry = new BufferGeometry().setFromPoints([
            new Vector3(0, 0, 0),
            offset,
        ]);

        const lineMaterial = new LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.5,
            depthTest: false, // keep visible through geometry, like a debug overlay
        });

        const line = new Line(lineGeometry, lineMaterial);
        line.renderOrder = 999; // draw on top, consistent with depthTest: false

        const debugLabel: DebugLabel = { div, label, line };
        this._labels.add(debugLabel);

        return debugLabel;
    }
}
