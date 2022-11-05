
// new Date(iso).getTime() → ms time
export type ISO = string & {__is_date: true};

export type Comment = {
    canEdit: "not-allowed", // in notifications, canEdit and canInteract are always "not-allowed"
    canInteract: "not-allowed",
    comment: {
        body: string,
        children: never[], // in notifications, comments have no children
        commentId: string, // comment uuid
        deleted: boolean,
        postId: number,
        postedAtISO: ISO,
        inReplyTo: null | string, // uuid of comment this is a reply to
        hasCohostPlus: boolean,
    },
    poster: {projectId: number},
};

export type PostBlock = {
    type: "markdown",
    markdown: {
        content: string,
    },
} | {
    type: "attachment",
    attachment: {
        fileURL: string,
        previewURL: string,
        attachmentId: string, // uuid
        altText: string,
    },
} | {
    type: "unsupported",
};

export type Post = {
    postId: number,
    headline: string, // post title
    publishedAt: ISO, 
    filename: string, // required for a post url. eg /Author/post/{filename: {id}-{short_text}}
    transparentShareOfPostId: null | number,
    state: number, // not sure
    numComments: number,
    numSharedComments: number,
    cws: never[], // content warnings. I don't have any examples in my current dataset, it's likely string[]
    tags: string[],
    blocks: PostBlock[], // this is the only place media is put, so probably use this and make an array body.
    plainTextBody: string, // markdown, not plaintext.
    postingProject: Project,
    shareTree: Post[], // note: subposts have their shareTree empty
    relatedProjects: Project[],
    singlePostPageUrl: string, // permalink. we'll construct this ourselves from the author & filename
    effectiveAdultContent: boolean, // not sure? this is true on one post in my data and it's not marked with a content warning
    isEditor: boolean,
    contributorBlockIncomingOrOutgoing: boolean,
    hasAnyContributorMuted: boolean,
    postEditUrl: string, // link to edit page for post. we'll construct this ourselves from the author & filename
    isLiked: boolean,
    canShare: boolean,
    canPublish: boolean, // this is set to true on a post that isn't mine and isn't a draft?
    hasCohostPlus: boolean,
    pinned: boolean,
    commentsLocked: boolean,

    // it feels like there's a lot of duplicated data in here that could be linked to instead.
    // - eg why is sharetree a post[], can't it be a number[]?
    // - why is postingProject a Project, can't it be a number?
    // - and then I'm not sure what blocks is for but it duplicates data in plainTextBody.
    //   reddit does the same thing with ?rtj=always so idk.
};

export type Project = {
    handle: string,
    displayName: string,
    dek: string, // unsure? it's empty
    description: string, // markdown
    avatarURL: string,
    avatarPreviewURL: string,
    headerURL: string,
    headerPreviewURL: string,
    projectId: number,
    pronouns: string,
    url: null,
    flags: ProjectFlag[],
    avatarShape: AvatarShape, // note that threadclient does not respect avatar shapes
};

export type ProjectFlag = (
    | "friendOfTheSite"
    | "staffMember"
    | "unsupported"
);
export type AvatarShape = (
    | "squircle"
    | "unsupported"
);


export type Notification = {
    type: "like",
    createdAt: ISO,
    fromProjectId: number,
    toPostId: number,
    relationshipId: number, // not sure what this is
} | {
    type: "share",
    createdAt: ISO,
    fromProjectId: number,
    toPostId: number,
    sharePostId: number,
    transparentShare: boolean,
} | {
    type: "follow",
    createdAt: ISO,
    fromProjectId: number,
} | {
    type: "comment",
    createdAt: ISO,
    fromProjectId: number,
    toPostId: number,
    commentId: string,
    inReplyTo: null | string,
} | {
    type: "unsupported",
    createdAt: ISO,
};

export type ApiComments = {
    [key: string]: Comment,
};
export type ApiPosts = {
    [key: string]: Post,
};
export type ApiProjects = {
    [key: string]: Project,
};
export type ApiResponseNotifications = {
    comments: ApiComments,
    posts: ApiPosts,
    projects: ApiProjects,
    notifications: Notification[],
};