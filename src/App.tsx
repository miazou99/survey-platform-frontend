import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import ProjectsList from './pages/Projects/ProjectsList';
import NewProject from './pages/Projects/NewProject';
import ProjectDetail from './pages/Projects/ProjectDetail';
import UserLibrary from './pages/Users/UserLibrary';
import UserProfileManage from './pages/Users/UserProfileManage';
import Settings from './pages/Settings/Settings';
import Overview from './pages/Overview';
import HongbaoCenter from './pages/HongbaoCenter';
import DeployPanel from './pages/DeployPanel';
import Login from './pages/Login/Login';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Settings as SettingsIcon,
  PlusCircle,
  Database,
  BarChart3,
  Gift,
  Rocket,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

function Sidebar({ isCollapsed }: { isCollapsed: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { path: '/', label: '项目管理', icon: LayoutDashboard },
    { path: '/hongbao-center', label: '红包发放', icon: Gift },
    { path: '/overview', label: '数据概览', icon: BarChart3 },
    { path: '/users', label: '用户库', icon: Users },
    { path: '/users/profile', label: '画像管理', icon: Database },
    { path: '/deploy', label: '部署面板', icon: Rocket },
    { path: '/settings', label: '安全配置', icon: SettingsIcon },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname.startsWith('/projects');
    }
    return location.pathname === path;
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-sidebar-bg text-gray-400 transition-all duration-300 z-50 flex flex-col ${
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

    </aside>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function MainLayout() {
  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-gray-100">
        <Sidebar isCollapsed={false} />
        <main className="flex-1 overflow-auto ml-64">
          <Outlet />
        </main>
      </div>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<MainLayout />}>
            <Route index element={<ProjectsList />} />
            <Route path="projects" element={<ProjectsList />} />
            <Route path="projects/new" element={<NewProject />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="overview" element={<Overview />} />
            <Route path="hongbao-center" element={<HongbaoCenter />} />
            <Route path="users" element={<UserLibrary />} />
            <Route path="users/profile" element={<UserProfileManage />} />
            <Route path="deploy" element={<DeployPanel />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
