import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { MapPin } from "lucide-react";

const InstagramIcon = ({ size = 16, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);
import { fetchPublicData } from "../lib/api";
import { createBooking } from "../lib/api";
import toast from "react-hot-toast";
import BookingModal from "../components/BookingModal";

import { createContext, useContext } from "react";
export const DataCtx = createContext({});
export function useData() { return useContext(DataCtx); }

export default function PublicLayout() {
  const [data, setData] = useState({ categories: [], services: [], offers: [], gallery: [], settings: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPublicData()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleBook = async (form) => {
    const row = await createBooking(form);
    toast.success("Booking received! We'll confirm via WhatsApp shortly.");
    return row;
  };

  if (loading) {
    return (
      <div className="page-loader">
        <div className="page-loader-inner">
          <div className="loader-logo">Essensuals<span>.</span></div>
          <div className="loader-dots">
            <div className="loader-dot" /><div className="loader-dot" /><div className="loader-dot" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-page">
        <div className="error-card">
          <div className="error-logo">Essensuals<span>.</span></div>
          <div className="error-msg">{error}</div>
          <button className="btn-gold" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  const navLinks = [
    { to: "/", label: "Home", end: true },
    { to: "/services", label: "Services" },
    { to: "/gallery", label: "Gallery" },
    { to: "/offers", label: "Offers" },
    { to: "/contact", label: "Contact" },
  ];

  return (
    <DataCtx.Provider value={{ ...data, openBooking: () => setBookingOpen(true) }}>
      <nav className="nav">
        <NavLink to="/" className="nav-logo">
          Toni & Guy Essensuals<span> Gorantla</span>
        </NavLink>
        <ul className="nav-links">
          {navLinks.map(l => (
            <li key={l.to}>
              <NavLink to={l.to} end={l.end} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <button className="nav-cta" onClick={() => setBookingOpen(true)}>Book Now</button>
        <button className="nav-mobile-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <svg width="22" height="16" viewBox="0 0 22 16" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="0" y1="1" x2="22" y2="1"/><line x1="0" y1="8" x2="22" y2="8"/><line x1="0" y1="15" x2="22" y2="15"/>
          </svg>
        </button>
      </nav>

      {/* Mobile nav */}
      <div className={`mobile-nav-overlay${mobileOpen ? " open" : ""}`}>
        <button className="mobile-nav-close" onClick={() => setMobileOpen(false)}>✕</button>
        {navLinks.map(l => (
          <NavLink key={l.to} to={l.to} className="mobile-nav-link" onClick={() => setMobileOpen(false)}>
            {l.label}
          </NavLink>
        ))}
        <button className="btn-gold" onClick={() => { setMobileOpen(false); setBookingOpen(true); }}>Book Now</button>
      </div>

      <main style={{ paddingTop: "68px" }}>
        <Outlet />
      </main>

      <footer className="footer">
        <div className="footer-top">
          <div>
            <div className="footer-brand">Toni & Guy Essensuals<span style={{ color: "var(--gold)" }}> Gorantla</span></div>
            <div className="footer-tagline">A premium luxury salon experience in Guntur. A franchisee of Toni&Guy Essensuals UK.</div>
          </div>
          <div>
            <div className="footer-heading">Navigate</div>
            {navLinks.map(l => (
              <NavLink key={l.to} to={l.to} className="footer-link">{l.label}</NavLink>
            ))}
          </div>
          <div>
            <div className="footer-heading">Services</div>
            {data.categories.slice(0, 5).map(c => (
              <div key={c.id} className="footer-link">{c.name}</div>
            ))}
          </div>
          <div>
            <div className="footer-heading">Contact</div>
            {data.settings?.phone && <div className="footer-link">{data.settings.phone}</div>}
            {data.settings?.email && <div className="footer-link">{data.settings.email}</div>}
            <div className="social-links" style={{ marginTop: "1rem" }}>
              <a href="https://www.instagram.com/toniandguy_essensual_gorantla/" target="_blank" rel="noopener noreferrer" className="social-btn" title="Instagram">
                <InstagramIcon size={16} />
              </a>
              <a href="https://share.google/APJl5CWwP49v7jOCc" target="_blank" rel="noopener noreferrer" className="social-btn" title="Google Maps">
                <MapPin size={16} />
              </a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="footer-copy">© {new Date().getFullYear()} Toni & Guy Essensuals Gorantla. All rights reserved.</div>
          <div className="footer-copy">Essensuals by Toni&Guy Hairdressing, Gorantla Guntur</div>
        </div>
      </footer>

      <button className="sticky-book" onClick={() => setBookingOpen(true)}>Book Now</button>

      {bookingOpen && (
        <BookingModal
          services={data.services}
          onClose={() => setBookingOpen(false)}
          onSubmit={handleBook}
        />
      )}
    </DataCtx.Provider>
  );
}
