
import type { Manifest, Permissions } from "webextension-polyfill";

function addPermissions(client: string, perms: Permissions.Permissions) {
    per_client_permissions.set(client, perms);
    for (const perm of perms?.origins ?? []) all_optional_origins.add(perm);
    for (const perm of perms?.permissions ?? []) all_optional_permissions.add(perm);
}

export const per_client_permissions = new Map<string, Permissions.Permissions>();
export const all_optional_permissions: Set<Manifest.OptionalPermission> = new Set();
export const all_optional_origins: Set<string> = new Set();
addPermissions("reddit", {origins: ["*://*.reddit.com/*"]});
addPermissions("hackernews", {origins: ["*://news.ycombinator.com/*"]});