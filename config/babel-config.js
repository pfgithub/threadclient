module.exports = {
    presets: [
        "@babel/preset-typescript",
        ["@babel/preset-env", {
            targets: {browsers: ">10%", node: "14"},
        }],
        ["@babel/preset-react", {
            runtime: "automatic",
        }],
    ],
    plugins: [
        ["@babel/plugin-proposal-pipeline-operator", {
            proposal: "smart",
        }],
    ],
};