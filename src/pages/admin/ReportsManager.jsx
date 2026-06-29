import { useState, useMemo } from "react";
import { Clock, MessageSquareText, Mail, FileText, Calendar, Send, TrendingUp, BarChart2, Download } from "lucide-react";
import { useAdmin } from "../../layouts/AdminLayout";
import { buildAnalytics, sendEodEmailReport, format12HourTime, logReport } from "../../lib/api";
import { formatEodReportMessage, getWhatsAppProvider, buildWhatsAppLink } from "../../lib/whatsapp";
import toast from "react-hot-toast";

export default function ReportsManager() {
  const { invoices, customers, reportLogs, settings, staff, attendance, cashRegister, inventory } = useAdmin();
  const provider = getWhatsAppProvider(settings);
  
  // Tab switcher
  const [activeTab, setActiveTab] = useState("range"); // "range" | "monthly"

  // Date Range Filters for Metric Cards & Table
  const firstDayOfMonth = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  };
  const [startDate, setStartDate] = useState(firstDayOfMonth());
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  // Monthly Report state
  const currentMonthStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr());

  // Date picker for daily EOD email
  const [emailReportDate, setEmailReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [emailRecipient, setEmailRecipient] = useState(settings?.email || "admin@example.com");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [reportFormat, setReportFormat] = useState("text"); // "text" | "pdf" | "excel" | "both"

  const getEodReportData = (targetDate) => {
    const dayInvoices = (invoices || []).filter(
      (inv) => inv.billing_at?.slice(0, 10) === targetDate && inv.status !== "void"
    );
    const dayAttendance = (attendance || []).filter((att) => att.date === targetDate);
    const dayRegister = (cashRegister || []).find((reg) => reg.date === targetDate);
    const lowStock = (inventory || []).filter(
      (item) => Number(item.stock_qty) <= Number(item.min_qty)
    );

    let totalNet = 0;
    let totalGST = 0;
    let totalTips = 0;
    let totalGross = 0;

    const paymentBreakdown = {};
    const staffStats = {};
    const serviceBreakdown = {};
    const productBreakdown = {};

    dayInvoices.forEach((inv) => {
      const gst = Number(inv.tax || 0);
      const tip = Number(inv.tip || 0);
      const total = Number(inv.total || 0);
      const netAmt = total - gst - tip;
      const payment = inv.payment_method || "Unknown";

      totalNet += netAmt;
      totalGST += gst;
      totalTips += tip;
      totalGross += total;

      if (payment === "Cash + UPI" && inv.transaction_id && inv.transaction_id.includes("cash:")) {
        const parts = inv.transaction_id.split("|");
        let cashAmt = 0;
        let upiAmt = 0;
        parts.forEach(p => {
          if (p.startsWith("cash:")) cashAmt = Number(p.replace("cash:", "")) || 0;
          if (p.startsWith("upi:")) upiAmt = Number(p.replace("upi:", "")) || 0;
        });
        paymentBreakdown["Cash"] = (paymentBreakdown["Cash"] || 0) + cashAmt;
        paymentBreakdown["UPI"] = (paymentBreakdown["UPI"] || 0) + upiAmt;
      } else {
        paymentBreakdown[payment] = (paymentBreakdown[payment] || 0) + total;
      }

      (inv.invoice_items || []).forEach((item) => {
        const itemStaff = item.staff_name || inv.staff_name || "Unknown Stylist";
        const itemType = item.item_type || "service";
        const qty = Number(item.quantity || 1);
        const itemVal = qty * Number(item.price || 0);

        if (itemType === "membership") {
          return;
        }

        if (itemType === "product") {
          if (!productBreakdown[item.service_name]) {
            productBreakdown[item.service_name] = { name: item.service_name, qty: 0, total: 0 };
          }
          productBreakdown[item.service_name].qty += qty;
          productBreakdown[item.service_name].total += itemVal;
        } else {
          if (!serviceBreakdown[item.service_name]) {
            serviceBreakdown[item.service_name] = { name: item.service_name, qty: 0, total: 0 };
          }
          serviceBreakdown[item.service_name].qty += qty;
          serviceBreakdown[item.service_name].total += itemVal;
        }

        if (!staffStats[itemStaff]) {
          staffStats[itemStaff] = { clients: new Set(), netServices: 0, products: 0, tips: 0, total: 0 };
        }
        staffStats[itemStaff].clients.add(inv.id);
        if (itemType === "product") {
          staffStats[itemStaff].products += itemVal;
        } else {
          staffStats[itemStaff].netServices += itemVal;
        }
        staffStats[itemStaff].total += itemVal;
      });

      const mainStylist = inv.staff_name || "Unknown Stylist";
      if (mainStylist) {
        if (!staffStats[mainStylist]) {
          staffStats[mainStylist] = { clients: new Set(), netServices: 0, products: 0, tips: 0, total: 0 };
        }
        staffStats[mainStylist].tips += tip;
        staffStats[mainStylist].total += tip;
      }
    });

    return {
      date: targetDate,
      invoices: dayInvoices,
      attendance: dayAttendance,
      register: dayRegister,
      lowStock,
      totalNet,
      totalGST,
      totalTips,
      totalGross,
      paymentBreakdown,
      staffStats,
      serviceBreakdown,
      productBreakdown
    };
  };

  const handleExportPDF = () => {
    const data = getEodReportData(emailReportDate);
    if (!data.invoices.length && !data.attendance.length && !data.register) {
      toast.error("No EOD data recorded on this date to export.");
      return;
    }

    const salonName = settings?.name || "Toni & Guy Essensuals Gorantla";
    const formattedDate = new Date(emailReportDate).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Failed to open print window. Please allow popups.");
      return;
    }

    const html = `
      <html>
        <head>
          <title>EOD Report - ${formattedDate}</title>
          <style>
            @page {
              size: auto;
              margin: 0mm !important;
            }
            @media print {
              @page {
                margin: 0mm !important;
              }
              body {
                padding: 20mm !important;
              }
              .no-print {
                display: none !important;
              }
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              padding: 20mm;
              color: #000;
              line-height: 1.4;
            }
            .header {
              border-bottom: 2px solid #000;
              padding-bottom: 20px;
              margin-bottom: 80px;
            }
            .header h1 {
              font-size: 24px;
              margin: 0;
              color: #000;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .header p {
              margin: 5px 0 0 0;
              color: #000;
              font-size: 14px;
            }
            .section {
              margin-bottom: 30px;
            }
            .section-title {
              font-size: 16px;
              font-weight: 700;
              color: #000;
              border-bottom: 1px solid #000;
              padding-bottom: 5px;
              margin-bottom: 12px;
              text-transform: uppercase;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              font-size: 12px;
            }
            th, td {
              border: 1px solid #000;
              padding: 10px 8px;
              text-align: left;
              color: #000;
            }
            th {
              background-color: #fff;
              font-weight: 600;
              color: #000;
            }
            .text-right {
              text-align: right;
            }
            .text-center {
              text-align: center;
            }
            .bold {
              font-weight: bold;
            }
            .totals-row td {
              background-color: #fff;
              border-top: 2px solid #000;
              font-weight: bold;
              color: #000;
            }
            .summary-box {
              background: #fff;
              border: 1px solid #000;
              border-radius: 4px;
              padding: 15px;
              margin-top: 10px;
              font-size: 13px;
              color: #000;
            }
            .summary-box table {
              margin-top: 0;
              font-size: 13px;
            }
            .summary-box table td {
              border: none;
              padding: 4px 0;
              color: #000;
            }
            .badge {
              display: inline-block;
              font-size: 10px;
              font-weight: bold;
              text-transform: uppercase;
              color: #000;
            }
            .badge-present, .badge-absent, .badge-late {
              background: none !important;
              color: #000 !important;
              border: none !important;
              padding: 0 !important;
            }
            .footer {
              margin-top: 50px;
              border-top: 1px solid #000;
              padding-top: 15px;
              font-size: 11px;
              color: #000;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="text-align: center; margin-bottom: 20px; padding: 10px; background: #f5f5f0; border-bottom: 1px solid #ccc; font-family: sans-serif;">
            <button onclick="window.print()" style="padding: 6px 12px; font-weight: bold; cursor: pointer;">Print Report</button>
            <button onclick="window.close()" style="padding: 6px 12px; margin-left: 10px; cursor: pointer;">Close Window</button>
          </div>
          <div class="print-container" style="max-width: 800px; margin: 0 auto;">
            <div class="header" style="text-align: center; margin-bottom: 80px; border-bottom: 2px solid #000; padding-bottom: 20px;">
            <div style="font-size: 32px; font-weight: 800; letter-spacing: 4px; margin: 0; color: #000; font-family: 'Montserrat', sans-serif; text-transform: uppercase;">TONI & GUY</div>
            <div style="font-size: 14px; font-weight: 400; letter-spacing: 6px; margin: 5px 0 0 0; color: #000; font-family: 'Montserrat', sans-serif; text-transform: uppercase;">Essensuals Gorantla</div>
            <p style="margin: 8px 0 0 0; font-size: 11px; color: #000; font-family: sans-serif; letter-spacing: 1px;">
              Gorantla, Guntur, Andhra Pradesh
            </p>
            <div style="width: 80px; height: 2px; background: #000; margin: 15px auto 0 auto;"></div>
            <p style="margin: 15px 0 0 0; color: #000; font-size: 13px; font-family: sans-serif; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">
              Daily End-Of-Day (EOD) Report
            </p>
            <p style="margin: 5px 0 0 0; color: #000; font-size: 11px; font-family: sans-serif;">
              Date: ${formattedDate}
            </p>
          </div>

          <!-- 1. SALES INVOICES -->
          <div class="section">
            <div class="section-title">1. Sales Invoices</div>
            <table>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Client</th>
                  <th>Mobile</th>
                  <th>Services / Products Enjoyed</th>
                  <th class="text-right">Net Amount</th>
                  <th class="text-right">GST Tax</th>
                  <th class="text-right">Tips</th>
                  <th class="text-right">Grand Total</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                ${
                  data.invoices.length > 0
                    ? data.invoices
                        .map((inv) => {
                          const netAmt = Number(inv.total || 0) - Number(inv.tax || 0) - Number(inv.tip || 0);
                          const itemsStr = (inv.invoice_items || [])
                            .map((item) => `${item.service_name} (${item.staff_name || inv.staff_name || "Stylist"})`)
                            .join(", ") || "—";
                          return `
                          <tr>
                            <td class="bold">${inv.invoice_number}</td>
                            <td>${inv.client_name || "—"}</td>
                            <td>${inv.mobile || "—"}</td>
                            <td>${itemsStr}</td>
                            <td class="text-right">Rs ${netAmt.toLocaleString("en-IN")}</td>
                            <td class="text-right">Rs ${Number(inv.tax || 0).toLocaleString("en-IN")}</td>
                            <td class="text-right">Rs ${Number(inv.tip || 0).toLocaleString("en-IN")}</td>
                            <td class="text-right bold">Rs ${Number(inv.total || 0).toLocaleString("en-IN")}</td>
                            <td>${inv.payment_method || "—"}</td>
                          </tr>
                        `;
                        })
                        .join("")
                    : `<tr><td colspan="9" class="text-center">No invoices recorded today.</td></tr>`
                }
                ${
                  data.invoices.length > 0
                    ? `
                  <tr class="totals-row">
                    <td colspan="4">Total</td>
                    <td class="text-right">Rs ${data.totalNet.toLocaleString("en-IN")}</td>
                    <td class="text-right">Rs ${data.totalGST.toLocaleString("en-IN")}</td>
                    <td class="text-right">Rs ${data.totalTips.toLocaleString("en-IN")}</td>
                    <td class="text-right">Rs ${data.totalGross.toLocaleString("en-IN")}</td>
                    <td>—</td>
                  </tr>
                `
                    : ""
                }
              </tbody>
            </table>
          </div>

          <!-- 2 & 3. SERVICES & PRODUCTS RENDERED SUMMARY -->
          <div style="display: flex; gap: 20px; page-break-inside: avoid;" class="section">
            <div style="flex: 1.2;">
              <div class="section-title">2. Services Rendered Summary</div>
              <table>
                <thead>
                  <tr>
                    <th>Service Name</th>
                    <th class="text-center" style="width: 80px;">Qty</th>
                    <th class="text-right" style="width: 120px;">Total Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    Object.keys(data.serviceBreakdown).length > 0
                      ? Object.values(data.serviceBreakdown)
                          .sort((a, b) => b.total - a.total)
                          .map((item) => `
                            <tr>
                              <td class="bold">${item.name}</td>
                              <td class="text-center">${item.qty}</td>
                              <td class="text-right bold">Rs ${item.total.toLocaleString("en-IN")}</td>
                            </tr>
                          `)
                          .join("")
                      : `<tr><td colspan="3" class="text-center">No services performed today.</td></tr>`
                  }
                </tbody>
              </table>
            </div>

            <div style="flex: 0.8;">
              <div class="section-title">3. Products Sold Summary</div>
              <table>
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th class="text-center" style="width: 60px;">Qty</th>
                    <th class="text-right" style="width: 100px;">Total Sales</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    Object.keys(data.productBreakdown).length > 0
                      ? Object.values(data.productBreakdown)
                          .sort((a, b) => b.total - a.total)
                          .map((item) => `
                            <tr>
                              <td class="bold">${item.name}</td>
                              <td class="text-center">${item.qty}</td>
                              <td class="text-right bold">Rs ${item.total.toLocaleString("en-IN")}</td>
                            </tr>
                          `)
                          .join("")
                      : `<tr><td colspan="3" class="text-center">No products sold today.</td></tr>`
                  }
                </tbody>
              </table>
            </div>
          </div>

          <!-- 4 & 5. PAYMENT SUMMARY & INVENTORY ALERTS -->
          <div style="display: flex; gap: 20px; page-break-inside: avoid;" class="section">
            <div style="flex: 1;">
              <div class="section-title">4. Payment Summary</div>
              <table>
                <thead>
                  <tr>
                    <th>Payment Method</th>
                    <th class="text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    Object.keys(data.paymentBreakdown).length > 0
                      ? Object.entries(data.paymentBreakdown)
                          .map(
                            ([method, amt]) => `
                          <tr>
                            <td class="bold">${method}</td>
                            <td class="text-right bold">Rs ${amt.toLocaleString("en-IN")}</td>
                          </tr>
                        `
                          )
                          .join("")
                      : `<tr><td colspan="2" class="text-center">No payments.</td></tr>`
                  }
                </tbody>
              </table>
            </div>

            <div style="flex: 1;">
              <div class="section-title">5. Inventory Status</div>
              <div class="summary-box">
                <p><strong>Total Catalog Items:</strong> ${(inventory || []).length}</p>
                <p><strong>Alert Status:</strong> ${
                  data.lowStock.length > 0
                    ? `<span style="color: #000; font-weight: bold;">${data.lowStock.length} items low on stock</span>`
                    : `<span style="color: #000; font-weight: bold;">All products normal (No alerts)</span>`
                }</p>
                ${
                  data.lowStock.length > 0
                    ? `
                  <div style="margin-top: 10px; font-size: 11px; border-top: 1px solid #ddd; padding-top: 5px;">
                    <strong>Low Stock Items:</strong>
                    <ul style="margin: 5px 0; padding-left: 15px;">
                      ${data.lowStock
                        .map((item) => `<li>${item.name} (Qty: ${item.stock_qty} / Min: ${item.min_qty})</li>`)
                        .join("")}
                    </ul>
                  </div>
                `
                    : ""
                }
              </div>
            </div>
          </div>

          <!-- 6. STAFF SUMMARY -->
          <div class="section" style="page-break-inside: avoid;">
            <div class="section-title">6. Staff Contribution Summary</div>
            <table>
              <thead>
                <tr>
                  <th>Staff Name</th>
                  <th class="text-center">Clients Served</th>
                  <th class="text-right">Services Net</th>
                  <th class="text-right">Products Net</th>
                  <th class="text-right">Tips Received</th>
                  <th class="text-right">Total Contribution</th>
                </tr>
              </thead>
              <tbody>
                ${
                  Object.keys(data.staffStats).length > 0
                    ? Object.entries(data.staffStats)
                        .map(([name, stats]) => `
                        <tr>
                          <td class="bold">${name}</td>
                          <td class="text-center">${stats.clients.size}</td>
                          <td class="text-right">Rs ${stats.netServices.toLocaleString("en-IN")}</td>
                          <td class="text-right">Rs ${stats.products.toLocaleString("en-IN")}</td>
                          <td class="text-right">Rs ${stats.tips.toLocaleString("en-IN")}</td>
                          <td class="text-right bold">Rs ${stats.total.toLocaleString("en-IN")}</td>
                        </tr>
                      `)
                        .join("")
                    : `<tr><td colspan="6" class="text-center">No staff activity logged today.</td></tr>`
                }
              </tbody>
            </table>
          </div>

          <!-- 7 & 8. STAFF ATTENDANCE & CASH REGISTER -->
          <div style="display: flex; gap: 20px; page-break-inside: avoid;" class="section">
            <div style="flex: 1.2;">
              <div class="section-title">7. Staff Attendance</div>
              <table>
                <thead>
                  <tr>
                    <th>Staff Name</th>
                    <th>Status</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    data.attendance.length > 0
                      ? data.attendance
                          .map((att) => {
                            const staffMember = staff.find((s) => s.id === att.staff_id);
                            const name = staffMember?.name || "Staff";
                            const statusClass = `badge badge-${att.status}`;
                            return `
                            <tr>
                              <td class="bold">${name}</td>
                              <td><span class="${statusClass}">${att.status?.toUpperCase()}</span></td>
                              <td>${att.check_in ? format12HourTime(att.check_in) : "—"}</td>
                              <td>${att.check_out ? format12HourTime(att.check_out) : "—"}</td>
                            </tr>
                          `;
                          })
                          .join("")
                      : `<tr><td colspan="4" class="text-center">No attendance logs.</td></tr>`
                  }
                </tbody>
              </table>
            </div>

            <div style="flex: 0.8;">
              <div class="section-title">8. Cash Register</div>
              <div class="summary-box" style="margin-top: 10px;">
                ${
                  data.register
                    ? `
                  <table style="width: 100%; border: none;">
                    <tr><td class="bold">Opening Cash:</td><td class="text-right">Rs ${Number(data.register.opening_cash || 0).toLocaleString("en-IN")}</td></tr>
                    <tr><td class="bold">Expenses:</td><td class="text-right" style="color: #000;">Rs ${Number(data.register.expenses || 0).toLocaleString("en-IN")}</td></tr>
                    ${data.register.expense_notes ? `<tr><td colspan="2" style="font-size: 10px; color: #000; font-style: italic;">Notes: ${data.register.expense_notes}</td></tr>` : ""}
                    <tr style="border-top: 1px solid #000;"><td class="bold">Closing Cash:</td><td class="text-right bold">Rs ${Number(data.register.closing_cash || 0).toLocaleString("en-IN")}</td></tr>
                    <tr><td class="bold">Register Status:</td><td class="text-right"><span class="badge" style="color: #000; font-weight: bold;">${data.register.status?.toUpperCase()}</span></td></tr>
                  </table>
                `
                    : `<p class="text-center" style="margin: 20px 0; color: #888;">No cash register logged for this date.</p>`
                }
              </div>
            </div>
          </div>

          <div class="footer">
            <p>Report automatically generated by Essensuals Salon POS Admin Panel. All figures in INR (Rs).</p>
          </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleExportExcel = () => {
    const data = getEodReportData(emailReportDate);
    if (!data.invoices.length && !data.attendance.length && !data.register) {
      toast.error("No EOD data recorded on this date to export.");
      return;
    }

    const salonName = settings?.name || "Toni & Guy Essensuals Gorantla";
    let csvLines = [];

    csvLines.push(`"${salonName.toUpperCase()} - DAILY EOD REPORT"`);
    csvLines.push(`"Report Date","${emailReportDate}"`);
    csvLines.push(`"Generated At","${new Date().toLocaleString("en-IN")}"`);
    csvLines.push("");

    csvLines.push(`"1. SALES INVOICES"`);
    csvLines.push(`"Invoice #","Client Name","Mobile","Services & Products","Net Amount (Rs)","GST Tax (Rs)","Tips (Rs)","Grand Total (Rs)","Payment Method"`);
    
    if (data.invoices.length > 0) {
      data.invoices.forEach(inv => {
        const netAmt = Number(inv.total || 0) - Number(inv.tax || 0) - Number(inv.tip || 0);
        const itemsStr = (inv.invoice_items || [])
          .map((item) => `${item.service_name} (${item.staff_name || inv.staff_name || "Stylist"})`)
          .join(", ") || "—";
        csvLines.push(
          `"${inv.invoice_number}","${inv.client_name || ""}","${inv.mobile || ""}","${itemsStr.replace(/"/g, '""')}","${netAmt}","${inv.tax || 0}","${inv.tip || 0}","${inv.total}","${inv.payment_method || ""}"`
        );
      });
      csvLines.push(`"TOTAL","","","","${data.totalNet}","${data.totalGST}","${data.totalTips}","${data.totalGross}",""`);
    } else {
      csvLines.push(`"No invoices recorded today."`);
    }
    csvLines.push("");

    csvLines.push(`"2. PAYMENT SUMMARY"`);
    csvLines.push(`"Payment Method","Total Amount (Rs)"`);
    if (Object.keys(data.paymentBreakdown).length > 0) {
      Object.entries(data.paymentBreakdown).forEach(([method, amt]) => {
        csvLines.push(`"${method}","${amt}"`);
      });
    } else {
      csvLines.push(`"No payments."`);
    }
    csvLines.push("");

    csvLines.push(`"3. STAFF CONTRIBUTION"`);
    csvLines.push(`"Staff Name","Clients Served","Services Net (Rs)","Products Net (Rs)","Tips Received (Rs)","Total Contribution (Rs)"`);
    if (Object.keys(data.staffStats).length > 0) {
      Object.entries(data.staffStats).forEach(([name, stats]) => {
        csvLines.push(`"${name}","${stats.clients.size}","${stats.netServices}","${stats.products}","${stats.tips}","${stats.total}"`);
      });
    } else {
      csvLines.push(`"No staff activity."`);
    }
    csvLines.push("");

    csvLines.push(`"4. STAFF ATTENDANCE"`);
    csvLines.push(`"Staff Name","Status","Check In","Check Out"`);
    if (data.attendance.length > 0) {
      data.attendance.forEach(att => {
        const staffMember = staff.find((s) => s.id === att.staff_id);
        const name = staffMember?.name || "Staff";
        csvLines.push(`"${name}","${att.status?.toUpperCase()}","${att.check_in ? format12HourTime(att.check_in) : ""}","${att.check_out ? format12HourTime(att.check_out) : ""}"`);
      });
    } else {
      csvLines.push(`"No attendance logged."`);
    }
    csvLines.push("");

    csvLines.push(`"5. CASH REGISTER"`);
    if (data.register) {
      csvLines.push(`"Opening Cash","Rs ${data.register.opening_cash || 0}"`);
      csvLines.push(`"Expenses","Rs ${data.register.expenses || 0}"`);
      csvLines.push(`"Expense Notes","${(data.register.expense_notes || "").replace(/"/g, '""')}"`);
      csvLines.push(`"Closing Cash","Rs ${data.register.closing_cash || 0}"`);
      csvLines.push(`"Register Status","${data.register.status?.toUpperCase()}"`);
    } else {
      csvLines.push(`"No cash register logged for this date."`);
    }
    csvLines.push("");

    csvLines.push(`"6. INVENTORY STATUS"`);
    csvLines.push(`"Total Catalog Items","${(inventory || []).length}"`);
    if (data.lowStock.length > 0) {
      csvLines.push(`"Alerts","${data.lowStock.length} items low on stock"`);
      csvLines.push(`"Item Name","Current Stock","Min Stock Required"`);
      data.lowStock.forEach(item => {
        csvLines.push(`"${item.name}","${item.stock_qty}","${item.min_qty}"`);
      });
    } else {
      csvLines.push(`"Alerts","All products normal (No alerts)"`);
    }

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvLines.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `EOD_Report_${emailReportDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("EOD Excel Report (CSV) downloaded successfully!");
  };

  // Filter invoices based on date range
  const filteredInvoices = useMemo(() => {
    return (invoices || []).filter(inv => {
      const invDate = inv.billing_at ? inv.billing_at.slice(0, 10) : "";
      return invDate >= startDate && invDate <= endDate && inv.status !== "void";
    });
  }, [invoices, startDate, endDate]);

  // Compute metrics for Cards
  const totals = useMemo(() => {
    let gross = 0;
    let gst = 0;
    let tips = 0;
    let net = 0;

    filteredInvoices.forEach(inv => {
      gross += Number(inv.total || 0);
      gst += Number(inv.tax || 0);
      tips += Number(inv.tip || 0);
      net += Number(inv.total || 0) - Number(inv.tax || 0) - Number(inv.tip || 0);
    });

    return { gross, gst, tips, net };
  }, [filteredInvoices]);

  // WhatsApp EOD Summary report
  const today = new Date().toISOString().slice(0, 10);
  const whatsappReport = useMemo(() => {
    const todayInvoices = (invoices || []).filter((invoice) => invoice.billing_at?.slice(0, 10) === today);
    const daily = buildAnalytics(todayInvoices);
    const peakHour = daily.hourlySeries.sort((a, b) => b.total - a.total)[0]?.hour;
    return {
      ...daily,
      todayRevenue: daily.revenue,
      todayBills: todayInvoices.length,
      peakHour,
      newCustomers: (customers || []).filter((client) => client.created_at?.slice(0, 10) === today).length,
      repeatCustomers: todayInvoices.filter((invoice) => Number(invoice.customer?.visit_count || 0) > 1).length,
    };
  }, [invoices, customers, today]);

  const generateUnifiedText = async () => {
    try {
      // Gather data for email date
      const dayInvoices = (invoices || []).filter(inv => inv.billing_at?.slice(0, 10) === emailReportDate && inv.status !== "void");
      const dayAttendance = (attendance || []).filter(att => att.date === emailReportDate);
      const dayRegister = (cashRegister || []).find(reg => reg.date === emailReportDate);

      // Generate the primary tabular report using the shared formatter
      const primaryReportText = formatEodReportMessage(whatsappReport, settings, dayInvoices, inventory);

      let text = primaryReportText + `\n\n`;

      // Attendance
      text += `2. STAFF ATTENDANCE\n`;
      text += `--------------------------------------------------\n`;
      if (dayAttendance.length > 0) {
        dayAttendance.forEach(att => {
          const staffMember = staff.find(s => s.id === att.staff_id);
          const name = staffMember?.name || "Staff";
          const times = (att.status === "present" || att.status === "late") ? ` (In: ${att.check_in ? format12HourTime(att.check_in) : "—"} / Out: ${att.check_out ? format12HourTime(att.check_out) : "—"})` : "";
          text += `${name} - Status: ${att.status?.toUpperCase()}${times}\n`;
        });
      } else {
        text += `No attendance logs recorded today.\n`;
      }
      text += `--------------------------------------------------\n\n`;

      // Cash Register
      text += `3. CASH REGISTER TRANSACTIONS\n`;
      text += `--------------------------------------------------\n`;
      if (dayRegister) {
        text += `Opening Cash: Rs ${dayRegister.opening_cash || 0}\n`;
        text += `Expenses/Petty Cash: Rs ${dayRegister.expenses || 0}\n`;
        if (dayRegister.expense_notes) {
          text += `Expense Notes: ${dayRegister.expense_notes}\n`;
        }
        text += `Closing Cash: Rs ${dayRegister.closing_cash || 0}\n`;
        text += `Register Status: ${dayRegister.status?.toUpperCase()}\n`;
      } else {
        text += `No cash register log for this date.\n`;
      }
      text += `--------------------------------------------------\n\n`;
      text += `Report generated automatically at ${new Date().toLocaleTimeString("en-IN")}\n`;

      return text;
    } catch (err) {
      toast.error(err.message || "Failed to generate report text");
      return null;
    }
  };

  const handleSendEmailReport = async () => {
    setSendingEmail(true);
    const text = await generateUnifiedText();
    if (!text) {
      setSendingEmail(false);
      return;
    }
    try {
      await sendEodEmailReport("", text, emailRecipient);
      toast.success("EOD Email Report prepared!");
    } catch (err) {
      toast.error(err.message || "Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
  const handleSendWhatsappReport = async () => {
    setSendingWhatsapp(true);
    const text = await generateUnifiedText();
    if (!text) {
      setSendingWhatsapp(false);
      return;
    }
    try {
      const target = provider.reportRecipients[0] || provider.businessNumber;
      if (!target) {
        toast.error("No WhatsApp recipients configured in settings!");
        return;
      }
      await logReport({
        report_type: "eod_whatsapp",
        recipient: target,
        status: "prepared",
        payload: { body: text },
      });
      window.open(buildWhatsAppLink(target, text), "_blank", "noopener,noreferrer");
      toast.success("EOD WhatsApp Report prepared!");
    } catch (err) {
      toast.error(err.message || "Failed to send WhatsApp message");
    } finally {
      setSendingWhatsapp(false);
    }
  };

  const handleSendBothReports = async () => {
    setSendingEmail(true);
    setSendingWhatsapp(true);
    const text = await generateUnifiedText();
    if (!text) {
      setSendingEmail(false);
      setSendingWhatsapp(false);
      return;
    }
    try {
      // 1. WhatsApp
      const target = provider.reportRecipients[0] || provider.businessNumber;
      if (target) {
        await logReport({
          report_type: "eod_whatsapp",
          recipient: target,
          status: "prepared",
          payload: { body: text },
        });
        window.open(buildWhatsAppLink(target, text), "_blank", "noopener,noreferrer");
      }
      // 2. Email
      await sendEodEmailReport("", text, emailRecipient);
      toast.success("EOD Email and WhatsApp Reports prepared!");
    } catch (err) {
      toast.error(err.message || "Failed to trigger unified EOD");
    } finally {
      setSendingEmail(false);
      setSendingWhatsapp(false);
    }
  };

  // ─── Monthly Report Data ────────────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const prefix = selectedMonth; // "YYYY-MM"

    const monthInvoices = (invoices || []).filter(inv => {
      const d = inv.billing_at ? inv.billing_at.slice(0, 7) : "";
      return d === prefix && inv.status !== "void";
    });

    let totalGross = 0, totalGST = 0, totalTips = 0, totalNet = 0;
    const paymentMap = {};
    const staffMap = {};
    const serviceMap = {};
    const productMap = {};
    const dailyMap = {};

    monthInvoices.forEach(inv => {
      const gross = Number(inv.total || 0);
      const gst = Number(inv.tax || 0);
      const tip = Number(inv.tip || 0);
      const net = gross - gst - tip;
      totalGross += gross;
      totalGST += gst;
      totalTips += tip;
      totalNet += net;

      // Payment breakdown
      const payment = inv.payment_method || "Unknown";
      if (payment === "Cash + UPI" && inv.transaction_id && inv.transaction_id.includes("cash:")) {
        inv.transaction_id.split("|").forEach(p => {
          if (p.startsWith("cash:")) paymentMap["Cash"] = (paymentMap["Cash"] || 0) + (Number(p.replace("cash:", "")) || 0);
          if (p.startsWith("upi:")) paymentMap["UPI"] = (paymentMap["UPI"] || 0) + (Number(p.replace("upi:", "")) || 0);
        });
      } else {
        paymentMap[payment] = (paymentMap[payment] || 0) + gross;
      }

      // Daily totals
      const day = inv.billing_at ? inv.billing_at.slice(0, 10) : "?";
      if (!dailyMap[day]) dailyMap[day] = { gross: 0, bills: 0 };
      dailyMap[day].gross += gross;
      dailyMap[day].bills += 1;

      // Staff & items
      const mainStylist = inv.staff_name || "Unknown";
      if (!staffMap[mainStylist]) staffMap[mainStylist] = { bills: 0, services: 0, products: 0, tips: 0, total: 0 };
      staffMap[mainStylist].bills += 1;
      staffMap[mainStylist].tips += tip;
      staffMap[mainStylist].total += tip;

      (inv.invoice_items || []).forEach(item => {
        if (item.item_type === "membership") return;
        const qty = Number(item.quantity || 1);
        const val = qty * Number(item.price || 0);
        const itemStaff = item.staff_name || mainStylist;
        if (!staffMap[itemStaff]) staffMap[itemStaff] = { bills: 0, services: 0, products: 0, tips: 0, total: 0 };
        if (item.item_type === "product") {
          staffMap[itemStaff].products += val;
          if (!productMap[item.service_name]) productMap[item.service_name] = { qty: 0, total: 0 };
          productMap[item.service_name].qty += qty;
          productMap[item.service_name].total += val;
        } else {
          staffMap[itemStaff].services += val;
          if (!serviceMap[item.service_name]) serviceMap[item.service_name] = { qty: 0, total: 0 };
          serviceMap[item.service_name].qty += qty;
          serviceMap[item.service_name].total += val;
        }
        staffMap[itemStaff].total += val;
      });
    });

    const daysInMonth = new Date(year, month, 0).getDate();
    const workingDays = monthInvoices.length > 0
      ? Object.keys(dailyMap).length
      : 0;
    const avgDailyRevenue = workingDays > 0 ? totalGross / workingDays : 0;

    return {
      totalGross,
      totalGST,
      totalTips,
      totalNet,
      totalBills: monthInvoices.length,
      avgDailyRevenue,
      workingDays,
      daysInMonth,
      paymentMap,
      staffMap,
      serviceMap,
      productMap,
      dailyMap,
    };
  }, [invoices, selectedMonth]);

  // ─── Monthly PDF Export ─────────────────────────────────────────────────────
  const handleMonthlyPDF = () => {
    const m = monthlyData;
    if (!m.totalBills) { toast.error("No invoices for the selected month."); return; }
    const [year, mo] = selectedMonth.split("-");
    const label = new Date(`${selectedMonth}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    const salonName = settings?.name || "Toni & Guy Essensuals Gorantla";

    const topServices = Object.entries(m.serviceMap).sort((a,b)=>b[1].total-a[1].total).slice(0,10);
    const topProducts = Object.entries(m.productMap).sort((a,b)=>b[1].total-a[1].total).slice(0,10);
    const staffRows = Object.entries(m.staffMap).sort((a,b)=>b[1].total-a[1].total);

    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Popups blocked. Please allow popups."); return; }

    printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <title>Monthly Report – ${label}</title>
  <style>
    /* Suppress browser default header and footer */
    @page {
      size: A4;
      margin: 0mm !important;
    }
    
    @media print {
      body {
        padding: 15mm 20mm !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .no-print {
        display: none !important;
      }
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #000;
      line-height: 1.4;
      font-size: 11px;
      margin: 0;
      padding: 15mm 20mm;
      background: #fff;
    }

    .header {
      text-align: center;
      margin-bottom: 25px;
    }

    h1 {
      font-size: 20px;
      font-weight: 700;
      margin: 0;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #000;
    }

    .sub {
      font-size: 11px;
      color: #333;
      margin: 6px 0 0 0;
      font-weight: 500;
    }

    .divider {
      height: 1px;
      background: #000;
      margin: 15px 0 25px 0;
    }

    /* Responsive, grid-based cards for KPI metrics */
    .kpi-section {
      margin-bottom: 20px;
      page-break-inside: avoid;
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 12px;
    }

    .kpi {
      border: 1px solid #000;
      padding: 10px;
      border-radius: 4px;
      text-align: center;
      background: #fafafa;
    }

    .kpi-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #444;
      margin-bottom: 4px;
      font-weight: 600;
    }

    .kpi-val {
      font-size: 15px;
      font-weight: bold;
      color: #000;
    }

    h2 {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      border-bottom: 1px solid #000;
      padding-bottom: 4px;
      margin: 25px 0 10px 0;
      letter-spacing: 0.5px;
      page-break-after: avoid;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
      margin-bottom: 15px;
      page-break-inside: auto;
    }

    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }

    th, td {
      border: 1px solid #000;
      padding: 6px 8px;
      text-align: left;
    }

    th {
      font-weight: 700;
      background: #f5f5f5;
    }

    .right {
      text-align: right;
    }

    .footer {
      margin-top: 35px;
      border-top: 1px solid #000;
      padding-top: 10px;
      font-size: 9px;
      color: #555;
      text-align: center;
      page-break-inside: avoid;
    }

    .no-print {
      margin-bottom: 20px;
      text-align: center;
      font-family: sans-serif;
    }

    .no-print button {
      padding: 6px 14px;
      font-weight: bold;
      cursor: pointer;
      border: 1px solid #000;
      background: #fff;
      border-radius: 4px;
    }

    .no-print button:hover {
      background: #000;
      color: #fff;
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">Print / Save PDF</button>
    <button onclick="window.close()" style="margin-left: 10px;">Close Window</button>
  </div>
  
  <div class="header">
    <h1>TONI &amp; GUY</h1>
    <div class="sub">MONTHLY BUSINESS REPORT</div>
    <div class="sub" style="font-size: 10px; color: #444; margin-top: 4px;">
      Essensuals Gorantla &nbsp;|&nbsp; Report Period: ${label} &nbsp;|&nbsp; Date Generated: ${new Date().toLocaleDateString("en-IN", { day: 'numeric', month: 'long', year: 'numeric' })}
    </div>
  </div>
  
  <div class="divider"></div>

  <div class="kpi-section">
    <div class="kpi-grid">
      <div class="kpi">
        <div class="kpi-label">Gross Revenue</div>
        <div class="kpi-val">Rs ${m.totalGross.toLocaleString("en-IN")}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Net Sales</div>
        <div class="kpi-val">Rs ${m.totalNet.toLocaleString("en-IN")}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">GST Collected</div>
        <div class="kpi-val">Rs ${m.totalGST.toLocaleString("en-IN")}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Tips</div>
        <div class="kpi-val">Rs ${m.totalTips.toLocaleString("en-IN")}</div>
      </div>
    </div>
    
    <div class="kpi-grid">
      <div class="kpi">
        <div class="kpi-label">Total Bills</div>
        <div class="kpi-val">${m.totalBills}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Working Days</div>
        <div class="kpi-val">${m.workingDays}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Avg Daily Revenue</div>
        <div class="kpi-val">Rs ${Math.round(m.avgDailyRevenue).toLocaleString("en-IN")}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Avg Bill Value</div>
        <div class="kpi-val">Rs ${m.totalBills ? Math.round(m.totalGross/m.totalBills).toLocaleString("en-IN") : 0}</div>
      </div>
    </div>
  </div>

  <h2>Payment Breakdown</h2>
  <table>
    <thead>
      <tr>
        <th>Method</th>
        <th class="right" style="width: 150px;">Amount (Rs)</th>
        <th class="right" style="width: 120px;">Share (%)</th>
      </tr>
    </thead>
    <tbody>
      ${Object.entries(m.paymentMap).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`
        <tr>
          <td><strong>${k}</strong></td>
          <td class="right">Rs ${v.toLocaleString("en-IN")}</td>
          <td class="right">${m.totalGross?((v/m.totalGross)*100).toFixed(1):0}%</td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <h2>Top Services</h2>
  <table>
    <thead>
      <tr>
        <th>Service Name</th>
        <th class="right" style="width: 100px;">Qty</th>
        <th class="right" style="width: 150px;">Revenue (Rs)</th>
      </tr>
    </thead>
    <tbody>
      ${topServices.map(([k,v])=>`
        <tr>
          <td><strong>${k}</strong></td>
          <td class="right">${v.qty}</td>
          <td class="right">Rs ${v.total.toLocaleString("en-IN")}</td>
        </tr>
      `).join("") || "<tr><td colspan='3' class='right'>No services</td></tr>"}
    </tbody>
  </table>

  ${topProducts.length > 0 ? `
    <h2>Top Products Sold</h2>
    <table>
      <thead>
        <tr>
          <th>Product Name</th>
          <th class="right" style="width: 100px;">Qty</th>
          <th class="right" style="width: 150px;">Revenue (Rs)</th>
        </tr>
      </thead>
      <tbody>
        ${topProducts.map(([k,v])=>`
          <tr>
            <td><strong>${k}</strong></td>
            <td class="right">${v.qty}</td>
            <td class="right">Rs ${v.total.toLocaleString("en-IN")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  ` : ""}

  <h2>Stylist Performance</h2>
  <table>
    <thead>
      <tr>
        <th>Stylist</th>
        <th class="right" style="width: 80px;">Bills</th>
        <th class="right" style="width: 120px;">Services (Rs)</th>
        <th class="right" style="width: 120px;">Products (Rs)</th>
        <th class="right" style="width: 100px;">Tips (Rs)</th>
        <th class="right" style="width: 140px;">Total (Rs)</th>
      </tr>
    </thead>
    <tbody>
      ${staffRows.map(([k,v])=>`
        <tr>
          <td><strong>${k}</strong></td>
          <td class="right">${v.bills}</td>
          <td class="right">Rs ${v.services.toLocaleString("en-IN")}</td>
          <td class="right">Rs ${v.products.toLocaleString("en-IN")}</td>
          <td class="right">Rs ${v.tips.toLocaleString("en-IN")}</td>
          <td class="right"><strong>Rs ${v.total.toLocaleString("en-IN")}</strong></td>
        </tr>
      `).join("") || "<tr><td colspan='6' class='right'>No staff data</td></tr>"}
    </tbody>
  </table>

  <div class="footer">
    Report generated by Essensuals Salon Admin POS. All amounts in INR (Rs).
  </div>
</body>
</html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  // ─── Monthly CSV Export ─────────────────────────────────────────────────────
  const handleMonthlyCSV = () => {
    const m = monthlyData;
    if (!m.totalBills) { toast.error("No invoices for the selected month."); return; }
    const label = new Date(`${selectedMonth}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    const lines = [];
    lines.push(`"MONTHLY BUSINESS REPORT – ${label}"`);
    lines.push(`"Generated","${new Date().toLocaleString("en-IN")}"`);
    lines.push("");
    lines.push(`"Gross Revenue","${m.totalGross}"`);
    lines.push(`"Net Sales","${m.totalNet}"`);
    lines.push(`"GST Collected","${m.totalGST}"`);
    lines.push(`"Tips","${m.totalTips}"`);
    lines.push(`"Total Bills","${m.totalBills}"`);
    lines.push(`"Working Days","${m.workingDays}"`);
    lines.push(`"Avg Daily Revenue","${Math.round(m.avgDailyRevenue)}"`);
    lines.push("");
    lines.push(`"PAYMENT BREAKDOWN"`);
    lines.push(`"Method","Amount"`);
    Object.entries(m.paymentMap).forEach(([k,v]) => lines.push(`"${k}","${v}"`));
    lines.push("");
    lines.push(`"TOP SERVICES"`);
    lines.push(`"Service","Qty","Revenue"`);
    Object.entries(m.serviceMap).sort((a,b)=>b[1].total-a[1].total).forEach(([k,v]) => lines.push(`"${k}","${v.qty}","${v.total}"`));
    lines.push("");
    lines.push(`"STYLIST PERFORMANCE"`);
    lines.push(`"Stylist","Bills","Services","Products","Tips","Total"`);
    Object.entries(m.staffMap).forEach(([k,v]) => lines.push(`"${k}","${v.bills}","${v.services}","${v.products}","${v.tips}","${v.total}"`));
    const uri = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(lines.join("\n"));
    const a = document.createElement("a");
    a.href = uri;
    a.download = `Monthly_Report_${selectedMonth}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Monthly CSV downloaded!");
  };

  const formatDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* ── Tab Switcher ── */}
      <div style={{ display: "flex", gap: "0.75rem", borderBottom: "1px solid var(--a-border)", paddingBottom: "0", flexWrap: "wrap" }}>
        <button
          className={`tbl-btn ${activeTab === "range" ? "active" : ""}`}
          onClick={() => setActiveTab("range")}
          style={{ padding: "0.55rem 1.1rem", fontSize: "0.78rem", borderBottom: activeTab === "range" ? "2px solid var(--gold)" : "2px solid transparent", borderRadius: "0", background: "none" }}
        >
          <FileText size={13} style={{ marginRight: 6 }} />
          Range &amp; EOD Reports
        </button>
        <button
          className={`tbl-btn ${activeTab === "monthly" ? "active" : ""}`}
          onClick={() => setActiveTab("monthly")}
          style={{ padding: "0.55rem 1.1rem", fontSize: "0.78rem", borderBottom: activeTab === "monthly" ? "2px solid var(--gold)" : "2px solid transparent", borderRadius: "0", background: "none" }}
        >
          <BarChart2 size={13} style={{ marginRight: 6 }} />
          Monthly Business Report
        </button>
      </div>

      {/* ──────────────────── RANGE & EOD TAB ────────────────────────────── */}
      {activeTab === "range" && (
        <>
      {/* Date Range Selection & Metrics */}
      <div className="table-wrap">
        <div className="table-header" style={{ paddingBottom: "1.5rem" }}>
          <div>
            <div className="table-title"><Calendar size={15} /> Reports Filter</div>
            <div className="pos-sub">Select custom range for revenue and invoice calculations</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.7rem", color: "#888" }}>From:</span>
              <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: "0.4rem 0.75rem", fontSize: "0.75rem", width: "130px" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.7rem", color: "#888" }}>To:</span>
              <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: "0.4rem 0.75rem", fontSize: "0.75rem", width: "130px" }} />
            </div>
          </div>
        </div>

        <div className="stats-grid" style={{ padding: "1.5rem", background: "rgba(255,255,255,0.01)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="stat-card">
            <div className="stat-label">Net Sales (Subtotal)</div>
            <div className="stat-value" style={{ color: "var(--a-text)" }}>Rs {totals.net.toLocaleString("en-IN")}</div>
            <div className="stat-sub">Before GST and Tips</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">GST Collected</div>
            <div className="stat-value" style={{ color: "var(--a-text)" }}>Rs {totals.gst.toLocaleString("en-IN")}</div>
            <div className="stat-sub">GST tax component</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Tips Received</div>
            <div className="stat-value" style={{ color: "var(--a-text)" }}>Rs {totals.tips.toLocaleString("en-IN")}</div>
            <div className="stat-sub">Stylist tip distributions</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Gross Revenue</div>
            <div className="stat-value" style={{ color: "var(--a-text)", fontWeight: "bold" }}>Rs {totals.gross.toLocaleString("en-IN")}</div>
            <div className="stat-sub">Total amount collected</div>
          </div>
        </div>
      </div>

      {/* Invoices List in Range */}
      <div className="table-wrap">
        <div className="table-header">
          <div className="table-title"><FileText size={15} /> Invoices Summary ({filteredInvoices.length})</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Invoice Number</th>
              <th>Client</th>
              <th>Stylist</th>
              <th style={{ textAlign: "right" }}>Net Amount</th>
              <th style={{ textAlign: "right" }}>GST Tax</th>
              <th style={{ textAlign: "right" }}>Tips</th>
              <th style={{ textAlign: "right" }}>Grand Total</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map((inv) => {
              const netAmt = Number(inv.total || 0) - Number(inv.tax || 0) - Number(inv.tip || 0);
              return (
                <tr key={inv.id}>
                  <td>{inv.billing_at ? inv.billing_at.slice(0, 10) : "—"}</td>
                  <td style={{ fontWeight: 600 }}>{inv.invoice_number}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{inv.client_name}</div>
                    <div style={{ fontSize: "0.65rem", color: "#888" }}>{inv.mobile}</div>
                  </td>
                  <td>
                    {inv.staff_name ? (
                      <span className="badge badge-gold" style={{ padding: "2px 6px" }}>{inv.staff_name}</span>
                    ) : "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>Rs {netAmt.toLocaleString("en-IN")}</td>
                  <td style={{ textAlign: "right" }}>Rs {Number(inv.tax || 0).toLocaleString("en-IN")}</td>
                  <td style={{ textAlign: "right", color: inv.tip > 0 ? "var(--a-text)" : "inherit" }}>Rs {Number(inv.tip || 0).toLocaleString("en-IN")}</td>
                  <td style={{ textAlign: "right", fontWeight: "bold", color: "var(--a-text)" }}>Rs {Number(inv.total || 0).toLocaleString("en-IN")}</td>
                </tr>
              );
            })}
            {!filteredInvoices.length && <tr><td colSpan="8" style={{ textAlign: "center", padding: "2rem", color: "var(--a-faint)" }}>No invoices in this range.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="reports-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
        {/* Unified EOD Control Center */}
        <div className="table-wrap" style={{ gridColumn: "span 2" }}>
          <div className="table-header">
            <div>
              <div className="table-title"><Mail size={15} /> Unified Daily EOD Report</div>
              <div className="pos-sub">Send client lists, services table, attendance and cash logs to both Email and WhatsApp in a unified layout</div>
            </div>
          </div>
          <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div style={{ display: "flex", gap: "1.5rem" }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Report Date</label>
                <input type="date" className="form-input" value={emailReportDate} onChange={e => setEmailReportDate(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Report Format</label>
                <select className="form-input" value={reportFormat} onChange={e => setReportFormat(e.target.value)}>
                  <option value="text">Text (WhatsApp/Email)</option>
                  <option value="pdf">PDF Document (Download/Print)</option>
                  <option value="excel">Excel Spreadsheet (Download)</option>
                  <option value="both">Both PDF & Excel</option>
                </select>
                {(reportFormat === "pdf" || reportFormat === "both") && (
                  <div style={{ fontSize: "0.62rem", color: "var(--gold)", marginTop: "0.3rem", fontStyle: "italic", lineHeight: "1.2" }}>
                    💡 To send the PDF to WhatsApp: 1. Click 'Generate & Print PDF' and save it as a PDF file. 2. Click 'Send EOD text to WhatsApp' to send the text summary. 3. Attach the saved PDF file to that WhatsApp chat.
                  </div>
                )}
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Recipient Email Address</label>
                <input 
                  type="email" 
                  className="form-input" 
                  placeholder="admin@example.com" 
                  value={emailRecipient} 
                  onChange={e => setEmailRecipient(e.target.value)} 
                  disabled={reportFormat !== "text"}
                  style={{ opacity: reportFormat !== "text" ? 0.5 : 1 }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "1rem" }}>
              {reportFormat === "text" && (
                <>
                  <button className="btn-add" onClick={handleSendEmailReport} disabled={sendingEmail} style={{ flex: 1, padding: "0.75rem", background: "transparent", border: "1px solid #c9b99a", color: "#c9b99a" }}>
                    {sendingEmail ? "Preparing Email..." : "Send EOD Email"}
                  </button>
                  <button className="btn-add" onClick={handleSendWhatsappReport} disabled={sendingWhatsapp} style={{ flex: 1, padding: "0.75rem", background: "transparent", border: "1px solid #c9b99a", color: "#c9b99a" }}>
                    {sendingWhatsapp ? "Opening WhatsApp..." : "Send EOD WhatsApp"}
                  </button>
                  <button className="btn-add" onClick={handleSendBothReports} disabled={sendingEmail || sendingWhatsapp} style={{ flex: 1, padding: "0.75rem" }}>
                    Send to Both Channels
                  </button>
                </>
              )}
              {reportFormat === "pdf" && (
                <>
                  <button className="btn-add" onClick={handleExportPDF} style={{ flex: 1, padding: "0.75rem", background: "transparent", border: "1px solid #c9b99a", color: "#c9b99a" }}>
                    Generate & Print PDF
                  </button>
                  <button className="btn-add" onClick={handleSendWhatsappReport} disabled={sendingWhatsapp} style={{ flex: 1, padding: "0.75rem" }}>
                    {sendingWhatsapp ? "Opening WhatsApp..." : "Send EOD text to WhatsApp"}
                  </button>
                </>
              )}
              {reportFormat === "excel" && (
                <button className="btn-add" onClick={handleExportExcel} style={{ flex: 1, padding: "0.75rem" }}>
                  Export Excel Spreadsheet (CSV)
                </button>
              )}
              {reportFormat === "both" && (
                <>
                  <button className="btn-add" onClick={() => { handleExportPDF(); handleExportExcel(); }} style={{ flex: 1, padding: "0.75rem", background: "transparent", border: "1px solid #c9b99a", color: "#c9b99a" }}>
                    Generate PDF & Export Excel
                  </button>
                  <button className="btn-add" onClick={handleSendWhatsappReport} disabled={sendingWhatsapp} style={{ flex: 1, padding: "0.75rem" }}>
                    {sendingWhatsapp ? "Opening WhatsApp..." : "Send EOD text to WhatsApp"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Report Logs */}
      <div className="table-wrap report-log-table">
        <div className="table-header">
          <div className="table-title">Report Logs</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Recipient</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {(reportLogs || []).map((log) => (
              <tr key={log.id}>
                <td>{log.report_type}</td>
                <td>{log.recipient}</td>
                <td><span className="badge badge-confirmed">{log.status}</span></td>
                <td>{new Date(log.created_at).toLocaleString("en-IN")}</td>
              </tr>
            ))}
            {!(reportLogs || []).length && <tr><td colSpan="4" style={{ textAlign: "center", padding: "2rem", color: "var(--a-faint)" }}>No reports logged yet.</td></tr>}
          </tbody>
        </table>
      </div>
      </>
      )}

      {/* ──────────────────── MONTHLY REPORT TAB ─────────────────────────── */}
      {activeTab === "monthly" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

          {/* Header + Controls */}
          <div className="table-wrap">
            <div className="table-header" style={{ flexWrap: "wrap", gap: "1rem", paddingBottom: "1.5rem" }}>
              <div>
                <div className="table-title"><BarChart2 size={15} style={{ marginRight: 6 }} />Monthly Business Report</div>
                <div className="pos-sub">Full month aggregated analytics – revenue, GST, staff & service breakdown</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.72rem", color: "#888" }}>Month:</span>
                  <input
                    type="month"
                    className="form-input"
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                    style={{ padding: "0.4rem 0.75rem", fontSize: "0.75rem", width: "150px" }}
                  />
                </div>
                <button className="btn-add" onClick={handleMonthlyPDF} style={{ padding: "0.45rem 1rem", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <Download size={13} /> Export PDF
                </button>
                <button className="tbl-btn" onClick={handleMonthlyCSV} style={{ padding: "0.45rem 1rem", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem", border: "1px solid var(--a-border)" }}>
                  <Download size={13} /> Export CSV
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="stats-grid" style={{ padding: "1.5rem", borderTop: "1px solid var(--a-border)", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem" }}>
              {[
                { label: "Gross Revenue", value: `Rs ${monthlyData.totalGross.toLocaleString("en-IN")}`, sub: "Total collected" },
                { label: "Net Sales", value: `Rs ${monthlyData.totalNet.toLocaleString("en-IN")}`, sub: "Before GST & tips" },
                { label: "GST Collected", value: `Rs ${monthlyData.totalGST.toLocaleString("en-IN")}`, sub: "5% GST component" },
                { label: "Tips Received", value: `Rs ${monthlyData.totalTips.toLocaleString("en-IN")}`, sub: "Stylist tips" },
                { label: "Total Bills", value: monthlyData.totalBills, sub: `${monthlyData.workingDays} working days` },
                { label: "Avg Daily Revenue", value: `Rs ${Math.round(monthlyData.avgDailyRevenue).toLocaleString("en-IN")}`, sub: "Per working day" },
                { label: "Avg Bill Value", value: `Rs ${monthlyData.totalBills ? Math.round(monthlyData.totalGross / monthlyData.totalBills).toLocaleString("en-IN") : 0}`, sub: "Per invoice" },
              ].map(card => (
                <div key={card.label} className="stat-card" style={{ minWidth: 0 }}>
                  <div className="stat-label" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.label}</div>
                  <div className="stat-value" style={{ color: "var(--a-text)", fontSize: "clamp(1rem, 2.5vw, 1.4rem)" }}>{card.value}</div>
                  <div className="stat-sub">{card.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Breakdown + Top Services */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
            {/* Payment breakdown */}
            <div className="table-wrap">
              <div className="table-header">
                <div className="table-title" style={{ fontSize: "0.9rem" }}>Payment Breakdown</div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Payment Method</th>
                    <th style={{ textAlign: "right" }}>Amount (Rs)</th>
                    <th style={{ textAlign: "right" }}>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(monthlyData.paymentMap).length === 0 && (
                    <tr><td colSpan={3} style={{ textAlign: "center", padding: "2rem", color: "var(--a-muted)" }}>No payments recorded.</td></tr>
                  )}
                  {Object.entries(monthlyData.paymentMap)
                    .sort((a, b) => b[1] - a[1])
                    .map(([method, amt]) => (
                      <tr key={method}>
                        <td style={{ fontWeight: 600 }}>{method}</td>
                        <td style={{ textAlign: "right" }}>Rs {amt.toLocaleString("en-IN")}</td>
                        <td style={{ textAlign: "right", color: "var(--a-muted)" }}>
                          {monthlyData.totalGross ? ((amt / monthlyData.totalGross) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    ))}
                  {Object.keys(monthlyData.paymentMap).length > 0 && (
                    <tr style={{ borderTop: "2px solid var(--a-border)" }}>
                      <td style={{ fontWeight: 700 }}>Total</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>Rs {monthlyData.totalGross.toLocaleString("en-IN")}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>100%</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Top Services */}
            <div className="table-wrap">
              <div className="table-header">
                <div className="table-title" style={{ fontSize: "0.9rem" }}>Top Services</div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Service Name</th>
                    <th style={{ textAlign: "right" }}>Qty</th>
                    <th style={{ textAlign: "right" }}>Revenue (Rs)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(monthlyData.serviceMap).length === 0 && (
                    <tr><td colSpan={3} style={{ textAlign: "center", padding: "2rem", color: "var(--a-muted)" }}>No services this month.</td></tr>
                  )}
                  {Object.entries(monthlyData.serviceMap)
                    .sort((a, b) => b[1].total - a[1].total)
                    .slice(0, 12)
                    .map(([name, s]) => (
                      <tr key={name}>
                        <td style={{ fontWeight: 600 }}>{name}</td>
                        <td style={{ textAlign: "right" }}>{s.qty}</td>
                        <td style={{ textAlign: "right" }}>Rs {s.total.toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Products sold */}
          {Object.keys(monthlyData.productMap).length > 0 && (
            <div className="table-wrap">
              <div className="table-header">
                <div className="table-title" style={{ fontSize: "0.9rem" }}>Products Sold This Month</div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th style={{ textAlign: "right" }}>Qty Sold</th>
                    <th style={{ textAlign: "right" }}>Revenue (Rs)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(monthlyData.productMap)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([name, p]) => (
                      <tr key={name}>
                        <td style={{ fontWeight: 600 }}>{name}</td>
                        <td style={{ textAlign: "right" }}>{p.qty}</td>
                        <td style={{ textAlign: "right" }}>Rs {p.total.toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Stylist Performance */}
          <div className="table-wrap">
            <div className="table-header">
              <div className="table-title" style={{ fontSize: "0.9rem" }}>Stylist Performance – {new Date(`${selectedMonth}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ minWidth: "600px" }}>
                <thead>
                  <tr>
                    <th>Stylist Name</th>
                    <th style={{ textAlign: "right" }}>Bills</th>
                    <th style={{ textAlign: "right" }}>Services (Rs)</th>
                    <th style={{ textAlign: "right" }}>Products (Rs)</th>
                    <th style={{ textAlign: "right" }}>Tips (Rs)</th>
                    <th style={{ textAlign: "right" }}>Total (Rs)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(monthlyData.staffMap).length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "var(--a-muted)" }}>No staff data this month.</td></tr>
                  )}
                  {Object.entries(monthlyData.staffMap)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([name, s]) => (
                      <tr key={name}>
                        <td style={{ fontWeight: 600 }}>{name}</td>
                        <td style={{ textAlign: "right" }}>{s.bills}</td>
                        <td style={{ textAlign: "right" }}>Rs {s.services.toLocaleString("en-IN")}</td>
                        <td style={{ textAlign: "right" }}>Rs {s.products.toLocaleString("en-IN")}</td>
                        <td style={{ textAlign: "right" }}>Rs {s.tips.toLocaleString("en-IN")}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>Rs {s.total.toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Daily Revenue Breakdown */}
          <div className="table-wrap">
            <div className="table-header">
              <div className="table-title" style={{ fontSize: "0.9rem" }}>Daily Revenue Breakdown</div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ minWidth: "400px" }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th style={{ textAlign: "right" }}>Bills</th>
                    <th style={{ textAlign: "right" }}>Gross Revenue (Rs)</th>
                    <th style={{ textAlign: "right" }}>Avg per Bill (Rs)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(monthlyData.dailyMap).length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: "center", padding: "2rem", color: "var(--a-muted)" }}>No daily data this month.</td></tr>
                  )}
                  {Object.entries(monthlyData.dailyMap)
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([day, d]) => (
                      <tr key={day}>
                        <td style={{ fontWeight: 600 }}>{new Date(day + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</td>
                        <td style={{ textAlign: "right" }}>{d.bills}</td>
                        <td style={{ textAlign: "right" }}>Rs {d.gross.toLocaleString("en-IN")}</td>
                        <td style={{ textAlign: "right", color: "var(--a-muted)" }}>Rs {Math.round(d.gross / d.bills).toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                  {Object.keys(monthlyData.dailyMap).length > 0 && (
                    <tr style={{ borderTop: "2px solid var(--a-border)" }}>
                      <td style={{ fontWeight: 700 }}>Monthly Total</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{monthlyData.totalBills}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>Rs {monthlyData.totalGross.toLocaleString("en-IN")}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>Rs {monthlyData.totalBills ? Math.round(monthlyData.totalGross / monthlyData.totalBills).toLocaleString("en-IN") : 0}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
