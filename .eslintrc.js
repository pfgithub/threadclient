module.exports = {
    root: true,
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint"],
    extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
    rules: {
        // losening default rules
        "@typescript-eslint/ban-ts-ignore": "off",
        "@typescript-eslint/ban-ts-comment": "off",
        "no-undef": "off",
        "@typescript-eslint/no-unused-vars": ["warn", {"args": "none"}],
        "@typescript-eslint/no-namespace": ["error", {"allowDeclarations": true}],

        // stricter linting rules:
        "@typescript-eslint/no-shadow": "warn",

        // style rules:
        "indent": ["warn", 4, {"SwitchCase": 1, "offsetTernaryExpressions": true, "ignoredNodes": ["ConditionalExpression"]}],
        "brace-style": ["warn", "1tbs", {"allowSingleLine": true}],
        "semi": ["warn", "always", {"omitLastInOneLineBlock": true}],
        "no-else-return": 1,
    },
    "overrides": [{
        "files": ["*.ts", "*.tsx"],
        "parserOptions": {
            "project": "./tsconfig.json",
        },
        "rules": {
            "@typescript-eslint/naming-convention": ["warn",
                {selector: ["variable", "function", "parameter"], format: ["snake_case"]},
                {selector: ["variable", "function", "parameter"], format: ["snake_case"], prefix: ["__"], filter: {regex: '^__', match: true}},
                {selector: ["variable", "function", "parameter"], types: ["function"], format: ["camelCase"]},
                {selector: ["variable", "function", "parameter"], types: ["function"], format: ["camelCase"], prefix: ["__"], filter: {regex: "^__", match: true}},
                {selector: "typeLike", format: ["PascalCase"]},
            ],
        }
    }],
};