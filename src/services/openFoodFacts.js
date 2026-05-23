export async function searchProduct(texte_brut) {
  // Nettoie le texte brut pour la recherche
  // Enlève les abréviations de grammage, ponctuation
  const query = texte_brut
    .toLowerCase()
    .replace(/\d+g\b|\d+cl\b|\d+ml\b|\d+l\b/gi, '') // enlève les poids
    .replace(/[,\.\-\+\/]/g, ' ') // ponctuation → espaces
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 5) // garde les 5 premiers mots significatifs
    .join('+')

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${query}&search_simple=1&action=process&json=1&page_size=3&lc=fr&cc=fr`
    )
    const data = await res.json()

    if (!data.products?.length) return null

    return data.products.slice(0, 3).map((p) => ({
      nom: p.product_name_fr || p.product_name || texte_brut,
      marque: p.brands || '',
      poids: p.quantity || '',
      image: p.image_small_url || null,
      nutriscore: p.nutriscore_grade || null,
      code_barres: p.code,
      categorie: p.categories_tags?.[0]?.replace('en:', '') || 'Autre',
    }))
  } catch {
    return null
  }
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
