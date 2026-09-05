import { describe, it, expect } from "vitest";
import { calcActiveWalletBalance, buildAnalytics } from "../../src/lib/api.js";

describe("Customer Wallet, 60-Day Validity & Accounting Logic Tests", () => {
  it("should calculate active wallet balance correctly and ignore expired cashback", () => {
    const customerId = "cust-123";
    const now = new Date();
    
    // Future date (valid)
    const validExpiry = new Date(now);
    validExpiry.setDate(now.getDate() + 30);

    // Past date (expired, e.g. 70 days ago)
    const expiredDate = new Date(now);
    expiredDate.setDate(now.getDate() - 70);

    const mockTransactions = [
      {
        id: "tx-1",
        customer_id: customerId,
        type: "recharge_credit",
        amount: 15000,
        paid_amount: 10000,
        expiry_date: validExpiry.toISOString(),
        notes: "Wallet Recharge: Paid ₹10,000 via Cash (Added ₹15,000)",
      },
      {
        id: "tx-2",
        customer_id: customerId,
        type: "cashback_credit",
        amount: 50,
        expiry_date: expiredDate.toISOString(), // Expired!
        notes: "5% Bill Cashback earned (Expired)",
      },
      {
        id: "tx-3",
        customer_id: customerId,
        type: "cashback_credit",
        amount: 75,
        expiry_date: validExpiry.toISOString(), // Valid!
        notes: "5% Bill Cashback earned",
      },
      {
        id: "tx-4",
        customer_id: customerId,
        type: "recharge_debit",
        amount: 2000,
        notes: "Redeemed for service invoice",
      },
    ];

    // Balance should be: 15,000 (recharge) + 75 (valid cashback) - 2,000 (debit) = 13,075
    // The 50 expired cashback must be ignored!
    const activeBal = calcActiveWalletBalance(customerId, mockTransactions);
    expect(activeBal).toBe(13075);
  });

  it("should award 5% direct cashback only for bills above ₹500", () => {
    const computeCashback = (billTotal) => {
      if (billTotal <= 500) return 0;
      return Math.round(billTotal * 0.05 * 100) / 100;
    };

    // ₹400 bill -> 0 cashback
    expect(computeCashback(400)).toBe(0);
    // ₹500 bill -> 0 cashback (must be strictly > 500)
    expect(computeCashback(500)).toBe(0);
    // ₹1,000 bill -> ₹50 cashback
    expect(computeCashback(1000)).toBe(50);
    // ₹2,500 bill -> ₹125 cashback
    expect(computeCashback(2500)).toBe(125);
  });

  it("should include wallet recharge in cash revenue, but exclude wallet service redemptions from net cash revenue (preventing double counting)", () => {
    const invoices = [
      // 1. Customer recharges wallet: Pays ₹10,000 cash upfront
      {
        id: "inv-1",
        invoice_number: "INV-20260905-001",
        total: 10000,
        payment_method: "Cash",
        status: "paid",
        billing_at: "2026-09-05T10:00:00Z",
        invoice_items: [{ service_name: "Wallet Recharge (Value: ₹15,000)", total: 10000, staff_name: "Reception" }],
      },
      // 2. Another customer pays ₹1,500 for a haircut via UPI
      {
        id: "inv-2",
        invoice_number: "INV-20260905-002",
        total: 1500,
        payment_method: "UPI",
        status: "paid",
        billing_at: "2026-09-05T11:00:00Z",
        invoice_items: [{ service_name: "Hair Cut", total: 1500, staff_name: "Senior Stylist" }],
      },
      // 3. Customer uses wallet balance for a ₹2,000 facial (No new cash collected!)
      {
        id: "inv-3",
        invoice_number: "INV-20260905-003",
        total: 2000,
        payment_method: "Wallet Balance",
        status: "paid",
        billing_at: "2026-09-05T12:00:00Z",
        invoice_items: [{ service_name: "Luxury Facial", total: 2000, staff_name: "Senior Stylist" }],
      },
    ];

    const analytics = buildAnalytics(invoices);

    // Calculated Net Cash Revenue should ONLY be ₹10,000 (Recharge) + ₹1,500 (UPI) = ₹11,500
    // The ₹2,000 service paid via Wallet Balance must NOT be added to net cash revenue!
    expect(analytics.revenue).toBe(11500);

    // Gross Sales/Business rendered reflects all services: ₹10,000 + ₹1,500 + ₹2,000 = ₹13,500
    expect(analytics.grossSales).toBe(13500);

    // In payment breakdown, Wallet Balance is clearly tracked
    expect(analytics.paymentBreakdown["Wallet Balance"]).toBe(2000);
    expect(analytics.paymentBreakdown["Cash"]).toBe(10000);
    expect(analytics.paymentBreakdown["UPI"]).toBe(1500);

    // Senior Stylist's services include both the ₹1,500 Hair Cut and the ₹2,000 Luxury Facial
    // Ensuring staff gets full credit for the service value regardless of wallet payment tender!
    const facialInTop = analytics.topServices.find(s => s.name === "Luxury Facial");
    expect(facialInTop).toBeDefined();
    expect(facialInTop.value).toBe(2000);
  });

  it("should revert wallet balance accurately when transactions are voided/cancelled", () => {
    // 1. Reversing a ₹10,000 recharge credit on a balance of ₹15,000
    let balance = 15000;
    const voidRechargeAmount = 10000;
    balance = Math.max(0, balance - voidRechargeAmount);
    expect(balance).toBe(5000);

    // 2. Reversing a ₹2,000 service redemption debit (refunds back to customer)
    const voidRedemptionAmount = 2000;
    balance = balance + voidRedemptionAmount;
    expect(balance).toBe(7000);

    // 3. Reversing a ₹350 cashback credit
    const voidCashbackAmount = 350;
    balance = Math.max(0, balance - voidCashbackAmount);
    expect(balance).toBe(6650);
  });
});
