import React from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, Bell, Globe } from 'lucide-react';

interface HeaderProps {
  title: string;
  onToggleSidebar: () => void;
}

const routeTitles: Record<string, string> = {
  '/': '项目管理',
  '/projects/new': '新建项目',
  '/hongbao-center': '红包发放',
  '/users': '用户库',
  '/register': '注册问卷',
  '/settings': '微信配置',
};

export default function Header({ title, onToggleSidebar }: HeaderProps) {
  const location = useLocation();
  const pageTitle = routeTitles[location.pathname] || title;

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-10">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex items-center text-sm text-gray-500">
          <span className="hover:text-gray-800 cursor-pointer">应用</span>
          <span className="mx-2">/</span>
          <span className="text-gray-800 font-semibold">{pageTitle}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="flex bg-gray-100 rounded-lg p-1">
          <span className="px-3 py-1 text-xs font-medium text-gray-500 hover:bg-white rounded-md transition">
            EN
          </span>
          <span className="px-3 py-1 text-xs font-bold text-gray-800 bg-white shadow-sm rounded-md">
            中文
          </span>
        </button>

        <div className="flex items-center gap-3 pl-4 border-l">
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative">
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>
          <div className="hidden md:flex items-center gap-2">
            <div className="text-right">
              <div className="text-sm font-bold text-gray-800">管理员</div>
              <div className="text-xs text-blue-600">超级管理员</div>
            </div>
            <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
              M
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}