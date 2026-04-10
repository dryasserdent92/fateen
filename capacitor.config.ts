import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.fateen.app",           // Bundle ID — غيّره لما تسجّل في App Store Connect
  appName: "فطين",
  webDir: "out",                     // مجلد الـ static export
  server: {
    // أزل التعليق عن السطر التالي فقط أثناء التطوير لتسريع التحميل
    // url: "https://YOUR-VERCEL-URL.vercel.app",
    // androidScheme: "https",
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
