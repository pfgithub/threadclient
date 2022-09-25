import * as Generic from "api-types-generic";
import { JSX } from "solid-js";
import { SwitchKind } from "tmeta-util-solid";
import { bioRender } from "../page1";
import { SolidToVanillaBoundary } from "../util/interop_solid";
import { ClientPostOpts } from "./Post";
import proxyURL from "./proxy_url";

/*

- banner
- icon, title. grid overlap banner.
- 

*/

export default function Header(props: {
    header: Generic.FilledIdentityCard,
    opts: ClientPostOpts,
}): JSX.Element {
    return <div>
        <SolidToVanillaBoundary getValue={(hsc) => {
            const resdiv = document.createElement("div");
            const res = bioRender(props.header, resdiv);
            res.defer(hsc);
            return resdiv;
        }} />
    </div>;
}

export function Header2(props: {
    header: Generic.FilledIdentityCard,
    opts: ClientPostOpts,
}): JSX.Element {
    // we have to un-indent
    // do we just do negative margin?
    // - that might overlap other objects
    //   - negative margin but only if it's the flat top/bottom?
    return <div>
        <Banner banner={props.header.theme.banner} />
    </div>;
}

export function Banner(props: {banner: Generic.Banner}): JSX.Element {
    return <SwitchKind item={props.banner ?? {kind: "none" as const}} children={{
        image: (bimg) => <>
            <FullscreenViewer img_src={bimg.desktop}>
                <img src={proxyURL(bimg.desktop)} alt="" />
            </FullscreenViewer>
        </>,
        color: (bcolor) => <>
        </>,
        none: () => <>
        </>,
    }} />;
}

export function FullscreenViewer(props: {img_src: string, children: JSX.Element}): JSX.Element {
    return <div>{props.children}</div>;
}