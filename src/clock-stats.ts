import './css/clock-stats.css';

export class ClockStats {
    public divElement: HTMLDivElement;

    public keyColor: string = 'gray';
    public valueColor: string = 'lightgray';

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

    appendTo(target?: HTMLElement): void {
        this.divElement.parentNode?.removeChild(this.divElement);

        if (target) {
            target.appendChild(this.divElement);
        }
    }

    update(data: object): void {
        this.divElement.innerHTML = Object.entries(data).map(([key, value]) =>
            `<span style="color: ${this.keyColor};">${key}:</span>&nbsp;<span style="color: ${this.valueColor};">${value}</span>`
        ).join('<br/>');
    }
}