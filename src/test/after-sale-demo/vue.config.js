// vue.config.js
module.exports = {
    pages: {
      index: {
        entry: 'src/main.ts',
        template: 'public/index.html',
        filename: 'index.html'
      }
    },
    chainWebpack: config => {
      // 确保 .ts/.tsx 会被解析
      config.resolve.extensions
        .add('.ts')
        .add('.tsx')
        .add('.vue');
      
      // 配置TypeScript解析
      config.module
        .rule('typescript')
        .test(/\.tsx?$/)
        .use('ts-loader')
        .loader('ts-loader')
        .options({
          appendTsSuffixTo: [/\.vue$/],
          transpileOnly: true
        });
    },
    // 添加别名配置
    configureWebpack: {
      resolve: {
        alias: {
          '@': require('path').resolve(__dirname, 'src')
        }
      }
    }
  };
  