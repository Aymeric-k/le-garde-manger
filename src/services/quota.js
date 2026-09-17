import { doc, runTransaction, setDoc } from 'firebase/firestore'
import { db } from '../config/firebase'

// ═══════════════════════════════════════════════════════════════
// QUOTAS FREEMIUM — architecture invisible en bêta
// ═══════════════════════════════════════════════════════════════
// Deux actions ont un coût IA récurrent réel : le scan de ticket ou
// de facture (Document AI + classification GPT) et la génération de
// recettes (GPT). On compte les deux par utilisateur et par mois
// calendaire, et on écrit le résultat AVANT de lancer l'appel coûteux
// — jamais après coup.
//
// Pendant la bêta, personne n'est jamais bloqué : BETA_UNLIMITED_DEFAULT
// est le SEUL endroit du code à changer pour activer le blocage pour
// tout le monde le jour venu. Un compte peut individuellement
// surcharger ce défaut en écrivant `betaUnlimited: false` sur son
// propre document users/{uid}/meta/usageQuota — pratique pour tester
// le blocage sans désactiver la bêta globalement.

// Seul endroit du code à changer pour activer les quotas pour de vrai.
export const BETA_UNLIMITED_DEFAULT = true

export const FREE_QUOTAS = { scans: 5, recipes: 50 }

function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Vérifie le quota AVANT l'action coûteuse et incrémente dans la même
 * transaction si elle est autorisée — lecture et écriture atomiques,
 * pas de race entre deux appels concurrents sur le même compte.
 *
 * En bêta (betaUnlimited vrai, par défaut ou explicite sur le compte),
 * ne bloque jamais mais continue de compter au-delà du seuil — c'est
 * ce compteur qui sert à mesurer qui aurait été bloqué (voir
 * recordQuotaExcessIfNeeded ci-dessous, appelé automatiquement).
 *
 * @param {string} userId
 * @param {'scans'|'recipes'} type
 * @returns {Promise<{allowed: boolean, count: number, limit: number, betaUnlimited: boolean}>}
 */
export async function checkAndIncrementQuota(userId, type) {
  const quotaRef = doc(db, 'users', userId, 'meta', 'usageQuota')
  const month = currentMonthKey()
  const limit = FREE_QUOTAS[type]
  const otherType = type === 'scans' ? 'recipes' : 'scans'

  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(quotaRef)
    const data = snap.exists() ? snap.data() : {}
    const betaUnlimited = data.betaUnlimited ?? BETA_UNLIMITED_DEFAULT
    // Remise à zéro au changement de mois calendaire — pour LES DEUX
    // compteurs d'un coup, pas seulement celui qu'on incrémente ici,
    // sinon l'autre resterait périmé jusqu'à son propre prochain appel.
    const sameMonth = data.month === month
    const before = sameMonth ? data[type] || 0 : 0
    const otherBefore = sameMonth ? data[otherType] || 0 : 0

    if (!betaUnlimited && before >= limit) {
      return { allowed: false, count: before, limit, betaUnlimited }
    }

    const count = before + 1
    tx.set(quotaRef, { month, [type]: count, [otherType]: otherBefore, betaUnlimited })
    return { allowed: true, count, limit, betaUnlimited }
  })

  if (result.allowed) {
    recordQuotaExcessIfNeeded(userId, type, month, result.count, result.limit)
  }

  return result
}

/**
 * Point de mesure exploitable : dès qu'un compte dépasse le seuil
 * gratuit — même en bêta, où l'action reste autorisée — on note
 * l'excès dans une collection lisible par l'admin uniquement. Un seul
 * document par (compte, mois, type), mis à jour à chaque nouveau
 * dépassement plutôt que dupliqué, pour compter des COMPTES en excès,
 * pas des ÉVÉNEMENTS. Ça répond à la question "ces seuils sont-ils
 * bien calibrés ?" avant de les activer pour de vrai.
 */
function recordQuotaExcessIfNeeded(userId, type, month, count, limit) {
  if (count <= limit) return
  const alertRef = doc(db, 'quota_alerts', `${userId}_${month}_${type}`)
  // Best-effort — un échec ici (ex: règles pas encore déployées) ne
  // doit jamais faire échouer l'action déjà autorisée par la transaction.
  setDoc(alertRef, {
    uid: userId,
    type,
    month,
    count,
    limit,
    lastAt: new Date().toISOString(),
  }).catch((err) => console.warn('Écriture quota_alerts échouée (non bloquant):', err))
}
