const ALL = ['client', 'teacher', 'front_desk', 'manager', 'owner', 'admin'];
const STAFF = ['front_desk', 'teacher', 'manager', 'owner', 'admin'];

const NAV_ITEMS = {
  home: { id: 'home', label: 'Home', icon: 'Home', path: '/', roles: ALL },
  schedule: { id: 'schedule', label: 'Schedule', icon: 'Calendar', path: '/schedule', roles: ALL },
  myClasses: { id: 'my-classes', label: 'My Classes', icon: 'Check', path: '/my-classes', roles: ALL },
  membership: { id: 'membership', label: 'Membership', icon: 'CreditCard', path: '/membership', roles: ALL },
  pricing: { id: 'pricing', label: 'Pricing', icon: 'DollarSign', path: '/pricing', public: true },
  profile: { id: 'profile', label: 'Profile', icon: 'User', path: '/profile', roles: ALL },
  dashboard: { id: 'dashboard', label: 'Dashboard', icon: 'Home', path: '/staff/dashboard', roles: STAFF },
  checkin: { id: 'checkin', label: 'Check In', icon: 'Check', path: '/staff/checkin', roles: STAFF },
  clients: { id: 'clients', label: 'Clients', icon: 'Users', path: '/staff/clients', roles: ['front_desk', 'manager', 'owner', 'admin'] },
  sell: { id: 'sell', label: 'Sell', icon: 'CreditCard', path: '/staff/sell', roles: ['front_desk', 'manager', 'owner', 'admin'] },
  subs: { id: 'subs', label: 'Sub Requests', icon: 'Swap', path: '/staff/subs', roles: ['teacher', 'manager', 'owner', 'admin'] },
  coop: { id: 'coop', label: 'Co-op Rentals', icon: 'Building', path: '/staff/coop', roles: ['teacher', 'manager', 'owner', 'admin'] },
  reports: { id: 'reports', label: 'Reports', icon: 'Chart', path: '/staff/reports', roles: ['manager', 'owner', 'admin'] },
  settings: { id: 'settings', label: 'Settings', icon: 'Settings', path: '/staff/settings', roles: ['owner', 'admin'] },
};

const { home, schedule, myClasses, membership, pricing, profile, dashboard, checkin, clients } = NAV_ITEMS;

export function getNavigationForRole(role) {
  if (!role) return { main: [home, schedule, pricing], secondary: [] };
  if (role === 'client') return { main: [home, schedule, myClasses, membership], secondary: [profile] };

  const staffItems = Object.values(NAV_ITEMS)
    .filter(i => i.roles?.includes(role) && i.path?.startsWith('/staff'))
    .sort((a, b) => ['dashboard', 'checkin', 'clients', 'sell', 'subs', 'coop', 'reports', 'settings'].indexOf(a.id) - ['dashboard', 'checkin', 'clients', 'sell', 'subs', 'coop', 'reports', 'settings'].indexOf(b.id));

  return { personal: [schedule, myClasses, membership], staff: staffItems, secondary: [profile] };
}

export function getMobileNavForRole(role) {
  if (!role) return [home, schedule, pricing];
  if (role === 'client') return [home, schedule, myClasses, membership, profile];
  return [dashboard, checkin, schedule, clients, profile].filter(i => i.roles?.includes(role)).slice(0, 5);
}

export { NAV_ITEMS };
