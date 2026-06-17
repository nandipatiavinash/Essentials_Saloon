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
  const branchName = "Essensuals by Toni&Guy Hairdressing, Gorantla Guntur";
  const mapsLink = "https://share.google/APJl5CWwP49v7jOCc";
  const instaLink = "https://www.instagram.com/toniandguy_essensual_gorantla/";
  const website = window.location.origin || "https://essensuals-gorantla.com";

  // Check if client is a member
  const isMember = invoice.customer?.is_member || invoice.is_member;
  const tier = invoice.customer?.membership_tier || invoice.membership_tier || "Regular";
  const memberText = isMember ? `Active ${tier} Member` : "Non-Member";

  const dateStr = invoice.billing_at 
    ? new Date(invoice.billing_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })
    : new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });

  let msg = [];
  msg.push(`*${salon.toUpperCase()}*`);
  msg.push(`_${branchName}_`);
  msg.push(`Phone: +91 91002 92525`);
  msg.push(`==========================`);
  msg.push(`*INVOICE RECEIPT*`);
  msg.push(`==========================`);
  msg.push(`*Receipt No:* ${invoice.invoice_number}`);
  msg.push(`*Date:* ${dateStr}`);
  msg.push(`*Client:* ${invoice.client_name}`);
  msg.push(`*Phone:* +91 ${invoice.mobile}`);
  msg.push(`*Membership:* ${memberText}`);
  if (invoice.staff_name) {
    msg.push(`*Stylist:* ${invoice.staff_name}`);
  }
  msg.push(`--------------------------`);
  
  if (items.length) {
    msg.push(`*SERVICES RENDERED:*`);
    items.forEach((item) => {
      const priceVal = Number(item.price).toLocaleString("en-IN", { minimumFractionDigits: 2 });
      const totalVal = Number(item.total || (item.quantity * item.price)).toLocaleString("en-IN", { minimumFractionDigits: 2 });
      msg.push(`- *${item.service_name}*`);
      msg.push(`  ${item.quantity} x Rs ${priceVal} = *Rs ${totalVal}*`);
    });
    msg.push(`--------------------------`);
  }

  const subtotalVal = Number(invoice.subtotal || 0);
  const discountVal = Number(invoice.discount || 0);
  const taxableVal = Math.max(subtotalVal - discountVal, 0);
  const taxVal = Number(invoice.tax || 0);
  const tipVal = Number(invoice.tip || 0);
  const totalVal = Number(invoice.total || 0);

  const subtotal = subtotalVal.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const discount = discountVal.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const taxable = taxableVal.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const tax = taxVal.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const tip = tipVal.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const total = totalVal.toLocaleString("en-IN", { minimumFractionDigits: 2 });

  msg.push(`*BILL SUMMARY:*`);
  msg.push(`*Subtotal:* Rs ${subtotal}`);
  if (discountVal > 0) {
    msg.push(`*Discount:* -Rs ${discount}`);
  }
  msg.push(`*Net Amount:* Rs ${taxable}`);
  if (taxVal > 0) {
    msg.push(`*GST (5%):* Rs ${tax}`);
  } else {
    msg.push(`*GST:* Rs 0.00 (Exempted)`);
  }
  if (tipVal > 0) {
    msg.push(`*Tip:* Rs ${tip}`);
  }
  msg.push(`*Grand Total:* *Rs ${total}*`);
  msg.push(`*Payment Method:* ${invoice.payment_method}`);
  msg.push(`==========================`);
  msg.push(`Thank you for choosing *Toni & Guy Essensuals Gorantla*!`);
  msg.push(`We look forward to styling you again soon.`);
  msg.push(``);
  msg.push(`*Follow us on Instagram:*`);
  msg.push(instaLink);
  msg.push(``);
  msg.push(`*Find us on Google Maps:*`);
  msg.push(mapsLink);
  msg.push(``);
  msg.push(`*Visit our Website:*`);
  msg.push(website);

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
