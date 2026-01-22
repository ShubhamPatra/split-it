import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-card shadow-sm border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="text-2xl font-bold text-primary">
            Split-It
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <Link
                  to="/dashboard"
                  className="text-muted-foreground hover:bg-muted px-4 py-2 rounded font-medium transition-colors duration-150"
                >
                  Dashboard
                </Link>
                <Link
                  to="/expenses"
                  className="text-muted-foreground hover:bg-muted px-4 py-2 rounded font-medium transition-colors duration-150"
                >
                  Expenses
                </Link>
                <Link
                  to="/groups"
                  className="text-muted-foreground hover:bg-muted px-4 py-2 rounded font-medium transition-colors duration-150"
                >
                  Groups
                </Link>
                <div className="flex items-center space-x-3">
                  <span className="text-foreground">{user?.name}</span>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-destructive text-destructive-foreground rounded font-medium hover:bg-destructive/90 transition-colors duration-150"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-muted-foreground hover:bg-muted px-4 py-2 rounded font-medium transition-colors duration-150"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded font-medium hover:bg-primary/90 transition-colors duration-150"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
