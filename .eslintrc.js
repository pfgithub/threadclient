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
    parserOptions: {
        ecmaVersion: 6,
        sourceType: "module",
        ecmaFeatures: {jsx: true},
    },
    plugins: ["custom-quote-rule"],
    extends: ["eslint:recommended", "plugin:custom-quote-rule/recommended"],
    rules: {
        // losening default rules
        "no-undef": "off",

        // style rules:
        "indent": ["warn", 4, {'SwitchCase': 1, "offsetTernaryExpressions": true, "ignoredNodes": ["ConditionalExpression"]}],
        "brace-style": ["warn", "1tbs", {"allowSingleLine": true}],
        "semi": ["warn", "always", {"omitLastInOneLineBlock": true}],
        "no-else-return": 1,
    },
    "overrides": [{
        "files": ["*.ts", "*.tsx"],
        "parserOptions": {
            "project": "./tsconfig.json",
        },
        plugins: ["@typescript-eslint"],
        parser: "@typescript-eslint/parser",
        extends: ["plugin:@typescript-eslint/recommended"],
        "rules": {
            // loosening default rules:
            "@typescript-eslint/ban-ts-ignore": "off",
            "@typescript-eslint/ban-ts-comment": "off",
            "@typescript-eslint/no-unused-vars": ["warn", {"args": "none"}],
            "@typescript-eslint/no-namespace": ["error", {"allowDeclarations": true}],

            // stricter linting rules:
            "@typescript-eslint/no-shadow": "warn",

            // style rules:
            "@typescript-eslint/naming-convention": ["warn",
                {selector: ["variable", "function", "parameter"], format: ["snake_case"]},
                {selector: ["variable", "function", "parameter"], format: ["snake_case"], prefix: ["__"], filter: {regex: "^__", match: true}},
                {selector: ["variable", "function", "parameter"], types: ["function"], format: ["camelCase"]},
                {selector: ["variable", "function", "parameter"], types: ["function"], format: ["camelCase"], prefix: ["__"], filter: {regex: "^__", match: true}},
                {selector: "typeLike", format: ["PascalCase"]},
            ],
        }
    }],
};