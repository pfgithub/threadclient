export const urls = {
    public: {
        dashboard: "/",
        welcome: "/rc/welcome",
        login: "/rc/login",
        logout: "/rc/logout",
        signup: "/rc/signup",
        createProject: "/rc/project/create",
        switchProject: "/rc/project/switch",
        settingsMain: "/rc/user/settings",
        verifyEmail: "/rc/verify_email",
        cancelVerifyEmail: "/rc/cancel_verify_email",
        resetPassword: "/rc/reset_password",
        staticContent: "/rc/content/:slug",
        search: "/rc/search",
        apiV1: {
            createProject: "/project",
            getProject: "/project/:projectHandle",
            updateProject: "/versions",
            changeProjectSettings: "/project/:projectHandle",
            getFollowingState: "/project/:projectHandle/following",
            getProjectPosts: "/project/:projectHandle/posts",
            createPost: "/project/:projectHandle/posts",
            updatePost: "/project/:projectHandle/posts/:postId",
            getPostsTagged: "/project/:projectHandle/tagged/:tagSlug",
            getPost: "/project_post/:postId",
            getCommentsForPost: "/project_post/:postId/comments",
            startAttachment: "/project/:projectHandle/posts/:postId/attach/start",
            finishAttachment: "/project/:projectHandle/posts/:postId/attach/finish/:attachmentId",
            redirectToAttachment: "/attachments/:attachmentId",
            changePostState: "/project/:projectHandle/posts/:postId/:operation",
            listEditedProjects: "/projects/edited",
            createComment: "/comments",
            editDeleteComment: "/comments/:commentId",
            loggedIn: "/logged-in",
            register: "/register",
            changePassword: "/change-password",
            requestPasswordReset: "/reset-password",
            login: "/login",
            userSettings: "/user/settings",
            checkUsername: "/register/check-username",
            checkEmail: "/register/check-email",
            projects: {
                followers: "/projects/followers",
                following: "/projects/following"
            },
            moderation: {
                changeSettings: "/moderation/settings",
                grantOrRevokePermission: "/moderation/permission"
            },
            notifications: {
                count: "/notifications/count",
                list: "/notifications/list"
            },
            reporting: {
                listReasons: "/reporting/reasons",
                reportPost: "/reporting/report-post"
            },
            tags: {
                queryTags: "/tags/query"
            },
            trpc: "/trpc"
        },
        unleashProxy: "/api/unleash-proxy",
        relationshipAction: "/:fromEntityType-:fromEntityId/to-:toEntityType-:toEntityId/:operation",
        tags: "/rc/tagged/:tagSlug",
        project: {
            home: "/",
            mainAppProfile: "/:projectHandle",
            profileEdit: "/rc/project/edit",
            followers: "/rc/project/followers",
            following: "/rc/project/following",
            notifications: "/rc/project/notifications",
            followRequests: "/:projectHandle/follow-requests",
            composePost: "/:projectHandle/post/compose",
            editPost: "/:projectHandle/post/:filename/edit",
            sharePost: "/:projectHandle/post/compose\\?shareOf=:postId",
            singlePost: {
                published: "/:projectHandle/post/:filename",
                unpublished: "/:projectHandle/post/:filename/:draftNonce"
            },
            unpublishedPosts: "/rc/posts/unpublished",
            tags: "/tagged/:tagSlug",
            rss: {
                public: "/rss/public"
            },
            defaultAvatar: "/rc/default-avatar/:projectId.png"
        },
        invites: {
            manage: "/rc/moderation/invites/manage",
            activate: "/rc/activate",
            create: "/rc/moderation/invites/create"
        },
        moderation: {
            home: "/rc/moderation",
            manageUser: "/rc/moderation/manage-user",
            managePage: "/rc/moderation/manage-project",
            managePost: "/rc/moderation/manage-post",
            maintenance: {
                notificationFeed: "/rc/moderation/maintenance/notifications"
            },
            bulkActivate: "/rc/moderation/bulk-activate"
        },
        subscriptions: {
            createCheckoutSession: "/rc/subscriptions/create-checkout-session",
            createPortalSession: "/rc/subscriptions/create-portal-session",
            success: "/rc/subscriptions/success",
            cancelled: "/rc/subscriptions/cancelled"
        }
    }
};