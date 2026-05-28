import { useEffect, useRef, useState } from 'react'

export default function BarcodeScanner({ onResult, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [error, setError] = useState(null)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    let animFrame
    let detector

    const start = async () => {
      try {
        // Vérifie support natif
        if (!('BarcodeDetector' in window)) {
          setError('BarcodeDetector non supporté sur ce navigateur')
          return
        }

        detector = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code', 'code_128', 'code_39'],
        })

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        streamRef.current = stream
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setScanning(true)

        const detect = async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) {
            animFrame = requestAnimationFrame(detect)
            return
          }
          try {
            const barcodes = await detector.detect(videoRef.current)
            if (barcodes.length > 0) {
              navigator.vibrate?.(200)
              cleanup()
              onResult(barcodes[0].rawValue)
              return
            }
          } catch {}
          animFrame = requestAnimationFrame(detect)
        }
        detect()
      } catch (e) {
        setError("Impossible d'accéder à la caméra : " + e.message)
      }
    }

    const cleanup = () => {
      cancelAnimationFrame(animFrame)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }

    start()
    return cleanup
  }, [onResult])

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
          {scanning ? '🔍 Scanne le code-barres' : 'Démarrage...'}
        </span>
        <button
          onClick={() => {
            streamRef.current?.getTracks().forEach((t) => t.stop())
            onClose()
          }}
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

      {error ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '16px',
            padding: '20px',
          }}
        >
          <div style={{ color: '#ef4444', fontSize: '14px', textAlign: 'center' }}>{error}</div>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              background: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Fermer
          </button>
        </div>
      ) : (
        <div style={{ flex: 1, position: 'relative' }}>
          <video
            ref={videoRef}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            muted
            playsInline
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                width: '70%',
                height: '120px',
                border: '2px solid rgba(255,100,0,0.8)',
                borderRadius: '8px',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%,-50%)',
                  width: '90%',
                  height: '2px',
                  background: 'rgba(255,100,0,0.8)',
                  boxShadow: '0 0 8px rgba(255,100,0,0.8)',
                  animation: 'scan 1.5s ease-in-out infinite',
                }}
              />
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          padding: '16px',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.5)',
          fontSize: '11px',
          fontFamily: "'Lato',sans-serif",
        }}
      >
        Pointe vers le code-barres du produit
      </div>

      <style>{`
        @keyframes scan {
          0%, 100% { transform: translate(-50%, -30px); }
          50% { transform: translate(-50%, 30px); }
        }
      `}</style>
    </div>
  )
}
