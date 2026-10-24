import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  House,
  Search,
  CalendarDays,
  MessageCircle,
  Heart,
  UserRound,
  MapPin,
  ChevronDown,
  Bell,
  Menu,
  HelpCircle,
  LogOut,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';

export default function CustomerLayout({ notify }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileNav, setMobileNav] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const getInitials = (name) => {
    if (!name) return 'CS';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  };

  const navGroups = [
    {
      label: 'Discover',
      items: [
        { label: 'Home', path: '/customer', icon: House, end: true },
        { label: 'Explore services', path: '/customer/explore', icon: Search },
        { label: 'My bookings', path: '/customer/bookings', icon: CalendarDays },
      ],
    },
    {
      label: 'Your account',
      items: [
        { label: 'Messages', path: '/customer/messages', icon: MessageCircle },
        { label: 'Saved workers', path: '/customer/saved', icon: Heart },
        { label: 'Profile & settings', path: '/customer/profile', icon: UserRound },
      ],
    },
  ];

  return (
    <div className="app-shell customer-shell">
      {/* Customer Header - Clean, No role switcher */}
      <header className="topbar">
        <button
          className="mobile-menu icon-btn"
          onClick={() => setMobileNav(!mobileNav)}
          aria-label="Toggle navigation"
        >
          <Menu size={20} />
        </button>

        <Link to="/customer" className="brand">
          <span className="brand-mark">
            <House size={19} strokeWidth={2.5} />
          </span>
          <span>
            serviq<span className="brand-dot">.</span>
          </span>
        </Link>

        <div className="topbar-location">
          <MapPin size={16} />
          <span>
            <small>Your location</small>
            <strong>{user?.city || 'Bhayandar, Mumbai'}</strong>
          </span>
          <ChevronDown size={14} />
        </div>

        <div className="topbar-spacer" />

        {/* Notifications */}
        <button
          className="icon-btn notification-btn"
          onClick={() => notify?.('You’re all caught up on notifications.')}
          aria-label="Notifications"
        >
          <Bell size={18} />
          <i />
        </button>

        {/* Profile Menu */}
        <div className="top-profile-wrapper">
          <button
            className="top-profile"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            aria-expanded={showProfileMenu}
          >
            <div className="avatar dark sm">{getInitials(user?.fullName)}</div>
            <span>{user?.fullName?.split(' ')[0] || 'Customer'}</span>
            <ChevronDown size={14} />
          </button>

          {showProfileMenu && (
            <div className="profile-dropdown-menu">
              <div className="dropdown-user-info">
                <strong>{user?.fullName || 'Customer'}</strong>
                <small>{user?.email}</small>
                <span className="role-tag customer">Customer Account</span>
              </div>
              <hr className="dropdown-divider" />
              <Link
                to="/customer/profile"
                className="dropdown-item"
                onClick={() => setShowProfileMenu(false)}
              >
                <UserRound size={16} />
                <span>Account Profile</span>
              </Link>
              <button
                type="button"
                className="dropdown-item logout"
                onClick={handleLogout}
              >
                <LogOut size={16} />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Body */}
      <div className="app-body">
        {/* Customer Sidebar */}
        <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
          <div className="side-context">
            <div className="side-context-icon">
              <House size={17} />
            </div>
            <div>
              <strong>Customer space</strong>
              <span>Find verified local help</span>
            </div>
          </div>

          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.label}
                  to={item.path}
                  end={item.end}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setMobileNav(false)}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                  {item.count && <span className="nav-count">{item.count}</span>}
                </NavLink>
              ))}
            </div>
          ))}

          <div className="sidebar-bottom">
            <div className="help-card">
              <div className="help-icon">
                <HelpCircle size={18} />
              </div>
              <strong>Need assistance?</strong>
              <p>We’re here to help with your bookings and service questions.</p>
              <button onClick={() => notify?.('Serviq customer support team is available 24/7.')}>
                Contact support <ArrowUpRight size={14} />
              </button>
            </div>

            <button className="nav-item logout" onClick={handleLogout}>
              <LogOut size={17} />
              <span>Sign out</span>
            </button>

            <div className="sidebar-foot">
              © 2026 Serviq <span>•</span> Verified Local Services
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="main-content" onClick={() => mobileNav && setMobileNav(false)}>
          <div className="content-wrap">
            <Outlet />
          </div>

          <footer className="page-footer">
            <span>Made for everyday help.</span>
            <span>
              <ShieldCheck size={13} /> Trusted & verified local service marketplace
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
