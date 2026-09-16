const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1

// ═══════════════════════════════════════════════════════════════
// SCAN DE TICKET — Google Document AI (Expense Parser)
// ═══════════════════════════════════════════════════════════════
// Contrairement à GPT-4o-mini vision (utilisé pour les recettes),
// Document AI n'est pas un prompt — c'est un processeur pré-entraîné
// spécifiquement sur les tickets de caisse / notes de frais. On lui
// envoie l'image, il retourne des champs structurés (articles, prix,
// enseigne, date) avec un score de confiance par champ.
//
// Processeur : "kesoir ticket" (Expense Parser)
// Région     : eu (RGPD — données traitées en Europe)
// ID         : d42546302c6062a1

const PROJECT_ID = 'kesoir'
const LOCATION = 'eu'
const PROCESSOR_ID = 'd42546302c6062a1'

// Les processeurs en région "eu" exigent un endpoint régional dédié —
// sans ça, l'appel part par défaut vers l'endpoint US et échoue.
const client = new DocumentProcessorServiceClient({
  apiEndpoint: 'eu-documentai.googleapis.com',
})

/**
 * Extrait les lignes produit d'une réponse Document AI (Expense Parser).
 * Chaque "line_item" a des sous-propriétés (description, montant) —
 * on les aplati dans le même format que le reste de Kësoir attend :
 * { texte_brut, prix, poids, section, type }
 */
function extractLignesFromDocumentAI(document) {
  const lignes = []
  let enseigne = null
  let lieu = null
  let date = null

  for (const entity of document.entities || []) {
    if (entity.type === 'supplier_name' && entity.mentionText) {
      enseigne = entity.mentionText
    }
    // ⚠️ "supplier_address" contient la ville/adresse — jamais lu avant,
    // c'est pourquoi "lieu" était toujours vide.
    if (entity.type === 'supplier_address' && entity.mentionText) {
      lieu = entity.mentionText
    }
    if (entity.type === 'receipt_date' && entity.mentionText) {
      date = entity.mentionText
    }

    if (entity.type === 'line_item') {
      let description = null
      let amount = null

      for (const prop of entity.properties || []) {
        if (prop.type === 'line_item/description') {
          description = prop.mentionText
        }
        if (prop.type === 'line_item/amount') {
          // normalizedValue.moneyValue est plus fiable que le texte brut
          // quand Document AI a réussi à le structurer
          const money = prop.normalizedValue?.moneyValue
          const raw = money
            ? parseFloat(money.units || 0) + (money.nanos || 0) / 1e9
            : parseFloat((prop.mentionText || '').replace(',', '.').replace(/[^\d.]/g, ''))
          // Arrondi à 2 décimales — sans ça, la division nanos/1e9 en
          // flottant binaire produit des artefacts du type 1.6600000000000000001
          amount = isNaN(raw) ? null : Math.round(raw * 100) / 100
        }
      }

      // On ignore les lignes sans description OU sans prix valide.
      // Document AI extrait parfois les en-têtes de rayon du ticket
      // (">> EPICERIE SALEE", ">> JUS FRUITS/...") comme des faux
      // line_item — elles n'ont jamais de prix associé, donc ce filtre
      // les élimine naturellement sans logique de détection complexe.
      if (description && amount !== null && amount > 0) {
        lignes.push({
          texte_brut: description,
          prix: amount,
          poids: null, // Document AI Expense Parser n'extrait pas le grammage
          section: null, // pas de notion de rayon dans ce processeur
          type: 'alimentaire', // affiné manuellement par l'utilisateur si besoin
        })
      }
    }
  }

  // Repli sur le texte OCR brut si "supplier_name" n'a pas été détecté
  // avec assez de confiance — c'est un champ connu pour être moins
  // fiable que les autres chez Document AI, en particulier quand le nom
  // du magasin est un logo stylisé plutôt qu'un texte plat. Le nom du
  // magasin est presque toujours la toute première ligne imprimée du
  // ticket, donc on la récupère directement depuis le texte brut OCR
  // (qui, lui, capte le texte même sous un logo) en dernier recours.
  const ocrLines = (document.text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 2)

  if (!enseigne && ocrLines.length > 0) {
    enseigne = ocrLines[0]
  }

  // "supplier_address" n'est quasiment jamais renseigné par Document AI
  // sur des tickets de supermarché français (processeur entraîné
  // surtout sur des factures anglo-saxonnes). Sur un ticket français,
  // la ville suit presque toujours immédiatement le nom du magasin, au
  // format "54800 CONFLANS" — on cherche ce motif dans les premières
  // lignes du texte OCR brut.
  if (!lieu) {
    const cityLine = ocrLines.slice(0, 4).find((l) => /\d{5}\s+[A-ZÀ-Ÿ]/i.test(l))
    if (cityLine) lieu = cityLine
  }

  return { enseigne, lieu, date, lignes }
}

exports.parseReceiptWithDocumentAI = onCall(
  {
    region: 'europe-west1', // Cloud Function proche de la région du processeur
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Tu dois être connecté.')
    }

    const { imageBase64, mimeType } = request.data
    if (!imageBase64) {
      throw new HttpsError('invalid-argument', 'Image manquante.')
    }

    const name = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`

    try {
      const [result] = await client.processDocument({
        name,
        rawDocument: {
          content: imageBase64,
          mimeType: mimeType || 'image/jpeg',
        },
      })

      const { enseigne, lieu, date, lignes } = extractLignesFromDocumentAI(result.document)

      return {
        enseigne: enseigne || null,
        lieu: lieu || null,
        date: date || null,
        lignes,
      }
    } catch (error) {
      console.error('Erreur Document AI:', error)
      throw new HttpsError('internal', "Impossible d'analyser ce ticket.")
    }
  }
)
