import { JSX } from "solid-js";

const decorative_alt = "";

export const AuthorPfp = (props: {src_url: string}): JSX.Element => (
    <img src={props.src_url} alt={decorative_alt} class="w-8 h-8 object-center inline-block rounded-full"/>
);

export const makeRenderFunction = (src_url: string): (() => JSX.Element) => (
    () => <AuthorPfp src_url={src_url} />
);