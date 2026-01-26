import React, { useState, useEffect, createContext, useContext } from 'react';

const AuthContext = createContext(null);
const API_URL = import.meta.env.VITE_API_URL || '/api';
function useAuth() { return useContext(AuthContext); }

async function api(endpoint, options = {}) {
  const token = localStorage.getItem('staff_token');
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }), ...options.headers },
  });
  if (res.status === 401) { localStorage.removeItem('staff_token'); window.location.reload(); return; }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const Icons = {
  Home: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  Calendar: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  Users: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  CreditCard: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
  Chart: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  Settings: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Search: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Check: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  X: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  Plus: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  Menu: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>,
  Logout: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  Refresh: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  DollarSign: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  User: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Mail: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  Phone: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
  Edit: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  Trash: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  TrendingUp: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
  AlertCircle: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  CheckCircle: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Swap: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>,
  Eye: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  EyeOff: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>,
  Building: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  Clock: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
};

function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  if (!isOpen) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose}></div>
        <div className={`relative bg-white rounded-2xl shadow-xl w-full ${sizes[size]} p-6 my-8`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full"><Icons.X /></button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function Toast({ message, type = 'success', onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 text-white ${type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>{message}</div>;
}

function Spinner() { return <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>; }

function EmptyState({ icon: Icon, message, action }) {
  return <div className="text-center py-12"><div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 text-gray-400 mb-4"><Icon /></div><p className="text-gray-500 mb-4">{message}</p>{action}</div>;
}

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      if (!['front_desk', 'teacher', 'manager', 'owner', 'admin'].includes(data.user.role)) throw new Error('Staff only');
      localStorage.setItem('staff_token', data.token);
      onLogin(data.user);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">The Studio Reno</h1>
          <p className="text-gray-500 mt-2">Staff Portal</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>}
          <div><label className="block text-sm font-medium text-gray-700 mb-2">Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500" required /></div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700">
                {showPassword ? <Icons.EyeOff className="w-5 h-5" /> : <Icons.Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 rounded-lg disabled:opacity-50">{loading ? 'Signing in...' : 'Sign In'}</button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-500">Test: admin@thestudioreno.com / admin123</p>
      </div>
    </div>
  );
}

function Sidebar({ user, currentPage, setCurrentPage, onLogout }) {
  const [collapsed, setCollapsed] = useState(false);
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Icons.Home, roles: ['front_desk', 'teacher', 'manager', 'owner', 'admin'] },
    { id: 'checkin', label: 'Check In', icon: Icons.Check, roles: ['front_desk', 'teacher', 'manager', 'owner', 'admin'] },
    { id: 'schedule', label: 'Schedule', icon: Icons.Calendar, roles: ['front_desk', 'teacher', 'manager', 'owner', 'admin'] },
    { id: 'coop', label: 'Co-op', icon: Icons.Building, roles: ['teacher', 'manager', 'owner', 'admin'] },
    { id: 'clients', label: 'Clients', icon: Icons.Users, roles: ['front_desk', 'manager', 'owner', 'admin'] },
    { id: 'sell', label: 'Sell', icon: Icons.CreditCard, roles: ['front_desk', 'manager', 'owner', 'admin'] },
    { id: 'subs', label: 'Sub Requests', icon: Icons.Swap, roles: ['teacher', 'manager', 'owner', 'admin'] },
    { id: 'reports', label: 'Reports', icon: Icons.Chart, roles: ['manager', 'owner', 'admin'] },
    { id: 'settings', label: 'Settings', icon: Icons.Settings, roles: ['owner', 'admin'] },
  ];
  const visible = navItems.filter(i => i.roles.includes(user.role));
  return (
    <div className={`bg-gray-900 text-white h-screen flex flex-col transition-all ${collapsed ? 'w-16' : 'w-64'}`}>
      <div className="p-4 flex items-center justify-between border-b border-gray-800">
        {!collapsed && <span className="font-bold text-lg">The Studio</span>}
        <button onClick={() => setCollapsed(!collapsed)} className="p-1 hover:bg-gray-800 rounded"><Icons.Menu /></button>
      </div>
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {visible.map(item => (
          <button key={item.id} onClick={() => setCurrentPage(item.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${currentPage === item.id ? 'bg-amber-600' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
            <item.icon />{!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-800">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 bg-amber-600 rounded-full flex items-center justify-center text-sm font-bold">{user.first_name?.[0]}{user.last_name?.[0]}</div>
          {!collapsed && <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{user.first_name} {user.last_name}</p><p className="text-xs text-gray-500 capitalize">{user.role.replace('_', ' ')}</p></div>}
          <button onClick={onLogout} className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white"><Icons.Logout /></button>
        </div>
      </div>
    </div>
  );
}

function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [todaysClasses, setTodaysClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [statsData, scheduleData] = await Promise.all([api('/reports/dashboard'), api(`/classes/schedule?start_date=${today}&end_date=${today}`)]);
      setStats(statsData);
      // Transform classes with proper field names
      const classes = (scheduleData.classes || []).map(cls => ({
        ...cls,
        teacher_name: cls.teacher || `${cls.teacher_first_name || ''} ${cls.teacher_last_name || ''}`.trim(),
        booked: cls.booked_count || 0,
      }));
      setTodaysClasses(classes);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner /></div>;

  const cards = [
    { label: "Today's Classes", value: stats?.today?.classes || 0, icon: Icons.Calendar, color: 'bg-blue-500' },
    { label: 'Checked In', value: stats?.today?.checked_in || 0, icon: Icons.Check, color: 'bg-green-500' },
    { label: 'Active Members', value: stats?.memberships?.active || 0, icon: Icons.Users, color: 'bg-purple-500' },
    { label: 'New This Week', value: stats?.new_members_this_week || 0, icon: Icons.TrendingUp, color: 'bg-amber-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Dashboard</h1><p className="text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p></div>
        <button onClick={loadDashboard} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 px-3 py-2 hover:bg-gray-100 rounded-lg"><Icons.Refresh /> Refresh</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((s, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 ${s.color} rounded-lg flex items-center justify-center text-white`}><s.icon /></div>
              <span className="text-3xl font-bold text-gray-900">{s.value}</span>
            </div>
            <p className="text-gray-600 text-sm">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b flex items-center justify-between"><h2 className="font-semibold text-gray-900">Today's Schedule</h2><span className="text-sm text-gray-500">{todaysClasses.length} classes</span></div>
        <div className="divide-y max-h-96 overflow-y-auto">
          {todaysClasses.length === 0 ? <p className="px-6 py-8 text-center text-gray-500">No classes today</p> : todaysClasses.map((cls, i) => (
            <div key={i} className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-center w-14"><p className="text-lg font-bold text-gray-900">{cls.start_time?.slice(0, 5)}</p><p className="text-xs text-gray-500">{cls.duration}min</p></div>
                <div><p className="font-medium text-gray-900">{cls.class_name}</p><p className="text-sm text-gray-500">{cls.teacher_name}</p></div>
              </div>
              <p className={`font-semibold ${cls.booked >= cls.capacity ? 'text-red-600' : 'text-gray-900'}`}>{cls.booked || 0}/{cls.capacity}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CheckInPage() {
  const [selectedClass, setSelectedClass] = useState(null);
  const [classes, setClasses] = useState([]);
  const [roster, setRoster] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const [quickResults, setQuickResults] = useState([]);

  useEffect(() => { loadClasses(); }, []);

  const loadClasses = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await api(`/classes/schedule?start_date=${today}&end_date=${today}`);
      // Transform classes with proper field names
      const todaysClasses = (data.classes || []).map(cls => ({
        ...cls,
        teacher_name: cls.teacher || `${cls.teacher_first_name || ''} ${cls.teacher_last_name || ''}`.trim(),
        booked: cls.booked_count || 0,
      }));
      setClasses(todaysClasses);
      const now = new Date();
      const currentMin = now.getHours() * 60 + now.getMinutes();
      const next = todaysClasses.find(c => { const [h, m] = c.start_time.split(':').map(Number); return h * 60 + m >= currentMin - 30; });
      if (next) { setSelectedClass(next); loadRoster(next.id); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadRoster = async (id) => { try { const d = await api(`/classes/${id}/roster`); setRoster((d.roster || []).map(b => ({ ...b, id: b.booking_id }))); } catch (err) { console.error(err); } };
  const handleCheckIn = async (id) => { try { await api(`/bookings/${id}/checkin`, { method: 'POST' }); loadRoster(selectedClass.id); setToast({ message: 'Checked in!', type: 'success' }); } catch (err) { setToast({ message: err.message, type: 'error' }); } };
  const handleUndo = async (id) => { try { await api(`/bookings/${id}/undo-checkin`, { method: 'POST' }); loadRoster(selectedClass.id); setToast({ message: 'Undone', type: 'success' }); } catch (err) { setToast({ message: err.message, type: 'error' }); } };
  const searchQuick = async (q) => { if (q.length < 2) { setQuickResults([]); return; } try { const d = await api(`/users/search?q=${encodeURIComponent(q)}&limit=5`); setQuickResults(d.users || []); } catch (err) {} };
  const quickBook = async (userId) => { try { await api('/bookings/book-for-user', { method: 'POST', body: JSON.stringify({ user_id: userId, class_id: selectedClass.id }) }); loadRoster(selectedClass.id); setShowQuickAdd(false); setQuickSearch(''); setQuickResults([]); setToast({ message: 'Booked!', type: 'success' }); } catch (err) { setToast({ message: err.message, type: 'error' }); } };

  const filtered = roster.filter(b => !searchQuery || `${b.first_name} ${b.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()));
  const checkedIn = roster.filter(b => b.status === 'checked_in').length;

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner /></div>;

  return (
    <div className="space-y-6">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <h1 className="text-2xl font-bold text-gray-900">Check In</h1>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {classes.map(c => (
          <button key={c.id} onClick={() => { setSelectedClass(c); loadRoster(c.id); setSearchQuery(''); }} className={`flex-shrink-0 px-4 py-3 rounded-lg border-2 ${selectedClass?.id === c.id ? 'border-amber-600 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}>
            <p className="font-bold text-gray-900">{c.start_time?.slice(0, 5)}</p>
            <p className="text-sm text-gray-600 whitespace-nowrap">{c.class_name}</p>
            <p className="text-xs text-gray-500">{c.booked || 0}/{c.capacity}</p>
          </button>
        ))}
        {classes.length === 0 && <p className="text-gray-500 py-4">No classes today</p>}
      </div>
      {selectedClass && (
        <>
          <div className="flex gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Icons.Search /></div>
              <input type="text" placeholder="Search roster..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500" />
            </div>
            <button onClick={() => setShowQuickAdd(true)} className="flex items-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg"><Icons.Plus /> Add</button>
          </div>
          <div className="bg-white rounded-xl shadow-sm">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div><h2 className="font-semibold text-gray-900">{selectedClass.class_name}</h2><p className="text-sm text-gray-500">{selectedClass.start_time?.slice(0, 5)} • {selectedClass.teacher_name}</p></div>
              <div className="text-right"><p className="text-3xl font-bold text-gray-900">{checkedIn}/{roster.length}</p><p className="text-xs text-gray-500">checked in</p></div>
            </div>
            <div className="divide-y">
              {filtered.length === 0 ? <EmptyState icon={Icons.Users} message={searchQuery ? 'No match' : 'No bookings'} /> : filtered.map(b => (
                <div key={b.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${b.status === 'checked_in' ? 'bg-green-500' : 'bg-gray-300'}`}>{b.first_name?.[0]}{b.last_name?.[0]}</div>
                    <div><p className="font-medium text-gray-900">{b.first_name} {b.last_name}</p><p className="text-sm text-gray-500">{b.membership_name || 'Drop-in'}</p></div>
                  </div>
                  {b.status === 'checked_in' ? <button onClick={() => handleUndo(b.id)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2"><Icons.X /> Undo</button> : <button onClick={() => handleCheckIn(b.id)} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"><Icons.Check /> Check In</button>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      <Modal isOpen={showQuickAdd} onClose={() => { setShowQuickAdd(false); setQuickSearch(''); setQuickResults([]); }} title="Add Client">
        <div className="space-y-4">
          <input type="text" placeholder="Search..." value={quickSearch} onChange={(e) => { setQuickSearch(e.target.value); searchQuick(e.target.value); }} className="w-full px-4 py-3 border rounded-lg" autoFocus />
          <div className="max-h-64 overflow-y-auto divide-y">
            {quickResults.map(u => (
              <button key={u.id} onClick={() => quickBook(u.id)} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600">{u.first_name?.[0]}{u.last_name?.[0]}</div>
                  <div><p className="font-medium">{u.first_name} {u.last_name}</p><p className="text-sm text-gray-500">{u.email}</p></div>
                </div>
                <Icons.Plus />
              </button>
            ))}
            {quickSearch.length >= 2 && quickResults.length === 0 && <p className="px-4 py-6 text-center text-gray-500">No clients found</p>}
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SchedulePage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCoopClasses, setShowCoopClasses] = useState(true);

  useEffect(() => { loadSchedule(); }, [currentDate, showCoopClasses]);

  const loadSchedule = async () => {
    setLoading(true);
    try {
      const start = new Date(currentDate);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];

      // Fetch regular classes
      const regularData = await api(`/classes/schedule?start_date=${startStr}&end_date=${endStr}`);
      const regularSchedule = regularData.schedule || [];

      // Fetch co-op classes if enabled
      let coopClasses = [];
      if (showCoopClasses) {
        try {
          const coopData = await api(`/coop/classes?start_date=${startStr}&end_date=${endStr}`);
          coopClasses = (coopData.classes || []).map(c => ({
            ...c,
            is_coop: true,
            class_name: c.class_name || c.title,
            teacher_name: c.teacher_name || `${c.teacher_first_name || ''} ${c.teacher_last_name || ''}`.trim(),
            booked: c.booked_count || 0,
          }));
        } catch (e) { /* Co-op not enabled */ }
      }

      // Merge co-op classes into schedule
      const scheduleMap = {};
      regularSchedule.forEach(day => { scheduleMap[day.date] = { ...day, classes: [...day.classes] }; });

      coopClasses.forEach(c => {
        const date = c.date;
        if (!scheduleMap[date]) {
          scheduleMap[date] = { date, classes: [] };
        }
        scheduleMap[date].classes.push(c);
      });

      // Sort by date and then by start_time within each day
      const merged = Object.values(scheduleMap)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(day => ({
          ...day,
          classes: day.classes.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
        }));

      setSchedule(merged);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const navigate = (dir) => { const d = new Date(currentDate); d.setDate(d.getDate() + dir * 7); setCurrentDate(d); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={showCoopClasses} onChange={(e) => setShowCoopClasses(e.target.checked)} className="rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
            Show Co-op Classes
          </label>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">←</button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-amber-600 hover:bg-amber-50 rounded font-medium">Today</button>
            <button onClick={() => navigate(1)} className="p-2 hover:bg-gray-100 rounded-lg">→</button>
          </div>
        </div>
      </div>
      {loading ? <div className="flex items-center justify-center h-64"><Spinner /></div> : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {schedule.length === 0 ? <EmptyState icon={Icons.Calendar} message="No classes" /> : schedule.map(day => (
            <div key={day.date} className="border-b last:border-0">
              <div className="px-6 py-3 bg-gray-50 font-medium text-gray-700">{new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
              <div className="divide-y divide-gray-50">
                {day.classes.map(c => (
                  <div key={c.id} className={`px-6 py-4 flex items-center justify-between hover:bg-gray-50 ${c.is_coop ? 'bg-purple-50/50' : ''}`}>
                    <div className="flex items-center gap-4">
                      <div className="w-16 text-center"><p className="font-bold text-gray-900">{c.start_time?.slice(0, 5)}</p><p className="text-xs text-gray-500">{c.duration || 60}min</p></div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{c.class_name}</p>
                          {c.is_coop && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">Co-op</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{c.teacher_name}</p>
                        {c.is_coop && c.coop_price && (
                          <p className="text-xs text-purple-600 font-medium">${parseFloat(c.coop_price).toFixed(0)} drop-in{c.coop_member_price ? ` · $${parseFloat(c.coop_member_price).toFixed(0)} member` : ''}</p>
                        )}
                      </div>
                    </div>
                    <p className={`font-medium ${(c.booked || 0) >= c.capacity ? 'text-red-600' : 'text-gray-900'}`}>{c.booked || 0}/{c.capacity}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState(null);

  const search = async (q) => { if (!q || q.length < 2) { setClients([]); return; } setLoading(true); try { const d = await api(`/users/search?q=${encodeURIComponent(q)}`); setClients(d.users || []); } catch (err) {} finally { setLoading(false); } };
  useEffect(() => { const t = setTimeout(() => search(searchQuery), 300); return () => clearTimeout(t); }, [searchQuery]);
  const loadClient = async (id) => { try { const d = await api(`/users/${id}`); setSelectedClient(d); } catch (err) { console.error(err); } };

  return (
    <div className="space-y-6">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg"><Icons.Plus /> Add Client</button>
      </div>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Icons.Search /></div>
        <input type="text" placeholder="Search by name, email, phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm max-h-[calc(100vh-280px)] overflow-y-auto">
          <div className="divide-y">
            {loading ? <div className="p-8 flex justify-center"><Spinner /></div> : clients.length === 0 ? <EmptyState icon={Icons.Search} message={searchQuery ? 'No clients found' : 'Search for a client'} /> : clients.map(c => (
              <button key={c.id} onClick={() => loadClient(c.id)} className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 ${selectedClient?.user?.id === c.id ? 'bg-amber-50' : ''}`}>
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600">{c.first_name?.[0]}{c.last_name?.[0]}</div>
                <div className="flex-1 min-w-0"><p className="font-medium text-gray-900 truncate">{c.first_name} {c.last_name}</p><p className="text-sm text-gray-500 truncate">{c.email}</p></div>
              </button>
            ))}
          </div>
        </div>
        <div className="lg:col-span-2">
          {selectedClient ? (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-2xl font-bold text-amber-600">{selectedClient.user.first_name?.[0]}{selectedClient.user.last_name?.[0]}</div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedClient.user.first_name} {selectedClient.user.last_name}</h2>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1"><Icons.Mail /> {selectedClient.user.email}</span>
                      {selectedClient.user.phone && <span className="flex items-center gap-1"><Icons.Phone /> {selectedClient.user.phone}</span>}
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {[{ l: 'Total Classes', v: selectedClient.stats?.total_classes || 0 }, { l: 'This Month', v: selectedClient.stats?.classes_this_month || 0 }, { l: 'No Shows', v: selectedClient.stats?.no_shows || 0 }, { l: 'Last Visit', v: selectedClient.stats?.last_visit ? new Date(selectedClient.stats.last_visit).toLocaleDateString() : 'Never' }].map((s, i) => (
                  <div key={i} className="bg-white rounded-xl shadow-sm p-4 text-center"><p className="text-2xl font-bold text-gray-900">{s.v}</p><p className="text-sm text-gray-500">{s.l}</p></div>
                ))}
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Membership</h3>
                {selectedClient.memberships?.filter(m => m.status === 'active').length > 0 ? selectedClient.memberships.filter(m => m.status === 'active').map((m, i) => (
                  <div key={i} className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="font-semibold text-gray-900">{m.name}</p>
                    <p className="text-sm text-gray-600">{m.credits_remaining !== null ? `${m.credits_remaining} credits` : 'Unlimited'}</p>
                  </div>
                )) : <p className="text-gray-500">No active membership</p>}
              </div>
            </div>
          ) : <div className="bg-white rounded-xl shadow-sm p-12 text-center"><EmptyState icon={Icons.User} message="Select a client" /></div>}
        </div>
      </div>
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add New Client">
        <ClientForm onSuccess={(c) => { setShowCreate(false); loadClient(c.id); setToast({ message: 'Created!', type: 'success' }); }} onError={(m) => setToast({ message: m, type: 'error' })} />
      </Modal>
    </div>
  );
}

function ClientForm({ onSuccess, onError }) {
  const [form, setForm] = useState({ email: '', first_name: '', last_name: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const submit = async (e) => { e.preventDefault(); setLoading(true); try { const d = await api('/users', { method: 'POST', body: JSON.stringify(form) }); onSuccess(d.user); } catch (err) { onError(err.message); } finally { setLoading(false); } };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-gray-700 mb-1">First Name</label><input type="text" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label><input type="text" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required /></div>
      </div>
      <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required /></div>
      <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border rounded-lg" /></div>
      <div className="flex justify-end pt-4"><button type="submit" disabled={loading} className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50">{loading ? 'Creating...' : 'Create'}</button></div>
    </form>
  );
}

function SellPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [membershipTypes, setMembershipTypes] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [activeTab, setActiveTab] = useState('memberships');

  useEffect(() => { loadTypes(); }, []);
  const loadTypes = async () => { try { const d = await api('/memberships/types'); setMembershipTypes(d.membership_types || []); } catch (err) {} };
  const search = async (q) => { if (q.length < 2) { setSearchResults([]); return; } try { const d = await api(`/users/search?q=${encodeURIComponent(q)}&limit=5`); setSearchResults(d.users || []); } catch (err) {} };
  const searchProducts = async (q) => { if (q.length < 2) { setProductResults([]); return; } try { const d = await api(`/retail/pos/search?q=${encodeURIComponent(q)}`); setProductResults(d.products || []); } catch (err) {} };
  useEffect(() => { const t = setTimeout(() => search(searchQuery), 300); return () => clearTimeout(t); }, [searchQuery]);
  useEffect(() => { const t = setTimeout(() => searchProducts(productSearch), 300); return () => clearTimeout(t); }, [productSearch]);

  const addProductToCart = (product, variant) => {
    setCart([...cart, {
      cartId: Date.now(),
      name: `${product.name} - ${variant.name}`,
      price: variant.retail_price || product.retail_price,
      type: 'retail_product',
      variant_id: variant.id,
      product_id: product.id
    }]);
    setProductSearch('');
    setProductResults([]);
  };

  const total = cart.reduce((s, i) => s + parseFloat(i.price), 0);
  const checkout = async (method) => {
    if (!selectedClient) { setToast({ message: 'Select a client', type: 'error' }); return; }
    setLoading(true);
    try {
      // Process memberships
      for (const item of cart.filter(i => ['membership', 'credits', 'unlimited'].includes(i.type))) {
        await api('/memberships/sell', { method: 'POST', body: JSON.stringify({ user_id: selectedClient.id, membership_type_id: item.id, payment_method: method }) });
      }
      // Process retail products
      const retailItems = cart.filter(i => i.type === 'retail_product' || i.type === 'retail');
      if (retailItems.length > 0) {
        await api('/retail/orders', {
          method: 'POST',
          body: JSON.stringify({
            items: retailItems.map(i => ({ variant_id: i.variant_id, quantity: 1 })),
            customer_email: selectedClient.email,
            customer_name: `${selectedClient.first_name} ${selectedClient.last_name}`,
            payment_method: method,
            order_type: 'in_store'
          })
        });
      }
      setCart([]); setSelectedClient(null); setShowPayment(false); setToast({ message: 'Sale completed!', type: 'success' });
    } catch (err) { setToast({ message: err.message, type: 'error' }); }
    finally { setLoading(false); }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex gap-6">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="flex-1 space-y-6 overflow-y-auto">
        <h1 className="text-2xl font-bold text-gray-900">Sell</h1>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Client</label>
          {selectedClient ? (
            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-200 rounded-full flex items-center justify-center font-bold text-amber-700">{selectedClient.first_name?.[0]}{selectedClient.last_name?.[0]}</div>
                <div><p className="font-medium">{selectedClient.first_name} {selectedClient.last_name}</p><p className="text-sm text-gray-500">{selectedClient.email}</p></div>
              </div>
              <button onClick={() => setSelectedClient(null)} className="text-gray-400 hover:text-gray-600"><Icons.X /></button>
            </div>
          ) : (
            <div className="relative">
              <input type="text" placeholder="Search client..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
              {searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {searchResults.map(c => (
                    <button key={c.id} onClick={() => { setSelectedClient(c); setSearchQuery(''); setSearchResults([]); }} className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-bold">{c.first_name?.[0]}{c.last_name?.[0]}</div>
                      <div><p className="font-medium">{c.first_name} {c.last_name}</p><p className="text-xs text-gray-500">{c.email}</p></div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <button onClick={() => setActiveTab('memberships')} className={`px-4 py-2 font-medium border-b-2 -mb-px ${activeTab === 'memberships' ? 'border-amber-600 text-amber-600' : 'border-transparent text-gray-500'}`}>Memberships</button>
          <button onClick={() => setActiveTab('products')} className={`px-4 py-2 font-medium border-b-2 -mb-px ${activeTab === 'products' ? 'border-amber-600 text-amber-600' : 'border-transparent text-gray-500'}`}>Products</button>
          <button onClick={() => setActiveTab('quick')} className={`px-4 py-2 font-medium border-b-2 -mb-px ${activeTab === 'quick' ? 'border-amber-600 text-amber-600' : 'border-transparent text-gray-500'}`}>Quick Sell</button>
        </div>

        {activeTab === 'memberships' && (
          <div className="grid grid-cols-2 gap-3">
            {membershipTypes.map(m => (
              <button key={m.id} onClick={() => setCart([...cart, { ...m, cartId: Date.now() }])} className="bg-white rounded-xl shadow-sm p-4 text-left hover:shadow-md border-2 border-transparent hover:border-amber-500">
                <p className="font-semibold text-gray-900">{m.name}</p>
                <p className="text-sm text-gray-500">{m.type === 'unlimited' ? 'Unlimited' : `${m.credits} credits`}</p>
                <p className="text-lg font-bold text-amber-600 mt-2">${m.price}</p>
              </button>
            ))}
          </div>
        )}

        {activeTab === 'products' && (
          <div>
            <div className="relative mb-4">
              <input type="text" placeholder="Search products by name or SKU..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="w-full px-4 py-3 border rounded-lg" />
              {productResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-96 overflow-y-auto">
                  {productResults.map(p => (
                    <div key={p.id} className="border-b last:border-0">
                      <div className="px-4 py-2 bg-gray-50 font-medium">{p.name} - ${p.retail_price}</div>
                      {p.variants?.map(v => (
                        <button key={v.id} onClick={() => addProductToCart(p, v)} disabled={v.quantity_available <= 0} className="w-full px-4 py-2 text-left hover:bg-amber-50 flex items-center justify-between disabled:opacity-50">
                          <span>{v.name}</span>
                          <span className="text-sm">{v.quantity_available > 0 ? `${v.quantity_available} in stock` : 'Out of stock'}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-sm text-gray-500">Search for products to add to cart</p>
          </div>
        )}

        {activeTab === 'quick' && (
          <div className="grid grid-cols-3 gap-3">
            {[{ name: 'Drop-in', price: 22, type: 'drop_in', id: 'drop' }, { name: 'Mat Rental', price: 3, type: 'retail', id: 'mat' }, { name: 'Towel Rental', price: 2, type: 'retail', id: 'towel' }, { name: 'Water', price: 2.50, type: 'retail', id: 'water' }].map((i, idx) => (
              <button key={idx} onClick={() => setCart([...cart, { ...i, cartId: Date.now() }])} className="bg-white rounded-xl shadow-sm p-4 text-center hover:shadow-md">
                <p className="font-medium text-gray-900">{i.name}</p><p className="text-amber-600 font-bold">${i.price}</p>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="w-96 bg-white rounded-xl shadow-sm flex flex-col">
        <div className="p-4 border-b"><h2 className="font-semibold text-gray-900">Cart</h2></div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? <p className="text-gray-500 text-center py-8">Empty</p> : cart.map(i => (
            <div key={i.cartId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div><p className="font-medium text-gray-900">{i.name}</p><p className="text-sm text-gray-500">${i.price}</p></div>
              <button onClick={() => setCart(cart.filter(x => x.cartId !== i.cartId))} className="text-red-500 hover:text-red-700"><Icons.Trash /></button>
            </div>
          ))}
        </div>
        <div className="p-4 border-t space-y-4">
          <div className="flex items-center justify-between text-lg font-bold"><span>Total</span><span>${total.toFixed(2)}</span></div>
          {cart.length > 0 && <button onClick={() => setShowPayment(true)} disabled={!selectedClient} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg disabled:opacity-50">Checkout</button>}
        </div>
      </div>
      <Modal isOpen={showPayment} onClose={() => setShowPayment(false)} title="Payment">
        <div className="space-y-4">
          <p className="text-center text-2xl font-bold">${total.toFixed(2)}</p>
          <div className="grid grid-cols-2 gap-3">
            {['card', 'cash', 'check', 'other'].map(m => (
              <button key={m} onClick={() => checkout(m)} disabled={loading} className="py-4 border-2 rounded-xl hover:border-amber-500 capitalize font-medium">{m}</button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SubRequestsPage() {
  const { user } = useAuth();
  const [subRequests, setSubRequests] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('available');

  useEffect(() => { load(); }, []);
  const load = async () => { try { const [a, m] = await Promise.all([api('/teachers/sub-requests'), api('/teachers/sub-requests/mine')]); setSubRequests(a.sub_requests || []); setMyRequests(m.sub_requests || []); } catch (err) {} finally { setLoading(false); } };
  const claim = async (id) => { try { await api(`/teachers/sub-requests/${id}/claim`, { method: 'POST' }); load(); setToast({ message: 'Claimed!', type: 'success' }); } catch (err) { setToast({ message: err.message, type: 'error' }); } };
  const approve = async (id) => { try { await api(`/teachers/sub-requests/${id}/approve`, { method: 'POST' }); load(); setToast({ message: 'Approved!', type: 'success' }); } catch (err) { setToast({ message: err.message, type: 'error' }); } };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner /></div>;
  const canApprove = ['manager', 'owner', 'admin'].includes(user?.role);

  return (
    <div className="space-y-6">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <h1 className="text-2xl font-bold text-gray-900">Sub Requests</h1>
      <div className="flex gap-2 border-b">
        <button onClick={() => setActiveTab('available')} className={`px-4 py-2 font-medium border-b-2 -mb-px ${activeTab === 'available' ? 'border-amber-600 text-amber-600' : 'border-transparent text-gray-500'}`}>Available ({subRequests.filter(s => s.status === 'open').length})</button>
        <button onClick={() => setActiveTab('mine')} className={`px-4 py-2 font-medium border-b-2 -mb-px ${activeTab === 'mine' ? 'border-amber-600 text-amber-600' : 'border-transparent text-gray-500'}`}>Mine ({myRequests.length})</button>
        {canApprove && <button onClick={() => setActiveTab('pending')} className={`px-4 py-2 font-medium border-b-2 -mb-px ${activeTab === 'pending' ? 'border-amber-600 text-amber-600' : 'border-transparent text-gray-500'}`}>Pending ({subRequests.filter(s => s.status === 'claimed').length})</button>}
      </div>
      <div className="bg-white rounded-xl shadow-sm divide-y">
        {activeTab === 'available' && (subRequests.filter(s => s.status === 'open').length === 0 ? <EmptyState icon={Icons.Calendar} message="No open subs" /> : subRequests.filter(s => s.status === 'open').map(s => (
          <div key={s.id} className="p-4 flex items-center justify-between">
            <div><p className="font-medium text-gray-900">{s.class_name}</p><p className="text-sm text-gray-500">{new Date(s.date).toLocaleDateString()} at {s.start_time?.slice(0, 5)}</p><p className="text-sm text-gray-500">By: {s.requesting_teacher_name}</p></div>
            <button onClick={() => claim(s.id)} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg">Claim</button>
          </div>
        )))}
        {activeTab === 'mine' && (myRequests.length === 0 ? <EmptyState icon={Icons.Calendar} message="No requests" /> : myRequests.map(s => (
          <div key={s.id} className="p-4 flex items-center justify-between">
            <div><p className="font-medium text-gray-900">{s.class_name}</p><p className="text-sm text-gray-500">{new Date(s.date).toLocaleDateString()} at {s.start_time?.slice(0, 5)}</p>{s.claiming_teacher_name && <p className="text-sm text-green-600">Claimed by: {s.claiming_teacher_name}</p>}</div>
            <span className={`px-3 py-1 rounded-full text-sm ${s.status === 'open' ? 'bg-yellow-100 text-yellow-700' : s.status === 'claimed' ? 'bg-blue-100 text-blue-700' : s.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>{s.status}</span>
          </div>
        )))}
        {activeTab === 'pending' && canApprove && (subRequests.filter(s => s.status === 'claimed').length === 0 ? <EmptyState icon={Icons.Check} message="None pending" /> : subRequests.filter(s => s.status === 'claimed').map(s => (
          <div key={s.id} className="p-4 flex items-center justify-between">
            <div><p className="font-medium text-gray-900">{s.class_name}</p><p className="text-sm text-gray-500">{new Date(s.date).toLocaleDateString()}</p><p className="text-sm text-gray-500">{s.requesting_teacher_name} → {s.claiming_teacher_name}</p></div>
            <button onClick={() => approve(s.id)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg">Approve</button>
          </div>
        )))}
      </div>
    </div>
  );
}

function ReportsPage() {
  const [activeReport, setActiveReport] = useState('attendance');
  const [dateRange, setDateRange] = useState({ start: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const reports = [{ id: 'attendance', name: 'Attendance', icon: Icons.Users }, { id: 'revenue', name: 'Revenue', icon: Icons.DollarSign }, { id: 'classes', name: 'Classes', icon: Icons.Chart }, { id: 'teachers', name: 'Teachers', icon: Icons.User }];

  useEffect(() => { load(); }, [activeReport, dateRange]);
  const load = async () => {
    setLoading(true);
    try {
      let endpoint = '';
      switch (activeReport) {
        case 'attendance': endpoint = `/reports/attendance?start_date=${dateRange.start}&end_date=${dateRange.end}&group_by=day`; break;
        case 'revenue': endpoint = `/reports/revenue?start_date=${dateRange.start}&end_date=${dateRange.end}`; break;
        case 'classes': endpoint = `/reports/class-popularity?start_date=${dateRange.start}&end_date=${dateRange.end}`; break;
        case 'teachers': endpoint = `/reports/teachers?start_date=${dateRange.start}&end_date=${dateRange.end}`; break;
      }
      const d = await api(endpoint);
      setData(d);
    } catch (err) {} finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
      <div className="flex flex-wrap gap-2">
        {reports.map(r => (
          <button key={r.id} onClick={() => setActiveReport(r.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg ${activeReport === r.id ? 'bg-amber-600 text-white' : 'bg-white border hover:bg-gray-50'}`}><r.icon />{r.name}</button>
        ))}
      </div>
      <div className="flex items-center gap-4 bg-white rounded-lg p-4 shadow-sm">
        <label className="text-sm font-medium">Date Range:</label>
        <input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} className="px-3 py-2 border rounded-lg" />
        <span>to</span>
        <input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} className="px-3 py-2 border rounded-lg" />
      </div>
      <div className="bg-white rounded-xl shadow-sm">
        {loading ? <div className="p-12 flex justify-center"><Spinner /></div> : !data ? <EmptyState icon={Icons.Chart} message="Select a report" /> : (
          <div className="p-6">
            {activeReport === 'attendance' && <table className="w-full"><thead><tr className="border-b"><th className="text-left py-2 px-4">Date</th><th className="text-right py-2 px-4">Bookings</th><th className="text-right py-2 px-4">Checked In</th><th className="text-right py-2 px-4">No Shows</th></tr></thead><tbody>{data.attendance?.slice(0, 14).map((d, i) => <tr key={i} className="border-b border-gray-50"><td className="py-2 px-4">{new Date(d.date).toLocaleDateString()}</td><td className="text-right py-2 px-4">{d.total_bookings}</td><td className="text-right py-2 px-4 text-green-600">{d.checked_in}</td><td className="text-right py-2 px-4 text-red-600">{d.no_shows}</td></tr>)}</tbody></table>}
            {activeReport === 'revenue' && <div className="grid grid-cols-3 gap-4"><div className="p-4 bg-green-50 rounded-lg"><p className="text-sm text-gray-600">Total</p><p className="text-2xl font-bold text-green-600">${data.total_revenue?.toFixed(2) || '0'}</p></div><div className="p-4 bg-blue-50 rounded-lg"><p className="text-sm text-gray-600">Transactions</p><p className="text-2xl font-bold text-blue-600">{data.total_transactions || 0}</p></div><div className="p-4 bg-purple-50 rounded-lg"><p className="text-sm text-gray-600">Avg</p><p className="text-2xl font-bold text-purple-600">${data.avg_transaction?.toFixed(2) || '0'}</p></div></div>}
            {activeReport === 'classes' && <div className="space-y-3">{data.classes?.map((c, i) => <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"><div><p className="font-medium">{c.class_name}</p><p className="text-sm text-gray-500">{c.total_classes} classes</p></div><div className="text-right"><p className="font-bold">{c.total_attendance} students</p><p className="text-sm text-gray-500">{c.avg_fill_rate}% fill</p></div></div>)}</div>}
            {activeReport === 'teachers' && <table className="w-full"><thead><tr className="border-b"><th className="text-left py-2 px-4">Teacher</th><th className="text-right py-2 px-4">Classes</th><th className="text-right py-2 px-4">Students</th><th className="text-right py-2 px-4">Avg</th></tr></thead><tbody>{data.teachers?.map((t, i) => <tr key={i} className="border-b border-gray-50"><td className="py-2 px-4 font-medium">{t.teacher_name}</td><td className="text-right py-2 px-4">{t.classes_taught}</td><td className="text-right py-2 px-4">{t.total_students}</td><td className="text-right py-2 px-4">{t.avg_students?.toFixed(1)}</td></tr>)}</tbody></table>}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// CO-OP PAGE - Room Rentals & Teacher Dashboard
// ============================================

function CoopPage() {
  const { user } = useAuth();
  const isAdmin = ['manager', 'owner', 'admin'].includes(user?.role);
  const isTeacher = user?.role === 'teacher';
  const [activeTab, setActiveTab] = useState('rooms');
  const [rooms, setRooms] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [myClasses, setMyClasses] = useState([]);
  const [myAgreement, setMyAgreement] = useState(null);
  const [agreements, setAgreements] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBookModal, setShowBookModal] = useState(false);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingForm, setBookingForm] = useState({ classTypeId: '', price: '', title: '', description: '' });
  const [agreementForm, setAgreementForm] = useState({ teacherId: '', agreementType: 'per_class', startDate: '' });
  const [allTeachers, setAllTeachers] = useState([]);
  const [classTypes, setClassTypes] = useState([]);
  const [toast, setToast] = useState(null);

  const hasActiveAgreement = myAgreement?.status === 'active';

  const tabs = [
    { id: 'rooms', label: 'Rooms & Availability' },
    { id: 'book', label: 'Book a Class', requiresAgreement: true },
    { id: 'myclasses', label: 'My Co-op Classes' },
    { id: 'earnings', label: 'Earnings' },
    ...(isAdmin ? [
      { id: 'agreements', label: 'Agreements' },
      { id: 'admin-tiers', label: 'Rental Tiers' },
    ] : []),
  ];

  // Load teacher's agreement on mount
  useEffect(() => {
    const loadMyAgreement = async () => {
      if (!isAdmin) {
        try {
          const data = await api('/coop/agreements/me');
          setMyAgreement(data.agreement);
        } catch { setMyAgreement(null); }
      }
    };
    loadMyAgreement();
  }, [isAdmin]);

  useEffect(() => { loadData(); }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'rooms' || activeTab === 'book') {
        const [roomsData, tiersData, typesData] = await Promise.all([
          api('/coop/rooms'),
          api('/coop/tiers'),
          api('/classes/types'),
        ]);
        setRooms(roomsData.rooms || []);
        setTiers(tiersData.tiers || []);
        setClassTypes(typesData.class_types || []);
      } else if (activeTab === 'myclasses') {
        const data = await api('/coop/classes/my');
        setMyClasses(data.classes || []);
      } else if (activeTab === 'earnings') {
        const data = await api('/coop/earnings/summary');
        setEarnings(data);
      } else if (activeTab === 'agreements' && isAdmin) {
        const [agreementsData, teachersData] = await Promise.all([
          api('/coop/agreements'),
          api('/classes/teachers/list'),
        ]);
        setAgreements(agreementsData.agreements || []);
        setAllTeachers(teachersData.teachers || []);
      }
    } catch (err) { console.error('Failed to load co-op data:', err); }
    finally { setLoading(false); }
  };

  const handleCreateAgreement = async () => {
    if (!agreementForm.teacherId || !agreementForm.startDate) {
      setToast({ message: 'Please select a teacher and start date', type: 'error' });
      return;
    }
    try {
      await api('/coop/agreements', {
        method: 'POST',
        body: JSON.stringify({
          teacher_id: parseInt(agreementForm.teacherId),
          agreement_type: agreementForm.agreementType,
          start_date: agreementForm.startDate,
        }),
      });
      setToast({ message: 'Agreement created successfully!', type: 'success' });
      setShowAgreementModal(false);
      setAgreementForm({ teacherId: '', agreementType: 'per_class', startDate: '' });
      loadData();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  const handleBookSlot = async () => {
    if (!selectedSlot || !bookingForm.classTypeId || !bookingForm.price) {
      setToast({ message: 'Please fill in all required fields', type: 'error' });
      return;
    }
    try {
      await api('/coop/classes', {
        method: 'POST',
        body: JSON.stringify({
          room_id: selectedSlot.roomId,
          tier_id: selectedSlot.tierId,
          date: selectedSlot.date,
          start_time: selectedSlot.startTime,
          class_type_id: bookingForm.classTypeId,
          coop_price: parseFloat(bookingForm.price),
          title: bookingForm.title,
          description: bookingForm.description,
        }),
      });
      setToast({ message: 'Co-op class booked successfully!', type: 'success' });
      setShowBookModal(false);
      setSelectedSlot(null);
      setBookingForm({ classTypeId: '', price: '', title: '', description: '' });
      loadData();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
  const formatTime = (time) => time ? new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';

  // Generate available slots for next 7 days
  const getAvailableSlots = () => {
    const slots = [];
    const today = new Date();
    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setDate(today.getDate() + d);
      const dayOfWeek = date.getDay();
      const dateStr = date.toISOString().split('T')[0];

      rooms.filter(r => r.allows_coop).forEach(room => {
        tiers.filter(t => t.room_id === room.id && t.is_active && t.days_of_week?.includes(dayOfWeek)).forEach(tier => {
          slots.push({
            roomId: room.id,
            roomName: room.name,
            tierId: tier.id,
            tierName: tier.name,
            date: dateStr,
            dateDisplay: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            startTime: tier.start_time,
            endTime: tier.end_time,
            price: tier.price,
            suggestedPrice: tier.suggested_class_price,
            duration: tier.duration_minutes,
          });
        });
      });
    }
    return slots.sort((a, b) => new Date(a.date + 'T' + a.startTime) - new Date(b.date + 'T' + b.startTime));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Co-op Teaching</h1>
          <p className="text-gray-500">Rent studio space and teach your own classes</p>
        </div>
      </div>

      {/* Agreement Status Banner for Teachers */}
      {!isAdmin && (
        <div className={`rounded-lg p-4 ${
          myAgreement?.status === 'active' ? 'bg-green-50 border border-green-200' :
          myAgreement?.status === 'pending' ? 'bg-yellow-50 border border-yellow-200' :
          'bg-purple-50 border border-purple-200'
        }`}>
          {myAgreement?.status === 'active' ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Icons.Check className="text-green-600" />
              </div>
              <div>
                <p className="font-medium text-green-800">Active Co-op Agreement</p>
                <p className="text-sm text-green-600">You can book studio time and teach your own classes.</p>
              </div>
            </div>
          ) : myAgreement?.status === 'pending' ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <Icons.Clock className="text-yellow-600" />
              </div>
              <div>
                <p className="font-medium text-yellow-800">Agreement Pending Approval</p>
                <p className="text-sm text-yellow-600">Your co-op agreement is being reviewed. You'll be notified when approved.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <Icons.Building className="text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-purple-800">Interested in Teaching?</p>
                  <p className="text-sm text-purple-600">Contact the studio to set up a co-op teaching agreement.</p>
                </div>
              </div>
              <a href="mailto:hello@thestudioreno.com" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium text-sm">
                Contact Us
              </a>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4 -mb-px">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              disabled={tab.requiresAgreement && !hasActiveAgreement && !isAdmin}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === tab.id ? 'border-amber-500 text-amber-600' :
                (tab.requiresAgreement && !hasActiveAgreement && !isAdmin) ? 'border-transparent text-gray-300 cursor-not-allowed' :
                'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>
              {tab.label}
              {tab.requiresAgreement && !hasActiveAgreement && !isAdmin && <span className="ml-1 text-xs">🔒</span>}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><Spinner /></div>
      ) : (
        <>
          {/* Rooms & Availability Tab */}
          {activeTab === 'rooms' && (
            <div className="grid gap-6 md:grid-cols-2">
              {rooms.filter(r => r.allows_coop).map(room => (
                <div key={room.id} className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Icons.Building className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{room.name}</h3>
                      <p className="text-sm text-gray-500">Capacity: {room.capacity} students</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Rental Tiers:</p>
                    {tiers.filter(t => t.room_id === room.id).map(tier => (
                      <div key={tier.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <div>
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${tier.name === 'Prime' ? 'bg-amber-100 text-amber-800' : tier.name === 'Standard' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                            {tier.name}
                          </span>
                          <span className="text-sm text-gray-600 ml-2">{formatTime(tier.start_time)} - {formatTime(tier.end_time)}</span>
                        </div>
                        <span className="font-semibold text-gray-900">{formatCurrency(tier.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {rooms.filter(r => r.allows_coop).length === 0 && (
                <div className="col-span-2 text-center py-12 bg-white rounded-xl">
                  <Icons.Building className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No co-op rooms available yet</p>
                </div>
              )}
            </div>
          )}

          {/* Book a Class Tab */}
          {activeTab === 'book' && (
            <div className="bg-white rounded-xl shadow-sm">
              <div className="px-6 py-4 border-b">
                <h2 className="font-semibold text-gray-900">Available Time Slots</h2>
                <p className="text-sm text-gray-500">Select a slot to book your co-op class</p>
              </div>
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {getAvailableSlots().map((slot, i) => (
                  <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="text-center w-20">
                        <p className="text-sm font-medium text-gray-900">{slot.dateDisplay}</p>
                        <p className="text-xs text-gray-500">{formatTime(slot.startTime)}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{slot.roomName}</p>
                        <p className="text-sm text-gray-500">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mr-2 ${slot.tierName === 'Prime' ? 'bg-amber-100 text-amber-800' : slot.tierName === 'Standard' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                            {slot.tierName}
                          </span>
                          {slot.duration} min • Rent: {formatCurrency(slot.price)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Suggested price</p>
                        <p className="font-semibold text-gray-900">{formatCurrency(slot.suggestedPrice)}</p>
                      </div>
                      <button onClick={() => { setSelectedSlot(slot); setBookingForm({ ...bookingForm, price: slot.suggestedPrice?.toString() || '' }); setShowBookModal(true); }}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-sm">
                        Book
                      </button>
                    </div>
                  </div>
                ))}
                {getAvailableSlots().length === 0 && (
                  <div className="px-6 py-12 text-center">
                    <p className="text-gray-500">No available slots. Configure rooms and rental tiers first.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* My Co-op Classes Tab */}
          {activeTab === 'myclasses' && (
            <div className="bg-white rounded-xl shadow-sm">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">My Co-op Classes</h2>
                <span className="text-sm text-gray-500">{myClasses.length} classes</span>
              </div>
              <div className="divide-y">
                {myClasses.map(cls => (
                  <div key={cls.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-medium">CO-OP</span>
                          <h3 className="font-medium text-gray-900">{cls.class_name || cls.title}</h3>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {new Date(cls.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {formatTime(cls.start_time)}
                        </p>
                        <p className="text-sm text-gray-500">{cls.room_name} • {cls.booked_count || 0}/{cls.capacity} booked</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{formatCurrency(cls.coop_price)}</p>
                        <p className="text-sm text-gray-500">Member: {formatCurrency(cls.coop_member_price)}</p>
                        <p className="text-xs text-gray-400">Rent: {formatCurrency(cls.coop_rental_fee)}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {myClasses.length === 0 && (
                  <div className="px-6 py-12 text-center">
                    <Icons.Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">You haven't booked any co-op classes yet</p>
                    <button onClick={() => setActiveTab('book')} className="mt-4 text-amber-600 hover:text-amber-700 font-medium">
                      Book your first class →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Earnings Tab */}
          {activeTab === 'earnings' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <p className="text-sm text-gray-500 mb-1">Total Revenue</p>
                  <p className="text-3xl font-bold text-gray-900">{formatCurrency(earnings?.total_revenue || 0)}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <p className="text-sm text-gray-500 mb-1">Credit Reimbursements</p>
                  <p className="text-3xl font-bold text-blue-600">{formatCurrency(earnings?.total_reimbursements || 0)}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <p className="text-sm text-gray-500 mb-1">Rental Fees</p>
                  <p className="text-3xl font-bold text-red-600">-{formatCurrency(earnings?.total_rental_fees || 0)}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-6 bg-green-50">
                  <p className="text-sm text-gray-500 mb-1">Net Earnings</p>
                  <p className="text-3xl font-bold text-green-600">{formatCurrency(earnings?.net_earnings || 0)}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <p className="text-sm text-gray-500 mb-1">Pending Payout</p>
                  <p className="text-2xl font-bold text-amber-600">{formatCurrency(earnings?.pending_payout || 0)}</p>
                  <p className="text-xs text-gray-400 mt-1">Processed on the 1st & 15th</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <p className="text-sm text-gray-500 mb-1">Total Paid Out</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(earnings?.total_payouts || 0)}</p>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Summary</h3>
                {earnings?.total_classes > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{earnings?.total_classes || 0}</p>
                      <p className="text-sm text-gray-500">Classes Taught</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{earnings?.total_students || 0}</p>
                      <p className="text-sm text-gray-500">Total Students</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{formatCurrency((earnings?.total_revenue || 0) / (earnings?.total_classes || 1))}</p>
                      <p className="text-sm text-gray-500">Avg Revenue/Class</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{((earnings?.total_students || 0) / (earnings?.total_classes || 1)).toFixed(1)}</p>
                      <p className="text-sm text-gray-500">Avg Students/Class</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No classes taught yet. Start teaching co-op classes to see your earnings here.</p>
                )}
              </div>
            </div>
          )}

          {/* Admin: Agreements Tab */}
          {activeTab === 'agreements' && isAdmin && (
            <div className="bg-white rounded-xl shadow-sm">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Teacher Agreements</h2>
                <button onClick={() => setShowAgreementModal(true)} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-sm">
                  + New Agreement
                </button>
              </div>
              <div className="divide-y">
                {agreements.map(agreement => (
                  <div key={agreement.id} className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{agreement.teacher_name}</p>
                      <p className="text-sm text-gray-500">{agreement.agreement_type} • Started {new Date(agreement.start_date).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${agreement.status === 'active' ? 'bg-green-100 text-green-800' : agreement.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                        {agreement.status}
                      </span>
                      {agreement.status === 'pending' && (
                        <button onClick={async () => {
                          try {
                            await api(`/coop/agreements/${agreement.id}/approve`, { method: 'POST' });
                            setToast({ message: 'Agreement approved!', type: 'success' });
                            loadData();
                          } catch (err) { setToast({ message: err.message, type: 'error' }); }
                        }} className="text-green-600 hover:text-green-700 font-medium text-sm">
                          Approve
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {agreements.length === 0 && (
                  <div className="px-6 py-12 text-center">
                    <Icons.Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No teacher agreements yet</p>
                    <button onClick={() => setShowAgreementModal(true)} className="mt-4 text-amber-600 hover:text-amber-700 font-medium">
                      Create first agreement →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Admin: Rental Tiers Tab */}
          {activeTab === 'admin-tiers' && isAdmin && (
            <div className="bg-white rounded-xl shadow-sm">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Rental Pricing Tiers</h2>
                <button className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-sm">
                  + Add Tier
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Suggested</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tiers.map(tier => {
                      const room = rooms.find(r => r.id === tier.room_id);
                      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                      return (
                        <tr key={tier.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">{room?.name || 'Unknown'}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${tier.name === 'Prime' ? 'bg-amber-100 text-amber-800' : tier.name === 'Standard' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                              {tier.name}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{formatTime(tier.start_time)} - {formatTime(tier.end_time)}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{tier.days_of_week?.map(d => dayNames[d]).join(', ')}</td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{formatCurrency(tier.price)}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{formatCurrency(tier.suggested_class_price)}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-xs ${tier.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                              {tier.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {tiers.length === 0 && (
                  <div className="px-6 py-12 text-center">
                    <p className="text-gray-500">No rental tiers configured yet</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Agreement Modal */}
      <Modal isOpen={showAgreementModal} onClose={() => setShowAgreementModal(false)} title="Create Teacher Agreement" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teacher *</label>
            <select value={agreementForm.teacherId} onChange={(e) => setAgreementForm({ ...agreementForm, teacherId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500">
              <option value="">Select teacher...</option>
              {allTeachers.map(t => (
                <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agreement Type *</label>
            <select value={agreementForm.agreementType} onChange={(e) => setAgreementForm({ ...agreementForm, agreementType: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500">
              <option value="per_class">Per Class (pay per rental)</option>
              <option value="weekly">Weekly (fixed weekly rate)</option>
              <option value="monthly">Monthly (fixed monthly rate)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
            <input type="date" value={agreementForm.startDate} onChange={(e) => setAgreementForm({ ...agreementForm, startDate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500" />
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <p className="text-sm text-purple-800">
              <strong>Note:</strong> The agreement will be created in "pending" status. You'll need to approve it before the teacher can book co-op classes.
            </p>
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={() => setShowAgreementModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={handleCreateAgreement} className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium">
              Create Agreement
            </button>
          </div>
        </div>
      </Modal>

      {/* Book Class Modal */}
      <Modal isOpen={showBookModal} onClose={() => setShowBookModal(false)} title="Book Co-op Class" size="md">
        {selectedSlot && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{selectedSlot.roomName}</p>
                  <p className="text-sm text-gray-500">{selectedSlot.dateDisplay} at {formatTime(selectedSlot.startTime)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Rental Fee</p>
                  <p className="font-semibold text-gray-900">{formatCurrency(selectedSlot.price)}</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Class Type *</label>
              <select value={bookingForm.classTypeId} onChange={(e) => setBookingForm({ ...bookingForm, classTypeId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500">
                <option value="">Select class type...</option>
                {classTypes.map(ct => (
                  <option key={ct.id} value={ct.id}>{ct.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Price (Non-member) *</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input type="number" value={bookingForm.price} onChange={(e) => setBookingForm({ ...bookingForm, price: e.target.value })}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500" placeholder="25.00" step="0.01" />
              </div>
              <p className="text-xs text-gray-500 mt-1">Members pay 25% less: {formatCurrency(bookingForm.price * 0.75)}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Custom Title (optional)</label>
              <input type="text" value={bookingForm.title} onChange={(e) => setBookingForm({ ...bookingForm, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500" placeholder="e.g., Breathwork Journey" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <textarea value={bookingForm.description} onChange={(e) => setBookingForm({ ...bookingForm, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500" rows={3} placeholder="Describe your class..." />
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => setShowBookModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleBookSlot} className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium">
                Book Class
              </button>
            </div>
          </div>
        )}
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [classTypes, setClassTypes] = useState([]);
  const [membershipTypes, setMembershipTypes] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  const tabs = [{ id: 'general', label: 'General' }, { id: 'classes', label: 'Class Types' }, { id: 'memberships', label: 'Memberships' }, { id: 'teachers', label: 'Teachers' }];

  useEffect(() => { load(); }, []);
  const load = async () => { try { const [ct, mt, t] = await Promise.all([api('/classes/types/list'), api('/memberships/types'), api('/classes/teachers/list')]); setClassTypes(ct.class_types || []); setMembershipTypes(mt.membership_types || []); setTeachers(t.teachers || []); } catch (err) {} finally { setLoading(false); } };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <div className="flex gap-6">
        <div className="w-48 space-y-1">
          {tabs.map(t => <button key={t.id} onClick={() => setActiveTab(t.id)} className={`w-full text-left px-4 py-2 rounded-lg ${activeTab === t.id ? 'bg-amber-100 text-amber-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>{t.label}</button>)}
        </div>
        <div className="flex-1 bg-white rounded-xl shadow-sm p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <h2 className="font-semibold text-gray-900">General Settings</h2>
              <div className="grid grid-cols-2 gap-6">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Studio Name</label><input type="text" defaultValue="The Studio Reno" className="w-full px-3 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" defaultValue="hello@thestudioreno.com" className="w-full px-3 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Late Cancel (hours)</label><input type="number" defaultValue={2} className="w-full px-3 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Booking Window (days)</label><input type="number" defaultValue={7} className="w-full px-3 py-2 border rounded-lg" /></div>
              </div>
              <button className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg">Save</button>
            </div>
          )}
          {activeTab === 'classes' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between"><h2 className="font-semibold text-gray-900">Class Types</h2><button className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm"><Icons.Plus /> Add</button></div>
              <div className="space-y-3">{classTypes.map(c => <div key={c.id} className="flex items-center justify-between p-4 border rounded-lg"><div><p className="font-medium">{c.name}</p><p className="text-sm text-gray-500">{c.duration}min • {c.category} • {c.level}</p></div><div className="flex gap-2"><button className="p-2 hover:bg-gray-100 rounded"><Icons.Edit /></button><button className="p-2 hover:bg-red-100 text-red-600 rounded"><Icons.Trash /></button></div></div>)}</div>
            </div>
          )}
          {activeTab === 'memberships' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between"><h2 className="font-semibold text-gray-900">Memberships</h2><button className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm"><Icons.Plus /> Add</button></div>
              <div className="space-y-3">{membershipTypes.map(m => <div key={m.id} className="flex items-center justify-between p-4 border rounded-lg"><div><p className="font-medium">{m.name}</p><p className="text-sm text-gray-500">${m.price} • {m.type === 'unlimited' ? 'Unlimited' : `${m.credits} credits`}</p></div><div className="flex gap-2"><button className="p-2 hover:bg-gray-100 rounded"><Icons.Edit /></button><button className="p-2 hover:bg-red-100 text-red-600 rounded"><Icons.Trash /></button></div></div>)}</div>
            </div>
          )}
          {activeTab === 'teachers' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between"><h2 className="font-semibold text-gray-900">Teachers</h2><button className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm"><Icons.Plus /> Add</button></div>
              <div className="space-y-3">{teachers.map(t => <div key={t.id} className="flex items-center justify-between p-4 border rounded-lg"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold">{t.first_name?.[0]}{t.last_name?.[0]}</div><div><p className="font-medium">{t.first_name} {t.last_name}</p><p className="text-sm text-gray-500">{t.email}</p></div></div><button className="p-2 hover:bg-gray-100 rounded"><Icons.Edit /></button></div>)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => { checkAuth(); }, []);
  const checkAuth = async () => {
    const token = localStorage.getItem('staff_token');
    if (!token) { setLoading(false); return; }
    try { const d = await api('/auth/me'); if (['front_desk', 'teacher', 'manager', 'owner', 'admin'].includes(d.user.role)) setUser(d.user); else localStorage.removeItem('staff_token'); }
    catch (err) { localStorage.removeItem('staff_token'); }
    finally { setLoading(false); }
  };

  const logout = () => { localStorage.removeItem('staff_token'); setUser(null); setCurrentPage('dashboard'); };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Spinner /></div>;
  if (!user) return <LoginPage onLogin={setUser} />;

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage />;
      case 'checkin': return <CheckInPage />;
      case 'schedule': return <SchedulePage />;
      case 'coop': return <CoopPage />;
      case 'clients': return <ClientsPage />;
      case 'sell': return <SellPage />;
      case 'subs': return <SubRequestsPage />;
      case 'reports': return <ReportsPage />;
      case 'settings': return <SettingsPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <AuthContext.Provider value={{ user, api }}>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar user={user} currentPage={currentPage} setCurrentPage={setCurrentPage} onLogout={logout} />
        <main className="flex-1 p-6 overflow-auto">{renderPage()}</main>
      </div>
    </AuthContext.Provider>
  );
}
