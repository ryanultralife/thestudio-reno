// ============================================
// UNIFIED APP
// Single app for all users: clients, teachers, staff
// ============================================

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth, api } from './lib/auth';
import { Layout, Modal, Toast, Spinner, Button } from './components/Layout';
import { Icons } from './components/Icons';

// ============================================
// AUTH MODAL
// ============================================

function AuthModal({ isOpen, onClose, initialMode = 'login' }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
  });

  useEffect(() => {
    setMode(initialMode);
    setError('');
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form);
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={mode === 'login' ? 'Welcome Back' : 'Create Account'}>
      <p className="text-gray-500 text-sm mb-6 -mt-2">
        {mode === 'login' ? 'Sign in to book classes' : 'Join The Studio Reno'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        {mode === 'signup' && (
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="First Name"
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              required
            />
            <input
              type="text"
              placeholder="Last Name"
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              required
            />
          </div>
        )}

        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
          required
        />

        {mode === 'signup' && (
          <input
            type="tel"
            placeholder="Phone (optional)"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
          />
        )}

        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
          required
          minLength={6}
        />

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
        <button
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setError('');
          }}
          className="text-amber-600 font-medium hover:text-amber-700"
        >
          {mode === 'login' ? 'Sign up' : 'Sign in'}
        </button>
      </p>
    </Modal>
  );
}

// ============================================
// PAGE IMPORTS (lazy loaded)
// ============================================

// We'll import pages from the existing App.jsx structure
// For now, create inline versions

// ============================================
// PAGES
// ============================================

// Home/Dashboard Page - shows different content based on role
function HomePage() {
  const { user, isStaff } = useAuth();
  const [stats, setStats] = useState(null);
  const [todaysClasses, setTodaysClasses] = useState([]);
  const [myUpcoming, setMyUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      if (isStaff) {
        // Staff dashboard
        const [statsData, scheduleData] = await Promise.all([
          api('/reports/dashboard').catch(() => null),
          api(`/classes/schedule?start_date=${today}&end_date=${today}`).catch(() => ({ schedule: [] })),
        ]);
        setStats(statsData);
        setTodaysClasses(scheduleData.schedule?.[0]?.classes || []);
      }

      if (user) {
        // User's upcoming classes
        const bookingsData = await api('/bookings/my?status=upcoming&limit=5').catch(() => ({ bookings: [] }));
        setMyUpcoming(bookingsData.bookings || []);
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  // Staff Dashboard
  if (isStaff && stats) {
    const cards = [
      { label: "Today's Classes", value: stats?.today?.classes || 0, icon: 'Calendar', color: 'bg-blue-500' },
      { label: 'Checked In', value: stats?.today?.checked_in || 0, icon: 'Check', color: 'bg-green-500' },
      { label: 'Active Members', value: stats?.memberships?.active || 0, icon: 'Users', color: 'bg-purple-500' },
      { label: 'New This Week', value: stats?.new_members_this_week || 0, icon: 'TrendingUp', color: 'bg-amber-500' },
    ];

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 px-3 py-2 hover:bg-gray-100 rounded-lg"
          >
            <Icons.Refresh /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((s, i) => {
            const Icon = Icons[s.icon];
            return (
              <div key={i} className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 ${s.color} rounded-lg flex items-center justify-center text-white`}>
                    <Icon />
                  </div>
                  <span className="text-3xl font-bold text-gray-900">{s.value}</span>
                </div>
                <p className="text-gray-600 text-sm">{s.label}</p>
              </div>
            );
          })}
        </div>

        {/* Today's Schedule */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Today's Schedule</h2>
            <span className="text-sm text-gray-500">{todaysClasses.length} classes</span>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {todaysClasses.length === 0 ? (
              <p className="px-6 py-8 text-center text-gray-500">No classes today</p>
            ) : (
              todaysClasses.map((cls, i) => (
                <div key={i} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-500 w-16">{cls.start_time?.slice(0, 5)}</div>
                    <div>
                      <p className="font-medium text-gray-900">{cls.class_name}</p>
                      <p className="text-sm text-gray-500">{cls.teacher_name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {cls.booked || 0}/{cls.capacity}
                    </p>
                    <p className="text-xs text-gray-500">booked</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // Member Dashboard
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {user ? `Welcome back, ${user.first_name}!` : 'Welcome to The Studio'}
        </h1>
        <p className="text-gray-500">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => window.location.href = '/schedule'}
          className="bg-white rounded-xl shadow-sm p-6 text-center hover:shadow-md transition"
        >
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Icons.Calendar className="w-6 h-6 text-amber-600" />
          </div>
          <p className="font-medium text-gray-900">Book a Class</p>
        </button>

        <button
          onClick={() => window.location.href = '/my-classes'}
          className="bg-white rounded-xl shadow-sm p-6 text-center hover:shadow-md transition"
        >
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Icons.Check className="w-6 h-6 text-green-600" />
          </div>
          <p className="font-medium text-gray-900">My Classes</p>
        </button>

        <button
          onClick={() => window.location.href = '/membership'}
          className="bg-white rounded-xl shadow-sm p-6 text-center hover:shadow-md transition"
        >
          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Icons.CreditCard className="w-6 h-6 text-purple-600" />
          </div>
          <p className="font-medium text-gray-900">Membership</p>
        </button>

        <button
          onClick={() => window.location.href = '/profile'}
          className="bg-white rounded-xl shadow-sm p-6 text-center hover:shadow-md transition"
        >
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Icons.User className="w-6 h-6 text-blue-600" />
          </div>
          <p className="font-medium text-gray-900">Profile</p>
        </button>
      </div>

      {/* Upcoming Classes */}
      {user && myUpcoming.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Upcoming Classes</h2>
            <a href="/my-classes" className="text-sm text-amber-600 hover:text-amber-700">
              View all
            </a>
          </div>
          <div className="divide-y">
            {myUpcoming.map((booking, i) => (
              <div key={i} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-xs text-gray-500 uppercase">
                      {new Date(booking.start_time).toLocaleDateString('en-US', { weekday: 'short' })}
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {new Date(booking.start_time).getDate()}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{booking.class_name}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(booking.start_time).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                      {' • '}{booking.teacher_name}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    booking.status === 'confirmed'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {booking.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Promo for non-logged in users */}
      {!user && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl shadow-lg p-8 text-white text-center">
          <h2 className="text-2xl font-bold mb-2">Join The Studio Reno</h2>
          <p className="mb-6 opacity-90">Sign up today and get your first class free!</p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('openAuth', { detail: 'signup' }))}
            className="bg-white text-amber-600 px-6 py-3 rounded-lg font-semibold hover:bg-amber-50 transition"
          >
            Get Started
          </button>
        </div>
      )}
    </div>
  );
}

// Schedule Page Placeholder
function SchedulePage() {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    loadSchedule();
  }, [selectedDate]);

  const loadSchedule = async () => {
    try {
      const start = selectedDate.toISOString().split('T')[0];
      const end = new Date(selectedDate);
      end.setDate(end.getDate() + 6);
      const data = await api(`/classes/schedule?start_date=${start}&end_date=${end.toISOString().split('T')[0]}`);
      setSchedule(data.schedule || []);
    } catch (err) {
      console.error('Error loading schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Class Schedule</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() - 7);
              setSelectedDate(d);
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <Icons.ChevronLeft />
          </button>
          <span className="text-sm font-medium text-gray-700">
            {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
            {new Date(selectedDate.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
          <button
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() + 7);
              setSelectedDate(d);
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <Icons.ChevronRight />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {schedule.length === 0 ? (
          <p className="px-6 py-12 text-center text-gray-500">No classes scheduled for this period</p>
        ) : (
          schedule.map((day, i) => (
            <div key={i}>
              <div className="bg-gray-50 px-6 py-3 border-b">
                <h3 className="font-semibold text-gray-900">
                  {new Date(day.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </h3>
              </div>
              <div className="divide-y">
                {day.classes?.map((cls, j) => (
                  <div key={j} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-gray-500 w-20">
                        {cls.start_time?.slice(0, 5)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{cls.class_name}</p>
                        <p className="text-sm text-gray-500">
                          {cls.teacher_name} • {cls.duration} min • {cls.location_name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {cls.booked || 0}/{cls.capacity}
                        </p>
                        <p className="text-xs text-gray-500">spots</p>
                      </div>
                      <Button
                        size="sm"
                        disabled={(cls.booked || 0) >= cls.capacity}
                        onClick={() => {
                          // Handle booking
                          alert('Booking flow to be implemented');
                        }}
                      >
                        {(cls.booked || 0) >= cls.capacity ? 'Full' : 'Book'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Placeholder pages
function MyClassesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Classes</h1>
      <p className="text-gray-500">Your upcoming and past class bookings will appear here.</p>
    </div>
  );
}

function MembershipPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Membership</h1>
      <p className="text-gray-500">View and manage your membership here.</p>
    </div>
  );
}

function ProfilePage() {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-amber-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{user?.first_name} {user?.last_name}</h2>
            <p className="text-gray-500">{user?.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// ROUTING
// ============================================

function AppContent() {
  const { isAuthenticated, isStaff, loading } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [currentPage, setCurrentPage] = useState('home');
  const [toast, setToast] = useState(null);

  // Get current path
  const path = window.location.pathname;

  // Listen for auth modal events
  useEffect(() => {
    const handleOpenAuth = (e) => {
      setAuthMode(e.detail || 'login');
      setAuthModalOpen(true);
    };
    window.addEventListener('openAuth', handleOpenAuth);
    return () => window.removeEventListener('openAuth', handleOpenAuth);
  }, []);

  // Handle navigation
  const handleNavigate = (newPath) => {
    window.history.pushState({}, '', newPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // Determine current page based on path
  useEffect(() => {
    const pageMap = {
      '/': 'home',
      '/schedule': 'schedule',
      '/my-classes': 'my-classes',
      '/membership': 'membership',
      '/profile': 'profile',
      '/staff/dashboard': 'dashboard',
      '/staff/checkin': 'checkin',
      '/staff/clients': 'clients',
      '/staff/sell': 'sell',
      '/staff/subs': 'subs',
      '/staff/coop': 'coop',
      '/staff/reports': 'reports',
      '/staff/settings': 'settings',
    };
    setCurrentPage(pageMap[path] || 'home');
  }, [path]);

  // Route rendering
  const renderPage = () => {
    // Staff routes
    if (path.startsWith('/staff/')) {
      if (!isStaff) {
        return (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-gray-900">Access Denied</h2>
            <p className="text-gray-500 mt-2">You don't have permission to access this page.</p>
          </div>
        );
      }
      // TODO: Add staff-specific pages
      return <HomePage />;
    }

    switch (path) {
      case '/':
        return <HomePage />;
      case '/schedule':
        return <SchedulePage />;
      case '/my-classes':
        return isAuthenticated ? <MyClassesPage /> : <SchedulePage />;
      case '/membership':
        return <MembershipPage />;
      case '/profile':
        return isAuthenticated ? <ProfilePage /> : <HomePage />;
      default:
        return <HomePage />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <Layout currentPage={currentPage} onNavigate={handleNavigate}>
        {renderPage()}
      </Layout>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authMode}
      />

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </>
  );
}

// ============================================
// MAIN APP EXPORT
// ============================================

export default function UnifiedApp() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
