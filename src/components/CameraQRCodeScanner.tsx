'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, X, RefreshCw, AlertCircle } from 'lucide-react'

interface CameraQRCodeScannerProps {
  onScan: (decodedText: string) => void
  onClose: () => void
}

export default function CameraQRCodeScanner({ onScan, onClose }: CameraQRCodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isStarted, setIsStarted] = useState(false)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')

  const SCAN_REGION_ID = 'qr-reader'

  useEffect(() => {
    // Check for camera availability
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!devices || devices.length === 0) {
          setError('Aucune caméra trouvée sur cet appareil.')
        }
      })
      .catch((err) => {
        console.error('Error getting cameras:', err)
        setError('Erreur d\'accès à la caméra. Vérifiez les permissions.')
      })

    return () => {
      stopScanner()
    }
  }, [])

  const startScanner = async (mode: 'user' | 'environment') => {
    // Si déjà démarré, on arrête d'abord
    if (scannerRef.current) {
        await stopScanner()
    }

    const html5QrCode = new Html5Qrcode(SCAN_REGION_ID)
    scannerRef.current = html5QrCode

    try {
      setIsStarted(true)
      setError(null)
      await html5QrCode.start(
        { facingMode: mode },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // Success
          onScan(decodedText)
          stopScanner()
        },
        () => {
          // Error callback (silent)
        }
      )
    } catch (err) {
      console.error('Failed to start scanner:', err)
      setError('Impossible de démarrer la caméra. Vérifiez les permissions.')
      setIsStarted(false)
    }
  }

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop()
      } catch (err) {
        console.error('Error stopping scanner:', err)
      }
    }
    setIsStarted(false)
  }

  const toggleCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(nextMode)
    if (isStarted) {
      startScanner(nextMode)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-white font-bold text-lg flex items-center gap-2">
          <Camera className="w-5 h-5 text-emerald-400" />
          Scanner le QR Code
        </h2>
        <button 
          onClick={onClose}
          className="bg-slate-800 p-2 rounded-full text-white hover:bg-slate-700 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col items-center justify-center">
        {!isStarted && !error && (
          <div className="text-center p-8">
            <div className="bg-emerald-500/20 p-4 rounded-full inline-flex mb-4">
              <Camera className="w-12 h-12 text-emerald-400" />
            </div>
            <p className="text-slate-400 text-sm mb-6">
              Prêt à scanner ? Orientez votre caméra arrière (ou avant) vers le QR Code.
            </p>
            <button
              onClick={() => startScanner(facingMode)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-600/20"
            >
              Démarrer le scanner
            </button>
          </div>
        )}

        {error && (
          <div className="text-center p-8 max-w-xs">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-white font-bold mb-2">Erreur</p>
            <p className="text-slate-400 text-sm">{error}</p>
          </div>
        )}

        {/* This ID is used by html5-qrcode */}
        <div id={SCAN_REGION_ID} className="w-full h-full max-h-[60vh]"></div>

        {isStarted && <div className="absolute inset-0 border-[3px] border-emerald-500/30 pointer-events-none rounded-3xl" />}
      </div>

      {/* Footer Controls */}
      <div className="mt-8 flex flex-col items-center gap-4">
        <button
          onClick={toggleCamera}
          className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-2xl font-medium transition-all flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Passer à la caméra {facingMode === 'environment' ? 'avant' : 'arrière'}
        </button>
        
        <p className="text-slate-500 text-center text-[10px] uppercase tracking-widest font-black">
          Mode actuel: {facingMode === 'environment' ? 'Arrière' : 'Avant'}
        </p>
      </div>

      <div className="mt-auto pb-4">
        <p className="text-slate-300 text-center text-xs">
          Le scan est automatique dès que le code est détecté.
        </p>
      </div>
    </div>
  )
}
