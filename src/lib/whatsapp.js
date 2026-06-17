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
  // Use encodeURIComponent but preserve WhatsApp-friendly formatting
  const encodedMsg = encodeURIComponent(message)
    .replace(/%0A/g, "%0A") // keep newlines
    .replace(/%2A/g, "*")   // keep bold asterisks
    .replace(/%5F/g, "_");  // keep italics underscores
  return `https://wa.me/${target}?text=${encodedMsg}`;
}

export function formatInvoiceMessage(invoice, items = [], settings = {}) {
  const salon = "Toni & Guy Essensuals Gorantla";
  const mapsLink = "https://share.google/APJl5CWwP49v7jOCc";
  const instaLink = "https://www.instagram.com/toniandguy_essensual_gorantla/";

  const clientFirstName = (invoice.client_name || "Valued Client").split(" ")[0];

  // Always use billing_at from the saved invoice (IST from server)
  const visitDate = invoice.billing_at
    ? new Date(invoice.billing_at).toLocaleDateString("en-IN", {
        day: "2-digit", month: "long", year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

  // Membership
  const isMember = invoice.customer?.is_member || invoice.is_member;
  const membershipEnd = invoice.customer?.membership_end || invoice.membership_end;
  const membershipEndStr = membershipEnd
    ? new Date(membershipEnd).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  // Services (exclude products from "services" label)
  const serviceItems = items.filter(item => item.item_type !== "product");
  const productItems = items.filter(item => item.item_type === "product");

  const totalPaid = Number(invoice.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

  const msg = [];

  msg.push(`*${salon.toUpperCase()}*`);
  msg.push(`_Essensuals by Toni&Guy Hairdressing, Gorantla Guntur_`);
  msg.push(``);
  msg.push(`Dear *${clientFirstName}*,`);
  msg.push(``);
  msg.push(`Thank you for visiting us on *${visitDate}*! ✂️`);
  msg.push(`We're thrilled to have had the pleasure of serving you.`);
  msg.push(``);

  if (serviceItems.length > 0) {
    msg.push(`*Services enjoyed:*`);
    serviceItems.forEach((item) => {
      const qty = Number(item.quantity || 1);
      msg.push(`  • ${item.service_name}${qty > 1 ? ` x${qty}` : ""}`);
    });
  }

  if (productItems.length > 0) {
    msg.push(``);
    msg.push(`*Products purchased:*`);
    productItems.forEach((item) => {
      const qty = Number(item.quantity || 1);
      msg.push(`  • ${item.service_name}${qty > 1 ? ` x${qty}` : ""}`);
    });
  }

  msg.push(``);
  msg.push(`*Amount Paid:* Rs ${totalPaid} ✅`);
  msg.push(`*Invoice:* ${invoice.invoice_number || "—"}`);
  msg.push(``);

  if (isMember) {
    msg.push(`*Membership:* ⭐ Active Member`);
    if (membershipEndStr) {
      msg.push(`*Valid until:* ${membershipEndStr}`);
    }
    msg.push(``);
  }

  msg.push(`We look forward to seeing you again soon! 💛`);
  msg.push(``);
  msg.push(`📸 *Follow us on Instagram:*`);
  msg.push(instaLink);
  msg.push(``);
  msg.push(`📍 *Find us on Google Maps:*`);
  msg.push(mapsLink);
  msg.push(``);
  msg.push(`_Toni & Guy Essensuals Gorantla | +91 91002 92525_`);

  return msg.join("\n");
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
