/**
 * 小程序全局配置：页面路由、tabBar 与定位权限声明
 *
 * 注册 11 个页面路由、4 个 tabBar 页签（首页/消息/行程/我的，PNG 图标），
 * 并声明 scope.userLocation 定位权限用途与 requiredPrivateInfos。
 */
import { GPS_RADIUS } from './config'

export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/chat/index',
    'pages/trips/index',
    'pages/mine/index',
    'pages/login/index',
    'pages/publish/index',
    'pages/matching/index',
    'pages/chat-detail/index',
    'pages/review/index',
    'pages/report/index',
    'pages/default-info/index'
  ],
  window: {
    backgroundTextStyle: 'dark',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: '同路人',
    navigationBarTextStyle: 'black',
    backgroundColor: '#f3f6fb'
  },
  tabBar: {
    color: '#86909c',
    selectedColor: '#1e6fff',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/home/index',
        text: '首页',
        iconPath: 'assets/tabbar/home.png',
        selectedIconPath: 'assets/tabbar/home-selected.png'
      },
      {
        pagePath: 'pages/chat/index',
        text: '消息',
        iconPath: 'assets/tabbar/chat.png',
        selectedIconPath: 'assets/tabbar/chat-selected.png'
      },
      {
        pagePath: 'pages/trips/index',
        text: '行程',
        iconPath: 'assets/tabbar/trip.png',
        selectedIconPath: 'assets/tabbar/trip-selected.png'
      },
      {
        pagePath: 'pages/mine/index',
        text: '我的',
        iconPath: 'assets/tabbar/mine.png',
        selectedIconPath: 'assets/tabbar/mine-selected.png'
      }
    ]
  },
  permission: {
    'scope.userLocation': {
      desc: `用于验证你是否处于地铁站出口 / 校门口约 ${GPS_RADIUS} 米范围内`
    }
  },
  requiredPrivateInfos: ['getLocation']
})
