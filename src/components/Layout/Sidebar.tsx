import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Settings,
  UserCircle,
  X,
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

const menuItems = [
  { path: '/', label: '项目管理', icon: LayoutDashboard },
  { path: '/users', label: '用户库', icon: Users },
  { path: '/register', label: '注册问卷', icon: UserCircle },
  { path: '/settings', label: '微信配置', icon: Settings },
];

export default function Sidebar({ isCollapsed, onToggle, isMobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname.startsWith('/projects');
    }
    return location.pathname === path;
  };

  const handleNav = (path: string) => {
    navigate(path);
    onMobileClose?.();
  };

  // 桌面端侧边栏
  const desktopSidebar = (
    <aside
      className={`hidden md:flex fixed left-0 top-0 h-full bg-sidebar-bg text-gray-400 transition-all duration-300 z-50 flex flex-col ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div
        className="h-16 flex items-center justify-center text-white font-bold text-lg border-b border-gray-800 cursor-pointer hover:bg-sidebar-hover transition-colors"
        onClick={() => navigate('/')}
      >
        {!isCollapsed && (
          <span className="truncate">SynthoResearch</span>
        )}
        {isCollapsed && <LayoutDashboard className="w-6 h-6" />}
      </div>

      <nav className="flex-1 mt-6 px-2 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md transition-all ${
                active
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'hover:bg-sidebar-hover hover:text-white'
              } ${isCollapsed ? 'justify-center' : ''}`}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span className="ml-3 truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
            M
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-white truncate">管理员</div>
              <div className="text-[10px] text-gray-500 truncate">超级管理员</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );

  // 移动端抽屉
  const mobileDrawer = (
    <>
      {/* 遮罩层 */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-50"
          onClick={onMobileClose}
        />
      )}
      {/* 抽屉 */}
      <aside
        className={`md:hidden fixed left-0 top-0 h-full w-64 bg-sidebar-bg text-gray-400 z-50 flex flex-col transition-transform duration-300 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-4 text-white font-bold text-lg border-b border-gray-800">
          <span>SynthoResearch</span>
          <button onClick={onMobileClose} className="p-2 hover:bg-sidebar-hover rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 mt-6 px-2 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md transition-all ${
                  active
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'hover:bg-sidebar-hover hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="ml-3 truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
              M
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-white truncate">管理员</div>
              <div className="text-[10px] text-gray-500 truncate">超级管理员</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );

  return (
    <>
      {desktopSidebar}
      {mobileDrawer}
    </>
  );
}
