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
  const [filter, setFilter] = useState('all'); // 'all', 'traditional', 'coop'
  const [locationFilter, setLocationFilter] = useState('all'); // 'all', 'moran', 'virginia'

  useEffect(() => {
    const load = async () => {
      try {
        const start = selectedDate.toISOString().split('T')[0];
        const end = new Date(selectedDate); end.setDate(end.getDate() + 6);
        let url = `/classes/schedule?start_date=${start}&end_date=${end.toISOString().split('T')[0]}`;
        if (filter === 'coop') url += '&class_model=coop_rental&include_coop=true';
        else if (filter === 'traditional') url += '&include_coop=false';
        else url += '&include_coop=true';
        const data = await api(url);
        setSchedule(data.schedule || []);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, [selectedDate, filter]);

  const shiftWeek = (dir) => { const d = new Date(selectedDate); d.setDate(d.getDate() + dir * 7); setSelectedDate(d); };

  // Filter classes by location
  const filterByLocation = (classes) => {
    if (locationFilter === 'all') return classes;
    return classes.filter(cls => {
      if (locationFilter === 'moran') return cls.location_short?.includes('Moran');
      if (locationFilter === 'virginia') return cls.location_short?.includes('Virginia');
      return true;
    });
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Class Schedule</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftWeek(-1)} className="p-2 hover:bg-gray-100 rounded-lg"><Icons.ChevronLeft /></button>
          <span className="text-sm font-medium text-gray-700">
            {formatDate(selectedDate, { month: 'short', day: 'numeric' })} - {formatDate(new Date(selectedDate.getTime() + 6 * 86400000), { month: 'short', day: 'numeric' })}
          </span>
          <button onClick={() => shiftWeek(1)} className="p-2 hover:bg-gray-100 rounded-lg"><Icons.ChevronRight /></button>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-4">
        {/* Location filter */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          {[['all', 'All Locations'], ['virginia', 'S. Virginia'], ['moran', 'Moran St']].map(([key, label]) => (
            <button key={key} onClick={() => setLocationFilter(key)} className={`px-3 py-1.5 text-sm font-medium rounded-md transition flex items-center gap-1.5 ${locationFilter === key ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}>
              <Icons.Location className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Class type filter */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          {[['all', 'All Classes'], ['traditional', 'Traditional'], ['coop', 'Co-op']].map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${filter === key ? (key === 'coop' ? 'bg-purple-600 text-white' : 'bg-white shadow text-gray-900') : 'text-gray-600 hover:text-gray-900'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        {schedule.length === 0 ? <p className="px-6 py-12 text-center text-gray-500">No classes scheduled</p> :
          schedule.map((day, i) => {
            const filteredClasses = filterByLocation(day.classes || []);
            if (filteredClasses.length === 0) return null;
            return (
              <div key={i}>
                <div className="bg-gray-50 px-6 py-3 border-b"><h3 className="font-semibold text-gray-900">{formatDate(day.date, { weekday: 'long', month: 'long', day: 'numeric' })}</h3></div>
                <div className="divide-y">
                  {filteredClasses.map((cls, j) => (
                    <div key={j} className={`px-6 py-4 flex items-center justify-between hover:bg-gray-50 ${cls.is_coop ? 'border-l-4 border-purple-500' : ''}`}>
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-gray-500 w-16">{cls.start_time?.slice(0, 5)}</div>
                        <div className="flex items-center gap-2">
                          {cls.class_color && <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cls.class_color }} />}
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-gray-900">{cls.class_name}</p>
                              {/* Location badge - always visible */}
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${cls.location_short?.includes('Moran') ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                {cls.location_short || 'Studio'}
                              </span>
                              {cls.is_coop && <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">Co-op</span>}
                            </div>
                            <p className="text-sm text-gray-500">
                              {cls.teacher_name}{cls.teacher_title ? ` (${cls.teacher_title})` : ''} • {cls.duration} min
                            </p>
                            {cls.is_coop && cls.coop_drop_in_price && (
                              <p className="text-sm text-purple-600 mt-1">
                                Drop-in: ${cls.coop_drop_in_price} | Member: ${cls.coop_member_price}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right"><p className="text-sm font-medium">{cls.booked || 0}/{cls.capacity}</p></div>
                        <Button size="sm" variant={cls.is_coop ? 'outline' : 'primary'} disabled={(cls.booked || 0) >= cls.capacity} className={cls.is_coop ? 'border-purple-500 text-purple-600 hover:bg-purple-50' : ''}>
                          {(cls.booked || 0) >= cls.capacity ? 'Full' : 'Book'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
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

function ReportsPage() {
  const [reports, setReports] = useState({ reports: [], by_category: {} });
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [runningReport, setRunningReport] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    const loadReports = async () => {
      try {
        const data = await api('/reports/available');
        setReports(data);
      } catch (err) {
        console.error('Failed to load reports:', err);
      } finally {
        setLoading(false);
      }
    };
    loadReports();
  }, []);

  const runReport = async (reportId) => {
    setRunningReport(true);
    setSelectedReport(reportId);
    try {
      const data = await api(`/reports/run/${reportId}`);
      setReportData(data);
    } catch (err) {
      console.error('Failed to run report:', err);
      setReportData({ error: err.message, rows: [] });
    } finally {
      setRunningReport(false);
    }
  };

  const categories = [
    { id: 'all', label: 'All Reports', color: 'gray' },
    { id: 'classes', label: 'Classes', color: 'blue' },
    { id: 'members', label: 'Members', color: 'green' },
    { id: 'financial', label: 'Financial', color: 'amber' },
    { id: 'coop', label: 'Co-op', color: 'purple' },
  ];

  const filteredReports = activeCategory === 'all'
    ? reports.reports
    : reports.reports?.filter(r => r.category === activeCategory) || [];

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500">View business metrics and analytics</p>
        </div>
        {selectedReport && (
          <Button variant="secondary" onClick={() => { setSelectedReport(null); setReportData(null); }}>
            <Icons.ChevronLeft className="w-4 h-4 mr-1" /> Back to Reports
          </Button>
        )}
      </div>

      {!selectedReport ? (
        <>
          <div className="flex gap-2 flex-wrap">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  activeCategory === cat.id
                    ? cat.id === 'coop' ? 'bg-purple-600 text-white' : 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReports.length === 0 ? (
              <div className={`${cardClass} p-8 col-span-full text-center`}>
                <p className="text-gray-500">No reports available in this category</p>
              </div>
            ) : (
              filteredReports.map(report => (
                <button
                  key={report.id}
                  onClick={() => runReport(report.id)}
                  className={`${cardClass} p-6 text-left hover:shadow-md transition border-l-4 ${
                    report.category === 'coop' ? 'border-purple-500' :
                    report.category === 'financial' ? 'border-amber-500' :
                    report.category === 'members' ? 'border-green-500' :
                    report.category === 'classes' ? 'border-blue-500' : 'border-gray-300'
                  }`}
                >
                  <h3 className="font-semibold text-gray-900 mb-1">{report.name}</h3>
                  <p className="text-sm text-gray-500">{report.description}</p>
                  <span className={`inline-block mt-3 px-2 py-1 text-xs font-medium rounded-full ${
                    report.category === 'coop' ? 'bg-purple-100 text-purple-700' :
                    report.category === 'financial' ? 'bg-amber-100 text-amber-700' :
                    report.category === 'members' ? 'bg-green-100 text-green-700' :
                    report.category === 'classes' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {report.category}
                  </span>
                </button>
              ))
            )}
          </div>
        </>
      ) : (
        <div className={cardClass}>
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">{reportData?.name || selectedReport}</h2>
              <p className="text-sm text-gray-500">{reportData?.description}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                {reportData?.rowCount || 0} rows • Generated {reportData?.generated_at ? formatDate(reportData.generated_at, { hour: 'numeric', minute: '2-digit' }) : 'now'}
              </span>
              <Button variant="secondary" size="sm" onClick={() => runReport(selectedReport)}>
                <Icons.Refresh className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {runningReport ? (
            <div className="flex items-center justify-center py-12"><Spinner /></div>
          ) : reportData?.error ? (
            <div className="p-6 text-center">
              <p className="text-red-600">{reportData.error}</p>
            </div>
          ) : reportData?.rows?.length === 0 ? (
            <div className="p-12 text-center">
              <Icons.Chart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No Data Yet</h3>
              <p className="text-gray-500">This report has no data for the selected period.<br />Data will appear here once there are matching records.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {reportData?.fields?.map((field, i) => (
                      <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        {field.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reportData?.rows?.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {reportData?.fields?.map((field, j) => (
                        <td key={j} className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                          {row[field] === null || row[field] === undefined ? (
                            <span className="text-gray-400">—</span>
                          ) : typeof row[field] === 'number' ? (
                            field.includes('price') || field.includes('revenue') || field.includes('rate') || field.includes('total')
                              ? `$${Number(row[field]).toFixed(2)}`
                              : row[field]
                          ) : typeof row[field] === 'boolean' ? (
                            row[field] ? <span className="text-green-600">Yes</span> : <span className="text-gray-400">No</span>
                          ) : (
                            String(row[field])
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const ROUTES = { '/': HomePage, '/schedule': SchedulePage, '/my-classes': MyClassesPage, '/membership': MembershipPage, '/profile': ProfilePage, '/staff/reports': ReportsPage, '/staff/dashboard': HomePage };
const PAGE_IDS = { '/': 'home', '/schedule': 'schedule', '/my-classes': 'my-classes', '/membership': 'membership', '/profile': 'profile', '/staff/dashboard': 'dashboard', '/staff/reports': 'reports' };

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

  const Page = path.startsWith('/staff/')
    ? (isStaff ? (ROUTES[path] || HomePage) : () => <div className="text-center py-12"><h2 className="text-xl font-semibold">Access Denied</h2></div>)
    : ROUTES[path] || HomePage;

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
