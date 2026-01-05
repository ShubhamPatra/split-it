import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { useToast } from '../../hooks/use-toast';

const MultipleReceiptUpload = ({ receipts = [], onChange, maxFiles = 5 }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  // Convert file to base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle file selection
  const handleFiles = async (files) => {
    const validFiles = [];
    
    for (const file of files) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid file type',
          description: `${file.name} is not an image file.`,
          variant: 'destructive',
        });
        continue;
      }

      // Validate file size (max 5MB per file)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: `${file.name} exceeds 5MB limit.`,
          variant: 'destructive',
        });
        continue;
      }

      validFiles.push(file);
    }

    // Check total files limit
    if (receipts.length + validFiles.length > maxFiles) {
      toast({
        title: 'Too many files',
        description: `You can only upload up to ${maxFiles} receipts.`,
        variant: 'destructive',
      });
      validFiles.splice(maxFiles - receipts.length);
    }

    // Convert to base64 and add to receipts
    const newReceipts = await Promise.all(
      validFiles.map(async (file) => ({
        id: `receipt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        data: await fileToBase64(file),
        uploadedAt: new Date().toISOString(),
      }))
    );

    onChange([...receipts, ...newReceipts]);
  };

  // Handle drag events
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  // Handle file input change
  const handleInputChange = (e) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove a receipt
  const removeReceipt = (id) => {
    onChange(receipts.filter(r => r.id !== id));
  };

  // Format file size
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onClick={() => receipts.length < maxFiles && fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer
          ${isDragging 
            ? 'border-primary bg-primary/10' 
            : 'border-border hover:border-primary hover:bg-accent/50'
          }
          ${receipts.length >= maxFiles ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm font-medium">
          {receipts.length >= maxFiles
            ? `Maximum ${maxFiles} receipts reached`
            : 'Drop receipt images here or click to upload'
          }
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {receipts.length} / {maxFiles} receipts • Max 5MB each
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleInputChange}
        className="hidden"
      />

      {/* Receipt previews */}
      {receipts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {receipts.map((receipt) => (
            <div
              key={receipt.id}
              className="relative group rounded-lg overflow-hidden border border-border bg-muted"
            >
              <img
                src={receipt.data}
                alt={receipt.name}
                className="w-full h-24 object-cover"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeReceipt(receipt.id);
                  }}
                >
                  <X size={16} />
                </Button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                <p className="text-white text-xs truncate">{receipt.name}</p>
                <p className="text-white/70 text-xs">{formatSize(receipt.size)}</p>
              </div>
            </div>
          ))}
          
          {/* Add more button */}
          {receipts.length < maxFiles && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors"
            >
              <Plus className="h-6 w-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground mt-1">Add more</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MultipleReceiptUpload;
