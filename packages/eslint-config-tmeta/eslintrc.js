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
        "@typescript-eslint/no-explicit-any": "off",

        // stricter linting rules:
        "@typescript-eslint/no-shadow": ["warn", {allow: ["urlr"]}],
        "eqeqeq": ["warn", "always", {null: "never"}],
        "custom-quote-rule/explicit-optional-key": ["warn"],

        // style rules:
        // "indent": ["warn", 4, {'SwitchCase': 1, 'offsetTernaryExpressions': true, 'ignoredNodes': ["ConditionalExpression"]}],
        "@typescript-eslint/brace-style": ["warn", "1tbs", {allowSingleLine: true}],
        "@typescript-eslint/semi": ["warn", "always", {omitLastInOneLineBlock: true}],
        "@typescript-eslint/member-delimiter-style": [1, {
            multiline: {delimiter: "comma", requireLast: true},
            singleline: {delimiter: "comma", requireLast: false},
            overrides: {
                interface: {
                    multiline: {delimiter: "semi", requireLast: true},
                    singleline: {delimiter: "semi", requireLast: false}
                },
            },
            multilineDetection: "last-member",
        }],
        "custom-quote-rule/func-style": "warn",
        "max-len": ["warn", 120, {
            ignoreComments: true,
            ignoreUrls: true,
            ignoreStrings: true,
            ignoreTemplateLiterals: true,
            ignoreRegExpLiterals: true,
        }],
        "custom-quote-rule/indent": "warn",
        "one-var": ["warn", "never"],

        // project-specific rules:
        "no-restricted-imports": ["warn", {
            paths: [{
                name: "solid-js",
                importNames: ["Show"],
                message: "Please use `Show` from `tmeta-util-solid` instead.",
            }],
        }],
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
            // this is required in order to support editor extensions for eslint
            project: global.branch_dirname + "/tsconfig.json",
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