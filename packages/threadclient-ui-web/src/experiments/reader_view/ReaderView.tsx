import type * as Generic from "api-types-generic";
import { readLink } from "api-types-generic";
import { createMemo, JSX } from "solid-js";
import { Show } from "tmeta-util-solid";
import { Body } from "../../components/body";
import { Flair } from "../../components/Flair";
import InfoBar from "../../components/InfoBar";
import { LinkButton, UserLink } from "../../components/links";
import { AuthorPfp } from "../../components/Post";
import { getSettings, getWholePageRootContext } from "../../util/utils_solid";

export default function ReaderView(props: {
    url: string,
    pivot: Generic.Link<Generic.Post>,
}): JSX.Element {
    const hprc = getWholePageRootContext();
    const pivotedPost = createMemo(() => {
        const res = readLink(hprc.content(), props.pivot);
        if(res == null || res.error != null) throw new Error("rve");
        const v = res.value;
        if(v.kind === "post" && v.content.kind === "post") {
            return {v, content: v.content};
        }
        throw new Error("eunsupported");
    });
    const settings = getSettings();

    return <div class="w-full min-h-screen bg-white">
        <div class="max-w-2xl mx-auto h-full p-4 text-base">
            <Show when={pivotedPost().content.title}>{pt => <>
                <span role="heading" class="block text-4xl font-black">
                    {pt.text}
                </span>
            </>}</Show>
            <Show when={pivotedPost().content.author}>{author => <>
                <Show if={
                    settings.authorPfp() === "on"
                } when={author.pfp} fallback={"By "}>{pfp => <>
                    <AuthorPfp src_url={pfp.url} hover_src_url={pfp.hover} />{" "}
                </>}</Show>
                <UserLink
                    client_id={author.client_id}
                    href={author.link}
                    color_hash={author.color_hash}
                >
                    {author.name}
                </UserLink>{" "}
            </>}</Show>
            <Show when={pivotedPost().content.author}>{author => <>
                <Show when={author.flair}>{flair => <>
                    <Flair flairs={flair} />{" "}
                </>}</Show>
            </>}</Show>
            <Show when={pivotedPost().content.info?.in}>{in_sr => <>
                {" in "}<LinkButton
                    href={in_sr.link}
                    style="previewable"
                    client_id={in_sr.client_id}
                >{in_sr.name}</LinkButton>{" "}
            </>}</Show>
            <InfoBar post={pivotedPost().content} />
            <Body body={pivotedPost().content.body} autoplay={true} />
        </div>
    </div>;
}