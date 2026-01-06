import { 
  Utensils, 
  Plane, 
  Film, 
  ShoppingBag, 
  Home, 
  Car, 
  Heart, 
  Zap,
  Receipt
} from 'lucide-react';

export const categories = [
  { id: 'food', name: 'Food & Drinks', icon: Utensils, color: 'text-orange-500' },
  { id: 'travel', name: 'Travel', icon: Plane, color: 'text-blue-500' },
  { id: 'entertainment', name: 'Entertainment', icon: Film, color: 'text-purple-500' },
  { id: 'shopping', name: 'Shopping', icon: ShoppingBag, color: 'text-pink-500' },
  { id: 'housing', name: 'Housing', icon: Home, color: 'text-green-500' },
  { id: 'transport', name: 'Transport', icon: Car, color: 'text-yellow-500' },
  { id: 'healthcare', name: 'Healthcare', icon: Heart, color: 'text-red-500' },
  { id: 'utilities', name: 'Utilities', icon: Zap, color: 'text-cyan-500' },
  { id: 'other', name: 'Other', icon: Receipt, color: 'text-muted-foreground' },
];

export const getCategoryById = (categoryId) => {
  return categories.find(c => c.id === categoryId) || categories[categories.length - 1];
};
