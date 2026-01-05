import React, { useState, useEffect } from 'react';
import { Plus, Tag, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { categories, iconMap, availableColors, getIconByName } from '../../data/categories';
import { useToast } from '../../hooks/use-toast';
import apiClient from '../../lib/apiClient';

const CategoryPicker = ({ value, onChange, showCustom = true }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customCategories, setCustomCategories] = useState([]);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newCategory, setNewCategory] = useState({
    name: '',
    icon: 'Tag',
    color: 'text-gray-500',
  });
  const { toast } = useToast();

  const allCategories = [...categories, ...customCategories];
  const selectedCategory = allCategories.find(c => c.id === value) || categories[categories.length - 1];
  const SelectedIcon = selectedCategory.icon || getIconByName(selectedCategory.iconName);

  // Load custom categories
  useEffect(() => {
    const loadCustomCategories = async () => {
      try {
        const data = await apiClient.get('/categories');
        setCustomCategories(data.custom.map(c => ({
          ...c,
          icon: getIconByName(c.icon),
        })));
      } catch (error) {
        console.error('Error loading custom categories:', error);
      }
    };
    
    if (showCustom) {
      loadCustomCategories();
    }
  }, [showCustom]);

  // Create custom category
  const handleCreateCategory = async () => {
    if (!newCategory.name.trim()) return;

    try {
      const created = await apiClient.post('/categories', newCategory);
      
      setCustomCategories([
        ...customCategories,
        {
          ...created,
          icon: getIconByName(created.icon),
        },
      ]);
      
      onChange(created.id);
      setShowCreateNew(false);
      setNewCategory({ name: '', icon: 'Tag', color: 'text-gray-500' });
      setIsOpen(false);
      
      toast({
        title: 'Category created',
        description: `Added "${created.name}" to your categories`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create category',
        variant: 'destructive',
      });
    }
  };

  // Icon selector component
  const IconGrid = () => {
    const iconNames = Object.keys(iconMap);
    return (
      <div className="grid grid-cols-8 gap-1 max-h-32 overflow-y-auto p-2 border rounded-lg">
        {iconNames.map((iconName) => {
          const Icon = iconMap[iconName];
          return (
            <button
              key={iconName}
              type="button"
              onClick={() => setNewCategory({ ...newCategory, icon: iconName })}
              className={`p-2 rounded hover:bg-accent transition-colors ${
                newCategory.icon === iconName ? 'bg-primary text-primary-foreground' : ''
              }`}
            >
              <Icon size={16} />
            </button>
          );
        })}
      </div>
    );
  };

  // Color selector component
  const ColorGrid = () => (
    <div className="grid grid-cols-8 gap-1 p-2 border rounded-lg">
      {availableColors.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => setNewCategory({ ...newCategory, color })}
          className={`p-2 rounded hover:bg-accent transition-colors ${
            newCategory.color === color ? 'ring-2 ring-primary' : ''
          }`}
        >
          <div className={`w-4 h-4 rounded-full ${color.replace('text-', 'bg-')}`} />
        </button>
      ))}
    </div>
  );

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="w-full justify-start gap-2"
      >
        <div className={`p-1 rounded ${selectedCategory.color}`}>
          <SelectedIcon size={16} />
        </div>
        {selectedCategory.name}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Category</DialogTitle>
          </DialogHeader>

          {showCreateNew ? (
            <div className="space-y-4">
              <div>
                <Label>Category Name</Label>
                <Input
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  placeholder="e.g., Subscriptions"
                  maxLength={30}
                />
              </div>

              <div>
                <Label>Icon</Label>
                <IconGrid />
              </div>

              <div>
                <Label>Color</Label>
                <ColorGrid />
              </div>

              {/* Preview */}
              <div className="flex items-center gap-2 p-3 bg-accent rounded-lg">
                <div className={`p-2 rounded-lg bg-background ${newCategory.color}`}>
                  {React.createElement(getIconByName(newCategory.icon), { size: 20 })}
                </div>
                <span className="font-medium">{newCategory.name || 'Preview'}</span>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowCreateNew(false)} className="flex-1">
                  Back
                </Button>
                <Button 
                  onClick={handleCreateCategory} 
                  className="flex-1"
                  disabled={!newCategory.name.trim()}
                >
                  Create Category
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Default Categories */}
              <div>
                <Label className="text-xs text-muted-foreground uppercase mb-2 block">
                  Default Categories
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = value === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          onChange(cat.id);
                          setIsOpen(false);
                        }}
                        className={`flex items-center gap-2 p-3 rounded-lg border transition-colors text-left
                          ${isSelected 
                            ? 'border-primary bg-primary/10' 
                            : 'border-border hover:border-primary/50 hover:bg-accent'
                          }`}
                      >
                        <div className={`p-1.5 rounded ${cat.color} bg-accent`}>
                          <Icon size={16} />
                        </div>
                        <span className="text-sm font-medium truncate">{cat.name}</span>
                        {isSelected && <Check size={14} className="ml-auto text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Categories */}
              {customCategories.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground uppercase mb-2 block">
                    Custom Categories
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {customCategories.map((cat) => {
                      const Icon = cat.icon || getIconByName(cat.iconName || 'Tag');
                      const isSelected = value === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => {
                            onChange(cat.id);
                            setIsOpen(false);
                          }}
                          className={`flex items-center gap-2 p-3 rounded-lg border transition-colors text-left
                            ${isSelected 
                              ? 'border-primary bg-primary/10' 
                              : 'border-border hover:border-primary/50 hover:bg-accent'
                            }`}
                        >
                          <div className={`p-1.5 rounded ${cat.color} bg-accent`}>
                            <Icon size={16} />
                          </div>
                          <span className="text-sm font-medium truncate">{cat.name}</span>
                          {isSelected && <Check size={14} className="ml-auto text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Create New */}
              {showCustom && (
                <Button 
                  variant="outline" 
                  onClick={() => setShowCreateNew(true)}
                  className="w-full gap-2"
                >
                  <Plus size={16} />
                  Create Custom Category
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CategoryPicker;
