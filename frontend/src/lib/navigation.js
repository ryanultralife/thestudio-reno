// ============================================
// ROLE-BASED NAVIGATION CONFIGURATION
// Defines menus for each user type
// ============================================

// Navigation items with role requirements
const NAV_ITEMS = {
  // ---- Client Navigation ----
  home: {
    id: 'home',
    label: 'Home',
    icon: 'Home',
    path: '/',
    roles: ['client', 'teacher', 'front_desk', 'manager', 'owner', 'admin'],
  },
  schedule: {
    id: 'schedule',
    label: 'Schedule',
    icon: 'Calendar',
    path: '/schedule',
    roles: ['client', 'teacher', 'front_desk', 'manager', 'owner', 'admin'],
  },
  myClasses: {
    id: 'my-classes',
    label: 'My Classes',
    icon: 'Check',
    path: '/my-classes',
    roles: ['client', 'teacher', 'front_desk', 'manager', 'owner', 'admin'],
  },
  membership: {
    id: 'membership',
    label: 'Membership',
    icon: 'CreditCard',
    path: '/membership',
    roles: ['client', 'teacher', 'front_desk', 'manager', 'owner', 'admin'],
  },
  pricing: {
    id: 'pricing',
    label: 'Pricing',
    icon: 'DollarSign',
    path: '/pricing',
    public: true,
  },

  // ---- Staff Navigation ----
  dashboard: {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'Home',
    path: '/staff/dashboard',
    roles: ['front_desk', 'teacher', 'manager', 'owner', 'admin'],
  },
  checkin: {
    id: 'checkin',
    label: 'Check In',
    icon: 'Check',
    path: '/staff/checkin',
    roles: ['front_desk', 'teacher', 'manager', 'owner', 'admin'],
  },
  clients: {
    id: 'clients',
    label: 'Clients',
    icon: 'Users',
    path: '/staff/clients',
    roles: ['front_desk', 'manager', 'owner', 'admin'],
  },
  sell: {
    id: 'sell',
    label: 'Sell',
    icon: 'CreditCard',
    path: '/staff/sell',
    roles: ['front_desk', 'manager', 'owner', 'admin'],
  },
  subs: {
    id: 'subs',
    label: 'Sub Requests',
    icon: 'Swap',
    path: '/staff/subs',
    roles: ['teacher', 'manager', 'owner', 'admin'],
  },
  coop: {
    id: 'coop',
    label: 'Co-op Rentals',
    icon: 'Building',
    path: '/staff/coop',
    roles: ['teacher', 'manager', 'owner', 'admin'],
  },
  reports: {
    id: 'reports',
    label: 'Reports',
    icon: 'Chart',
    path: '/staff/reports',
    roles: ['manager', 'owner', 'admin'],
  },
  settings: {
    id: 'settings',
    label: 'Settings',
    icon: 'Settings',
    path: '/staff/settings',
    roles: ['owner', 'admin'],
  },

  // ---- Profile/Account ----
  profile: {
    id: 'profile',
    label: 'Profile',
    icon: 'User',
    path: '/profile',
    roles: ['client', 'teacher', 'front_desk', 'manager', 'owner', 'admin'],
  },
};

// ============================================
// GET NAVIGATION FOR ROLE
// ============================================

export function getNavigationForRole(userRole) {
  if (!userRole) {
    // Public navigation
    return {
      main: [NAV_ITEMS.home, NAV_ITEMS.schedule, NAV_ITEMS.pricing],
      secondary: [],
    };
  }

  const isStaff = ['front_desk', 'teacher', 'manager', 'owner', 'admin'].includes(userRole);

  if (userRole === 'client') {
    // Client/Member navigation
    return {
      main: [
        NAV_ITEMS.home,
        NAV_ITEMS.schedule,
        NAV_ITEMS.myClasses,
        NAV_ITEMS.membership,
      ],
      secondary: [NAV_ITEMS.profile],
    };
  }

  // Staff navigation - show both personal and staff items
  const staffItems = Object.values(NAV_ITEMS)
    .filter(item => item.roles?.includes(userRole) && item.path?.startsWith('/staff'))
    .sort((a, b) => {
      const order = ['dashboard', 'checkin', 'clients', 'sell', 'subs', 'coop', 'reports', 'settings'];
      return order.indexOf(a.id) - order.indexOf(b.id);
    });

  return {
    // Personal items for staff
    personal: [
      NAV_ITEMS.schedule,
      NAV_ITEMS.myClasses,
      NAV_ITEMS.membership,
    ],
    // Staff-only items
    staff: staffItems,
    secondary: [NAV_ITEMS.profile],
  };
}

// ============================================
// CHECK IF ROUTE IS ACCESSIBLE
// ============================================

export function canAccessRoute(path, userRole) {
  // Public routes
  const publicPaths = ['/', '/schedule', '/pricing', '/teachers', '/about'];
  if (publicPaths.includes(path)) return true;

  // No user - only public routes
  if (!userRole) return false;

  // Find matching nav item
  const navItem = Object.values(NAV_ITEMS).find(item => item.path === path);
  if (!navItem) return true; // Unknown routes - let the app handle it

  // Check role permission
  return navItem.roles?.includes(userRole) || navItem.public;
}

// ============================================
// MOBILE BOTTOM NAV ITEMS
// ============================================

export function getMobileNavForRole(userRole) {
  if (!userRole) {
    return [NAV_ITEMS.home, NAV_ITEMS.schedule, NAV_ITEMS.pricing];
  }

  if (userRole === 'client') {
    return [
      NAV_ITEMS.home,
      NAV_ITEMS.schedule,
      NAV_ITEMS.myClasses,
      NAV_ITEMS.membership,
      NAV_ITEMS.profile,
    ].slice(0, 5);
  }

  // Staff mobile nav - key actions
  return [
    NAV_ITEMS.dashboard,
    NAV_ITEMS.checkin,
    NAV_ITEMS.schedule,
    NAV_ITEMS.clients,
    NAV_ITEMS.profile,
  ].filter(item => item.roles?.includes(userRole)).slice(0, 5);
}

export { NAV_ITEMS };
