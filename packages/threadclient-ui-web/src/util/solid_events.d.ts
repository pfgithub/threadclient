import "solid-js";
declare module "solid-js" {
    namespace JSX {
        interface CustomCaptureEvents {
            error: Event;
        }
        interface IntrinsicElements {
            "tc:show-animate": JSX.IntrinsicElements["div"];
            "tc:fallback": JSX.IntrinsicElements["div"];
            "tc:children": JSX.IntrinsicElements["div"];
        }
    }
}
