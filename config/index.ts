/**
 * Taro 构建配置（公共部分）
 *
 * - 源码 src/，产物目录由环境变量 TARO_OUTPUT_DIR 指定（小程序用 dist-weapp，H5 默认 dist）
 * - CSS Modules：*.module.scss 自动启用，类名格式 [name]__[local]___[hash:base64:5]
 * - '@/...' 路径别名在下方 webpackChain 中显式指向 src/
 */
import { defineConfig } from '@tarojs/cli'
import path from 'path'
import devConfig from './dev'
import prodConfig from './prod'

// '@/...' → src/...（tsconfig 的 baseUrl 为空，路径别名在此显式注入 webpack）
const setAlias = (chain: any) => {
  chain.resolve.alias.set('@', path.resolve(__dirname, '..', 'src'))
}

// https://docs.taro.zone/docs/next/config#defineconfig-辅助函数
export default defineConfig(async (merge) => {
  const baseConfig = {
    projectName: 'taro_template',
    date: '2026-9-1',
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2
    },
    sourceRoot: 'src',
    // 按构建类型自动隔离产物目录：小程序固定 dist-weapp，其余（H5）用 dist
    outputRoot: process.env.TARO_OUTPUT_DIR || (process.env.TARO_ENV === 'weapp' ? 'dist-weapp' : 'dist'),
    plugins: [],
    defineConstants: {},
    copy: {
      patterns: [],
      options: {}
    },
    framework: 'react',
    compiler: 'webpack5',
    cache: {
      enable: false
    },
    sass: {},
    mini: {
      webpackChain(chain: any) {
        setAlias(chain)
      },
      postcss: {
        pxtransform: {
          enable: true,
          config: {}
        },
        cssModules: {
          enable: true,
          config: {
            namingPattern: 'module',
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      }
    },
    h5: {
      webpackChain(chain: any) {
        setAlias(chain)
      },
      publicPath: '/',
      staticDirectory: 'static',
      output: {
        filename: 'js/[name].[hash:8].js',
        chunkFilename: 'js/[name].[hash:8].js'
      },
      miniCssExtractPluginOption: {
        ignoreOrder: true,
        filename: 'css/[name].[hash].css',
        chunkFilename: 'css/[name].[hash].css'
      },
      postcss: {
        pxtransform: {
          enable: true,
          config: {}
        },
        cssModules: {
          enable: true,
          config: {
            namingPattern: 'module',
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      }
    }
  }

  process.env.BROWSERSLIST_ENV = process.env.NODE_ENV

  if (process.env.NODE_ENV === 'development') {
    // 本地开发构建配置（对应 dev.ts）
    return merge({}, baseConfig, devConfig)
  }
  // 生产构建配置（对应 prod.ts）
  return merge({}, baseConfig, prodConfig)
})
