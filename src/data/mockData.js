// Mock data for demo purposes
export const mockData = {
  users: [
    { id: '1', name: 'John Doe', email: 'john@example.com' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
    { id: '3', name: 'Bob Wilson', email: 'bob@example.com' },
    { id: '4', name: 'Alice Johnson', email: 'alice@example.com' }
  ],
  groups: [],
  expenses: [],
  settlements: []
};

export const getUserName = (userId) => {
  const user = mockData.users.find(u => u.id === userId);
  return user ? user.name : 'User';
};

export const getUser = (userId) => {
  return mockData.users.find(u => u.id === userId) || {
    id: userId,
    name: 'User',
    email: 'user@example.com'
  };
};

// Aliases for compatibility
export const mockUsers = mockData.users;
export const users = mockData.users;
export const mockGroups = mockData.groups;
export const mockExpenses = mockData.expenses;

