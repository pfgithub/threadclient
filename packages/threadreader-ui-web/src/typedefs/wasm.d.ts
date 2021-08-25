declare module "*.wasm" {
    export default function<T extends WebAssembly.Exports>(imports: WebAssembly.Imports): Promise<T>;
}