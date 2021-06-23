const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const WorkboxPlugin = require("workbox-webpack-plugin");
const webpack = require("webpack");
const VirtualModulesPlugin = require("webpack-virtual-modules");

const dev = process.env.NODE_ENV === "development";

module.exports = {
    entry: {
        bundle: "./src/entry.ts",
        darkmode: "./src/darkmode.js",
    },
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "[name].js",
    },
    mode: dev ? "development" : "production",
    ...(dev ? {devtool: "eval-cheap-module-source-map"} : {}),
    module: {
        rules: [{
            test: /_solid\.tsx$/,
            exclude: /node_modules/,
            use: {loader: "babel-loader", options: {
                presets: [
                    "@babel/preset-typescript",
                    "solid",
                ],
            }},
        }, {
            test: /\.tsx?$/,
            exclude: /node_modules|_solid\.tsx$/,
            use: {loader: "babel-loader", options: {
                presets: [
                    "@babel/preset-typescript",
                    ["@babel/preset-env", {
                        targets: {browsers: ">10%"},
                        modules: false,
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
            }},
        }, {
            test: /\.(gif|svg|png)$/i,
            use: [
                "url-loader",
            ],
        }, {
            test: /\.p?css$/i,
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
            navigateFallback: "/index.html",
        })]),
        new VirtualModulesPlugin({
            'node_modules/_variables.js': require("./src/_variables.js"),
        }),
    ],
    devServer: {
        contentBase: path.join(__dirname, "dist"),
        compress: true,
        port: 3004,
        historyApiFallback: true,
        hot: true,
        disableHostCheck: true, // it's open source, who cares 
    },
};
