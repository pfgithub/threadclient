const Module = require("module");
Module._resolveFilename = (original => (...a) => {
    const [request] = a;
    if(request === "eslint-plugin-custom-quote-rule") {
        return require.resolve("./src/eslint/quote-rule.js");
    }
    return original(...a);
})(Module._resolveFilename);

module.exports = {
    root: true,
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint", "custom-quote-rule"],
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:custom-quote-rule/recommended",
    ],
    rules: {
        // losening default rules
        "no-undef": "off",
        "@typescript-eslint/ban-ts-ignore": "off",
        "@typescript-eslint/ban-ts-comment": "off",
        "@typescript-eslint/no-unused-vars": ["warn", {args: "none"}],
        "@typescript-eslint/no-namespace": ["error", {allowDeclarations: true}],
        "@typescript-eslint/no-non-null-assertion": "off",
        "no-constant-condition": ["warn", {checkLoops: false}],

        // stricter linting rules:
        "@typescript-eslint/no-shadow": ["warn", {allow: ["urlr"]}],
        "eqeqeq": ["warn", "always", {null: "never"}],

        // style rules:
        // "indent": ["warn", 4, {'SwitchCase': 1, 'offsetTernaryExpressions': true, 'ignoredNodes': ["ConditionalExpression"]}],
        "@typescript-eslint/brace-style": ["warn", "1tbs", {allowSingleLine: true}],
        "@typescript-eslint/semi": ["warn", "always", {omitLastInOneLineBlock: true}],
        "custom-quote-rule/member-delimiter-style": [1, {
            multiline: {delimiter: "comma", requireLast: true},
            singleline: {delimiter: "comma", requireLast: false},
            overrides: {
                interface: {
                    multiline: {delimiter: "semi", requireLast: true},
                    singleline: {delimiter: "semi", requireLast: false}
                },
            },
        }],
        "custom-quote-rule/func-style": "warn",
        "max-len": ["warn", 120, {ignoreComments: true}],
        "custom-quote-rule/indent": "warn",
        "one-var": ["warn", "never"],
    },
    overrides: [{
        files: ["*.js", "*.jsx"],
        rules: {
            "@typescript-eslint/no-var-requires": 0,
            "@typescript-eslint/naming-convention": 0,
        },
    }, {
        files: ["*.ts", "*.tsx"],
        parserOptions: {
            project: __dirname + "/tsconfig.json",
        },
        extends: [
            "plugin:@typescript-eslint/recommended-requiring-type-checking",
        ],
        rules: {
            // looser rules:
            "@typescript-eslint/restrict-plus-operands": 0, // "" + number is used frequently
            "@typescript-eslint/require-await": 0, // ?? do you want me to function() {return new Promise(r => r())}??
            "@typescript-eslint/prefer-regexp-exec": 0, // imo more confusing

            // stricter linting rules:
            "@typescript-eslint/no-floating-promises": "warn",
            "@typescript-eslint/strict-boolean-expressions": "warn",

            // style rules:
            "@typescript-eslint/naming-convention": ["warn",
                {
                    selector: ["variable", "function", "parameter"],
                    format: ["snake_case"]
                },
                {
                    selector: ["variable", "function", "parameter"],
                    format: ["snake_case"], prefix: ["__"], filter: {regex: "^__", match: true},
                },
                {
                    selector: ["variable", "function", "parameter"], types: ["function"],
                    format: ["camelCase", "PascalCase"],
                },
                {
                    selector: ["variable", "function", "parameter"], types: ["function"],
                    format: ["camelCase"], prefix: ["__"], filter: {regex: "^__", match: true},
                },
                {
                    selector: "typeLike",
                    format: ["PascalCase"]
                },
            ],
        }
    }],
};