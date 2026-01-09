import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';

const QRScanner = ({ onScan, onError, className = '' }) => {
  const html5QrCodeRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const scannerContainerId = 'qr-scanner-region';

  const startScanner = async () => {
    try {
      setError(null);
      
      // Clean up any existing instance
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
        } catch (e) {
          // Ignore stop errors
        }
        html5QrCodeRef.current = null;
      }
      
      // Create scanner instance
      html5QrCodeRef.current = new Html5Qrcode(scannerContainerId);
      
      await html5QrCodeRef.current.start(
        { facingMode: 'environment' }, // Use back camera
        {
          fps: 10,
          qrbox: { width: 200, height: 200 },
        },
        (decodedText) => {
          // Successfully scanned
          stopScanner();
          onScan(decodedText);
        },
        (errorMessage) => {
          // Scan error (usually just means no QR code found yet)
          // Don't show this error to user
        }
      );
      
      setIsScanning(true);
    } catch (err) {
      console.error('Scanner error:', err);
      setIsScanning(false);
      
      if (err.toString().includes('NotAllowedError') || err.toString().includes('Permission')) {
        setError('Camera permission denied. Please allow camera access and try again.');
      } else if (err.toString().includes('NotFoundError')) {
        setError('No camera found on this device.');
      } else {
        setError('Failed to start camera. Please try again.');
      }
      
      if (onError) {
        onError(err);
      }
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      html5QrCodeRef.current = null;
    }
    setIsScanning(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Scanner region - always rendered but visibility controlled */}
      <div 
        id={scannerContainerId}
        className="w-full max-w-[300px] rounded-lg overflow-hidden bg-black"
        style={{ 
          minHeight: isScanning ? '300px' : '0px',
          display: isScanning ? 'block' : 'none'
        }}
      />
      
      {/* Placeholder when not scanning */}
      {!isScanning && (
        <div className="w-full max-w-[300px] aspect-square rounded-lg bg-muted/50 border-2 border-dashed border-border flex flex-col items-center justify-center gap-4">
          {error ? (
            <>
              <CameraOff className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-center text-destructive px-4">{error}</p>
              <Button onClick={startScanner} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </>
          ) : (
            <>
              <Camera className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center px-4">
                Click below to scan an invite QR code
              </p>
            </>
          )}
        </div>
      )}

      {/* Control buttons */}
      <div className="mt-4">
        {!isScanning ? (
          <Button onClick={startScanner} className="min-h-[44px]">
            <Camera className="h-4 w-4 mr-2" />
            Start Camera
          </Button>
        ) : (
          <Button onClick={stopScanner} variant="outline" className="min-h-[44px]">
            <CameraOff className="h-4 w-4 mr-2" />
            Stop Camera
          </Button>
        )}
      </div>

      {/* Instructions */}
      {isScanning && (
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Point your camera at the invite QR code
        </p>
      )}

      {/* Global styles for html5-qrcode */}
      <style>{`
        #${scannerContainerId} video {
          width: 100% !important;
          height: auto !important;
          border-radius: 8px;
        }
        #${scannerContainerId} img[alt="scan-region-shade"] {
          display: none !important;
        }
        #qr-shaded-region {
          border-width: 2px !important;
        }
      `}</style>
    </div>
  );
};

export default QRScanner;
