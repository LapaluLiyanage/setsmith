import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.setsmith.app',
  appName: 'Setsmith',
  webDir: 'dist',
  backgroundColor: '#050505',
  ios: { contentInset: 'never' },
  plugins: {
    SplashScreen: { backgroundColor: '#050505', launchShowDuration: 800 },
  },
}

export default config
