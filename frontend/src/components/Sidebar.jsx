import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import autoReorderService from '../services/autoReorderService';
import {
  LayoutDashboard,
  Package,
  Tag,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  BarChart,
  Sparkles,
  Truck,
  ShoppingBag,
  Mail,
  Settings,
  Receipt,
  History
} from 'lucide-react';

const Sidebar = ({ isDark, toggleTheme }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);

  useEffect(() => {
    if (user?.role !== 'owner') return;

    const fetch = async () => {
      try {
        const res = await autoReorderService.pendingApprovalCount();
        if (res.success) {
          setPendingApprovalCount(res.data.count);
        }
      } catch (err) {
        console.error('Fetch pending count error:', err);
      }
    };

    fetch();
    const interval = setInterval(fetch, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const menuItems = [
    { icon: LayoutDashboard, label: 'Marketplace', path: '/pos' },
    { icon: Package, label: 'Products', path: '/products' },
    { icon: Tag, label: 'Promotions', path: '/promotions', ownerOnly: true },
    { icon: Truck, label: 'Vendors', path: '/vendors', ownerOnly: true },
    { icon: ShoppingBag, label: 'Purchase Orders', path: '/purchase-orders', ownerOnly: true, badge: pendingApprovalCount > 0 ? pendingApprovalCount : null, badgeTooltip: `${pendingApprovalCount} auto-generated POs awaiting your approval.` },
    { icon: Receipt, label: 'Invoices', path: '/invoices', ownerOnly: true },
    { icon: Mail, label: 'Email Log', path: '/email-log', ownerOnly: true },
    { icon: History, label: 'Auto-Reorder Activity', path: '/auto-reorder-activity', ownerOnly: true },
    { icon: Settings, label: 'Vendor Settings', path: '/vendor-settings', ownerOnly: true },
    { icon: BarChart, label: 'Reports', path: '/reports', ownerOnly: true },
    { icon: Sparkles, label: 'AI Insights', path: '/ai-insights', ownerOnly: true },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleMenuItemClick = (item) => {
    // If clicking Purchase Orders with a badge, navigate to filtered view
    if (item.path === '/purchase-orders' && pendingApprovalCount > 0) {
      navigate('/purchase-orders?status=draft&source=auto_ml');
    } else {
      navigate(item.path);
    }
  };

  const filteredMenuItems = menuItems.filter(item => {
    if (item.ownerOnly && user?.role !== 'owner') {
      return false;
    }
    return true;
  });

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="fixed top-4 left-4 z-50 md:hidden bg-elevated p-2 rounded-lg text-primary"
      >
        {isCollapsed ? <Menu size={24} /> : <X size={24} />}
      </button>

      {/* Sidebar - always show icons only */}
      <aside
        className={`
          fixed left-0 top-0 h-screen
          bg-surface/80 backdrop-blur-3xl
          border-r border-default
          flex flex-col
          transition-all duration-300 ease-in-out
          z-40
          w-28 px-2
          ${isCollapsed ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}
        `}
      >
        {/* Logo/Header */}
        <div className="w-14 h-14 bg-gradient-to-tr from-indigo-600 via-blue-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/30 cursor-pointer mx-auto my-3">
          <span className="text-4xl leading-none" role="img" aria-label="POS Myanmar">🏪</span>
        </div>

        {/* Menu Items */}
        <nav className="flex flex-col gap-4">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <button
                key={item.path}
                onClick={() => handleMenuItemClick(item)}
                className={`
                  group relative p-2 rounded-[1.5rem] transition-all
                  hover:scale-110 flex items-center justify-center
                  ${isActive
                    ? 'bg-elevated text-primary'
                    : 'text-muted hover:text-primary hover:bg-section'
                  }
                `}
              >
                <Icon size={36} strokeWidth={1.5} />
                {/* Badge */}
                {item.badge && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
                {/* Hover tooltip */}
                <span className="absolute left-full ml-4 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                  {item.badgeTooltip || item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="mt-auto flex flex-col gap-4 pb-4">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 text-muted hover:text-amber-500 dark:hover:text-amber-400 transition-colors relative group flex items-center justify-center"
            title={isDark ? 'Light Mode' : 'Dark Mode'}
          >
            {isDark ? <Sun size={36} /> : <Moon size={36} />}
            <span className="absolute left-full ml-4 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              {isDark ? 'Light Mode' : 'Dark Mode'}
            </span>
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="p-2 text-muted hover:text-red-600 dark:hover:text-red-400 transition-colors relative group flex items-center justify-center"
            title="Logout"
          >
            <LogOut size={36} />
            <span className="absolute left-full ml-4 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              Logout
            </span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;