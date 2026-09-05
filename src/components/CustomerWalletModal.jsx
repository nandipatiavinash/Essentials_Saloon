import React, { useState, useEffect, useMemo } from "react";
import { X, Wallet, ArrowDownRight, ArrowUpRight, Clock, PlusCircle, History, Sparkles, CheckCircle2, RotateCcw } from "lucide-react";
import { rechargeCustomerWallet, fetchCustomerWalletHistory, calcActiveWalletBalance, revertWalletTransaction } from "../lib/api";
import toast from "react-hot-toast";

export default function CustomerWalletModal({
  isOpen,
  onClose,
  customer,
  onWalletUpdated,
  walletTransactions = [],
}) {
  const [activeTab, setActiveTab] = useState("history"); // "history" | "recharge"
  const [history, setHistory] = useState(() => {
    return (walletTransactions || []).filter(
      (tx) => tx.customer_id === customer?.id || (customer?.mobile && tx.mobile === customer?.mobile)
    );
  });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [revertingId, setRevertingId] = useState(null);

  // Recharge Form State
  const [payAmount, setPayAmount] = useState("");
  const [walletValue, setWalletValue] = useState("");
  const [expiryMonths, setExpiryMonths] = useState("3");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [customNotes, setCustomNotes] = useState("");
  const [savingRecharge, setSavingRecharge] = useState(false);

  useEffect(() => {
    if (isOpen && customer?.id) {
      loadHistory();
    }
  }, [isOpen, customer?.id]);

  const loadHistory = async () => {
    if (!customer?.id) return;
    setLoadingHistory(true);
    try {
      const data = await fetchCustomerWalletHistory(customer.id);
      setHistory(data || []);
    } catch (err) {
      // Fallback to transactions from context if api fetch fails
      const fallback = (walletTransactions || []).filter(
        (tx) => tx.customer_id === customer.id || (customer.mobile && tx.mobile === customer.mobile)
      );
      setHistory(fallback);
    } finally {
      setLoadingHistory(false);
    }
  };

  const activeBalance = useMemo(() => {
    if (history.length > 0) {
      return calcActiveWalletBalance(customer?.id, history);
    }
    return Number(customer?.wallet_balance || 0);
  }, [customer, history]);

  // Quick helper for preset recharge packs
  const applyPreset = (pay, get, months) => {
    setPayAmount(String(pay));
    setWalletValue(String(get));
    setExpiryMonths(String(months));
  };

  const handleRechargeSubmit = async (e) => {
    e.preventDefault();
    const pay = Number(payAmount);
    const get = Number(walletValue);

    if (!pay || pay <= 0) {
      toast.error("Please enter a valid amount collected");
      return;
    }
    if (!get || get <= 0) {
      toast.error("Please enter a valid amount to add to wallet");
      return;
    }

    setSavingRecharge(true);
    try {
      const result = await rechargeCustomerWallet({
        customer_id: customer?.id,
        mobile: customer?.mobile,
        client_name: customer?.name,
        pay_amount: pay,
        wallet_value: get,
        expiry_months: Number(expiryMonths) > 0 ? Number(expiryMonths) : null,
        payment_method: paymentMethod,
        notes: customNotes.trim() || undefined,
      });

      toast.success(`Successfully recharged ₹${get.toLocaleString()} to wallet!`);
      // Reset form
      setPayAmount("");
      setWalletValue("");
      setCustomNotes("");
      
      // Reload history & notify parent
      await loadHistory();
      if (onWalletUpdated) {
        onWalletUpdated(Number(result.customer?.wallet_balance || activeBalance + get));
      }
      setActiveTab("history");
    } catch (err) {
      toast.error(err.message || "Failed to process wallet recharge");
    } finally {
      setSavingRecharge(false);
    }
  };

  const handleRevertTransaction = async (tx) => {
    let confirmMsg = "Are you sure you want to revert this wallet transaction?";
    const amt = Number(tx.amount || 0).toLocaleString();
    if (tx.type === "recharge_credit") {
      confirmMsg = `Revert this ₹${amt} Wallet Recharge? This will deduct ₹${amt} from the customer's wallet balance and cancel the recharge invoice.`;
    } else if (tx.type === "cashback_credit") {
      confirmMsg = `Cancel this ₹${amt} Cashback Credit? This will deduct ₹${amt} from the customer's wallet balance.`;
    } else if (tx.type === "recharge_debit") {
      confirmMsg = `Revert this ₹${amt} Wallet Redemption? This will refund ₹${amt} back to the customer's wallet balance.`;
    }

    if (!window.confirm(confirmMsg)) return;

    setRevertingId(tx.id);
    try {
      const result = await revertWalletTransaction(tx.id);
      toast.success("Wallet transaction reverted successfully");
      await loadHistory();
      if (onWalletUpdated) {
        onWalletUpdated(result.newBalance);
      }
    } catch (err) {
      toast.error(err.message || "Failed to revert transaction");
    } finally {
      setRevertingId(null);
    }
  };

  if (!isOpen || !customer) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
    >
      <div
        className="modal"
        style={{
          maxWidth: "640px",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 45px -10px rgba(0, 0, 0, 0.2)",
          border: "1px solid var(--a-border)",
          background: "var(--a-surface)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            padding: "1.25rem 1.5rem",
            background: "#ffffff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "4px",
                background: "rgba(201, 185, 154, 0.18)",
                border: "1px solid rgba(201, 185, 154, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#aa820a",
              }}
            >
              <Wallet size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <h3 className="modal-title" style={{ margin: 0, fontSize: "1.3rem" }}>
                  {customer.name || "Client Wallet"}
                </h3>
                {customer.is_member && (
                  <span
                    style={{
                      fontSize: "0.58rem",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      padding: "2px 7px",
                      borderRadius: "2px",
                      background: "rgba(201, 185, 154, 0.15)",
                      color: "#aa820a",
                      border: "1px solid rgba(201, 185, 154, 0.4)",
                      fontWeight: 600,
                    }}
                  >
                    Member
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--a-muted)" }}>
                📱 {customer.mobile}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="modal-close"
            style={{
              padding: "0.4rem",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Balance Highlight Banner */}
        <div
          style={{
            margin: "1.25rem 1.5rem 0.5rem",
            padding: "1.1rem 1.4rem",
            background: "linear-gradient(135deg, rgba(201, 185, 154, 0.12) 0%, rgba(248, 248, 246, 0.9) 100%)",
            border: "1px solid var(--a-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "0.58rem",
                color: "#aa820a",
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                fontWeight: 600,
              }}
            >
              Active Wallet Balance
            </div>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontSize: "2.2rem",
                fontWeight: 500,
                color: "var(--a-dark)",
                lineHeight: 1.1,
                marginTop: "2px",
              }}
            >
              ₹{activeBalance.toLocaleString()}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "0.65rem",
                color: "#2e7d32",
                background: "#e8f5e9",
                padding: "4px 8px",
                borderRadius: "3px",
                fontWeight: 600,
                letterSpacing: "0.04em",
                border: "1px solid rgba(46, 125, 50, 0.2)",
              }}
            >
              <CheckCircle2 size={13} /> Ready to redeem
            </span>
          </div>
        </div>

        {/* Tab Buttons */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            padding: "0.5rem 1.5rem 0",
            borderBottom: "1px solid var(--a-border)",
            background: "#ffffff",
          }}
        >
          <button
            onClick={() => setActiveTab("history")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "0.75rem 1rem",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "history" ? "2px solid var(--a-dark)" : "2px solid transparent",
              color: activeTab === "history" ? "var(--a-dark)" : "var(--a-muted)",
              fontSize: "0.7rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
              fontFamily: "var(--sans)",
            }}
          >
            <History size={15} /> Transaction History
          </button>
          <button
            onClick={() => setActiveTab("recharge")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "0.75rem 1rem",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "recharge" ? "2px solid var(--a-dark)" : "2px solid transparent",
              color: activeTab === "recharge" ? "var(--a-dark)" : "var(--a-muted)",
              fontSize: "0.7rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
              fontFamily: "var(--sans)",
            }}
          >
            <PlusCircle size={15} /> Recharge Wallet
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ padding: "1.25rem 1.5rem", overflowY: "auto", flex: 1, maxHeight: "55vh" }}>
          {activeTab === "history" ? (
            <div>
              {loadingHistory ? (
                <div style={{ textAlign: "center", padding: "2.5rem", color: "var(--a-muted)", fontSize: "0.82rem" }}>
                  Loading wallet history...
                </div>
              ) : history.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "3rem 1.5rem",
                    color: "var(--a-muted)",
                    border: "1px dashed var(--a-border2)",
                    background: "var(--a-bg)",
                  }}
                >
                  <Wallet size={36} style={{ margin: "0 auto 0.75rem", opacity: 0.35, color: "var(--a-faint)" }} />
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--a-text)", fontWeight: 600 }}>
                    No wallet transactions recorded yet.
                  </p>
                  <p style={{ margin: "0.35rem 0 1.25rem", fontSize: "0.75rem", color: "var(--a-muted)" }}>
                    Recharge wallet or complete a bill &gt; ₹500 to earn 5% cashback.
                  </p>
                  <button
                    onClick={() => setActiveTab("recharge")}
                    className="btn-add"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <PlusCircle size={14} /> Recharge Now
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                  {history.map((tx) => {
                    const isCredit =
                      tx.type === "recharge_credit" ||
                      tx.type === "cashback_credit" ||
                      tx.type === "adjustment";
                    const isExpired = tx.expiry_date && new Date(tx.expiry_date) < new Date();

                    return (
                      <div
                        key={tx.id}
                        style={{
                          padding: "0.85rem 1rem",
                          background: "#ffffff",
                          border: "1px solid var(--a-border)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.35rem",
                          transition: "background 0.15s",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                            <div
                              style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "3px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: isCredit
                                  ? "rgba(46, 125, 50, 0.09)"
                                  : "rgba(183, 28, 28, 0.08)",
                                color: isCredit ? "#2e7d32" : "#b71c1c",
                              }}
                            >
                              {isCredit ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                            </div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <span
                                  style={{
                                    fontSize: "0.8rem",
                                    fontWeight: 600,
                                    color: "var(--a-text)",
                                  }}
                                >
                                  {tx.type === "recharge_credit" && "Wallet Recharge Credit"}
                                  {tx.type === "cashback_credit" && "5% Bill Cashback Credit"}
                                  {tx.type === "recharge_debit" && "Service Payment Redemption"}
                                  {tx.type === "wallet_expire" && "Balance Expired"}
                                  {tx.type === "adjustment" && "Admin Adjustment"}
                                </span>
                                {isExpired && (
                                  <span
                                    style={{
                                      fontSize: "0.58rem",
                                      letterSpacing: "0.08em",
                                      textTransform: "uppercase",
                                      padding: "1px 5px",
                                      borderRadius: "2px",
                                      background: "#fce4ec",
                                      color: "#b71c1c",
                                      fontWeight: 600,
                                    }}
                                  >
                                    Expired
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: "0.7rem", color: "var(--a-faint)" }}>
                                {new Date(tx.created_at).toLocaleString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <div
                              style={{
                                fontSize: "0.95rem",
                                fontWeight: 700,
                                color: isCredit ? "#2e7d32" : "#b71c1c",
                              }}
                            >
                              {isCredit ? "+" : "-"}₹{Number(tx.amount || 0).toLocaleString()}
                            </div>
                            {tx.paid_amount > 0 && (
                              <span style={{ fontSize: "0.68rem", color: "var(--a-muted)" }}>
                                Paid: ₹{Number(tx.paid_amount).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Transaction Note / Message */}
                        {tx.notes && (
                          <div
                            style={{
                              marginTop: "2px",
                              padding: "0.4rem 0.65rem",
                              background: "var(--a-bg)",
                              border: "1px solid var(--a-border)",
                              fontSize: "0.74rem",
                              color: "var(--a-text)",
                              lineHeight: 1.35,
                            }}
                          >
                            <span style={{ color: "#aa820a", fontWeight: 600 }}>Note: </span>
                            {tx.notes}
                          </div>
                        )}

                        {/* Expiry details & Revert Action */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: "0.5rem",
                            marginTop: "4px",
                            paddingTop: "4px",
                            borderTop: "1px dashed var(--a-border)",
                          }}
                        >
                          {tx.expiry_date ? (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "0.7rem",
                                color: isExpired ? "#b71c1c" : "#856404",
                              }}
                            >
                              <Clock size={12} />
                              <span>
                                {isExpired ? "Expired on " : "Valid until "}
                                {new Date(tx.expiry_date).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: "0.68rem", color: "var(--a-faint)" }}>
                              {tx.type === "recharge_debit" ? "Debit deduction" : "Standard credit"}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleRevertTransaction(tx)}
                            disabled={revertingId === tx.id}
                            className="tbl-btn danger"
                            style={{
                              padding: "2px 8px",
                              fontSize: "0.62rem",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              cursor: revertingId === tx.id ? "not-allowed" : "pointer",
                              opacity: revertingId === tx.id ? 0.6 : 1,
                            }}
                            title="Revert / Void this transaction if entered by mistake"
                          >
                            <RotateCcw size={11} /> {revertingId === tx.id ? "Reverting..." : "Revert / Void"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Recharge Form */
            <form onSubmit={handleRechargeSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Quick Presets */}
              <div>
                <label className="form-label" style={{ marginBottom: "0.4rem" }}>
                  Quick Preset Packages
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => applyPreset(10000, 15000, 3)}
                    style={{
                      padding: "0.65rem 0.5rem",
                      background: "#fdfbf7",
                      border: "1px solid var(--a-border)",
                      color: "var(--a-text)",
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#aa820a" }}>Pay ₹10k → Get ₹15k</div>
                    <div style={{ fontSize: "0.65rem", color: "var(--a-muted)", marginTop: "2px" }}>3 Months Expiry</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset(5000, 7500, 2)}
                    style={{
                      padding: "0.65rem 0.5rem",
                      background: "#fdfbf7",
                      border: "1px solid var(--a-border)",
                      color: "var(--a-text)",
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#aa820a" }}>Pay ₹5k → Get ₹7.5k</div>
                    <div style={{ fontSize: "0.65rem", color: "var(--a-muted)", marginTop: "2px" }}>2 Months Expiry</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset(20000, 32000, 6)}
                    style={{
                      padding: "0.65rem 0.5rem",
                      background: "#fdfbf7",
                      border: "1px solid var(--a-border)",
                      color: "var(--a-text)",
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#aa820a" }}>Pay ₹20k → Get ₹32k</div>
                    <div style={{ fontSize: "0.65rem", color: "var(--a-muted)", marginTop: "2px" }}>6 Months Expiry</div>
                  </button>
                </div>
              </div>

              {/* Amount Inputs */}
              <div className="form-row">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    Amount Collected (₹) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 10000"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    required
                    className="form-input"
                    style={{ fontSize: "0.9rem", fontWeight: 600 }}
                  />
                  <span style={{ fontSize: "0.68rem", color: "var(--a-muted)", marginTop: "3px", display: "block" }}>
                    Real cash / collection in hand
                  </span>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    Amount Added to Wallet (₹) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 15000"
                    value={walletValue}
                    onChange={(e) => setWalletValue(e.target.value)}
                    required
                    className="form-input"
                    style={{ fontSize: "0.9rem", fontWeight: 700, color: "#aa820a" }}
                  />
                  <span style={{ fontSize: "0.68rem", color: "var(--a-muted)", marginTop: "3px", display: "block" }}>
                    Total credit balance granted
                  </span>
                </div>
              </div>

              {/* Expiry & Payment Method */}
              <div className="form-row">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    Validity / Expiry
                  </label>
                  <select
                    value={expiryMonths}
                    onChange={(e) => setExpiryMonths(e.target.value)}
                    className="form-input"
                  >
                    <option value="1">1 Month</option>
                    <option value="2">2 Months</option>
                    <option value="3">3 Months</option>
                    <option value="4">4 Months</option>
                    <option value="5">5 Months</option>
                    <option value="6">6 Months</option>
                    <option value="0">No Expiry</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="form-input"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Card">Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              {/* Transaction Note */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Custom Transaction Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Special festive recharge offer"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  className="form-input"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={savingRecharge}
                className="btn-add"
                style={{
                  marginTop: "0.25rem",
                  padding: "0.85rem 1.25rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  fontSize: "0.68rem",
                  letterSpacing: "0.16em",
                  width: "100%",
                }}
              >
                {savingRecharge ? (
                  "Processing Recharge..."
                ) : (
                  <>
                    <Sparkles size={16} /> Confirm Recharge &amp; Collect ₹{Number(payAmount || 0).toLocaleString()}
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
