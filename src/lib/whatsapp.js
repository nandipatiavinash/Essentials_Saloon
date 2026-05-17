const PROVIDERS = {
  twilio: "Twilio WhatsApp API",
  meta: "Meta WhatsApp Cloud API",
};

export function getWhatsAppProvider(settings = {}) {
  return {
    provider: settings.whatsapp_provider || "meta",
    label: PROVIDERS[settings.whatsapp_provider] || PROVIDERS.meta,
    businessNumber: settings.whatsapp || "",
    eodTime: settings.eod_report_time || "21:00",
    reportRecipients: String(settings.report_recipients || settings.whatsapp || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

export function buildWhatsAppLink(phone, message) {
  const digits = String(phone || "").replace(/\D/g, "");
  const target = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${target}?text=${encodeURIComponent(message)}`;
}

export function formatInvoiceMessage(invoice, items = [], settings = {}) {
  const salon = settings.name || "Essensuals Salon";
  const lines = [
    `${salon} invoice`,
    `Bill: ${invoice.invoice_number}`,
    `Client: ${invoice.client_name}`,
    `Total: Rs ${Number(invoice.total || 0).toLocaleString("en-IN")}`,
    `Payment: ${invoice.payment_method}`,
  ];
  if (items.length) {
    lines.push("", "Services:");
    items.forEach((item) => {
      lines.push(`- ${item.service_name} x${item.quantity}: Rs ${Number(item.total || 0).toLocaleString("en-IN")}`);
    });
  }
  lines.push("", "Thank you for visiting.");
  return lines.join("\n");
}

export function formatEodReportMessage(report, settings = {}) {
  const salon = settings.name || "Essensuals Salon";
  const date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const payments = Object.entries(report.paymentBreakdown || {})
    .map(([method, total]) => `${method}: Rs ${Number(total).toLocaleString("en-IN")}`)
    .join("\n");
  const services = (report.topServices || [])
    .slice(0, 5)
    .map((item, index) => `${index + 1}. ${item.name} - Rs ${Number(item.value).toLocaleString("en-IN")}`)
    .join("\n");

  return [
    `${salon} EOD report`,
    date,
    "",
    `Revenue: Rs ${Number(report.todayRevenue || 0).toLocaleString("en-IN")}`,
    `Bills: ${report.todayBills || report.billCount || 0}`,
    `Average bill: Rs ${Number(report.averageBill || 0).toLocaleString("en-IN")}`,
    "",
    "Payment breakdown",
    payments || "No payments recorded",
    "",
    "Top services",
    services || "No service sales recorded",
    "",
    `Peak hour: ${report.peakHour || "Not enough data"}`,
    `New customers: ${report.newCustomers || 0}`,
    `Repeat customers: ${report.repeatCustomers || 0}`,
  ].join("\n");
}

export async function sendWhatsAppMessage({ to, message, settings = {} }) {
  const provider = getWhatsAppProvider(settings);
  return {
    provider: provider.provider,
    status: "queued_for_provider",
    to,
    message,
    nextStep: `Connect ${provider.label} credentials in a server function before sending production messages.`,
  };
}
