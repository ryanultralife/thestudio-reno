import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { getNavigationForRole, getMobileNavForRole } from '../lib/navigation';
import { Icons, getIcon } from './Icons';

function NavItem({ item, active, collapsed, onClick }) {
  const Icon = getIcon(item.icon);
  return (
    <button onClick={() => onClick(item.path)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${active ? 'bg-amber-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
      <Icon />{!collapsed && <span>{item.label}</span>}
    </button>
  );
}

function Sidebar({ currentPage, onNavigate }) {
  const { user, logout, isStaff, roleLabel } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const nav = getNavigationForRole(user?.role);
  const isActive = (item) => currentPage === item.id || window.location.pathname === item.path;

  return (
    <div className={`bg-gray-900 text-white h-screen flex flex-col transition-all ${collapsed ? 'w-16' : 'w-64'}`}>
      <div className="p-4 flex items-center justify-between border-b border-gray-800">
        {!collapsed && <span className="font-bold text-lg">The Studio</span>}
        <button onClick={() => setCollapsed(!collapsed)} className="p-1 hover:bg-gray-800 rounded"><Icons.Menu /></button>
      </div>
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {isStaff && nav.staff && (
          <>
            {!collapsed && <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Staff</div>}
            {nav.staff.map(i => <NavItem key={i.id} item={i} active={isActive(i)} collapsed={collapsed} onClick={onNavigate} />)}
            {nav.personal && (
              <>
                {!collapsed && <div className="px-3 py-2 mt-4 text-xs font-semibold text-gray-500 uppercase">My Account</div>}
                {nav.personal.map(i => <NavItem key={i.id} item={i} active={isActive(i)} collapsed={collapsed} onClick={onNavigate} />)}
              </>
            )}
          </>
        )}
        {!isStaff && nav.main?.map(i => <NavItem key={i.id} item={i} active={isActive(i)} collapsed={collapsed} onClick={onNavigate} />)}
        {nav.secondary?.length > 0 && (
          <>
            {!collapsed && <div className="border-t border-gray-800 my-4" />}
            {nav.secondary.map(i => <NavItem key={i.id} item={i} active={isActive(i)} collapsed={collapsed} onClick={onNavigate} />)}
          </>
        )}
      </nav>
      {user && (
        <div className="p-4 border-t border-gray-800">
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 bg-amber-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">{user.first_name?.[0]}{user.last_name?.[0]}</div>
            {!collapsed && <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{user.first_name} {user.last_name}</p><p className="text-xs text-gray-500">{roleLabel}</p></div>}
            <button onClick={logout} className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white"><Icons.Logout /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function MobileHeader() {
  const { user, logout, isAuthenticated } = useAuth();
  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between md:hidden">
      <span className="font-bold text-lg text-gray-900">The Studio</span>
      <div className="flex items-center gap-2">
        {isAuthenticated ? (
          <>
            <div className="w-8 h-8 bg-amber-600 rounded-full flex items-center justify-center text-white text-sm font-bold">{user.first_name?.[0]}{user.last_name?.[0]}</div>
            <button onClick={logout} className="p-2 text-gray-500"><Icons.Logout /></button>
          </>
        ) : (
          <button onClick={() => window.dispatchEvent(new CustomEvent('openAuth'))} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium">Sign In</button>
        )}
      </div>
    </header>
  );
}

function MobileBottomNav({ currentPage, onNavigate }) {
  const { user } = useAuth();
  const mobileNav = getMobileNavForRole(user?.role);
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-40">
      <div className="flex justify-around items-center h-16 px-2">
        {mobileNav.map(item => {
          const Icon = getIcon(item.icon);
          const active = currentPage === item.id || window.location.pathname === item.path;
          return (
            <button key={item.id} onClick={() => onNavigate(item.path)} className={`flex flex-col items-center justify-center flex-1 h-full ${active ? 'text-amber-600' : 'text-gray-500'}`}>
              <Icon className="w-6 h-6" /><span className="text-xs mt-1">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function Layout({ children, currentPage, onNavigate }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Spinner /></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="hidden md:flex">
        {isAuthenticated && <Sidebar currentPage={currentPage} onNavigate={onNavigate} />}
        <main className="flex-1 overflow-auto"><div className="p-6">{children}</div></main>
      </div>
      <div className="md:hidden">
        <MobileHeader />
        <main className="pb-20 min-h-screen"><div className="p-4">{children}</div></main>
        {isAuthenticated && <MobileBottomNav currentPage={currentPage} onNavigate={onNavigate} />}
      </div>
    </div>
  );
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }) {
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

export function Toast({ message, type = 'success', onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return <div className={`fixed bottom-20 md:bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 text-white ${type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>{message}</div>;
}

export function Spinner() {
  return <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>;
}

export function Button({ children, variant = 'primary', size = 'md', disabled = false, onClick, className = '', type = 'button' }) {
  const v = { primary: 'bg-amber-600 hover:bg-amber-700 text-white', secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700', outline: 'border border-gray-300 hover:bg-gray-50 text-gray-700', danger: 'bg-red-600 hover:bg-red-700 text-white' };
  const s = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2', lg: 'px-6 py-3 text-lg' };
  return <button type={type} onClick={onClick} disabled={disabled} className={`font-medium rounded-lg transition disabled:opacity-50 ${v[variant]} ${s[size]} ${className}`}>{children}</button>;
}

export default Layout;
