import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Users, PlusCircle, PieChart, LogOut, Settings, BarChart3 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Logo from '../common/Logo';
import NotificationDropdown from '../common/NotificationDropdown';
import ThemeToggle from '../common/ThemeToggle';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Avatar, AvatarFallback } from '../ui/avatar';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', icon: Home, label: 'Dashboard' },
    { path: '/groups', icon: Users, label: 'Groups' },
    { path: '/add-expense', icon: PlusCircle, label: 'Add Expense' },
    { path: '/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/summary', icon: PieChart, label: 'Summary' },
  ];

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="container-responsive">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div onClick={() => navigate('/dashboard')} className="cursor-pointer min-h-[44px] min-w-[44px] flex items-center">
              <Logo size="sm" />
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors min-h-[44px]
                      ${isActive 
                        ? 'bg-primary text-primary-foreground' 
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      }`}
                  >
                    <Icon size={18} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* User Menu & Notifications */}
            <div className="flex items-center gap-1 sm:gap-2">
              <ThemeToggle variant="simple" />
              <NotificationDropdown />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full min-h-[44px] min-w-[44px] p-0">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                        {user?.name ? getInitials(user.name) : 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-popover z-[60]">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user?.name}</p>
                      <p className="text-xs text-muted-foreground leading-none">{user?.email}</p>
                      {user?.upiId && (
                        <p className="text-xs text-muted-foreground font-mono leading-none mt-1">{user.upiId}</p>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer min-h-[44px]">
                    <Settings size={16} className="mr-2" />
                    Profile Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive min-h-[44px]">
                    <LogOut size={16} className="mr-2" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation - Completely separate from top nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-around w-full px-1 py-1">
          {navItems.slice(0, 4).map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg transition-colors min-h-[56px] flex-1 max-w-[80px]
                  ${isActive 
                    ? 'text-primary bg-primary/10' 
                    : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <Icon size={20} className="flex-shrink-0" />
                <span className="text-[9px] font-medium leading-tight truncate w-full text-center">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default Navbar;
