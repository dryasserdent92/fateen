import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.fateen.app",
  appName: "فطين",
  webDir: "out",
  server: {
    // يحمّل التطبيق من Vercel مباشرةً — يحل مشكلة API routes في static export
    url: "https://fateenapp.vercel.app",
    cleartext: false,
  },
  plugins: {
    StatusBar: {
      style: "DARK",
      backgroundColor: "#1D9E75",
    },
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#1D9E75",
      showSpinner: false,
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
    },
  },
};

export default config;
