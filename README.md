# Split-It - Expense Sharing App 💰

A modern, full-stack expense sharing application that makes splitting bills with friends easy and organized. Built with React, Express.js, MongoDB, and featuring Google OAuth authentication.

## ✨ Features

- 👥 **Group Management** - Create and manage expense groups with friends
- 💰 **Smart Expense Tracking** - Add and split expenses with multiple methods (equal, exact amounts, percentages)
- 📊 **Visual Analytics** - Beautiful charts and graphs to visualize spending patterns
- 💳 **Settlement Optimization** - Smart algorithm to minimize the number of transactions needed
- 🌍 **Multi-Currency Support** - Handle expenses in 150+ currencies with real-time conversion
- 🔐 **Secure Authentication** - Email/Password and Google Sign-In support
- 📱 **Responsive Design** - Seamless experience on desktop, tablet, and mobile
- 📥 **Export Data** - Download expenses and reports as CSV or PDF
- 🔔 **Real-time Notifications** - Stay updated on group activities
- 📸 **Receipt Upload** - Attach receipt images to expenses (future feature)
- 🎨 **Modern UI** - Clean, intuitive interface with dark mode support

## 🛠️ Tech Stack

### Frontend
- **React 19** - Latest React features with improved performance
- **React Router v7** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - High-quality React components
- **Recharts** - Responsive chart library
- **React Context API** - State management

### Backend
- **Node.js & Express.js** - RESTful API server
- **MongoDB Atlas** - Cloud database
- **Mongoose** - MongoDB object modeling
- **JWT** - Secure authentication
- **Passport.js** - Google OAuth integration
- **bcrypt** - Password hashing

### Additional Tools
- **jsPDF** - PDF generation
- **Lucide React** - Beautiful icons
- **date-fns** - Date manipulation

## 📋 Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Node.js** (v16.x or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn**
- **MongoDB Atlas Account** (free) - [Sign up here](https://www.mongodb.com/cloud/atlas)
- **Google Cloud Account** (for OAuth) - [Console here](https://console.cloud.google.com/)
- **Git** (optional) - For version control

To verify installations, run:
```bash
node --version  # Should show v16.x or higher
npm --version   # Should show 8.x or higher
```

## 🚀 Complete Setup Guide

### Step 1: Clone or Download the Project

```bash
# If using Git
git clone <your-repo-url>
cd split-it

# Or simply navigate to the project folder
cd D:\Projects\split-it
```

### Step 2: Install Dependencies

Install dependencies for both frontend and backend:

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

Or use the convenient script:
```bash
npm run install-all
```

### Step 3: Set Up MongoDB Atlas (Database)

1. **Create MongoDB Atlas Account**
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Click "Try Free" and sign up
   - Verify your email

2. **Create a Cluster**
   - Click "Build a Database"
   - Choose **M0 FREE** tier
   - Select a cloud provider and region (closest to you)
   - Click "Create Cluster" (takes 3-5 minutes)

3. **Create Database User**
   - Go to "Database Access" (left sidebar)
   - Click "Add New Database User"
   - Choose "Password" authentication
   - Username: `splitit_user` (or any name)
   - Password: Click "Autogenerate Secure Password" or create your own
   - **IMPORTANT**: Save this password!
   - User Privileges: Select "Atlas admin"
   - Click "Add User"

4. **Whitelist Your IP Address**
   - Go to "Network Access" (left sidebar)
   - Click "Add IP Address"
   - Click "Allow Access from Anywhere" (for development)
   - Or add your specific IP address
   - Click "Confirm"

5. **Get Connection String**
   - Go to "Database" (left sidebar)
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Driver: **Node.js**, Version: **4.1 or later**
   - Copy the connection string (looks like):
     ```
     mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
     ```
   - Replace `<username>` with your database username
   - Replace `<password>` with your database password
   - Keep this string - you'll need it next!

### Step 4: Set Up Google OAuth (Optional but Recommended)

1. **Go to Google Cloud Console**
   - Visit [Google Cloud Console](https://console.cloud.google.com/)
   - Sign in with your Google account

2. **Create a New Project**
   - Click on the project dropdown (top left)
   - Click "New Project"
   📁 Project Structure

```
split-it/
├── public/                     # Static files
│   ├── index.html             # HTML template
│   ├── manifest.json          # PWA manifest
│   └── robots.txt             # SEO configuration
│
├── src/                       # Frontend source code
│   ├── components/            # React components
│   │   ├── common/           # Reusable UI components
│   │   ├── expense/          # Expense-related components
│   │   ├── layout/           # Layout components (Navbar, etc.)
│   │   └── ui/               # Base UI components (shadcn/ui)
│   ├── context/              # React Context providers
│   │   ├── AuthContext.jsx   # Authentication state
│   │   ├── GroupContext.jsx  # Group management
│   │   ├── ExpenseContext.jsx # Expense tracking
│   │   ├── CurrencyContext.jsx # Currency management
│   │   └── NotificationContext.jsx # Notifications
│   ├── pages/                # Page components
│   │   ├── Home.jsx          # Landing page
│   │   ├── Login.jsx         # Login page
│   │   ├── Signup.jsx        # Registration page
│   │   ├── Dashboard.jsx     # Main dashboard
│   │   ├── Groups.jsx        # Groups list
│   │   ├── GroupDetail.jsx   # Group details
│   │   ├── AddExpense.jsx    # Add expense form
│   │   ├── Analytics.jsx     # Analytics & charts
│   │   ├── Summary.jsx       # Settlement summary
│   │   └── Profile.jsx       # User profile
│   ├── hooks/                # Custom React hooks
│   ├── lib/                  # Utility libraries
│   │   ├── apiClient.js      # API communication
│   │   ├── utils.js          # Helper functions
│   │   └── exportCsv.js      # Export functionality
│   ├── utils/                # Utility functions
│   │   ├── settlementOptimizer.js # Settlement algorithm
│   │   └── upiHelpers.js     # UPI payment helpers
│   ├── data/                 # Static data
│   │   └── categories.js     # Expense categories
│   ├── App.js                # Main app component
│   ├── App.css               # Global styles
│   ├── index.js              # Entry point
│   └── index.css             # Tailwind CSS imports
│
├── server/                    # Backend source code
│   ├── config/               # Configuration files
│   │   ├── db.js             # MongoDB connection
│   │   └── passport.js       # Passport.js config
│   ├── controllers/          # Route controllers
│   │   ├── authController.js # Authentication logic
│   │   ├── userController.js # User management
│   │   ├── groupController.js # Group operations
│   │   ├── expenseController.js # Expense operations
│   │   ├── settlementController.js # Settlement logic
│   │   └── notificationController.js # Notifications
│   ├── models/               # Mongoose models
│   │   ├── User.js           # User schema
│   │   ├── Group.js          # Group schema
│   │   ├── Expense.js        # Expense schema
│   │   ├── Settlement.js     # Settlement schema
│   │   └── Notification.js   # Notification schema
│   ├── routes/               # API routes
│   │   ├── authRoutes.js     # Auth endpoints
│   │   ├── userRoutes.js     # User endpoints
│   │   ├── groupRoutes.js    # Group endpoints
│   │   ├── expenseRoutes.js  # Expense endpoints
│   │   ├── settlementRoutes.js # Settlement endpoints
│   │   └── notificationRoutes.js # Notification endpoints
│   ├── middleware/           # Express middleware
│   │   ├── authMiddleware.js # JWT authentication
│   │   ├── validation.js     # Input validation
│   │   └── security.js       # Security & rate limiting
│   ├── utils/                # Backend utilities
│   │   ├── dbIndexes.js      # Database indexes
│   │   ├── upiValidation.js  # UPI ID validation
│   │   └── paymentNotifications.js # Payment reminders
│   ├── server.js             # Express server setup
│   ├── package.json          # Backend dependencies
│   └── .env                  # Backend environment variables
│
├── build/                     # Production build (generated)
├── node_modules/              # Dependencies (generated)
├── package.json               # Frontend dependencies
├── .env                       # Frontend environment variables
├── tailwind.config.js         # Tailwind CSS configuration
├── postcss.config.js          # PostCSS configuration
├── jsconfig.json              # JavaScript configuration
└── README.md                  # This file
```

## 🗄️ Database Models

### User
- Authentication (email/password, Google OAuth)
- Profile information (name, email, UPI ID)
- Timestamps

### Group
- Group details (name, description, currency)
- Member list with roles (admin/member)
- Created date and settings

### Expense
- Amount and description
- Category
- Split method (equal, percentage, exact)
- Split configuration per member
- Payer and date

### Settlement
- Amount and date
- From user → To user
- Associated group
- Payment status

### Notification
- User recipient
- Type (expense added, settlement recorded, etc.)
- Read status and timestamp
   - Click "Create Credentials" → "OAuth client ID"
   - If prompted, configure the OAuth consent screen:
     - User Type: **External**
     - App name: "Split-It"
     - User support email: Your email
     - Developer contact: Your email
     - Click "Save and Continue" through the steps
   
5. **Configure OAuth Client**
   - Application type: **Web application**
   - Name: "Split-It Local Development"
   - **Authorized JavaScript origins:**
     - Click "Add URI"
     - Add: `http://localhost:3000`
   - **Authorized redirect URIs:**
     - Click "Add URI"
     - Add: `http://localhost:5000/api/auth/google/callback`
   - Click "Create"

6. **Save Credentials**
   - Copy the **Client ID** (looks like: `xxxxx.apps.googleusercontent.com`)
   - Copy the **Client Secret**
   - Click "OK"

### Step 5: Configure Environment Variables

#### Backend Configuration (server/.env)

Create a file at `server/.env`:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Connection
MONGODB_URI=mongodb+srv://your_username:your_password@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority

# JWT Secret (generate a random string)
JWT_SECRET=your_super_secret_jwt_key_here_use_random_string

# Server & Client URLs
SERVER_URL=http://localhost:5000
CLIENT_URL=http://localhost:3000

# Google OAuth Credentials (from Step 4)
GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

**Important Notes:**
- Replace `MONGODB_URI` with your actual connection string from Step 3
- For `JWT_SECRET`, use a long random string (at least 32 characters)
- Add your Google credentials from Step 4 (or skip if not using Google Sign-In)

#### Frontend Configuration (.env)

Create a file at `.env` (in the root folder):

```env
# API URL
REACT_APP_API_URL=http://localhost:5000/api

# Google OAuth Client ID (same as in server/.env)
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com
```

### Step 6: Start the Application

You have two options:

#### Option A: Run Both Servers Together (Recommended)

```bash
npm run dev
```

This starts both frontend and backend simultaneously.

#### Option B: Run Servers Separately

**Terminal 1 - Start Backend Server:**
```bash
cd server
npm start
# Or for development with auto-restart:
npm run dev
```

You should see:
```
Server running on http://localhost:5000
MongoDB connected successfully
```

**Terminal 2 - Start Frontend Server:**
```bash
npm start
```

The app will automatically open at `http://localhost:3000`

### Step 7: Verify Everything Works

1. **Open your browser** to `http://localhost:3000`
2. You should see the Split-It landing page
3. **Click "Sign Up"** and create an account
4. Or **click "Sign in with Google"** to test OAuth
5. After logging in, you should see the Dashboard

## 🎯 Quick Start (After Setup)

Once everything is configured, starting the app is simple:

```bash
# Make sure you're in the project root directory
cd D:\Projects\split-it

# Start both servers
npm run dev
```

That's it! The app will be running at `http://localhost:3000` 🎉

## Database Schema

The app uses the following main tables:
- `profiles` - User profiles linked to Supabase Auth
- `groups` - Expense groups
- `group_members` - Group membership with roles
- `expenses` - Expense records with split configurations
- `settlements` - Settlement records between users

See `supabase-schema.sql` for the complete schema.

## Project Structure

```
src/
├── components/        # Reusable UI components
│   ├── common/       # Common components (cards, selectors, etc.)
│   ├── expense/      # Expense-specific components
│   ├── layout/       # Layout components (Navbar, etc.)
│   └── ui/           # Base UI components (shadcn/ui)
├── context/          # React Context providers
│   ├── AuthContext.jsx
│   ├── GroupContext.jsx
│   ├── CurrencyContext.jsx
│   └── NotificationContext.jsx
├── data/             # Static data and helpers
├── hooks/            # Custom React hooks
├── lib/              # Utility libraries
│   ├── supabase.js   # Supabase client
│   ├── utils.js      # General utilities
│   └── exportCsv.js  # Export functionality
├── pages/            # Page components
└── App.js            # Main app component
```

## Available Scripts

- `npm start` - Start development server
- `npm build` - Build for production
- `npm test` - Run tests

## Key Features Explained

### Split Methods
- **Equal Split**: Divide expense equally among all members
- **Exact Amounts**: Specify exact amount each person owes
- **Percentage Split**: Specify percentage each person owes

### Currency Conversion
The app supports multiple currencies with automatic conversion to a base currency (INR) for consistent calculations.

### Group Roles
- **Admin**: Can manage group settings and members
- **Member**: Can add expenses and view group details

### Data Export
Export your expense data in multiple formats:
- Individual expense lists (CSV)
- Settlement records (CSV)
- Full group reports (CSV/PDF)

## Security

- Row Level Security (RLS) enabled on all tables
- Users can only access groups they belong to
- Admins required for sensitive operations

## Troubleshooting

### Common Issues

1. **Import errors with @/ paths**: Make sure `jsconfig.json` is present in the root directory
2. **Supabase connection errors**: Verify your environment variables are set correctly
3. **CSS not loading**: Ensure Tailwind CSS is properly configured in `tailwind.config.js`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the MIT License.

- **Responsive Design**: Beautiful UI with Tailwind CSS
- **Context API**: Global state management for auth and expenses
- **Protected Routes**: Secure dashboard and authenticated pages
- **PWA Ready**: Prepared for Progressive Web App features

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (LTS version 16.x or higher)
  - Download: https://nodejs.org/
  - Verify installation: `node --version`
- **npm** (comes with Node.js)
  - Verify installation: `npm --version`

## 🛠️ Installation & Setup

### Step 1: Clone or Navigate to Project

```bash
cd D:\Projects\split-it
```

### Step 2: Install Dependencies

All dependencies are already installed, but if you need to reinstall:

```bash
npm install
```

### Step 3: Start Development Server

```bash
npm start
```

The application will open in your browser at `http://localhost:3000`

## 📦 Installed Packages

### Core Dependencies
- **react** (^18.x): JavaScript library for building user interfaces
- **react-dom** (^18.x): React package for working with the DOM
- **react-router-dom** (^6.x): Declarative routing for React applications
- **react-scripts** (5.x): Scripts and configuration for Create React App

### Styling
- **tailwindcss** (^3.x): Utility-first CSS framework
- **postcss** (^8.x): Tool for transforming CSS with JavaScript
- **autoprefixer** (^10.x): PostCSS plugin to add vendor prefixes

## 📁 Project Structure

```
split-it/
├── public/                  # Static files
│   ├── index.html          # HTML template
│   ├── favicon.ico         # App icon
│   └── manifest.json       # PWA manifest
├── src/
│   ├── components/         # Reusable components
│   │   ├── Navbar.jsx     # Navigation component
│   │   └── PrivateRoute.jsx # Protected route wrapper
│   ├── pages/             # Page components
│   │   ├── Home.jsx       # Landing page
│   │   ├── Login.jsx      # Login page
│   │   ├── Register.jsx   # Registration page
│   │   └── Dashboard.jsx  # User dashboard
│   ├── context/           # Context API providers
│   │   ├── AuthContext.jsx    # Authentication state
│   │   └── ExpenseContext.jsx # Expense management state
│   ├── hooks/             # Custom React hooks (future)
│   ├── utils/             # Utility functions (future)
│   ├── data/              # Mock data & constants (future)
│   ├── App.js             # Main app component with routing
│   ├── index.js           # App entry point
│   └── index.css          # Global styles with Tailwind
├── package.json           # Project dependencies
├── tailwind.config.js     # Tailwind configuration
├── postcss.config.js      # PostCSS configuration
└── README.md             # This file
```

## 🎯 Key Files Explained

### `src/App.js`
Main application component that sets up routing and provides context to all child components.

### `src/context/AuthContext.jsx`
- Manages user authentication state
- Provides login, logout, and register functions
- Persists user session in localStorage
- Usage: `const { user, login, logout, isAuthenticated } = useAuth();`

### `src/context/ExpenseContext.jsx`
- Manages expenses and groups
- Provides CRUD operations for expenses and groups
- Persists data in localStorage
- Usage: `const { expenses, addExpense, groups, addGroup } = useExpense();`

### `src/components/PrivateRoute.jsx`
Protects routes that require authentication. Redirects to login if user is not authenticated.

### `src/components/Navbar.jsx`
Responsive navigation bar that changes based on authentication status.

### Documentation
- [React Documentation](https://react.dev/) - Official React docs
- [React Router](https://reactrouter.com/) - Client-side routing
- [Express.js](https://expressjs.com/) - Backend framework
- [MongoDB Documentation](https://docs.mongodb.com/) - Database
- [Mongoose](https://mongoosejs.com/) - MongoDB ODM
- [Tailwind CSS](https://tailwindcss.com/docs) - Utility-first CSS
- [shadcn/ui](https://ui.shadcn.com/) - UI component library

### Tutorials
- [JWT Authentication](https://jwt.io/introduction) - Understanding JWT
- [RESTful API Design](https://restfulapi.net/) - API best practices
- [React Context API](https://react.dev/reference/react/useContext) - State management
- [Mongoose Schemas](https://mongoosejs.com/docs/guide.html) - Data modeling

### Tools
- [Postman](https://www.postman.com/) - API testing
- [MongoDB Compass](https://www.mongodb.com/products/compass) - Database GUI
- [React DevTools](https://react.dev/learn/react-developer-tools) - Browser extension

## 🚀 Deployment

### Frontend (Vercel/Netlify)

**Vercel:**
```bash
npm install -g vercel
vercel login
vercel
```

**Netlify:**
```bash
npm run build
# Drag and drop the build/ folder to Netlify
```

Environment variables needed:
- `REACT_APP_API_URL` (your production API URL)
- `REACT_APP_GOOGLE_CLIENT_ID`

### Backend (Render/Railway/Heroku)

**Render:**
1. Connect your GitHub repo
2. Select "Web Service"
3. Build command: `cd server && npm install`
4. Start command: `cd server && npm start`
5. Add environment variables

**Railway:**
```bash
npm install -g railway
railway login
cd server
railway up
```

Environment variables needed:
- `MONGODB_URI`
- `JWT_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SERVER_URL` (your production backend URL)
- `CLIENT_URL` (your production frontend URL)

## 🎯 Roadmap & Future Features

### Version 2.0 (Planned)
- [ ] Real-time updates with WebSockets
- [ ] Push notifications
- [ ] Receipt scanning with OCR
- [ ] Multiple receipt uploads per expense
- [ ] Email notifications
- [ ] Recurring expenses
- [ ] Budget limits per group
- [ ] Expense categories with custom icons
- [ ] Dark mode toggle
- [ ] Mobile apps (React Native)

### Version 2.1 (Future)
- [ ] Integration with payment apps (PayPal, Venmo, UPI)
- [ ] Split by items (restaurant bills)
- [ ] Geolocation for expenses
- [ ] Export to accounting software
- [ ] Multi-language support
- [ ] Voice input for expenses
- [ ] AI-powered expense categorization

## 👨‍💻 Development Tips

### Best Practices
1. **Component Structure**: Keep components small and focused on a single responsibility
2. **Naming Conventions**: Use descriptive names (PascalCase for components, camelCase for functions)
3. **State Management**: Lift state up when needed, use Context for global state
4. **Error Handling**: Always handle errors gracefully with try-catch and user feedback
5. **Code Comments**: Comment complex logic, not obvious code
6. **Git Commits**: Commit often with meaningful messages ("Add expense form" not "update")
7. **Testing**: Test features manually before considering them complete
8. **Environment Variables**: Never commit sensitive data to Git

### Git Workflow
```bash
# Create a feature branch
git checkout -b feature/receipt-upload

# Make changes and commit
git add .
git commit -m "Add receipt upload functionality"

# Push to remote
git push origin feature/receipt-upload

# Merge to main after review
git checkout main
git merge feature/receipt-upload
```

### Code Style
```javascript
// Good - descriptive names, clear structure
const handleExpenseSubmit = async (expenseData) => {
  try {
    const response = await apiClient.post('/expenses', expenseData);
    toast.success('Expense added successfully');
    return response;
  } catch (error) {
    toast.error(error.message);
    throw error;
  }
};

// Bad - unclear names, no error handling
const submit = (data) => {
  apiClient.post('/expenses', data);
};
```

## 🙏 Acknowledgments

- [shadcn/ui](https://ui.shadcn.com/) for beautiful React components
- [Lucide](https://lucide.dev/) for the icon library
- [Recharts](https://recharts.org/) for data visualization
- [Tailwind CSS](https://tailwindcss.com/) for the styling framework
- All open-source contributors

---

**Made with ❤️ for learning and sharing expenses with friends**

Happy Coding! 🚀
✅ **Modern Tech Stack**: Uses current industry-standard tools
✅ **Scalable**: Easy to add new features incrementally
✅ **Well Documented**: Clear code comments and this README
✅ **Demo Ready**: Working authentication and routing out of the box
✅ **Presentation Friendly**: Professional UI with Tailwind CSS
✅ **Learning Focused**: Demonstrates Context API, routing, and component composition

## 🐛 Troubleshooting

### Port Already in Use
If port 3000 is busy:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or set a different port
set PORT=3001 && npm start
```

### Tailwind Styles Not Working
Ensure `index.css` has Tailwind directives:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### React Router Not Working
Make sure you're using `Link` from react-router-dom instead of `<a>` tags:
```jsx
import { Link } from 'react-router-dom';
<Link to="/dashboard">Dashboard</Link>
```

## 📚 Learning Resources

- **React Documentation**: https://react.dev/
- **React Router**: https://reactrouter.com/
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Context API**: https://react.dev/reference/react/useContext
- **Create React App**: https://create-react-app.dev/

## 🤝 Contributing

This is a college project template. Feel free to:
1. Fork the project
2. Create feature branches
3. Experiment with new features
4. Document your changes

## 📄 License

This project is open source and available for educational purposes.

## 👨‍💻 Development Tips

### Best Practices
1. **Keep components small**: Each component should have a single responsibility
2. **Use meaningful names**: Component and variable names should be descriptive
3. **Comment complex logic**: Help others (and future you) understand the code
4. **Test as you build**: Check each feature works before moving to the next
5. **Commit often**: Use git to save progress regularly

### Git Commands
```bash
# Initialize git (already done)
git init

# Create a new branch for a feature
git checkout -b feature/expense-form

# Save your changes
git add .
git commit -m "Add expense creation form"

# Push to remote repository
git push origin feature/expense-form
```

## 🎉 Getting Started with Development

Now that your environment is set up, here's what to build next:

1. **Expense Form Component**: Create a form to add new expenses
2. **Group Management Pages**: Pages to create and view groups
3. **Balance Calculation**: Implement the splitting algorithm
4. **User Profile Page**: Let users update their information
5. **Expense Detail View**: Show full details of individual expenses

Happy Coding! 🚀


### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
