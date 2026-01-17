import React, { useState, useEffect, createContext, useContext } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const AuthContext = createContext(null);

// API helper
async function api(endpoint, options = {}) {
  const token = localStorage.getItem('user_token');
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Toast Component
function Toast({ message, type = 'success', onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
      {message}
    </div>
  );
}

// ============================================
// AUTH MODAL
// ============================================

function AuthModal({ isOpen, onClose, onLogin, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    email_opt_in: true, // Marketing emails - default true but can opt out
    sms_opt_in: false // Marketing SMS - default false, must opt in
  });

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'login') {
        const data = await api('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: form.email, password: form.password }),
        });
        localStorage.setItem('user_token', data.token);
        onLogin(data.user);
        onClose();
      } else {
        const data = await api('/auth/register', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        localStorage.setItem('user_token', data.token);
        onLogin(data.user);
        onClose();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
            <p className="text-gray-500 mt-1">{mode === 'login' ? 'Sign in to book classes' : 'Join The Studio Reno'}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>}

            {mode === 'signup' && (
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="First Name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent" required />
                <input type="text" placeholder="Last Name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent" required />
              </div>
            )}

            <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent" required />

            {mode === 'signup' && (
              <input type="tel" placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
            )}

            <input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent" required minLength={6} />

            {mode === 'signup' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <div className="text-sm text-gray-700">
                    <p className="font-medium mb-1">We need your contact info to send you:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Class reminders and schedule changes</li>
                      <li>Membership status and renewal notices</li>
                      <li>Important updates about classes you&apos;ve booked</li>
                    </ul>
                    <p className="mt-2 text-xs text-gray-600">Without email/phone, we can&apos;t notify you about your own bookings.</p>
                  </div>
                </div>

                <div className="border-t border-blue-200 pt-3 space-y-2">
                  <p className="text-xs font-medium text-gray-700">Optional marketing communications:</p>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.email_opt_in}
                      onChange={(e) => setForm({ ...form, email_opt_in: e.target.checked })}
                      className="mt-0.5 w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                    />
                    <span className="text-xs text-gray-700">
                      <strong>Email me</strong> about special offers, new classes, and studio news
                    </span>
                  </label>

                  {form.phone && (
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.sms_opt_in}
                        onChange={(e) => setForm({ ...form, sms_opt_in: e.target.checked })}
                        className="mt-0.5 w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                      />
                      <span className="text-xs text-gray-700">
                        <strong>Text me</strong> about special offers and class reminders (optional)
                      </span>
                    </label>
                  )}

                  <p className="text-xs text-gray-500 italic">You can change these preferences anytime in your account settings.</p>
                </div>
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50">
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }} className="text-amber-600 font-medium hover:text-amber-700">
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// BOOKING MODAL
// ============================================

function BookingModal({ isOpen, onClose, classInfo, user, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [membership, setMembership] = useState(null);

  useEffect(() => {
    if (isOpen && user) {
      loadMembership();
    }
  }, [isOpen, user]);

  const loadMembership = async () => {
    try {
      const data = await api('/memberships/mine');
      const active = data.memberships?.find(m => m.status === 'active');
      setMembership(active);
    } catch (err) {
      console.error('Failed to load membership:', err);
    }
  };

  const handleBook = async () => {
    setLoading(true);
    setError('');

    try {
      await api('/bookings', {
        method: 'POST',
        body: JSON.stringify({ class_id: classInfo.id }),
      });
      onSuccess('Class booked successfully!');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !classInfo) return null;

  const isFull = classInfo.booked >= classInfo.capacity;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{classInfo.class_name}</h2>
            <p className="text-gray-500 mt-1">{classInfo.teacher_name}</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Date</span>
              <span className="font-medium">{new Date(classInfo.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Time</span>
              <span className="font-medium">{classInfo.start_time?.slice(0, 5)}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Duration</span>
              <span className="font-medium">{classInfo.duration} minutes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Location</span>
              <span className="font-medium">{classInfo.location_name}</span>
            </div>
          </div>

          {membership ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-green-800 font-medium">{membership.name}</p>
              <p className="text-green-600 text-sm">
                {membership.credits_remaining !== null ? `${membership.credits_remaining} credits remaining` : 'Unlimited classes'}
              </p>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <p className="text-amber-800 font-medium">No active membership</p>
              <p className="text-amber-600 text-sm">A drop-in fee of $22 will apply</p>
            </div>
          )}

          {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">
              Cancel
            </button>
            <button onClick={handleBook} disabled={loading} className={`flex-1 px-4 py-3 rounded-lg font-medium transition ${isFull ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'} disabled:opacity-50`}>
              {loading ? 'Booking...' : isFull ? 'Join Waitlist' : 'Book Class'}
            </button>
          </div>

          <p className="text-center text-sm text-gray-500 mt-4">
            {classInfo.booked}/{classInfo.capacity} spots filled
            {classInfo.waitlist_count > 0 && ` • ${classInfo.waitlist_count} on waitlist`}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// NAVIGATION
// ============================================

function Navigation({ currentPage, setCurrentPage, user, onShowAuth, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <button onClick={() => setCurrentPage('home')} className="flex items-center">
              <span className="text-2xl font-bold text-amber-600">The Studio</span>
              <span className="text-2xl font-light text-gray-700 ml-1">Reno</span>
            </button>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <button onClick={() => setCurrentPage('schedule')} className={`${currentPage === 'schedule' ? 'text-amber-600' : 'text-gray-600'} hover:text-gray-900`}>Schedule</button>
            <button onClick={() => setCurrentPage('classes')} className={`${currentPage === 'classes' ? 'text-amber-600' : 'text-gray-600'} hover:text-gray-900`}>Classes</button>
            <button onClick={() => setCurrentPage('teachers')} className={`${currentPage === 'teachers' ? 'text-amber-600' : 'text-gray-600'} hover:text-gray-900`}>Teachers</button>
            <button onClick={() => setCurrentPage('pricing')} className={`${currentPage === 'pricing' ? 'text-amber-600' : 'text-gray-600'} hover:text-gray-900`}>Pricing</button>
            <button onClick={() => setCurrentPage('for-teachers')} className={`${currentPage === 'for-teachers' ? 'text-amber-600' : 'text-gray-600'} hover:text-gray-900`}>For Teachers</button>
            <button onClick={() => setCurrentPage('shop')} className={`${currentPage === 'shop' ? 'text-amber-600' : 'text-gray-600'} hover:text-gray-900`}>Shop</button>
            
            {user ? (
              <div className="flex items-center gap-4">
                <button onClick={() => setCurrentPage('account')} className={`${currentPage === 'account' ? 'text-amber-600' : 'text-gray-600'} hover:text-gray-900`}>My Account</button>
                <button onClick={onLogout} className="text-gray-400 hover:text-gray-600">Logout</button>
              </div>
            ) : (
              <button onClick={() => onShowAuth('login')} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium transition">
                Sign In
              </button>
            )}
          </div>

          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-white border-t">
          <div className="px-4 py-3 space-y-3">
            <button onClick={() => { setCurrentPage('schedule'); setMobileOpen(false); }} className="block w-full text-left text-gray-600">Schedule</button>
            <button onClick={() => { setCurrentPage('classes'); setMobileOpen(false); }} className="block w-full text-left text-gray-600">Classes</button>
            <button onClick={() => { setCurrentPage('teachers'); setMobileOpen(false); }} className="block w-full text-left text-gray-600">Teachers</button>
            <button onClick={() => { setCurrentPage('pricing'); setMobileOpen(false); }} className="block w-full text-left text-gray-600">Pricing</button>
            <button onClick={() => { setCurrentPage('for-teachers'); setMobileOpen(false); }} className="block w-full text-left text-gray-600">For Teachers</button>
            <button onClick={() => { setCurrentPage('shop'); setMobileOpen(false); }} className="block w-full text-left text-gray-600">Shop</button>
            {user ? (
              <>
                <button onClick={() => { setCurrentPage('account'); setMobileOpen(false); }} className="block w-full text-left text-gray-600">My Account</button>
                <button onClick={onLogout} className="block w-full text-left text-gray-400">Logout</button>
              </>
            ) : (
              <button onClick={() => { onShowAuth('login'); setMobileOpen(false); }} className="block w-full bg-amber-600 text-white text-center py-2 rounded-lg">Sign In</button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

// ============================================
// FOOTER
// ============================================

function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-2xl font-bold mb-4">The Studio Reno</h3>
            <p className="text-gray-400 mb-4">Your sanctuary for yoga, movement, and mindfulness in the heart of Reno.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-gray-400">
              <li><a href="#" className="hover:text-white">Schedule</a></li>
              <li><a href="#" className="hover:text-white">Pricing</a></li>
              <li><a href="#" className="hover:text-white">New Student Special</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-gray-400">
              <li>1085 S Virginia St</li>
              <li>Reno, NV 89502</li>
              <li>(775) 555-YOGA</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
          <p>&copy; {new Date().getFullYear()} The Studio Reno. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

// ============================================
// HOME PAGE
// ============================================

function HomePage({ setCurrentPage, onShowAuth }) {
  return (
    <div>
      <section className="relative bg-gradient-to-br from-amber-50 to-orange-100 py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-6">
              Find Your Flow at<br /><span className="text-amber-600">The Studio Reno</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8">Your sanctuary for yoga, movement, and mindfulness. Join our community and discover the transformative power of practice.</p>
            <div className="flex flex-wrap gap-4">
              <button onClick={() => setCurrentPage('schedule')} className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-3 rounded-lg font-semibold transition">View Schedule</button>
              <button onClick={() => setCurrentPage('pricing')} className="bg-white hover:bg-gray-50 text-gray-900 px-8 py-3 rounded-lg font-semibold border border-gray-300 transition">New Student Special</button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why The Studio Reno?</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: 'Expert Teachers', description: 'Our certified instructors bring decades of combined experience.', icon: '🧘' },
              { title: 'Diverse Classes', description: 'From heated power flows to restorative yin, we have something for everyone.', icon: '🌟' },
              { title: 'Welcoming Space', description: 'Beautiful studios designed to help you disconnect and connect.', icon: '🏠' },
            ].map((feature, i) => (
              <div key={i} className="text-center p-6">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Two Locations, One Community</h2>
            <p className="text-gray-600">Each space offers a unique experience</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl shadow-sm p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">🏛️</span>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">OG Location</h3>
                  <p className="text-sm text-gray-500">1085 S Virginia St</p>
                </div>
              </div>
              <p className="text-gray-600 mb-4">The heart of The Studio - your home for traditional unlimited yoga classes.</p>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 mt-1">✓</span>
                  <span>Main yoga studio with daily classes</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 mt-1">✓</span>
                  <span>Tea Lounge & Elixir Bar (2x weekly)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 mt-1">✓</span>
                  <span>Massage & bodywork rooms</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 mt-1">✓</span>
                  <span>Unlimited access for all members</span>
                </li>
              </ul>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">🌙</span>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Moran St Location</h3>
                  <p className="text-sm text-gray-500">Hybrid Model</p>
                </div>
              </div>
              <p className="text-gray-600 mb-4">Flexible space offering both traditional classes and specialty co-op sessions.</p>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-1">✓</span>
                  <span>Traditional yoga classes (unlimited for members)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-1">✓</span>
                  <span>Specialty co-op classes (breathwork, sound baths, etc.)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-1">✓</span>
                  <span>Members get 25% off + 2 free credits for co-op classes</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-1">✓</span>
                  <span>Space available for teachers to rent</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-amber-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">New to The Studio?</h2>
          <p className="text-amber-100 mb-8 text-lg">Try us out with our intro offer: 30 days of unlimited yoga for just $49</p>
          <button onClick={() => onShowAuth('signup')} className="bg-white hover:bg-gray-100 text-amber-600 px-8 py-3 rounded-lg font-semibold transition">Get Started</button>
        </div>
      </section>
    </div>
  );
}

// ============================================
// SCHEDULE PAGE
// ============================================

function SchedulePage({ user, onShowAuth, onBookClass }) {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [classTypes, setClassTypes] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [filter, setFilter] = useState({ classType: '', teacher: '' });

  useEffect(() => { loadFilters(); loadSchedule(); }, [currentDate]);

  const loadFilters = async () => {
    try {
      const [typesRes, teachersRes] = await Promise.all([
        fetch(`${API_URL}/classes/types/list`).then(r => r.json()),
        fetch(`${API_URL}/classes/teachers/list`).then(r => r.json()),
      ]);
      setClassTypes(typesRes.class_types || []);
      setTeachers(teachersRes.teachers || []);
    } catch (err) { console.error('Failed to load filters:', err); }
  };

  const loadSchedule = async () => {
    setLoading(true);
    try {
      const startDate = new Date(currentDate);
      startDate.setDate(startDate.getDate() - startDate.getDay());
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      const res = await fetch(`${API_URL}/classes/schedule?start_date=${startDate.toISOString().split('T')[0]}&end_date=${endDate.toISOString().split('T')[0]}`);
      const data = await res.json();
      setSchedule(data.schedule || []);
    } catch (err) { console.error('Failed to load schedule:', err); }
    finally { setLoading(false); }
  };

  const navigateWeek = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction * 7));
    setCurrentDate(newDate);
  };

  const filterClasses = (classes) => {
    return classes.filter(cls => {
      if (filter.classType && cls.class_type_id !== filter.classType) return false;
      if (filter.teacher && cls.teacher_id !== filter.teacher) return false;
      return true;
    });
  };

  const handleClassClick = (cls) => {
    if (!user) {
      onShowAuth('login');
    } else {
      onBookClass(cls);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4 md:mb-0">Class Schedule</h1>
        <div className="flex items-center gap-4">
          <button onClick={() => navigateWeek(-1)} className="p-2 hover:bg-gray-100 rounded-lg">←</button>
          <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 text-amber-600 hover:bg-amber-50 rounded-lg font-medium">This Week</button>
          <button onClick={() => navigateWeek(1)} className="p-2 hover:bg-gray-100 rounded-lg">→</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-8">
        <select value={filter.classType} onChange={(e) => setFilter({ ...filter, classType: e.target.value })} className="px-4 py-2 border border-gray-300 rounded-lg">
          <option value="">All Class Types</option>
          {classTypes.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
        </select>
        <select value={filter.teacher} onChange={(e) => setFilter({ ...filter, teacher: e.target.value })} className="px-4 py-2 border border-gray-300 rounded-lg">
          <option value="">All Teachers</option>
          {teachers.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {schedule.map((day) => {
            const date = new Date(day.date + 'T00:00:00');
            const filteredClasses = filterClasses(day.classes);
            return (
              <div key={day.date} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 text-center border-b">
                  <p className="text-sm text-gray-500">{date.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                  <p className="text-2xl font-bold text-gray-900">{date.getDate()}</p>
                </div>
                <div className="p-2 space-y-2 min-h-[200px]">
                  {filteredClasses.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-4">No classes</p>
                  ) : (
                    filteredClasses.map((cls) => (
                      <button key={cls.id} onClick={() => handleClassClick(cls)} className={`w-full text-left p-3 rounded-lg border transition ${cls.is_coop_class ? 'bg-purple-50/50 hover:bg-purple-100 border-purple-200' : 'hover:bg-amber-50 border-gray-100 hover:border-amber-200'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <p className={`font-semibold ${cls.is_coop_class ? 'text-purple-600' : 'text-amber-600'}`}>{cls.start_time?.slice(0, 5)}</p>
                          {cls.is_coop_class && <span className="text-[10px] px-1.5 py-0.5 bg-purple-200 text-purple-800 rounded font-medium">Co-op</span>}
                        </div>
                        <p className="font-medium text-gray-900 text-sm">{cls.class_name}</p>
                        <p className="text-xs text-gray-500">{cls.teacher_name}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-gray-400">{cls.duration}min</span>
                          <span className={`text-xs ${cls.booked >= cls.capacity ? 'text-red-500' : 'text-green-600'}`}>
                            {cls.booked >= cls.capacity ? 'Full' : `${cls.capacity - cls.booked} spots`}
                          </span>
                        </div>
                        {cls.is_coop_class && cls.coop_price && (
                          <p className="text-[10px] text-purple-600 mt-1">${cls.coop_price} • {cls.coop_credits || 1} credit(s)</p>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================
// PRICING PAGE
// ============================================

function PricingPage({ onShowAuth }) {
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadMemberships(); }, []);

  const loadMemberships = async () => {
    try {
      const res = await fetch(`${API_URL}/memberships/types`);
      const data = await res.json();
      setMemberships(data.membership_types || []);
    } catch (err) { console.error('Failed to load memberships:', err); }
    finally { setLoading(false); }
  };

  const introOffer = memberships.find(m => m.is_intro_offer);
  const regularMemberships = memberships.filter(m => !m.is_intro_offer);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Simple, Flexible Pricing</h1>
        <p className="text-gray-600">Choose the option that fits your practice. No hidden fees.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div></div>
      ) : (
        <>
          {introOffer && (
            <div className="mb-12">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-8 text-white text-center">
                <span className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-medium mb-4">New Student Special</span>
                <h2 className="text-3xl font-bold mb-2">{introOffer.name}</h2>
                <div className="text-5xl font-bold mb-4">${introOffer.price}</div>
                <p className="text-amber-100 mb-6">{introOffer.duration_days} days of unlimited yoga</p>
                <button onClick={() => onShowAuth('signup')} className="bg-white hover:bg-gray-100 text-amber-600 px-8 py-3 rounded-lg font-semibold transition">Get Started</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {regularMemberships.map((m) => (
              <div key={m.id} className={`bg-white rounded-xl shadow-sm p-6 border-2 ${m.type === 'unlimited' ? 'border-amber-500' : 'border-transparent'}`}>
                {m.type === 'unlimited' && <span className="inline-block bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm font-medium mb-4">Most Popular</span>}
                <h3 className="text-xl font-bold text-gray-900 mb-2">{m.name}</h3>
                <p className="text-gray-600 text-sm mb-4">{m.description}</p>
                <div className="text-4xl font-bold text-gray-900 mb-1">${m.price}</div>
                <p className="text-gray-500 text-sm mb-6">{m.type === 'unlimited' ? 'per month' : m.credits ? `${m.credits} classes` : ''}</p>
                <button onClick={() => onShowAuth('signup')} className={`w-full py-3 rounded-lg font-medium transition ${m.type === 'unlimited' ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}>
                  Choose Plan
                </button>
              </div>
            ))}
          </div>

          {/* Member Perks Section */}
          <div className="mt-16">
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl p-8 border-2 border-purple-200">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Exclusive Member Perks</h3>
                <p className="text-gray-600">Access specialty co-op classes at our Moran St location</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-xl p-6 text-center">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">25%</span>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">Member Discount</h4>
                  <p className="text-sm text-gray-600">Get 25% off all co-op specialty classes like breathwork, sound baths, and workshops</p>
                </div>
                <div className="bg-white rounded-xl p-6 text-center">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl font-bold">2</span>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">Free Monthly Credits</h4>
                  <p className="text-sm text-gray-600">Enjoy 2 free co-op class credits every month to explore new modalities</p>
                </div>
                <div className="bg-white rounded-xl p-6 text-center">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">∞</span>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">Unlimited Yoga</h4>
                  <p className="text-sm text-gray-600">Full access to all traditional yoga classes at both OG and Moran locations</p>
                </div>
              </div>
              <div className="text-center mt-6">
                <p className="text-sm text-gray-500">
                  Co-op classes are taught by independent practitioners who rent our space. Your membership unlocks special access to these unique offerings.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// TEACHERS PAGE
// ============================================

function TeachersPage() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTeachers(); }, []);

  const loadTeachers = async () => {
    try {
      const res = await fetch(`${API_URL}/classes/teachers/list`);
      const data = await res.json();
      setTeachers(data.teachers || []);
    } catch (err) { console.error('Failed to load teachers:', err); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Meet Our Teachers</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {teachers.map((teacher) => (
            <div key={teacher.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="aspect-square bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                <span className="text-6xl font-bold text-amber-300">{teacher.first_name?.[0]}{teacher.last_name?.[0]}</span>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900">{teacher.first_name} {teacher.last_name}</h3>
                {teacher.bio && <p className="text-gray-600 mt-3 text-sm">{teacher.bio}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// CLASSES PAGE
// ============================================

function ClassesPage() {
  const [classTypes, setClassTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadClassTypes(); }, []);

  const loadClassTypes = async () => {
    try {
      const res = await fetch(`${API_URL}/classes/types/list`);
      const data = await res.json();
      setClassTypes(data.class_types || []);
    } catch (err) { console.error('Failed to load class types:', err); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Our Classes</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {classTypes.map((ct) => (
            <div key={ct.id} className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{ct.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{ct.category}</span>
                    <span className="text-sm text-gray-500">{ct.duration} min</span>
                    {ct.is_heated && <span className="text-sm">🔥</span>}
                  </div>
                </div>
                <span className="text-sm text-gray-500 capitalize">{ct.level}</span>
              </div>
              <p className="text-gray-600">{ct.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// SHOP PAGE
// ============================================

function ShopPage({ user, onShowAuth }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => { loadProducts(); loadCategories(); }, [selectedCategory]);

  const loadCategories = async () => {
    try {
      const res = await fetch(`${API_URL}/retail/categories`);
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (err) { console.error('Failed to load categories:', err); }
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const url = selectedCategory 
        ? `${API_URL}/retail/products?category=${selectedCategory}`
        : `${API_URL}/retail/products`;
      const res = await fetch(url);
      const data = await res.json();
      setProducts(data.products || []);
    } catch (err) { console.error('Failed to load products:', err); }
    finally { setLoading(false); }
  };

  const addToCart = (product, variant) => {
    const existing = cart.find(item => item.variant_id === variant.id);
    if (existing) {
      setCart(cart.map(item => 
        item.variant_id === variant.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        product_id: product.id,
        variant_id: variant.id,
        product_name: product.name,
        variant_name: variant.name,
        price: variant.retail_price || product.retail_price,
        image_url: product.image_url,
        quantity: 1
      }]);
    }
    setToast({ message: 'Added to cart!', type: 'success' });
    setSelectedProduct(null);
    setSelectedVariant(null);
  };

  const removeFromCart = (variantId) => {
    setCart(cart.filter(item => item.variant_id !== variantId));
  };

  const updateQuantity = (variantId, delta) => {
    setCart(cart.map(item => {
      if (item.variant_id === variantId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shop</h1>
          <p className="text-gray-600">Gear for your practice</p>
        </div>
        <button onClick={() => setShowCart(true)} className="relative flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
          Cart
          {cartCount > 0 && <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{cartCount}</span>}
        </button>
      </div>

      {/* Categories */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        <button onClick={() => setSelectedCategory('')} className={`px-4 py-2 rounded-full whitespace-nowrap ${!selectedCategory ? 'bg-amber-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
          All Products
        </button>
        {categories.filter(c => !c.parent_id).map(cat => (
          <button key={cat.id} onClick={() => setSelectedCategory(cat.slug)} className={`px-4 py-2 rounded-full whitespace-nowrap ${selectedCategory === cat.slug ? 'bg-amber-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
            {cat.name}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div></div>
      ) : products.length === 0 ? (
        <div className="text-center py-12"><p className="text-gray-500">No products found</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map(product => (
            <div key={product.id} className="bg-white rounded-xl shadow-sm overflow-hidden group cursor-pointer" onClick={() => setSelectedProduct(product)}>
              <div className="aspect-square bg-gray-100 relative">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                )}
                {product.is_featured && <span className="absolute top-2 left-2 bg-amber-500 text-white text-xs px-2 py-1 rounded">Featured</span>}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 group-hover:text-amber-600">{product.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{product.category_name}</p>
                <p className="text-lg font-bold text-amber-600 mt-2">${parseFloat(product.retail_price).toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => { setSelectedProduct(null); setSelectedVariant(null); }}></div>
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6">
              <button onClick={() => { setSelectedProduct(null); setSelectedVariant(null); }} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="aspect-square bg-gray-100 rounded-lg">
                  {selectedProduct.image_url ? (
                    <img src={selectedProduct.image_url} alt={selectedProduct.name} className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">No image</div>
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedProduct.name}</h2>
                  <p className="text-2xl font-bold text-amber-600 mt-2">${parseFloat(selectedProduct.retail_price).toFixed(2)}</p>
                  <p className="text-gray-600 mt-4">{selectedProduct.description}</p>
                  
                  {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                    <div className="mt-6">
                      <p className="font-medium text-gray-900 mb-2">Select Option:</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedProduct.variants.filter(v => v.quantity_available > 0).map(variant => (
                          <button
                            key={variant.id}
                            onClick={() => setSelectedVariant(variant)}
                            className={`px-4 py-2 border-2 rounded-lg ${selectedVariant?.id === variant.id ? 'border-amber-600 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}
                          >
                            {variant.name}
                          </button>
                        ))}
                      </div>
                      {selectedProduct.variants.filter(v => v.quantity_available <= 0).length > 0 && (
                        <p className="text-sm text-gray-500 mt-2">Some options are out of stock</p>
                      )}
                    </div>
                  )}
                  
                  <button
                    onClick={() => selectedVariant && addToCart(selectedProduct, selectedVariant)}
                    disabled={!selectedVariant}
                    className="w-full mt-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {selectedVariant ? 'Add to Cart' : 'Select an Option'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowCart(false)}></div>
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Shopping Cart ({cartCount})</h2>
              <button onClick={() => setShowCart(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <div className="text-center py-12 text-gray-500">Your cart is empty</div>
              ) : (
                <div className="space-y-4">
                  {cart.map(item => (
                    <div key={item.variant_id} className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="w-20 h-20 bg-gray-200 rounded flex-shrink-0">
                        {item.image_url && <img src={item.image_url} alt="" className="w-full h-full object-cover rounded" />}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium">{item.product_name}</h3>
                        <p className="text-sm text-gray-500">{item.variant_name}</p>
                        <p className="text-amber-600 font-semibold">${parseFloat(item.price).toFixed(2)}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={() => updateQuantity(item.variant_id, -1)} className="w-8 h-8 border rounded hover:bg-gray-100">-</button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.variant_id, 1)} className="w-8 h-8 border rounded hover:bg-gray-100">+</button>
                          <button onClick={() => removeFromCart(item.variant_id)} className="ml-auto text-red-500 text-sm">Remove</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {cart.length > 0 && (
              <div className="p-4 border-t space-y-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Subtotal</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
                <p className="text-sm text-gray-500">Shipping and taxes calculated at checkout</p>
                <button
                  onClick={() => {
                    if (!user) {
                      onShowAuth('login');
                      setShowCart(false);
                    } else {
                      // TODO: Implement checkout
                      setToast({ message: 'Checkout coming soon!', type: 'success' });
                    }
                  }}
                  className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg"
                >
                  {user ? 'Checkout' : 'Sign in to Checkout'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// FOR TEACHERS PAGE (Space Rental)
// ============================================

function ForTeachersPage({ onShowAuth }) {
  const [selectedRoom, setSelectedRoom] = useState('large');
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    room_type: 'either',
    rental_type: 'not_sure',
    practice_type: '',
    experience_years: '',
    has_insurance: false,
    following_size: '',
    message: '',
    hear_about_us: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/rentals/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit inquiry');
      }

      setSubmitted(true);
      // Scroll to top to show success message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const largeRoomPricing = [
    { slot: 'Off-Peak', hours: 'Weekday 1-4pm', rent: 100, breakeven: '5 @ $20' },
    { slot: 'Standard', hours: 'Weekday 9am-1pm, 4-5:30pm', rent: 125, breakeven: '6 @ $22' },
    { slot: 'Prime', hours: 'Weekday 5:30-8pm', rent: 150, breakeven: '6 @ $25' },
    { slot: 'Weekend', hours: 'Sat-Sun all day', rent: 150, breakeven: '6 @ $25' },
  ];

  const smallRoomPricing = [
    { slot: 'Off-Peak', hours: 'Weekday 1-4pm', rent: 75, breakeven: '3 @ $25' },
    { slot: 'Standard', hours: 'Weekday 9am-1pm, 4-5:30pm', rent: 100, breakeven: '4 @ $28' },
    { slot: 'Prime/Weekend', hours: 'Evenings & weekends', rent: 125, breakeven: '4 @ $32' },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-purple-50 to-indigo-100 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Teach at <span className="text-purple-600">The Studio Reno</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Rent our beautiful studio spaces by the hour. Bring your following, set your own prices, and keep your revenue. We handle the space, you handle the magic.
            </p>
            <div className="flex flex-wrap gap-4">
              <a href="#pricing" className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-semibold transition">
                View Pricing
              </a>
              <a href="#contact" className="bg-white hover:bg-gray-50 text-gray-900 px-8 py-3 rounded-lg font-semibold border border-gray-300 transition">
                Get in Touch
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">How the Co-op Model Works</h2>
            <p className="text-gray-600">Simple, transparent, empowering</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: '1', title: 'Book Your Slot', description: 'Choose your preferred time and room. Book by the hour or commit to monthly.' },
              { step: '2', title: 'Set Your Price', description: "You're in control. Price your class based on your offering and audience." },
              { step: '3', title: 'Bring Your People', description: 'Market to your existing following or tap into our member community.' },
              { step: '4', title: 'Keep Your Revenue', description: 'Pay the rental fee, keep everything else. No revenue splits or commissions.' },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-purple-600">{item.step}</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Spaces */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Choose Your Space</h2>
            <p className="text-gray-600">Both rooms located at our Moran St location</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Large Yoga Room</h3>
              <p className="text-gray-600 mb-4">Perfect for yoga classes, movement workshops, and group sessions</p>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-1">✓</span>
                  <span>Capacity: ~25 students</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-1">✓</span>
                  <span>1.5-hour time blocks</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-1">✓</span>
                  <span>Professional sound system</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-1">✓</span>
                  <span>Beautiful natural lighting</span>
                </li>
              </ul>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Small Room</h3>
              <p className="text-gray-600 mb-4">Ideal for breathwork, sound baths, meditation, and intimate workshops</p>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-1">✓</span>
                  <span>Capacity: ~12 students</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-1">✓</span>
                  <span>Cozy, intimate atmosphere</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-1">✓</span>
                  <span>Equipment storage available (monthly)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-1">✓</span>
                  <span>Perfect for specialty modalities</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Transparent Pricing</h2>
            <p className="text-gray-600">Rent by the hour or commit to monthly</p>
          </div>

          {/* Room Selector */}
          <div className="flex justify-center gap-4 mb-8">
            <button
              onClick={() => setSelectedRoom('large')}
              className={`px-6 py-3 rounded-lg font-medium transition ${
                selectedRoom === 'large' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Large Room
            </button>
            <button
              onClick={() => setSelectedRoom('small')}
              className={`px-6 py-3 rounded-lg font-medium transition ${
                selectedRoom === 'small' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Small Room
            </button>
          </div>

          {/* Hourly Pricing Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Time Slot</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Hours</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Rent</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Break-even</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(selectedRoom === 'large' ? largeRoomPricing : smallRoomPricing).map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{row.slot}</td>
                      <td className="px-6 py-4 text-gray-600">{row.hours}</td>
                      <td className="px-6 py-4 text-lg font-bold text-purple-600">${row.rent}</td>
                      <td className="px-6 py-4 text-gray-600">{row.breakeven}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Monthly Rental Option */}
          <div className="bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl p-8 text-white">
            <div className="flex flex-col md:flex-row items-center justify-between">
              <div className="mb-6 md:mb-0">
                <h3 className="text-2xl font-bold mb-2">Monthly Rental - Small Room</h3>
                <p className="text-purple-100">For practitioners who need consistent access</p>
                <ul className="mt-4 space-y-2 text-purple-100">
                  <li>• 8-10 sessions per month</li>
                  <li>• Equipment storage included</li>
                  <li>• Priority booking</li>
                  <li>• 3-month initial commitment</li>
                </ul>
              </div>
              <div className="text-center">
                <div className="text-5xl font-bold mb-2">$850</div>
                <div className="text-purple-100">per month</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Teach at The Studio?</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: 'Zero Commission', description: 'Keep 100% of your revenue after the flat rental fee. No hidden costs or revenue splits.', icon: '💰' },
              { title: 'Bring Your Following', description: "Your students become part of our community. Many convert to studio members - we'll reward you when they do.", icon: '👥' },
              { title: 'Professional Space', description: 'Beautiful, well-maintained studios in the heart of Reno. Focus on teaching, we handle the rest.', icon: '✨' },
              { title: 'Flexible Booking', description: 'Book by the hour or commit to monthly. Scale up or down as your classes grow.', icon: '📅' },
              { title: 'Member Access', description: 'Our 50+ members get special perks to attend your classes - built-in audience potential.', icon: '🎁' },
              { title: 'Community Support', description: 'Join a collaborative community of teachers and practitioners. Share resources, not competition.', icon: '🤝' },
            ].map((benefit, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm p-6 text-center">
                <div className="text-4xl mb-4">{benefit.icon}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{benefit.title}</h3>
                <p className="text-gray-600">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Member Perks Explanation */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Studio Members Get Special Access</h3>
            <p className="text-gray-600 mb-6">
              Our members receive exclusive perks to attend co-op classes, helping you fill your room:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">25%</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Member Discount</h4>
                  <p className="text-sm text-gray-600">Members pay 25% less than your drop-in price</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">2</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Free Monthly Credits</h4>
                  <p className="text-sm text-gray-600">Members get 2 free co-op class credits each month</p>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-6">
              <strong>Note:</strong> Credits are capped at 3 per class to ensure you have mostly paying students. Credit users help fill your room and often become regular paying customers.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-6">
            {[
              {
                q: 'Do I need insurance?',
                a: 'Yes, all co-op teachers must carry their own liability insurance. We can recommend providers if needed.',
              },
              {
                q: 'How do I collect payments from students?',
                a: "You manage your own bookings and payments. We recommend platforms like Venmo, PayPal, or Mindbody for easy collection.",
              },
              {
                q: 'Can I store equipment at the studio?',
                a: 'Monthly renters of the small room get equipment storage included. Hourly renters can discuss storage options.',
              },
              {
                q: 'What if I need to cancel a booking?',
                a: 'We ask for 48-hour notice for cancellations. Monthly commitments require 30-day notice to end.',
              },
              {
                q: 'Do you provide marketing support?',
                a: "We'll list your classes on our website and promote to our member community. You're responsible for marketing to your own following.",
              },
            ].map((faq, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-gray-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Inquiry Form */}
      <section id="contact" className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Get in Touch</h2>
            <p className="text-gray-600">Fill out the form below and we'll be in touch within 1-2 business days</p>
          </div>

          {submitted ? (
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-8 text-center">
              <div className="text-5xl mb-4">✓</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h3>
              <p className="text-gray-600 mb-6">
                Your inquiry has been submitted successfully. We'll reach out within 1-2 business days to schedule a tour and discuss your needs.
              </p>
              <p className="text-sm text-gray-500">
                In the meantime, feel free to reach us at <a href="mailto:hello@thestudioreno.com" className="text-purple-600 hover:underline">hello@thestudioreno.com</a> or <a href="tel:7755555924" className="text-purple-600 hover:underline">(775) 555-5924</a>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-8">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                  {error}
                </div>
              )}

              {/* Contact Info */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                    <input
                      type="text"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                    <input
                      type="text"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Rental Preferences */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Rental Preferences</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Room</label>
                    <select
                      name="room_type"
                      value={formData.room_type}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="either">Either room</option>
                      <option value="large">Large Room (~25 capacity)</option>
                      <option value="small">Small Room (~12 capacity)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rental Type</label>
                    <select
                      name="rental_type"
                      value={formData.rental_type}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="not_sure">Not sure yet</option>
                      <option value="hourly">Hourly rental</option>
                      <option value="monthly">Monthly rental</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* About Your Practice */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">About Your Practice</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Practice Type</label>
                    <input
                      type="text"
                      name="practice_type"
                      value={formData.practice_type}
                      onChange={handleChange}
                      placeholder="e.g., Yoga, Breathwork, Sound Bath"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Years of Experience</label>
                    <input
                      type="number"
                      name="experience_years"
                      value={formData.experience_years}
                      onChange={handleChange}
                      min="0"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Following Size</label>
                    <select
                      name="following_size"
                      value={formData.following_size}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">Select...</option>
                      <option value="building">Building from scratch</option>
                      <option value="5-10">5-10 students</option>
                      <option value="10-20">10-20 students</option>
                      <option value="20+">20+ students</option>
                    </select>
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="has_insurance"
                        checked={formData.has_insurance}
                        onChange={handleChange}
                        className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">I have liability insurance</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Message */}
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows="4"
                  placeholder="Tell us about your vision, preferred schedule, or any questions you have..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                ></textarea>
              </div>

              {/* How did you hear about us */}
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-1">How did you hear about us?</label>
                <input
                  type="text"
                  name="hear_about_us"
                  value={formData.hear_about_us}
                  onChange={handleChange}
                  placeholder="Website, referral, social media, etc."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-semibold transition"
              >
                {submitting ? 'Submitting...' : 'Submit Inquiry'}
              </button>

              <p className="text-sm text-gray-500 text-center mt-4">
                Or reach us directly at <a href="mailto:hello@thestudioreno.com" className="text-purple-600 hover:underline">hello@thestudioreno.com</a> or <a href="tel:7755555924" className="text-purple-600 hover:underline">(775) 555-5924</a>
              </p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

// ============================================
// ACCOUNT PAGE
// ============================================

function AccountPage({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('bookings');
  const [bookings, setBookings] = useState([]);
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => { loadAccountData(); }, []);

  const loadAccountData = async () => {
    try {
      const [bookingsData, membershipData] = await Promise.all([
        api('/bookings/my-bookings?status=upcoming'),
        api('/memberships/mine'),
      ]);
      setBookings(bookingsData.bookings || []);
      setMembership(membershipData.memberships?.find(m => m.status === 'active'));
    } catch (err) { console.error('Failed to load account data:', err); }
    finally { setLoading(false); }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    try {
      await api(`/bookings/${bookingId}`, { method: 'DELETE' });
      setToast({ message: 'Booking cancelled', type: 'success' });
      loadAccountData();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Account</h1>
        <p className="text-gray-600">Welcome back, {user.first_name}!</p>
      </div>

      {/* Membership Card */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
        <h2 className="font-semibold text-gray-900 mb-4">My Membership</h2>
        {membership ? (
          <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
            <div>
              <p className="font-bold text-gray-900">{membership.name}</p>
              <p className="text-green-600">
                {membership.credits_remaining !== null ? `${membership.credits_remaining} credits remaining` : 'Unlimited classes'}
              </p>
            </div>
            {membership.end_date && (
              <p className="text-sm text-gray-500">Expires {new Date(membership.end_date).toLocaleDateString()}</p>
            )}
          </div>
        ) : (
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-gray-600 mb-3">No active membership</p>
            <a href="#pricing" className="text-amber-600 font-medium hover:text-amber-700">View membership options →</a>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 mb-6">
        <button onClick={() => setActiveTab('bookings')} className={`pb-3 font-medium border-b-2 -mb-px ${activeTab === 'bookings' ? 'border-amber-600 text-amber-600' : 'border-transparent text-gray-500'}`}>
          Upcoming Classes
        </button>
        <button onClick={() => setActiveTab('history')} className={`pb-3 font-medium border-b-2 -mb-px ${activeTab === 'history' ? 'border-amber-600 text-amber-600' : 'border-transparent text-gray-500'}`}>
          History
        </button>
        <button onClick={() => setActiveTab('profile')} className={`pb-3 font-medium border-b-2 -mb-px ${activeTab === 'profile' ? 'border-amber-600 text-amber-600' : 'border-transparent text-gray-500'}`}>
          Profile
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div></div>
      ) : (
        <>
          {activeTab === 'bookings' && (
            <div className="space-y-4">
              {bookings.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                  <p className="text-gray-500 mb-4">No upcoming classes</p>
                  <a href="#schedule" className="text-amber-600 font-medium hover:text-amber-700">Browse schedule →</a>
                </div>
              ) : (
                bookings.map((booking) => (
                  <div key={booking.id} className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-lg font-bold text-amber-600">{booking.start_time?.slice(0, 5)}</p>
                        <p className="text-xs text-gray-500">{new Date(booking.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{booking.class_name}</p>
                        <p className="text-sm text-gray-500">{booking.teacher_name} • {booking.location_name}</p>
                      </div>
                    </div>
                    <button onClick={() => handleCancelBooking(booking.id)} className="text-red-600 hover:text-red-700 font-medium text-sm">
                      Cancel
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <p className="text-gray-500">Your class history will appear here</p>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">First Name</label><input type="text" defaultValue={user.first_name} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label><input type="text" defaultValue={user.last_name} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" defaultValue={user.email} className="w-full px-3 py-2 border border-gray-300 rounded-lg" disabled /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input type="tel" defaultValue={user.phone} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
              <button className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg">Save Changes</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================
// MAIN APP
// ============================================

export default function PublicWebsite() {
  const [currentPage, setCurrentPage] = useState('home');
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [bookingClass, setBookingClass] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { checkAuth(); }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('user_token');
    if (!token) { setLoading(false); return; }
    try {
      const data = await api('/auth/me');
      setUser(data.user);
    } catch (err) {
      localStorage.removeItem('user_token');
    } finally {
      setLoading(false);
    }
  };

  const handleShowAuth = (mode) => {
    setAuthMode(mode);
    setShowAuth(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('user_token');
    setUser(null);
    setCurrentPage('home');
  };

  const handleBookClass = (cls) => {
    setBookingClass(cls);
  };

  const handleBookingSuccess = (message) => {
    setToast({ message, type: 'success' });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div></div>;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'home': return <HomePage setCurrentPage={setCurrentPage} onShowAuth={handleShowAuth} />;
      case 'schedule': return <SchedulePage user={user} onShowAuth={handleShowAuth} onBookClass={handleBookClass} />;
      case 'classes': return <ClassesPage />;
      case 'teachers': return <TeachersPage />;
      case 'pricing': return <PricingPage onShowAuth={handleShowAuth} />;
      case 'for-teachers': return <ForTeachersPage onShowAuth={handleShowAuth} />;
      case 'shop': return <ShopPage user={user} onShowAuth={handleShowAuth} />;
      case 'account': return user ? <AccountPage user={user} onLogout={handleLogout} /> : <HomePage setCurrentPage={setCurrentPage} onShowAuth={handleShowAuth} />;
      default: return <HomePage setCurrentPage={setCurrentPage} onShowAuth={handleShowAuth} />;
    }
  };

  return (
    <AuthContext.Provider value={{ user }}>
      <div className="min-h-screen flex flex-col">
        <Navigation currentPage={currentPage} setCurrentPage={setCurrentPage} user={user} onShowAuth={handleShowAuth} onLogout={handleLogout} />
        <main className="flex-1">{renderPage()}</main>
        <Footer />

        <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} onLogin={setUser} initialMode={authMode} />
        <BookingModal isOpen={!!bookingClass} onClose={() => setBookingClass(null)} classInfo={bookingClass} user={user} onSuccess={handleBookingSuccess} />
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      </div>
    </AuthContext.Provider>
  );
}
