import { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Truck, Clock, MessageCircle, Star, Quote, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLivestock, useReviews, ratingFor, badgeFor, useHeroSlides, DEFAULT_HERO } from '../hooks/queries';
import { useFavorites } from '../hooks/useFavorites';
import { useApp } from '../providers/AppProvider';
import LivestockCard from '../components/LivestockCard';

const REVIEWS = [
  { name: 'Adaeze O.', role: 'Home cook', text: 'Freshest ram I have had in Lagos. Delivery was on time and the WhatsApp updates were reassuring.' },
  { name: 'Tunde B.', role: 'Event planner', text: 'Ordered a full cow for a wedding — perfectly prepared and portioned. Will absolutely reorder.' },
  { name: 'Ngozi K.', role: 'Restaurateur', text: 'Consistent quality every single week. The per-KG pricing makes stock planning so easy.' },
  { name: 'Emeka U.', role: 'Family of six', text: 'Love that I can pick preparation type and pickup time. Felt premium end to end.' },
];

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

export default function HomePage() {
  const { data: livestock = [], isLoading } = useLivestock();
  const { data: reviews = [] } = useReviews();
  const { favorites, toggleFavorite, canFavorite } = useFavorites();
  const { addToCart } = useApp();
  const { data: slides = DEFAULT_HERO } = useHeroSlides();

  const carouselRef = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: number) => carouselRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });

  const [heroIdx, setHeroIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setHeroIdx((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(id);
  }, [slides.length]);

  const featured = livestock.slice(0, 8);
  const arrival = livestock[livestock.length - 1];
  const gallery = livestock.slice(0, 6);
  const overall = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <div className="bg-cream">
      {/* HERO */}
      <section className="max-full mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="relative rounded-3xl overflow-hidden min-h-[72vh] sm:min-h-[660px]">
          {slides.map((sl, i) => (
            <img key={i} src={sl.img} alt="Farm" className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${i === heroIdx ? 'opacity-100' : 'opacity-0'}`} onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.pexels.com/photos/735968/pexels-photo-735968.jpeg'; }} />
          ))}
          <div className="absolute inset-0 bg-gradient-to-t from-forest-900/75 via-forest-900/15 to-forest-900/35" />

          {/* top-left intro */}
          <p className="absolute top-7 left-7 sm:top-9 sm:left-9 max-w-[260px] text-cream/90 text-sm sm:text-[15px] leading-relaxed">
            We're dedicated to premium, farm-fresh livestock — prepared your way and delivered with care.
          </p>

          {/* top-right dots */}
          <div className="absolute top-8 right-8 flex items-center gap-2 z-10">
            {slides.map((_, i) => <button key={i} onClick={() => setHeroIdx(i)} aria-label={`Slide ${i + 1}`} className={`h-2 rounded-full transition-all ${i === heroIdx ? 'w-6 bg-cream' : 'w-2 bg-cream/40 hover:bg-cream/70'}`} />)}
          </div>

          {/* bottom-right display headline */}
          <h1 className="absolute bottom-24 sm:bottom-28 right-6 sm:right-12 left-6 sm:left-auto text-right text-cream font-serif leading-[0.9]">
            <span className="block text-6xl sm:text-8xl lg:text-9xl font-semibold">Taste the</span>
            <span className="block text-6xl sm:text-8xl lg:text-9xl italic font-medium">{slides[heroIdx % slides.length]?.word ?? ''}</span>
          </h1>

          {/* bottom-left CTA */}
          <Link to="/shop" className="absolute bottom-7 left-7 sm:bottom-9 sm:left-9 inline-flex items-center gap-2 rounded-full bg-cream text-forest-800 font-semibold pl-5 pr-4 py-3 hover:bg-paper transition-colors">
            Shop Now <span className="w-7 h-7 rounded-full bg-forest-700 text-cream flex items-center justify-center"><ArrowRight size={15} /></span>
          </Link>
        </div>
      </section>

      {/* trust strip */}
      <section className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[{ icon: Clock, label: 'Same-day processing' }, { icon: Truck, label: 'Home delivery available' }, { icon: MessageCircle, label: 'WhatsApp order updates' }].map(({ icon: Icon, label }) => (
            <div key={label} className="surface flex items-center gap-3 px-5 py-4">
              <div className="w-9 h-9 rounded-full bg-forest-50 flex items-center justify-center text-forest-700"><Icon size={17} strokeWidth={1.75} /></div>
              <span className="text-sm font-medium text-forest-800">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURED */}
      <section id="featured" className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sage-600 font-medium text-sm">Eco essentials, farm-fresh</p>
            <h2 className="text-3xl font-bold text-forest-900">Bestselling <span className="accent text-forest-600">Products</span></h2>
          </div>
          <Link to="/shop" className="text-sm font-semibold text-forest-700 hover:underline flex items-center gap-1">More products <ArrowRight size={15} /></Link>
        </div>
        {isLoading ? (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[...Array(4)].map((_, i) => <div key={i} className="bg-paper rounded-lg p-3 animate-pulse"><div className="aspect-[4/5] bg-sand rounded-lg" /><div className="p-3 space-y-3"><div className="h-4 bg-sand rounded-sm w-3/4" /><div className="h-9 bg-sand rounded-full mt-3" /></div></div>)}
          </div>
        ) : (
          <div className="relative mt-8">
            <button onClick={() => scrollBy(-1)} aria-label="Scroll left" className="hidden sm:flex absolute -left-24 top-1/3 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-paper border border-forest-700/10 text-forest-700 hover:bg-forest-50"><ChevronLeft size={18} /></button>
            <button onClick={() => scrollBy(1)} aria-label="Scroll right" className="hidden sm:flex absolute -right-20 top-1/3 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-paper border border-forest-700/10 text-forest-700 hover:bg-forest-50"><ChevronRight size={18} /></button>
            <div ref={carouselRef} className="flex gap-5 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 -mx-1 px-1">
              {featured.map((l) => { const r = ratingFor(reviews, l.id); return (
                <div key={l.id} className="snap-start flex-shrink-0 w-[78%] sm:w-[46%] lg:w-[calc(25%-15px)]">
                  <LivestockCard livestock={l} onQuickAdd={addToCart} isFavorite={favorites.has(l.id)} canFavorite={canFavorite} onToggleFavorite={toggleFavorite} avgRating={r.avg} reviewCount={r.count} badge={badgeFor(l, r.count, r.avg)} />
                </div>
              ); })}
            </div>
          </div>
        )}
      </section>

      {/* NEW ARRIVAL */}
      {arrival && (
        <section className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center bg-paper rounded-lg overflow-hidden border border-forest-700/5">
            <div className="h-72 lg:h-full min-h-[300px]"><img src={arrival.image_url} alt={arrival.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.pexels.com/photos/735968/pexels-photo-735968.jpeg'; }} /></div>
            <div className="p-8 sm:p-12">
              <p className="text-sage-600 font-medium text-sm">Freshly added</p>
              <h3 className="text-3xl font-bold text-forest-900 mt-1">New <span className="accent text-forest-600">Arrival</span></h3>
              <p className="text-forest-800/60 mt-3 leading-relaxed">{arrival.description || `Introducing our ${arrival.name} — sourced with care, prepared to your preference.`}</p>
              <p className="mt-5 text-2xl font-bold text-forest-900">{fmt(arrival.price_per_kg)}<span className="text-sm font-medium text-forest-800/50"> / KG</span></p>
              <Link to={`/product/${arrival.id}`} className="btn-primary mt-6">View {arrival.name} <ArrowRight size={17} /></Link>
            </div>
          </div>
        </section>
      )}

      {/* GALLERY */}
      {gallery.length > 0 && (
        <section className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-16">
          <p className="text-sage-600 font-medium text-sm">Thoughtful, farm-to-table</p>
          <h3 className="text-3xl font-bold text-forest-900">Our <span className="accent text-forest-600">Gallery</span></h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
            {gallery.map((g, i) => (
              <Link key={g.id} to={`/product/${g.id}`} className={`relative overflow-hidden rounded-lg bg-sand group ${i === 0 ? 'col-span-2 row-span-2 aspect-square md:aspect-auto' : 'aspect-square'}`}>
                <img src={g.image_url} alt={g.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.pexels.com/photos/735968/pexels-photo-735968.jpeg'; }} />
                <span className="absolute bottom-2 left-2 tag-pill text-[11px]">{g.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* REVIEWS */}
      <section className="w-full bg-forest-800 text-cream mt-16">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
          <div className="flex flex-wrap items-end gap-4 justify-between">
            <div className="flex items-end gap-4">
              <p className="text-5xl font-bold accent">{reviews.length ? overall.toFixed(1) : '4.9'}<span className="text-xl not-italic font-sans text-cream/60">/5</span></p>
              <div className="flex items-center gap-1 mb-2">{[...Array(5)].map((_, i) => <Star key={i} size={16} className={i < Math.round(reviews.length ? overall : 5) ? 'fill-sage-300 text-sage-300' : 'text-cream/20'} />)}</div>
            </div>
            <p className="text-cream/70 text-sm max-w-xs">{reviews.length ? `From ${reviews.length} verified review${reviews.length > 1 ? 's' : ''}.` : 'Loved by families and kitchens across the country.'}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            {reviews.length > 0 ? reviews.slice(0, 8).map((r) => (
              <div key={r.id} className="bg-cream/5 border border-cream/10 rounded-lg p-5">
                <div className="flex items-center gap-0.5 mb-2">{[...Array(5)].map((_, i) => <Star key={i} size={13} className={i < r.rating ? 'fill-sage-300 text-sage-300' : 'text-cream/20'} />)}</div>
                <p className="text-sm text-cream/85 leading-relaxed">{r.comment || 'Great product!'}</p>
                <p className="text-sm font-semibold mt-4">{r.customer_name || 'Verified customer'}</p>
                <p className="text-xs text-cream/50">Verified purchase</p>
              </div>
            )) : REVIEWS.map((r) => (
              <div key={r.name} className="bg-cream/5 border border-cream/10 rounded-lg p-5">
                <Quote size={20} className="text-sage-300" />
                <p className="text-sm text-cream/85 mt-3 leading-relaxed">{r.text}</p>
                <p className="text-sm font-semibold mt-4">{r.name}</p>
                <p className="text-xs text-cream/50">{r.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="w-full bg-sand mt-16">
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="text-forest-800/70 text-lg leading-relaxed">Committed to <span className="accent text-forest-600">humane sourcing</span>, hygienic processing, and <span className="accent text-forest-600">fresh delivery</span> — for a healthier table and happier home.</p>
          <Link to="/shop" className="btn-primary mt-6">Start your order <ArrowRight size={17} /></Link>
        </div>
      </section>
    </div>
  );
}
