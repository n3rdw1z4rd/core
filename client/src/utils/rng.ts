const MAX_INT: number = 2147483647;

// source: https://github.com/bryc/code/blob/master/jshash/PRNGs.md#splitmix32
function splitmix32(seed: number) {
    seed |= 0;
    seed = seed + 0x9e3779b9 | 0;

    var t = seed ^ seed >>> 15; t = Math.imul(t, 0x85ebca6b);
    t = t ^ t >>> 13; t = Math.imul(t, 0xc2b2ae35);

    return ((t = t ^ t >>> 16) >>> 0) / 4294967296;
}

const RNG = splitmix32;

export class RandomNumberGenerator {
    private _seed: number = Date.now();
    private _randFunc: Function = RNG(this._seed);

    seed(n?: number): number {
        if (n !== undefined) {
            this._seed = n;
            this._randFunc = RNG(this._seed);
        }

        return this._seed;
    }

    randomFloat(): number {
        return this._randFunc();
    }

    randomInt(): number {
        return (0 | (this._randFunc() * MAX_INT));
    }

    randomRange(min: number, max?: number): number {
        if (max == undefined) {
            max = min;
            min = 0;
        }

        return (min + this.randomInt() % (max - min));
    }

    choose(values: any[] | string, weights?: number[]): any {
        values = Array.isArray ? ([...values] as any[]) : ((values as string).split('') as string[]);

        if (weights?.length === values.length) {
            const cWeights = [];

            for (let i = 0; i < weights.length; i++) {
                cWeights[i] = weights[i] + (cWeights[i - 1] || 0);
            }

            const maxWeight: number = cWeights[cWeights.length - 1];
            const n: number = maxWeight * randomFloat();

            for (let i = 0; i < values.length; i++) {
                if (cWeights[i] >= n) {
                    return values[i];
                }
            }
        } else {
            return values[this.randomInt() % values.length];
        }
    }

    shuffle(value: Array<any> | string): Array<any> | string {
        if (Array.isArray(value)) {
            return value.sort((a, b) => (0.5 - this.randomFloat()));
        } else {
            return value.split('').sort((a, b) => (0.5 - this.randomFloat())).join('');
        }
    }

    randomPointInCircle(radius: number = 1.0, round: boolean = false): { x: number, y: number } {
        const t = 2 * Math.PI * this.randomFloat();
        const u = this.randomFloat() + this.randomFloat();
        const r = u > 1 ? 2 - u : u;

        let x = radius * r * Math.cos(t);
        let y = radius * r * Math.sin(t);

        if (round === true) {
            x = Math.round(x);
            y = Math.round(y);
        }

        return { x, y };
    }
}

let _instance: RandomNumberGenerator = undefined;

(() => {
    if (_instance === undefined) {
        _instance = new RandomNumberGenerator();
    }
})();

export const seed: (n?: number) => number = _instance.seed.bind(_instance);
export const randomFloat: () => number = _instance.randomFloat.bind(_instance);
export const randomInt: () => number = _instance.randomInt.bind(_instance);
export const randomRange: (min: number, max?: number) => number = _instance.randomRange.bind(_instance);
export const choose: (value: Array<any> | string, weights?: number[]) => any = _instance.choose.bind(_instance);
export const shuffle: (value: Array<any> | string) => Array<any> | string = _instance.shuffle.bind(_instance);
export const randomPointInCircle: (radius: number, round: boolean) => { x: number, y: number } = _instance.randomPointInCircle.bind(_instance);