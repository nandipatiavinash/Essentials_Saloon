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

  return (
    <>
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <motion.p className="hero-eyebrow" initial="hidden" animate="visible" variants={fadeUp}>
            World's #1 Hairdressing Brand — India
          </motion.p>
          <motion.h1 className="hero-title" initial="hidden" animate="visible" variants={fadeUp} transition={{ delay: 0.2 }}>
            Where Style<br />Meets <em>Artistry</em>
          </motion.h1>
          <motion.p className="hero-sub" initial="hidden" animate="visible" variants={fadeUp} transition={{ delay: 0.4 }}>
            An elevated salon experience crafted for those who demand the extraordinary. From precision cuts to full colour transformations — excellence is our only standard.
          </motion.p>
          <motion.div className="hero-btns" initial="hidden" animate="visible" variants={fadeUp} transition={{ delay: 0.6 }}>
            <button className="btn-primary" onClick={openBooking}>Reserve Appointment</button>
            <Link to="/services" className="btn-outline">Explore Services</Link>
          </motion.div>
        </div>
        <div className="hero-scroll">Scroll to explore</div>
      </section>

      {featured.length > 0 && (
        <section className="section">
          <div className="section-header">
            <div>
              <p className="section-label">Our Expertise</p>
              <h2 className="section-title">Signature Services</h2>
              <p className="section-sub">Handcrafted experiences by our award-winning team of master stylists.</p>
            </div>
            <Link to="/services" className="btn-outline">View All</Link>
          </div>
          <div className="services-grid">
            {featured.slice(0, 4).map((s, i) => (
              <motion.div key={s.id} className="service-card" initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { delay: i * 0.1 } } }}>
                <div className="badge-featured">Signature</div>
                <div className="service-body">
                  <div className="service-cat">{categories?.find(c => c.slug === s.category)?.name || s.category}</div>
                  <div className="service-name">{s.name}</div>
                  <div className="service-desc">{s.description}</div>
                  <div className="service-meta">
                    <div className="service-price"><span>from</span>₹{s.price_from}</div>
                    <div className="service-dur">{s.duration}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {offers && offers.length > 0 && (
        <section className="section section-alt">
          <div className="section-header">
            <div>
              <p className="section-label">Exclusive Offers</p>
              <h2 className="section-title">Current Promotions</h2>
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
