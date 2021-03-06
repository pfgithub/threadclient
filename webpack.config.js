const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const WorkboxPlugin = require("workbox-webpack-plugin");
const webpack = require("webpack");
const VirtualModulesPlugin = require("webpack-virtual-modules");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const dev = process.env.NODE_ENV === "development";

module.exports = {
    entry: {
        bundle: "./src/entry.ts",
    },
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "[name].[contenthash].js",
        publicPath: "/",
    },
    mode: dev ? "development" : "production",
    ...(dev ? {devtool: "eval-cheap-module-source-map"} : {}),
    module: {
        rules: [{
            test: /_solid\.tsx$/,
            exclude: /node_modules/,
            use: {loader: "babel-loader", options: require("./config/babel-config-solid.js")},
        }, {
            test: /\.tsx?$/,
            exclude: /node_modules|_solid\.tsx$/,
            use: {loader: "babel-loader", options: require("./config/babel-config.js")},
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
        new webpack.ProgressPlugin(),
        new webpack.DefinePlugin({
            'fakevar.build': JSON.stringify(dev ? "development" : "production"),
            'fakevar.b_time': JSON.stringify(Date.now()),
        }),
        new CopyPlugin({
            patterns: [
                {from: "static", to: ""},
            ],
        }),
        new HtmlWebpackPlugin({
            template: "src/index.html",
            filename: "index.html",
        }),
        new HtmlWebpackPlugin({
            template: "src/index.html",
            filename: "404.html",
        }),
        new VirtualModulesPlugin({
            'node_modules/_variables.js': "module.exports = "+JSON.stringify(require("./src/_variables.js")),
        }),
        ...(dev ? [] : [new WorkboxPlugin.GenerateSW({
            // clientsClaim: true,
            // skipWaiting: true,
            navigateFallback: "/index.html",
            // runtimeCaching: [{
            //     handler: "CacheFirst",
            //     urlPattern: /^.*$/,
            //     options: {
            //         broadcastUpdate: {
            //             channelName: "update-available",
            //         },
            //     },
            // }],
        })]),
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
