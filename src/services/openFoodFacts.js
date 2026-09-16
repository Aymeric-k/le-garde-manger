// ─── Dictionnaire d'abréviations GMS courantes ───────────────────────────
// Étendu au fil des tickets rencontrés — clé en MAJUSCULES (comparaison insensible à la casse)
const ABBREVIATIONS = {
  'SC.': 'SAUCE',
  SC: 'SAUCE',
  'SAUV.': 'SAVEUR',
  SAUV: 'SAVEUR',
  'SPL.': 'SPECIAL',
  SPL: 'SPECIAL',
  'TH.': 'THON',
  'ENT.': 'ENTIER',
  'NAT.': 'NATUREL',
  NAT: 'NATUREL',
  'ANC.': 'ANCIENS',
  'BRETZ.': 'BRETZELS',
  'CHOC.': 'CHOCOLAT',
  VTES: 'VENTES',
  MI: 'MIEL', // ambigu — pris comme hypothèse la plus fréquente sur produits sucrés/sauces
}

function expandAbbreviations(text) {
  return text
    .split(/(\s+|[,.])/)
    .map((token) => {
      const clean = token.trim().toUpperCase()
      return ABBREVIATIONS[clean] || token
    })
    .join('')
}

function stripPromoMentions(text) {
  // Supprime les mentions "+10%", "-25%", "OFFERT", "GRATUIT" qui polluent la recherche
  // Supprime aussi les indicateurs de lot/multipack ("x20", "X20", "LOT 2", "LOT DE 3")
  // — Open Food Facts référence rarement les formats promo/multipack, on cherche
  // donc plutôt le produit de base pour au moins trouver la bonne famille de produit.
  return text
    .replace(/[+-]\s?\d{1,3}\s?%/gi, ' ')
    .replace(/\b(OFFERT|GRATUIT)\b/gi, ' ')
    .replace(/\bx\s?\d{1,3}\b/gi, ' ') // "x20", "X 20"
    .replace(/\blot\s?(de)?\s?\d{1,3}\b/gi, ' ') // "LOT 2", "LOT DE 3"
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Extraction et comparaison de poids/volume ───────────────────────────
// Sur un produit générique (ex: "Nutella"), Open Food Facts renvoie des
// dizaines de variantes (formats, pays, éditions) et le texte seul ne
// suffit pas à départager. Le grammage indiqué sur le ticket est le
// signal le plus fiable qu'on ait pour trancher — "NUTELLA POT 1KG" doit
// matcher un candidat dont le format est proche de 1000g, pas 350g.

// Normalise un poids/volume en une unité commune (grammes), en traitant
// les liquides (ml/cl/l) comme équivalents en grammes — approximation
// suffisante pour départager des candidats, pas pour un calcul nutritionnel.
function parseWeightToGrams(text) {
  if (!text) return null
  const match = text.toString().match(/([\d.,]+)\s*(kg|g|l|cl|ml)\b/i)
  if (!match) return null
  const value = parseFloat(match[1].replace(',', '.'))
  const unit = match[2].toLowerCase()
  const multipliers = { g: 1, kg: 1000, ml: 1, cl: 10, l: 1000 }
  return value * (multipliers[unit] || 1)
}

function scoreCandidate(candidate, targetGrams) {
  let score = 0

  if (targetGrams !== null) {
    const candidateGrams = parseWeightToGrams(candidate.quantity)
    if (candidateGrams !== null) {
      const diff = Math.abs(candidateGrams - targetGrams)
      const ratio = diff / targetGrams
      if (ratio < 0.05)
        score += 100 // quasi identique
      else if (ratio < 0.15)
        score += 60 // proche
      else if (ratio < 0.3) score += 20 // dans le même ordre de grandeur
      // sinon 0 — format trop différent, probablement pas le bon produit
    }
  }

  // Petit bonus pour les produits vendus en France — plus pertinents
  // pour un ticket de caisse français
  if (candidate.countries_tags?.some((c) => c.includes('france'))) score += 15

  // Petit bonus si le produit a une photo — signe d'une fiche plus complète/fiable
  if (candidate.image_small_url) score += 5

  return score
}

function buildQueryVariants(texte_brut) {
  const cleaned = stripPromoMentions(texte_brut)
  const expanded = expandAbbreviations(cleaned)

  const base = expanded
    .toLowerCase()
    .replace(/\d+g\b|\d+cl\b|\d+ml\b|\d+l\b/gi, '')
    .replace(/[,.\-+/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const words = base.split(' ').filter(Boolean)

  // Variante 1 : jusqu'à 5 mots significatifs (la plus précise)
  const v1 = words.slice(0, 5).join('+')
  // Variante 2 : juste les 2 premiers mots (marque + type produit)
  // — on limite à 2 variantes (au lieu de 3) pour économiser les appels
  // OFF, qui sont plafonnés à 10/minute (voir MAX_LIVE_OFF_CALLS_PER_SCAN)
  const v2 = words.slice(0, 2).join('+')

  return [...new Set([v1, v2].filter(Boolean))]
}

// ═══════════════════════════════════════════════════════════════
// RECHERCHE — Search-a-licious (nouvelle API) puis repli legacy
// ═══════════════════════════════════════════════════════════════
// L'ancien endpoint /cgi/search.pl est officiellement déconseillé par
// Open Food Facts pour les nouvelles intégrations (il reste fonctionnel
// mais plus pour longtemps). Le remplaçant officiel est Search-a-licious
// (search.openfoodfacts.org) — une API dédiée à la recherche plein texte.
//
// ⚠️ Le format exact de réponse de Search-a-licious n'est pas
// documenté publiquement de façon exploitable au moment où ce code est
// écrit. Search-a-licious indexe la MÊME base de données produits —
// les noms de champs (product_name, brands, quantity...) devraient
// donc être identiques, seule la structure englobante change
// (probablement "hits" au lieu de "products"). Par prudence, cette
// fonction essaie plusieurs formes plausibles ET retombe silencieusement
// sur l'ancien endpoint si rien n'est exploitable — aucun risque de
// casser la recherche si cette hypothèse est légèrement fausse.

async function fetchSearchALicious(query) {
  try {
    const res = await fetch(
      `https://search.openfoodfacts.org/search?q=${query}&page_size=15&langs=fr`
    )
    if (!res.ok) return { products: [], failed: true }
    const data = await res.json()
    const hits = data.hits || data.results || data.products || []
    return { products: Array.isArray(hits) ? hits : [], failed: false }
  } catch {
    return { products: [], failed: true }
  }
}

async function fetchLegacySearch(query) {
  try {
    const fields =
      'product_name,product_name_fr,brands,quantity,image_small_url,nutriscore_grade,code,categories_tags,countries_tags'
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${query}&search_simple=1&action=process&json=1&page_size=15&lc=fr&cc=fr&fields=${fields}`
    )
    if (!res.ok) return { products: [], failed: true }
    const data = await res.json()
    return { products: data.products || [], failed: false }
  } catch {
    return { products: [], failed: true }
  }
}

async function fetchOFFSearch(query) {
  const primary = await fetchSearchALicious(query)
  if (primary.products.length > 0) return primary.products

  const fallback = await fetchLegacySearch(query)
  // "Service en panne" uniquement si les DEUX endpoints ont échoué
  // techniquement — pas simplement "0 résultat" (qui peut être un vrai
  // "ce produit n'existe pas sur OFF", pas une panne)
  searchProduct.lastCallFailedDueToService = primary.failed && fallback.failed
  return fallback.products
}

export async function searchProduct(texte_brut) {
  const variants = buildQueryVariants(texte_brut)
  const targetGrams = parseWeightToGrams(texte_brut)
  searchProduct.lastCallFailedDueToService = false // reset — évite un état périmé d'une ligne précédente

  for (const query of variants) {
    if (!query) continue
    const products = await fetchOFFSearch(query)
    if (products.length > 0) {
      // Reclasse par pertinence (poids, provenance, qualité de fiche)
      // avant de ne garder que les 3 meilleurs — au lieu de prendre
      // aveuglément l'ordre brut renvoyé par OFF.
      const ranked = [...products].sort(
        (a, b) => scoreCandidate(b, targetGrams) - scoreCandidate(a, targetGrams)
      )
      return ranked.slice(0, 3).map((p) => ({
        nom: p.product_name_fr || p.product_name || texte_brut,
        marque: p.brands || '',
        poids: p.quantity || '',
        image: p.image_small_url || null,
        nutriscore: p.nutriscore_grade || null,
        code_barres: p.code,
        categorie: p.categories_tags?.[0]?.replace('en:', '') || 'Autre',
      }))
    }
  }

  return null
}

export async function getProductByBarcode(barcode) {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`)
    const data = await res.json()
    if (data.status !== 1) return null
    const p = data.product
    return {
      nom: p.product_name_fr || p.product_name || barcode,
      marque: p.brands || '',
      poids: p.quantity || '',
      image: p.image_small_url || null,
      nutriscore: p.nutriscore_grade || null,
      code_barres: barcode,
      categorie: p.categories_tags?.[0]?.replace('en:', '') || 'Autre',
    }
  } catch {
    return null
  }
}
