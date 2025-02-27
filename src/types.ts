export declare type KeyValue = { [key: string]: any };

export declare type JSONValue =
    | string
    | number
    | boolean
    | null
    | JSONValue[]
    | { [key: string]: JSONValue };

export declare type DataJson = {
    [k: string]: JSONValue,
};

// interface JSONObject {
//     [k: string]: JSONValue
// }

// interface JSONArray extends Array<JSONValue> { }

// export declare module "*.glsl" {
//     const value: string;
//     export default value;
// }

// export declare module "*.vert" {
//     const value: string;
//     export default value;
// }

// export declare module "*.frag" {
//     const value: string;
//     export default value;
// }
