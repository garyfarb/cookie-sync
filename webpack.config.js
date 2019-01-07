const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = [
  create('./src/popup.tsx'),
  create('./src/options.tsx'),
  create('./src/background.ts'),
];

function create(file) {
  const parsed = path.parse(file);
  const name = parsed.name;
  const ext = parsed.ext;
  const plugins = [];
  if (ext === '.tsx') {
    plugins.push(new HtmlWebpackPlugin({
      filename: `${name}.html`,
      inject: false,
      template: require('html-webpack-template'),
      appMountId: 'root',
      title: 'SyncMyCookie'
    }));
  }
  return {
    mode: 'production',
    entry: ['@babel/polyfill', file],
    output: {
      filename: `${name}.js`,
      path: path.resolve(__dirname, './build'),
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx']
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: [
            'babel-loader',
            'awesome-typescript-loader'
          ]
        },
        {
          test: /.css$/,
          use: [
            { loader: 'style-loader' },
            {
              loader: 'css-loader',
              options: {
                modules: true,
                importLoaders: 1,
                localIdentName: '[name]__[local]__[hash:base64:5]',
              },
            },
            {
              loader: 'postcss-loader',
              options: {
                ident: 'postcss',
                plugins: () => [
                  require('postcss-flexbugs-fixes'),
                  require('postcss-preset-env')({
                    autoprefixer: {
                      flexbox: 'no-2009',
                    },
                    stage: 3,
                  }),
                ],
              },
            }
          ],
        },
      ],
    },
    plugins,
  };
};