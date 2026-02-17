import UIKit
import Capacitor

@objc(MainViewController)
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(IOSWheelDateTimePickerPlugin())
    }
}

@objc(IOSWheelDateTimePickerPlugin)
public class IOSWheelDateTimePickerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "IOSWheelDateTimePickerPlugin"
    public let jsName = "IOSWheelDateTimePicker"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "present", returnType: CAPPluginReturnPromise)
    ]

    @objc public func present(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let initialValue = call.getString("value")
            let initialDate = ISO8601DateFormatter().date(from: initialValue ?? "") ?? Date()
            let daysBefore = max(0, call.getInt("daysBefore") ?? 15)
            let daysAfter = max(0, call.getInt("daysAfter") ?? 15)

            let pickerVC = WheelDateTimePickerViewController(
                initialDate: initialDate,
                daysBefore: daysBefore,
                daysAfter: daysAfter
            )

            pickerVC.onCancel = {
                call.resolve(["cancelled": true])
            }

            pickerVC.onConfirm = { selectedDate in
                let iso = ISO8601DateFormatter().string(from: selectedDate)
                call.resolve([
                    "cancelled": false,
                    "value": iso
                ])
            }

            pickerVC.modalPresentationStyle = .pageSheet
            pickerVC.preferredContentSize = CGSize(width: 0, height: 380)
            if #available(iOS 16.0, *) {
                if let sheet = pickerVC.sheetPresentationController {
                    sheet.detents = [
                        .custom(identifier: .init("wheelCompact")) { _ in
                            return 380
                        }
                    ]
                    sheet.prefersGrabberVisible = true
                    sheet.prefersScrollingExpandsWhenScrolledToEdge = false
                }
            } else if #available(iOS 15.0, *) {
                if let sheet = pickerVC.sheetPresentationController {
                    sheet.detents = [.medium()]
                    sheet.prefersGrabberVisible = true
                    sheet.prefersScrollingExpandsWhenScrolledToEdge = false
                }
            }

            guard let rootVC = self.bridge?.viewController else {
                call.reject("Unable to present picker view controller")
                return
            }

            rootVC.present(pickerVC, animated: true)
        }
    }
}

private final class WheelDateTimePickerViewController: UIViewController, UIPickerViewDataSource, UIPickerViewDelegate {
    private struct DateItem {
        let date: Date
        let value: String
        let label: String
    }

    private let initialDate: Date
    private let daysBefore: Int
    private let daysAfter: Int
    private let pickerView = UIPickerView()

    private var dateItems: [DateItem] = []
    private var selectedDateIndex: Int = 0
    private var selectedHour: Int = 0
    private var selectedMinute: Int = 0

    var onCancel: (() -> Void)?
    var onConfirm: ((Date) -> Void)?

    init(initialDate: Date, daysBefore: Int, daysAfter: Int) {
        self.initialDate = initialDate
        self.daysBefore = daysBefore
        self.daysAfter = daysAfter
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        buildDateItems()
        setupLayout()
        selectInitialRows()
    }

    private func setupLayout() {
        let headerView = UIView()
        headerView.translatesAutoresizingMaskIntoConstraints = false

        let cancelButton = UIButton(type: .system)
        cancelButton.translatesAutoresizingMaskIntoConstraints = false
        cancelButton.setTitle("取消", for: .normal)
        cancelButton.titleLabel?.font = .systemFont(ofSize: 18, weight: .semibold)
        cancelButton.addTarget(self, action: #selector(handleCancel), for: .touchUpInside)

        let confirmButton = UIButton(type: .system)
        confirmButton.translatesAutoresizingMaskIntoConstraints = false
        confirmButton.setTitle("确定", for: .normal)
        confirmButton.titleLabel?.font = .systemFont(ofSize: 18, weight: .semibold)
        confirmButton.addTarget(self, action: #selector(handleConfirm), for: .touchUpInside)

        headerView.addSubview(cancelButton)
        headerView.addSubview(confirmButton)

        pickerView.translatesAutoresizingMaskIntoConstraints = false
        pickerView.dataSource = self
        pickerView.delegate = self

        view.addSubview(headerView)
        view.addSubview(pickerView)

        NSLayoutConstraint.activate([
            headerView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
            headerView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            headerView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            headerView.heightAnchor.constraint(equalToConstant: 44),

            cancelButton.leadingAnchor.constraint(equalTo: headerView.leadingAnchor),
            cancelButton.centerYAnchor.constraint(equalTo: headerView.centerYAnchor),

            confirmButton.trailingAnchor.constraint(equalTo: headerView.trailingAnchor),
            confirmButton.centerYAnchor.constraint(equalTo: headerView.centerYAnchor),

            pickerView.topAnchor.constraint(equalTo: headerView.bottomAnchor, constant: 4),
            pickerView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 8),
            pickerView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -8),
            pickerView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    private func buildDateItems() {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let initialDay = calendar.startOfDay(for: initialDate)

        let valueFormatter = DateFormatter()
        valueFormatter.calendar = calendar
        valueFormatter.locale = Locale(identifier: "en_US_POSIX")
        valueFormatter.dateFormat = "yyyy-MM-dd"

        let fallbackLabelFormatter = DateFormatter()
        fallbackLabelFormatter.calendar = calendar
        fallbackLabelFormatter.locale = Locale.current
        fallbackLabelFormatter.dateFormat = "MM/dd EEE"

        let shortDateFormatter = DateFormatter()
        shortDateFormatter.calendar = calendar
        shortDateFormatter.locale = Locale.current
        shortDateFormatter.dateFormat = "MM/dd"

        var generated: [DateItem] = []

        for offset in (-daysBefore)...daysAfter {
            guard let date = calendar.date(byAdding: .day, value: offset, to: initialDay) else {
                continue
            }

            let value = valueFormatter.string(from: date)
            let label: String

            if calendar.isDate(date, inSameDayAs: today) {
                label = "今天 \(shortDateFormatter.string(from: date))"
            } else if let yesterday = calendar.date(byAdding: .day, value: -1, to: today), calendar.isDate(date, inSameDayAs: yesterday) {
                label = "昨天 \(shortDateFormatter.string(from: date))"
            } else if let tomorrow = calendar.date(byAdding: .day, value: 1, to: today), calendar.isDate(date, inSameDayAs: tomorrow) {
                label = "明天 \(shortDateFormatter.string(from: date))"
            } else {
                label = fallbackLabelFormatter.string(from: date)
            }

            generated.append(DateItem(date: date, value: value, label: label))
        }

        dateItems = generated

        if let index = dateItems.firstIndex(where: { $0.value == valueFormatter.string(from: initialDay) }) {
            selectedDateIndex = index
        } else {
            selectedDateIndex = max(0, dateItems.count / 2)
        }
    }

    private func selectInitialRows() {
        let calendar = Calendar.current
        selectedHour = calendar.component(.hour, from: initialDate)
        selectedMinute = calendar.component(.minute, from: initialDate)

        pickerView.reloadAllComponents()
        pickerView.selectRow(selectedDateIndex, inComponent: 0, animated: false)
        pickerView.selectRow(selectedHour, inComponent: 1, animated: false)
        pickerView.selectRow(selectedMinute, inComponent: 2, animated: false)
    }

    @objc private func handleCancel() {
        dismiss(animated: true) {
            self.onCancel?()
        }
    }

    @objc private func handleConfirm() {
        guard !dateItems.isEmpty else {
            dismiss(animated: true) {
                self.onCancel?()
            }
            return
        }

        let calendar = Calendar.current
        let baseDate = dateItems[selectedDateIndex].date

        var components = calendar.dateComponents([.year, .month, .day], from: baseDate)
        components.hour = selectedHour
        components.minute = selectedMinute
        components.second = 0
        components.nanosecond = 0

        guard let resultDate = calendar.date(from: components) else {
            dismiss(animated: true) {
                self.onCancel?()
            }
            return
        }

        dismiss(animated: true) {
            self.onConfirm?(resultDate)
        }
    }

    func numberOfComponents(in pickerView: UIPickerView) -> Int {
        return 3
    }

    func pickerView(_ pickerView: UIPickerView, numberOfRowsInComponent component: Int) -> Int {
        switch component {
        case 0:
            return dateItems.count
        case 1:
            return 24
        default:
            return 60
        }
    }

    func pickerView(_ pickerView: UIPickerView, widthForComponent component: Int) -> CGFloat {
        let total = pickerView.bounds.width
        switch component {
        case 0:
            return total * 0.6
        default:
            return total * 0.2
        }
    }

    func pickerView(_ pickerView: UIPickerView, rowHeightForComponent component: Int) -> CGFloat {
        return 36
    }

    func pickerView(_ pickerView: UIPickerView, titleForRow row: Int, forComponent component: Int) -> String? {
        switch component {
        case 0:
            guard row < dateItems.count else { return nil }
            return dateItems[row].label
        case 1:
            return String(format: "%02d", row)
        default:
            return String(format: "%02d", row)
        }
    }

    func pickerView(_ pickerView: UIPickerView, didSelectRow row: Int, inComponent component: Int) {
        switch component {
        case 0:
            selectedDateIndex = row
        case 1:
            selectedHour = row
        default:
            selectedMinute = row
        }
    }
}
