-- Run once in Supabase SQL Editor (project: wrgdvrctdsmnrmpdtdio / essesnsuals)
-- Seeds menu data; safe to re-run only on empty DB

insert into public.categories (name, icon, slug) values
  ('Men''s Cut & Style', '✂️', 'mens-cut'),
  ('Women''s Cut & Blow Dry', '💇', 'womens-cut'),
  ('Blow Dry & Styling', '💨', 'blowdry'),
  ('Shave & Beard', '🪒', 'shave'),
  ('Colour Services', '🎨', 'colour'),
  ('Straightening & Rebonding', '〰️', 'straightening'),
  ('Keratin & Botox', '✨', 'keratin'),
  ('Hair Spa & Treatments', '🌿', 'spa'),
  ('Bridal & Makeup', '👰', 'bridal'),
  ('Groom Packages', '🤵', 'groom')
on conflict (slug) do nothing;

insert into public.services (name, category, description, duration, price_from, price_to, featured, active, image) values
  ('Style Director Cut & Styling', 'mens-cut', 'The pinnacle of men''s grooming — a bespoke cut by our Style Director, available at selected outlets. Includes consultation, wash and finish.', '60 min', 1153, 1380, true, true, 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&q=80'),
  ('Creative Director Cut & Styling', 'mens-cut', 'Precision craftsmanship by our Creative Director. Tailored to your bone structure, texture and lifestyle for an effortless, refined finish.', '50 min', 850, 1020, true, true, 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80'),
  ('Top Stylist Cut & Styling', 'mens-cut', 'Expert cut and styling by our senior creative team. Modern shapes with meticulous attention to detail and personal style.', '45 min', 650, 780, false, true, 'https://images.unsplash.com/photo-1521322138825-f2b0e1c4b72c?w=600&q=80'),
  ('Senior Stylist Cut', 'mens-cut', 'Change of style — a fresh look sculpted by our experienced Senior Stylists. Includes consultation, wash and blow dry.', '40 min', 500, 600, false, true, 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=600&q=80'),
  ('Stylist Cut', 'mens-cut', 'A polished, precise cut delivered by our skilled stylists. Perfect for maintaining your signature look.', '35 min', 250, 300, false, true, 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=600&q=80'),
  ('Kids Haircut (Men''s)', 'mens-cut', 'Gentle, patient haircuts for children in a calm, welcoming environment. All stylists trained for young guests.', '30 min', 250, 300, false, true, 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=600&q=80'),
  ('Style Director Cut & Blow Dry', 'womens-cut', 'Multi-layer precision cut by our Style Director — the ultimate expression of bespoke women''s hairdressing. Includes full blow dry finish.', '75 min', 1502, 1800, true, true, 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80'),
  ('Creative Director Cut & Blow Dry', 'womens-cut', 'Layer or step cut sculpted by our Creative Director. A signature service combining artistry and technical mastery.', '65 min', 1150, 1380, true, true, 'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=600&q=80'),
  ('Top Stylist Layer Cut', 'womens-cut', 'Expert layer cut and blow dry by our Top Stylists — ideal for adding movement, texture and a fresh dimension to your hair.', '55 min', 850, 1020, false, true, 'https://images.unsplash.com/photo-1500840216050-6ffa99d75160?w=600&q=80'),
  ('Senior Stylist Deep U/V Cut', 'womens-cut', 'A defined Deep U or V cut with blow dry — structured, elegant and effortlessly wearable. By our Senior Stylist team.', '50 min', 700, 840, false, true, 'https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?w=600&q=80'),
  ('Stylist Basic Cut & Blow Dry', 'womens-cut', 'A clean, straight cut with professional blow dry. Classic and polished — for those who trust simplicity.', '45 min', 500, 600, false, true, 'https://images.unsplash.com/photo-1512207736890-6ffed8a84e8d?w=600&q=80'),
  ('Kids Haircut (Girls) & Fringe', 'womens-cut', 'Girls'' haircut from ₹400 | Fringe trim from ₹200. A comfortable, fun experience for young guests.', '30 min', 200, 480, false, true, 'https://images.unsplash.com/photo-1519741497674-611481863552?w=600&q=80'),
  ('Wash & Blast Dry (Gents)', 'blowdry', 'A quick, revitalising wash and high-pressure blow dry — the essential refresh between cuts.', '20 min', 250, 300, false, true, 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&q=80'),
  ('Straight Blow Dry (Shoulder Length)', 'blowdry', 'Smooth, glossy straight blow dry for shoulder-length hair. Frizz-free, voluminous, and runway-ready.', '40 min', 450, 540, false, true, 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80'),
  ('Straight Blow Dry (Below Shoulder)', 'blowdry', 'A full blow dry for longer lengths — silky-smooth finish that lasts all day.', '50 min', 600, 720, false, true, 'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=600&q=80'),
  ('In Curl / Out Curl Styling', 'blowdry', 'Bouncy, voluminous curls styled in or out for a glamorous, editorial finish.', '55 min', 800, 960, true, true, 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80'),
  ('Temporary Straightening (Ironing)', 'blowdry', 'Sleek, pin-straight ironed finish. Shoulder length from ₹700 | Below shoulder from ₹900 | Extra long from ₹1200.', '45–75 min', 700, 1440, false, true, 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=600&q=80'),
  ('Tonging — Curls & Waves', 'blowdry', 'Temporary curls and waves crafted with professional tongs. Shoulder from ₹800 | Below shoulder ₹1000 | Extra long ₹1500.', '50–80 min', 800, 1800, false, true, 'https://images.unsplash.com/photo-1500840216050-6ffa99d75160?w=600&q=80'),
  ('Scrunching', 'blowdry', 'Enhance your natural curl pattern with our professional scrunching technique. Defined, bouncy curls without heat damage.', '30 min', 400, 480, false, true, 'https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?w=600&q=80'),
  ('Zero Trim & Regular Shave', 'shave', 'Precision zero trim for a clean, close finish. Classic regular shave with hot towel preparation.', '20–30 min', 100, 180, false, true, 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&q=80'),
  ('Beard Shape-Up', 'shave', 'Expert beard shaping and contouring to define your jaw and elevate your overall look.', '20 min', 150, 180, false, true, 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=600&q=80'),
  ('French Beard Shave & Design', 'shave', 'French beard shave from ₹150 | Beard design from ₹250. Sculpted to precision by our grooming specialists.', '25–35 min', 150, 300, false, true, 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=600&q=80'),
  ('Head Shave', 'shave', 'A smooth, close head shave with hot towel treatment. The cleanest, most confident look — expertly delivered.', '30 min', 300, 360, false, true, 'https://images.unsplash.com/photo-1521322138825-f2b0e1c4b72c?w=600&q=80'),
  ('Tint Re-Growth', 'colour', 'Seamless root touch-up using premium colour systems. Blends perfectly with your existing shade for a fresh, uniform finish.', '60 min', 1500, 1800, false, true, 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80'),
  ('Global Colour', 'colour', 'Full head colour transformation. Men from ₹1000 | Women (neck length) from ₹2000. Rich, luminous results using professional-grade pigments.', '75–90 min', 1000, 2400, true, true, 'https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?w=600&q=80'),
  ('Highlights — Full & Half Head', 'colour', 'Full head highlights from ₹3000 | Half head from ₹2000 | T-section from ₹1500. Dimensional colour that catches the light beautifully.', '90–120 min', 1500, 3600, true, true, 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=600&q=80'),
  ('Men''s Cap Highlights', 'colour', 'Classic cap highlights designed specifically for men — subtle dimension and depth without the commitment of full colour.', '50 min', 1000, 1200, false, true, 'https://images.unsplash.com/photo-1603351154351-5e2d0600bb77?w=600&q=80'),
  ('Hairline Highlights (Per Streak)', 'colour', 'Face-framing hairline streaks from ₹200 per streak. Precise, targeted brightening for an effortless sun-kissed effect.', '30 min', 200, 240, false, true, 'https://images.unsplash.com/photo-1500840216050-6ffa99d75160?w=600&q=80'),
  ('Balayage, Ombré & Lumi-Ombrage', 'colour', 'Advanced freehand colour techniques — Balayage, Ombré and Lumi-Ombrage. Natural-looking, blended dimension. Price on consultation.', '2–3 hr', 5000, 6000, true, true, 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80'),
  ('Colour Correction', 'colour', 'Expert colour correction for uneven tones, failed DIY colour, or major transformations. Tailored approach for every situation.', '3+ hr', 2500, 3000, false, true, 'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=600&q=80'),
  ('Moustache & Beard Colour', 'colour', 'Moustache colour from ₹150 | Beard colour from ₹250. Discreet, natural-looking coverage for facial hair.', '20 min', 150, 300, false, true, 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&q=80'),
  ('Straightening / Relaxing / Rebonding', 'straightening', 'Permanent frizz-free treatment for smooth, manageable hair. Fringe ₹1000 | Neck ₹3000 | Shoulder ₹5000 | Below shoulder ₹6500 | Waist ₹8000 onwards.', '2–4 hr', 1000, 9600, true, true, 'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=600&q=80'),
  ('Keratin Treatment', 'keratin', 'Our signature keratin smoothing treatment — eliminates frizz, restores shine and transforms texture for months. Suitable for all hair types.', '2–4 hr', 4000, 9000, true, true, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80'),
  ('Botox Hair Treatment', 'keratin', 'Deep conditioning hair botox that fills gaps in the hair fibre, restoring elasticity and brilliance. Visible results from the first session.', '2–3.5 hr', 3000, 8500, false, true, 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80'),
  ('Nanoplastia Treatment', 'keratin', 'The most advanced smoothing technology — organic, formaldehyde-free. Ultra-smooth, luminous results that respect hair integrity.', '2.5–4 hr', 5000, 10999, true, true, 'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=600&q=80'),
  ('SP Alchemy Hair Spa (Men)', 'spa', '30-minute intensive SP Alchemy treatment — choose from Repair, Colour Save, Dandruff, Hair Loss, Shine, Keratin or Frizz Ease protocols. S: ₹800 | M: ₹1000 onwards.', '30 min', 800, 1200, false, true, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80'),
  ('SP Alchemy Hair Spa (Women)', 'spa', '30-minute intensive SP Alchemy treatment tailored for women. Shoulder length ₹1800 | Below shoulder ₹2500 | Waist ₹3000 onwards.', '30 min', 1800, 3000, true, true, 'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=600&q=80'),
  ('Keratin Oil Hair Spa (Wella)', 'spa', 'Wella''s signature keratin oil spa — deep nourishment, frizz elimination and mirror-like shine in one luxurious session.', '45 min', 1500, 1800, false, true, 'https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?w=600&q=80'),
  ('SP Hair Spa (Wella)', 'spa', 'Choose from Smooth, Hydrate, Volume, Balance Scalp or Repair protocols. Targeted, science-backed scalp and strand care.', '45 min', 2000, 2500, false, true, 'https://images.unsplash.com/photo-1500840216050-6ffa99d75160?w=600&q=80'),
  ('L''Oréal Care Hair Spa', 'spa', 'Transform damaged hair to stronger, healthier hair with L''Oréal''s professional care spa. Men ₹1000 | Women (neck length) ₹1300 onwards.', '40 min', 1000, 1500, false, true, 'https://images.unsplash.com/photo-1519741497674-611481863552?w=600&q=80'),
  ('Wellaplex / Olaplex Bond Repair', 'spa', 'Bond-rebuilding treatment for coloured or frizzy hair. Gents from ₹2000 | Ladies from ₹3000. Restores strength and prevents breakage.', '30 min', 2000, 3500, true, true, 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80'),
  ('Hair Growth Treatment', 'spa', 'Targeted scalp therapy to stimulate growth and combat hair loss. Professional-grade formulas — ₹3000/₹3500 per session.', '45 min', 3000, 3500, false, true, 'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=600&q=80'),
  ('Protein Treatment (Add-On)', 'spa', 'Strengthening protein add-on service. Men ₹500 | Women ₹1000. Rebuilds hair structure from within for resilience and shine.', '20 min', 500, 1000, false, true, 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80'),
  ('Elegant Bride (Hair, Makeup & Saree Draping)', 'bridal', 'Complete bridal package — hair styling, makeup and saree draping for your perfect wedding moment. Elegant look.', '4 hr', 8000, 8000, true, true, 'https://images.unsplash.com/photo-1519741497674-611481863552?w=600&q=80'),
  ('Gorgeous Bride (Hair, Makeup & Saree Draping)', 'bridal', 'An elevated bridal experience — Gorgeous Bride package with premium hair, makeup and saree draping by our top artistes.', '4.5 hr', 10000, 10000, true, true, 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=600&q=80'),
  ('Glamorous Bride (Hair, Makeup & Saree Draping)', 'bridal', 'The full glamour treatment — Glamorous Bride with luxury hair, full makeup and expert saree draping. Unforgettable.', '5 hr', 12000, 12000, true, true, 'https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?w=600&q=80'),
  ('Airbrush Bridal', 'bridal', 'Airbrush makeup for the modern bride — flawless, lightweight, long-lasting coverage that photographs beautifully.', '5+ hr', 16000, 16000, false, true, 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80'),
  ('Bridesmaid — Hair & Makeup', 'bridal', 'Complete bridesmaid package including hair styling, makeup and saree draping. ₹4500 per person.', '2.5 hr', 4500, 4500, false, true, 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80'),
  ('Simple / Mini / Eye Makeup', 'bridal', 'Simple makeup ₹3000 | Mini makeup ₹1500 | Eye makeup ₹600. Expert makeup for events, shoots and special occasions.', '30–60 min', 600, 3000, false, true, 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=600&q=80'),
  ('Advance Hairdo / Simple Hairdo', 'bridal', 'Advance hairdo ₹1500 | Simple hairdo ₹1000 | Men''s styling ₹200. Elegant up-styles and hair artistry for any occasion.', '45–60 min', 200, 1500, false, true, 'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=600&q=80'),
  ('Pre Bridal Groom Package — Deluxe', 'groom', 'Complete groom preparation: Nature/Lotus facial, Stylist cut & styling, beard design/shape/shave, pedicure, manicure. 2 hrs minimum.', '2 hr', 3999, 3999, true, true, 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&q=80'),
  ('Pre Bridal Groom Package — Premium', 'groom', 'Elevated groom package: Sea Soul/Diamond facial, Top Stylist cut, beard design, Premium pedicure & manicure, hair spa & blow dry. 3 hrs minimum.', '3 hr', 5999, 5999, true, true, 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=600&q=80'),
  ('Pre Bridal Groom Package — Luxury', 'groom', 'Ultimate groom experience: Brillare/O3 facial, Creative Director cut & styling, beard design, Luxury pedicure & manicure, hair spa & body polish. 4 hrs minimum.', '4 hr', 9999, 9999, true, true, 'https://images.unsplash.com/photo-1603351154351-5e2d0600bb77?w=600&q=80'),
  ('Groom Makeup — Normal / HD / Airbrush', 'groom', 'Normal groom makeup ₹4000 | High Definition ₹5000 | Airbrush ₹6000. Professional makeup artistry for the modern groom.', '60–90 min', 4000, 6000, false, true, 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=600&q=80');

insert into public.offers (title, description, badge, price, active, color) values
  ('Club Envy Card', 'Earn exclusive member benefits and save upto 22.5% off on services across Essensuals & partner lifestyle brands. Ask at reception to join.', 'Upto 22.5% Off', 'Free to join', true, '#1a1a1a'),
  ('Pre Bridal Package — Luxury', 'Full bridal prep: Brillare/O3 facial, full body luxury wax, Top Stylist cut, pedicure & manicure (Bombini), hair spa, blow dry & body polish. 4 hrs minimum.', 'Limited Slots', 'From ₹10,999', true, '#2d2d2d'),
  ('Pre Bridal Groom — Premium', 'Sea Soul/Diamond facial, Top Stylist cut, beard design, Premium spa pedicure & manicure, hair spa and blow dry. The complete groom experience.', 'Popular Choice', 'From ₹5,999', true, '#1a1a1a'),
  ('Fabulous Deals on Lifestyle Brands', 'Special packages on Haagen-Dazs, Chakra Urban Spa and more Paulsons Group brands. Ask our reception team for further details.', 'Exclusive', 'Ask at reception', true, '#2d2d2d');

insert into public.gallery (url, caption, type) values
  ('https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?w=600&q=80', 'Balayage Transformation', 'after'),
  ('https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=600&q=80', 'Bridal Updo', 'bridal'),
  ('https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80', 'Creative Colour', 'colour'),
  ('https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80', 'Precision Cut', 'cut'),
  ('https://images.unsplash.com/photo-1519741497674-611481863552?w=600&q=80', 'Wedding Artistry', 'bridal'),
  ('https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=600&q=80', 'Voluminous Blowout', 'style');

insert into public.salon_settings (id, name, phone, email, address, hours, whatsapp) values (1, 'Toni&Guy Essensuals', '+91 44 1234 5678', 'info@toniandguy.in', 'Chennai & Pondicherry, India
Franchisee of Essensuals UK', 'Mon–Sat: 10:00 AM – 8:00 PM
Sunday: 10:00 AM – 6:00 PM', '')
on conflict (id) do update set name = excluded.name, phone = excluded.phone, email = excluded.email, address = excluded.address, hours = excluded.hours, whatsapp = excluded.whatsapp;
