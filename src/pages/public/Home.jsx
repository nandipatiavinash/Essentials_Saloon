import { useData } from "../../layouts/PublicLayout";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
};

export default function Home() {
  const { services, categories, offers, openBooking } = useData();
  const featured = services?.filter(s => s.featured) || [];

  const reviews = [
    {
      name: "Sravani Reddy",
      location: "Gorantla, Guntur",
      rating: 5,
      text: "Best luxury salon experience in Guntur! Got a hair transformation & keratin treatment by their top stylist. Absolute perfection and top-notch hospitality.",
      service: "Hair Transformation & Keratin"
    },
    {
      name: "Anil Kumar",
      location: "Guntur",
      rating: 5,
      text: "Toni & Guy Essensuals in Gorantla is unmatched. Precision hair cut and beard styling was done with extreme attention to detail. Highly recommend to everyone in Guntur!",
      service: "Precision Haircut & Beard Craft"
    },
    {
      name: "Priyanka V.",
      location: "Gorantla, Guntur",
      rating: 5,
      text: "Amazing bridal makeup & skin care services. The staff is professional, hygienic, and truly world-class. Five stars for Toni & Guy Guntur!",
      service: "Bridal Styling & Skin Glow"
    }
  ];

  return (
    <>
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <motion.p className="hero-eyebrow" initial="hidden" animate="visible" variants={fadeUp}>
            #1 Luxury Salon in Gorantla, Guntur
          </motion.p>
          <motion.h1 className="hero-title" initial="hidden" animate="visible" variants={fadeUp} transition={{ delay: 0.2 }}>
            Where Style<br />Meets <em>Artistry</em>
          </motion.h1>
          <motion.p className="hero-sub" initial="hidden" animate="visible" variants={fadeUp} transition={{ delay: 0.4 }}>
            Experience world-class UK hairdressing at Toni & Guy Essensuals Gorantla, Guntur. From precision cuts to balayage, keratin treatments & luxury bridal care.
          </motion.p>
          <motion.div className="hero-btns" initial="hidden" animate="visible" variants={fadeUp} transition={{ delay: 0.6 }}>
            <button className="btn-primary" onClick={openBooking}>Reserve Appointment</button>
            <Link to="/services" className="btn-outline">Explore Services</Link>
          </motion.div>
        </div>
      </section>

      {/* GOOGLE MAPS & INSTAGRAM TRUST BANNER */}
      <section style={{ background: "rgba(201, 185, 154, 0.08)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "2rem 8vw" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ background: "var(--gold)", color: "var(--bg)", padding: "0.5rem 0.8rem", fontWeight: "700", borderRadius: "4px", fontSize: "1.1rem" }}>★ 4.9</div>
            <div>
              <div style={{ fontFamily: "var(--serif)", fontSize: "1.2rem", color: "var(--white)", fontWeight: "400" }}>#1 Rated Salon on Google Maps in Guntur</div>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>500+ Verified 5-Star Reviews • Gorantla Branch</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <a href="https://share.google/APJl5CWwP49v7jOCc" target="_blank" rel="noopener noreferrer" className="btn-outline" style={{ padding: "0.55rem 1.2rem", fontSize: "0.62rem" }}>
              📍 View Google Reviews & Directions
            </a>
            <a href="https://www.instagram.com/toniandguy_essensual_gorantla/" target="_blank" rel="noopener noreferrer" className="btn-gold" style={{ padding: "0.55rem 1.2rem", fontSize: "0.62rem" }}>
              📸 Follow @toniandguy_essensual_gorantla
            </a>
          </div>
        </div>
      </section>

      {/* POPULAR CATEGORIES & KEY SERVICES GRID (SEO OPTIMIZED FOR GUNTUR) */}
      <section className="section" style={{ paddingBottom: "3rem" }}>
        <div className="section-header">
          <div>
            <p className="section-label">Premium & Affordable Services</p>
            <h2 className="section-title">Top Rated Categories in Guntur</h2>
            <p className="section-sub">Gorantla's favorite destination for Haircuts, Hair Botox, Hair Spa, De-Tan facials, and Spa Pedicures.</p>
          </div>
          <Link to="/services" className="btn-outline">Browse All Services</Link>
        </div>
        <div className="services-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {[
            { title: "Best Haircut & Styling", tag: "Affordable & Premium", icon: "✂️", desc: "UK precision haircutting for Men & Women by senior stylists.", link: "/services" },
            { title: "Best Hair Botox & Keratin", tag: "Frizz-Free Smooth Hair", icon: "💆‍♀️", desc: "Top hair botox & smoothening treatment in Gorantla Guntur.", link: "/services" },
            { title: "Nourishing Hair Spa", tag: "Deep Conditioning", icon: "🧖‍♂️", desc: "Revitalizing hair spa & scalp care treatments at affordable rates.", link: "/services" },
            { title: "De-Tan & Skin Facials", tag: "Instant Glow", icon: "🧴", desc: "Advanced sun tan removal, hydrafacials & bridal skin prep.", link: "/services" },
            { title: "Luxury Spa Pedicure", tag: "Hand & Foot Care", icon: "💅", desc: "Relaxing pedicure & manicure spa treatments in Guntur.", link: "/services" },
            { title: "Global Hair Color & Balayage", tag: "Ammonia-Free Shades", icon: "🎨", desc: "Custom highlights, balayage & rich hair coloring.", link: "/services" }
          ].map((cat, idx) => (
            <motion.div key={idx} className="service-card" initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.08 }}>
              <div className="service-body">
                <div style={{ fontSize: "1.8rem", marginBottom: "0.8rem" }}>{cat.icon}</div>
                <div className="badge-featured" style={{ background: "rgba(201,185,154,0.15)", color: "var(--gold)", border: "1px solid rgba(201,185,154,0.3)" }}>{cat.tag}</div>
                <div className="service-name" style={{ fontSize: "1.2rem", marginTop: "0.4rem" }}>{cat.title}</div>
                <div className="service-desc">{cat.desc}</div>
                <button className="btn-outline" style={{ marginTop: "1rem", width: "100%", padding: "0.5rem", fontSize: "0.62rem", justifyContent: "center" }} onClick={() => openBooking(cat.title)}>
                  Book Appointment
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* GUNTUR LOCAL NEIGHBORHOODS AREA COVERAGE BANNER */}
      <section style={{ background: "var(--bg2)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "3rem 8vw" }}>
        <div style={{ textAlign: "center", maxWidth: "800px", margin: "0 auto" }}>
          <p className="section-label" style={{ marginBottom: "0.5rem" }}>Serving All Key Locations in Guntur</p>
          <h3 className="section-title" style={{ fontSize: "1.8rem", marginBottom: "1rem" }}>Guntur's Preferred Luxury Salon</h3>
          <p className="section-sub" style={{ margin: "0 auto 2rem auto" }}>
            Easily accessible for clients looking for the best haircuts, hair botox, hair spa, de-tan, and pedicures from across Guntur's top hubs:
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.75rem" }}>
            {[
              "📍 Gorantla",
              "📍 Vidya Nagar",
              "📍 Lakshmipuram",
              "📍 2 Town Guntur",
              "📍 Brodipet",
              "📍 Arundelpet",
              "📍 Kothapet Guntur"
            ].map((loc, i) => (
              <span key={i} style={{ background: "rgba(201,185,154,0.1)", border: "1px solid var(--border2)", color: "var(--white)", padding: "0.45rem 1rem", fontSize: "0.7rem", letterSpacing: "0.08em" }}>
                {loc}
              </span>
            ))}
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="section">
          <div className="section-header">
            <div>
              <p className="section-label">Our Expertise in Guntur</p>
              <h2 className="section-title">Signature Services</h2>
              <p className="section-sub">Handcrafted hairdressing & skin experiences by certified master stylists in Gorantla, Guntur.</p>
            </div>
            <Link to="/services" className="btn-outline">View All</Link>
          </div>
          <div className="services-grid">
            {featured.slice(0, 4).map((s, i) => (
              <motion.div key={s.id} className="service-card" initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { delay: i * 0.1 } } }}>
                <div className="service-body">
                  <div className="badge-featured">Signature</div>
                  <div className="service-cat">{categories?.find(c => c.slug === s.category)?.name || s.category}</div>
                  <div className="service-name">{s.name}</div>
                  <div className="service-desc">{s.description}</div>
                  <div className="service-meta" style={{ marginBottom: "1rem" }}>
                    <div className="service-price"><span>from</span>₹{s.price_from}</div>
                    <div className="service-dur">{s.duration}</div>
                  </div>
                  <button className="btn-primary" style={{ width: "100%", padding: "0.6rem", fontSize: "0.62rem", justifyContent: "center" }} onClick={() => openBooking(s.name)}>
                    Book This Service
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* VERIFIED CLIENT REVIEWS & LOCAL REPUTATION */}
      <section className="section section-alt">
        <div className="section-header">
          <div>
            <p className="section-label">Google Reviews</p>
            <h2 className="section-title">Loved by Guntur</h2>
            <p className="section-sub">See why clients rate us as the #1 hair and beauty salon in Gorantla, Guntur.</p>
          </div>
          <a href="https://share.google/APJl5CWwP49v7jOCc" target="_blank" rel="noopener noreferrer" className="btn-outline">Read All Reviews</a>
        </div>
        <div className="offers-grid">
          {reviews.map((r, i) => (
            <motion.div key={i} className="offer-card" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { delay: i * 0.1 } } }}>
              <div style={{ color: "var(--gold)", fontSize: "0.9rem", marginBottom: "0.8rem" }}>★★★★★ <span style={{ color: "var(--muted)", fontSize: "0.65rem", marginLeft: "0.4rem" }}>Google Verified</span></div>
              <div className="offer-title" style={{ fontSize: "1.25rem" }}>"{r.text}"</div>
              <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--border)", paddingTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontFamily: "var(--sans)", fontWeight: "600", color: "var(--white)", fontSize: "0.8rem" }}>{r.name}</div>
                  <div style={{ fontSize: "0.65rem", color: "var(--gold)" }}>{r.location}</div>
                </div>
                <div style={{ fontSize: "0.6rem", color: "var(--muted)", fontStyle: "italic" }}>{r.service}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {offers && offers.length > 0 && (
        <section className="section">
          <div className="section-header">
            <div>
              <p className="section-label">Exclusive Offers</p>
              <h2 className="section-title">Gorantla Branch Specials</h2>
            </div>
          </div>
          <div className="offers-grid">
            {offers.slice(0, 3).map((o, i) => (
              <motion.div key={o.id} className="offer-card" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { delay: i * 0.1 } } }}>
                <div className="offer-badge">{o.badge}</div>
                <div className="offer-title">{o.title}</div>
                <div className="offer-desc">{o.description}</div>
                <div className="offer-price">{o.price}</div>
                <button className="offer-btn" onClick={openBooking}>Enquire Now</button>
              </motion.div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
