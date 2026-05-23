import { useRef, useState, useCallback } from 'react'
import Webcam from 'react-webcam'

const C = {
  brown: '#6b4226',
  green: '#4a7c59',
  terra: '#c1602a',
  bg: '#0f0f0f',
}

export default function TicketCamera({ onCapture, onClose }) {
  const webcamRef = useRef(null)
  const [brightness, setBrightness] = useState(null) // "ok" | "dark" | "bright"
  const [capturing, setCapturing] = useState(false)

  // Analyse la luminosité via un canvas
  const analyzeBrightness = useCallback(() => {
    const video = webcamRef.current?.video
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, 64, 64)
    const data = ctx.getImageData(0, 0, 64, 64).data
    let total = 0
    for (let i = 0; i < data.length; i += 4) {
      total += (data[i] + data[i + 1] + data[i + 2]) / 3
    }
    const avg = total / (data.length / 4)
    if (avg < 60) setBrightness('dark')
    else if (avg > 220) setBrightness('bright')
    else setBrightness('ok')
  }, [])

  // Lance l'analyse toutes les secondes
  useState(() => {
    const interval = setInterval(analyzeBrightness, 1000)
    return () => clearInterval(interval)
  })

  const capture = useCallback(async () => {
    setCapturing(true)
    const imageSrc = webcamRef.current?.getScreenshot({ width: 1920, height: 1080 })
    if (imageSrc) {
      // Convertit base64 data URL en File
      const res = await fetch(imageSrc)
      const blob = await res.blob()
      const file = new File([blob], 'ticket.jpg', { type: 'image/jpeg' })
      onCapture(file, imageSrc)
    }
    setCapturing(false)
  }, [onCapture])

  const brightnessMsg = {
    dark: { text: '⚠️ Trop sombre — active la lampe torche', color: C.terra },
    bright: { text: '⚠️ Trop lumineux — évite les reflets', color: '#d4a017' },
    ok: { text: '✅ Luminosité bonne', color: C.green },
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: C.bg,
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
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
          📷 Scanner le ticket
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

      {/* Viewfinder */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat='image/jpeg'
          screenshotQuality={0.95}
          videoConstraints={{
            facingMode: 'environment', // caméra arrière
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          }}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />

        {/* Overlay cadre */}
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
          {/* Zone de scan recommandée */}
          <div
            style={{
              width: '85%',
              height: '70%',
              border: '2px solid rgba(255,255,255,0.8)',
              borderRadius: '8px',
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
            }}
          >
            {/* Coins accentués */}
            {[
              ['0', '0', 'top', 'left'],
              ['0', '0', 'top', 'right'],
              ['0', '0', 'bottom', 'left'],
              ['0', '0', 'bottom', 'right'],
            ].map(([t, l, v, h], i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  [v]: -2,
                  [h]: -2,
                  width: '20px',
                  height: '20px',
                  borderTop: v === 'top' ? `3px solid #fff` : 'none',
                  borderBottom: v === 'bottom' ? `3px solid #fff` : 'none',
                  borderLeft: h === 'left' ? `3px solid #fff` : 'none',
                  borderRight: h === 'right' ? `3px solid #fff` : 'none',
                }}
              />
            ))}

            {/* Instructions */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%,-50%)',
                textAlign: 'center',
                color: 'rgba(255,255,255,0.7)',
                fontFamily: "'Lato',sans-serif",
                fontSize: '13px',
              }}
            >
              <div>Cadre le ticket dans la zone</div>
              <div style={{ fontSize: '11px', marginTop: '4px' }}>
                Ticket à plat · Tiens le téléphone droit
              </div>
            </div>
          </div>
        </div>

        {/* Indicateur luminosité */}
        {brightness && (
          <div
            style={{ position: 'absolute', top: '12px', left: 0, right: 0, textAlign: 'center' }}
          >
            <span
              style={{
                background: 'rgba(0,0,0,0.7)',
                color: brightnessMsg[brightness].color,
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontFamily: "'Lato',sans-serif",
                fontWeight: 700,
              }}
            >
              {brightnessMsg[brightness].text}
            </span>
          </div>
        )}
      </div>

      {/* Bouton capture */}
      <div
        style={{
          padding: '20px',
          display: 'flex',
          justifyContent: 'center',
          gap: '20px',
          alignItems: 'center',
        }}
      >
        <button
          onClick={capture}
          disabled={capturing || brightness === 'dark'}
          style={{
            width: '70px',
            height: '70px',
            borderRadius: '50%',
            background: brightness === 'ok' ? '#fff' : 'rgba(255,255,255,0.4)',
            border: '4px solid rgba(255,255,255,0.8)',
            cursor: brightness === 'ok' ? 'pointer' : 'not-allowed',
            fontSize: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {capturing ? '⏳' : '📸'}
        </button>
      </div>

      {/* Aide */}
      <div
        style={{
          padding: '0 16px 20px',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.5)',
          fontFamily: "'Lato',sans-serif",
          fontSize: '11px',
        }}
      >
        Pour les longs tickets, prends plusieurs photos en commençant par le haut
      </div>
    </div>
  )
}
