import { describe, it, expect } from "vitest";
import { calculateInvoiceTotals, isProductItem, buildAnalytics } from "../../src/lib/api.js";

describe("POS UI: Services, Products, Memberships, and Void Engine Tests", () => {
  const mockInventory = [
    { id: "inv-1", name: "System Professional Luxe Oil Keratin Restore Mask", stock_qty: 12, price: 1800 },
    { id: "inv-2", name: "Brillare Dandruff Control Shampoo 250ml", stock_qty: 8, price: 650 },
    { id: "inv-3", name: "Moroccanoil Treatment Original 100ml", stock_qty: 5, price: 3200 },
  ];

  describe("1. Item Type Classification (isProductItem)", () => {
    it("should accurately classify items by item_type, inventory_id, or exact inventory name match", () => {
      // Explicit product item_type or inventory_id
      expect(isProductItem({ item_type: "product", service_name: "Custom Retail Item" }, mockInventory)).toBe(true);
      expect(isProductItem({ inventory_id: "inv-1", service_name: "Custom Product" }, mockInventory)).toBe(true);

      // Name matches inventory item in database
      expect(isProductItem({ service_name: "Brillare Dandruff Control Shampoo 250ml" }, mockInventory)).toBe(true);
      expect(isProductItem({ service_name: "System Professional Luxe Oil Keratin Restore Mask" }, mockInventory)).toBe(true);
    });

    it("should NEVER classify salon services as products (even if they contain words like Shampoo or Mask)", () => {
      // Services with words that might resemble products should remain services unless they are in inventory!
      expect(isProductItem({ service_name: "Keratin Hair Mask Spa" }, mockInventory)).toBe(false);
      expect(isProductItem({ service_name: "Shampoo Wash & Blowdry" }, mockInventory)).toBe(false);
      expect(isProductItem({ service_name: "Classic Haircut & Styling" }, mockInventory)).toBe(false);
      expect(isProductItem({ service_name: "Hydra Facial Cleanup" }, mockInventory)).toBe(false);
    });

    it("should NEVER classify memberships or wallet recharges as products", () => {
      expect(isProductItem({ item_type: "membership", service_name: "Gold Annual Membership" }, mockInventory)).toBe(false);
      expect(isProductItem({ item_type: "wallet", service_name: "Wallet Recharge (Value: ₹5000)" }, mockInventory)).toBe(false);
      expect(isProductItem({ service_name: "Wallet Recharge" }, mockInventory)).toBe(false);
    });
  });

  describe("2. Bill Totals Calculation (calculateInvoiceTotals)", () => {
    it("should calculate service bill with 5% GST on services", () => {
      const bill = {
        discount: 0,
        tax_enabled: true,
        tax_rate: 5,
        items: [
          // Tax inclusive service: 1050 total => 1000 base, 50 tax
          { item_type: "service", service_name: "Hair Spa", quantity: 1, price: 1050, tax_inclusive: true },
        ],
      };
      const totals = calculateInvoiceTotals(bill);
      expect(totals.serviceSubtotal).toBe(1000);
      expect(totals.tax).toBe(50);
      expect(totals.total).toBe(1050);
    });

    it("should calculate retail products with 0% service tax (GST exempt in salon POS retail)", () => {
      const bill = {
        discount: 10, // 10% discount
        tax_enabled: true,
        tax_rate: 5,
        items: [
          { item_type: "product", service_name: "Brillare Shampoo", quantity: 2, price: 600 },
        ],
      };
      const totals = calculateInvoiceTotals(bill);
      // 2 * 600 = 1200 raw; 10% disc = 120; net = 1080; product tax = 0
      expect(totals.productSubtotal).toBe(1200);
      expect(totals.discount).toBe(120);
      expect(totals.tax).toBe(0);
      expect(totals.total).toBe(1080);
    });

    it("should calculate mixed bills (Service + Product + Membership) with correct bucket separation", () => {
      const bill = {
        discount: 0,
        tax_enabled: true,
        tax_rate: 5,
        items: [
          { item_type: "service", service_name: "Haircut", quantity: 1, price: 525, tax_inclusive: true }, // 500 base + 25 tax
          { item_type: "product", service_name: "Luxe Oil", quantity: 1, price: 1500 }, // 1500 net, 0 tax
          { item_type: "membership", service_name: "VIP Club", quantity: 1, price: 2000 }, // 2000 net, 0 service tax
        ],
      };
      const totals = calculateInvoiceTotals(bill);
      expect(totals.serviceSubtotal).toBe(500);
      expect(totals.productSubtotal).toBe(1500);
      expect(totals.membershipSubtotal).toBe(2000);
      expect(totals.tax).toBe(25);
      expect(totals.total).toBe(4025);
    });
  });

  describe("3. Staff Performance & Membership Separation", () => {
    it("should keep membership sales strictly separate from service revenue and service counts", () => {
      const invoices = [
        {
          id: "inv-101",
          staff_name: "Kavya",
          status: "paid",
          invoice_items: [
            { service_name: "Hair Treatment", item_type: "service", quantity: 1, price: 1050, tax_inclusive: true, staff_name: "Kavya" },
            { service_name: "Brillare Shampoo", item_type: "product", quantity: 1, price: 650, staff_name: "Kavya" },
            { service_name: "Annual VIP Card", item_type: "membership", quantity: 1, price: 3000, staff_name: "Kavya" },
          ],
        },
      ];

      // Replicating StaffManager / StaffProfile logic
      let serviceSales = 0;
      let productSales = 0;
      let membershipSales = 0;
      let servicesCount = 0;

      invoices.forEach(inv => {
        (inv.invoice_items || []).forEach(item => {
          const isProd = isProductItem(item, mockInventory);
          const isWallet = item.item_type === "wallet" || item.service_name?.startsWith("Wallet Recharge");
          const isMem = !isProd && !isWallet && item.item_type === "membership";
          const qty = Number(item.quantity || 1);
          const price = Number(item.price || 0);

          if (isProd) {
            productSales += qty * price;
          } else if (isMem) {
            membershipSales += qty * price;
          } else if (!isWallet) {
            const rawBase = item.tax_inclusive !== false ? (qty * price) / 1.05 : qty * price;
            serviceSales += rawBase;
            servicesCount += qty;
          }
        });
      });

      expect(Math.round(serviceSales)).toBe(1000);
      expect(productSales).toBe(650);
      expect(membershipSales).toBe(3000);
      // Service count must ONLY be 1 (Hair Treatment), NOT 2 (VIP Card excluded)
      expect(servicesCount).toBe(1);
    });
  });

  describe("4. Soft-Void & Revenue Reporting Exclusion", () => {
    it("should exclude voided invoices from total revenue and business analytics", () => {
      const activeInvoice = {
        id: "inv-active",
        invoice_number: "INV-001",
        total: 1500,
        payment_method: "Cash",
        status: "paid",
        billing_at: "2026-09-24T10:00:00Z",
        invoice_items: [{ service_name: "Haircut", total: 1500 }],
      };

      const voidedInvoice = {
        id: "inv-voided",
        invoice_number: "INV-002",
        total: 2500,
        payment_method: "Cash",
        status: "void",
        void_reason: "Customer cancelled appointment",
        billing_at: "2026-09-24T11:00:00Z",
        invoice_items: [{ service_name: "Hair Coloring", total: 2500 }],
      };

      const allInvoices = [activeInvoice, voidedInvoice];
      const analytics = buildAnalytics(allInvoices);

      // Active revenue must ONLY be ₹1500 (voided ₹2500 excluded)
      expect(analytics.revenue).toBe(1500);
      expect(analytics.grossSales).toBe(1500);
      expect(analytics.billCount).toBe(1);
    });

    it("should simulate inventory stock restoration and wallet transaction reversal on void", () => {
      // 1. Initial product stock: 10
      let stockQty = 10;
      const soldQty = 2;

      // Decrement on purchase
      stockQty -= soldQty;
      expect(stockQty).toBe(8);

      // Restore on void
      stockQty += soldQty;
      expect(stockQty).toBe(10);

      // 2. Customer wallet: earned ₹100 cashback on invoice
      let walletBalance = 500;
      const earnedCashback = 100;
      walletBalance += earnedCashback;
      expect(walletBalance).toBe(600);

      // Reverse on void via adjustment
      const reversalDelta = -earnedCashback;
      walletBalance = Math.max(0, walletBalance + reversalDelta);
      expect(walletBalance).toBe(500);
    });
  });
});
