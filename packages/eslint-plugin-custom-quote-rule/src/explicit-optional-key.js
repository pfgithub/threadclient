/**
 * @fileoverview Rule to enforce a particular function style
 * @author Nicholas C. Zakas
 */
"use strict";

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

function isUndefinedOrNever(type) {
    if(type.type === "TSUndefinedKeyword") return true;
    if(type.type === "TSNeverKeyword") return true;
    return false;
}

module.exports = {
    meta: {
        type: "suggestion",

        docs: {
            description: "enforce explicit optional key",
            category: "Stylistic Issues",
            recommended: false,
        },

        schema: [],

        messages: {
            req_explicit: "The type must contain either `undefined | ` or `never | `",
        }
    },

    create(context) {
        const nodesToCheck = {
            TSPropertySignature(node) {
                if(!node.optional) return;
                if(node.typeAnnotation.type !== "TSTypeAnnotation") {
                    return; // ?
                }
                const union = node.typeAnnotation.typeAnnotation;
                if(union.type !== "TSUnionType") {
                    if(isUndefinedOrNever(union)) return; // OK.
                    context.report({
                        node: node.key,
                        messageId: "req_explicit",
                    });
                    return;
                }
                if(!union.types.some(isUndefinedOrNever)) {
                    context.report({
                        node: node.key,
                        messageId: "req_explicit",
                    });
                    return;
                }
                // OK.
                return;
            },
        };

        return nodesToCheck;

    }
};
