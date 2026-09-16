import { useEffect, useState, useCallback } from 'react'
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../config/firebase'

/**
 * Cache produit PARTAGÉ — contrairement au cache personnel (une entrée
 * par utilisateur), celui-ci est UNIQUE pour toute l'application.
 *
 * Principe : beaucoup de produits sont communs à tous les utilisateurs
 * (Nutella, Coca-Cola, pâtes Panzani...). Plutôt que chaque foyer
 * résolve séparément "Nutella 1kg" dans son coin, l'admin (toi) le
 * résout UNE fois, et ça profite immédiatement à tous les comptes —
 * y compris ceux qui n'ont encore jamais rien scanné.
 *
 * Lecture : tous les utilisateurs connectés.
 * Écriture : admin uniquement (voir ADMIN_UIDS + firestore.rules).
 *
 * Stocké dans une VRAIE collection (un document par produit), pas un
 * gros objet unique — ça évite la limite de 1 Mo par document Firestore
 * si ce catalogue partagé grossit beaucoup avec le temps, et ça évite
 * que deux écritures admin simultanées s'écrasent l'une l'autre.
 */
export function useSharedProductCache() {
  const [sharedCache, setSharedCache] = useState({})

  useEffect(() => {
    const colRef = collection(db, 'shared_product_cache')
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const data = {}
      snapshot.docs.forEach((d) => {
        data[d.id] = d.data()
      })
      setSharedCache(data)
    })
    return unsubscribe
  }, [])

  return sharedCache
}

/**
 * Écrit un produit dans le cache partagé. À n'appeler QUE si
 * l'utilisateur courant est admin (vérifié côté client pour l'UX, et
 * appliqué réellement côté serveur par firestore.rules — un appel par
 * un non-admin sera rejeté silencieusement par Firestore).
 */
export async function writeSharedProduct(key, entry) {
  try {
    await setDoc(doc(db, 'shared_product_cache', key), entry, { merge: true })
  } catch (error) {
    // Rejeté par les règles Firestore si pas admin — pas grave, le
    // produit reste dans le cache personnel de toute façon
    console.warn('Écriture cache partagé refusée (normal si pas admin):', error)
  }
}
