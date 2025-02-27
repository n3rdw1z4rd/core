declare type UV = [number, number];
declare type VEC2 = [number, number];
declare type VEC3 = [number, number, number];
declare type VEC4 = [number, number, number, number];

declare type KeyValue = { [key: string]: any };

type JSONValue =
    | string
    | number
    | boolean
    | null
    | JSONValue[]
    | { [key: string]: JSONValue };

declare type DataJson = {
    [k: string]: JSONValue,
};

// interface JSONObject {
//     [k: string]: JSONValue
// }

// interface JSONArray extends Array<JSONValue> { }

declare module "*.glsl" {
    const value: string;
    export default value;
}

declare module "*.vert" {
    const value: string;
    export default value;
}

declare module "*.frag" {
    const value: string;
    export default value;
}
