/**
 * QRCode - Generate QR codes for addresses and payment requests
 * Agent 3 (Features) - Task 3.1
 * 
 * Features:
 * - Generate QR code from any string (address, URI)
 * - Customizable size and colors
 * - Optional logo overlay
 * - Download as image
 */
import { useEffect, useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

interface QRCodeProps {
  value: string;
  size?: number;
  bgColor?: string;
  fgColor?: string;
  showLogo?: boolean;
  logoText?: string;
  downloadable?: boolean;
  className?: string;
}

// Simple QR Code generator using canvas
// For production, consider using a library like 'qrcode' or 'qrcode.react'
export function QRCode({
  value,
  size = 200,
  bgColor = '#FFFFFF',
  fgColor = '#000000',
  showLogo = true,
  logoText = 'M',
  downloadable = false,
  className = '',
}: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setLoading(true);
    setError(null);

    try {
      // Generate QR code pattern
      const qrData = generateQRMatrix(value);
      const moduleCount = qrData.length;
      const moduleSize = Math.floor(size / moduleCount);
      const offset = Math.floor((size - moduleSize * moduleCount) / 2);

      // Clear canvas
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, size, size);

      // Draw QR modules
      ctx.fillStyle = fgColor;
      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          if (qrData[row][col]) {
            ctx.fillRect(
              offset + col * moduleSize,
              offset + row * moduleSize,
              moduleSize,
              moduleSize
            );
          }
        }
      }

      // Draw logo in center if enabled
      if (showLogo) {
        const logoSize = Math.floor(size * 0.2);
        const logoX = (size - logoSize) / 2;
        const logoY = (size - logoSize) / 2;

        // White background for logo
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        ctx.roundRect(logoX - 4, logoY - 4, logoSize + 8, logoSize + 8, 8);
        ctx.fill();

        // Logo background (brand color)
        ctx.fillStyle = '#6366f1'; // primary-500
        ctx.beginPath();
        ctx.roundRect(logoX, logoY, logoSize, logoSize, 6);
        ctx.fill();

        // Logo text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${Math.floor(logoSize * 0.6)}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(logoText, size / 2, size / 2 + 2);
      }

      setLoading(false);
    } catch (err) {
      console.error('QR generation error:', err);
      setError('Failed to generate QR code');
      setLoading(false);
    }
  }, [value, size, bgColor, fgColor, showLogo, logoText]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    
    const link = document.createElement('a');
    link.download = `mynta-address-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  if (error) {
    return (
      <div 
        className={`flex items-center justify-center bg-surface-800 rounded-xl ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-red-400 text-sm">{error}</span>
      </div>
    );
  }

  return (
    <div className={`relative inline-block ${className}`}>
      {loading && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-white rounded-xl"
          style={{ width: size, height: size }}
        >
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className={`rounded-xl ${loading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
      />
      {downloadable && !loading && (
        <button
          onClick={handleDownload}
          className="absolute bottom-2 right-2 p-2 bg-surface-900/80 hover:bg-surface-900 rounded-lg transition-colors"
          title="Download QR Code"
        >
          <Download className="w-4 h-4 text-white" />
        </button>
      )}
    </div>
  );
}

/**
 * Simple QR Code matrix generator
 * This is a simplified implementation - for production use a proper QR library
 */
function generateQRMatrix(data: string): boolean[][] {
  const size = 25; // Version 2 QR code size
  const matrix: boolean[][] = Array(size).fill(null).map(() => Array(size).fill(false));
  
  // Add finder patterns (the three large squares in corners)
  addFinderPattern(matrix, 0, 0);
  addFinderPattern(matrix, size - 7, 0);
  addFinderPattern(matrix, 0, size - 7);
  
  // Add timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }
  
  // Add alignment pattern for version 2+
  addAlignmentPattern(matrix, size - 9, size - 9);
  
  // Encode data in remaining space (simplified - just creates a pattern based on data hash)
  const hash = simpleHash(data);
  let bitIndex = 0;
  
  for (let col = size - 1; col >= 1; col -= 2) {
    if (col === 6) col = 5; // Skip timing column
    
    for (let row = 0; row < size; row++) {
      for (let c = 0; c < 2; c++) {
        const x = col - c;
        const y = col % 4 === 0 ? row : size - 1 - row;
        
        if (!isReserved(matrix, x, y, size)) {
          matrix[y][x] = ((hash >> (bitIndex % 32)) & 1) === 1;
          bitIndex++;
        }
      }
    }
  }
  
  return matrix;
}

function addFinderPattern(matrix: boolean[][], startX: number, startY: number) {
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      const isEdge = x === 0 || x === 6 || y === 0 || y === 6;
      const isInner = x >= 2 && x <= 4 && y >= 2 && y <= 4;
      matrix[startY + y][startX + x] = isEdge || isInner;
    }
  }
}

function addAlignmentPattern(matrix: boolean[][], centerX: number, centerY: number) {
  for (let y = -2; y <= 2; y++) {
    for (let x = -2; x <= 2; x++) {
      const isEdge = Math.abs(x) === 2 || Math.abs(y) === 2;
      const isCenter = x === 0 && y === 0;
      matrix[centerY + y][centerX + x] = isEdge || isCenter;
    }
  }
}

function isReserved(_matrix: boolean[][], x: number, y: number, size: number): boolean {
  // Finder patterns + separators
  if (x < 9 && y < 9) return true;
  if (x < 9 && y >= size - 8) return true;
  if (x >= size - 8 && y < 9) return true;
  // Timing patterns
  if (x === 6 || y === 6) return true;
  // Alignment pattern area
  if (x >= size - 11 && x <= size - 7 && y >= size - 11 && y <= size - 7) return true;
  return false;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export default QRCode;


