import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

import { setupIonicReact } from '@ionic/react';

import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Capacitor } from '@capacitor/core'

// 初始化 Ionic
setupIonicReact();

// 设置 viewport
const viewport = document.querySelector('meta[name="viewport"]');
if (viewport) {
  viewport.setAttribute(
    'content',
    'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0'
  );
}

// 初始化状态栏
if (Capacitor.isNativePlatform()) {
  try {
    StatusBar.setStyle({ style: Style.Light });
    StatusBar.setBackgroundColor({ color: '#ffffff' });
    StatusBar.setOverlaysWebView({ overlay: false });
  } catch (error) {
    console.error('[Init] 状态栏初始化失败:', error);
  }
}

// 全局错误处理
window.addEventListener('error', (event) => {
  console.error('[Global Error]', event.error);
  // 不阻止默认行为，让应用继续运行
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason);
  // 不阻止默认行为
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
