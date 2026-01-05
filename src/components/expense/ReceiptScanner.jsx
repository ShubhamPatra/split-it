import React, { useState, useRef, useCallback } from 'react';
import { createWorker } from 'tesseract.js';
import { Camera, Upload, Loader2, X, Check, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { useToast } from '../../hooks/use-toast';

const ReceiptScanner = ({ onScanComplete, isOpen, onClose }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewImage, setPreviewImage] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  // Parse extracted text to find amount and description
  const parseReceiptText = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    
    // Common patterns for total amount
    const totalPatterns = [
      /total[:\s]*[\$₹€£]?\s*([\d,]+\.?\d*)/i,
      /grand\s*total[:\s]*[\$₹€£]?\s*([\d,]+\.?\d*)/i,
      /amount[:\s]*[\$₹€£]?\s*([\d,]+\.?\d*)/i,
      /subtotal[:\s]*[\$₹€£]?\s*([\d,]+\.?\d*)/i,
      /net\s*amount[:\s]*[\$₹€£]?\s*([\d,]+\.?\d*)/i,
      /[\$₹€£]\s*([\d,]+\.?\d*)/,
      /rs\.?\s*([\d,]+\.?\d*)/i,
      /inr\s*([\d,]+\.?\d*)/i,
    ];

    let amount = null;
    let description = '';
    let merchant = '';

    // Try to find amount
    for (const pattern of totalPatterns) {
      for (const line of lines) {
        const match = line.match(pattern);
        if (match) {
          const parsedAmount = parseFloat(match[1].replace(/,/g, ''));
          if (parsedAmount > 0 && (!amount || parsedAmount > amount)) {
            amount = parsedAmount;
          }
        }
      }
      if (amount) break;
    }

    // Try to find merchant/store name (usually first few lines)
    const merchantPatterns = [
      /^([A-Z][A-Za-z\s&]+)$/,
      /store[:\s]*(.+)/i,
      /merchant[:\s]*(.+)/i,
    ];

    for (const line of lines.slice(0, 5)) {
      if (line.length > 3 && line.length < 50) {
        const cleaned = line.trim();
        if (/^[A-Za-z\s&\-']+$/.test(cleaned) && cleaned.length > 3) {
          merchant = cleaned;
          break;
        }
      }
    }

    // Generate description
    if (merchant) {
      description = `Purchase at ${merchant}`;
    } else {
      description = 'Receipt expense';
    }

    // Find date
    const datePatterns = [
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
      /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i,
    ];

    let date = null;
    for (const pattern of datePatterns) {
      for (const line of lines) {
        const match = line.match(pattern);
        if (match) {
          date = match[1];
          break;
        }
      }
      if (date) break;
    }

    return {
      amount,
      description,
      merchant,
      date,
      rawText: text,
    };
  };

  // Process image with OCR
  const processImage = useCallback(async (imageData) => {
    setIsProcessing(true);
    setProgress(0);
    setExtractedData(null);

    try {
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      const { data: { text } } = await worker.recognize(imageData);
      await worker.terminate();

      const parsed = parseReceiptText(text);
      setExtractedData(parsed);

      if (!parsed.amount) {
        toast({
          title: 'Could not detect amount',
          description: 'Please enter the amount manually.',
          variant: 'warning',
        });
      }
    } catch (error) {
      console.error('OCR Error:', error);
      toast({
        title: 'Scan failed',
        description: 'Could not process the receipt. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  // Handle file selection
  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file',
        description: 'Please select an image file.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image under 10MB.',
        variant: 'destructive',
      });
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = async (e) => {
      setPreviewImage(e.target.result);
      await processImage(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Handle confirm
  const handleConfirm = () => {
    if (extractedData) {
      onScanComplete({
        ...extractedData,
        receiptImage: previewImage,
      });
      handleClose();
    }
  };

  // Handle close
  const handleClose = () => {
    setPreviewImage(null);
    setExtractedData(null);
    setProgress(0);
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera size={20} />
            Scan Receipt
          </DialogTitle>
          <DialogDescription>
            Upload a receipt image to automatically extract expense details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload Area */}
          {!previewImage ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors"
            >
              <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Click to upload receipt</p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports JPG, PNG, HEIC (max 10MB)
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Preview */}
              <div className="relative rounded-lg overflow-hidden bg-muted">
                <img
                  src={previewImage}
                  alt="Receipt preview"
                  className="w-full max-h-48 object-contain"
                />
                {!isProcessing && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 bg-background/80"
                    onClick={() => {
                      setPreviewImage(null);
                      setExtractedData(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                  >
                    <X size={16} />
                  </Button>
                )}
              </div>

              {/* Processing */}
              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing receipt... {progress}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Extracted Data */}
              {extractedData && !isProcessing && (
                <div className="space-y-3 p-4 bg-accent/50 rounded-lg">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Check className="h-4 w-4 text-success" />
                    Extracted Information
                  </h4>
                  
                  <div className="space-y-2 text-sm">
                    {extractedData.amount ? (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount:</span>
                        <span className="font-medium">₹{extractedData.amount.toFixed(2)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-warning">
                        <AlertCircle size={14} />
                        <span>Could not detect amount</span>
                      </div>
                    )}
                    
                    {extractedData.merchant && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Merchant:</span>
                        <span className="font-medium">{extractedData.merchant}</span>
                      </div>
                    )}
                    
                    {extractedData.date && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Date:</span>
                        <span className="font-medium">{extractedData.date}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            {extractedData && (
              <Button onClick={handleConfirm} className="flex-1">
                Use This Data
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReceiptScanner;
