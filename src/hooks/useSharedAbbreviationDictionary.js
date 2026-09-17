import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../config/firebase'

/**
 * Dictionnaire d'abréviations PARTAGÉ — même principe que le cache
 * produit partagé (useSharedProductCache) : une correction validée par
 * un compte profite immédiatement à tous les autres, pour la même
 * enseigne.
 *
 * Écriture réservée à l'admin, comme le cache produit partagé — choix
 * délibéré plutôt qu'une écriture ouverte à tout utilisateur qui
 * corrige. Une correction d'abréviation semble a priori moins risquée
 * qu'une mauvaise identité produit (code-barres → mauvais article),
 * mais certains champs mémorisés ici (notamment "storage") reflètent
 * une habitude d'ORGANISATION PERSONNELLE plutôt qu'un fait objectif
 * sur le produit — les pousser tels quels vers tous les autres comptes
 * sans aucune relecture n'est pas plus sûr. Garder un seul modèle de
 * confiance (admin-only en écriture partagée) dans toute l'app est
 * aussi plus simple à auditer qu'une règle différente par fonctionnalité.
 *
 * Lecture : tous les utilisateurs connectés.
 * Écriture : admin uniquement (voir ADMIN_UIDS + firestore.rules).
 */
export function useSharedAbbreviationDictionary() {
  const [sharedDictionary, setSharedDictionary] = useState({})

  useEffect(() => {
    const colRef = collection(db, 'shared_abbreviation_dictionary')
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const data = {}
      snapshot.docs.forEach((d) => {
        data[d.id] = d.data()
      })
      setSharedDictionary(data)
    })
    return unsubscribe
  }, [])

  return sharedDictionary
}

/**
 * Écrit une correction dans le dictionnaire partagé. À n'appeler QUE si
 * l'utilisateur courant est admin (vérifié côté client pour l'UX, et
 * appliqué réellement côté serveur par firestore.rules — un appel par
 * un non-admin sera rejeté silencieusement par Firestore).
 */
export async function writeSharedAbbreviation(key, entry) {
  try {
    await setDoc(doc(db, 'shared_abbreviation_dictionary', key), entry, { merge: true })
  } catch (error) {
    // Rejeté par les règles Firestore si pas admin — pas grave, la
    // correction reste dans le dictionnaire personnel de toute façon
    console.warn('Écriture dictionnaire partagé refusée (normal si pas admin):', error)
  }
}
