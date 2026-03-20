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
  const [cameras, setCameras] = useState<any[]>([])
  const [cameraId, setCameraId] = useState<string | null>(null)

  const SCAN_REGION_ID = 'qr-reader'

  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices)
          // Essayer de trouver la caméra arrière par son nom
          const backCamera = devices.find(d => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('rear') ||
            d.label.toLowerCase().includes('arrière')
          )
          // Sinon prendre la dernière de la liste (souvent l'arrière sur Android)
          setCameraId(backCamera ? backCamera.id : devices[devices.length - 1].id)
        } else {
          setError('Aucune caméra trouvée.')
        }
      })
      .catch(() => setError('Erreur d\'accès caméra.'))

    return () => { stopScanner() }
  }, [])

  const startScanner = async (id: string) => {
    if (scannerRef.current) await stopScanner()
    const html5QrCode = new Html5Qrcode(SCAN_REGION_ID)
    scannerRef.current = html5QrCode

    try {
      setIsStarted(true)
      setError(null)
      await html5QrCode.start(
        id,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (text) => { onScan(text); stopScanner() },
        () => {}
      )
    } catch (err) {
      setError('Erreur de démarrage.')
      setIsStarted(false)
    }
  }

  const stopScanner = async () => {
    if (scannerRef.current?.isScanning) {
      try { await scannerRef.current.stop() } catch {}
    }
    setIsStarted(false)
  }

  const switchCamera = () => {
    if (cameras.length < 2) return
    const currentIndex = cameras.findIndex(c => c.id === cameraId)
    const nextId = cameras[(currentIndex + 1) % cameras.length].id
    setCameraId(nextId)
    if (isStarted) startScanner(nextId)
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col p-4 animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-white font-bold text-lg flex items-center gap-2">
          <Camera className="w-5 h-5 text-emerald-400" />
          Scanner QR Code
        </h2>
        <button onClick={onClose} className="bg-slate-800 p-2 rounded-full text-white hover:bg-slate-700">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 relative bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 flex flex-col items-center justify-center">
        {!isStarted && !error && (
          <div className="text-center p-8">
            <button
              onClick={() => cameraId && startScanner(cameraId)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-4 rounded-2xl font-bold shadow-xl shadow-emerald-600/20 active:scale-95 transition-all"
            >
              Démarrer le scanner
            </button>
            <p className="text-slate-500 text-xs mt-6">Utilisez la caméra arrière pour de meilleurs résultats.</p>
          </div>
        )}

        {error && <div className="text-center p-8 text-red-400">{error}</div>}
        <div id={SCAN_REGION_ID} className="w-full h-full"></div>
      </div>

      <div className="mt-8 flex flex-col items-center gap-4">
        {cameras.length > 1 && (
          <button
            onClick={switchCamera}
            className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-3.5 rounded-2xl font-bold flex items-center gap-3 transition-all active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            Changer de caméra ({cameras.length})
          </button>
        )}
      </div>
    </div>
  )
}
