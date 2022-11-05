import * as Generic from "api-types-generic";
import { JSX } from "solid-js";
import { Show, SwitchKind, TimeAgo } from "tmeta-util-solid";
import Clickable from "./Clickable";
import ReadLink from "./ReadLink";
import { RichtextSpans } from "./richtext";

export default function Notification(props: {notification: Generic.PostContentNotification}): JSX.Element {
    return <div>
        <TimeAgo start={props.notification.when} />
        <SwitchKind item={props.notification.notification} fallback={(ntfy) => (
            <div>todo notification kind: {ntfy.kind}</div>
        )}>{{
            any_rtspan: (span) => <RichtextSpans spans={span.spans} />,
            todo: (todo) => <div>todo: <Show when={todo.actor}>{actor_link => (
                <ReadLink link={actor_link} fallback={<div class="inline-block">
                    actor not found error
                </div>}>{actor => (
                    <div class="inline-block">
                        <Clickable class="underline" action={{url: actor.url, client_id: actor.client_id}}>
                            {actor.name_raw}
                        </Clickable>
                    </div>
                )}</ReadLink>
            )}</Show> {todo.text}</div>,
        }}</SwitchKind>
    </div>;
}