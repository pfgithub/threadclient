const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const WorkboxPlugin = require("workbox-webpack-plugin");
const webpack = require("webpack");
const VirtualModulesPlugin = require("webpack-virtual-modules");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const WindiCSS = require("windicss-webpack-plugin").default;

const dev = process.env.NODE_ENV === "development";

const variables = require("./src/_variables.js");

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
            ],
        }, {
            test: /\.s[ac]ss$/i,
            use: [
                "style-loader",
                {loader: "css-loader", options: {importLoaders: 1}},
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
            'fakevar.b_time': JSON.stringify(variables.build_time),
        }),
        new CopyPlugin({
            patterns: [
                {from: "static", to: ""},
                {
                    from: "package.json",
                    to: "special/update_info.json",
                    transform: {
                        transformer: () => {
                            return JSON.stringify(variables);
                        },
                    },
                }
            ],
        }),
        new WindiCSS(),
        new HtmlWebpackPlugin({
            template: "src/index.html",
            filename: "index.html",
        }),
        new HtmlWebpackPlugin({
            template: "src/index.html",
            filename: "404.html",
        }),
        new VirtualModulesPlugin({
            'node_modules/_variables.js': "module.exports = "+JSON.stringify(variables),
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
