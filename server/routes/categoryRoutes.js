import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import CustomCategory from '../models/CustomCategory.js';

const router = express.Router();

// Default categories that come with the app
const defaultCategories = [
  { id: 'food', name: 'Food & Drinks', icon: 'Utensils', color: 'text-orange-500' },
  { id: 'travel', name: 'Travel', icon: 'Plane', color: 'text-blue-500' },
  { id: 'entertainment', name: 'Entertainment', icon: 'Film', color: 'text-purple-500' },
  { id: 'shopping', name: 'Shopping', icon: 'ShoppingBag', color: 'text-pink-500' },
  { id: 'housing', name: 'Housing', icon: 'Home', color: 'text-green-500' },
  { id: 'transport', name: 'Transport', icon: 'Car', color: 'text-yellow-500' },
  { id: 'healthcare', name: 'Healthcare', icon: 'Heart', color: 'text-red-500' },
  { id: 'utilities', name: 'Utilities', icon: 'Zap', color: 'text-cyan-500' },
  { id: 'other', name: 'Other', icon: 'Receipt', color: 'text-muted-foreground' },
];

// Available icons for custom categories
const availableIcons = [
  'Utensils', 'Plane', 'Film', 'ShoppingBag', 'Home', 'Car', 'Heart', 'Zap', 
  'Receipt', 'Coffee', 'Gift', 'Gamepad2', 'Music', 'Book', 'Dumbbell', 
  'Briefcase', 'GraduationCap', 'Baby', 'PawPrint', 'Shirt', 'Scissors',
  'Wifi', 'Phone', 'Tv', 'Camera', 'Palette', 'Wrench', 'Sparkles',
  'PartyPopper', 'Cake', 'Beer', 'Wine', 'Pizza', 'Salad', 'IceCream',
  'Bus', 'Train', 'Bike', 'Fuel', 'ParkingCircle', 'Landmark', 'Building',
  'TreeDeciduous', 'Umbrella', 'Glasses', 'Watch', 'Gem', 'Banknote', 'Tag',
];

// Available colors
const availableColors = [
  'text-red-500', 'text-orange-500', 'text-amber-500', 'text-yellow-500',
  'text-lime-500', 'text-green-500', 'text-emerald-500', 'text-teal-500',
  'text-cyan-500', 'text-sky-500', 'text-blue-500', 'text-indigo-500',
  'text-violet-500', 'text-purple-500', 'text-fuchsia-500', 'text-pink-500',
  'text-rose-500', 'text-slate-500', 'text-gray-500',
];

// Get all categories for user (default + custom)
router.get('/', protect, async (req, res) => {
  try {
    const customCategories = await CustomCategory.find({ 
      userId: req.user._id 
    }).sort({ name: 1 });

    // Merge default and custom categories
    const customCategoriesFormatted = customCategories.map(cat => ({
      id: cat._id.toString(),
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      isCustom: true,
      groupId: cat.groupId,
    }));

    res.json({
      default: defaultCategories,
      custom: customCategoriesFormatted,
      all: [...defaultCategories, ...customCategoriesFormatted],
      availableIcons,
      availableColors,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create custom category
router.post('/', protect, async (req, res) => {
  try {
    const { name, icon, color, groupId } = req.body;

    // Check if category with same name exists
    const existing = await CustomCategory.findOne({ 
      userId: req.user._id, 
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    if (existing) {
      return res.status(400).json({ message: 'Category with this name already exists' });
    }

    const category = new CustomCategory({
      userId: req.user._id,
      name,
      icon: icon || 'Tag',
      color: color || 'text-gray-500',
      groupId,
    });

    await category.save();

    res.status(201).json({
      id: category._id.toString(),
      name: category.name,
      icon: category.icon,
      color: category.color,
      isCustom: true,
      groupId: category.groupId,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update custom category
router.put('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, color } = req.body;

    const category = await CustomCategory.findOne({ 
      _id: id, 
      userId: req.user._id 
    });

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    if (name) category.name = name;
    if (icon) category.icon = icon;
    if (color) category.color = color;

    await category.save();

    res.json({
      id: category._id.toString(),
      name: category.name,
      icon: category.icon,
      color: category.color,
      isCustom: true,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete custom category
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;

    const category = await CustomCategory.findOneAndDelete({ 
      _id: id, 
      userId: req.user._id 
    });

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({ message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
