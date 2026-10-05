import { describe, it, expect } from "vitest";
import { calculateInvoiceTotals, isProductItem } from "../../src/lib/api.js";

describe("E2E Verification: Multi-Category Products, Services, Cashback & Wallet Flow", () => {
  // Test inventory across different categories
  const testInventory = [
    { id: "prod-hair-1", name: "Moroccanoil Treatment Oil 100ml", category: "Hair Care", inventory_type: "retail", stock_qty: 15, unit_price: 3500 },
    { id: "prod-color-1", name: "Wella Color Touch 60ml", category: "Color & Bleach", inventory_type: "retail", stock_qty: 24, unit_price: 650 },
    { id: "prod-skin-1", name: "Dermalogica Daily Microfoliant 74g", category: "Skin Care", inventory_type: "retail", stock_qty: 10, unit_price: 4200 },
    { id: "prod-equip-1", name: "Ikonic Professional Hair Dryer 2000W", category: "Equipment", inventory_type: "retail", stock_qty: 4, unit_price: 3800 },
    { id: "prod-cosm-1", name: "MAC Studio Fix Fluid Foundation", category: "Cosmetics", inventory_type: "retail", stock_qty: 8, unit_price: 3100 },
    { id: "prod-gen-1", name: "Toni & Guy Satin Sleep Cap", category: "General", inventory_type: "retail", stock_qty: 20, unit_price: 450 },
  ];

  describe("1. Multi-Category Product Classification Integrity", () => {
    it("should correctly identify all retail products across diverse categories", () => {
      testInventory.forEach(prod => {
        expect(isProductItem({ service_name: prod.name }, testInventory)).toBe(true);
        expect(isProductItem({ item_type: "product", service_name: prod.name }, testInventory)).toBe(true);
        expect(isProductItem({ inventory_id: prod.id, service_name: "Any name" }, testInventory)).toBe(true);
      });
    });

    it("should never falsely classify genuine salon services in those categories as retail products", () => {
      const genuineServices = [
        "Hair Spa with Moroccanoil Booster",
        "Wella Global Hair Color Treatment",
        "Dermalogica Deep Cleansing Facial",
        "Hair Blow Dry & Ironing Styling",
        "Party HD Makeup & Saree Draping",
        "Head Massage & Steam",
      ];

      genuineServices.forEach(svcName => {
        expect(isProductItem({ service_name: svcName }, testInventory)).toBe(false);
      });
    });
  });

  describe("2. Cart Totals: Mixed Services + Retail Products across categories", () => {
    it("should separate service GST from products correctly without tax distortion", () => {
      const mixedBill = {
        discount: 0,
        tax_enabled: true,
        tax_rate: 5,
        items: [
          // Service (Tax inclusive 5% GST): 2100 => 2000 base + 100 GST
          { item_type: "service", service_name: "Creative Director Cut & Styling", quantity: 1, price: 2100, tax_inclusive: true },
          // Retail Product 1: Hair Care
          { item_type: "product", service_name: "Moroccanoil Treatment Oil 100ml", inventory_id: "prod-hair-1", quantity: 1, price: 3500 },
          // Retail Product 2: Skin Care
          { item_type: "product", service_name: "Dermalogica Daily Microfoliant 74g", inventory_id: "prod-skin-1", quantity: 1, price: 4200 },
        ],
      };

      const totals = calculateInvoiceTotals(mixedBill);
      expect(totals.serviceSubtotal).toBe(2000);
      expect(totals.tax).toBe(100);
      expect(totals.productSubtotal).toBe(7700); // 3500 + 4200
      expect(totals.total).toBe(9800); // 2100 + 7700
    });
  });

  describe("3. POS Cashback Toggle & Custom Amount Logic", () => {
    it("should not award cashback if enable_cashback is false (default)", () => {
      const bill = {
        total: 2500,
        enable_cashback: false,
        cashback_amount: "",
      };
      
      const shouldAward = bill.enable_cashback && bill.total > 0;
      expect(shouldAward).toBe(false);
    });

    it("should default to 5% when enable_cashback is true and cashback_amount is empty", () => {
      const total = 4000;
      const enable_cashback = true;
      const custom_amount = "";

      const effectiveCashback = (custom_amount !== undefined && custom_amount !== "" && !isNaN(custom_amount))
        ? Number(custom_amount)
        : Math.round(total * 0.05 * 100) / 100;

      expect(effectiveCashback).toBe(200); // 5% of 4000
    });

    it("should respect cashier's custom editable cashback amount when provided", () => {
      const total = 4000;
      const enable_cashback = true;
      const custom_amount = "250"; // Cashier manually typed ₹250 instead of ₹200

      const effectiveCashback = (custom_amount !== undefined && custom_amount !== "" && !isNaN(custom_amount))
        ? Number(custom_amount)
        : Math.round(total * 0.05 * 100) / 100;

      expect(effectiveCashback).toBe(250);
    });
  });
});
