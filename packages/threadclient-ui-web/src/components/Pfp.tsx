import type * as Generic from "api-types-generic";
import { createSignal, JSX, onCleanup } from "solid-js";
import proxyURL from "./proxy_url";

const decorative_alt = "";

export default function Pfp(props: {pfp: Generic.InfoPfp, class: string}): JSX.Element {
    const [visible, setVisible] = createSignal(false);
    const [masked, setMasked] = createSignal(props.pfp.cw_masked ?? false);
    const [pswpOpen, setPswpOpen] = createSignal(false);
    let imgel!: HTMLImageElement;
    let destroyGallery: null | (() => void) = null;
    onCleanup(() => {
        destroyGallery?.();
        destroyGallery = null;
    });
    return <button class={props.class}
        style={props.pfp.view === "reddit-nft" ? {
            'background-image': "url(/images/pfp_view/reddit-nft.png)",
            'background-position': "center",
            'background-size': "cover",
        } : {}}
        onclick={() => {
            if(masked()) {
                setMasked(false);
                return;
            }
            destroyGallery?.();
            destroyGallery = null;
            import("./gallery").then(gallery => {
                setPswpOpen(true);
                const visible_gallery = gallery.showGallery([{
                    body: {
                        kind: "captioned_image",
                        url: props.pfp.full_size_animated ?? props.pfp.url,
                        w: null,
                        h: null,
                    },
                    thumb: props.pfp.url,
                    aspect: 1,
                }], 0, __ => {
                    const bcr = imgel.getBoundingClientRect();
                    return {
                        x: bcr.x,
                        y: bcr.y + (window.pageYOffset ?? document.documentElement.scrollTop),
                        w: bcr.width,
                        h: bcr.height,
                    };
                }, {
                    onclose: () => {setPswpOpen(false); destroyGallery = null},
                    setIndex: () => void 0,
                });
                destroyGallery = () => {
                    visible_gallery.cleanup();
                };
            }).catch(e => {
                alert("error loading gallery component");
            });
        }}
    ><img
        src={visible() ? proxyURL(props.pfp.url) : ""}
        loading="lazy" // ← not working? I had to implement it myself ↓
        ref={el => {
            imgel = el;
            new IntersectionObserver(itms => {
                itms.forEach(itm => {
                    if(itm.target !== el) return;
                    if(itm.isIntersecting) {
                        setVisible(true);
                    }
                });
            }, {
                rootMargin: "100%",
                threshold: 0,
            }).observe(el);
        }}
        alt={decorative_alt}
        class={"w-full h-full block rounded-md " + (pswpOpen() ? " opacity-0" : "") + (masked() ? " filter blur-sm" : "")}
    /></button>;
}