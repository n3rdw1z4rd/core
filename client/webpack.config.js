const { resolve } = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const DEV = (process.env.NODE_ENV?.toLowerCase() !== 'production');
const ENV = DEV ? 'development' : 'production';

const DEVTOOL = DEV ? 'source-map' : undefined;
const ENTRY = resolve('src/index.tsx');

const OUT_PATH = resolve('dist');
const OUT_FILENAME = 'bundle.js';

const DEV_HOST = '0.0.0.0';
const DEV_PORT = 3000;
const DEV_STATIC_PATH = resolve('public');

console.log(`*** ${ENV.toUpperCase()} ***\n`);

module.exports = {
    mode: ENV,
    devtool: DEVTOOL,
    entry: ENTRY,
    output: {
        path: OUT_PATH,
        filename: OUT_FILENAME,
        clean: true,
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js', '.css'],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                exclude: /node_modules/,
                use: 'ts-loader',
            },
            {
                test: /\.css$/,
                exclude: /node_modules/,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin(),
    ],
    devServer: {
        host: DEV_HOST,
        port: DEV_PORT,
        static: DEV_STATIC_PATH,
        hot: true,
        devMiddleware: {
            publicPath: '/',
        }
    },
};