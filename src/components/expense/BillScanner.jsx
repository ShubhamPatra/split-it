import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Progress } from '../ui/progress';
import { useToast } from '../../hooks/use-toast';

const API_ROOT = (process.env.REACT_APP_API_URL || 'http://localhost:5000')
  .replace(/\/$/, '')
  .replace(/\/api$/, '');
const OCR_POLL_INTERVAL_MS = Number(process.env.REACT_APP_OCR_POLL_INTERVAL_MS || 2000);
const OCR_POLL_TIMEOUT_MS = Number(process.env.REACT_APP_OCR_POLL_TIMEOUT_MS || 120000);

/**
 * BillScanner Component
 * 
 * Allows users to scan/upload bill images and extract expense details using server-side OCR
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
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const parseOcrResult = (data) => ({
    amount: data?.result?.extracted?.amount ?? data?.extracted?.amount ?? null,
    date: data?.result?.extracted?.date ?? data?.extracted?.date ?? null,
    merchantName: data?.result?.extracted?.merchantName ?? data?.extracted?.merchantName ?? null,
    lineItems: data?.result?.extracted?.lineItems ?? data?.extracted?.lineItems ?? null,
    rawText: data?.result?.rawText ?? data?.rawText ?? '',
    ocrConfidence: data?.result?.ocrConfidence ?? data?.ocrConfidence ?? 0,
    extractionConfidence: data?.result?.extractionConfidence ?? data?.extractionConfidence ?? 0,
  });

  const pollForOcrResult = async (jobId, startTime) => {
    let lastStatus = 'queued';

    while (Date.now() - startTime < OCR_POLL_TIMEOUT_MS) {
      const response = await fetch(`${API_ROOT}/api/ocr/jobs/${jobId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to check OCR job status');
      }

      const job = await response.json();
      lastStatus = job.status;

      if (job.status === 'completed') {
        return parseOcrResult(job);
      }

      if (job.status === 'failed') {
        throw new Error(job.error || 'OCR processing failed');
      }

      const elapsed = Date.now() - startTime;
      setScanProgress(Math.min(30 + Math.floor((elapsed / OCR_POLL_TIMEOUT_MS) * 60), 90));
      setScanStatus('scanning');
      await sleep(OCR_POLL_INTERVAL_MS);
    }

    throw new Error(`OCR job is still ${lastStatus} after waiting too long. Please try again.`);
  };

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

    // Validate file size (max 10MB for server upload)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 10MB",
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
   * Perform OCR on the uploaded image using server-side endpoint
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

    try {
      const formData = new FormData();
      formData.append('receipt', image);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setScanProgress(prev => Math.min(prev + 10, 90));
      }, 300);

      const response = await fetch(`${API_ROOT}/api/ocr/scan`, {
        method: 'POST',
        credentials: 'include', // Send HttpOnly auth cookie
        body: formData,
      });

      clearInterval(progressInterval);

      // Safely handle non-JSON error responses (e.g. Nginx HTML 413 page)
      let data;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        if (!response.ok) {
          throw new Error(`Server error ${response.status}: ${text.slice(0, 200)}`);
        }
        try {
          data = JSON.parse(text);
        } catch (e) {
          data = { text };
        }
      }

      if (!response.ok) {
        throw new Error((data && data.message) || 'Failed to scan receipt');
      }

      let extracted;

      if (data.mode === 'async' && data.jobId) {
        setScanStatus('scanning');
        setScanProgress(35);
        extracted = await pollForOcrResult(data.jobId, Date.now());
      } else {
        extracted = parseOcrResult(data);
      }

      setScanProgress(100);

      setExtractedData(extracted);
      setScanStatus('success');

      // Determine confidence level
      const confidence = extracted.extractionConfidence;
      const confidenceLevel = confidence > 0.7 ? 'high' : confidence > 0.5 ? 'medium' : 'low';

      if (!extracted.amount && !extracted.date && !extracted.merchantName) {
        toast({
          title: "No data extracted",
          description: "Could not extract expense details. Please enter manually.",
          variant: "destructive",
        });
        setScanStatus('error');
      } else {
        const extractedFields = [
          extracted.merchantName ? 'merchant' : null,
          extracted.amount ? 'amount' : null,
          extracted.date ? 'date' : null,
          extracted.lineItems ? `${extracted.lineItems.length} items` : null,
        ].filter(Boolean);

        toast({
          title: `Scan successful! (${confidenceLevel} confidence)`,
          description: `Extracted: ${extractedFields.join(', ')}`,
        });
      }

    } catch (error) {
      console.error('OCR Error:', error);
      setScanStatus('error');
      toast({
        title: "Scan failed",
        description: error.message || "Failed to scan the image. Please try again or enter manually.",
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
        lineItems: extractedData.lineItems || null,
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
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={18} className="text-primary flex-shrink-0" />
                        <h3 className="font-semibold text-sm sm:text-base text-foreground">Extracted Data</h3>
                      </div>
                      {extractedData.extractionConfidence > 0 && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${extractedData.extractionConfidence > 0.7
                            ? 'bg-success/20 text-success'
                            : extractedData.extractionConfidence > 0.5
                              ? 'bg-warning/20 text-warning'
                              : 'bg-destructive/20 text-destructive'
                          }`}>
                          {extractedData.extractionConfidence > 0.7 ? 'High' :
                            extractedData.extractionConfidence > 0.5 ? 'Medium' : 'Low'} confidence
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                      {extractedData.merchantName && (
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Merchant:</span>
                          <span className="font-medium truncate">{extractedData.merchantName}</span>
                        </div>
                      )}
                      {extractedData.amount && (
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Amount:</span>
                          <span className="font-medium">₹{(Number(extractedData.amount) || 0).toLocaleString()}</span>
                        </div>
                      )}
                      {extractedData.date && (
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Date:</span>
                          <span className="font-medium">{extractedData.date}</span>
                        </div>
                      )}
                      {extractedData.lineItems && extractedData.lineItems.length > 0 && (
                        <div className="pt-2 border-t border-border/50">
                          <span className="text-muted-foreground block mb-1.5">Line Items:</span>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {extractedData.lineItems.map((item, idx) => {
                              const price = Number(item.totalPrice) || 0;
                              return (
                                <div key={idx} className="flex justify-between gap-2 text-xs bg-background/50 p-1.5 rounded">
                                  <span className="truncate">{item.description} {item.quantity > 1 && `x${item.quantity}`}</span>
                                  <span className="font-medium whitespace-nowrap">₹{price.toFixed(2)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
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
