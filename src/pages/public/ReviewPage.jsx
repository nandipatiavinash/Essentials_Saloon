import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchInvoiceByReviewToken, submitReview } from "../../lib/api";

export default function ReviewPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) {
      setErrorMsg("Invalid review link. Please check your SMS/WhatsApp message.");
      setLoading(false);
      return;
    }

    fetchInvoiceByReviewToken(token)
      .then((data) => {
        if (!data) {
          setErrorMsg("Review link has expired or is invalid.");
        } else {
          setInvoice(data);
        }
      })
      .catch((err) => {
        console.error("Error loading invoice review data", err);
        setErrorMsg("Failed to load invoice details. Please refresh the page.");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      alert("Please select a star rating first!");
      return;
    }
    setSubmitting(true);
    try {
      const services = (invoice.invoice_items || []).map(i => i.service_name);
      await submitReview({
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        customer_id: invoice.customer_id,
        client_name: invoice.client_name,
        mobile: invoice.mobile,
        rating,
        comment,
        staff_name: invoice.staff_name,
        service_names: services,
        review_token: token
      });
      setSubmitted(true);
    } catch (err) {
      if (err.message?.includes("unique") || err.code === "23505") {
        setSubmitted(true); // Treat duplicate submission as successful thank-you state
      } else {
        alert("Failed to submit review: " + err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#faf7f2", fontFamily: "sans-serif", color: "#888" }}>
        Loading review page...
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#faf7f2", padding: "1rem", fontFamily: "sans-serif" }}>
        <div style={{ background: "#fff", padding: "2rem", borderRadius: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)", maxWidth: "420px", width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
          <h3 style={{ margin: "0 0 0.5rem", color: "#1a1a1a" }}>Link Error</h3>
          <p style={{ color: "#666", fontSize: "0.9rem", lineHeight: "1.4", margin: 0 }}>{errorMsg}</p>
        </div>
      </div>
    );
  }

  const clientFirstName = (invoice?.client_name || "Guest").split(" ")[0];
  const visitDate = invoice?.billing_at
    ? new Date(invoice.billing_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "";

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#faf7f2", padding: "1.5rem", fontFamily: "sans-serif" }}>
      <div style={{ background: "#fff", padding: "2rem", borderRadius: "16px", boxShadow: "0 6px 30px rgba(0,0,0,0.05)", maxWidth: "460px", width: "100%" }}>
        
        {/* Salon Branding */}
        <div style={{ textAlign: "center", borderBottom: "1px solid #f0eae0", paddingBottom: "1.25rem", marginBottom: "1.5rem" }}>
          <h2 style={{ margin: "0 0 0.25rem", fontFamily: "Georgia, serif", color: "#c9a84c", letterSpacing: "0.05em", fontSize: "1.4rem" }}>
            ESSENSUALS
          </h2>
          <span style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#999" }}>
            Toni & Guy hairdressing · Gorantla
          </span>
        </div>

        {submitted ? (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem", color: "#c9a84c" }}>⭐</div>
            <h3 style={{ margin: "0 0 0.5rem", color: "#1a1a1a", fontSize: "1.25rem" }}>
              Thank You, {clientFirstName}!
            </h3>
            <p style={{ color: "#666", fontSize: "0.88rem", lineHeight: "1.5", marginBottom: "1.5rem" }}>
              Your rating of {rating} star{rating !== 1 ? "s" : ""} has been saved. We appreciate you taking the time to share your feedback!
            </p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", background: "#faf8f5", padding: "1rem", borderRadius: "8px", border: "1px solid #f0eae0" }}>
              <div style={{ fontSize: "0.75rem", color: "#888", fontWeight: "bold", textTransform: "uppercase" }}>Stay connected</div>
              <a href="https://www.instagram.com/toniandguy_essensual_gorantla/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "#c9a84c", fontSize: "0.85rem", fontWeight: "bold" }}>
                📸 Follow us on Instagram
              </a>
              <a href="https://share.google/APJl5CWwP49v7jOCc" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "#c9a84c", fontSize: "0.85rem", fontWeight: "bold" }}>
                📍 Find us on Google Maps
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <h3 style={{ margin: "0 0 0.25rem", color: "#1a1a1a", fontSize: "1.1rem" }}>
                Hi {clientFirstName} 👋
              </h3>
              <p style={{ margin: 0, color: "#666", fontSize: "0.88rem", lineHeight: "1.4" }}>
                How was your service experience at our salon on {visitDate}?
              </p>
            </div>

            {/* Service details summary */}
            <div style={{ background: "#faf8f5", padding: "1rem", borderRadius: "8px", border: "1px solid #f0eae0" }}>
              <div style={{ fontSize: "0.72rem", color: "#999", fontWeight: "bold", textTransform: "uppercase", marginBottom: "0.4rem" }}>
                Services received
              </div>
              <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.82rem", color: "#444", lineHeight: "1.5" }}>
                {(invoice.invoice_items || []).filter(i => i.item_type !== "product").map((item, idx) => (
                  <li key={idx}>{item.service_name}</li>
                ))}
              </ul>
              {invoice.staff_name && (
                <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "0.6rem", borderTop: "1px dashed #e8e2d5", paddingTop: "0.4rem" }}>
                  Stylist: <strong>{invoice.staff_name}</strong>
                </div>
              )}
            </div>

            {/* Interactive Stars */}
            <div style={{ textAlign: "center", margin: "0.5rem 0" }}>
              <div style={{ fontSize: "0.75rem", color: "#888", fontWeight: "bold", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                Tap to rate
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem" }}>
                {[1, 2, 3, 4, 5].map((starValue) => {
                  const active = hoverRating ? starValue <= hoverRating : starValue <= rating;
                  return (
                    <button
                      key={starValue}
                      type="button"
                      onClick={() => setRating(starValue)}
                      onMouseEnter={() => setHoverRating(starValue)}
                      onMouseLeave={() => setHoverRating(0)}
                      style={{
                        background: "none",
                        border: "none",
                        fontSize: "2.2rem",
                        color: active ? "#c9a84c" : "#ddd",
                        cursor: "pointer",
                        outline: "none",
                        transition: "transform 0.15s ease",
                        transform: (hoverRating === starValue) ? "scale(1.15)" : "scale(1)",
                        padding: 0
                      }}
                    >
                      ★
                    </button>
                  );
                })}
              </div>
              {rating > 0 && (
                <div style={{ fontSize: "0.85rem", color: "#c9a84c", fontWeight: "bold", marginTop: "0.4rem" }}>
                  {rating === 5 ? "Excellent! Love it 😍" :
                   rating === 4 ? "Very Good 😊" :
                   rating === 3 ? "Good / Average 🙂" :
                   rating === 2 ? "Below Average 😐" : "Poor / Unsatisfactory 😞"}
                </div>
              )}
            </div>

            {/* Comment */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <label style={{ fontSize: "0.75rem", color: "#888", fontWeight: "bold", textTransform: "uppercase" }}>
                Share your comments (optional)
              </label>
              <textarea
                rows="3"
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="What did you like? Anything we can improve?"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  border: "1px solid #ccc",
                  fontSize: "0.85rem",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                  outline: "none"
                }}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={rating === 0 || submitting}
              style={{
                background: rating === 0 ? "#ccc" : "#000",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "0.88rem",
                fontSize: "0.9rem",
                fontWeight: "bold",
                cursor: rating === 0 ? "not-allowed" : "pointer",
                transition: "background 0.2s ease"
              }}
            >
              {submitting ? "Submitting..." : "Submit Feedback"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
