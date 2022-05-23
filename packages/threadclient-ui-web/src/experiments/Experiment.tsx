// import type * as Generic from "api-types-generic";
// import { createMemo } from "solid-js";
// // import { PageRes } from "../components/PageRoot";

// export type ExperimentCB = (props: {pivot: Generic.Link<Generic.Post>}) => PageRes;
// export default function Experiment(props: {
//     pivot: Generic.Link<Generic.Post>,
//     experiment: string,
// }): () => PageRes {
//     const experimentCB = createMemo((): PageRes => {
//         if(props.experiment === "@reader_view") {
//             return 
//         }
//         return {
//             get title() {return props.experiment},
//             children: <div>EBADEXPERIMENT</div>,
//         };
//     });

//     return experimentCB;
// }