import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import CustomerWalletModal from "../../src/components/CustomerWalletModal.jsx";

describe("CustomerWalletModal Frontend UI Component Tests", () => {
  const sampleCustomer = {
    id: "cust-ui-001",
    name: "Priya Sharma",
    mobile: "9876543210",
    wallet_balance: 15000,
    is_member: true,
  };

  const sampleTransactions = [
    {
      id: "tx-ui-1",
      customer_id: "cust-ui-001",
      mobile: "9876543210",
      type: "recharge_credit",
      amount: 15000,
      paid_amount: 10000,
      bonus_amount: 5000,
      expiry_date: "2026-12-05T00:00:00.000Z",
      notes: "Wallet Recharge: Paid ₹10,000 via Cash (Added ₹15,000 Wallet Balance) | Expiry: 3 Months",
      created_at: "2026-09-05T10:00:00.000Z",
    },
    {
      id: "tx-ui-2",
      customer_id: "cust-ui-001",
      mobile: "9876543210",
      type: "cashback_credit",
      amount: 100,
      paid_amount: 0,
      bonus_amount: 100,
      expiry_date: "2026-11-04T00:00:00.000Z",
      notes: "5% Bill Cashback earned on Invoice #INV-20260905-001 (Bill: ₹2,000) | Valid 60 days",
      created_at: "2026-09-05T11:00:00.000Z",
    },
    {
      id: "tx-ui-3",
      customer_id: "cust-ui-001",
      mobile: "9876543210",
      type: "recharge_debit",
      amount: 2000,
      notes: "Redeemed ₹2,000 Wallet Balance for Invoice #INV-20260905-002",
      created_at: "2026-09-05T12:00:00.000Z",
    },
  ];

  it("should render null/empty string when modal is closed (isOpen=false)", () => {
    const html = renderToString(
      React.createElement(CustomerWalletModal, {
        isOpen: false,
        onClose: () => {},
        customer: sampleCustomer,
        walletTransactions: sampleTransactions,
      })
    );
    expect(html).toBe("");
  });

  it("should render client name, mobile, and active wallet balance badge when modal is open", () => {
    const html = renderToString(
      React.createElement(CustomerWalletModal, {
        isOpen: true,
        onClose: () => {},
        customer: sampleCustomer,
        walletTransactions: sampleTransactions,
      })
    );

    // Verify Customer Info renders
    expect(html).toContain("Priya Sharma");
    expect(html).toContain("9876543210");
    expect(html).toContain("Active Wallet Balance");
    expect(html).toContain("Ready to redeem");

    // Verify Tab options
    expect(html).toContain("Transaction History");
    expect(html).toContain("Recharge Wallet");
  });

  it("should display transaction history with badges and clear human-readable transaction notes", () => {
    const html = renderToString(
      React.createElement(CustomerWalletModal, {
        isOpen: true,
        onClose: () => {},
        customer: sampleCustomer,
        walletTransactions: sampleTransactions,
      })
    );

    // Verify Transaction Note is displayed
    expect(html).toContain("Wallet Recharge: Paid ₹10,000 via Cash (Added ₹15,000 Wallet Balance)");
    expect(html).toContain("5% Bill Cashback earned on Invoice #INV-20260905-001");
    expect(html).toContain("Redeemed ₹2,000 Wallet Balance for Invoice #INV-20260905-002");

    // Verify transaction type headers
    expect(html).toContain("Wallet Recharge Credit");
    expect(html).toContain("5% Bill Cashback Credit");
    expect(html).toContain("Service Payment Redemption");

    // Verify amounts
    expect(html).toContain("15,000");
    expect(html).toContain("100");
    expect(html).toContain("2,000");
  });
});
