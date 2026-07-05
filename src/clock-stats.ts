import './css/clock-stats.css';

/**
 * A small absolutely-positioned overlay `<div>` showing key/value stat
 * lines (FPS, delta time, etc). Used internally by {@link Clock.showStats}
 * but can be used standalone too.
 */
export class ClockStats {
    public divElement: HTMLDivElement;

    public keyColor: string = 'gray';
    public valueColor: string = 'lightgray';

    /** Creates the overlay element, anchored to one screen corner (`align` + `justify`). Call {@link appendTo} to mount it. */
    constructor(
        align: ('top' | 'bottom') = 'bottom',
        justify: ('left' | 'right') = 'right',
    ) {
        this.divElement = document.createElement('div');
        this.divElement.setAttribute('id', 'clock-stats');
        this.divElement.style.setProperty('position', 'absolute');

        this.divElement.style.setProperty(align, '4px');
        this.divElement.style.setProperty(justify, '4px');
    }

    /** Moves the overlay into `target` (removing it from any previous parent first), or just detaches it if `target` is omitted. */
    appendTo(target?: HTMLElement): void {
        this.divElement.parentNode?.removeChild(this.divElement);

        if (target) {
            target.appendChild(this.divElement);
        }
    }

    /** Replaces the displayed key/value lines with the entries of `data`. */
    update(data: object): void {
        this.divElement.innerHTML = Object.entries(data).map(([key, value]) =>
            `<span style="color: ${this.keyColor};">${key}:</span>&nbsp;<span style="color: ${this.valueColor};">${value}</span>`
        ).join('<br/>');
    }
}