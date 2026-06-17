import { useState, useMemo } from "react";
import { useData } from "../../layouts/PublicLayout";
import { motion } from "framer-motion";

export default function Services() {
  const { services, categories, openBooking } = useData();
  const [filterCat, setFilterCat] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return (services || []).filter(s =>
      (filterCat === "all" || s.category === filterCat) &&
      (s.name.toLowerCase().includes(search.toLowerCase()) || (s.description && s.description.toLowerCase().includes(search.toLowerCase())))
    );
  }, [services, filterCat, search]);

  return (
    <section className="section">
      <div style={{ marginBottom: "3rem" }}>
        <p className="section-label">What We Offer</p>
        <h2 className="section-title">All Services</h2>
      </div>
      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem", flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="form-input"
          style={{ maxWidth: 260 }}
          placeholder="Search services..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div className="cats">
        <button className={`cat-pill ${filterCat === "all" ? "active" : ""}`} onClick={() => setFilterCat("all")}>All</button>
        {categories?.map(c => (
          <button key={c.id} className={`cat-pill ${filterCat === c.slug ? "active" : ""}`} onClick={() => setFilterCat(c.slug)}>
            {c.name}
          </button>
        ))}
      </div>
      
      {filtered.length > 0 ? (
        <div className="services-grid">
          {filtered.map((s, i) => (
            <motion.div key={s.id} className="service-card" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.5) }}>
              <div className="service-body">
                {s.featured && <div className="badge-featured">Featured</div>}
                <div className="service-cat">{categories?.find(c => c.slug === s.category)?.name || s.category}</div>
                <div className="service-name">{s.name}</div>
                <div className="service-desc">{s.description}</div>
                <div className="service-meta">
                  <div className="service-price">
                    ₹{s.price_from}
                    {s.member_price != null && s.member_price > 0 && (
                      <div style={{ fontSize: "0.62rem", color: "#c9b99a", marginTop: "4px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        ★ Member Price: ₹{s.member_price}
                      </div>
                    )}
                  </div>
                  <div className="service-dur">{s.duration}</div>
                </div>
                <button className="btn-primary" style={{ marginTop: "1rem", width: "100%", padding: "0.65rem", justifyContent: "center" }} onClick={() => openBooking(s.name)}>
                  Book This Service
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">✂️</div>
          <div className="empty-state-title">No Services Found</div>
          <div className="empty-state-sub">Try adjusting your search or category filter.</div>
        </div>
      )}
    </section>
  );
}
