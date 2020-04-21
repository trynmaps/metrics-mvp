import { TsconfigPathsPlugin } from "tsconfig-paths-webpack-plugin";

module.exports = {
  entry: './src/index.tsx',
  output: {
    filename: './build/bundle.js',
  },
  devtool: 'source-map',
  resolve: {
    extensions: ['', '.ts', '.tsx', '.js', '.jsx'],
    plugins: [new TsconfigPathsPlugin()]
  },
  module: {
    rules: [
      // All files with a '.ts' or '.tsx' extension will be handled by 'awesome-typescript-loader'.
      { test: /\.tsx?$/, loader: 'awesome-typescript-loader' },
      // All output '.jsx' or '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
      { test: /\.jsx?$/, loader: 'source-map-loader' },
    ],
  },
};
