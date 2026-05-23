import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/library'

export default function BarcodeScanner({ onResult, onClose }) {
  const videoRef = useRef(null)
  const readerRef = useRef(null)
  const [scanning, setScanning] = useState(true)
  const [lastResult, setLastResult] = useState(null)

  useEffect(() => {
    readerRef.current = new BrowserMultiFormatReader()

    readerRef.current.decodeFromVideoDevice(
      null, // utilise la caméra par défaut (arrière sur mobile)
      videoRef.current,
      (result, error) => {
        if (result) {
          const code = result.getText()
          if (code !== lastResult) {
            setLastResult(code)
            setScanning(false)
            // Vibration feedback
            navigator.vibrate?.(200)
            onResult(code)
          }
        }
      }
    )

    return () => readerRef.current?.reset()
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        zIndex: 300,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            color: '#fff',
            fontFamily: "'Lato',sans-serif",
            fontSize: '14px',
            fontWeight: 700,
          }}
        >
          Scanne le code-barres
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            fontSize: '24px',
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

        {/* Ligne de scan animée */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '70%',
              height: '2px',
              background: 'rgba(255,100,0,0.8)',
              boxShadow: '0 0 8px rgba(255,100,0,0.8)',
              animation: 'scan 2s ease-in-out infinite',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0%, 100% { transform: translateY(-60px); }
          50% { transform: translateY(60px); }
        }
      `}</style>
    </div>
  )
}
