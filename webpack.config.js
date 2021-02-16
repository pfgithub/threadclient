const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const WorkboxPlugin = require("workbox-webpack-plugin");
const webpack = require("webpack");

const dev = process.env.NODE_ENV === "development";

module.exports = {
    entry: "./src/entry.ts",
    mode: dev ? "development" : "production",
    ...(dev ? {devtool: "eval-cheap-module-source-map"} : {}),
    module: {
        rules: [{
            test: /\.tsx?$/,
            exclude: /node_modules/,
            use: {loader: "babel-loader", options: {
                presets: [
                    "@babel/preset-typescript",
                    ["@babel/preset-env", {
                        targets: {browsers: ">10%"},
                        modules: false,
                    }],
                    "@babel/preset-react",
                ],
                plugins: [
                    ["@babel/plugin-proposal-pipeline-operator", {
                        proposal: "smart",
                    }],
                ],
            }},
        }, {
            test: /\.(gif|svg|png)$/i,
            use: [
                "url-loader",
            ],
        }, {
            test: /\.css$/i,
            use: [
                "style-loader",
                {loader: "css-loader", options: {importLoaders: 1}},
                {loader: "postcss-loader"},
            ],
        }, {
            test: /\.s[ac]ss$/i,
            use: [
                "style-loader",
                {loader: "css-loader", options: {importLoaders: 1}},
                "postcss-loader",
                "sass-loader"
            ],
        }],
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
    },
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "bundle.js",
    },
    plugins: [
        new webpack.DefinePlugin({
            'fakevar.build': JSON.stringify(dev ? "development" : "production"),
        }),
        new CopyPlugin({
            patterns: [
                {from: "static", to: ""},
            ],
        }),
        ...(dev ? [] : [new WorkboxPlugin.GenerateSW({
            clientsClaim: true,
            skipWaiting: true,
        })]),
    ],
    devServer: {
        contentBase: path.join(__dirname, "dist"),
        compress: true,
        port: 3004,
        historyApiFallback: true,
        hot: true,
    },
};
