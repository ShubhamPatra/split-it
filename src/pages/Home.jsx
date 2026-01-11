import React from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Welcome to <span className="text-primary-600">Split-It</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Split expenses effortlessly with friends, roommates, and groups. 
            Track who owes what and settle up with ease.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="px-8 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
            >
              Get Started
            </Link>
            <Link
              to="/login"
              className="px-8 py-3 bg-white text-primary-600 rounded-lg font-semibold border-2 border-primary-600 hover:bg-primary-50 transition-colors"
            >
              Login
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="text-4xl mb-4">💰</div>
            <h3 className="text-xl font-semibold mb-2">Track Expenses</h3>
            <p className="text-gray-600">
              Keep track of all your shared expenses in one place. Never forget who paid for what.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="text-4xl mb-4">👥</div>
            <h3 className="text-xl font-semibold mb-2">Create Groups</h3>
            <p className="text-gray-600">
              Organize expenses by trips, roommates, or any group. Keep everything organized.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="text-4xl mb-4">✅</div>
            <h3 className="text-xl font-semibold mb-2">Settle Up</h3>
            <p className="text-gray-600">
              See exactly who owes what and settle debts with minimal transactions.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8 mt-auto">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-600">
            <p>© 2026 Split-It. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link to="/terms-of-service" className="hover:text-primary-600 transition-colors">
                Terms of Service
              </Link>
              <Link to="/privacy-policy" className="hover:text-primary-600 transition-colors">
                Privacy Policy
              </Link>
            </div>
          </div>
          <div className="text-center mt-4 text-sm text-gray-500">
            Need help? Contact us at{' '}
            <a href="mailto:notifications.splitit@gmail.com" className="text-primary-600 hover:underline">
              notifications.splitit@gmail.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
