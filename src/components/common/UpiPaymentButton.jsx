import React, { useState, useEffect, useRef } from 'react';
import { Smartphone, Check, Copy, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { useToast } from '../../hooks/use-toast';
import { useIsMobile } from '../../hooks/use-mobile';
import { Badge } from '../ui/badge';
import { 
  validateUpiId, 
  generateUpiUrl, 
  getUpiProviderIcon,
  generateTransactionRef,
  validatePaymentAmount
} from '../../utils/upiHelpers';

const UpiPaymentButton = ({ amount, receiverName, receiverUpiId, note = 'Settlement via Split-It', onPaymentInitiated, variant = 'default', size = 'default', className = '' }) => {
  const { toast } = useToast();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [paymentInitiated, setPaymentInitiated] = useState(false);
  const [transactionRef, setTransactionRef] = useState(null);
  const isMobile = useIsMobile();
  const canvasRef = useRef(null);

  // Validate UPI ID and amount
  const upiValidation = validateUpiId(receiverUpiId);
  const amountValidation = validatePaymentAmount(amount);
  const providerIcon = getUpiProviderIcon(receiverUpiId);

  // Generate transaction reference if not exists
  useEffect(() => {
    if (!transactionRef) {
      setTransactionRef(generateTransactionRef());
    }
  }, [transactionRef]);

  const getUpiUrl = (appScheme = null) => {
    const params = {
      receiverUpiId,
      receiverName,
      amount,
      note,
      transactionId: transactionRef,
    };
    
    if (appScheme) {
      return generateUpiUrl({ ...params, scheme: appScheme });
    }
    return generateUpiUrl(params);
  };

  const generateQRCode = () => {
    if (!canvasRef.current || !upiValidation.isValid) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const upiUrl = getUpiUrl();
    
    const size = 280;
    canvas.width = size;
    canvas.height = size;
    
    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    
    // Generate QR code using QR server API
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Add padding
      const padding = 20;
      ctx.drawImage(img, padding, padding, size - padding * 2, size - padding * 2);
      
      // Add border
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 2;
      ctx.strokeRect(padding, padding, size - padding * 2, size - padding * 2);
    };
    img.onerror = () => {
      // Fallback: show text if QR generation fails
      ctx.fillStyle = '#000000';
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('QR Code Generation Failed', size/2, size/2 - 30);
      ctx.font = '12px system-ui';
      ctx.fillText('Please use UPI app option', size/2, size/2);
      ctx.fillText('or copy UPI ID manually', size/2, size/2 + 20);
    };
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=0&data=${encodeURIComponent(upiUrl)}`;
  };

  useEffect(() => {
    if (showPaymentDialog && !isMobile) {
      setTimeout(generateQRCode, 100);
    }
  }, [showPaymentDialog, isMobile]);

  const handlePayNow = () => {
    if (!upiValidation.isValid) {
      toast({ 
        title: "Invalid UPI ID", 
        description: upiValidation.error,
        variant: "destructive" 
      });
      return;
    }

    if (!amountValidation.isValid) {
      toast({ 
        title: "Invalid Amount", 
        description: amountValidation.error,
        variant: "destructive" 
      });
      return;
    }

    if (isMobile) {
      // On mobile, try to open default UPI app
      window.location.href = getUpiUrl();
      setPaymentInitiated(true);
      toast({ 
        title: "Opening UPI app...", 
        description: `Transaction ID: ${transactionRef}` 
      });
    } else {
      // On desktop, show QR code dialog
      setShowPaymentDialog(true);
    }
    
    if (onPaymentInitiated) {
      onPaymentInitiated({
        transactionRef,
        amount,
        timestamp: new Date().toISOString(),
      });
    }
  };

  const copyUpiId = async () => {
    try { 
      await navigator.clipboard.writeText(receiverUpiId); 
      setCopied(true); 
      setTimeout(() => setCopied(false), 2000); 
      toast({ title: "UPI ID copied!" }); 
    }
    catch { 
      toast({ title: "Failed to copy", variant: "destructive" }); 
    }
  };

  const downloadQRCode = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `upi-payment-${amount}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
    toast({ title: "QR Code downloaded!" });
  };

  // Don't render if UPI ID is invalid
  if (!receiverUpiId || !upiValidation.isValid) {
    return (
      <Button variant="ghost" size={size} className={className} disabled>
        <AlertCircle size={18} className="mr-2" />
        Invalid UPI
      </Button>
    );
  }

  return (
    <>
      <Button 
        variant={variant} 
        size={size} 
        className={className}
        onClick={handlePayNow}
      >
        <Smartphone size={18} />
        {paymentInitiated ? (
          <><CheckCircle2 size={16} className="ml-2" />Initiated</>
        ) : (
          isMobile ? 'Pay with any UPI app' : 'Pay via UPI'
        )}
      </Button>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pay via UPI</DialogTitle>
            <DialogDescription>
              Scan QR code with any UPI app to complete payment
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center space-y-4 py-4">
            <div className="p-4 bg-white rounded-lg shadow-lg border-2 border-primary/20">
              <canvas ref={canvasRef} className="max-w-full h-auto" />
            </div>
            
            {/* Payment Info Card */}
            <div className="w-full space-y-3">
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm text-muted-foreground mb-1">Amount to Pay</p>
                <p className="font-display text-3xl font-bold text-primary">
                  ₹{amount.toLocaleString()}
                </p>
                {transactionRef && (
                  <p className="text-xs text-muted-foreground mt-2 font-mono">
                    Ref: {transactionRef}
                  </p>
                )}
              </div>
              
              <div className="p-4 bg-secondary rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">Pay to</p>
                  {upiValidation.provider && (
                    <Badge variant="outline" className="text-xs">
                      {providerIcon} {upiValidation.provider}
                    </Badge>
                  )}
                </div>
                <p className="font-semibold text-lg">{receiverName}</p>
                <div className="flex items-center justify-between gap-2 mt-2">
                  <p className="text-sm font-mono text-muted-foreground break-all flex-1">{receiverUpiId}</p>
                  <Button variant="ghost" size="sm" onClick={copyUpiId}>
                    {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                  </Button>
                </div>
                {upiValidation.bank && (
                  <p className="text-xs text-muted-foreground mt-1">{upiValidation.bank}</p>
                )}
              </div>
              
              <div className="p-3 bg-info/10 rounded-lg border border-info/20">
                <p className="text-xs text-info flex items-center gap-2">
                  <AlertCircle size={14} />
                  Open any UPI app on your device and scan this QR code
                </p>
              </div>
            </div>
            
            <Button onClick={downloadQRCode} variant="outline" size="sm" className="w-full">
              <Download size={16} className="mr-2" />
              Download QR Code
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UpiPaymentButton;
