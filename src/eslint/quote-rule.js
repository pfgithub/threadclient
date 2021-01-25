const convert = (str, new_quote) => {
    const old_quote = str[0];

    if (new_quote === old_quote) {
        return str;
    }
    return new_quote + str.slice(1, -1).replace(/\\(\$\{|\r\n?|\n|.)|["'`]|\$\{|(\r\n?|\n)/gu, (match, escaped, newline) => {
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
};

const quoteFixer = (node, new_quote) => {
    return (fixer) => {
        return [
            fixer.replaceText(node, convert(node.raw, new_quote)),
        ];
    };
};

const default_rule = function(context) {
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
    };
};

module.exports = {
    rules: {
        'quote-style': {create: default_rule},
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