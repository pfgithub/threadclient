function convert(str, new_quote) {
    const old_quote = str[0];

    if (new_quote === old_quote) {
        return str;
    }
    return new_quote + str.slice(1, -1).replace(/\\(\$\{|\r\n?|\n|.)|["'`]|\$\{|(\r\n?|\n)/gu, (
        match,
        escaped,
        newline,
    ) => {
        if (escaped === old_quote || old_quote === "`" && escaped === "${") {
            return escaped; // unescape
        }
        if (match === new_quote || new_quote === "`" && match === "${") {
            return `\\${match}`; // escape
        }
        if (newline && old_quote === "`") {
            return "\\n"; // escape newlines
        }
        return match;
    }) + new_quote;
}

function quoteFixer(node, new_quote) {
    return (fixer) => {
        return [
            fixer.replaceText(node, convert(node.raw, new_quote)),
        ];
    };
}

function propNameRequiresQuotes(prop_name) {
    if(prop_name.match(/^[a-z_][a-zA-Z0-9_]*$/)) return false;
    return true;
}

function default_rule(context) {
    return {
        Literal(node) {
            if(!node.raw.startsWith("'") && !node.raw.startsWith('"')) return; // not a string
            let expected_quote_type = '"';
            if(node.parent.type === "BinaryExpression") {
                if(node.parent.operator === "in" && node === node.parent.left) {
                    expected_quote_type = "'"; 
                }
            }
            if(node.parent.type === "Property") {
                if(node === node.parent.key) {
                    expected_quote_type = "'";
                    if(!node.value.match(/^[A-Z]/)) return; // either is fine if it doesn't start with a caps letter
                }
            }
            let other_quote_type = expected_quote_type === "'" ? '"' : "'";
            let quotkind = expected_quote_type === "'" ? "single quotes" : "double quotes";
            if(node.raw.startsWith(other_quote_type)) {
                const substr = node.raw.substring(1, node.raw.length - 1);
                if(substr.includes(expected_quote_type) && !substr.includes("other_quote_type")) return;
                context.report({
                    node,
                    message: "Prefer "+quotkind,
                    fix: quoteFixer(node, expected_quote_type),
                });
            }
        },
        ObjectExpression(node) {
            const anyRequireQuotes = node.properties.some(prop => {
                if(prop.type !== "Property") return false;
                if(prop.computed) return false; // ignored
                if(prop.method) return false; // ignored
                if(prop.shorthand) return false; // ignored
                const key = prop.key;
                if(key.type === "Identifier") return propNameRequiresQuotes(key.name);
                if(key.type === "Literal" && typeof key.value === "string") return propNameRequiresQuotes(key.value);
                // key.raw.substring(1, node.raw.length - 1)? otherwise "\x68": a → h: a
                return false;
            });
            for(const prop of node.properties) {
                if(prop.type !== "Property") continue;
                if(prop.computed) continue;
                if(prop.method) continue;
                if(prop.shorthand) continue;
                const key = prop.key;
                if(!anyRequireQuotes && key.type === "Literal" && typeof key.value === "string") {
                    if(key.raw.startsWith("'")) return; // OK
                    context.report({
                        node: key,
                        message: "Quotes not required",
                        fix: (fixer) => [fixer.replaceText(key, key.value)],
                    });
                }
                if(anyRequireQuotes && key.type === "Identifier") {
                    context.report({
                        node: key,
                        message: "Quotes required",
                        fix: (fixer) => [fixer.replaceText(key, "'" + key.name + "'")],
                    });
                }
            }
        },
    };
}

module.exports = {
    rules: {
        'quote-style': {create: default_rule},
        'member-delimiter-style': require("./member-delimiter-style").default,
        'func-style': require("./func-style"),
        'indent': require("./indent"),
    },
    configs: {
        recommended: {
            rules: {
                'custom-quote-rule/quote-style': "warn",
            },
        },
    },
};
module.exports.create = default_rule; // for astexplorer