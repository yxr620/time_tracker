import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.timetracker',
  appName: '时间追踪工具',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
  plugins: {
    StatusBar: {
      style: 'light',
      backgroundColor: '#1677ff',
      overlay: false,
    },
    SplashScreen: {
      launchAutoHide: true,
    },
    Keyboard: {
      resize: 'ionic',
      style: 'dark',
      resizeOnFullScreen: false,
    },
  },
};

export default config;
