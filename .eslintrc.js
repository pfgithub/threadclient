module.exports = {
    root: true,
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint"],
    extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
    rules: {
        "@typescript-eslint/ban-ts-ignore": "off",
        "@typescript-eslint/ban-ts-comment": "off",
        "no-undef": "off",
        "@typescript-eslint/no-unused-vars": ["warn", {"args": "none"}],
        "@typescript-eslint/no-namespace": ["error", {"allowDeclarations": true}]
    },
};