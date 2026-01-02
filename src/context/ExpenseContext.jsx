import React, { createContext, useState, useContext, useEffect } from 'react';

// Create the Expense Context
const ExpenseContext = createContext();

// Custom hook to use the Expense Context
export const useExpense = () => {
  const context = useContext(ExpenseContext);
  if (!context) {
    throw new Error('useExpense must be used within an ExpenseProvider');
  }
  return context;
};

// Expense Provider Component
export const ExpenseProvider = ({ children }) => {
  const [expenses, setExpenses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load expenses from localStorage on mount
  useEffect(() => {
    const storedExpenses = localStorage.getItem('expenses');
    const storedGroups = localStorage.getItem('groups');
    
    if (storedExpenses) {
      setExpenses(JSON.parse(storedExpenses));
    }
    if (storedGroups) {
      setGroups(JSON.parse(storedGroups));
    }
  }, []);

  // Save expenses to localStorage whenever they change
  useEffect(() => {
    if (expenses.length > 0) {
      localStorage.setItem('expenses', JSON.stringify(expenses));
    }
  }, [expenses]);

  // Save groups to localStorage whenever they change
  useEffect(() => {
    if (groups.length > 0) {
      localStorage.setItem('groups', JSON.stringify(groups));
    }
  }, [groups]);

  // Add a new expense
  const addExpense = (expense) => {
    const newExpense = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      ...expense,
    };
    setExpenses([...expenses, newExpense]);
  };

  // Update an expense
  const updateExpense = (id, updatedExpense) => {
    setExpenses(expenses.map(exp => 
      exp.id === id ? { ...exp, ...updatedExpense } : exp
    ));
  };

  // Delete an expense
  const deleteExpense = (id) => {
    setExpenses(expenses.filter(exp => exp.id !== id));
  };

  // Add a new group
  const addGroup = (group) => {
    const newGroup = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      ...group,
    };
    setGroups([...groups, newGroup]);
  };

  // Update a group
  const updateGroup = (id, updatedGroup) => {
    setGroups(groups.map(grp => 
      grp.id === id ? { ...grp, ...updatedGroup } : grp
    ));
  };

  // Delete a group
  const deleteGroup = (id) => {
    setGroups(groups.filter(grp => grp.id !== id));
  };

  // Calculate balances for a group
  const calculateBalances = (groupId) => {
    const groupExpenses = expenses.filter(exp => exp.groupId === groupId);
    // This is a placeholder - implement the splitting algorithm later
    return {};
  };

  const value = {
    expenses,
    groups,
    loading,
    addExpense,
    updateExpense,
    deleteExpense,
    addGroup,
    updateGroup,
    deleteGroup,
    calculateBalances,
  };

  return (
    <ExpenseContext.Provider value={value}>
      {children}
    </ExpenseContext.Provider>
  );
};
