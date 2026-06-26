import UIKit
import UniformTypeIdentifiers

class ShareViewController: UIViewController {

    private let appGroupId  = "group.com.fateen.app"
    private let pendingKey  = "pendingShareText"
    private let green       = UIColor(red: 0.114, green: 0.620, blue: 0.459, alpha: 1)

    // ── واجهة المستخدم ──────────────────────────────────────────────
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor.black.withAlphaComponent(0.45)
        buildCard()
        handleSharedContent()
    }

    private func buildCard() {
        let card = UIView()
        card.backgroundColor = .white
        card.layer.cornerRadius = 22
        card.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(card)

        let logo = UILabel()
        logo.text = "ف"
        logo.font = .boldSystemFont(ofSize: 36)
        logo.textColor = green
        logo.textAlignment = .center
        logo.translatesAutoresizingMaskIntoConstraints = false

        let appName = UILabel()
        appName.text = "فطين"
        appName.font = .boldSystemFont(ofSize: 22)
        appName.textColor = .label
        appName.textAlignment = .center
        appName.translatesAutoresizingMaskIntoConstraints = false

        let status = UILabel()
        status.text = "جاري قراءة الرسالة..."
        status.font = .systemFont(ofSize: 14)
        status.textColor = .secondaryLabel
        status.textAlignment = .center
        status.numberOfLines = 2
        status.translatesAutoresizingMaskIntoConstraints = false
        status.tag = 99

        [logo, appName, status].forEach { card.addSubview($0) }

        NSLayoutConstraint.activate([
            card.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            card.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            card.widthAnchor.constraint(equalToConstant: 270),
            card.heightAnchor.constraint(equalToConstant: 170),

            logo.topAnchor.constraint(equalTo: card.topAnchor, constant: 26),
            logo.centerXAnchor.constraint(equalTo: card.centerXAnchor),

            appName.topAnchor.constraint(equalTo: logo.bottomAnchor, constant: 6),
            appName.centerXAnchor.constraint(equalTo: card.centerXAnchor),

            status.topAnchor.constraint(equalTo: appName.bottomAnchor, constant: 10),
            status.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),
            status.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -20),
        ])
    }

    // ── منطق قراءة المحتوى المشارَك ─────────────────────────────────
    private func handleSharedContent() {
        guard
            let item     = extensionContext?.inputItems.first as? NSExtensionItem,
            let provider = item.attachments?.first
        else { showResult(success: false); return }

        let type = UTType.plainText.identifier

        guard provider.hasItemConformingToTypeIdentifier(type) else {
            showResult(success: false)
            return
        }

        provider.loadItem(forTypeIdentifier: type, options: nil) { [weak self] data, _ in
            DispatchQueue.main.async {
                if let text = data as? String, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    self?.save(text: text)
                } else {
                    self?.showResult(success: false)
                }
            }
        }
    }

    // ── الحفظ في App Group ──────────────────────────────────────────
    private func save(text: String) {
        let defaults = UserDefaults(suiteName: appGroupId)
        defaults?.set(text, forKey: pendingKey)
        defaults?.synchronize()
        showResult(success: true)
    }

    // ── تحديث الـ UI والإغلاق ───────────────────────────────────────
    private func showResult(success: Bool) {
        guard let label = view.viewWithTag(99) as? UILabel else { return }

        if success {
            label.text = "✓ تم — افتح فطين لإتمام الإضافة"
            label.textColor = green
        } else {
            label.text = "⚠️ تعذّر قراءة النص"
            label.textColor = .systemRed
        }

        let delay: Double = success ? 1.8 : 2.5
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
            self.extensionContext?.completeRequest(returningItems: [])
        }
    }
}
