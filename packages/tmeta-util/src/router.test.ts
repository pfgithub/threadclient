import { router } from "./util";

const path_router = router<string>();

path_router.route([
    "comments",
    {partial_comment_id: "any"},
] as const, opts => opts.partial_comment_id);

console.log(path_router.parse("/comments/abcdef/?context=1"));