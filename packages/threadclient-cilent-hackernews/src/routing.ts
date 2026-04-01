import * as util from "tmeta-util";
import { assertNever, encodeQuery } from "tmeta-util";
import { ListingType } from "./api_types";

export type ParsedPath = (
    | {kind: "link_out", out: string}
    | {kind: "item", id: number}
    | {kind: "user", id: string}
    | {kind: "listing", listing: ListingType}
);

export const path_router = util.router<ParsedPath>();

export const linkout = (opts: util.BaseParentOpts): ParsedPath => ({
    kind: "link_out",
    out: opts.path+"?"+encodeQuery(opts.query),
});

path_router.route([] as const, (): ParsedPath => ({kind: "listing", listing: "topstories"}));
path_router.route(["newest"] as const, (): ParsedPath => ({kind: "listing", listing: "newstories"}));
path_router.route(["front"] as const, linkout); // ?day=2026-02-28
path_router.route(["comments"] as const, linkout);
path_router.route(["ask"] as const, (): ParsedPath => ({kind: "listing", listing: "askstories"}));
path_router.route(["show"] as const, (): ParsedPath => ({kind: "listing", listing: "showstories"}));
path_router.route(["jobs"] as const, (): ParsedPath => ({kind: "listing", listing: "jobstories"}));
path_router.route(["submit"] as const, linkout);
path_router.route(["newpoll"] as const, linkout);
path_router.route(["best"] as const, (): ParsedPath => ({kind: "listing", listing: "beststories"})); // note that the ?h=... parameter is not supported. it defaults to 48 hours.
path_router.route(["item"] as const, (a): ParsedPath => ({kind: "item", id: +(a.query["id"] ?? "")}));
path_router.route(["user"] as const, (a): ParsedPath => ({kind: "user", id: (a.query["id"] ?? "")}));
path_router.route(["submitted"] as const, (a): ParsedPath => ({kind: "user", id: (a.query["id"] ?? "")}));
path_router.route(["threads"] as const, linkout);
path_router.route(["favorites"] as const, linkout);
