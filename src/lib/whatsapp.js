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

/**
 * Message sent TO THE CUSTOMER confirming their booking was received.
 */
export function formatBookingConfirmationMessage(form = {}, settings = {}) {
  const salon = settings.name || "Toni & Guy Essensuals Gorantla";
  const firstName = (form.name || "Valued Guest").split(" ")[0];
  const service = form.service || "your requested service";
  const date = form.date
    ? new Date(form.date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
    : null;
  const time = form.time || null;
  const slotLine = date ? `📅 *Date:* ${date}${time ? `  ⏰ *Time:* ${time}` : ""}` : null;

  const lines = [
    `*${salon.toUpperCase()}*`,
    ``,
    `Hello *${firstName}* 👋,`,
    ``,
    `Thank you for booking with us! We've received your appointment request.`,
    ``,
    `*Your Booking Details:*`,
    `💇 *Service:* ${service}`,
    slotLine,
    ``,
    `Our team will confirm your appointment shortly. If you have any questions, feel free to reach out!`,
    ``,
    `_Toni & Guy Essensuals Gorantla | +91 91002 92525_`,
  ].filter(l => l !== null);

  return lines.join("\n");
}

/**
 * Alert sent TO THE SALON when a new booking arrives via the public form.
 * Only uses emojis that WhatsApp renders correctly on all devices.
 */
export function formatBookingAlertMessage(form = {}) {
  const fullName = form.name || "Unknown";
  const date = form.date
    ? new Date(form.date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
    : "Not specified";
  const time = form.time || "Not specified";

  const lines = [
    `*TONI & GUY ESSENSUALS GORANTLA*`,
    `_Essensuals by Toni&Guy Hairdressing, Gorantla, Guntur_`,
    ``,
    `*New Booking Request* (!)`,
    ``,
    `*Name:* ${fullName}`,
    `*Phone:* ${form.phone || "-"}`,
    `*Service:* ${form.service || "Not specified"}`,
    `*Preferred Date:* ${date}`,
    `*Preferred Time:* ${time}`,
    form.notes ? `*Notes:* ${form.notes}` : null,
    ``,
    `Please follow up with the customer to confirm the appointment.`,
    ``,
    `_Toni & Guy Essensuals Gorantla | +91 91002 92525_`,
  ].filter(l => l !== null);

  return lines.join("\n");
}

/**
 * Admin panel: WhatsApp message sent to a customer about their booking.
 * Only uses emojis that WhatsApp renders correctly on all devices.
 */
export function formatAdminBookingMessage(booking = {}, settings = {}) {
  const salon = settings.name || "Toni & Guy Essensuals Gorantla";
  const fullName = booking.name || "Valued Guest";
  const service = booking.service || "your requested service";
  const date = booking.date
    ? new Date(booking.date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
    : null;
  const time = booking.time || null;
  const stylist = booking.assigned_staff || null;

  const lines = [
    `*${salon.toUpperCase()}*`,
    `_Essensuals by Toni&Guy Hairdressing, Gorantla, Guntur_`,
    ``,
    `Hello *${fullName}*,`,
    ``,
    `We are reaching out regarding your appointment booking with us.`,
    ``,
    `*Appointment Details:*`,
    `- Service: ${service}`,
    date ? `- Date: ${date}` : null,
    time ? `- Time: ${time}` : null,
    stylist ? `- Stylist: ${stylist}` : null,
    ``,
    `We look forward to seeing you! Please let us know if you need to reschedule.`,
    ``,
    `_Toni & Guy Essensuals Gorantla | +91 91002 92525_`,
  ].filter(l => l !== null);

  return lines.join("\n");
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
  msg.push(`Thank you for visiting us on *${visitDate}*!`);
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
  let paymentText = invoice.payment_method || "Cash";
  if (invoice.payment_method === "Cash + UPI" && invoice.transaction_id?.includes("cash:")) {
    const parts = invoice.transaction_id.split("|");
    let c = 0, u = 0;
    parts.forEach(p => {
      if (p.startsWith("cash:")) c = p.replace("cash:", "");
      if (p.startsWith("upi:")) u = p.replace("upi:", "");
    });
    paymentText = `Cash + UPI (Cash: Rs ${c}, UPI: Rs ${u})`;
  }
  msg.push(`*Amount Paid:* Rs ${totalPaid} (${paymentText})`);
  msg.push(`*Invoice:* ${invoice.invoice_number || "—"}`);
  msg.push(``);

  if (isMember) {
    msg.push(`*Membership:* Active Member`);
    if (membershipEndStr) {
      msg.push(`*Valid until:* ${membershipEndStr}`);
    }
    msg.push(``);
  }

  msg.push(`We look forward to seeing you again soon!`);
  msg.push(``);
  msg.push(`*Follow us on Instagram:*`);
  msg.push(instaLink);
  msg.push(``);
  msg.push(`*Find us on Google Maps:*`);
  msg.push(mapsLink);
  msg.push(``);
  msg.push(`_Toni & Guy Essensuals Gorantla | +91 91002 92525_`);

  return msg.join("\n");
}


export function formatEodReportMessage(report, settings = {}, invoices = [], inventory = []) {
  const salon = settings.name || "TONI & GUY ESSENSUALS GORANTLA";
  const date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  
  // 1. Format daily invoice table
  let tableRows = [];
  let totalNet = 0;
  let totalGST = 0;
  let totalTips = 0;
  let totalRevenue = 0;

  // Track staff performance
  const staffStats = {};
  // Track payment modes
  const paymentBreakdown = {};

  if (invoices && invoices.length > 0) {
    invoices.forEach(inv => {
      const clientName = inv.client_name || "—";
      const serviceNames = (inv.invoice_items || [])
        .map(item => `${item.service_name} (${item.staff_name || inv.staff_name || "Stylist"})`)
        .join(", ") || "—";
      const netAmt = Number(inv.total || 0) - Number(inv.tax || 0) - Number(inv.tip || 0);
      const gst = Number(inv.tax || 0);
      const tip = Number(inv.tip || 0);
      const total = Number(inv.total || 0);
      const payment = inv.payment_method || "—";

      totalNet += netAmt;
      totalGST += gst;
      totalTips += tip;
      totalRevenue += total;

      // Group payments
      paymentBreakdown[payment] = (paymentBreakdown[payment] || 0) + total;

      // Compile items per staff member
      (inv.invoice_items || []).forEach(item => {
        const itemStaff = item.staff_name || inv.staff_name || "Unknown Stylist";
        const itemType = item.item_type || "service";
        const displayPrice = itemType === "service" && item.tax_inclusive !== false ? (Number(item.price || 0) / 1.05) : Number(item.price || 0);
        const itemVal = Number(item.quantity || 1) * displayPrice;

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

      // Distribute tips and GST to main stylist
      const mainStylist = inv.staff_name || "Unknown Stylist";
      if (mainStylist) {
        if (!staffStats[mainStylist]) {
          staffStats[mainStylist] = { clients: new Set(), netServices: 0, products: 0, tips: 0, total: 0 };
        }
        staffStats[mainStylist].tips += tip;
        staffStats[mainStylist].total += tip;
      }

      tableRows.push(`${clientName} | ${serviceNames} | Rs ${netAmt} | Rs ${gst} | Rs ${tip} | Rs ${total} | ${payment}`);
    });
  }

  // Format Staff Performance rows
  const staffRows = Object.entries(staffStats).map(([name, stats]) => {
    return `${name} | Clients: ${stats.clients.size} | Services: Rs ${stats.netServices} | Products: Rs ${stats.products} | Tips: Rs ${stats.tips} | Total Contribution: Rs ${stats.total}`;
  });

  // Format Payment Breakdown rows
  const paymentRows = Object.entries(paymentBreakdown).map(([method, amt]) => `${method}: Rs ${amt}`);

  // Format Inventory Alerts
  const lowStock = (inventory || []).filter(item => Number(item.stock_qty) <= Number(item.min_qty));
  const lowStockStr = lowStock.length > 0 
    ? `${lowStock.length} items low on stock (Reorder required)`
    : "All products normal (No alerts)";

  const lines = [
    `==================================================`,
    `${salon.toUpperCase()} - EOD REPORT`,
    `Date: ${date}`,
    `==================================================`,
    `1. SALES INVOICES`,
    `--------------------------------------------------`,
    `Client Name | Services | Net | GST | Tip | Total | Payment`,
    `--------------------------------------------------`,
    tableRows.length > 0 ? tableRows.join("\n") : "No client services recorded today.",
    `--------------------------------------------------`,
    `Total Net Sales: Rs ${totalNet}`,
    `Total GST: Rs ${totalGST}`,
    `Total Tips: Rs ${totalTips}`,
    `Total Gross Revenue: Rs ${totalRevenue}`,
    ``,
    `2. PAYMENT SUMMARY`,
    `--------------------------------------------------`,
    paymentRows.length > 0 ? paymentRows.join("\n") : "No transactions today.",
    ``,
    `3. STAFF SUMMARY`,
    `--------------------------------------------------`,
    staffRows.length > 0 ? staffRows.join("\n") : "No staff activity logs today.",
    ``,
    `4. INVENTORY REPORT`,
    `--------------------------------------------------`,
    `Total Catalog Items: ${(inventory || []).length}`,
    `Alerts: ${lowStockStr}`
  ];

  return lines.join("\n");
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
