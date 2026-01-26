// ============================================
// THE STUDIO RENO - DIGITAL SIGNAGE DISPLAY
// Full-screen lobby display for schedules & promos
// Access at: /display or /tv
// ============================================

import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Configuration
const SLIDE_DURATION = 15000;      // 15 seconds per slide
const REFRESH_INTERVAL = 300000;   // Refresh data every 5 minutes
const PROMO_SLIDE_DURATION = 10000; // 10 seconds for promos

export default function DisplayBoard() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [schedule, setSchedule] = useState([]);
  const [events, setEvents] = useState([]);
  const [promos, setPromos] = useState([]);
  const [settings, setSettings] = useState({});
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load data
  useEffect(() => {
    loadData();
    const dataInterval = setInterval(loadData, REFRESH_INTERVAL);
    return () => clearInterval(dataInterval);
  }, []);

  // Update clock
  useEffect(() => {
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Auto-rotate slides
  useEffect(() => {
    const slides = getSlides();
    if (slides.length <= 1) return;
    
    const duration = slides[currentSlide]?.type === 'promo' ? PROMO_SLIDE_DURATION : SLIDE_DURATION;
    const timer = setTimeout(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, duration);
    
    return () => clearTimeout(timer);
  }, [currentSlide, schedule, events, promos]);

  const loadData = async () => {
    try {
      setError(null);
      // Load schedule for today and tomorrow
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      // Fetch each endpoint separately to handle individual failures gracefully
      const fetchJson = async (url) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          return await res.json();
        } catch { return null; }
      };

      const [scheduleData, eventsData, settingsData, slidesData] = await Promise.all([
        fetchJson(`${API_URL}/classes/schedule?start_date=${today}&end_date=${tomorrow}`),
        fetchJson(`${API_URL}/cms/events?featured=true&limit=5`),
        fetchJson(`${API_URL}/cms/settings`),
        fetchJson(`${API_URL}/cms/display/slides`)
      ]);

      setSchedule(scheduleData?.classes || []);
      setEvents(eventsData?.events || []);
      setSettings(settingsData?.settings || {});

      // Build promos from custom slides + settings
      const promoList = [];

      // Add custom slides first
      if (slidesData?.slides) {
        slidesData.slides.forEach(slide => {
          promoList.push({
            type: 'custom',
            ...slide
          });
        });
      }

      // Add default promos from settings if no custom slides
      if (promoList.length === 0) {
        if (settingsData?.settings?.intro_offer?.enabled) {
          promoList.push({
            type: 'intro',
            title: settingsData.settings.intro_offer.title || 'New Student Special',
            subtitle: settingsData.settings.intro_offer.description,
            price: settingsData.settings.intro_offer.price
          });
        }
        if (settingsData?.settings?.tea_lounge?.enabled) {
          promoList.push({
            type: 'tea',
            title: settingsData.settings.tea_lounge.name,
            subtitle: settingsData.settings.tea_lounge.tagline,
            hours: settingsData.settings.tea_lounge.hours
          });
        }
      }
      setPromos(promoList);

    } catch (err) {
      console.error('Failed to load display data:', err);
      setError('Failed to load display data. Retrying...');
    } finally {
      setLoading(false);
    }
  };

  const getSlides = () => {
    const slides = [];
    
    // Today's schedule
    const todayClasses = schedule.filter(c => {
      const classDate = new Date(c.start_time).toDateString();
      return classDate === new Date().toDateString();
    });
    if (todayClasses.length > 0) {
      slides.push({ type: 'schedule', title: "Today's Classes", classes: todayClasses });
    }
    
    // Tomorrow's schedule
    const tomorrowClasses = schedule.filter(c => {
      const classDate = new Date(c.start_time).toDateString();
      const tomorrow = new Date(Date.now() + 86400000).toDateString();
      return classDate === tomorrow;
    });
    if (tomorrowClasses.length > 0) {
      slides.push({ type: 'schedule', title: "Tomorrow's Classes", classes: tomorrowClasses });
    }
    
    // Upcoming events
    if (events.length > 0) {
      slides.push({ type: 'events', events });
    }
    
    // Promos
    promos.forEach(promo => {
      slides.push({ type: 'promo', promo });
    });
    
    return slides.length > 0 ? slides : [{ type: 'welcome' }];
  };

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric' 
    });
  };

  const slides = getSlides();

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-brand-400 border-t-transparent mx-auto mb-4"></div>
          <p className="text-brand-300 font-heading text-2xl">Loading...</p>
        </div>
      </div>
    );
  }

  // Show error banner but continue displaying available content
  const showError = error && schedule.length === 0 && events.length === 0;

  return (
    <div className="min-h-screen bg-brand-900 text-white overflow-hidden">
      {/* Header Bar */}
      <header className="bg-gradient-to-r from-brand-700 to-brand-600 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {settings.branding?.logo_url ? (
            <img src={settings.branding.logo_url} alt="The Studio" className="h-12" />
          ) : (
            <h1 className="font-heading text-3xl font-semibold">The Studio Reno</h1>
          )}
        </div>
        <div className="text-right">
          <div className="text-4xl font-light tabular-nums">
            {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </div>
          <div className="text-brand-200 text-lg">
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-8 h-[calc(100vh-100px)]">
        {slides[currentSlide]?.type === 'schedule' && (
          <ScheduleSlide 
            title={slides[currentSlide].title} 
            classes={slides[currentSlide].classes}
            formatTime={formatTime}
          />
        )}
        
        {slides[currentSlide]?.type === 'events' && (
          <EventsSlide events={slides[currentSlide].events} formatDate={formatDate} />
        )}
        
        {slides[currentSlide]?.type === 'promo' && (
          <PromoSlide promo={slides[currentSlide].promo} />
        )}
        
        {slides[currentSlide]?.type === 'welcome' && (
          <WelcomeSlide settings={settings} />
        )}
      </main>

      {/* Slide Indicators */}
      {slides.length > 1 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {slides.map((_, idx) => (
            <div 
              key={idx} 
              className={`w-3 h-3 rounded-full transition-all ${
                idx === currentSlide ? 'bg-brand-400 w-8' : 'bg-brand-600'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// SLIDE COMPONENTS
// ============================================

function ScheduleSlide({ title, classes, formatTime }) {
  // Group by time for cleaner display
  const upcomingClasses = classes
    .filter(c => new Date(c.start_time) > new Date(Date.now() - 3600000)) // Show classes from 1 hour ago
    .slice(0, 8); // Max 8 classes per slide

  return (
    <div className="h-full flex flex-col animate-fadeIn">
      <h2 className="font-heading text-5xl font-semibold text-brand-300 mb-8">{title}</h2>
      
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {upcomingClasses.map((cls, idx) => (
          <div 
            key={cls.id || idx}
            className="bg-brand-800/50 backdrop-blur rounded-2xl p-6 flex items-center gap-6 border border-brand-700/50"
          >
            {/* Time */}
            <div className="text-center min-w-[100px]">
              <div className="text-3xl font-light text-brand-300">{formatTime(cls.start_time)}</div>
              <div className="text-brand-500 text-sm">{cls.duration || 60} min</div>
            </div>
            
            {/* Divider */}
            <div className="w-px h-16 bg-brand-600"></div>
            
            {/* Class Info */}
            <div className="flex-1">
              <h3 className="text-2xl font-heading font-semibold text-white">{cls.class_name || cls.name}</h3>
              <p className="text-brand-300 text-lg">{cls.teacher_name || 'TBA'}</p>
              {cls.location_name && (
                <p className="text-brand-500 text-sm mt-1">{cls.location_name}</p>
              )}
            </div>
            
            {/* Spots */}
            <div className="text-right">
              {cls.spots_available !== undefined && (
                <div className={`text-lg font-medium ${cls.spots_available <= 3 ? 'text-amber-400' : 'text-green-400'}`}>
                  {cls.spots_available > 0 ? `${cls.spots_available} spots` : 'Full'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {classes.length > 8 && (
        <p className="text-center text-brand-500 mt-4">+ {classes.length - 8} more classes today</p>
      )}
    </div>
  );
}

function EventsSlide({ events, formatDate }) {
  return (
    <div className="h-full flex flex-col animate-fadeIn">
      <h2 className="font-heading text-5xl font-semibold text-brand-300 mb-8">Upcoming Events</h2>
      
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {events.slice(0, 4).map((event, idx) => (
          <div 
            key={event.id || idx}
            className="bg-gradient-to-br from-brand-700/50 to-brand-800/50 backdrop-blur rounded-2xl p-8 border border-brand-600/30"
          >
            {event.image_url && (
              <img src={event.image_url} alt="" className="w-full h-40 object-cover rounded-xl mb-4" />
            )}
            <div className="text-brand-400 text-lg mb-2">{formatDate(event.start_date)}</div>
            <h3 className="text-3xl font-heading font-semibold text-white mb-2">{event.title}</h3>
            <p className="text-brand-300 text-lg line-clamp-2">{event.short_description}</p>
            {event.price && (
              <div className="mt-4 text-2xl font-semibold text-brand-400">${event.price}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PromoSlide({ promo }) {
  // Custom slide with image background
  if (promo.type === 'custom') {
    return (
      <div 
        className="h-full flex items-center justify-center animate-fadeIn relative"
        style={promo.background_url ? {
          backgroundImage: `url(${promo.background_url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        } : {}}
      >
        {promo.background_url && (
          <div className="absolute inset-0 bg-black" style={{ opacity: promo.overlay_opacity || 0.5 }}></div>
        )}
        <div className={`relative text-center max-w-4xl px-8 ${promo.layout === 'split' ? 'grid grid-cols-2 gap-8 items-center' : ''}`}>
          {promo.image_url && promo.layout === 'split' && (
            <img src={promo.image_url} alt="" className="w-full h-80 object-cover rounded-2xl" />
          )}
          <div>
            {promo.subtitle && <div className="text-brand-400 font-accent text-4xl mb-4">{promo.subtitle}</div>}
            {promo.title && <h2 className="font-heading text-6xl font-bold text-white mb-6">{promo.title}</h2>}
            {promo.body && <p className="text-2xl text-brand-200">{promo.body}</p>}
          </div>
          {promo.image_url && promo.layout !== 'split' && (
            <img src={promo.image_url} alt="" className="mt-8 max-h-60 mx-auto rounded-xl" />
          )}
        </div>
      </div>
    );
  }
  
  if (promo.type === 'intro') {
    return (
      <div className="h-full flex items-center justify-center animate-fadeIn">
        <div className="text-center max-w-4xl">
          <div className="text-brand-400 font-accent text-4xl mb-4">New to The Studio?</div>
          <h2 className="font-heading text-7xl font-bold text-white mb-6">{promo.title}</h2>
          <p className="text-3xl text-brand-200 mb-8">{promo.subtitle}</p>
          {promo.price && (
            <div className="inline-block bg-gradient-to-r from-brand-500 to-brand-400 text-white text-5xl font-bold px-12 py-6 rounded-2xl">
              ${promo.price}
            </div>
          )}
        </div>
      </div>
    );
  }
  
  if (promo.type === 'tea') {
    return (
      <div className="h-full flex items-center justify-center animate-fadeIn">
        <div className="text-center max-w-4xl">
          <div className="text-6xl mb-6">🍵</div>
          <h2 className="font-heading text-6xl font-bold text-white mb-4">{promo.title}</h2>
          <p className="text-2xl text-brand-300 mb-8">{promo.subtitle}</p>
          {promo.hours && (
            <div className="space-y-2">
              {promo.hours.map((h, idx) => (
                <div key={idx} className="text-xl text-brand-200">
                  <span className="text-brand-400 font-semibold">{h.day}s</span> {h.open} - {h.close}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // Generic promo
  return (
    <div className="h-full flex items-center justify-center animate-fadeIn">
      <div className="text-center max-w-4xl">
        <h2 className="font-heading text-6xl font-bold text-white mb-6">{promo.title}</h2>
        <p className="text-2xl text-brand-300">{promo.subtitle}</p>
      </div>
    </div>
  );
}

function WelcomeSlide({ settings }) {
  return (
    <div className="h-full flex items-center justify-center animate-fadeIn">
      <div className="text-center">
        {settings.branding?.logo_url && (
          <img src={settings.branding.logo_url} alt="The Studio" className="h-32 mx-auto mb-8" />
        )}
        <h1 className="font-heading text-7xl font-bold text-white mb-4">Welcome</h1>
        <p className="text-3xl text-brand-300 font-accent">
          {settings.branding?.tagline || 'Your Conscious Community Center'}
        </p>
      </div>
    </div>
  );
}

// Add to index.css for animation
const styles = `
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fadeIn {
  animation: fadeIn 0.5s ease-out;
}
`;
