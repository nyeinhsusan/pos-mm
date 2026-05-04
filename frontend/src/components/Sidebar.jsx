import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Package,
  Tag,
  Settings,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  BarChart,
  Sparkles
} from 'lucide-react';

const Sidebar = ({ isDark, toggleTheme }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(true);

  const menuItems = [
    { icon: LayoutDashboard, label: 'Marketplace', path: '/pos' },
    { icon: Package, label: 'Products', path: '/products' },
    { icon: Tag, label: 'Promotions', path: '/promotions', ownerOnly: true },
    { icon: BarChart, label: 'Reports', path: '/reports', ownerOnly: true },
    { icon: Sparkles, label: 'AI Insights', path: '/ai-insights', ownerOnly: true },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
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
        className="fixed top-4 left-4 z-50 md:hidden bg-gray-800 dark:bg-gray-700 p-2 rounded-lg text-white"
      >
        {isCollapsed ? <Menu size={24} /> : <X size={24} />}
      </button>

      {/* Sidebar - always show icons only */}
      <aside
        className={`
          fixed left-0 top-0 h-screen
          bg-[#02040a]/40 backdrop-blur-3xl
          border-r border-white/5
          flex flex-col
          transition-all duration-300 ease-in-out
          z-40
          w-28 px-4
          ${isCollapsed ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}
        `}
      >
        {/* Logo/Header */}
        <div className="w-20 h-20 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-[1.2rem] flex items-center justify-center shadow-2xl shadow-indigo-500/30 cursor-pointer mx-auto my-6">
          <LayoutDashboard className="text-white" size={44} fill="currentColor" />
        </div>

        {/* Menu Items */}
        <nav className="flex flex-col gap-8">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`
                  group relative p-2 rounded-[1.5rem] transition-all
                  hover:scale-110 flex items-center justify-center
                  ${isActive
                    ? 'bg-indigo-600/10 text-indigo-400'
                    : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                  }
                `}
              >
                <Icon size={36} strokeWidth={1.5} />
                {/* Hover tooltip */}
                <span className="absolute left-full ml-4 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="mt-auto flex flex-col gap-8 pb-8">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 text-slate-500 hover:text-amber-400 transition-colors relative group flex items-center justify-center"
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
            className="p-2 text-slate-500 hover:text-red-400 transition-colors relative group flex items-center justify-center"
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