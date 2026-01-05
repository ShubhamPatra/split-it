import React, { useState, useRef } from 'react';
import Tesseract from 'tesseract.js';
import { Camera, Upload, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Progress } from '../ui/progress';
import { useToast } from '../../hooks/use-toast';

/**
 * BillScanner Component
 * 
 * Allows users to scan/upload bill images and extract expense details using OCR
 * Supports both file upload and camera capture
 * 
 * @param {function} onScanComplete - Callback when scan is complete with extracted data
 * @param {boolean} isOpen - Whether the scanner is open
 * @param {function} onClose - Callback to close the scanner
 */
const BillScanner = ({ onScanComplete, isOpen, onClose }) => {
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState(''); // 'idle', 'scanning', 'success', 'error'
  const [extractedData, setExtractedData] = useState(null);
  const [rawOcrText, setRawOcrText] = useState(''); // Store raw OCR text for debugging
  const [showRawText, setShowRawText] = useState(false); // Toggle to show raw text
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  /**
   * Handle image file selection
   */
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (PNG, JPG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setImage(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
    
    setScanStatus('idle');
    setExtractedData(null);
  };

  /**
   * Extract expense details from OCR text
   * Handles noisy OCR output with artifacts
   */
  const extractExpenseData = (text) => {
    console.log('=== RAW OCR TEXT ===');
    console.log(text);
    
    const data = {
      amount: null,
      date: null,
      merchantName: null,
      items: [],
      tax: null,
      tip: null,
      rawText: text
    };

    if (!text || text.trim().length < 10) {
      console.log('No meaningful text extracted');
      return data;
    }

    // STEP 1: Clean the text aggressively
    const cleanText = text
      .replace(/[=\-_|\\/<>'"~`!@#%^&*[\]{}]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log('=== CLEANED TEXT ===');
    console.log(cleanText);

    // STEP 2: Extract AMOUNT
    let amountMatch = cleanText.match(/grand\s*total[:\s]*(?:rs\.?)?[\s]*(\d+\.?\d*)/i);
    if (!amountMatch) {
      amountMatch = cleanText.match(/total[:\s]*(?:rs\.?)?[\s]*(\d{3,}\.?\d*)/i);
    }
    if (!amountMatch) {
      amountMatch = cleanText.match(/rs\.?\s*(\d{3,}\.?\d*)/i);
    }
    if (!amountMatch) {
      const allPrices = cleanText.match(/\d{3,}\.?\d*/g) || [];
      const validPrices = allPrices.map(p => parseFloat(p)).filter(p => p >= 100 && p <= 100000);
      if (validPrices.length > 0) {
        data.amount = Math.max(...validPrices);
      }
    }
    
    if (amountMatch) {
      data.amount = parseFloat(amountMatch[1]);
    }
    console.log('Amount:', data.amount);

    // STEP 3: Extract DATE
    const dateMatch = cleanText.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
    if (dateMatch) {
      data.date = parseDate(dateMatch[1]);
      console.log('Date:', data.date);
    }

    // STEP 4: Extract MERCHANT NAME
    const merchantMatch = cleanText.match(/([A-Za-z]+\s*RESTAURANT|[A-Za-z]+\s*HOTEL|[A-Za-z]+\s*CAFE)/i);
    if (merchantMatch) {
      data.merchantName = merchantMatch[1].trim();
      console.log('Merchant:', data.merchantName);
    }

    // STEP 5: Extract ITEMS - Line by line analysis
    const lines = text.split('\n');
    
    // Skip keywords - lines containing these are not items
    const skipPatterns = /total|cgst|sgst|tax|sub\s*total|grand|thank|visit|powered|qty|price|amt|item|date|table|section|cashier|bill\s*no|dine/i;
    
    for (const rawLine of lines) {
      // Clean the line
      const line = rawLine.replace(/[=\-_|\\/<>'"~`!@#%^&*[\]{}]+/g, ' ').trim();
      
      if (line.length < 5) continue;
      if (skipPatterns.test(line)) continue;
      
      // Look for pattern: text followed by numbers (qty, price, amount)
      // Pattern: "item name" + numbers like "2 139.00 278.00" or just "278.00"
      const numbers = line.match(/(\d+\.?\d*)/g);
      
      if (numbers && numbers.length >= 1) {
        // Get prices (numbers >= 10, likely prices not quantities)
        const prices = numbers.map(n => parseFloat(n)).filter(n => n >= 15 && n <= 10000);
        
        if (prices.length > 0) {
          // Last price is usually the total amount for the item
          const price = prices[prices.length - 1];
          
          // Extract item name - everything before the first number
          const firstNumIndex = line.search(/\d/);
          let itemName = firstNumIndex > 0 ? line.substring(0, firstNumIndex).trim() : '';
          
          // Clean up item name
          itemName = itemName
            .replace(/[^a-zA-Z\s()]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          // Skip if name is too short or looks like noise
          if (itemName.length < 3) continue;
          if (/^[A-Z\s]{1,3}$/.test(itemName)) continue; // Skip single letters/short caps
          
          // Check it's not a duplicate (same price within last few items)
          const isDuplicate = data.items.some(i => 
            Math.abs(i.price - price) < 0.01 || 
            i.name.toLowerCase() === itemName.toLowerCase()
          );
          
          if (!isDuplicate) {
            // Capitalize first letter of each word
            itemName = itemName.split(' ')
              .filter(w => w.length > 0)
              .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(' ');
            
            console.log('Item found:', itemName, '- ₹' + price);
            data.items.push({ name: itemName, price: price });
          }
        }
      }
    }

    console.log('=== EXTRACTED DATA ===');
    console.log('Items count:', data.items.length);
    console.log(data);
    
    return data;
  };

  /**
   * Parse date string to YYYY-MM-DD format
   */
  const parseDate = (dateStr) => {
    try {
      // Try DD/MM/YY or DD/MM/YYYY format first (common in India)
      const parts = dateStr.split(/[/\-.]/);
      if (parts.length === 3) {
        let day = parts[0];
        let month = parts[1];
        let year = parts[2];

        // Handle 2-digit year
        if (year.length === 2) {
          year = '20' + year;
        }

        // Pad day and month
        day = day.padStart(2, '0');
        month = month.padStart(2, '0');

        const testDate = new Date(`${year}-${month}-${day}`);
        if (!isNaN(testDate.getTime())) {
          return `${year}-${month}-${day}`;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  };

  /**
   * Perform OCR on the uploaded image
   */
  const scanImage = async () => {
    if (!image) {
      toast({
        title: "No image selected",
        description: "Please upload an image first",
        variant: "destructive",
      });
      return;
    }

    setIsScanning(true);
    setScanStatus('scanning');
    setScanProgress(0);
    setRawOcrText('');

    try {
      // Use imagePreview (base64) for better compatibility
      const imageSource = imagePreview || image;
      
      console.log('Starting OCR scan...');
      
      const result = await Tesseract.recognize(
        imageSource,
        'eng',
        {
          logger: (m) => {
            console.log('Tesseract status:', m.status, m.progress);
            if (m.status === 'recognizing text') {
              setScanProgress(Math.round(m.progress * 100));
            }
          },
        }
      );

      const text = result.data.text;
      console.log('=== RAW OCR OUTPUT ===');
      console.log(text);
      console.log('=== END OCR OUTPUT ===');
      
      setRawOcrText(text); // Store for display
      
      if (!text || text.trim().length < 5) {
        toast({
          title: "No text detected",
          description: "Could not read any text from the image. Try a clearer image.",
          variant: "destructive",
        });
        setScanStatus('error');
        return;
      }
      
      const extracted = extractExpenseData(text);
      console.log('Extracted Data:', extracted);
      
      setExtractedData(extracted);
      setScanStatus('success');
      
      if (!extracted.amount && !extracted.date && !extracted.merchantName && extracted.items.length === 0) {
        toast({
          title: "Text found but no data extracted",
          description: "OCR found text but couldn't parse it. Click 'Show Raw Text' to see what was detected.",
        });
      } else {
        toast({
          title: "Scan successful!",
          description: `Extracted ${[
            extracted.amount ? 'amount' : null,
            extracted.date ? 'date' : null,
            extracted.merchantName ? 'merchant' : null,
            extracted.items.length > 0 ? `${extracted.items.length} items` : null
          ].filter(Boolean).join(', ')}`,
        });
      }

    } catch (error) {
      console.error('OCR Error:', error);
      setScanStatus('error');
      toast({
        title: "Scan failed",
        description: error.message || "Failed to scan the image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  /**
   * Use the extracted data
   */
  const handleUseData = () => {
    if (extractedData && onScanComplete) {
      onScanComplete({
        amount: extractedData.amount || '',
        date: extractedData.date || '',
        description: extractedData.merchantName || '',
        items: extractedData.items || [],
        tax: extractedData.tax || 0,
        tip: extractedData.tip || 0,
      });
      handleClose();
    }
  };

  /**
   * Reset the scanner
   */
  const handleClose = () => {
    setImage(null);
    setImagePreview(null);
    setIsScanning(false);
    setScanProgress(0);
    setScanStatus('idle');
    setExtractedData(null);
    setRawOcrText('');
    setShowRawText(false);
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4"
      onClick={handleClose}
    >
      <Card 
        className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {/* Header */}
          <div className="flex items-start justify-between mb-4 sm:mb-6 gap-2">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg sm:text-2xl font-bold text-foreground truncate">Scan Bill</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Upload a photo of your receipt to auto-fill expense details
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose} className="min-h-[44px] min-w-[44px] flex-shrink-0">
              <X size={20} />
            </Button>
          </div>

          {/* Upload Area */}
          {!imagePreview && (
            <div className="space-y-3 sm:space-y-4">
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 sm:p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mx-auto text-muted-foreground mb-3 sm:mb-4" size={40} />
                <h3 className="font-semibold text-sm sm:text-base text-foreground mb-2">
                  Upload Bill Image
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                  Click to browse or drag and drop
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  Supports: PNG, JPG, JPEG (Max 5MB)
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <Button
                  variant="outline"
                  className="flex-1 min-h-[44px] text-sm sm:text-base"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={18} className="mr-2" />
                  Choose File
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 min-h-[44px] text-sm sm:text-base"
                  onClick={() => {
                    fileInputRef.current?.setAttribute('capture', 'environment');
                    fileInputRef.current?.click();
                  }}
                >
                  <Camera size={18} className="mr-2" />
                  Take Photo
                </Button>
              </div>
            </div>
          )}

          {/* Image Preview & Scan */}
          {imagePreview && (
            <div className="space-y-3 sm:space-y-4">
              {/* Preview */}
              <div className="relative rounded-lg overflow-hidden border border-border">
                <img
                  src={imagePreview}
                  alt="Bill preview"
                  className="w-full h-auto max-h-64 sm:max-h-96 object-contain bg-muted"
                />
              </div>

              {/* Scan Progress */}
              {isScanning && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-muted-foreground">Scanning bill...</span>
                    <span className="font-medium">{scanProgress}%</span>
                  </div>
                  <Progress value={scanProgress} className="h-2" />
                </div>
              )}

              {/* Extracted Data */}
              {scanStatus === 'success' && extractedData && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-3 sm:pt-4 p-3 sm:p-4">
                    <div className="flex items-center gap-2 mb-2 sm:mb-3">
                      <CheckCircle size={18} className="text-primary flex-shrink-0" />
                      <h3 className="font-semibold text-sm sm:text-base text-foreground">Extracted Data</h3>
                    </div>
                    <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                      {extractedData.amount && (
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Total Amount:</span>
                          <span className="font-medium">₹{extractedData.amount}</span>
                        </div>
                      )}
                      {extractedData.date && (
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Date:</span>
                          <span className="font-medium">{extractedData.date}</span>
                        </div>
                      )}
                      {extractedData.merchantName && (
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Merchant:</span>
                          <span className="font-medium truncate">{extractedData.merchantName}</span>
                        </div>
                      )}
                      
                      {/* Items Found */}
                      {extractedData.items && extractedData.items.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-primary/20">
                          <div className="flex justify-between gap-2 mb-2">
                            <span className="text-muted-foreground font-medium">Items Found:</span>
                            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                              {extractedData.items.length} items
                            </span>
                          </div>
                          <div className="max-h-32 overflow-y-auto space-y-1">
                            {extractedData.items.slice(0, 5).map((item, index) => (
                              <div key={index} className="flex justify-between gap-2 text-xs bg-background/50 px-2 py-1 rounded">
                                <span className="truncate">{item.name}</span>
                                <span className="font-medium text-primary">₹{item.price.toFixed(2)}</span>
                              </div>
                            ))}
                            {extractedData.items.length > 5 && (
                              <div className="text-xs text-muted-foreground text-center py-1">
                                +{extractedData.items.length - 5} more items...
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Tax & Tip */}
                      {(extractedData.tax > 0 || extractedData.tip > 0) && (
                        <div className="mt-3 pt-3 border-t border-primary/20 space-y-1">
                          {extractedData.tax > 0 && (
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">Tax:</span>
                              <span className="font-medium">₹{extractedData.tax.toFixed(2)}</span>
                            </div>
                          )}
                          {extractedData.tip > 0 && (
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">Tip:</span>
                              <span className="font-medium">₹{extractedData.tip.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Itemized Split Hint */}
                    {extractedData.items && extractedData.items.length > 0 && (
                      <div className="mt-3 p-2 bg-primary/10 rounded-lg">
                        <p className="text-xs text-primary">
                          💡 Items detected! You can use "Split by Items" to assign individual items to specific people.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Error State */}
              {scanStatus === 'error' && (
                <Card className="bg-destructive/5 border-destructive/20">
                  <CardContent className="pt-3 sm:pt-4 p-3 sm:p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={18} className="text-destructive flex-shrink-0 mt-0.5" />
                      <p className="text-xs sm:text-sm text-foreground">
                        Could not extract data. Please try another image or enter manually.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Raw OCR Text (for debugging) */}
              {rawOcrText && (scanStatus === 'success' || scanStatus === 'error') && (
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    onClick={() => setShowRawText(!showRawText)}
                  >
                    {showRawText ? 'Hide' : 'Show'} Raw OCR Text (Debug)
                  </Button>
                  {showRawText && (
                    <Card className="bg-muted/50">
                      <CardContent className="pt-3 p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Raw text detected by OCR:</p>
                        <pre className="text-xs whitespace-pre-wrap break-words max-h-48 overflow-y-auto bg-background p-2 rounded border">
                          {rawOcrText || 'No text detected'}
                        </pre>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <Button
                  variant="outline"
                  className="flex-1 min-h-[44px] text-sm sm:text-base"
                  onClick={() => {
                    setImage(null);
                    setImagePreview(null);
                    setScanStatus('idle');
                    setExtractedData(null);
                    setRawOcrText('');
                    setShowRawText(false);
                  }}
                >
                  Choose Different Image
                </Button>
                
                {scanStatus === 'idle' && (
                  <Button
                    className="flex-1 min-h-[44px] text-sm sm:text-base"
                    onClick={scanImage}
                    disabled={isScanning}
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" size={18} />
                        Scanning...
                      </>
                    ) : (
                      'Scan Now'
                    )}
                  </Button>
                )}

                {scanStatus === 'success' && (
                  <Button
                    className="flex-1 min-h-[44px] text-sm sm:text-base"
                    onClick={handleUseData}
                  >
                    <CheckCircle size={18} className="mr-2" />
                    Use This Data
                  </Button>
                )}

                {scanStatus === 'error' && (
                  <Button
                    className="flex-1 min-h-[44px] text-sm sm:text-base"
                    onClick={scanImage}
                  >
                    Try Again
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Tips */}
          <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-muted rounded-lg">
            <h4 className="font-medium text-xs sm:text-sm text-foreground mb-2">Tips for best results:</h4>
            <ul className="text-[10px] sm:text-xs text-muted-foreground space-y-1">
              <li>• Ensure the bill is well-lit and in focus</li>
              <li>• Capture the entire bill in the frame</li>
              <li>• Avoid shadows and glare</li>
              <li>• Keep the bill flat and straight</li>
              <li>• You can always edit the extracted data after</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default BillScanner;
