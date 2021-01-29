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
    extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "plugin:custom-quote-rule/recommended"],
    rules: {
        // losening default rules
        "no-undef": "off",
        "@typescript-eslint/ban-ts-ignore": "off",
        "@typescript-eslint/ban-ts-comment": "off",
        "@typescript-eslint/no-unused-vars": ["warn", {args: "none"}],
        "@typescript-eslint/no-namespace": ["error", {allowDeclarations: true}],
        "@typescript-eslint/no-non-null-assertion": "off",

        // stricter linting rules:
        "@typescript-eslint/no-shadow": "warn",
        "eqeqeq": ["warn", "always", {null: "never"}],

        // style rules:
        "indent": ["warn", 4, {'SwitchCase': 1, 'offsetTernaryExpressions': true, 'ignoredNodes': ["ConditionalExpression"]}],
        "@typescript-eslint/brace-style": ["warn", "1tbs", {allowSingleLine: true}],
        "@typescript-eslint/semi": ["warn", "always", {omitLastInOneLineBlock: true}],
        "no-else-return": 1,
        "@typescript-eslint/member-delimiter-style": [1, {
            multiline: {delimiter: "comma", requireLast: true},
            singleline: {delimiter: "comma", requireLast: false},
            overrides: {
                interface: {multiline: {delimiter: "semi", requireLast: true}, singleline: {delimiter: "semi", requireLast: false}}
            },
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
            project: "./tsconfig.json",
        },
        rules: {
            // style rules:
            "@typescript-eslint/naming-convention": ["warn",
                {selector: ["variable", "function", "parameter"], format: ["snake_case"]},
                {selector: ["variable", "function", "parameter"], format: ["snake_case"], prefix: ["__"], filter: {regex: "^__", match: true}},
                {selector: ["variable", "function", "parameter"], types: ["function"], format: ["camelCase"]},
                {selector: ["variable", "function", "parameter"], types: ["function"], format: ["camelCase"], prefix: ["__"], filter: {regex: "^__", match: true}},
                {selector: "typeLike", format: ["PascalCase"]},
            ],
            "@typescript-eslint/strict-boolean-expressions": "warn",
        }
    }],
};