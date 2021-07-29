module.exports = {
    presets: [
        "@babel/preset-typescript",
        ["@babel/preset-env", {
            targets: {browsers: ">10%", node: "14"},
        }],
        "solid",
    ],
};