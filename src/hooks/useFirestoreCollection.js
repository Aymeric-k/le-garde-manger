import { useEffect, useState, useCallback, useRef } from 'react'
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  getDocs,
} from 'firebase/firestore'
import { db } from '../config/firebase'

/**
 * Remplace useStorage(key, init) mais synchronise avec Firestore au
 * lieu de localStorage. Même signature d'utilisation côté composant —
 * [valeur, setValeur] — pour limiter les changements dans App.jsx.
 *
 * Stocke sous users/{uid}/{collectionName}/{itemId}
 * Chaque item DOIT avoir un champ `id` unique (déjà le cas partout
 * dans Kësoir — Date.now() + Math.random()).
 *
 * userId = null tant que l'utilisateur n'est pas connecté → dans ce
 * cas le hook reste inactif (tableau vide) : on affiche l'app en mode
 * lecture seule / invite à se connecter pour les features qui écrivent.
 */
export function useFirestoreCollection(userId, collectionName, initialValue = []) {
  const [items, setItems] = useState(initialValue)
  const isFirstSnapshot = useRef(true)

  useEffect(() => {
    if (!userId) {
      setItems(initialValue)
      return
    }

    const colRef = collection(db, 'users', userId, collectionName)
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const data = snapshot.docs.map((d) => d.data())
      setItems(data)
      isFirstSnapshot.current = false
    })

    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, collectionName])

  // API compatible avec setIngredients(prev => [...]) ou setIngredients([...])
  const setItemsAndSync = useCallback(
    async (updater) => {
      if (!userId) return

      const newItems = typeof updater === 'function' ? updater(items) : updater
      const oldIds = new Set(items.map((i) => i.id))
      const newIds = new Set(newItems.map((i) => i.id))

      // Écrit/à jour chaque item présent dans le nouvel état
      const writes = newItems.map((item) =>
        setDoc(doc(db, 'users', userId, collectionName, String(item.id)), item)
      )

      // Supprime les items qui ont disparu (ex: suppression d'un ingrédient)
      const deletes = [...oldIds]
        .filter((id) => !newIds.has(id))
        .map((id) => deleteDoc(doc(db, 'users', userId, collectionName, String(id))))

      await Promise.all([...writes, ...deletes])
      // Pas besoin de setItems ici — onSnapshot se déclenche automatiquement
    },
    [userId, collectionName, items]
  )

  return [items, setItemsAndSync]
}

/**
 * Migration unique — au premier login, si Firestore est vide pour
 * cette collection mais que localStorage contient des données, on les
 * importe. Ça évite à Aymeric et sa famille de perdre leur inventaire
 * actuel au moment du passage au compte Google.
 */
export async function migrateLocalStorageToFirestore(userId, collectionName, localStorageKey) {
  try {
    const colRef = collection(db, 'users', userId, collectionName)
    const existing = await getDocs(colRef)
    if (!existing.empty) return // déjà migré, on ne touche à rien

    const raw = localStorage.getItem(localStorageKey)
    if (!raw) return
    const localData = JSON.parse(raw)
    if (!Array.isArray(localData) || localData.length === 0) return

    await Promise.all(
      localData.map((item) =>
        setDoc(doc(db, 'users', userId, collectionName, String(item.id)), item)
      )
    )
    console.log(`✅ Migration ${collectionName} : ${localData.length} éléments importés`)
  } catch (error) {
    console.error(`❌ Erreur migration ${collectionName}:`, error)
  }
}
