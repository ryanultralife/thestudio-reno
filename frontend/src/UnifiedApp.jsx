import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth, api } from './lib/auth';
import { Layout, Modal, Toast, Spinner, Button } from './components/Layout';
import { Icons } from './components/Icons';

const inputClass = "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500";
const cardClass = "bg-white rounded-xl shadow-sm";
const formatDate = (d, opts) => new Date(d).toLocaleDateString('en-US', opts);

function AuthModal({ isOpen, onClose, initialMode = 'login' }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '', phone: '' });

  useEffect(() => { setMode(initialMode); setError(''); }, [initialMode, isOpen]);
  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      mode === 'login' ? await login(form.email, form.password) : await register(form);
      onClose();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const setField = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const toggle = () => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={mode === 'login' ? 'Welcome Back' : 'Create Account'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>}
        {mode === 'signup' && (
          <div className="grid grid-cols-2 gap-4">
            <input type="text" placeholder="First Name" value={form.first_name} onChange={setField('first_name')} className={inputClass} required />
            <input type="text" placeholder="Last Name" value={form.last_name} onChange={setField('last_name')} className={inputClass} required />
          </div>
        )}
        <input type="email" placeholder="Email" value={form.email} onChange={setField('email')} className={inputClass} required />
        {mode === 'signup' && <input type="tel" placeholder="Phone (optional)" value={form.phone} onChange={setField('phone')} className={inputClass} />}
        <input type="password" placeholder="Password" value={form.password} onChange={setField('password')} className={inputClass} required minLength={6} />
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-600">
        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
        <button onClick={toggle} className="text-amber-600 font-medium">{mode === 'login' ? 'Sign up' : 'Sign in'}</button>
      </p>
    </Modal>
  );
}

function HomePage() {
  const { user, isStaff } = useAuth();
  const [stats, setStats] = useState(null);
  const [todaysClasses, setTodaysClasses] = useState([]);
  const [myUpcoming, setMyUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      if (isStaff) {
        const [s, c] = await Promise.all([
          api('/reports/dashboard').catch(() => null),
          api(`/classes/schedule?start_date=${today}&end_date=${today}`).catch(() => ({ schedule: [] })),
        ]);
        setStats(s);
        setTodaysClasses(c.schedule?.[0]?.classes || []);
      }
      if (user) {
        const b = await api('/bookings/my?status=upcoming&limit=5').catch(() => ({ bookings: [] }));
        setMyUpcoming(b.bookings || []);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [user]);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner /></div>;

  const dateStr = formatDate(new Date(), { weekday: 'long', month: 'long', day: 'numeric' });

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
          <div><h1 className="text-2xl font-bold text-gray-900">Dashboard</h1><p className="text-gray-500">{dateStr}</p></div>
          <button onClick={loadData} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 px-3 py-2 hover:bg-gray-100 rounded-lg">
            <Icons.Refresh /> Refresh
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((s, i) => {
            const Icon = Icons[s.icon];
            return (
              <div key={i} className={`${cardClass} p-6`}>
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 ${s.color} rounded-lg flex items-center justify-center text-white`}><Icon /></div>
                  <span className="text-3xl font-bold text-gray-900">{s.value}</span>
                </div>
                <p className="text-gray-600 text-sm">{s.label}</p>
              </div>
            );
          })}
        </div>
        <div className={cardClass}>
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Today's Schedule</h2>
            <span className="text-sm text-gray-500">{todaysClasses.length} classes</span>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {todaysClasses.length === 0 ? <p className="px-6 py-8 text-center text-gray-500">No classes today</p> :
              todaysClasses.map((cls, i) => (
                <div key={i} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-500 w-16">{cls.start_time?.slice(0, 5)}</div>
                    <div><p className="font-medium text-gray-900">{cls.class_name}</p><p className="text-sm text-gray-500">{cls.teacher_name}</p></div>
                  </div>
                  <div className="text-right"><p className="text-sm font-medium">{cls.booked || 0}/{cls.capacity}</p><p className="text-xs text-gray-500">booked</p></div>
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  }

  const quickActions = [
    { path: '/schedule', icon: 'Calendar', label: 'Book a Class', color: 'amber' },
    { path: '/my-classes', icon: 'Check', label: 'My Classes', color: 'green' },
    { path: '/membership', icon: 'CreditCard', label: 'Membership', color: 'purple' },
    { path: '/profile', icon: 'User', label: 'Profile', color: 'blue' },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">{user ? `Welcome back, ${user.first_name}!` : 'Welcome to The Studio'}</h1><p className="text-gray-500">{dateStr}</p></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickActions.map((a, i) => {
          const Icon = Icons[a.icon];
          return (
            <button key={i} onClick={() => window.location.href = a.path} className={`${cardClass} p-6 text-center hover:shadow-md transition`}>
              <div className={`w-12 h-12 bg-${a.color}-100 rounded-full flex items-center justify-center mx-auto mb-3`}>
                <Icon className={`w-6 h-6 text-${a.color}-600`} />
              </div>
              <p className="font-medium text-gray-900">{a.label}</p>
            </button>
          );
        })}
      </div>
      {user && myUpcoming.length > 0 && (
        <div className={cardClass}>
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Upcoming Classes</h2>
            <a href="/my-classes" className="text-sm text-amber-600">View all</a>
          </div>
          <div className="divide-y">
            {myUpcoming.map((b, i) => (
              <div key={i} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-xs text-gray-500 uppercase">{formatDate(b.start_time, { weekday: 'short' })}</p>
                    <p className="text-lg font-bold text-gray-900">{new Date(b.start_time).getDate()}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{b.class_name}</p>
                    <p className="text-sm text-gray-500">{new Date(b.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} • {b.teacher_name}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${b.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{b.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {!user && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl shadow-lg p-8 text-white text-center">
          <h2 className="text-2xl font-bold mb-2">Join The Studio Reno</h2>
          <p className="mb-6 opacity-90">Sign up today and get your first class free!</p>
          <button onClick={() => window.dispatchEvent(new CustomEvent('openAuth', { detail: 'signup' }))} className="bg-white text-amber-600 px-6 py-3 rounded-lg font-semibold hover:bg-amber-50">Get Started</button>
        </div>
      )}
    </div>
  );
}

function SchedulePage() {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    const load = async () => {
      try {
        const start = selectedDate.toISOString().split('T')[0];
        const end = new Date(selectedDate); end.setDate(end.getDate() + 6);
        const data = await api(`/classes/schedule?start_date=${start}&end_date=${end.toISOString().split('T')[0]}`);
        setSchedule(data.schedule || []);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, [selectedDate]);

  const shiftWeek = (dir) => { const d = new Date(selectedDate); d.setDate(d.getDate() + dir * 7); setSelectedDate(d); };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Class Schedule</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftWeek(-1)} className="p-2 hover:bg-gray-100 rounded-lg"><Icons.ChevronLeft /></button>
          <span className="text-sm font-medium text-gray-700">
            {formatDate(selectedDate, { month: 'short', day: 'numeric' })} - {formatDate(new Date(selectedDate.getTime() + 6 * 86400000), { month: 'short', day: 'numeric' })}
          </span>
          <button onClick={() => shiftWeek(1)} className="p-2 hover:bg-gray-100 rounded-lg"><Icons.ChevronRight /></button>
        </div>
      </div>
      <div className={`${cardClass} overflow-hidden`}>
        {schedule.length === 0 ? <p className="px-6 py-12 text-center text-gray-500">No classes scheduled</p> :
          schedule.map((day, i) => (
            <div key={i}>
              <div className="bg-gray-50 px-6 py-3 border-b"><h3 className="font-semibold text-gray-900">{formatDate(day.date, { weekday: 'long', month: 'long', day: 'numeric' })}</h3></div>
              <div className="divide-y">
                {day.classes?.map((cls, j) => (
                  <div key={j} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-gray-500 w-20">{cls.start_time?.slice(0, 5)}</div>
                      <div><p className="font-medium text-gray-900">{cls.class_name}</p><p className="text-sm text-gray-500">{cls.teacher_name} • {cls.duration} min</p></div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right"><p className="text-sm font-medium">{cls.booked || 0}/{cls.capacity}</p></div>
                      <Button size="sm" disabled={(cls.booked || 0) >= cls.capacity}>{(cls.booked || 0) >= cls.capacity ? 'Full' : 'Book'}</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function MyClassesPage() {
  return <div className="space-y-6"><h1 className="text-2xl font-bold text-gray-900">My Classes</h1><p className="text-gray-500">Your upcoming and past class bookings will appear here.</p></div>;
}

function MembershipPage() {
  return <div className="space-y-6"><h1 className="text-2xl font-bold text-gray-900">Membership</h1><p className="text-gray-500">View and manage your membership here.</p></div>;
}

function ProfilePage() {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
      <div className={`${cardClass} p-6`}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-amber-600 rounded-full flex items-center justify-center text-white text-xl font-bold">{user?.first_name?.[0]}{user?.last_name?.[0]}</div>
          <div><h2 className="text-xl font-semibold text-gray-900">{user?.first_name} {user?.last_name}</h2><p className="text-gray-500">{user?.email}</p></div>
        </div>
      </div>
    </div>
  );
}

const ROUTES = { '/': HomePage, '/schedule': SchedulePage, '/my-classes': MyClassesPage, '/membership': MembershipPage, '/profile': ProfilePage };
const PAGE_IDS = { '/': 'home', '/schedule': 'schedule', '/my-classes': 'my-classes', '/membership': 'membership', '/profile': 'profile', '/staff/dashboard': 'dashboard' };

function AppContent() {
  const { isAuthenticated, isStaff, loading } = useAuth();
  const [authModal, setAuthModal] = useState({ open: false, mode: 'login' });
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onAuth = (e) => setAuthModal({ open: true, mode: e.detail || 'login' });
    const onNav = () => setPath(window.location.pathname);
    window.addEventListener('openAuth', onAuth);
    window.addEventListener('popstate', onNav);
    return () => { window.removeEventListener('openAuth', onAuth); window.removeEventListener('popstate', onNav); };
  }, []);

  const navigate = (p) => { window.history.pushState({}, '', p); setPath(p); };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Spinner /></div>;

  const Page = path.startsWith('/staff/') ? (isStaff ? HomePage : () => <div className="text-center py-12"><h2 className="text-xl font-semibold">Access Denied</h2></div>) : ROUTES[path] || HomePage;

  return (
    <>
      <Layout currentPage={PAGE_IDS[path] || 'home'} onNavigate={navigate}><Page /></Layout>
      <AuthModal isOpen={authModal.open} onClose={() => setAuthModal({ ...authModal, open: false })} initialMode={authModal.mode} />
    </>
  );
}

export default function UnifiedApp() {
  return <AuthProvider><AppContent /></AuthProvider>;
}
