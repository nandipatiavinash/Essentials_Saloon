import { useData } from "../../layouts/PublicLayout";
import { motion } from "framer-motion";

export default function Gallery() {
  const { gallery } = useData();

  return (
    <section className="section">
      <div style={{ marginBottom: "3rem" }}>
        <p className="section-label">Our Work</p>
        <h2 className="section-title">The Gallery</h2>
        <p className="section-sub">A curated collection of transformations, artistry, and style.</p>
      </div>
      
      {gallery && gallery.length > 0 ? (
        <div className="gallery-grid">
          {gallery.map((g, i) => (
            <motion.div key={g.id} className="gallery-item" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: (i % 6) * 0.1 }}>
              <img src={g.url} alt={g.caption || "Gallery item"} loading="lazy" />
              {g.caption && <div className="gallery-caption">{g.caption}</div>}
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">🖼️</div>
          <div className="empty-state-title">No Photos Found</div>
          <div className="empty-state-sub">Check back later for inspiration.</div>
        </div>
      )}
    </section>
  );
}
