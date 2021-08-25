/**
 * @fileoverview Rule to enforce a particular function style
 * @author Nicholas C. Zakas
 */
"use strict";

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

module.exports = {
    meta: {
        type: "suggestion",

        docs: {
            description: "enforce the consistent use of either `function` declarations or expressions",
            category: "Stylistic Issues",
            recommended: false,
        },

        schema: [],

        messages: {
            declaration: "Expected a function declaration.",
        }
    },

    create(context) {
        const handleFunctionExpression = (node) => {
            if(node.body.type !== "BlockStatement") return;
            const parent = node.parent;

            if (parent.type === "VariableDeclarator" && parent.parent.type === "VariableDeclaration") {
                const v = parent.parent.parent;
                if(v.type === "Program" || (v.type === "ExportNamedDeclaration" && v.parent.type === "Program")) {
                    context.report({
                        node: node.parent.id,
                        messageId: "declaration",
                    });
                }
            }
        };
        const nodesToCheck = {
            'ArrowFunctionExpression': handleFunctionExpression,
            'FunctionExpression': handleFunctionExpression,
        };

        return nodesToCheck;

    }
};