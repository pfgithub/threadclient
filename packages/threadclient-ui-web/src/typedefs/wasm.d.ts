declare module "*.wasm?init" {
    export default function<T extends WebAssembly.Exports>(imports: WebAssembly.Imports): Promise<T>;
}