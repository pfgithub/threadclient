import { hideshow, HideShowCleanup } from "../app";
import * as Generic from "../types/generic";

import PhotoSwipe from "photoswipe";
import PhotoSwipeUI_Default from "photoswipe/dist/photoswipe-ui-default";

import "photoswipe/dist/photoswipe.css";
import "photoswipe/dist/default-skin/default-skin.css";

export function showGallery(images: Generic.GalleryItem[], frame: HTMLDivElement, index: number, getThumbBoundsFn: (index: number) => {x: number, y: number, w: number}): HideShowCleanup<undefined> {
    const hsc = hideshow();

    const pwspel = el("div").clss("pwsp")
        .attr({'tabindex': "-1", 'role': "dialog", 'aria-hidden': "true"})
        .styl({'top': "0", 'left': "0", 'bottom': "0", 'right': "0", 'z-index': "10000000000"})
        .adto(document.body)
    ;

    pwspel.innerHTML = `
<!-- Background of PhotoSwipe. 
It's a separate element, as animating opacity is faster than rgba(). -->
<div class="pswp__bg"></div>

<!-- Slides wrapper with overflow:hidden. -->
<div class="pswp__scroll-wrap">

<!-- Container that holds slides. PhotoSwipe keeps only 3 slides in DOM to save memory. -->
<div class="pswp__container">
<!-- don't modify these 3 pswp__item elements, data is added later on -->
<div class="pswp__item"></div>
<div class="pswp__item"></div>
<div class="pswp__item"></div>
</div>

<!-- Default (PhotoSwipeUI_Default) interface on top of sliding area. Can be changed. -->
<div class="pswp__ui pswp__ui--hidden">

<div class="pswp__top-bar">

<!--  Controls are self-explanatory. Order can be changed. -->

<div class="pswp__counter"></div>

<button class="pswp__button pswp__button--close" title="Close (Esc)"></button>

<button class="pswp__button pswp__button--share" title="Share"></button>

<button class="pswp__button pswp__button--fs" title="Toggle fullscreen"></button>

<button class="pswp__button pswp__button--zoom" title="Zoom in/out"></button>

<!-- Preloader demo https://codepen.io/dimsemenov/pen/yyBWoR -->
<!-- element will get class pswp__preloader--active when preloader is running -->
<div class="pswp__preloader">
<div class="pswp__preloader__icn">
<div class="pswp__preloader__cut">
<div class="pswp__preloader__donut"></div>
</div>
</div>
</div>
</div>

<div class="pswp__share-modal pswp__share-modal--hidden pswp__single-tap">
<div class="pswp__share-tooltip"></div> 
</div>

<button class="pswp__button pswp__button--arrow--left" title="Previous (arrow left)">
</button>

<button class="pswp__button pswp__button--arrow--right" title="Next (arrow right)">
</button>

<div class="pswp__caption">
<div class="pswp__caption__center"></div>
</div>

</div>

</div>
`;

    const items: PhotoSwipe.Item[] = images.map(img => {
        if(img.body.kind !== "captioned_image") throw new Error("bad");
        return {
            src: img.body.url,
            w: img.body.w,
            h: img.body.h,
            msrc: img.thumb,
            title: img.body.caption,
            alt: img.body.alt,
        };
    });
    const options: PhotoSwipeUI_Default.Options = {
        index,
        history: false,
        focus: false,
        getThumbBoundsFn,
        shareButtons: [
            {id: "download", label: "Download image", url: "{{raw_image_url}}", download: true},
        ],
        loop: false,
    };
    const gallery = new PhotoSwipe(pwspel, PhotoSwipeUI_Default, items, options);
    gallery.init();

    let exists = true;

    function destroy() {
        if(!exists) return;
        exists = false;
        pwspel.remove();
    }

    gallery.listen("destroy", () => {
        destroy();
    });

    hsc.on("cleanup", () => {
        if(exists) gallery.destroy();
        destroy();
    });

    return hsc;
}