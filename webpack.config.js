const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
    entry: './src/app.ts',
    module: {
        rules: [{
            test: /\.tsx?$/,
            exclude: /node_modules/,
            use: {loader: "babel-loader", options: {
                "presets": [
                    "@babel/preset-typescript",
                    ["@babel/preset-env", {
                        "targets": {"browsers": ">10%"},
                        "modules": false,
                    }],
                ],
                "plugins": [
                    ["@babel/plugin-proposal-pipeline-operator", {
                        "proposal": "smart",
                    }],
                ],
            }},
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
    devServer: {
        contentBase: path.join(__dirname, "dist"),
        compress: true,
        port: 3004,
        historyApiFallback: true,
        hot: true,
    },
};
