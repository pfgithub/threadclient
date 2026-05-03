import { ProtocolWithReturn } from "webext-bridge";

declare module "webext-bridge" {
    export interface ProtocolMap {
        // define message protocol types
        // see https://github.com/antfu/webext-bridge#type-safe-protocols
        // 'tab-prev': { title: string | undefined }
        // 'get-current-tab': ProtocolWithReturn<{ tabId: number }, { title?: string }>
        "get-settings": ProtocolWithReturn<{_?: never}, ExtensionSettings>;
        "reset-settings": ProtocolWithReturn<{_?: never}, ExtensionSettings>;
        "set-feature": ProtocolWithReturn<{name: string, value: boolean}, ExtensionSettings>,
        "open-settings": ProtocolWithReturn<{_?: never}, void>,
    }
}

export type ExtensionSettings = {
    features: Set<string>,
    permissions: Set<string>,
};