import UIKit
import Capacitor
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    private let appGroupId = "group.com.yasseralmunajem.fateen"
    private let pendingKey = "pendingShareText"

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {}

    func applicationDidEnterBackground(_ application: UIApplication) {}

    func applicationWillEnterForeground(_ application: UIApplication) {
        // تحقق من رسالة مشارَكة معلّقة من Share Extension
        checkPendingShare()
    }

    func applicationDidBecomeActive(_ application: UIApplication) {}

    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    // ── Share Extension Bridge ────────────────────────────────────────

    private func checkPendingShare() {
        let defaults = UserDefaults(suiteName: appGroupId)
        guard let text = defaults?.string(forKey: pendingKey), !text.isEmpty else { return }

        // احذف بعد القراءة مباشرة
        defaults?.removeObject(forKey: pendingKey)
        defaults?.synchronize()

        // أعطِ الـ WebView وقتاً ليكتمل التحميل
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in
            self?.injectShare(text: text)
        }
    }

    private func injectShare(text: String) {
        guard let webView = findWebView(in: window?.rootViewController?.view) else { return }

        // هرّب النص لاستخدامه في JavaScript
        let escaped = text
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "`", with: "\\`")
            .replacingOccurrences(of: "\n", with: "\\n")
            .replacingOccurrences(of: "\r", with: "\\r")

        let js = """
        window.dispatchEvent(new CustomEvent('fateenShare', {
            detail: { text: `\(escaped)` }
        }));
        """

        webView.evaluateJavaScript(js) { _, error in
            if let error = error {
                print("FateenShare JS error: \\(error)")
            }
        }
    }

    private func findWebView(in view: UIView?) -> WKWebView? {
        guard let view = view else { return nil }
        if let wk = view as? WKWebView { return wk }
        for sub in view.subviews {
            if let found = findWebView(in: sub) { return found }
        }
        return nil
    }
}
