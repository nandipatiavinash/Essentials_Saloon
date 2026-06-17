import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./lib/supabase";
import {
  fetchSalonData,
  seedSalonData,
  createService,
  updateService,
  deleteService,
  patchService,
  createCategory,
  updateCategory,
  deleteCategory,
  createOffer,
  updateOffer,
  deleteOffer,
  createGalleryItem,
  updateGalleryItem,
  deleteGalleryItem,
  saveSalonSettings,
  createBooking,
  updateBookingStatus,
} from "./lib/salonDb";

const INITIAL_CATEGORIES = [
  { id: 1, name: "Men's Cut & Style", icon: "✂️", slug: "mens-cut" },
  { id: 2, name: "Women's Cut & Blow Dry", icon: "💇", slug: "womens-cut" },
  { id: 3, name: "Blow Dry & Styling", icon: "💨", slug: "blowdry" },
  { id: 4, name: "Shave & Beard", icon: "🪒", slug: "shave" },
  { id: 5, name: "Colour Services", icon: "🎨", slug: "colour" },
  { id: 6, name: "Straightening & Rebonding", icon: "〰️", slug: "straightening" },
  { id: 7, name: "Keratin & Botox", icon: "✨", slug: "keratin" },
  { id: 8, name: "Hair Spa & Treatments", icon: "🌿", slug: "spa" },
  { id: 9, name: "Bridal & Makeup", icon: "👰", slug: "bridal" },
  { id: 10, name: "Groom Packages", icon: "🤵", slug: "groom" },
];

const INITIAL_SERVICES = [
  // Men's Cut & Style
  { id: 1, name: "Style Director Cut & Styling", category: "mens-cut", description: "The pinnacle of men's grooming — a bespoke cut by our Style Director, available at selected outlets. Includes consultation, wash and finish.", duration: "60 min", price_from: 1153, price_to: 1380, featured: true, active: true, image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&q=80" },
  { id: 2, name: "Creative Director Cut & Styling", category: "mens-cut", description: "Precision craftsmanship by our Creative Director. Tailored to your bone structure, texture and lifestyle for an effortless, refined finish.", duration: "50 min", price_from: 850, price_to: 1020, featured: true, active: true, image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80" },
  { id: 3, name: "Top Stylist Cut & Styling", category: "mens-cut", description: "Expert cut and styling by our senior creative team. Modern shapes with meticulous attention to detail and personal style.", duration: "45 min", price_from: 650, price_to: 780, featured: false, active: true, image: "https://images.unsplash.com/photo-1521322138825-f2b0e1c4b72c?w=600&q=80" },
  { id: 4, name: "Senior Stylist Cut", category: "mens-cut", description: "Change of style — a fresh look sculpted by our experienced Senior Stylists. Includes consultation, wash and blow dry.", duration: "40 min", price_from: 500, price_to: 600, featured: false, active: true, image: "https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=600&q=80" },
  { id: 5, name: "Stylist Cut", category: "mens-cut", description: "A polished, precise cut delivered by our skilled stylists. Perfect for maintaining your signature look.", duration: "35 min", price_from: 250, price_to: 300, featured: false, active: true, image: "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=600&q=80" },
  { id: 6, name: "Kids Haircut (Men's)", category: "mens-cut", description: "Gentle, patient haircuts for children in a calm, welcoming environment. All stylists trained for young guests.", duration: "30 min", price_from: 250, price_to: 300, featured: false, active: true, image: "https://images.unsplash.com/photo-1519689680058-324335c77eba?w=600&q=80" },

  // Women's Cut & Blow Dry
  { id: 7, name: "Style Director Cut & Blow Dry", category: "womens-cut", description: "Multi-layer precision cut by our Style Director — the ultimate expression of bespoke women's hairdressing. Includes full blow dry finish.", duration: "75 min", price_from: 1502, price_to: 1800, featured: true, active: true, image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80" },
  { id: 8, name: "Creative Director Cut & Blow Dry", category: "womens-cut", description: "Layer or step cut sculpted by our Creative Director. A signature service combining artistry and technical mastery.", duration: "65 min", price_from: 1150, price_to: 1380, featured: true, active: true, image: "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=600&q=80" },
  { id: 9, name: "Top Stylist Layer Cut", category: "womens-cut", description: "Expert layer cut and blow dry by our Top Stylists — ideal for adding movement, texture and a fresh dimension to your hair.", duration: "55 min", price_from: 850, price_to: 1020, featured: false, active: true, image: "https://images.unsplash.com/photo-1500840216050-6ffa99d75160?w=600&q=80" },
  { id: 10, name: "Senior Stylist Deep U/V Cut", category: "womens-cut", description: "A defined Deep U or V cut with blow dry — structured, elegant and effortlessly wearable. By our Senior Stylist team.", duration: "50 min", price_from: 700, price_to: 840, featured: false, active: true, image: "https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?w=600&q=80" },
  { id: 11, name: "Stylist Basic Cut & Blow Dry", category: "womens-cut", description: "A clean, straight cut with professional blow dry. Classic and polished — for those who trust simplicity.", duration: "45 min", price_from: 500, price_to: 600, featured: false, active: true, image: "https://images.unsplash.com/photo-1512207736890-6ffed8a84e8d?w=600&q=80" },
  { id: 12, name: "Kids Haircut (Girls) & Fringe", category: "womens-cut", description: "Girls' haircut from ₹400 | Fringe trim from ₹200. A comfortable, fun experience for young guests.", duration: "30 min", price_from: 200, price_to: 480, featured: false, active: true, image: "https://images.unsplash.com/photo-1519741497674-611481863552?w=600&q=80" },

  // Blow Dry & Styling
  { id: 13, name: "Wash & Blast Dry (Gents)", category: "blowdry", description: "A quick, revitalising wash and high-pressure blow dry — the essential refresh between cuts.", duration: "20 min", price_from: 250, price_to: 300, featured: false, active: true, image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&q=80" },
  { id: 14, name: "Straight Blow Dry (Shoulder Length)", category: "blowdry", description: "Smooth, glossy straight blow dry for shoulder-length hair. Frizz-free, voluminous, and runway-ready.", duration: "40 min", price_from: 450, price_to: 540, featured: false, active: true, image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80" },
  { id: 15, name: "Straight Blow Dry (Below Shoulder)", category: "blowdry", description: "A full blow dry for longer lengths — silky-smooth finish that lasts all day.", duration: "50 min", price_from: 600, price_to: 720, featured: false, active: true, image: "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=600&q=80" },
  { id: 16, name: "In Curl / Out Curl Styling", category: "blowdry", description: "Bouncy, voluminous curls styled in or out for a glamorous, editorial finish.", duration: "55 min", price_from: 800, price_to: 960, featured: true, active: true, image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80" },
  { id: 17, name: "Temporary Straightening (Ironing)", category: "blowdry", description: "Sleek, pin-straight ironed finish. Shoulder length from ₹700 | Below shoulder from ₹900 | Extra long from ₹1200.", duration: "45–75 min", price_from: 700, price_to: 1440, featured: false, active: true, image: "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=600&q=80" },
  { id: 18, name: "Tonging — Curls & Waves", category: "blowdry", description: "Temporary curls and waves crafted with professional tongs. Shoulder from ₹800 | Below shoulder ₹1000 | Extra long ₹1500.", duration: "50–80 min", price_from: 800, price_to: 1800, featured: false, active: true, image: "https://images.unsplash.com/photo-1500840216050-6ffa99d75160?w=600&q=80" },
  { id: 19, name: "Scrunching", category: "blowdry", description: "Enhance your natural curl pattern with our professional scrunching technique. Defined, bouncy curls without heat damage.", duration: "30 min", price_from: 400, price_to: 480, featured: false, active: true, image: "https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?w=600&q=80" },

  // Shave & Beard
  { id: 20, name: "Zero Trim & Regular Shave", category: "shave", description: "Precision zero trim for a clean, close finish. Classic regular shave with hot towel preparation.", duration: "20–30 min", price_from: 100, price_to: 180, featured: false, active: true, image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&q=80" },
  { id: 21, name: "Beard Shape-Up", category: "shave", description: "Expert beard shaping and contouring to define your jaw and elevate your overall look.", duration: "20 min", price_from: 150, price_to: 180, featured: false, active: true, image: "https://images.unsplash.com/photo-1519689680058-324335c77eba?w=600&q=80" },
  { id: 22, name: "French Beard Shave & Design", category: "shave", description: "French beard shave from ₹150 | Beard design from ₹250. Sculpted to precision by our grooming specialists.", duration: "25–35 min", price_from: 150, price_to: 300, featured: false, active: true, image: "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=600&q=80" },
  { id: 23, name: "Head Shave", category: "shave", description: "A smooth, close head shave with hot towel treatment. The cleanest, most confident look — expertly delivered.", duration: "30 min", price_from: 300, price_to: 360, featured: false, active: true, image: "https://images.unsplash.com/photo-1521322138825-f2b0e1c4b72c?w=600&q=80" },

  // Colour Services
  { id: 24, name: "Tint Re-Growth", category: "colour", description: "Seamless root touch-up using premium colour systems. Blends perfectly with your existing shade for a fresh, uniform finish.", duration: "60 min", price_from: 1500, price_to: 1800, featured: false, active: true, image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80" },
  { id: 25, name: "Global Colour", category: "colour", description: "Full head colour transformation. Men from ₹1000 | Women (neck length) from ₹2000. Rich, luminous results using professional-grade pigments.", duration: "75–90 min", price_from: 1000, price_to: 2400, featured: true, active: true, image: "https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?w=600&q=80" },
  { id: 26, name: "Highlights — Full & Half Head", category: "colour", description: "Full head highlights from ₹3000 | Half head from ₹2000 | T-section from ₹1500. Dimensional colour that catches the light beautifully.", duration: "90–120 min", price_from: 1500, price_to: 3600, featured: true, active: true, image: "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=600&q=80" },
  { id: 27, name: "Men's Cap Highlights", category: "colour", description: "Classic cap highlights designed specifically for men — subtle dimension and depth without the commitment of full colour.", duration: "50 min", price_from: 1000, price_to: 1200, featured: false, active: true, image: "https://images.unsplash.com/photo-1603351154351-5e2d0600bb77?w=600&q=80" },
  { id: 28, name: "Hairline Highlights (Per Streak)", category: "colour", description: "Face-framing hairline streaks from ₹200 per streak. Precise, targeted brightening for an effortless sun-kissed effect.", duration: "30 min", price_from: 200, price_to: 240, featured: false, active: true, image: "https://images.unsplash.com/photo-1500840216050-6ffa99d75160?w=600&q=80" },
  { id: 29, name: "Balayage, Ombré & Lumi-Ombrage", category: "colour", description: "Advanced freehand colour techniques — Balayage, Ombré and Lumi-Ombrage. Natural-looking, blended dimension. Price on consultation.", duration: "2–3 hr", price_from: 5000, price_to: 6000, featured: true, active: true, image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80" },
  { id: 30, name: "Colour Correction", category: "colour", description: "Expert colour correction for uneven tones, failed DIY colour, or major transformations. Tailored approach for every situation.", duration: "3+ hr", price_from: 2500, price_to: 3000, featured: false, active: true, image: "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=600&q=80" },
  { id: 31, name: "Moustache & Beard Colour", category: "colour", description: "Moustache colour from ₹150 | Beard colour from ₹250. Discreet, natural-looking coverage for facial hair.", duration: "20 min", price_from: 150, price_to: 300, featured: false, active: true, image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&q=80" },

  // Straightening & Rebonding
  { id: 32, name: "Straightening / Relaxing / Rebonding", category: "straightening", description: "Permanent frizz-free treatment for smooth, manageable hair. Fringe ₹1000 | Neck ₹3000 | Shoulder ₹5000 | Below shoulder ₹6500 | Waist ₹8000 onwards.", duration: "2–4 hr", price_from: 1000, price_to: 9600, featured: true, active: true, image: "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=600&q=80" },

  // Keratin & Botox
  { id: 33, name: "Keratin Treatment", category: "keratin", description: "Our signature keratin smoothing treatment — eliminates frizz, restores shine and transforms texture for months. Suitable for all hair types.", duration: "2–4 hr", price_from: 4000, price_to: 9000, featured: true, active: true, image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80" },
  { id: 34, name: "Botox Hair Treatment", category: "keratin", description: "Deep conditioning hair botox that fills gaps in the hair fibre, restoring elasticity and brilliance. Visible results from the first session.", duration: "2–3.5 hr", price_from: 3000, price_to: 8500, featured: false, active: true, image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80" },
  { id: 35, name: "Nanoplastia Treatment", category: "keratin", description: "The most advanced smoothing technology — organic, formaldehyde-free. Ultra-smooth, luminous results that respect hair integrity.", duration: "2.5–4 hr", price_from: 5000, price_to: 10999, featured: true, active: true, image: "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=600&q=80" },

  // Hair Spa & Treatments
  { id: 36, name: "SP Alchemy Hair Spa (Men)", category: "spa", description: "30-minute intensive SP Alchemy treatment — choose from Repair, Colour Save, Dandruff, Hair Loss, Shine, Keratin or Frizz Ease protocols. S: ₹800 | M: ₹1000 onwards.", duration: "30 min", price_from: 800, price_to: 1200, featured: false, active: true, image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80" },
  { id: 37, name: "SP Alchemy Hair Spa (Women)", category: "spa", description: "30-minute intensive SP Alchemy treatment tailored for women. Shoulder length ₹1800 | Below shoulder ₹2500 | Waist ₹3000 onwards.", duration: "30 min", price_from: 1800, price_to: 3000, featured: true, active: true, image: "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=600&q=80" },
  { id: 38, name: "Keratin Oil Hair Spa (Wella)", category: "spa", description: "Wella's signature keratin oil spa — deep nourishment, frizz elimination and mirror-like shine in one luxurious session.", duration: "45 min", price_from: 1500, price_to: 1800, featured: false, active: true, image: "https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?w=600&q=80" },
  { id: 39, name: "SP Hair Spa (Wella)", category: "spa", description: "Choose from Smooth, Hydrate, Volume, Balance Scalp or Repair protocols. Targeted, science-backed scalp and strand care.", duration: "45 min", price_from: 2000, price_to: 2500, featured: false, active: true, image: "https://images.unsplash.com/photo-1500840216050-6ffa99d75160?w=600&q=80" },
  { id: 40, name: "L'Oréal Care Hair Spa", category: "spa", description: "Transform damaged hair to stronger, healthier hair with L'Oréal's professional care spa. Men ₹1000 | Women (neck length) ₹1300 onwards.", duration: "40 min", price_from: 1000, price_to: 1500, featured: false, active: true, image: "https://images.unsplash.com/photo-1519741497674-611481863552?w=600&q=80" },
  { id: 41, name: "Wellaplex / Olaplex Bond Repair", category: "spa", description: "Bond-rebuilding treatment for coloured or frizzy hair. Gents from ₹2000 | Ladies from ₹3000. Restores strength and prevents breakage.", duration: "30 min", price_from: 2000, price_to: 3500, featured: true, active: true, image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80" },
  { id: 42, name: "Hair Growth Treatment", category: "spa", description: "Targeted scalp therapy to stimulate growth and combat hair loss. Professional-grade formulas — ₹3000/₹3500 per session.", duration: "45 min", price_from: 3000, price_to: 3500, featured: false, active: true, image: "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=600&q=80" },
  { id: 43, name: "Protein Treatment (Add-On)", category: "spa", description: "Strengthening protein add-on service. Men ₹500 | Women ₹1000. Rebuilds hair structure from within for resilience and shine.", duration: "20 min", price_from: 500, price_to: 1000, featured: false, active: true, image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80" },

  // Bridal & Makeup
  { id: 44, name: "Elegant Bride (Hair, Makeup & Saree Draping)", category: "bridal", description: "Complete bridal package — hair styling, makeup and saree draping for your perfect wedding moment. Elegant look.", duration: "4 hr", price_from: 8000, price_to: 8000, featured: true, active: true, image: "https://images.unsplash.com/photo-1519741497674-611481863552?w=600&q=80" },
  { id: 45, name: "Gorgeous Bride (Hair, Makeup & Saree Draping)", category: "bridal", description: "An elevated bridal experience — Gorgeous Bride package with premium hair, makeup and saree draping by our top artistes.", duration: "4.5 hr", price_from: 10000, price_to: 10000, featured: true, active: true, image: "https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=600&q=80" },
  { id: 46, name: "Glamorous Bride (Hair, Makeup & Saree Draping)", category: "bridal", description: "The full glamour treatment — Glamorous Bride with luxury hair, full makeup and expert saree draping. Unforgettable.", duration: "5 hr", price_from: 12000, price_to: 12000, featured: true, active: true, image: "https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?w=600&q=80" },
  { id: 47, name: "Airbrush Bridal", category: "bridal", description: "Airbrush makeup for the modern bride — flawless, lightweight, long-lasting coverage that photographs beautifully.", duration: "5+ hr", price_from: 16000, price_to: 16000, featured: false, active: true, image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80" },
  { id: 48, name: "Bridesmaid — Hair & Makeup", category: "bridal", description: "Complete bridesmaid package including hair styling, makeup and saree draping. ₹4500 per person.", duration: "2.5 hr", price_from: 4500, price_to: 4500, featured: false, active: true, image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80" },
  { id: 49, name: "Simple / Mini / Eye Makeup", category: "bridal", description: "Simple makeup ₹3000 | Mini makeup ₹1500 | Eye makeup ₹600. Expert makeup for events, shoots and special occasions.", duration: "30–60 min", price_from: 600, price_to: 3000, featured: false, active: true, image: "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=600&q=80" },
  { id: 50, name: "Advance Hairdo / Simple Hairdo", category: "bridal", description: "Advance hairdo ₹1500 | Simple hairdo ₹1000 | Men's styling ₹200. Elegant up-styles and hair artistry for any occasion.", duration: "45–60 min", price_from: 200, price_to: 1500, featured: false, active: true, image: "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=600&q=80" },

  // Groom Packages
  { id: 51, name: "Pre Bridal Groom Package — Deluxe", category: "groom", description: "Complete groom preparation: Nature/Lotus facial, Stylist cut & styling, beard design/shape/shave, pedicure, manicure. 2 hrs minimum.", duration: "2 hr", price_from: 3999, price_to: 3999, featured: true, active: true, image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&q=80" },
  { id: 52, name: "Pre Bridal Groom Package — Premium", category: "groom", description: "Elevated groom package: Sea Soul/Diamond facial, Top Stylist cut, beard design, Premium pedicure & manicure, hair spa & blow dry. 3 hrs minimum.", duration: "3 hr", price_from: 5999, price_to: 5999, featured: true, active: true, image: "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=600&q=80" },
  { id: 53, name: "Pre Bridal Groom Package — Luxury", category: "groom", description: "Ultimate groom experience: Brillare/O3 facial, Creative Director cut & styling, beard design, Luxury pedicure & manicure, hair spa & body polish. 4 hrs minimum.", duration: "4 hr", price_from: 9999, price_to: 9999, featured: true, active: true, image: "https://images.unsplash.com/photo-1603351154351-5e2d0600bb77?w=600&q=80" },
  { id: 54, name: "Groom Makeup — Normal / HD / Airbrush", category: "groom", description: "Normal groom makeup ₹4000 | High Definition ₹5000 | Airbrush ₹6000. Professional makeup artistry for the modern groom.", duration: "60–90 min", price_from: 4000, price_to: 6000, featured: false, active: true, image: "https://images.unsplash.com/photo-1519689680058-324335c77eba?w=600&q=80" },
];

const INITIAL_OFFERS = [
  { id: 1, title: "Club Envy Card", description: "Earn exclusive member benefits and save upto 22.5% off on services across Essensuals & partner lifestyle brands. Ask at reception to join.", badge: "Upto 22.5% Off", price: "Free to join", active: true, color: "#1a1a1a" },
  { id: 2, title: "Pre Bridal Package — Luxury", description: "Full bridal prep: Brillare/O3 facial, full body luxury wax, Top Stylist cut, pedicure & manicure (Bombini), hair spa, blow dry & body polish. 4 hrs minimum.", badge: "Limited Slots", price: "From ₹10,999", active: true, color: "#2d2d2d" },
  { id: 3, title: "Pre Bridal Groom — Premium", description: "Sea Soul/Diamond facial, Top Stylist cut, beard design, Premium spa pedicure & manicure, hair spa and blow dry. The complete groom experience.", badge: "Popular Choice", price: "From ₹5,999", active: true, color: "#1a1a1a" },
  { id: 4, title: "Fabulous Deals on Lifestyle Brands", description: "Special packages on Haagen-Dazs, Chakra Urban Spa and more Paulsons Group brands. Ask our reception team for further details.", badge: "Exclusive", price: "Ask at reception", active: true, color: "#2d2d2d" },
];

const GALLERY_ITEMS = [
  { id: 1, url: "https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?w=600&q=80", caption: "Balayage Transformation", type: "after" },
  { id: 2, url: "https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=600&q=80", caption: "Bridal Updo", type: "bridal" },
  { id: 3, url: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80", caption: "Creative Colour", type: "colour" },
  { id: 4, url: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80", caption: "Precision Cut", type: "cut" },
  { id: 5, url: "https://images.unsplash.com/photo-1519741497674-611481863552?w=600&q=80", caption: "Wedding Artistry", type: "bridal" },
  { id: 6, url: "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=600&q=80", caption: "Voluminous Blowout", type: "style" },
];

const ANALYTICS = { scans: 1284, bookings: 47, topService: "Creative Colour", offers_clicked: 312, weekly: [40,65,55,80,90,75,100] };

// ─── Styles ────────────────────────────────────────────────────────────────

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Montserrat:wght@300;400;500;600&display=swap');
  
  * { box-sizing: border-box; margin: 0; padding: 0; }
  
  body { font-family: 'Montserrat', sans-serif; background: #0d0d0d; color: #f5f5f0; }
  
  .serif { font-family: 'Cormorant Garamond', serif; }
  
  .app { min-height: 100vh; background: #0d0d0d; }
  
  /* Nav */
  .nav { position: sticky; top: 0; z-index: 100; background: rgba(13,13,13,0.95); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255,255,255,0.08); padding: 0 2rem; display: flex; align-items: center; justify-content: space-between; height: 68px; }
  .nav-logo { font-family: 'Cormorant Garamond', serif; font-size: clamp(0.85rem, 4.2vw, 1.6rem); font-weight: 300; letter-spacing: 0.12em; color: #f5f5f0; text-transform: uppercase; }
  .nav-logo span { color: #c9b99a; }
  .nav-links { display: flex; gap: 2rem; align-items: center; }
  .nav-link { font-size: 0.7rem; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(245,245,240,0.6); cursor: pointer; transition: color 0.2s; background: none; border: none; font-family: 'Montserrat', sans-serif; }
  .nav-link:hover, .nav-link.active { color: #f5f5f0; }
  .nav-cta { background: #f5f5f0; color: #0d0d0d; padding: 0.55rem 1.4rem; font-size: 0.65rem; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 600; cursor: pointer; border: none; font-family: 'Montserrat', sans-serif; transition: background 0.2s; }
  .nav-cta:hover { background: #c9b99a; }

  /* Hero */
  .hero { height: 92vh; display: flex; align-items: center; position: relative; overflow: hidden; background: #0d0d0d; }
  .hero-bg { position: absolute; inset: 0; background: url('https://images.unsplash.com/photo-1562322140-8baeececf3df?w=1600&q=80') center/cover; opacity: 0.25; }
  .hero-overlay { position: absolute; inset: 0; background: linear-gradient(135deg, rgba(13,13,13,0.9) 0%, rgba(13,13,13,0.4) 100%); }
  .hero-content { position: relative; z-index: 2; padding: 0 8vw; max-width: 700px; }
  .hero-eyebrow { font-size: 0.65rem; letter-spacing: 0.3em; text-transform: uppercase; color: #c9b99a; margin-bottom: 1.5rem; }
  .hero-title { font-family: 'Cormorant Garamond', serif; font-size: clamp(3.5rem, 7vw, 6rem); font-weight: 300; line-height: 1.05; color: #f5f5f0; margin-bottom: 1.5rem; }
  .hero-title em { font-style: italic; color: #c9b99a; }
  .hero-sub { font-size: 0.8rem; letter-spacing: 0.08em; color: rgba(245,245,240,0.6); line-height: 1.8; margin-bottom: 2.5rem; max-width: 420px; }
  .hero-btns { display: flex; gap: 1rem; flex-wrap: wrap; }
  .btn-primary { background: #f5f5f0; color: #0d0d0d; padding: 0.85rem 2.2rem; font-size: 0.7rem; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 600; cursor: pointer; border: none; font-family: 'Montserrat', sans-serif; transition: background-color 0.2s; }
  .btn-primary:hover { background: #c9b99a; }
  .btn-outline { background: transparent; color: #f5f5f0; padding: 0.85rem 2.2rem; font-size: 0.7rem; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 600; cursor: pointer; border: 1px solid rgba(245,245,240,0.4); font-family: 'Montserrat', sans-serif; transition: background-color 0.2s, border-color 0.2s, color 0.2s; }
  .btn-outline:hover { border-color: #f5f5f0; }
  .hero-scroll { position: absolute; bottom: 2.5rem; left: 8vw; font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(245,245,240,0.35); display: flex; align-items: center; gap: 1rem; }
  .hero-scroll::before { content:''; display: block; width: 40px; height: 1px; background: rgba(245,245,240,0.35); }

  /* Section */
  .section { padding: 7rem 8vw; }
  .section-alt { background: #111; }
  .section-label { font-size: 0.6rem; letter-spacing: 0.35em; text-transform: uppercase; color: #c9b99a; margin-bottom: 1rem; }
  .section-title { font-family: 'Cormorant Garamond', serif; font-size: clamp(2.2rem, 4vw, 3.5rem); font-weight: 300; color: #f5f5f0; margin-bottom: 0.5rem; }
  .section-sub { font-size: 0.78rem; color: rgba(245,245,240,0.5); letter-spacing: 0.06em; line-height: 1.8; max-width: 480px; }
  .section-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 4rem; flex-wrap: wrap; gap: 2rem; }

  /* Category pills */
  .cats { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 3rem; }
  .cat-pill { padding: 0.5rem 1.4rem; font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase; cursor: pointer; border: 1px solid rgba(245,245,240,0.2); color: rgba(245,245,240,0.5); background: transparent; font-family: 'Montserrat', sans-serif; transition: all 0.2s; }
  .cat-pill:hover, .cat-pill.active { border-color: #c9b99a; color: #c9b99a; }

  /* Service cards */
  .services-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5px; }
  .service-card { background: #111; position: relative; overflow: hidden; cursor: pointer; transition: transform 0.3s; }
  .service-card:hover { transform: translateY(-4px); }
  .service-card:hover .service-img { transform: scale(1.05); }
  .service-img-wrap { height: 220px; overflow: hidden; }
  .service-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease; opacity: 0.85; }
  .service-body { padding: 1.5rem; }
  .service-cat { font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase; color: #c9b99a; margin-bottom: 0.6rem; }
  .service-name { font-family: 'Cormorant Garamond', serif; font-size: 1.4rem; font-weight: 400; color: #f5f5f0; margin-bottom: 0.5rem; }
  .service-desc { font-size: 0.72rem; color: rgba(245,245,240,0.5); line-height: 1.8; margin-bottom: 1rem; }
  .service-meta { display: flex; justify-content: space-between; align-items: center; }
  .service-price { font-family: 'Cormorant Garamond', serif; font-size: 1.1rem; color: #f5f5f0; }
  .service-price span { font-size: 0.6rem; font-family: 'Montserrat', sans-serif; letter-spacing: 0.1em; color: rgba(245,245,240,0.4); margin-right: 0.3rem; }
  .service-dur { font-size: 0.6rem; letter-spacing: 0.1em; color: rgba(245,245,240,0.4); }
  .badge-featured { position: absolute; top: 1rem; left: 1rem; background: #c9b99a; color: #0d0d0d; font-size: 0.55rem; letter-spacing: 0.2em; text-transform: uppercase; padding: 0.3rem 0.8rem; font-weight: 600; }

  /* Offers */
  .offers-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 2px; }
  .offer-card { background: #161616; border: 1px solid rgba(255,255,255,0.06); padding: 2.5rem; position: relative; overflow: hidden; }
  .offer-card::before { content:''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: #c9b99a; }
  .offer-badge { font-size: 0.55rem; letter-spacing: 0.2em; text-transform: uppercase; color: #c9b99a; border: 1px solid rgba(201,185,154,0.4); padding: 0.25rem 0.7rem; display: inline-block; margin-bottom: 1.5rem; }
  .offer-title { font-family: 'Cormorant Garamond', serif; font-size: 1.7rem; font-weight: 300; color: #f5f5f0; margin-bottom: 0.75rem; }
  .offer-desc { font-size: 0.72rem; color: rgba(245,245,240,0.5); line-height: 1.9; margin-bottom: 2rem; }
  .offer-price { font-family: 'Cormorant Garamond', serif; font-size: 1.3rem; color: #c9b99a; margin-bottom: 1.5rem; }
  .offer-btn { background: transparent; border: 1px solid rgba(245,245,240,0.3); color: #f5f5f0; padding: 0.7rem 1.5rem; font-size: 0.62rem; letter-spacing: 0.18em; text-transform: uppercase; cursor: pointer; font-family: 'Montserrat', sans-serif; transition: all 0.2s; }
  .offer-btn:hover { background: rgba(245,245,240,0.08); }

  /* Gallery */
  .gallery-grid { columns: 3; gap: 3px; }
  .gallery-item { break-inside: avoid; margin-bottom: 3px; position: relative; overflow: hidden; }
  .gallery-item img { width: 100%; display: block; transition: transform 0.5s, opacity 0.3s; opacity: 0.8; }
  .gallery-item:hover img { transform: scale(1.04); opacity: 1; }
  .gallery-caption { position: absolute; bottom: 0; left: 0; right: 0; padding: 1.2rem; background: linear-gradient(transparent, rgba(0,0,0,0.8)); font-size: 0.62rem; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.7); opacity: 0; transition: opacity 0.3s; }
  .gallery-item:hover .gallery-caption { opacity: 1; }
  @media (max-width: 768px) { .gallery-grid { columns: 2; } }
  @media (max-width: 480px) { .gallery-grid { columns: 1; } }

  /* Contact */
  .contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; }
  .contact-info { }
  .contact-item { display: flex; align-items: flex-start; gap: 1.2rem; margin-bottom: 2rem; }
  .contact-icon { width: 40px; height: 40px; border: 1px solid rgba(201,185,154,0.3); display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0; }
  .contact-label { font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; color: #c9b99a; margin-bottom: 0.3rem; }
  .contact-val { font-size: 0.85rem; color: rgba(245,245,240,0.7); line-height: 1.6; }
  .contact-whatsapp { display: flex; align-items: center; gap: 0.75rem; background: #25D366; color: #fff; padding: 0.9rem 2rem; font-size: 0.7rem; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 600; cursor: pointer; border: none; font-family: 'Montserrat', sans-serif; margin-top: 1.5rem; transition: opacity 0.2s; }
  .contact-whatsapp:hover { opacity: 0.88; }

  /* Booking form */
  .booking-form { background: #111; border: 1px solid rgba(255,255,255,0.08); padding: 2.5rem; }
  .form-title { font-family: 'Cormorant Garamond', serif; font-size: 1.8rem; font-weight: 300; color: #f5f5f0; margin-bottom: 2rem; }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
  .form-group { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1rem; }
  .form-label { font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(245,245,240,0.5); }
  .form-input { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #f5f5f0; padding: 0.75rem 1rem; font-size: 0.8rem; font-family: 'Montserrat', sans-serif; outline: none; transition: border-color 0.2s; }
  .form-input:focus { border-color: #c9b99a; }
  .form-input option { background: #1a1a1a; }
  .form-submit { width: 100%; background: #c9b99a; color: #0d0d0d; padding: 1rem; font-size: 0.7rem; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 600; cursor: pointer; border: none; font-family: 'Montserrat', sans-serif; margin-top: 0.5rem; transition: opacity 0.2s; }
  .form-submit:hover { opacity: 0.88; }

  /* Floating book btn */
  .sticky-book { position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 200; background: #c9b99a; color: #0d0d0d; padding: 0.85rem 1.8rem; font-size: 0.65rem; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 600; cursor: pointer; border: none; font-family: 'Montserrat', sans-serif; box-shadow: 0 8px 30px rgba(0,0,0,0.4); transition: transform 0.2s; }
  .sticky-book:hover { transform: translateY(-2px); }

  /* Footer */
  .footer { background: #080808; padding: 4rem 8vw 2rem; border-top: 1px solid rgba(255,255,255,0.06); }
  .footer-top { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 3rem; margin-bottom: 3rem; }
  .footer-brand { font-family: 'Cormorant Garamond', serif; font-size: 1.5rem; font-weight: 300; letter-spacing: 0.12em; text-transform: uppercase; color: #f5f5f0; margin-bottom: 1rem; }
  .footer-tagline { font-size: 0.72rem; color: rgba(245,245,240,0.35); line-height: 1.9; max-width: 260px; }
  .footer-heading { font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase; color: #c9b99a; margin-bottom: 1.2rem; }
  .footer-link { display: block; font-size: 0.75rem; color: rgba(245,245,240,0.4); margin-bottom: 0.6rem; cursor: pointer; transition: color 0.2s; background: none; border: none; font-family: 'Montserrat', sans-serif; text-align: left; padding: 0; }
  .footer-link:hover { color: #f5f5f0; }
  .footer-bottom { border-top: 1px solid rgba(255,255,255,0.06); padding-top: 1.5rem; display: flex; justify-content: space-between; align-items: center; }
  .footer-copy { font-size: 0.65rem; color: rgba(245,245,240,0.25); letter-spacing: 0.08em; }

  /* QR Page */
  .qr-page { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem 2rem; text-align: center; }
  .qr-box { background: #fff; padding: 2rem; display: inline-block; margin: 2rem 0; }
  .qr-box canvas { display: block; }
  .qr-instructions { font-size: 0.7rem; letter-spacing: 0.12em; color: rgba(245,245,240,0.5); max-width: 320px; line-height: 1.9; margin: 0 auto; }

  /* ── Admin Panel ── */
  .admin { display: flex; min-height: 100vh; background: #f8f8f6; color: #1a1a1a; font-family: 'Montserrat', sans-serif; }
  
  .admin-sidebar { width: 240px; background: #0d0d0d; display: flex; flex-direction: column; flex-shrink: 0; }
  .admin-logo { padding: 1.75rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .admin-logo-text { font-family: 'Cormorant Garamond', serif; font-size: 1.2rem; font-weight: 300; letter-spacing: 0.1em; text-transform: uppercase; color: #f5f5f0; }
  .admin-logo-sub { font-size: 0.55rem; letter-spacing: 0.2em; text-transform: uppercase; color: #c9b99a; margin-top: 0.2rem; }
  .admin-nav { padding: 1.5rem 0; flex: 1; }
  .admin-section-label { font-size: 0.55rem; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(255,255,255,0.25); padding: 0 1.5rem; margin-bottom: 0.5rem; margin-top: 1rem; }
  .admin-nav-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.7rem 1.5rem; font-size: 0.72rem; letter-spacing: 0.08em; color: rgba(255,255,255,0.5); cursor: pointer; transition: all 0.2s; border: none; background: none; font-family: 'Montserrat', sans-serif; width: 100%; text-align: left; }
  .admin-nav-item:hover { color: rgba(255,255,255,0.9); background: rgba(255,255,255,0.05); }
  .admin-nav-item.active { color: #c9b99a; background: rgba(201,185,154,0.1); border-right: 2px solid #c9b99a; }
  .admin-nav-icon { font-size: 1rem; width: 20px; }

  .admin-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .admin-topbar { background: #fff; border-bottom: 1px solid #e8e8e4; padding: 0 2rem; height: 64px; display: flex; align-items: center; justify-content: space-between; }
  .admin-page-title { font-family: 'Cormorant Garamond', serif; font-size: 1.5rem; font-weight: 400; color: #1a1a1a; }
  .admin-user { display: flex; align-items: center; gap: 0.75rem; font-size: 0.72rem; color: #666; }
  .admin-avatar { width: 34px; height: 34px; background: #0d0d0d; color: #c9b99a; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 600; letter-spacing: 0.05em; }
  
  .admin-content { flex: 1; padding: 2rem; overflow-y: auto; }

  /* Admin stats */
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; margin-bottom: 2.5rem; }
  .stat-card { background: #fff; padding: 1.5rem; border: 1px solid #e8e8e4; }
  .stat-label { font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; color: #999; margin-bottom: 0.5rem; }
  .stat-value { font-family: 'Cormorant Garamond', serif; font-size: 2.2rem; font-weight: 400; color: #1a1a1a; }
  .stat-change { font-size: 0.65rem; color: #4CAF50; margin-top: 0.3rem; }

  /* Admin table */
  .admin-table-wrap { background: #fff; border: 1px solid #e8e8e4; overflow: hidden; }
  .admin-table-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid #e8e8e4; }
  .admin-table-title { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #1a1a1a; }
  .admin-search { background: #f8f8f6; border: 1px solid #e8e8e4; padding: 0.55rem 1rem; font-size: 0.75rem; font-family: 'Montserrat', sans-serif; color: #1a1a1a; outline: none; width: 220px; }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #f8f8f6; }
  th { padding: 0.75rem 1rem; font-size: 0.6rem; letter-spacing: 0.18em; text-transform: uppercase; color: #999; font-weight: 600; text-align: left; border-bottom: 1px solid #e8e8e4; }
  td { padding: 0.9rem 1rem; font-size: 0.75rem; color: #333; border-bottom: 1px solid #f0f0ec; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #fafaf8; }
  .badge { display: inline-block; padding: 0.2rem 0.6rem; font-size: 0.58rem; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 600; }
  .badge-active { background: #e8f5e9; color: #2e7d32; }
  .badge-inactive { background: #fce4ec; color: #b71c1c; }
  .badge-gold { background: #fff8e1; color: #f57f17; }

  .tbl-actions { display: flex; gap: 0.5rem; }
  .tbl-btn { padding: 0.35rem 0.75rem; font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; border: 1px solid #ddd; background: transparent; font-family: 'Montserrat', sans-serif; color: #555; transition: all 0.15s; }
  .tbl-btn:hover { background: #1a1a1a; color: #fff; border-color: #1a1a1a; }
  .tbl-btn.danger { color: #b71c1c; border-color: #f5c6cb; }
  .tbl-btn.danger:hover { background: #b71c1c; color: #fff; border-color: #b71c1c; }

  /* Admin add btn */
  .admin-add-btn { background: #0d0d0d; color: #fff; padding: 0.6rem 1.4rem; font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase; cursor: pointer; border: none; font-family: 'Montserrat', sans-serif; transition: opacity 0.2s; }
  .admin-add-btn:hover { opacity: 0.8; }

  /* Modal */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 1rem; }
  .modal { background: #fff; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; }
  .modal-header { padding: 1.5rem; border-bottom: 1px solid #e8e8e4; display: flex; justify-content: space-between; align-items: center; }
  .modal-title { font-family: 'Cormorant Garamond', serif; font-size: 1.4rem; color: #1a1a1a; }
  .modal-close { background: none; border: none; font-size: 1.3rem; cursor: pointer; color: #999; padding: 0; }
  .modal-body { padding: 1.5rem; }
  .modal-footer { padding: 1rem 1.5rem; border-top: 1px solid #e8e8e4; display: flex; justify-content: flex-end; gap: 0.75rem; }
  .admin-form-group { margin-bottom: 1.25rem; }
  .admin-label { font-size: 0.6rem; letter-spacing: 0.18em; text-transform: uppercase; color: #666; display: block; margin-bottom: 0.4rem; }
  .admin-input { width: 100%; background: #f8f8f6; border: 1px solid #e8e8e4; padding: 0.7rem 0.9rem; font-size: 0.8rem; font-family: 'Montserrat', sans-serif; color: #1a1a1a; outline: none; transition: border-color 0.2s; }
  .admin-input:focus { border-color: #1a1a1a; }
  .admin-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

  /* Toast */
  .toast { position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%); background: #0d0d0d; color: #f5f5f0; padding: 0.85rem 2rem; font-size: 0.72rem; letter-spacing: 0.1em; z-index: 9999; animation: slideUp 0.3s ease; }
  @keyframes slideUp { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

  /* Chart */
  .chart-bars { display: flex; align-items: flex-end; gap: 6px; height: 80px; margin-top: 1rem; }
  .chart-bar { flex: 1; background: #c9b99a; opacity: 0.7; min-width: 8px; transition: opacity 0.2s; }
  .chart-bar:hover { opacity: 1; }

  /* Login */
  .admin-login { min-height: 100vh; background: #0d0d0d; display: flex; align-items: center; justify-content: center; padding: 2rem; }
  .login-card { background: #111; border: 1px solid rgba(255,255,255,0.08); padding: 3rem; width: 100%; max-width: 400px; }
  .login-logo { font-family: 'Cormorant Garamond', serif; font-size: 1.6rem; font-weight: 300; letter-spacing: 0.15em; text-transform: uppercase; color: #f5f5f0; text-align: center; margin-bottom: 0.5rem; }
  .login-sub { font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase; color: #c9b99a; text-align: center; margin-bottom: 2.5rem; }
  .login-title { font-size: 0.75rem; color: rgba(245,245,240,0.5); text-align: center; margin-bottom: 2rem; letter-spacing: 0.05em; }
  .login-input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #f5f5f0; padding: 0.85rem 1rem; font-size: 0.82rem; font-family: 'Montserrat', sans-serif; outline: none; margin-bottom: 1rem; transition: border-color 0.2s; }
  .login-input:focus { border-color: #c9b99a; }
  .login-btn { width: 100%; background: #c9b99a; color: #0d0d0d; padding: 0.9rem; font-size: 0.7rem; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 600; cursor: pointer; border: none; font-family: 'Montserrat', sans-serif; margin-top: 0.5rem; }
  .login-hint { font-size: 0.62rem; color: rgba(245,245,240,0.2); text-align: center; margin-top: 1.5rem; }

  /* Toggle */
  .toggle { position: relative; width: 40px; height: 22px; }
  .toggle input { opacity: 0; width: 0; height: 0; }
  .slider-toggle { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #ddd; transition: .3s; border-radius: 22px; }
  .slider-toggle::before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background: white; transition: .3s; border-radius: 50%; }
  input:checked + .slider-toggle { background: #c9b99a; }
  input:checked + .slider-toggle::before { transform: translateX(18px); }

  /* Analytics chart area */
  .analytics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 2rem; }
  .analytics-card { background: #fff; border: 1px solid #e8e8e4; padding: 1.5rem; }
  .analytics-card-title { font-size: 0.65rem; letter-spacing: 0.18em; text-transform: uppercase; color: #999; margin-bottom: 1rem; }
  .analytics-big { font-family: 'Cormorant Garamond', serif; font-size: 3rem; font-weight: 300; color: #1a1a1a; }

  @media (max-width: 900px) {
    .stats-grid { grid-template-columns: 1fr 1fr; }
    .admin-sidebar { width: 60px; }
    .admin-logo-text, .admin-logo-sub, .admin-section-label, .admin-nav-item span { display: none; }
    .admin-logo { padding: 1rem; }
    .admin-nav-item { justify-content: center; padding: 0.7rem; }
    .contact-grid { grid-template-columns: 1fr; }
    .footer-top { grid-template-columns: 1fr 1fr; }
    .hero-title { font-size: 3rem; }
    .analytics-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 600px) {
    body { padding-bottom: 72px !important; }
    .nav-links { display: none; }
    .nav-cta { display: none !important; }
    .services-grid { grid-template-columns: 1fr; }
    .form-row { grid-template-columns: 1fr; }
    .stats-grid { grid-template-columns: 1fr 1fr; }
    .sticky-book {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      width: 100%;
      margin: 0;
      padding: 1.1rem;
      font-size: 0.72rem;
      letter-spacing: 0.2em;
      border-radius: 0;
      text-align: center;
      z-index: 999;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.5);
      transform: none !important;
    }
  }
`;

// ─── Simple QR Generator (canvas-based) ─────────────────────────────────────

function QRCanvas({ text, size = 180 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const cellSize = size / 25;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#000";
    // Simple visual placeholder QR pattern
    const pattern = [];
    for (let r = 0; r < 25; r++) {
      for (let c = 0; c < 25; c++) {
        const inCorner = (r < 8 && c < 8) || (r < 8 && c > 16) || (r > 16 && c < 8);
        if (inCorner) {
          const inner = (r === 0 || r === 7 || c === 0 || c === 7) || (r > 1 && r < 6 && c > 1 && c < 6 && !(r === 2 || r === 5 || c === 2 || c === 5));
          if (inner) ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
        } else {
          const hash = ((r * 31 + c * 7) ^ (text.charCodeAt((r * 25 + c) % text.length) || 0)) % 3;
          if (hash === 0) ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
        }
      }
    }
  }, [text, size]);
  return <canvas ref={canvasRef} width={size} height={size} />;
}

// ─── Toast ──────────────────────────────────────────────────────────────────

function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t); }, []);
  return <div className="toast">{msg}</div>;
}

// ─── Modal ──────────────────────────────────────────────────────────────────

function Modal({ title, onClose, onSave, children }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <button className="tbl-btn" onClick={onClose}>Cancel</button>
          <button className="admin-add-btn" onClick={onSave}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// ─── Customer App ────────────────────────────────────────────────────────────

function CustomerApp({ services, categories, offers, gallery, settings, onSwitchAdmin, onSubmitBooking }) {
  const [page, setPage] = useState("home");
  const [filterCat, setFilterCat] = useState("all");
  const [search, setSearch] = useState("");
  const [bookModal, setBookModal] = useState(false);
  const [bookForm, setBookForm] = useState({ name: "", phone: "", service: "", date: "", time: "", notes: "" });
  const [toast, setToast] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const activeServices = services.filter(s => s.active);
  const filtered = activeServices.filter(s =>
    (filterCat === "all" || s.category === filterCat) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase()))
  );
  const featured = activeServices.filter(s => s.featured);

  const submitBooking = async () => {
    if (!bookForm.name || !bookForm.phone) { setToast("Please fill required fields"); return; }
    try {
      await onSubmitBooking(bookForm);
      setSubmitted(true);
      setToast("Booking inquiry submitted!");
      setTimeout(() => { setBookModal(false); setSubmitted(false); setBookForm({ name:"", phone:"", service:"", date:"", time:"", notes:"" }); }, 2000);
    } catch (err) {
      setToast(err.message || "Could not submit booking. Try again.");
    }
  };

  return (
    <div className="app">
      <style>{css}</style>
      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}

      {/* Nav */}
      <nav className="nav">
        <div className="nav-logo serif" onClick={() => setPage("home")} style={{cursor:"pointer"}}>
          Toni<span>&</span>Guy
        </div>
        <div className="nav-links">
          {["home","services","gallery","offers","contact"].map(p => (
            <button key={p} className={`nav-link ${page===p?"active":""}`} onClick={() => setPage(p)}>
              {p}
            </button>
          ))}
          <button className="nav-link" onClick={onSwitchAdmin} style={{borderLeft:"1px solid rgba(255,255,255,0.1)", paddingLeft:"2rem", marginLeft:"0.5rem"}}>Admin ↗</button>
        </div>
        <button className="nav-cta" onClick={() => setBookModal(true)}>Book Now</button>
      </nav>

      {/* ── HOME ── */}
      {page === "home" && (<>
        <section className="hero">
          <div className="hero-bg"></div>
          <div className="hero-overlay"></div>
          <div className="hero-content">
            <p className="hero-eyebrow">World's #1 Hairdressing Brand — India</p>
            <h1 className="hero-title serif">Where Style<br/>Meets <em>Artistry</em></h1>
            <p className="hero-sub">An elevated salon experience crafted for those who demand the extraordinary. From precision cuts to full colour transformations — excellence is our only standard.</p>
            <div className="hero-btns">
              <button className="btn-primary" onClick={() => setBookModal(true)}>Reserve Appointment</button>
              <button className="btn-outline" onClick={() => setPage("services")}>Explore Services</button>
            </div>
          </div>
          <div className="hero-scroll">Scroll to explore</div>
        </section>

        {/* Featured Services */}
        <section className="section">
          <div className="section-header">
            <div>
              <p className="section-label">Our Expertise</p>
              <h2 className="section-title serif">Signature Services</h2>
              <p className="section-sub">Handcrafted experiences by our award-winning team of master stylists.</p>
            </div>
            <button className="btn-outline" onClick={() => setPage("services")}>View All</button>
          </div>
          <div className="services-grid">
            {featured.slice(0,4).map(s => (
              <div key={s.id} className="service-card">
                {s.featured && <div className="badge-featured">Signature</div>}
                <div className="service-img-wrap">
                  <img className="service-img" src={s.image} alt={s.name} loading="lazy" />
                </div>
                <div className="service-body">
                  <div className="service-cat">{categories.find(c=>c.slug===s.category)?.name}</div>
                  <div className="service-name serif">{s.name}</div>
                  <div className="service-desc">{s.description}</div>
                  <div className="service-meta">
                    <div className="service-price"><span>from</span>₹{s.price_from}</div>
                    <div className="service-dur">{s.duration}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Offers strip */}
        <section className="section section-alt">
          <div className="section-header">
            <div>
              <p className="section-label">Exclusive Offers</p>
              <h2 className="section-title serif">Current Promotions</h2>
            </div>
          </div>
          <div className="offers-grid">
            {offers.filter(o=>o.active).map(o => (
              <div key={o.id} className="offer-card">
                <div className="offer-badge">{o.badge}</div>
                <div className="offer-title serif">{o.title}</div>
                <div className="offer-desc">{o.description}</div>
                <div className="offer-price serif">{o.price}</div>
                <button className="offer-btn" onClick={() => setBookModal(true)}>Enquire Now</button>
              </div>
            ))}
          </div>
        </section>
      </>)}

      {/* ── SERVICES ── */}
      {page === "services" && (
        <section className="section">
          <div style={{marginBottom:"3rem"}}>
            <p className="section-label">What We Offer</p>
            <h2 className="section-title serif">All Services</h2>
          </div>
          <div style={{display:"flex", gap:"1rem", marginBottom:"2rem", flexWrap:"wrap", alignItems:"center"}}>
            <input className="form-input" placeholder="Search services..." style={{maxWidth:260, background:"rgba(255,255,255,0.05)"}} value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
          <div className="cats">
            <button className={`cat-pill ${filterCat==="all"?"active":""}`} onClick={() => setFilterCat("all")}>All</button>
            {categories.map(c => (
              <button key={c.id} className={`cat-pill ${filterCat===c.slug?"active":""}`} onClick={() => setFilterCat(c.slug)}>{c.name}</button>
            ))}
          </div>
          <div className="services-grid">
            {filtered.map(s => (
              <div key={s.id} className="service-card">
                {s.featured && <div className="badge-featured">Featured</div>}
                <div className="service-img-wrap">
                  <img className="service-img" src={s.image} alt={s.name} loading="lazy" />
                </div>
                <div className="service-body">
                  <div className="service-cat">{categories.find(c=>c.slug===s.category)?.name}</div>
                  <div className="service-name serif">{s.name}</div>
                  <div className="service-desc">{s.description}</div>
                  <div className="service-meta">
                    <div className="service-price">₹{s.price_from}</div>
                    <div className="service-dur">{s.duration}</div>
                  </div>
                  <button className="btn-primary" style={{marginTop:"1rem", width:"100%", padding:"0.65rem"}} onClick={() => { setBookForm(f=>({...f, service:s.name})); setBookModal(true); }}>Book This Service</button>
                </div>
              </div>
            ))}
          </div>
          {filtered.length === 0 && <p style={{color:"rgba(245,245,240,0.3)", fontSize:"0.85rem", textAlign:"center", padding:"4rem 0"}}>No services found.</p>}
        </section>
      )}

      {/* ── GALLERY ── */}
      {page === "gallery" && (
        <section className="section">
          <div style={{marginBottom:"3rem"}}>
            <p className="section-label">Our Work</p>
            <h2 className="section-title serif">The Gallery</h2>
            <p className="section-sub">A curated look at our finest transformations and creative work.</p>
          </div>
          <div className="gallery-grid">
            {gallery.map(g => (
              <div key={g.id} className="gallery-item">
                <img src={g.url} alt={g.caption} loading="lazy" />
                <div className="gallery-caption">{g.caption}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── OFFERS ── */}
      {page === "offers" && (
        <section className="section">
          <div style={{marginBottom:"3rem"}}>
            <p className="section-label">Exclusive Deals</p>
            <h2 className="section-title serif">Memberships & Offers</h2>
            <p className="section-sub">Curated packages designed for those who value excellence as a lifestyle.</p>
          </div>
          <div className="offers-grid">
            {offers.filter(o=>o.active).map(o => (
              <div key={o.id} className="offer-card">
                <div className="offer-badge">{o.badge}</div>
                <div className="offer-title serif">{o.title}</div>
                <div className="offer-desc">{o.description}</div>
                <div className="offer-price serif">{o.price}</div>
                <button className="offer-btn" onClick={() => setBookModal(true)}>Claim Offer</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── CONTACT ── */}
      {page === "contact" && (
        <section className="section">
          <div style={{marginBottom:"3rem"}}>
            <p className="section-label">Reach Us</p>
            <h2 className="section-title serif">Contact & Booking</h2>
          </div>
          <div className="contact-grid">
            <div className="contact-info">
              <div className="contact-item">
                <div className="contact-icon">📍</div>
                <div>
                  <div className="contact-label">Location</div>
                  <div className="contact-val">{settings.address || "Chennai & Pondicherry, India\nFranchisee of Essensuals UK"}</div>
                </div>
              </div>
              <div className="contact-item">
                <div className="contact-icon">🕐</div>
                <div>
                  <div className="contact-label">Working Hours</div>
                  <div className="contact-val">{settings.hours || "Mon–Sat: 10:00 AM – 8:00 PM\nSunday: 10:00 AM – 6:00 PM"}</div>
                </div>
              </div>
              <div className="contact-item">
                <div className="contact-icon">📞</div>
                <div>
                  <div className="contact-label">Phone</div>
                  <div className="contact-val">{settings.phone || "+91 44 1234 5678"}</div>
                </div>
              </div>
              <div className="contact-item">
                <div className="contact-icon">📧</div>
                <div>
                  <div className="contact-label">Email</div>
                  <div className="contact-val">{settings.email || "info@toniandguy.in"}</div>
                </div>
              </div>
              <button className="contact-whatsapp" onClick={() => alert("Opening WhatsApp...")}>
                <span style={{fontSize:"1.2rem"}}>💬</span> Chat on WhatsApp
              </button>
            </div>
            <div>
              <div className="booking-form">
                <div className="form-title serif">Book an Appointment</div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input className="form-input" value={bookForm.name} onChange={e=>setBookForm(f=>({...f, name:e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone *</label>
                    <input className="form-input" value={bookForm.phone} onChange={e=>setBookForm(f=>({...f, phone:e.target.value}))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Service</label>
                  <select className="form-input" value={bookForm.service} onChange={e=>setBookForm(f=>({...f, service:e.target.value}))}>
                    <option value="">Select a service</option>
                    {activeServices.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input type="date" className="form-input" value={bookForm.date} onChange={e=>setBookForm(f=>({...f, date:e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Time</label>
                    <input type="time" className="form-input" value={bookForm.time} onChange={e=>setBookForm(f=>({...f, time:e.target.value}))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-input" rows={3} value={bookForm.notes} onChange={e=>setBookForm(f=>({...f, notes:e.target.value}))} />
                </div>
                <button className="form-submit" onClick={submitBooking}>Confirm Booking Request</button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="footer">
        <div className="footer-top">
          <div>
            <div className="footer-brand serif">Toni&Guy</div>
            <div className="footer-tagline">A premium salon experience where artistry and elegance converge. Operated under licence by Paulsons Beauty and Fashion Pvt Ltd. A franchisee of Essensuals UK.</div>
          </div>
          <div>
            <div className="footer-heading">Navigation</div>
            {["home","services","gallery","offers","contact"].map(p => (
              <button key={p} className="footer-link" onClick={() => setPage(p)}>{p}</button>
            ))}
          </div>
          <div>
            <div className="footer-heading">Services</div>
            {categories.slice(0,5).map(c => <div key={c.id} className="footer-link">{c.name}</div>)}
          </div>
          <div>
            <div className="footer-heading">Contact</div>
            <div className="footer-link">{settings.phone || "+91 44 1234 5678"}</div>
            <div className="footer-link">{settings.email || "info@toniandguy.in"}</div>
            <div style={{marginTop:"1rem", display:"flex", gap:"0.75rem"}}>
              {["IG","FB","TW","YT"].map(s => (
                <div key={s} style={{width:32, height:32, border:"1px solid rgba(255,255,255,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.55rem", letterSpacing:"0.05em", color:"rgba(255,255,255,0.4)", cursor:"pointer"}}>{s}</div>
              ))}
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="footer-copy">© 2025 Toni&Guy. All rights reserved.</div>
          <div className="footer-copy">A franchisee of Essensuals UK — Paulsons Beauty & Fashion</div>
        </div>
      </footer>

      <button className="sticky-book" onClick={() => setBookModal(true)}>Book Now</button>

      {/* Booking Modal */}
      {bookModal && (
        <Modal title="Reserve Your Appointment" onClose={() => setBookModal(false)} onSave={submitBooking}>
          {submitted ? (
            <div style={{textAlign:"center", padding:"2rem 0"}}>
              <div style={{fontSize:"2rem", marginBottom:"1rem"}}>✓</div>
              <div style={{fontFamily:"'Cormorant Garamond', serif", fontSize:"1.4rem", color:"#1a1a1a"}}>Booking Received</div>
              <div style={{fontSize:"0.75rem", color:"#666", marginTop:"0.5rem"}}>We'll confirm via WhatsApp shortly.</div>
            </div>
          ) : (
            <>
              <div className="admin-row">
                <div className="admin-form-group">
                  <label className="admin-label">Full Name *</label>
                  <input className="admin-input" value={bookForm.name} onChange={e=>setBookForm(f=>({...f,name:e.target.value}))} />
                </div>
                <div className="admin-form-group">
                  <label className="admin-label">Phone *</label>
                  <input className="admin-input" value={bookForm.phone} onChange={e=>setBookForm(f=>({...f,phone:e.target.value}))} />
                </div>
              </div>
              <div className="admin-form-group">
                <label className="admin-label">Service</label>
                <select className="admin-input" value={bookForm.service} onChange={e=>setBookForm(f=>({...f,service:e.target.value}))}>
                  <option value="">Select a service</option>
                  {activeServices.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div className="admin-row">
                <div className="admin-form-group">
                  <label className="admin-label">Date</label>
                  <input type="date" className="admin-input" value={bookForm.date} onChange={e=>setBookForm(f=>({...f,date:e.target.value}))} />
                </div>
                <div className="admin-form-group">
                  <label className="admin-label">Time</label>
                  <input type="time" className="admin-input" value={bookForm.time} onChange={e=>setBookForm(f=>({...f,time:e.target.value}))} />
                </div>
              </div>
              <div className="admin-form-group">
                <label className="admin-label">Notes</label>
                <textarea className="admin-input" rows={3} value={bookForm.notes} onChange={e=>setBookForm(f=>({...f,notes:e.target.value}))} />
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

// ─── Admin Panel ─────────────────────────────────────────────────────────────

function AdminPanel({ services, setServices, categories, setCategories, offers, setOffers, gallery, setGallery, settings, setSettings, bookings, setBookings, onSwitchCustomer, onLogout }) {
  const [page, setPage] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [editData, setEditData] = useState({});
  const [search, setSearch] = useState("");

  const showToast = (msg) => { setToast(msg); };

  const openAdd = (type) => { setEditData({ _type: type, active: true, featured: false }); setModal("add"); };
  const openEdit = (type, item) => { setEditData({ ...item, _type: type }); setModal("edit"); };

  const saveItem = async () => {
    const { _type, ...data } = editData;
    try {
      if (_type === "service") {
        if (modal === "add") {
          const row = await createService(data);
          setServices(s => [...s, row]);
        } else {
          const row = await updateService(data.id, data);
          setServices(s => s.map(x => x.id === data.id ? row : x));
        }
      } else if (_type === "offer") {
        if (modal === "add") {
          const row = await createOffer(data);
          setOffers(o => [...o, row]);
        } else {
          const row = await updateOffer(data.id, data);
          setOffers(o => o.map(x => x.id === data.id ? row : x));
        }
      } else if (_type === "category") {
        if (modal === "add") {
          const row = await createCategory(data);
          setCategories(c => [...c, row]);
        } else {
          const row = await updateCategory(data.id, data);
          setCategories(c => c.map(x => x.id === data.id ? row : x));
        }
      } else if (_type === "gallery") {
        if (modal === "add") {
          const row = await createGalleryItem(data);
          setGallery(g => [...g, row]);
        } else {
          const row = await updateGalleryItem(data.id, data);
          setGallery(g => g.map(x => x.id === data.id ? row : x));
        }
      }
      setModal(null);
      showToast("Changes saved successfully");
    } catch (err) {
      showToast(err.message || "Save failed");
    }
  };

  const deleteItem = async (type, id) => {
    try {
      if (type === "service") {
        await deleteService(id);
        setServices(s => s.filter(x => x.id !== id));
      } else if (type === "offer") {
        await deleteOffer(id);
        setOffers(o => o.filter(x => x.id !== id));
      } else if (type === "category") {
        await deleteCategory(id);
        setCategories(c => c.filter(x => x.id !== id));
      } else if (type === "gallery") {
        await deleteGalleryItem(id);
        setGallery(g => g.filter(x => x.id !== id));
      }
      showToast("Item deleted");
    } catch (err) {
      showToast(err.message || "Delete failed");
    }
  };

  const toggleService = async (id, field) => {
    const current = services.find(x => x.id === id);
    if (!current) return;
    try {
      const row = await patchService(id, { [field]: !current[field] });
      setServices(s => s.map(x => x.id === id ? row : x));
      showToast("Updated");
    } catch (err) {
      showToast(err.message || "Update failed");
    }
  };

  const confirmBooking = async (id) => {
    try {
      const row = await updateBookingStatus(id, "confirmed");
      setBookings(b => b.map(x => x.id === id ? row : x));
      showToast("Booking confirmed");
    } catch (err) {
      showToast(err.message || "Could not update booking");
    }
  };

  const navItems = [
    { id:"dashboard", icon:"📊", label:"Dashboard" },
    { id:"services", icon:"✂️", label:"Services" },
    { id:"categories", icon:"📂", label:"Categories" },
    { id:"offers", icon:"🏷️", label:"Offers" },
    { id:"gallery", icon:"🖼️", label:"Gallery" },
    { id:"bookings", icon:"📅", label:"Bookings" },
    { id:"qr", icon:"⬛", label:"QR Code" },
    { id:"analytics", icon:"📈", label:"Analytics" },
    { id:"settings", icon:"⚙️", label:"Settings" },
  ];

  const filteredServices = services.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="admin">
      <style>{css}</style>
      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}

      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <div className="admin-logo-text">Toni&Guy</div>
          <div className="admin-logo-sub">Admin Panel</div>
        </div>
        <nav className="admin-nav">
          <div className="admin-section-label">Main</div>
          {navItems.slice(0,6).map(n => (
            <button key={n.id} className={`admin-nav-item ${page===n.id?"active":""}`} onClick={() => setPage(n.id)}>
              <span className="admin-nav-icon">{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
          <div className="admin-section-label">System</div>
          {navItems.slice(6).map(n => (
            <button key={n.id} className={`admin-nav-item ${page===n.id?"active":""}`} onClick={() => setPage(n.id)}>
              <span className="admin-nav-icon">{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
          <div className="admin-section-label">View</div>
          <button className="admin-nav-item" onClick={onSwitchCustomer}>
            <span className="admin-nav-icon">🌐</span>
            <span>Live Menu</span>
          </button>
        </nav>
      </aside>

      {/* Main */}
      <div className="admin-main">
        <div className="admin-topbar">
          <div className="admin-page-title">{navItems.find(n=>n.id===page)?.label || "Dashboard"}</div>
          <div className="admin-user">
            <div className="admin-avatar">AD</div>
            <span>Admin</span>
            <button type="button" className="tbl-btn" onClick={onLogout}>Sign out</button>
          </div>
        </div>

        <div className="admin-content">

          {/* ── Dashboard ── */}
          {page === "dashboard" && (<>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Total Services</div>
                <div className="stat-value">{services.length}</div>
                <div className="stat-change">↑ Active: {services.filter(s=>s.active).length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">QR Scans</div>
                <div className="stat-value">{ANALYTICS.scans.toLocaleString()}</div>
                <div className="stat-change">↑ 18% this week</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Bookings</div>
                <div className="stat-value">{bookings.length}</div>
                <div className="stat-change">↑ 7 pending</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Offer Clicks</div>
                <div className="stat-value">{ANALYTICS.offers_clicked}</div>
                <div className="stat-change">↑ 24% vs last week</div>
              </div>
            </div>

            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.5rem"}}>
              <div className="admin-table-wrap">
                <div className="admin-table-header">
                  <div className="admin-table-title">Recent Services</div>
                </div>
                <table>
                  <thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Status</th></tr></thead>
                  <tbody>
                    {services.slice(0,5).map(s => (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                        <td><span className="badge badge-gold">{s.category}</span></td>
                        <td>₹{s.price_from}</td>
                        <td><span className={`badge ${s.active?"badge-active":"badge-inactive"}`}>{s.active?"Active":"Off"}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="admin-table-wrap" style={{padding:"1.5rem"}}>
                <div className="admin-table-title" style={{marginBottom:"1rem"}}>Weekly QR Scans</div>
                <div className="chart-bars">
                  {ANALYTICS.weekly.map((v, i) => (
                    <div key={i} className="chart-bar" style={{height: `${(v/100)*100}%`}} title={`${v} scans`}></div>
                  ))}
                </div>
                <div style={{display:"flex", justifyContent:"space-between", marginTop:"0.5rem"}}>
                  {["M","T","W","T","F","S","S"].map((d,i) => (
                    <div key={i} style={{flex:1, textAlign:"center", fontSize:"0.6rem", color:"#999"}}>{d}</div>
                  ))}
                </div>
              </div>
            </div>
          </>)}

          {/* ── Services ── */}
          {page === "services" && (<>
            <div className="admin-table-wrap">
              <div className="admin-table-header">
                <div className="admin-table-title">All Services ({filteredServices.length})</div>
                <div style={{display:"flex", gap:"1rem", alignItems:"center"}}>
                  <input className="admin-search" placeholder="Search services..." value={search} onChange={e=>setSearch(e.target.value)} />
                  <button className="admin-add-btn" onClick={() => openAdd("service")}>+ Add Service</button>
                </div>
              </div>
              <table>
                <thead><tr><th>Name</th><th>Category</th><th>Duration</th><th>Price (₹)</th><th>Featured</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {filteredServices.map(s => (
                    <tr key={s.id}>
                      <td style={{fontWeight:500}}>{s.name}</td>
                      <td><span className="badge badge-gold">{s.category}</span></td>
                      <td>{s.duration}</td>
                      <td>{s.price_from}</td>
                      <td>
                        <label className="toggle">
                          <input type="checkbox" checked={!!s.featured} onChange={() => toggleService(s.id,"featured")} />
                          <span className="slider-toggle"></span>
                        </label>
                      </td>
                      <td>
                        <label className="toggle">
                          <input type="checkbox" checked={!!s.active} onChange={() => toggleService(s.id,"active")} />
                          <span className="slider-toggle"></span>
                        </label>
                      </td>
                      <td>
                        <div className="tbl-actions">
                          <button className="tbl-btn" onClick={() => openEdit("service", s)}>Edit</button>
                          <button className="tbl-btn danger" onClick={() => deleteItem("service", s.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>)}

          {/* ── Categories ── */}
          {page === "categories" && (<>
            <div className="admin-table-wrap">
              <div className="admin-table-header">
                <div className="admin-table-title">Categories ({categories.length})</div>
                <button className="admin-add-btn" onClick={() => openAdd("category")}>+ Add Category</button>
              </div>
              <table>
                <thead><tr><th>Icon</th><th>Name</th><th>Slug</th><th>Services</th><th>Actions</th></tr></thead>
                <tbody>
                  {categories.map(c => (
                    <tr key={c.id}>
                      <td style={{fontSize:"1.3rem"}}>{c.icon}</td>
                      <td style={{fontWeight:500}}>{c.name}</td>
                      <td style={{fontFamily:"monospace",fontSize:"0.72rem",color:"#888"}}>{c.slug}</td>
                      <td>{services.filter(s=>s.category===c.slug).length}</td>
                      <td>
                        <div className="tbl-actions">
                          <button className="tbl-btn" onClick={() => openEdit("category", c)}>Edit</button>
                          <button className="tbl-btn danger" onClick={() => deleteItem("category", c.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>)}

          {/* ── Offers ── */}
          {page === "offers" && (<>
            <div className="admin-table-wrap">
              <div className="admin-table-header">
                <div className="admin-table-title">Offers & Promotions</div>
                <button className="admin-add-btn" onClick={() => openAdd("offer")}>+ Add Offer</button>
              </div>
              <table>
                <thead><tr><th>Title</th><th>Badge</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {offers.map(o => (
                    <tr key={o.id}>
                      <td style={{fontWeight:500}}>{o.title}</td>
                      <td><span className="badge badge-gold">{o.badge}</span></td>
                      <td>{o.price}</td>
                      <td><span className={`badge ${o.active?"badge-active":"badge-inactive"}`}>{o.active?"Active":"Inactive"}</span></td>
                      <td>
                        <div className="tbl-actions">
                          <button className="tbl-btn" onClick={() => openEdit("offer", o)}>Edit</button>
                          <button className="tbl-btn danger" onClick={() => deleteItem("offer", o.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>)}

          {/* ── Gallery ── */}
          {page === "gallery" && (<>
            <div className="admin-table-wrap">
              <div className="admin-table-header">
                <div className="admin-table-title">Gallery ({gallery.length} items)</div>
                <button className="admin-add-btn" onClick={() => openAdd("gallery")}>+ Add Image</button>
              </div>
              <div style={{padding:"1.5rem", display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(160px, 1fr))", gap:"1rem"}}>
                {gallery.map(g => (
                  <div key={g.id} style={{position:"relative", background:"#f0f0ec", border:"1px solid #e8e8e4"}}>
                    <img src={g.url} alt={g.caption} style={{width:"100%", height:120, objectFit:"cover", display:"block"}} />
                    <div style={{padding:"0.5rem", fontSize:"0.62rem", color:"#666"}}>{g.caption}</div>
                    <div style={{display:"flex", gap:"0.3rem", padding:"0 0.5rem 0.5rem"}}>
                      <button className="tbl-btn" style={{fontSize:"0.55rem", flex:1}} onClick={() => openEdit("gallery", g)}>Edit</button>
                      <button className="tbl-btn danger" style={{fontSize:"0.55rem"}} onClick={() => deleteItem("gallery", g.id)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>)}

          {/* ── Bookings ── */}
          {page === "bookings" && (
            <div className="admin-table-wrap">
              <div className="admin-table-header">
                <div className="admin-table-title">Booking Inquiries</div>
                <span style={{fontSize:"0.7rem",color:"#999"}}>{bookings.filter(b => b.status === "pending").length} pending review</span>
              </div>
              <table>
                <thead><tr><th>#</th><th>Name</th><th>Phone</th><th>Service</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {bookings.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: "center", color: "#999", padding: "2rem" }}>No bookings yet</td></tr>
                  )}
                  {bookings.map(b => (
                    <tr key={b.id}>
                      <td style={{fontFamily:"monospace",fontSize:"0.7rem",color:"#888"}}>{String(b.id).slice(0, 8)}</td>
                      <td style={{fontWeight:500}}>{b.name}</td>
                      <td style={{color:"#555"}}>{b.phone}</td>
                      <td>{b.service || "—"}</td>
                      <td>{b.date || "—"}</td>
                      <td><span className={`badge ${b.status==="confirmed"?"badge-active":b.status==="pending"?"badge-gold":"badge-inactive"}`}>{b.status}</span></td>
                      <td>
                        <div className="tbl-actions">
                          {b.status === "pending" && (
                            <button type="button" className="tbl-btn" onClick={() => confirmBooking(b.id)}>Confirm</button>
                          )}
                          <button type="button" className="tbl-btn" onClick={() => window.open(`https://wa.me/${(settings.whatsapp || settings.phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${b.name}, regarding your booking for ${b.service || "a service"}`)}`, "_blank")}>WhatsApp</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── QR ── */}
          {page === "qr" && (
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.5rem"}}>
              {["Chennai — Anna Nagar", "Pondicherry Branch"].map((branch, i) => (
                <div key={i} className="admin-table-wrap" style={{padding:"2rem", textAlign:"center"}}>
                  <div style={{fontFamily:"'Cormorant Garamond',serif", fontSize:"1.3rem", color:"#1a1a1a", marginBottom:"0.5rem"}}>{branch}</div>
                  <div style={{fontSize:"0.65rem", letterSpacing:"0.15em", color:"#999", marginBottom:"1.5rem", textTransform:"uppercase"}}>Digital Menu QR</div>
                  <div style={{background:"#fff", border:"1px solid #e8e8e4", display:"inline-block", padding:"1.2rem", marginBottom:"1.5rem"}}>
                    <QRCanvas text={`https://toniandguy.com/menu/branch-${i+1}`} size={160} />
                  </div>
                  <div style={{fontSize:"0.65rem", color:"#999", marginBottom:"1.5rem", letterSpacing:"0.1em"}}>
                    toniandguy.com/menu/branch-{i+1}
                  </div>
                  <div style={{display:"flex", gap:"0.75rem", justifyContent:"center"}}>
                    <button className="admin-add-btn" onClick={() => showToast("QR downloaded as PNG")}>↓ Download PNG</button>
                    <button className="tbl-btn" onClick={() => showToast("Link copied!")}>Copy Link</button>
                  </div>
                  <div style={{marginTop:"1.5rem", padding:"1rem", background:"#f8f8f6", border:"1px solid #e8e8e4"}}>
                    <div style={{fontSize:"0.6rem", color:"#999", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:"0.4rem"}}>Scans this month</div>
                    <div style={{fontFamily:"'Cormorant Garamond',serif", fontSize:"2rem", color:"#1a1a1a"}}>{i===0?1284:342}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Analytics ── */}
          {page === "analytics" && (<>
            <div className="stats-grid">
              <div className="stat-card"><div className="stat-label">Total QR Scans</div><div className="stat-value">1,626</div><div className="stat-change">↑ 22% this month</div></div>
              <div className="stat-card"><div className="stat-label">Booking Rate</div><div className="stat-value">3.7%</div><div className="stat-change">↑ from 2.9%</div></div>
              <div className="stat-card"><div className="stat-label">Top Service</div><div className="stat-value" style={{fontSize:"1.4rem"}}>Creative Colour</div></div>
              <div className="stat-card"><div className="stat-label">Offer CTR</div><div className="stat-value">19.2%</div><div className="stat-change">↑ 5pts this week</div></div>
            </div>
            <div className="analytics-grid">
              <div className="analytics-card">
                <div className="analytics-card-title">QR Scans — Last 7 Days</div>
                <div className="chart-bars">
                  {ANALYTICS.weekly.map((v,i) => (
                    <div key={i} className="chart-bar" style={{height:`${(v/100)*100}%`, background:"#0d0d0d"}}></div>
                  ))}
                </div>
                <div style={{display:"flex", justifyContent:"space-between", marginTop:"0.5rem"}}>
                  {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d,i) => (
                    <div key={i} style={{flex:1, textAlign:"center", fontSize:"0.58rem", color:"#999"}}>{d}</div>
                  ))}
                </div>
              </div>
              <div className="analytics-card">
                <div className="analytics-card-title">Top Categories</div>
                {categories.slice(0,5).map((c, i) => {
                  const pct = [68,52,41,35,28][i];
                  return (
                    <div key={c.id} style={{marginBottom:"0.8rem"}}>
                      <div style={{display:"flex", justifyContent:"space-between", fontSize:"0.72rem", marginBottom:"0.3rem"}}>
                        <span style={{color:"#333"}}>{c.name}</span>
                        <span style={{color:"#999"}}>{pct}%</span>
                      </div>
                      <div style={{height:4, background:"#f0f0ec", borderRadius:2}}>
                        <div style={{height:"100%", width:`${pct}%`, background:"#c9b99a", borderRadius:2}}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>)}

          {/* ── Settings ── */}
          {page === "settings" && (
            <div style={{maxWidth:600}}>
              <div className="admin-table-wrap" style={{padding:"2rem"}}>
                <div className="admin-table-title" style={{marginBottom:"1.5rem"}}>Salon Information</div>
                {[
                  {key:"name", label:"Salon Name"},
                  {key:"phone", label:"Phone Number"},
                  {key:"email", label:"Email Address"},
                  {key:"address", label:"Address"},
                  {key:"hours", label:"Working Hours"},
                  {key:"whatsapp", label:"WhatsApp Number"},
                ].map(f => (
                  <div key={f.key} className="admin-form-group">
                    <label className="admin-label">{f.label}</label>
                    <input className="admin-input" value={settings[f.key] || ""} onChange={e => setSettings(s => ({...s, [f.key]: e.target.value}))} placeholder={`Enter ${f.label.toLowerCase()}...`} />
                  </div>
                ))}
                <button className="admin-add-btn" style={{marginTop:"1rem"}} onClick={async () => {
                  try {
                    await saveSalonSettings(settings);
                    showToast("Settings saved!");
                  } catch (err) {
                    showToast(err.message || "Could not save settings");
                  }
                }}>Save Settings</button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <Modal
          title={`${modal === "add" ? "Add" : "Edit"} ${editData._type?.charAt(0).toUpperCase() + editData._type?.slice(1)}`}
          onClose={() => setModal(null)}
          onSave={saveItem}
        >
          {editData._type === "service" && (<>
            <div className="admin-form-group"><label className="admin-label">Name</label><input className="admin-input" value={editData.name||""} onChange={e=>setEditData(d=>({...d,name:e.target.value}))} /></div>
            <div className="admin-form-group"><label className="admin-label">Category</label>
              <select className="admin-input" value={editData.category||""} onChange={e=>setEditData(d=>({...d,category:e.target.value}))}>
                <option value="">Select</option>
                {categories.map(c=><option key={c.id} value={c.slug}>{c.name}</option>)}
              </select>
            </div>
            <div className="admin-form-group"><label className="admin-label">Description</label><textarea className="admin-input" rows={3} value={editData.description||""} onChange={e=>setEditData(d=>({...d,description:e.target.value}))} /></div>
            <div className="admin-row">
              <div className="admin-form-group"><label className="admin-label">Duration</label><input className="admin-input" value={editData.duration||""} onChange={e=>setEditData(d=>({...d,duration:e.target.value}))} /></div>
              <div className="admin-form-group"><label className="admin-label">Price From (₹)</label><input type="number" className="admin-input" value={editData.price_from||""} onChange={e=>setEditData(d=>({...d,price_from:+e.target.value}))} /></div>
            </div>
            <div className="admin-form-group"><label className="admin-label">Image URL</label><input className="admin-input" value={editData.image||""} onChange={e=>setEditData(d=>({...d,image:e.target.value}))} /></div>
            <div className="admin-row">
              <div style={{display:"flex", alignItems:"center", gap:"0.75rem"}}>
                <label className="toggle"><input type="checkbox" checked={!!editData.featured} onChange={e=>setEditData(d=>({...d,featured:e.target.checked}))} /><span className="slider-toggle"></span></label>
                <label className="admin-label" style={{margin:0}}>Featured</label>
              </div>
              <div style={{display:"flex", alignItems:"center", gap:"0.75rem"}}>
                <label className="toggle"><input type="checkbox" checked={!!editData.active} onChange={e=>setEditData(d=>({...d,active:e.target.checked}))} /><span className="slider-toggle"></span></label>
                <label className="admin-label" style={{margin:0}}>Active</label>
              </div>
            </div>
          </>)}

          {editData._type === "offer" && (<>
            <div className="admin-form-group"><label className="admin-label">Title</label><input className="admin-input" value={editData.title||""} onChange={e=>setEditData(d=>({...d,title:e.target.value}))} /></div>
            <div className="admin-form-group"><label className="admin-label">Description</label><textarea className="admin-input" rows={3} value={editData.description||""} onChange={e=>setEditData(d=>({...d,description:e.target.value}))} /></div>
            <div className="admin-row">
              <div className="admin-form-group"><label className="admin-label">Badge Text</label><input className="admin-input" value={editData.badge||""} onChange={e=>setEditData(d=>({...d,badge:e.target.value}))} /></div>
              <div className="admin-form-group"><label className="admin-label">Price / Value</label><input className="admin-input" value={editData.price||""} onChange={e=>setEditData(d=>({...d,price:e.target.value}))} /></div>
            </div>
            <div style={{display:"flex", alignItems:"center", gap:"0.75rem"}}>
              <label className="toggle"><input type="checkbox" checked={!!editData.active} onChange={e=>setEditData(d=>({...d,active:e.target.checked}))} /><span className="slider-toggle"></span></label>
              <label className="admin-label" style={{margin:0}}>Active</label>
            </div>
          </>)}

          {editData._type === "category" && (<>
            <div className="admin-form-group"><label className="admin-label">Name</label><input className="admin-input" value={editData.name||""} onChange={e=>setEditData(d=>({...d,name:e.target.value}))} /></div>
            <div className="admin-row">
              <div className="admin-form-group"><label className="admin-label">Icon (emoji)</label><input className="admin-input" value={editData.icon||""} onChange={e=>setEditData(d=>({...d,icon:e.target.value}))} /></div>
              <div className="admin-form-group"><label className="admin-label">Slug</label><input className="admin-input" value={editData.slug||""} onChange={e=>setEditData(d=>({...d,slug:e.target.value}))} /></div>
            </div>
          </>)}

          {editData._type === "gallery" && (<>
            <div className="admin-form-group"><label className="admin-label">Image URL</label><input className="admin-input" value={editData.url||""} onChange={e=>setEditData(d=>({...d,url:e.target.value}))} /></div>
            <div className="admin-form-group"><label className="admin-label">Caption</label><input className="admin-input" value={editData.caption||""} onChange={e=>setEditData(d=>({...d,caption:e.target.value}))} /></div>
          </>)}
        </Modal>
      )}
    </div>
  );
}

// ─── Login ───────────────────────────────────────────────────────────────────

function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");

  const [loading, setLoading] = useState(false);

  const login = async () => {
    setErr("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onLogin();
  };

  return (
    <div className="admin-login">
      <style>{css}</style>
      <div className="login-card">
        <div className="login-logo">Toni&Guy</div>
        <div className="login-sub">Admin Portal</div>
        <div className="login-title">Sign in to continue</div>
        <input className="login-input" type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="login-input" type="password" placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!loading&&login()} />
        {err && <div style={{color:"#c9b99a", fontSize:"0.68rem", marginBottom:"0.5rem", letterSpacing:"0.05em"}}>{err}</div>}
        <button className="login-btn" onClick={login} disabled={loading}>{loading ? "Signing in…" : "Sign In"}</button>
        <div className="login-hint">Use your Supabase Auth admin account</div>
      </div>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  name: "Toni&Guy Essensuals",
  phone: "+91 44 1234 5678",
  email: "info@toniandguy.in",
  address: "Chennai & Pondicherry, India\nFranchisee of Essensuals UK",
  hours: "Mon–Sat: 10:00 AM – 8:00 PM\nSunday: 10:00 AM – 6:00 PM",
  whatsapp: "",
};

export default function App() {
  const [mode, setMode] = useState("customer");
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [offers, setOffers] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const loadData = useCallback(async ({ trySeed = false } = {}) => {
    setLoadError(null);
    try {
      let data = await fetchSalonData();
      if (data.services.length === 0 && trySeed) {
        await seedSalonData({
          categories: INITIAL_CATEGORIES,
          services: INITIAL_SERVICES,
          offers: INITIAL_OFFERS,
          gallery: GALLERY_ITEMS,
          settings: DEFAULT_SETTINGS,
        });
        data = await fetchSalonData();
      }
      if (data.services.length === 0) {
        setLoadError(
          "Database is empty. In Supabase → SQL Editor, run supabase/seed.sql (or sign in as admin to auto-seed)."
        );
        return;
      }
      setCategories(data.categories);
      setServices(data.services);
      setOffers(data.offers);
      setGallery(data.gallery);
      setBookings(data.bookings);
      if (data.settings) {
        const { id, ...rest } = data.settings;
        setSettings({ ...DEFAULT_SETTINGS, ...rest });
      }
    } catch (err) {
      setLoadError(err.message || "Failed to load salon data");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAdminLogin = useCallback(async () => {
    setMode("admin");
    setLoading(true);
    await loadData({ trySeed: true });
  }, [loadData]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      await loadData({ trySeed: !!session });
      if (session) setMode("admin");
    })();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setMode("admin-login");
    });
    return () => subscription.unsubscribe();
  }, [loadData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMode("admin-login");
  };

  const handleSubmitBooking = async (form) => {
    const row = await createBooking(form);
    setBookings(b => [row, ...b]);
  };

  if (loading) {
    return (
      <div className="admin-login">
        <style>{css}</style>
        <div className="login-card">
          <div className="login-logo">Toni&Guy</div>
          <div className="login-title">Loading salon menu…</div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="admin-login">
        <style>{css}</style>
        <div className="login-card">
          <div className="login-logo">Toni&Guy</div>
          <div className="login-title" style={{ color: "#c9b99a" }}>{loadError}</div>
          <p className="login-hint">In Supabase SQL Editor run fix-policies.sql then seed.sql, restart npm run dev.</p>
          <button className="login-btn" onClick={async () => {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            await loadData({ trySeed: !!session });
          }}>Retry</button>
        </div>
      </div>
    );
  }

  if (mode === "admin-login") return <AdminLogin onLogin={handleAdminLogin} />;

  if (mode === "admin") return (
    <AdminPanel
      services={services} setServices={setServices}
      categories={categories} setCategories={setCategories}
      offers={offers} setOffers={setOffers}
      gallery={gallery} setGallery={setGallery}
      settings={settings} setSettings={setSettings}
      bookings={bookings} setBookings={setBookings}
      onSwitchCustomer={() => setMode("customer")}
      onLogout={handleLogout}
    />
  );

  return (
    <CustomerApp
      services={services} categories={categories} offers={offers}
      gallery={gallery} settings={settings}
      onSwitchAdmin={() => setMode("admin-login")}
      onSubmitBooking={handleSubmitBooking}
    />
  );
}
