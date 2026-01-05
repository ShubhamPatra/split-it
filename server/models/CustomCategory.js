import mongoose from 'mongoose';

const customCategorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    maxlength: 30,
  },
  icon: {
    type: String,
    required: true,
    // Icon name from lucide-react
    default: 'Tag',
  },
  color: {
    type: String,
    required: true,
    default: 'text-gray-500',
  },
  // Optional: group-specific category
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Compound index for user's categories
customCategorySchema.index({ userId: 1, name: 1 }, { unique: true });
customCategorySchema.index({ groupId: 1 });

const CustomCategory = mongoose.model('CustomCategory', customCategorySchema);

export default CustomCategory;
