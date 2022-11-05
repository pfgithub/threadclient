import * as Generic from "api-types-generic";
import { autoFill, autoLinkgen, autoOutline, p2 } from "api-types-generic";
import * as Cohost from "api-types-cohost";
import { encoderGenerator, ThreadClient } from "threadclient-client-base";

// https://trpc.io/
// woah i want this for my apis
// their homepage is so broken

export type BaseClient = {
    _?: undefined,
};
export type BasePost = {
    id: number,
};
export type FullPost = {
    on_base: BasePost,
    data: Cohost.Post,
};
export type BaseComment = {
    on_post: BasePost,
    uuid: string,
};
export type FullComment = {
    on_base: BaseComment,
    data: Cohost.Comment,
};
export type BaseProject = {
    id: number,
};
export type FullProject = {
    on_base: BaseProject,
    data: Cohost.Project,
};
export type FullNotification = {
    on_page: BaseNotificationsPage,
    data: Cohost.Notification,
};

export type BaseNotificationsPage = {
    _?: undefined,
    // maybe this should include the project we're getting notifications for?
    // once we add account switching to threadclient, we'll need that, but not yet.
    // the api doesn't ask for it.
};
export type FullNotificationsPage = {
    on_base: BaseNotificationsPage,
    data: Cohost.Notification[],
};

export type UTLRes = {
    content: Generic.Page2Content,
    pivot_loader: null | Generic.OneLoader<Generic.Post>,
};
export type UTLResAsync = { kind: "async", value: () => Promise<UTLRes> };
export function urlToOneLoader(pathraw_in: string): UTLRes | UTLResAsync {
    const content: Generic.Page2Content = {};
    if(pathraw_in === "/notifications-demo") {
        const notifications_base: BaseNotificationsPage = {};

        return {
            content,
            pivot_loader: p2.prefilledOneLoader(
                content,
                base_notifications_page.post(content, notifications_base),
                undefined,
            ),
        };
    }else{
        throw new Error("unsupported path");
    }
}

const client_id = "cohost";
export const client: ThreadClient = {
    id: client_id,

    getPage: async (path) => {
        let v2res = urlToOneLoader(path);
        if ('kind' in v2res) {
            v2res = await v2res.value();
        }
        if (v2res.pivot_loader != null) {
            const rl_res = Generic.readLink(v2res.content, v2res.pivot_loader.key);
            if (rl_res != null) return {
                content: v2res.content,
                pivot: v2res.pivot_loader.key,
            };
            const loadreq = Generic.readLink(v2res.content, v2res.pivot_loader.request);
            if (loadreq == null || loadreq.error != null) throw new Error("load fail: " + JSON.stringify(loadreq));
            const loadres = await loadPage2v2(loadreq.value);
            return { content: { ...v2res.content, ...loadres.content }, pivot: v2res.pivot_loader.key };
        }
        throw new Error("not supported url "+path);
    },
    loader: loadPage2v2,
};

export const base_client = {
    url: (base: BaseClient): string | null => null,
    post: autoOutline("client→post", (content, base: BaseClient): Generic.Post => {
        return {
            kind: "post",
            content: {
                kind: "client",
                navbar: {
                    actions: [],
                    inboxes: [],
                    client_id,
                },
            },
            internal_data: 0,
            parent: null,
            replies: null,
            url: base_client.url(base),
            client_id,
        };
    }),
    asParent: (content: Generic.Page2Content, base: BaseClient): Generic.PostParent => {
        return {
            loader: Generic.p2.prefilledVerticalLoader(content, base_client.post(content, base), undefined),
        };
    },
};

export const base_notifications_page = {
    url: (base: BaseNotificationsPage) => "/rc/project/notifications",
    post: autoOutline(
        "notifications_page→id",
        (content: Generic.Page2Content, base: BaseNotificationsPage): Generic.Post => {
            // we'll put this in a menu eventually but for now we can do the bare minimum
            return {
                kind: "post",
                content: {
                    kind: "todo",
                    message: "full notifications page",
                },
                internal_data: base,
                parent: base_client.asParent(content, {}),
                replies: base_notifications_page.replies(content, base),
                url: base_notifications_page.url(base),
                client_id,
            };
        },
    ),
    asParent: (content: Generic.Page2Content, base: BaseClient): Generic.PostParent => {
        return {
            loader: Generic.p2.prefilledVerticalLoader(content, base_notifications_page.post(content, base), undefined),
        };
    },
    idReplies: (base: BaseNotificationsPage) => autoLinkgen<Generic.HorizontalLoaded>("notifications_page→replies", base),
    replies: (content: Generic.Page2Content, base: BaseNotificationsPage): Generic.PostReplies => {
        const id_loader = Generic.p2.fillLinkOnce(content, (
            autoLinkgen<Generic.Opaque<"loader">>("notifications_page→replies_loader", base)
        ), (): Generic.Opaque<"loader"> => {
            return opaque_loader.encode({
                kind: "notifications",
                base,
            });
        });
        const id_filled = base_notifications_page.idReplies(base);

        return {
            display: "repivot_list",
            loader: {
                kind: "horizontal_loader",
                key: id_filled,
                request: id_loader,

                load_count: null,
                autoload: false,
                client_id,
            },
        };
    },
};
export const full_notifications_page = {
    fillReplies: autoFill(
        (full: FullNotificationsPage) => base_notifications_page.idReplies(full.on_base),
        (content: Generic.Page2Content, full: FullNotificationsPage): Generic.HorizontalLoaded => {
            const hl_res: Generic.HorizontalLoaded = full.data.map((notification): Generic.HorizontalLoaded[number] => {
                return full_notification.fill(content, {data: notification, on_page: full.on_base});
            });
            return hl_res;
        },
    ),
};
export const full_notification = {
    fill: autoFill(
        (notification: FullNotification) => Generic.p2.symbolLink<Generic.Post>("notification"),
        (content: Generic.Page2Content, full: FullNotification): Generic.Post => {
            return {
                kind: "post",
                content: {
                    kind: "notification",
                    when: new Date(full.data.createdAt).getTime(),
                    notification: full_notification.content(full),
                },
                internal_data: full,
                parent: base_notifications_page.asParent(content, full.on_page),
                replies: null,
                url: null,
                client_id,
            };
        },
    ),
    content: (full: FullNotification): Generic.NotificationContent => {
        // TODO:
        // - for reshares, show any tags. people put comments in tags sometimes
        // - for quote reshares, show a full proper post
        // - for comments, show the proper comment
        if(full.data.type === "like") {
            return {
                kind: "todo",
                actor: base_project.limitedIdCardLink({id: full.data.fromProjectId}),
                text: "liked your post " + full.data.toPostId + " (relationship: " + full.data.relationshipId + ")",
            };
        }
        if(full.data.type === "follow") {
            return {
                kind: "todo",
                actor: base_project.limitedIdCardLink({id: full.data.fromProjectId}),
                text: "followed you",
            };
        }
        if(full.data.type === "share") {
            return {
                kind: "todo",
                actor: base_project.limitedIdCardLink({id: full.data.fromProjectId}),
                text: "shared your post " + full.data.sharePostId + " to their post " + full.data.toPostId + (full.data.transparentShare ? "" : " and added a note"),
            };
        }
        if(full.data.type === "comment") {
            // "commented on the post " + full.data.toPostId + " in reply to " + full.data.inReplyTo + " with their comment " + full.data.commentId
            return {
                kind: "post",
                post: base_comment.postId({uuid: full.data.commentId, on_post: {id: full.data.toPostId}}),
            };
        }
        return {
            kind: "todo",
            text: "notification " + full.data.type,
        };
    },
};

const base_post = {
    postLink: (base: BasePost) => autoLinkgen<Generic.Post>("post_base→post_link", base),
    asParent: (content: Generic.Page2Content, base: BasePost): Generic.PostParent => {
        const id_loader = Generic.p2.fillLinkOnce(content, (
            autoLinkgen<Generic.Opaque<"loader">>("post_base→as_parent_loader", base)
        ), () => {
            return opaque_loader.encode({
                kind: "view_post",
                base,
            });
        });
        const id_filled = base_post.postLink(base);
        return {
            loader: {
                kind: "vertical_loader",
                key: id_filled,
                request: id_loader,
                temp_parents: [
                    // acct
                    //     base_account.asParent(content, base.on_acct)
                    // client
                    base_client.post(content, {}),
                ],

                load_count: null, autoload: false, client_id,
            },
        };
    },
};

const base_comment = {
    postId: (base: BaseComment) => autoLinkgen<Generic.Post>("comment_base→post_id", base),
};
const full_comment = {
    fill: autoFill(
        (full: FullComment) => base_comment.postId(full.on_base),
        (content: Generic.Page2Content, full: FullComment): Generic.Post => {
            return {
                kind: "post",
                content: {
                    kind: "post",
                    title: null, // coposts have this but not comments
                    body: {
                        kind: "text",
                        content: full.data.comment.body,
                        markdown_format: "none",
                        client_id,
                    },
                    info: {
                        creation_date: new Date(full.data.comment.postedAtISO).getTime(),
                    },
                    author2: base_project.limitedIdCardLink({id: full.data.poster.projectId}),
                    collapsible: {default_collapsed: false},
                },
                internal_data: full,
                parent: base_post.asParent(content, full.on_base.on_post),
                replies: null, // TODO
                url: null, // TODO :: so we have a problem:
                // - to make the url, we need:
                // - the parent post's 'filename'
                // - the parent poster's 'handle' or whatever
                // - but we get both of these through links
                // - there is no way using the current setup to compute that
                // * unless we assume that a full comment will always
                //    contain these in the same query
                // * but it doesn't because /api/comments or whatever
                //    returns only the comments without this info
                // - somehow, we need the client to compute  the url for us
                client_id,
            };
        },
    ),
};

const base_project = {
    limitedIdCardLink: (base: BaseProject) => autoLinkgen<Generic.LimitedIdentityCard>("project_base→limited_id_card", base),
};
const full_project = {
    limitedIdCard: autoFill(
        (full: FullProject) => base_project.limitedIdCardLink(full.on_base),
        (content: Generic.Page2Content, full: FullProject): Generic.LimitedIdentityCard => {
            return {
                name_raw: "@"+full.data.handle,
                pfp: {
                    url: full.data.avatarURL,
                },
                url: "raw!https://cohost.org/" + full.data.handle,
                client_id,
                raw_value: full,
            };
        },
    ),
    fill: (content: Generic.Page2Content, project: FullProject) => {
        full_project.limitedIdCard(content, project);
    },
};

type LoaderData = {
    kind: "todo",
} | {
    kind: "notifications",
    base: BaseNotificationsPage,
} | {
    kind: "view_post",
    base: BasePost,
};
const opaque_loader = encoderGenerator<LoaderData, "loader">("loader");

export async function loadPage2v2(
    lreq: Generic.Opaque<"loader">,
): Promise<Generic.LoaderResult> {
    const content: Generic.Page2Content = {};
    const data = opaque_loader.decode(lreq);
    if (data.kind === "notifications") {
        const notify_data = await fetch("/sample_data/ch_notifications.json").then(r => r.json()) as Cohost.ApiResponseNotifications;


        for(const project of Object.values(notify_data.projects)) {
            full_project.fill(content, {
                on_base: {id: project.projectId},
                data: project,
            });
        }
        for(const comment of Object.values(notify_data.comments)) {
            full_comment.fill(content, {
                on_base: {
                    uuid: comment.comment.commentId,
                    on_post: {
                        id: comment.comment.postId,
                    },
                },
                data: comment,
            });
        }

        full_notifications_page.fillReplies(content, {
            on_base: data.base,
            data: notify_data.notifications,
        });
    }else if(data.kind === "todo") {
        throw new Error("TODO");
    }else throw new Error("TODO unsupported loader kind");

    return {content};
}