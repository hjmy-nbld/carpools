/**
 * 小程序入口组件
 * 负责挂载全局样式；全局生命周期（onShow/onHide）目前无业务逻辑。
 */
import { useEffect, type ReactNode } from 'react';
import { useDidShow, useDidHide } from '@tarojs/taro';
import './app.scss';

function App(props: { children?: ReactNode }) {
  useEffect(() => {
    // 应用启动后的全局初始化逻辑写在这里
  }, []);

  // 对应小程序 onShow
  useDidShow(() => {});

  // 对应小程序 onHide
  useDidHide(() => {});

  return props.children;
}

export default App;
