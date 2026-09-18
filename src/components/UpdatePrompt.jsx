import { useRegisterSW } from 'virtual:pwa-register/react'

// Bandeau de mise à jour PWA — avec registerType:'prompt' (voir
// vite.config.js), un onglet déjà ouvert lors d'un déploiement reste sur
// l'ancien JS tant qu'il n'est pas rechargé : le nouveau service worker
// est prêt mais jamais activé tant qu'aucun onglet ne le lui demande.
// Repéré en conditions réelles le 2026-09-18 après déploiement — la
// nouvelle DA n'apparaissait pas sans rechargement forcé (Ctrl+F5).
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        maxWidth: '380px',
        width: 'calc(100% - 32px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        padding: '12px 14px',
        borderRadius: '14px',
        background: '#262220',
        color: '#faf6f1',
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        fontFamily: "'Inter',sans-serif",
        fontSize: '13px',
      }}
    >
      <span>Nouvelle version disponible</span>
      <button
        onClick={() => updateServiceWorker(true)}
        style={{
          flexShrink: 0,
          background: '#d9603d',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          padding: '7px 12px',
          fontSize: '12px',
          fontWeight: 700,
          fontFamily: "'Inter',sans-serif",
          cursor: 'pointer',
        }}
      >
        Recharger
      </button>
    </div>
  )
}
