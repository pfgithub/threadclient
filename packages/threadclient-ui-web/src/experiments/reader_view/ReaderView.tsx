import type * as Generic from "api-types-generic";
import { createMemo, JSX } from "solid-js";
import { updateQuery } from "tmeta-util";
import { Show } from "tmeta-util-solid";
import { Body } from "../../components/body";
import Clickable from "../../components/Clickable";
import { Flair } from "../../components/Flair";
import { InternalIconRaw } from "../../components/Icon";
import InfoBar from "../../components/InfoBar";
import { LinkButton, UserLink } from "../../components/links";
import Pfp from "../../components/Pfp";
import { getSettings, getWholePageRootContext } from "../../util/utils_solid";

export default function ReaderView(props: {
    pivot: Generic.Link<Generic.Post>,
}): JSX.Element {
    const hprc = getWholePageRootContext();
    const pivotedPost = createMemo((): {v: Generic.Post, content: null | Generic.PostContentPost} => {
        const res = hprc.content.view(props.pivot);
        if(res == null || res.error != null) throw new Error("rve");
        const v = res.value;
        if(v.kind === "post" && v.content.kind === "post") {
            return {v, content: v.content};
        }
        return {v, content: null};
    });
    const settings = getSettings();

    return <div class="w-full min-h-screen bg-white">
        <div class="max-w-2xl mx-auto h-full p-4 text-base">
            <Clickable
                class="fixed top-0 left-0 bg-hex-000000 bg-opacity-50 p-4"
                action={{
                    mode: "replace",
                    client_id: pivotedPost().v.client_id,
                    page: (): Generic.Page2 => ({content: hprc.content.untrackToContent(), pivot: props.pivot}),
                    url: updateQuery(pivotedPost().v.url ?? "ENO", {'--tc-view': undefined}),
                }}
            >
                <InternalIconRaw
                    class="fa-solid fa-down-left-and-up-right-to-center text-base"
                    label={"Exit Reader"}
                />
            </Clickable>
            <div class="pt-4" />
            <Show when={pivotedPost().content} fallback={<>
                pivotedpost content is undefined
            </>}>{content => <>
                <Show when={content.title}>{pt => <>
                    <span role="heading" class="block text-4xl font-black">
                        {pt.text}
                    </span>
                    <div class="pt-4" />
                </>}</Show>
                <Show when={content.author}>{author => <>
                    <Show if={
                        settings.authorPfp() === "on"
                    } when={author.pfp} fallback={"By "}>{pfp => <>
                        <Pfp pfp={pfp} class="w-8 h-8 inline-block align-middle" />
                    </>}</Show>
                    <UserLink
                        client_id={author.client_id}
                        href={author.link}
                        color_hash={author.color_hash}
                    >
                        {author.name}
                    </UserLink>{" "}
                </>}</Show>
                <Show when={content.author}>{author => <>
                    <Show when={author.flair}>{flair => <>
                        <Flair flairs={flair} />{" "}
                    </>}</Show>
                </>}</Show>
                <Show when={content.info?.in}>{in_sr => <>
                    {" in "}<LinkButton
                        action={{url: in_sr.link, client_id: in_sr.client_id}}
                        style="previewable"
                    >{in_sr.name}</LinkButton>{" "}
                </>}</Show>
                <InfoBar post={content} opts={{
                    client_id: pivotedPost().v.client_id,
                    frame: pivotedPost().v,
                    id: props.pivot,
                    flat_frame: null,
                }} />
                <Body body={content.body} autoplay={true} />
            </>}</Show>
        </div>
    </div>;
}