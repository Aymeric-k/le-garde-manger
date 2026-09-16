import { useEffect, useState, useCallback, useRef } from 'react'
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore'
import { db } from '../config/firebase'

/**
 * useFirestoreDoc — pour les données en forme d'OBJET (clé → valeur),
 * pas de LISTE (comme useFirestoreCollection). Exemple : priceHistory
 * et productCache sont des dictionnaires { "bc_123": {...}, "nm_lait": {...} }
 * — pas des tableaux avec un id par élément.
 *
 * Différence clé avec useFirestoreCollection :
 * - useFirestoreCollection = 1 document Firestore PAR élément de la liste
 *   (adapté à "beaucoup d'éléments qu'on ajoute/supprime un par un")
 * - useFirestoreDoc = TOUT l'objet dans UN SEUL document Firestore
 *   (adapté à "un dictionnaire qu'on lit/écrit en bloc")
 *
 * On choisit useFirestoreDoc ici parce que priceHistory/productCache
 * sont mis à jour comme un objet entier (setPriceHistory(p => ({...p, [key]: ...})))
 * — pas élément par élément — donc un seul document suffit et c'est
 * plus simple à synchroniser.
 *
 * Chemin de stockage : users/{uid}/meta/{docName}
 * (ex: users/abc123/meta/priceHistory)
 */
export function useFirestoreDoc(userId, docName, initialValue = {}) {
  const [data, setData] = useState(initialValue)

  useEffect(() => {
    if (!userId) {
      setData(initialValue)
      return
    }

    const docRef = doc(db, 'users', userId, 'meta', docName)
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      // Si le document n'existe pas encore (premier usage), on garde
      // l'objet vide plutôt que de planter
      setData(snapshot.exists() ? snapshot.data() : initialValue)
    })

    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, docName])

  // API compatible avec setPriceHistory(prev => ({...prev, [key]: val}))
  const setDataAndSync = useCallback(
    async (updater) => {
      if (!userId) return
      const newData = typeof updater === 'function' ? updater(data) : updater
      const docRef = doc(db, 'users', userId, 'meta', docName)
      await setDoc(docRef, newData)
      // Pas besoin de setData ici — onSnapshot se déclenche automatiquement
    },
    [userId, docName, data]
  )

  return [data, setDataAndSync]
}

/**
 * mergeFirestoreDocField — écrit UNE SEULE clé du document, sans jamais
 * toucher aux autres. Contrairement à setDataAndSync (qui réécrit
 * l'objet entier à partir de l'état React local), celle-ci utilise le
 * `merge: true` de Firestore, qui fusionne côté serveur.
 *
 * Pourquoi c'est important : si on enregistre plusieurs prix coup sur
 * coup (ex: import d'un ticket de 10 articles), plusieurs écritures
 * partent presque en même temps. Avec setDataAndSync, chacune lit le
 * même état React "pas encore à jour" et écrase les autres au passage
 * — la plupart des prix se perdent. Avec merge:true, chaque écriture
 * ne touche QUE sa propre clé, donc rien n'est perdu même si 10
 * écritures partent en même temps sur 10 produits différents.
 */
export async function mergeFirestoreDocField(userId, docName, key, value) {
  if (!userId) return
  const docRef = doc(db, 'users', userId, 'meta', docName)
  await setDoc(docRef, { [key]: value }, { merge: true })
}

/**
 * Migration unique pour les données en forme d'objet (contrairement à
 * migrateLocalStorageToFirestore qui migre des LISTES). Même principe :
 * si Firestore est vide et que localStorage a des données, on importe.
 */
export async function migrateLocalStorageObjectToFirestore(userId, docName, localStorageKey) {
  try {
    const docRef = doc(db, 'users', userId, 'meta', docName)
    const existing = await getDoc(docRef)
    if (existing.exists()) return // déjà migré

    const raw = localStorage.getItem(localStorageKey)
    if (!raw) return
    const localData = JSON.parse(raw)
    if (!localData || typeof localData !== 'object' || Object.keys(localData).length === 0) return

    await setDoc(docRef, localData)
    console.log(`✅ Migration ${docName} : ${Object.keys(localData).length} clés importées`)
  } catch (error) {
    console.error(`❌ Erreur migration ${docName}:`, error)
  }
}
