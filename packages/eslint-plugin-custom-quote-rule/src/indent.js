/**
 * @fileoverview Rule to enforce a particular function style
 * @author Nicholas C. Zakas
 */
"use strict";

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

const unsupported_nodes = new Set([
    "MemberExpression", // something\n\t.somethingElse()
    "TSTypeAnnotation", // function demo(arg: {\n\ta: "b"\n})
    "Property", // same as above
    "VariableDeclarator", // caught by variable declaration
    "JSXText", // includes newlines
    "TemplateLiteral", // same as above
    "TemplateElement", // same as above

    // it would be nice to support these but I'm not sure how
    "LogicalExpression",
    "BinaryExpression",
]);

module.exports = {
    meta: {
        type: "suggestion",

        docs: {
            description: "enforce indent style",
            category: "Stylistic Issues",
            recommended: false,
        },

        schema: [],

        messages: {
            indent: "Bad indentation. Start was {{expected}}, but end was {{got}}. On {{node_kind}}",
            conditional: "Bad conditional formatting. {{lhs}} should end on the same line as {{rhs}} starts.",
        }
    },

    create(context) {
        const source_code = context.getSourceCode();
        const token_info = new TokenInfo(source_code);
        let reported_lines = new Set();
        const nodesToCheck = {
            Program() {
                reported_lines = new Set();
            },
            '*'(node) {
                if(unsupported_nodes.has(node.type)) return;

                if(node.type === "TSConditionalType" || node.type === "ConditionalExpression") {
                    // these are [!]DISABLED because neither typescript nor normal
                    // js report parenthesis expressions anymore when they have no
                    // semantic meaning. but I need to know about parenthesis expressions
                    // to properly lint the code
                    //
                    // I'm going to have to make my own indent rule that doesn't use
                    // babel parsing aren't I
                    //
                    // I guess for now I can workaround by looking between the test
                    // and the consequent and getting the last token or something?
                    //
                    // I really don't like this
                    if(node.type === "ConditionalExpression") return;
                    if(node.type === "TSConditionalType") return;

                    const items = node.type === "TSConditionalType" ? [
                        {node: node.checkType, name: "condition"},
                        {node: node.extendsType, name: "extends"},
                        {node: node.trueType, name: "when true"},
                        {node: node.falseType, name: "when false"},
                    ] : [
                        {node: node.test, name: "condition"},
                        {node: node.consequent, name: "when true"},
                        {node: node.alternate, name: "when false"},
                    ];
                    for(let i = 0; i < items.length - 1; i++) {
                        const [left, right] = [items[i], items[i + 1]];
                        const [start, end] = [left.node.loc.end, right.node.loc.start];
                        const [sl, el] = [start, end].map(loc => token_info.getFirstTokenOfLine(loc.line));
                        if(start.line !== end.line) {
                            context.report({
                                node: right.node,
                                messageId: "conditional",
                                data: {
                                    lhs: left.name,
                                    rhs: right.name,
                                },
                            });
                            return;
                        }else if(sl.loc.start !== el.loc.start) {
                            context.report({
                                node: right.node,
                                messageId: "indent",
                                data: {
                                    expected: sl.loc.start.column,
                                    got: el.loc.start.column,
                                    node_kind: node.type,
                                },
                            });
                            return;
                        }
                    }
                }

                let first_loc = node.type === "CallExpression" ? (
                    source_code.getTokenAfter(node.callee)?.loc.start
                ) : (
                    node.loc.start
                );
                let last_loc = node.type === "Identifier" ? (
                    first_loc // identifiers can have type labels on them. this might not be necessary to do though.
                ) : (
                    node.loc.end
                );

                if(!first_loc || !last_loc) return;

                if(node.type === "TSIntersectionType") {
                    const token = source_code.getFirstToken(node);
                    if(token.type === "Punctuator" && token.value === "&") {
                        first_loc = source_code.getFirstToken(node.types[0]).loc.start;
                    }
                }

                const start_line = token_info.getFirstTokenOfLine(first_loc.line);
                const end_line = token_info.getFirstTokenOfLine(last_loc.line);

                if(!start_line || !end_line) {
                    // console.log("no token at line", first_loc, start_line, last_loc, end_line);
                    return;
                }
                if(start_line.type === "Template" || end_line.type === "Template") {
                    return;
                }

                // console.log(start_line, end_line);

                const start = start_line.loc.start;
                const end = end_line.loc.start;

                if(start.column !== end.column) {
                    if(reported_lines.has(start.line) || reported_lines.has(end.line)) {
                        return; // no double reporting
                    }
                    reported_lines.add(start.line);
                    reported_lines.add(end.line);

                    // console.log("Error on node ", node, start_line, end_line);

                    context.report({
                        node: node,
                        messageId: "indent",
                        data: {
                            expected: start.column,
                            got: end.column,
                            node_kind: node.type,
                        },
                    });
                }

            },
        };

        return nodesToCheck;

    }
};
/**
 * A helper class to get token-based info related to indentation
 */
class TokenInfo {
    /**
     * @param {SourceCode} sourceCode A SourceCode object
     */
    constructor(sourceCode) {
        this.sourceCode = sourceCode;
        this.firstTokensByLineNumber = sourceCode.tokensAndComments.reduce((map, token) => {
            if (!map.has(token.loc.start.line)) {
                map.set(token.loc.start.line, token);
            }
            if (!map.has(token.loc.end.line)
                && sourceCode.text.slice(token.range[1] - token.loc.end.column, token.range[1]).trim()
            ) {
                map.set(token.loc.end.line, token);
            }
            return map;
        }, new Map());
    }

    /**
     * Gets the first token on a given token's line
     * @param {Token|ASTNode} token a node or token
     * @returns {Token} The first token on the given line
     */
    getFirstTokenOfLine(line) {
        return this.firstTokensByLineNumber.get(line);
    }

    /**
     * Get the actual indent of a token
     * @param {Token} token Token to examine. This should be the first token on its line.
     * @returns {string} The indentation characters that precede the token
     */
    getTokenIndent(token) {
        return this.sourceCode.text.slice(token.range[0] - token.loc.start.column, token.range[0]);
    }
}