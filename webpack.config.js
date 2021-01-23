const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
    entry: './src/app.ts',
    module: {
        rules: [{
            test: /\.tsx?$/,
            use: "ts-loader",
            exclude: /node_modules/,
        }, {
            test: /\.s[ac]ss$/i,
            use: [
                "style-loader",
                "css-loader",
                "sass-loader"
            ],
        }],
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js'
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                {from: "static", to: ""},
            ],
        }),
    ],
};
