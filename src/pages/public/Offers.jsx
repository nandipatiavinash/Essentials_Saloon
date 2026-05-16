import { useData } from "../../layouts/PublicLayout";
import { motion } from "framer-motion";

export default function Offers() {
  const { offers, openBooking } = useData();

  return (
    <section className="section">
      <div style={{ marginBottom: "3rem" }}>
        <p className="section-label">Exclusive</p>
        <h2 className="section-title">Current Offers</h2>
        <p className="section-sub">Take advantage of our seasonal promotions and premium packages.</p>
      </div>

      {offers && offers.length > 0 ? (
        <div className="offers-grid">
          {offers.map((o, i) => (
            <motion.div key={o.id} className="offer-card" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.1 }}>
              <div className="offer-badge">{o.badge}</div>
              <div className="offer-title">{o.title}</div>
              <div className="offer-desc">{o.description}</div>
              <div className="offer-price">{o.price}</div>
              <button className="offer-btn" onClick={() => openBooking(o.title)}>Enquire Now</button>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">🏷️</div>
          <div className="empty-state-title">No Current Offers</div>
          <div className="empty-state-sub">Check back later for new promotions.</div>
        </div>
      )}
    </section>
  );
}
