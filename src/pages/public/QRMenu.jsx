import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { fetchPublicData } from "../../lib/api";
import BookingModal from "../../components/BookingModal";

export default function QRMenu() {
  const { branch } = useParams();
  const [data, setData] = useState({ categories: [], services: [] });
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState("all");
  const [search, setSearch] = useState("");
  const [bookingSvc, setBookingSvc] = useState(null);

  useEffect(() => {
    document.title = "Menu - Essensuals";
    // Log the scan count locally or send to analytics if required
    fetchPublicData()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return (data.services || []).filter(s =>
      (filterCat === "all" || s.category === filterCat) &&
      (s.name.toLowerCase().includes(search.toLowerCase()))
    );
  }, [data.services, filterCat, search]);

  if (loading) {
    return (
      <div className="page-loader" style={{ background: "var(--bg)" }}>
        <div className="loader-dots">
          <div className="loader-dot" /><div className="loader-dot" /><div className="loader-dot" />
        </div>
      </div>
    );
  }

  return (
    <div className="qr-menu">
      <div className="qr-hero">
        <div className="qr-logo">Essensuals<span>.</span></div>
        <div className="qr-branch">{branch ? branch.replace("-", " ") : "Digital Menu"}</div>
      </div>

      <div className="qr-search">
        <input
          type="search"
          className="qr-search-input"
          placeholder="Search services..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {data.categories?.length > 0 && (
        <div className="qr-cats">
          <button className={`qr-cat ${filterCat === "all" ? "active" : ""}`} onClick={() => setFilterCat("all")}>All Services</button>
          {data.categories.map(c => (
            <button key={c.id} className={`qr-cat ${filterCat === c.slug ? "active" : ""}`} onClick={() => setFilterCat(c.slug)}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="qr-services">
        {filtered.length > 0 ? (
          filtered.map(s => (
            <div key={s.id} className="qr-service" onClick={() => setBookingSvc(s.name)}>
              {s.image && (
                <img className="qr-service-img" src={s.image} alt={s.name} loading="lazy" />
              )}
              <div className="qr-service-body">
                <div className="qr-service-cat">{data.categories?.find(c => c.slug === s.category)?.name || s.category}</div>
                <div className="qr-service-name">{s.name}</div>
                <div className="qr-service-dur">{s.duration}</div>
                <div className="qr-service-price"><span>from</span>₹{s.price_from}</div>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state" style={{ padding: "3rem 2rem" }}>
            <div className="empty-state-title">No Services Found</div>
          </div>
        )}
      </div>

      <div className="qr-book-bar">
        <button className="qr-book-btn" onClick={() => setBookingSvc("")}>Book Appointment</button>
      </div>

      {bookingSvc !== null && (
        <BookingModal
          services={data.services}
          onClose={() => setBookingSvc(null)}
          // If we passed a string in bookingSvc, prefill or log it. Currently handled loosely.
        />
      )}
    </div>
  );
}
