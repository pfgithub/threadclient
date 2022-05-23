import { JSX, onCleanup } from "solid-js";
import { InternalIconRaw } from "../../components/Icon";
import proxyURL from "../../components/proxy_url";

function DemoObject(props: {
    children: JSX.Element,
}): JSX.Element {
    return <div class={
        "snap-start h-screen relative"
    }>
        {props.children}
        <div class="absolute inset-0 w-full h-full pb-12 pointer-events-none">
            <div class="flex h-full">
                <div class="flex-1 flex flex-col drop-shadow-md">
                    <div class="flex-1" />
                    <div class="p-4 pointer-events-auto">
                        <div class="font-bold">Post Title</div>
                        <div class="">By u/author on r/subreddit</div>
                        <div class="">©12d ↑1.3k ☺97%</div>
                    </div>
                </div>
                <div class="w-14 flex flex-col items-center drop-shadow-md">
                    <div class="flex-1" />
                    <div class="py-3 text-center pointer-events-auto">
                        <InternalIconRaw class="text-[2rem] fa-solid fa-arrow-up" label="Upvote" />
                        <div>1.3k</div>
                    </div>
                    <div class="py-3 text-center pointer-events-auto">
                        <InternalIconRaw class="text-[2rem] fa-solid fa-arrow-down" label="Downvote" />
                        <div>3%</div>
                    </div>
                    <div class="py-3 text-center pointer-events-auto">
                        <InternalIconRaw class="text-[2rem] fa-regular fa-comment" label="Comment" />
                        <div>53</div>
                    </div>
                </div>
            </div>
        </div>
    </div>;
}

function ImageBody(props: {
    image: string,
    blurhash?: string | undefined,
    color?: string | undefined,
}): JSX.Element {
    const url = () => proxyURL("https://picsum.photos/seed/"+props.image);
    return <div class="w-full h-full relative" style={{'background-color': props.color ?? ""}}>
        <div class="absolute inset-0 w-full h-full overflow-hidden">
            <div class="w-full h-full transform scale-150">
                <img
                    src={url()}
                    class="w-full h-full object-cover filter blur-24px "
                />
            </div>
        </div>
        <img
            src={url()}
            class="relative block w-full h-full object-contain"
        />
    </div>;
}

export default function FullscreenSnapView(): JSX.Element {
    const sel = document.createElement("style");
    sel.textContent = `
        body {
            margin-bottom: 0 !important;
        }
    `;
    onCleanup(() => {
        sel.remove();
    });
    document.body.appendChild(sel);

    return <div class="bg-white h-screen overflow-y-scroll snap-y snap-mandatory">
        <DemoObject>
            <ImageBody image={"1/255/550"} color={"#886b53"} />
        </DemoObject>
        <DemoObject>
            <ImageBody image={"2/270/550"} color={"#272e36"} />
        </DemoObject>
        <DemoObject>
            <ImageBody image={"3/550/255"} color={"#545841"} />
        </DemoObject>
        <DemoObject>
            <div class="w-full h-full bg-yellow-500"></div>
        </DemoObject>
        <DemoObject>
            <div class="w-full h-full bg-black"></div>
        </DemoObject>
        <DemoObject>
            <div class="w-full h-full bg-white-500"></div>
        </DemoObject>
        <DemoObject>
            <div class="p-4">
                Text body? We'll have to display a bunch and end it with a 'read more' button
            </div>
        </DemoObject>
    </div>;
}