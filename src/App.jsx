import { useState, useEffect, useRef } from 'react'

// ─── Palette & Design Tokens ───────────────────────────────────────────────
const C = {
  bg: '#f5f0e8', // parchemin chaud
  bgDeep: '#ede6d6', // parchemin foncé
  bgCard: '#faf7f0', // carte crème
  bgInset: '#ede8dc', // input inset
  brown: '#6b4226', // brun principal
  brownMid: '#9c6644', // brun moyen
  brownLight: '#c49a72', // brun clair
  green: '#4a7c59', // vert sauge foncé
  greenMid: '#6a9e78', // vert sauge
  greenLight: '#a8c5a0', // vert clair
  terra: '#c1602a', // terre cuite accent
  terraLight: '#e8956a', // terre cuite clair
  text: '#3a2a1a', // texte principal
  textMid: '#7a5c40', // texte secondaire
  textLight: '#b0987a', // texte léger
  border: '#ddd0b8', // bordure
  borderDark: '#c4af90', // bordure foncée
  warning: '#c1602a', // alerte = terre cuite
  ok: '#4a7c59', // ok = vert
  star: '#d4a017', // étoile doré
}

// ─── Data ──────────────────────────────────────────────────────────────────
const EQUIPMENT_PRESETS = [
  { id: 'airfryer', label: 'Air Fryer', icon: '🌀' },
  { id: 'robot', label: 'Robot Cuiseur', icon: '🤖' },
  { id: 'plancha', label: 'Plancha', icon: '🔥' },
  { id: 'four', label: 'Four', icon: '🟧' },
  { id: 'micro_ondes', label: 'Micro-ondes', icon: '📡' },
  { id: 'plaques', label: 'Plaques', icon: '⭕' },
  { id: 'cocotte', label: 'Cocotte Minute', icon: '🫕' },
  { id: 'mixeur', label: 'Mixeur/Blender', icon: '🌪️' },
  { id: 'gril', label: 'Gril/Barbecue', icon: '🍖' },
  { id: 'wok', label: 'Wok', icon: '🥘' },
]

const STORAGE_TYPES = [
  { id: 'frigo_jour', label: 'Frigo 1-2j', icon: '❄️', color: C.brownLight },
  { id: 'frigo_semaine', label: 'Frigo 5-7j', icon: '🧊', color: C.green },
  { id: 'congelateur', label: 'Congélateur', icon: '🌨️', color: C.brownMid },
  { id: 'garde_manger', label: 'Garde-manger', icon: '🏺', color: C.terra },
]

const CATEGORIES = [
  'Légumes',
  'Fruits',
  'Viande/Poisson',
  'Féculents',
  'Laitiers',
  'Épices/Sauces',
  'Conserves',
  'Autre',
]
const UNITS = ['g', 'kg', 'ml', 'L', 'pièce(s)', 'boîte(s)', 'sachet(s)', 'botte(s)', 'tranche(s)']

const ENERGY_LEVELS = [
  { id: 'vide', label: 'À plat 🪫', desc: '5-10 min, zéro effort' },
  { id: 'faible', label: 'Fatigué 😮‍💨', desc: '15-20 min, simple' },
  { id: 'moyen', label: 'Correct 😐', desc: '30 min, quelques étapes' },
  { id: 'bon', label: 'En forme 💪', desc: '45 min+, je peux cuisiner' },
]

const OBJECTIVES = [
  { id: 'rapide', label: '⚡ Rapide' },
  { id: 'economique', label: '💶 Éco' },
  { id: 'dietetique', label: '🥗 Diét.' },
  { id: 'batch_semaine', label: '📦 Batch semaine' },
  { id: 'garde_demain', label: '🥡 Garde demain' },
  { id: 'dimanche_soir', label: '🌙 Prep dimanche' },
  { id: 'anti_gaspi', label: '♻️ Anti-gaspi' },
]

const STORAGE_KEYS = {
  ingredients: 'lgm_ingredients',
  equipment: 'lgm_equipment',
  shoppingLists: 'lgm_shopping',
  users: 'lgm_users',
  ratings: 'lgm_ratings',
  cookLogs: 'lgm_cooklogs',
  nonFood: 'lgm_nonfood',
}

const NONFOOD_CATEGORIES = [
  'Hygiène',
  'Entretien',
  'Beauté',
  'Papeterie',
  'Animalerie',
  'Autre maison',
]
const NONFOOD_UNITS = [
  'pièce(s)',
  'rouleau(x)',
  'flacon(s)',
  'tube(s)',
  'boîte(s)',
  'paquet(s)',
  'L',
  'ml',
  'g',
]

// ─── Helpers ───────────────────────────────────────────────────────────────
function getDaysLeft(dlc) {
  if (!dlc) return null
  return Math.ceil((new Date(dlc) - new Date()) / 86400000)
}

function useStorage(key, init) {
  const [val, setVal] = useState(() => {
    try {
      const s = localStorage.getItem(key)
      return s ? JSON.parse(s) : init
    } catch {
      return init
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(val))
    } catch {}
  }, [val, key])
  return [val, setVal]
}

// ─── Micro Components ──────────────────────────────────────────────────────
function DlcBadge({ dlc }) {
  const d = getDaysLeft(dlc)
  if (d === null) return null
  const color = d < 0 ? '#c0392b' : d <= 2 ? C.terra : d <= 5 ? '#d4a017' : C.green
  const label = d < 0 ? 'Périmé !' : d === 0 ? 'Auj.' : `J-${d}`
  return (
    <span
      style={{
        fontSize: '10px',
        fontWeight: 700,
        padding: '2px 7px',
        borderRadius: '999px',
        background: color + '20',
        color,
        border: `1px solid ${color}50`,
        fontFamily: "'Lato',sans-serif",
      }}
    >
      {label}
    </span>
  )
}

function Stars({ value, onChange, size = 18 }) {
  const [hover, setHover] = useState(0)
  return (
    <span style={{ display: 'inline-flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          style={{
            fontSize: size,
            cursor: onChange ? 'pointer' : 'default',
            color: (hover || value) >= n ? C.star : C.border,
            transition: 'color 0.1s',
          }}
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => onChange && setHover(0)}
          onClick={() => onChange && onChange(n)}
        >
          ★
        </span>
      ))}
    </span>
  )
}

function Pill({ label, color }) {
  return (
    <span
      style={{
        fontSize: '10px',
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: '999px',
        background: color + '22',
        color,
        border: `1px solid ${color}40`,
        fontFamily: "'Lato',sans-serif",
      }}
    >
      {label}
    </span>
  )
}

function Btn({ children, onClick, disabled, variant = 'primary', small = false }) {
  const base = {
    border: 'none',
    borderRadius: '12px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: "'Playfair Display',serif",
    fontWeight: 700,
    transition: 'all 0.18s',
    opacity: disabled ? 0.5 : 1,
  }
  const variants = {
    primary: {
      background: `linear-gradient(135deg,${C.brown},${C.brownMid})`,
      color: '#fff',
      padding: small ? '8px 14px' : '13px 20px',
      fontSize: small ? '12px' : '14px',
      boxShadow: `0 3px 12px ${C.brown}40`,
    },
    green: {
      background: `linear-gradient(135deg,${C.green},${C.greenMid})`,
      color: '#fff',
      padding: small ? '8px 14px' : '13px 20px',
      fontSize: small ? '12px' : '14px',
      boxShadow: `0 3px 12px ${C.green}40`,
    },
    outline: {
      background: 'transparent',
      color: C.brown,
      border: `1.5px solid ${C.borderDark}`,
      padding: small ? '7px 12px' : '11px 16px',
      fontSize: small ? '12px' : '13px',
    },
    ghost: {
      background: 'transparent',
      color: C.textMid,
      padding: small ? '6px 10px' : '10px 14px',
      fontSize: small ? '12px' : '13px',
    },
    danger: {
      background: '#c0392b18',
      color: '#c0392b',
      border: '1px solid #c0392b44',
      padding: small ? '7px 12px' : '11px 16px',
      fontSize: small ? '12px' : '13px',
    },
  }
  return (
    <button
      style={{
        ...base,
        ...variants[variant],
        width:
          variant !== 'outline' && variant !== 'ghost' && variant !== 'danger' ? '100%' : 'auto',
      }}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

function Input({ placeholder, value, onChange, type = 'text', multiline = false }) {
  const style = {
    background: C.bgInset,
    border: `1.5px solid ${C.border}`,
    borderRadius: '10px',
    padding: '10px 13px',
    color: C.text,
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: "'Lato',sans-serif",
    outline: 'none',
    resize: multiline ? 'vertical' : 'none',
  }
  return multiline ? (
    <textarea
      style={{ ...style, minHeight: '75px' }}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ) : (
    <input
      style={style}
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function Select({ value, onChange, children }) {
  return (
    <select
      style={{
        background: C.bgInset,
        border: `1.5px solid ${C.border}`,
        borderRadius: '10px',
        padding: '10px 13px',
        color: C.text,
        fontSize: '14px',
        width: '100%',
        boxSizing: 'border-box',
        fontFamily: "'Lato',sans-serif",
      }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {children}
    </select>
  )
}

function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: '10px',
        fontWeight: 700,
        color: C.textLight,
        textTransform: 'uppercase',
        letterSpacing: '1px',
        marginBottom: '10px',
        fontFamily: "'Lato',sans-serif",
      }}
    >
      {children}
    </div>
  )
}

function Card({ children, accent = false, style = {} }) {
  return (
    <div
      style={{
        background: C.bgCard,
        borderRadius: '16px',
        padding: '14px',
        marginBottom: '11px',
        border: `1.5px solid ${accent ? C.terra + '60' : C.border}`,
        boxShadow: `0 2px 8px ${C.brown}0a`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('frigo')
  const [ingredients, setIngredients] = useStorage(STORAGE_KEYS.ingredients, [])
  const [equipment, setEquipment] = useStorage(STORAGE_KEYS.equipment, [])
  const [shoppingLists, setShoppingLists] = useStorage(STORAGE_KEYS.shoppingLists, [])
  const [users, setUsers] = useStorage(STORAGE_KEYS.users, [])
  const [ratings, setRatings] = useStorage(STORAGE_KEYS.ratings, [])
  const [cookLogs, setCookLogs] = useStorage(STORAGE_KEYS.cookLogs, [])
  const [nonFood, setNonFood] = useStorage(STORAGE_KEYS.nonFood, [])

  // Ticket scan state
  const [showScanPanel, setShowScanPanel] = useState(false)
  const [scanLoading, setScanLoading] = useState(false)
  const [scanResult, setScanResult] = useState(null) // { food:[], nonFood:[], enseigne, lieu }
  const [scanConfirm, setScanConfirm] = useState(null) // items à confirmer
  const [fridgeSubTab, setFridgeSubTab] = useState('food') // "food" | "maison"

  // Adapt panel state
  const [adaptTarget, setAdaptTarget] = useState(null)
  const [adaptProblem, setAdaptProblem] = useState('')
  const [adaptLoading, setAdaptLoading] = useState(false)
  const [adaptResult, setAdaptResult] = useState(null)
  const [showAdaptPanel, setShowAdaptPanel] = useState(false)

  // Cook feedback state
  const [cookTarget, setCookTarget] = useState(null)
  const [cookFeedback, setCookFeedback] = useState({ difficulty: '', remark: '' })
  const [showCookPanel, setShowCookPanel] = useState(false)

  // Frigo state
  const [showAddIng, setShowAddIng] = useState(false)
  const [filterCat, setFilterCat] = useState('Tous')
  const [newIng, setNewIng] = useState({
    name: '',
    quantity: '',
    unit: 'g',
    category: 'Légumes',
    dlc: '',
    storage: 'frigo_semaine',
  })

  // Equipment state
  const [showAddEq, setShowAddEq] = useState(false)
  const [newEq, setNewEq] = useState({ id: '', custom: '', model: '' })

  // Recipe state
  const [energyLevel, setEnergyLevel] = useState('faible')
  const [timeAvail, setTimeAvail] = useState('20')
  const [objectives, setObjectives] = useState([])
  const [recipeResult, setRecipeResult] = useState(null)
  const [recipeLoading, setRecipeLoading] = useState(false)
  const [expandedRecipe, setExpandedRecipe] = useState(null)
  const [recipePortions, setRecipePortions] = useState({}) // { [recipeId]: number }
  const recipeResultRef = useRef(null)
  const [selectedConvives, setSelectedConvives] = useState([]) // userIds

  // Rating state
  const [ratingTarget, setRatingTarget] = useState(null) // { recipeId, recipeName }
  const [newRating, setNewRating] = useState({ userId: '', note: '', stars: 0, comment: '' })
  const [showRatingPanel, setShowRatingPanel] = useState(false)

  // Users state
  const [showUsers, setShowUsers] = useState(false)
  const [newUserName, setNewUserName] = useState('')

  // Shopping state
  const [shoppingGoal, setShoppingGoal] = useState('')
  const [shoppingLoading, setShoppingLoading] = useState(false)
  const [activeList, setActiveList] = useState(null)
  const [showAddList, setShowAddList] = useState(false)

  // ── Frigo helpers
  const urgentIngs = ingredients
    .filter((i) => {
      const d = getDaysLeft(i.dlc)
      return d !== null && d <= 3
    })
    .sort((a, b) => getDaysLeft(a.dlc) - getDaysLeft(b.dlc))
  const filteredIngs =
    filterCat === 'Tous' ? ingredients : ingredients.filter((i) => i.category === filterCat)

  const addIngredient = () => {
    if (!newIng.name.trim()) return
    setIngredients((p) => [...p, { ...newIng, id: Date.now() }])
    setNewIng({
      name: '',
      quantity: '',
      unit: 'g',
      category: 'Légumes',
      dlc: '',
      storage: 'frigo_semaine',
    })
    setShowAddIng(false)
  }

  // ── Ticket scan
  const scanTicket = async (file) => {
    if (!file) return
    setScanLoading(true)
    setScanResult(null)
    setScanConfirm(null)
    setShowScanPanel(true)
    try {
      const base64 = await compressImage(file)
      const prompt = `Tu analyses un ticket de caisse français. Extrais tous les articles et classe-les.

Réponds UNIQUEMENT en JSON valide :
{
  "enseigne": "Leclerc",
  "lieu": "Briey",
  "date": "2025-05-21",
  "alimentaire": [
    { "nom": "Courgettes", "quantite": 500, "unite": "g", "prix": 1.20, "categorie": "Légumes", "dlc_estimee_jours": 7, "stockage": "frigo_semaine" }
  ],
  "non_alimentaire": [
    { "nom": "Liquide vaisselle", "quantite": 1, "unite": "flacon(s)", "prix": 2.50, "categorie": "Entretien" }
  ]
}

Règles :
- alimentaire = tout ce qui se mange ou se boit
- non_alimentaire = hygiène, entretien, beauté, papeterie, etc.
- dlc_estimee_jours : estime selon le type de produit (légumes frais ~5-7j, viande ~3j, conserves ~999, laitiers ~10-14j)
- stockage : "frigo_jour","frigo_semaine","congelateur","garde_manger"
- Si tu ne vois pas clairement un champ, mets null
- Ignore les articles non-produits (sacs, services, remises globales)`

      const res = await fetch('/gardemanger/api-proxy.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-proxy-token': 'lgm_2024_xK9mP3' },
        body: JSON.stringify({
          proxy_token: 'lgm_2024_xK9mP3',
          model: 'claude-sonnet-4-5',
          max_tokens: 4000,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: file.type || 'image/jpeg', data: base64 },
                },
                { type: 'text', text: prompt },
              ],
            },
          ],
        }),
      })
      const data = await res.json()
      const text = data.content?.map((b) => b.text || '').join('') || ''
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      // Prépare les items à confirmer
      const foodItems = (parsed.alimentaire || []).map((i) => ({
        ...i,
        selected: true,
        type: 'food',
      }))
      const nonFoodItems = (parsed.non_alimentaire || []).map((i) => ({
        ...i,
        selected: true,
        type: 'nonfood',
      }))
      setScanResult({ enseigne: parsed.enseigne, lieu: parsed.lieu, date: parsed.date })
      setScanConfirm([...foodItems, ...nonFoodItems])
    } catch (e) {
      setScanConfirm([])
      setScanResult({ error: true })
    }
    setScanLoading(false)
  }

  const confirmScanImport = () => {
    if (!scanConfirm) return
    const today = new Date()
    scanConfirm
      .filter((i) => i.selected)
      .forEach((item) => {
        if (item.type === 'food') {
          let dlc = ''
          if (item.dlc_estimee_jours && item.dlc_estimee_jours < 999) {
            const d = new Date(today)
            d.setDate(d.getDate() + item.dlc_estimee_jours)
            dlc = d.toISOString().split('T')[0]
          }
          setIngredients((p) => [
            ...p,
            {
              id: Date.now() + Math.random(),
              name: item.nom,
              quantity: String(item.quantite || 1),
              unit: item.unite || 'pièce(s)',
              category: item.categorie || 'Autre',
              dlc,
              storage: item.stockage || 'frigo_semaine',
            },
          ])
        } else {
          setNonFood((p) => [
            ...p,
            {
              id: Date.now() + Math.random(),
              name: item.nom,
              quantity: String(item.quantite || 1),
              unit: item.unite || 'pièce(s)',
              category: item.categorie || 'Autre maison',
              prix: item.prix,
            },
          ])
        }
      })
    setShowScanPanel(false)
    setScanConfirm(null)
    setScanResult(null)
  }
  const compressImage = (file, maxWidth = 1200) =>
    new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const ratio = Math.min(maxWidth / img.width, maxWidth / img.height, 1)
          canvas.width = img.width * ratio
          canvas.height = img.height * ratio
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
          const compressed = canvas.toDataURL('image/jpeg', 0.7).split(',')[1]
          resolve(compressed)
        }
        img.src = e.target.result
      }
      reader.readAsDataURL(file)
    })
  // ── Recipe photo analysis
  const [showRecipeAnalysis, setShowRecipeAnalysis] = useState(false)
  const [recipeAnalysisLoading, setRecipeAnalysisLoading] = useState(false)
  const [recipeAnalysisResult, setRecipeAnalysisResult] = useState(null)

  const analyzeRecipePhoto = async (file) => {
    if (!file) return
    setRecipeAnalysisLoading(true)
    setRecipeAnalysisResult(null)
    setShowRecipeAnalysis(true)
    try {
      const base64 = await compressImage(file)

      const inventaire =
        ingredients.map((i) => `${i.name} (${i.quantity}${i.unit})`).join(', ') || 'Inventaire vide'

      const prompt = `Tu es un chef cuisinier. Analyse cette photo de recette de cuisine et croise avec l'inventaire disponible.

INVENTAIRE DISPONIBLE :
${inventaire}

Identifie tous les ingrédients de la recette visible sur la photo.
Pour chaque ingrédient, détermine s'il est disponible dans l'inventaire, substituable, ou manquant.

Réponds UNIQUEMENT en JSON valide :
{
  "nom_recette": "Nom de la recette identifiée",
  "portions_recette": 4,
  "ingredients": [
    {
      "nom": "Œufs",
      "quantite": "4",
      "unite": "pièce(s)",
      "statut": "disponible",
      "note": "Tu en as 6 dans ton inventaire"
    },
    {
      "nom": "Crème fraîche",
      "quantite": "200",
      "unite": "ml",
      "statut": "substituable",
      "substitut": "Yaourt grec",
      "note": "Le yaourt grec que tu as fonctionne très bien ici"
    },
    {
      "nom": "Lardons fumés",
      "quantite": "150",
      "unite": "g",
      "statut": "manquant",
      "note": "À ajouter à ta liste de courses"
    }
  ],
  "conseil_chef": "Un conseil global pour réussir cette recette"
}

Statuts possibles : "disponible", "substituable", "manquant"`

      const res = await fetch('/gardemanger/api-proxy.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-proxy-token': 'lgm_2024_xK9mP3' },
        body: JSON.stringify({
          proxy_token: 'lgm_2024_xK9mP3',
          model: 'claude-sonnet-4-5',
          max_tokens: 4000,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: file.type || 'image/jpeg', data: base64 },
                },
                { type: 'text', text: prompt },
              ],
            },
          ],
        }),
      })
      const data = await res.json()
      const text = data.content?.map((b) => b.text || '').join('') || ''
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      setRecipeAnalysisResult(parsed)
    } catch {
      setRecipeAnalysisResult({ error: true })
    }
    setRecipeAnalysisLoading(false)
  }

  const addMissingToShoppingList = () => {
    if (!recipeAnalysisResult?.ingredients) return
    const missing = recipeAnalysisResult.ingredients.filter((i) => i.statut === 'manquant')
    if (!missing.length) return
    const newList = {
      id: Date.now(),
      goal: `Recette : ${recipeAnalysisResult.nom_recette}`,
      titre: recipeAnalysisResult.nom_recette,
      budget_estime: 'À estimer',
      repas_couverts: `${recipeAnalysisResult.portions_recette || '?'} portions`,
      categories: [
        {
          nom: 'Ingrédients manquants',
          items: missing.map((i) => ({
            nom: i.nom,
            quantite: `${i.quantite} ${i.unite}`,
            conseil: i.note,
            prix_estime: '',
          })),
        },
      ],
      conseils: recipeAnalysisResult.conseil_chef ? [recipeAnalysisResult.conseil_chef] : [],
      checked: {},
    }
    setShoppingLists((p) => [newList, ...p])
    setActiveList(newList.id)
    setShowRecipeAnalysis(false)
    setRecipeAnalysisResult(null)
    setTab('courses')
  }
  const addEquipment = () => {
    const preset = EQUIPMENT_PRESETS.find((p) => p.id === newEq.id)
    if (!preset && !newEq.custom.trim()) return
    const eq = preset
      ? { ...preset, model: newEq.model, uid: Date.now() }
      : {
          id: `c_${Date.now()}`,
          label: newEq.custom,
          icon: '🔧',
          model: newEq.model,
          uid: Date.now(),
        }
    if (!equipment.find((e) => e.id === eq.id)) setEquipment((p) => [...p, eq])
    setNewEq({ id: '', custom: '', model: '' })
    setShowAddEq(false)
  }

  // ── Recipe helpers
  const toggleObjective = (id) =>
    setObjectives((p) => (p.includes(id) ? p.filter((o) => o !== id) : [...p, id]))

  const getPortions = (recipe) => recipePortions[recipe.id] || recipe.portions || 2
  const setPortions = (recipeId, basePortions, val) => {
    const clamped = Math.max(1, Math.min(20, val))
    setRecipePortions((p) => ({ ...p, [recipeId]: clamped }))
  }
  const scaleQty = (qty, basePortions, currentPortions) => {
    const scaled = (qty / basePortions) * currentPortions
    if (scaled === Math.round(scaled)) return String(Math.round(scaled))
    return scaled < 10 ? scaled.toFixed(1).replace(/\.0$/, '') : String(Math.round(scaled))
  }

  const generateRecipes = async () => {
    if (!ingredients.length) return
    setRecipeLoading(true)
    setRecipeResult(null)
    setExpandedRecipe(null)
    setRecipePortions({})

    const eqList =
      equipment.map((e) => `${e.label}${e.model ? ` (${e.model})` : ''}`).join(', ') ||
      'Équipement de base'
    const ingList = ingredients
      .map((i) => {
        const d = getDaysLeft(i.dlc)
        return `${i.name} (${i.quantity}${i.unit}${d !== null && d <= 2 ? ' ⚠️À utiliser vite' : ''})`
      })
      .join('\n')
    const objList =
      objectives
        .map((o) => OBJECTIVES.find((x) => x.id === o)?.label)
        .filter(Boolean)
        .join(', ') || 'Aucun'
    const eLvl = ENERGY_LEVELS.find((e) => e.id === energyLevel)?.label || energyLevel

    const convivesNames = selectedConvives
      .map((id) => users.find((u) => u.id === id)?.name)
      .filter(Boolean)
    const convivesContext =
      convivesNames.length > 0 ? `\nCONVIVES : ${convivesNames.join(', ')}` : ''
    const ratingContext =
      ratings.length > 0
        ? '\n\nHISTORIQUE DES NOTES (tiens compte de ces préférences) :\n' +
          ratings
            .slice(-10)
            .map(
              (r) =>
                `${r.recipeName} — ${r.userName} : ${r.stars}/5${r.comment ? ` "${r.comment}"` : ''}`
            )
            .join('\n')
        : ''

    const cookContext =
      cookLogs.length > 0
        ? '\n\nRETOURS DU CUISINIER (tiens compte de ces difficultés) :\n' +
          cookLogs
            .slice(-5)
            .map(
              (l) =>
                `${l.recipeName}${l.difficulty ? ` — Difficulté: ${l.difficulty}` : ''}${l.remark ? ` — Remarque: ${l.remark}` : ''}`
            )
            .join('\n')
        : ''

    const prompt = `Tu es un chef cuisinier bienveillant qui aide un cuisinier apprenti. Parle simplement, sans jargon (ou explique-le).

INGRÉDIENTS DISPONIBLES :
${ingList}

ÉQUIPEMENT : ${eqList}
NIVEAU D'ÉNERGIE : ${eLvl}
TEMPS DISPONIBLE : ${timeAvail} minutes
OBJECTIFS : ${objList}${convivesContext}${ratingContext}${cookContext}

Génère exactement 3 recettes. Réponds UNIQUEMENT en JSON valide :

{
  "recettes": [
    {
      "id": "unique_id_1",
      "nom": "Nom de la recette",
      "emoji": "🍳",
      "temps": 15,
      "difficulte": "facile",
      "portions": 2,
      "conservation_label": "Se conserve 5 jours au frigo",
      "objectifs_couverts": ["rapide"],
      "description": "Description courte et appétissante",
      "ingredients_detail": [
        { "nom": "Œufs", "quantite": 3, "unite": "pièce(s)" },
        { "nom": "Lardons", "quantite": 100, "unite": "g" }
      ],
      "etapes": ["Étape 1 avec quantités précises ex: Battre les 3 œufs", "Étape 2"],
      "conseil": "Un conseil pratique",
      "termes_expliques": {}
    }
  ]
}`

    try {
      const res = await fetch('/gardemanger/api-proxy.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-proxy-token': 'lgm_2024_xK9mP3' },
        body: JSON.stringify({
          proxy_token: 'lgm_2024_xK9mP3',
          model: 'claude-sonnet-4-5',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      const text = data.content?.map((b) => b.text || '').join('') || ''
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      setRecipeResult(parsed.recettes || [])
      setTimeout(
        () => recipeResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        100
      )
    } catch (e) {
      setRecipeResult([
        {
          id: 'err',
          nom: 'Erreur',
          emoji: '❌',
          description: `Erreur: ${e?.message || JSON.stringify(e) || 'inconnue'}`,
          etapes: [],
        },
      ])
    }
    setRecipeLoading(false)
  }

  // ── Adapt helpers
  const openAdapt = (recipe) => {
    setAdaptTarget(recipe)
    setAdaptProblem('')
    setAdaptResult(null)
    setShowAdaptPanel(true)
  }

  const generateAdaptation = async () => {
    if (!adaptTarget || !adaptProblem.trim()) return
    setAdaptLoading(true)
    setAdaptResult(null)
    const eqList = equipment.map((e) => e.label).join(', ') || 'Équipement de base'
    const ingList = ingredients.map((i) => i.name).join(', ')
    const prompt = `Tu es un chef cuisinier bienveillant. Le cuisinier rencontre un problème en pleine préparation.

RECETTE EN COURS : ${adaptTarget.nom}
ÉTAPES PRÉVUES : ${adaptTarget.etapes?.join(' | ') || 'N/A'}
INGRÉDIENTS PRÉVUS : ${adaptTarget.ingredients_utilises?.join(', ') || 'N/A'}
ÉQUIPEMENT DISPONIBLE : ${eqList}
TOUS LES INGRÉDIENTS EN STOCK : ${ingList}

PROBLÈME RENCONTRÉ : ${adaptProblem}

Propose une adaptation immédiate, simple, en gardant le même esprit de plat. Réponds UNIQUEMENT en JSON valide :
{
  "titre": "Nouvelle version adaptée",
  "explication": "Ce qui change et pourquoi ça marche quand même",
  "etapes_modifiees": ["Étape 1 adaptée", "Étape 2"],
  "conseil": "Un conseil de chef pour réussir malgré tout"
}`
    try {
      const res = await fetch('/gardemanger/api-proxy.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-proxy-token': 'lgm_2024_xK9mP3' },
        body: JSON.stringify({
          proxy_token: 'lgm_2024_xK9mP3',
          model: 'claude-sonnet-4-5',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      const text = data.content?.map((b) => b.text || '').join('') || ''
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      setAdaptResult(parsed)
    } catch {
      setAdaptResult({
        titre: 'Erreur',
        explication: "Impossible d'adapter. Réessaie.",
        etapes_modifiees: [],
      })
    }
    setAdaptLoading(false)
  }

  // ── Cook feedback helpers
  const openCookFeedback = (recipe) => {
    setCookTarget(recipe)
    setCookFeedback({ difficulty: '', remark: '' })
    setShowCookPanel(true)
  }

  const submitCookFeedback = () => {
    if (!cookTarget) return
    setCookLogs((p) => [
      ...p,
      {
        id: Date.now(),
        recipeId: cookTarget.id,
        recipeName: cookTarget.nom,
        difficulty: cookFeedback.difficulty,
        remark: cookFeedback.remark,
        date: new Date().toISOString(),
      },
    ])
    setCookFeedback({ difficulty: '', remark: '' })
    setShowCookPanel(false)
  }

  const getCookLog = (recipeId) => cookLogs.find((l) => l.recipeId === recipeId)

  // ── Rating helpers
  const openRating = (recipe) => {
    setRatingTarget({ recipeId: recipe.id, recipeName: recipe.nom })
    setNewRating({ userId: '', note: '', stars: 0, comment: '' })
    setShowRatingPanel(true)
  }

  const submitRating = () => {
    if (!ratingTarget || !newRating.userId || !newRating.stars) return
    const user = users.find((u) => u.id === newRating.userId)
    setRatings((p) => [
      ...p,
      {
        id: Date.now(),
        recipeId: ratingTarget.recipeId,
        recipeName: ratingTarget.recipeName,
        userId: newRating.userId,
        userName: user?.name || '?',
        stars: newRating.stars,
        comment: newRating.comment,
        date: new Date().toISOString(),
      },
    ])
    setNewRating({ userId: '', note: '', stars: 0, comment: '' })
    setShowRatingPanel(false)
  }

  const getRecipeRatings = (recipeId) => ratings.filter((r) => r.recipeId === recipeId)
  const avgRating = (recipeId) => {
    const rs = getRecipeRatings(recipeId)
    if (!rs.length) return null
    return (rs.reduce((s, r) => s + r.stars, 0) / rs.length).toFixed(1)
  }

  // ── User helpers
  const addUser = () => {
    if (!newUserName.trim()) return
    setUsers((p) => [...p, { id: Date.now().toString(), name: newUserName.trim() }])
    setNewUserName('')
  }

  // ── Shopping helpers
  const generateShoppingList = async () => {
    if (!shoppingGoal.trim()) return
    setShoppingLoading(true)
    const eqList = equipment.map((e) => e.label).join(', ') || 'Basique'
    const ingList = ingredients.map((i) => i.name).join(', ') || 'Aucun'
    const prompt = `Tu es un assistant cuisine. Génère une liste de courses intelligente.

OBJECTIF : ${shoppingGoal}
ÉQUIPEMENT : ${eqList}
DÉJÀ EN STOCK : ${ingList}

Réponds UNIQUEMENT en JSON valide :
{
  "titre": "Titre court",
  "budget_estime": "15-25€",
  "repas_couverts": "5 déjeuners",
  "categories": [
    { "nom": "Légumes", "items": [{ "nom": "Courgettes", "quantite": "3", "conseil": "Choisir fermes", "prix_estime": "1.50€" }] }
  ],
  "conseils": ["Conseil 1"]
}`
    try {
      const res = await fetch('/gardemanger/api-proxy.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-proxy-token': 'lgm_2024_xK9mP3' },
        body: JSON.stringify({
          proxy_token: 'lgm_2024_xK9mP3',
          model: 'claude-sonnet-4-5',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      const text = data.content?.map((b) => b.text || '').join('') || ''
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      const list = { id: Date.now(), goal: shoppingGoal, ...parsed, checked: {} }
      setShoppingLists((p) => [list, ...p])
      setActiveList(list.id)
      setShoppingGoal('')
      setShowAddList(false)
    } catch {}
    setShoppingLoading(false)
  }

  const toggleItem = (listId, cat, item) => {
    setShoppingLists((p) =>
      p.map((l) => {
        if (l.id !== listId) return l
        const k = `${cat}-${item}`
        return { ...l, checked: { ...l.checked, [k]: !l.checked?.[k] } }
      })
    )
  }

  // ─────────────────────────────────────────────────────────────── RENDER ──
  const st = {
    app: {
      minHeight: '100vh',
      background: C.bg,
      color: C.text,
      fontFamily: "'Lato',sans-serif",
      maxWidth: '430px',
      margin: '0 auto',
    },
    header: {
      padding: '20px 18px 14px',
      background: `linear-gradient(160deg,${C.bgDeep},${C.bg})`,
      borderBottom: `1.5px solid ${C.border}`,
    },
    title: {
      fontFamily: "'Playfair Display',serif",
      fontSize: '26px',
      fontWeight: 900,
      color: C.brown,
      letterSpacing: '-0.5px',
    },
    sub: { fontSize: '11px', color: C.textLight, marginTop: '2px', fontStyle: 'italic' },
    tabs: {
      display: 'flex',
      background: C.bgDeep,
      borderBottom: `1.5px solid ${C.border}`,
      position: 'sticky',
      top: 0,
      zIndex: 10,
    },
    tab: (a) => ({
      flex: 1,
      padding: '11px 4px',
      fontSize: '10px',
      fontWeight: a ? 700 : 400,
      color: a ? C.brown : C.textLight,
      background: 'none',
      border: 'none',
      borderBottom: a ? `2.5px solid ${C.brown}` : '2.5px solid transparent',
      cursor: 'pointer',
      fontFamily: "'Lato',sans-serif",
      letterSpacing: '0.3px',
    }),
    content: { padding: '14px 14px 90px' },
    urgentBar: {
      margin: '0 0 12px',
      padding: '10px 13px',
      background: `${C.terra}15`,
      border: `1px solid ${C.terra}40`,
      borderRadius: '12px',
      fontSize: '12px',
      color: C.terra,
    },
    objBtn: (a) => ({
      padding: '7px 11px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: 700,
      border: a ? `1.5px solid ${C.brown}` : `1px solid ${C.border}`,
      background: a ? `${C.brown}18` : C.bgInset,
      color: a ? C.brown : C.textLight,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      fontFamily: "'Lato',sans-serif",
    }),
    energyBtn: (a) => ({
      padding: '10px 13px',
      borderRadius: '12px',
      textAlign: 'left',
      width: '100%',
      border: a ? `1.5px solid ${C.green}` : `1px solid ${C.border}`,
      background: a ? `${C.green}12` : C.bgInset,
      color: a ? C.green : C.textMid,
      cursor: 'pointer',
      marginBottom: '6px',
      fontFamily: "'Lato',sans-serif",
    }),
    recipeCard: {
      background: C.bgCard,
      borderRadius: '18px',
      border: `1.5px solid ${C.border}`,
      marginBottom: '12px',
      overflow: 'hidden',
      boxShadow: `0 2px 10px ${C.brown}0c`,
    },
    badge: (c) => ({
      fontSize: '10px',
      padding: '3px 8px',
      borderRadius: '999px',
      background: `${c}20`,
      color: c,
      fontWeight: 700,
      border: `1px solid ${c}40`,
      fontFamily: "'Lato',sans-serif",
    }),
    ratingPanel: {
      position: 'fixed',
      inset: 0,
      background: '#3a2a1a88',
      zIndex: 100,
      display: 'flex',
      alignItems: 'flex-end',
    },
    ratingSheet: {
      background: C.bgCard,
      borderRadius: '24px 24px 0 0',
      padding: '20px',
      width: '100%',
      maxWidth: '430px',
      margin: '0 auto',
      boxShadow: `0 -8px 32px ${C.brown}30`,
    },
  }

  // ── Frigo Tab ──────────────────────────────────────────────────
  const renderFrigo = () => (
    <div style={st.content}>
      {urgentIngs.length > 0 && (
        <div style={st.urgentBar}>
          ⚠️{' '}
          <strong>
            {urgentIngs.length} ingrédient{urgentIngs.length > 1 ? 's' : ''} à utiliser vite :
          </strong>{' '}
          {urgentIngs.map((i) => i.name).join(', ')}
        </div>
      )}

      {/* Sub-tabs Cuisine / Maison */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        {[
          { id: 'food', label: `🥦 Cuisine (${ingredients.length})` },
          { id: 'maison', label: `🧴 Maison (${nonFood.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setFridgeSubTab(t.id)}
            style={{
              flex: 1,
              padding: '9px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 700,
              border: fridgeSubTab === t.id ? `1.5px solid ${C.brown}` : `1px solid ${C.border}`,
              background: fridgeSubTab === t.id ? `${C.brown}12` : C.bgInset,
              color: fridgeSubTab === t.id ? C.brown : C.textLight,
              cursor: 'pointer',
              fontFamily: "'Lato',sans-serif",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Scan ticket + Analyser recette */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <label
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '14px 8px',
            borderRadius: '14px',
            background: `linear-gradient(135deg,${C.green}20,${C.green}0a)`,
            border: `2px solid ${C.green}70`,
            cursor: 'pointer',
            fontFamily: "'Lato',sans-serif",
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span style={{ fontSize: '22px' }}>🧾</span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: C.green }}>
            Ticket de caisse
          </span>
          <input
            type='file'
            accept='image/*'
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
            onChange={(e) => {
              if (e.target.files?.[0]) scanTicket(e.target.files[0])
              e.target.value = ''
            }}
          />
        </label>
        <label
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '14px 8px',
            borderRadius: '14px',
            background: `linear-gradient(135deg,${C.terra}20,${C.terra}0a)`,
            border: `2px solid ${C.terra}70`,
            cursor: 'pointer',
            fontFamily: "'Lato',sans-serif",
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span style={{ fontSize: '22px' }}>📖</span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: C.terra }}>Recette livre</span>
          <input
            type='file'
            accept='image/*'
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
            onChange={(e) => {
              if (e.target.files?.[0]) analyzeRecipePhoto(e.target.files[0])
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {fridgeSubTab === 'food' ? (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
            }}
          >
            <SectionLabel>Mes ingrédients ({ingredients.length})</SectionLabel>
            <Btn variant='outline' small onClick={() => setShowAddIng(!showAddIng)}>
              {showAddIng ? '✕ Annuler' : '+ Ajouter'}
            </Btn>
          </div>

          {showAddIng && (
            <Card accent style={{ marginBottom: '12px' }}>
              <div style={{ marginBottom: '8px' }}>
                <Input
                  placeholder="Nom de l'ingrédient *"
                  value={newIng.name}
                  onChange={(v) => setNewIng((p) => ({ ...p, name: v }))}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <div style={{ flex: 2 }}>
                  <Input
                    placeholder='Quantité'
                    value={newIng.quantity}
                    onChange={(v) => setNewIng((p) => ({ ...p, quantity: v }))}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <Select
                    value={newIng.unit}
                    onChange={(v) => setNewIng((p) => ({ ...p, unit: v }))}
                  >
                    {UNITS.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <Select
                  value={newIng.category}
                  onChange={(v) => setNewIng((p) => ({ ...p, category: v }))}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <Select
                  value={newIng.storage}
                  onChange={(v) => setNewIng((p) => ({ ...p, storage: v }))}
                >
                  {STORAGE_TYPES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.icon} {s.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div style={{ fontSize: '11px', color: C.textLight, marginBottom: '4px' }}>
                Date limite de consommation (optionnel)
              </div>
              <div style={{ marginBottom: '10px' }}>
                <Input
                  type='date'
                  value={newIng.dlc}
                  onChange={(v) => setNewIng((p) => ({ ...p, dlc: v }))}
                />
              </div>
              <Btn onClick={addIngredient}>✓ Ajouter</Btn>
            </Card>
          )}

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {['Tous', ...CATEGORIES].map((cat) => (
              <button
                key={cat}
                style={st.objBtn(filterCat === cat)}
                onClick={() => setFilterCat(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {filteredIngs.length === 0 ? (
            <Card>
              <div style={{ textAlign: 'center', color: C.textLight, padding: '28px 0' }}>
                <div style={{ fontSize: '30px', marginBottom: '8px' }}>🥦</div>Aucun ingrédient
              </div>
            </Card>
          ) : (
            <Card>
              {filteredIngs.map((ing, i) => {
                const st2 = STORAGE_TYPES.find((s) => s.id === ing.storage)
                return (
                  <div
                    key={ing.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '9px 0',
                      borderBottom: i < filteredIngs.length - 1 ? `1px solid ${C.border}` : 'none',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ fontWeight: 700, fontSize: '14px', color: C.text }}>
                          {ing.name}
                        </span>
                        <DlcBadge dlc={ing.dlc} />
                      </div>
                      <div
                        style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}
                      >
                        <Pill label={`${ing.quantity}${ing.unit}`} color={C.textLight} />
                        <Pill label={ing.category} color={C.brownLight} />
                        {st2 && <Pill label={`${st2.icon} ${st2.label}`} color={st2.color} />}
                      </div>
                    </div>
                    <button
                      onClick={() => setIngredients((p) => p.filter((x) => x.id !== ing.id))}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: C.border,
                        cursor: 'pointer',
                        fontSize: '20px',
                        padding: '4px',
                      }}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </Card>
          )}
        </>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
            }}
          >
            <SectionLabel>Produits maison ({nonFood.length})</SectionLabel>
          </div>
          {nonFood.length === 0 ? (
            <Card>
              <div style={{ textAlign: 'center', color: C.textLight, padding: '28px 0' }}>
                <div style={{ fontSize: '30px', marginBottom: '8px' }}>🧴</div>Aucun produit. Scanne
                un ticket !
              </div>
            </Card>
          ) : (
            <Card>
              {nonFood.map((item, i) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 0',
                    borderBottom: i < nonFood.length - 1 ? `1px solid ${C.border}` : 'none',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: C.text }}>
                      {item.name}
                    </span>
                    <div
                      style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}
                    >
                      <Pill label={`${item.quantity}${item.unit}`} color={C.textLight} />
                      <Pill label={item.category} color={C.brownMid} />
                      {item.prix && <Pill label={`${item.prix}€`} color={C.green} />}
                    </div>
                  </div>
                  <button
                    onClick={() => setNonFood((p) => p.filter((x) => x.id !== item.id))}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: C.border,
                      cursor: 'pointer',
                      fontSize: '20px',
                      padding: '4px',
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {/* Scan confirm panel */}
      {showScanPanel && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: '#3a2a1a88',
            zIndex: 100,
            display: 'flex',
            alignItems: 'flex-end',
          }}
        >
          <div
            style={{
              background: C.bgCard,
              borderRadius: '24px 24px 0 0',
              padding: '20px',
              width: '100%',
              maxWidth: '430px',
              margin: '0 auto',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: `0 -8px 32px ${C.brown}30`,
            }}
          >
            {scanLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🧾</div>
                <div
                  style={{
                    fontFamily: "'Playfair Display',serif",
                    fontSize: '16px',
                    color: C.brown,
                    marginBottom: '6px',
                  }}
                >
                  Lecture du ticket...
                </div>
                <div style={{ fontSize: '12px', color: C.textLight }}>
                  Le chef analyse tes courses
                </div>
              </div>
            ) : scanResult?.error ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ fontSize: '30px', marginBottom: '8px' }}>❌</div>
                <div style={{ color: C.textMid, fontSize: '13px', marginBottom: '16px' }}>
                  Impossible de lire ce ticket. Essaie avec une photo plus nette.
                </div>
                <Btn variant='outline' onClick={() => setShowScanPanel(false)}>
                  Fermer
                </Btn>
              </div>
            ) : (
              scanConfirm && (
                <>
                  <div
                    style={{
                      fontFamily: "'Playfair Display',serif",
                      fontSize: '18px',
                      fontWeight: 700,
                      color: C.brown,
                      marginBottom: '4px',
                    }}
                  >
                    🧾 Ticket analysé
                  </div>
                  {scanResult && (
                    <div style={{ fontSize: '12px', color: C.textMid, marginBottom: '16px' }}>
                      {[scanResult.enseigne, scanResult.lieu, scanResult.date]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  )}

                  {/* Alimentaire */}
                  {scanConfirm.filter((i) => i.type === 'food').length > 0 && (
                    <>
                      <SectionLabel>
                        🥦 Alimentaire (
                        {scanConfirm.filter((i) => i.type === 'food' && i.selected).length}{' '}
                        sélectionnés)
                      </SectionLabel>
                      {scanConfirm
                        .filter((i) => i.type === 'food')
                        .map((item, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 0',
                              borderBottom: `1px solid ${C.border}`,
                              cursor: 'pointer',
                            }}
                            onClick={() =>
                              setScanConfirm((p) =>
                                p.map((x, i2) =>
                                  i2 === scanConfirm.indexOf(item)
                                    ? { ...x, selected: !x.selected }
                                    : x
                                )
                              )
                            }
                          >
                            <div
                              style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '6px',
                                border: `2px solid ${item.selected ? C.green : C.border}`,
                                background: item.selected ? C.green : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {item.selected && (
                                <span style={{ color: '#fff', fontSize: '12px' }}>✓</span>
                              )}
                            </div>
                            <div style={{ flex: 1 }}>
                              <span
                                style={{
                                  fontWeight: 600,
                                  fontSize: '13px',
                                  color: item.selected ? C.text : C.textLight,
                                }}
                              >
                                {item.nom}
                              </span>
                              <span
                                style={{ fontSize: '11px', color: C.textLight, marginLeft: '6px' }}
                              >
                                {item.quantite}
                                {item.unite}
                              </span>
                              {item.prix && (
                                <span
                                  style={{ fontSize: '11px', color: C.green, marginLeft: '6px' }}
                                >
                                  {item.prix}€
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '10px', color: C.textLight }}>
                              {item.categorie}
                            </span>
                          </div>
                        ))}
                    </>
                  )}

                  {/* Non-alimentaire */}
                  {scanConfirm.filter((i) => i.type === 'nonfood').length > 0 && (
                    <div style={{ marginTop: '14px' }}>
                      <SectionLabel>
                        🧴 Maison (
                        {scanConfirm.filter((i) => i.type === 'nonfood' && i.selected).length}{' '}
                        sélectionnés)
                      </SectionLabel>
                      {scanConfirm
                        .filter((i) => i.type === 'nonfood')
                        .map((item, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 0',
                              borderBottom: `1px solid ${C.border}`,
                              cursor: 'pointer',
                            }}
                            onClick={() =>
                              setScanConfirm((p) =>
                                p.map((x, i2) =>
                                  i2 === scanConfirm.indexOf(item)
                                    ? { ...x, selected: !x.selected }
                                    : x
                                )
                              )
                            }
                          >
                            <div
                              style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '6px',
                                border: `2px solid ${item.selected ? C.brownMid : C.border}`,
                                background: item.selected ? C.brownMid : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {item.selected && (
                                <span style={{ color: '#fff', fontSize: '12px' }}>✓</span>
                              )}
                            </div>
                            <div style={{ flex: 1 }}>
                              <span
                                style={{
                                  fontWeight: 600,
                                  fontSize: '13px',
                                  color: item.selected ? C.text : C.textLight,
                                }}
                              >
                                {item.nom}
                              </span>
                              {item.prix && (
                                <span
                                  style={{ fontSize: '11px', color: C.green, marginLeft: '6px' }}
                                >
                                  {item.prix}€
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '10px', color: C.textLight }}>
                              {item.categorie}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>
                    <Btn variant='outline' onClick={() => setShowScanPanel(false)}>
                      Annuler
                    </Btn>
                    <div style={{ flex: 1 }}>
                      <Btn variant='green' onClick={confirmScanImport}>
                        ✓ Importer la sélection
                      </Btn>
                    </div>
                  </div>
                </>
              )
            )}
          </div>
        </div>
      )}

      {/* Recipe analysis panel */}
      {showRecipeAnalysis && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: '#3a2a1a88',
            zIndex: 100,
            display: 'flex',
            alignItems: 'flex-end',
          }}
        >
          <div
            style={{
              background: C.bgCard,
              borderRadius: '24px 24px 0 0',
              padding: '20px',
              width: '100%',
              maxWidth: '430px',
              margin: '0 auto',
              maxHeight: '88vh',
              overflowY: 'auto',
              boxShadow: `0 -8px 32px ${C.brown}30`,
            }}
          >
            {recipeAnalysisLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📖</div>
                <div
                  style={{
                    fontFamily: "'Playfair Display',serif",
                    fontSize: '16px',
                    color: C.brown,
                    marginBottom: '6px',
                  }}
                >
                  Lecture de la recette...
                </div>
                <div style={{ fontSize: '12px', color: C.textLight }}>
                  Croisement avec ton inventaire en cours
                </div>
              </div>
            ) : recipeAnalysisResult?.error ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ fontSize: '30px', marginBottom: '8px' }}>❌</div>
                <div style={{ color: C.textMid, fontSize: '13px', marginBottom: '16px' }}>
                  Impossible de lire cette recette. Essaie avec une photo plus nette.
                </div>
                <Btn
                  variant='outline'
                  onClick={() => {
                    setShowRecipeAnalysis(false)
                    setRecipeAnalysisResult(null)
                  }}
                >
                  Fermer
                </Btn>
              </div>
            ) : (
              recipeAnalysisResult && (
                <>
                  <div
                    style={{
                      fontFamily: "'Playfair Display',serif",
                      fontSize: '18px',
                      fontWeight: 700,
                      color: C.brown,
                      marginBottom: '2px',
                    }}
                  >
                    📖 {recipeAnalysisResult.nom_recette}
                  </div>
                  <div style={{ fontSize: '12px', color: C.textMid, marginBottom: '16px' }}>
                    {recipeAnalysisResult.portions_recette} portions ·{' '}
                    {recipeAnalysisResult.ingredients?.length} ingrédients analysés
                  </div>

                  {/* Stats rapides */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    {[
                      {
                        label: "✅ J'ai",
                        count: recipeAnalysisResult.ingredients?.filter(
                          (i) => i.statut === 'disponible'
                        ).length,
                        color: C.green,
                      },
                      {
                        label: '🔄 Substitut',
                        count: recipeAnalysisResult.ingredients?.filter(
                          (i) => i.statut === 'substituable'
                        ).length,
                        color: '#d4a017',
                      },
                      {
                        label: '🛒 Manque',
                        count: recipeAnalysisResult.ingredients?.filter(
                          (i) => i.statut === 'manquant'
                        ).length,
                        color: C.terra,
                      },
                    ].map((s) => (
                      <div
                        key={s.label}
                        style={{
                          flex: 1,
                          textAlign: 'center',
                          padding: '8px 4px',
                          borderRadius: '10px',
                          background: s.color + '15',
                          border: `1px solid ${s.color}30`,
                        }}
                      >
                        <div style={{ fontSize: '18px', fontWeight: 800, color: s.color }}>
                          {s.count}
                        </div>
                        <div style={{ fontSize: '9px', color: s.color, fontWeight: 600 }}>
                          {s.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Ingrédients par statut */}
                  {['disponible', 'substituable', 'manquant'].map((statut) => {
                    const items =
                      recipeAnalysisResult.ingredients?.filter((i) => i.statut === statut) || []
                    if (!items.length) return null
                    const cfg = {
                      disponible: { icon: '✅', color: C.green, label: 'Dans ton frigo' },
                      substituable: { icon: '🔄', color: '#d4a017', label: 'Substituable' },
                      manquant: { icon: '🛒', color: C.terra, label: 'À acheter' },
                    }[statut]
                    return (
                      <div key={statut} style={{ marginBottom: '14px' }}>
                        <div
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            color: cfg.color,
                            textTransform: 'uppercase',
                            letterSpacing: '0.8px',
                            marginBottom: '8px',
                          }}
                        >
                          {cfg.icon} {cfg.label}
                        </div>
                        {items.map((ing, i) => (
                          <div
                            key={i}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '10px',
                              background: cfg.color + '0d',
                              border: `1px solid ${cfg.color}25`,
                              marginBottom: '6px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontWeight: 700, fontSize: '13px', color: C.text }}>
                                {ing.nom}
                              </span>
                              <span style={{ fontSize: '11px', color: C.textMid }}>
                                {ing.quantite} {ing.unite}
                              </span>
                            </div>
                            {ing.substitut && (
                              <div style={{ fontSize: '11px', color: '#d4a017', marginTop: '2px' }}>
                                → Utilise : {ing.substitut}
                              </div>
                            )}
                            {ing.note && (
                              <div
                                style={{
                                  fontSize: '11px',
                                  color: C.textLight,
                                  marginTop: '2px',
                                  fontStyle: 'italic',
                                }}
                              >
                                {ing.note}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  })}

                  {recipeAnalysisResult.conseil_chef && (
                    <div
                      style={{
                        padding: '10px 12px',
                        background: `${C.green}10`,
                        borderRadius: '10px',
                        border: `1px solid ${C.green}30`,
                        marginBottom: '16px',
                      }}
                    >
                      <span style={{ fontSize: '12px', color: C.green }}>
                        💡 {recipeAnalysisResult.conseil_chef}
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Btn
                      variant='outline'
                      onClick={() => {
                        setShowRecipeAnalysis(false)
                        setRecipeAnalysisResult(null)
                      }}
                    >
                      Fermer
                    </Btn>
                    {recipeAnalysisResult.ingredients?.some((i) => i.statut === 'manquant') && (
                      <div style={{ flex: 1 }}>
                        <Btn variant='green' onClick={addMissingToShoppingList}>
                          🛒 Ajouter aux courses
                        </Btn>
                      </div>
                    )}
                  </div>
                </>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )

  // ── Equipment Tab ──────────────────────────────────────────────
  const renderEquipement = () => (
    <div style={st.content}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
        }}
      >
        <SectionLabel>Mon équipement ({equipment.length})</SectionLabel>
        <Btn variant='outline' small onClick={() => setShowAddEq(!showAddEq)}>
          {showAddEq ? '✕ Annuler' : '+ Ajouter'}
        </Btn>
      </div>

      {showAddEq && (
        <Card accent style={{ marginBottom: '12px' }}>
          <div style={{ marginBottom: '8px' }}>
            <Select value={newEq.id} onChange={(v) => setNewEq((p) => ({ ...p, id: v }))}>
              <option value=''>-- Choisir un équipement --</option>
              {EQUIPMENT_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.icon} {p.label}
                </option>
              ))}
              <option value='custom'>Autre (personnalisé)</option>
            </Select>
          </div>
          {newEq.id === 'custom' && (
            <div style={{ marginBottom: '8px' }}>
              <Input
                placeholder="Nom de l'équipement"
                value={newEq.custom}
                onChange={(v) => setNewEq((p) => ({ ...p, custom: v }))}
              />
            </div>
          )}
          <div style={{ marginBottom: '10px' }}>
            <Input
              placeholder='Modèle (ex: Philips XXL 5000W) — optionnel'
              value={newEq.model}
              onChange={(v) => setNewEq((p) => ({ ...p, model: v }))}
            />
          </div>
          <Btn onClick={addEquipment}>✓ Ajouter</Btn>
        </Card>
      )}

      {equipment.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', color: C.textLight, padding: '28px 0' }}>
            <div style={{ fontSize: '30px', marginBottom: '8px' }}>🍳</div>Ajoute ton équipement
            pour des recettes adaptées
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {equipment.map((eq) => (
            <div
              key={eq.uid}
              style={{
                background: C.bgCard,
                borderRadius: '16px',
                padding: '14px',
                textAlign: 'center',
                border: `1.5px solid ${C.border}`,
                position: 'relative',
              }}
            >
              <button
                onClick={() => setEquipment((p) => p.filter((e) => e.uid !== eq.uid))}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  background: 'none',
                  border: 'none',
                  color: C.border,
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
              >
                ×
              </button>
              <div style={{ fontSize: '28px', marginBottom: '6px' }}>{eq.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '13px', color: C.brown }}>{eq.label}</div>
              {eq.model && (
                <div style={{ fontSize: '10px', color: C.textLight, marginTop: '3px' }}>
                  {eq.model}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Users section */}
      <div style={{ marginTop: '20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
          }}
        >
          <SectionLabel>Convives ({users.length})</SectionLabel>
          <Btn variant='outline' small onClick={() => setShowUsers(!showUsers)}>
            {showUsers ? '✕' : '+ Ajouter'}
          </Btn>
        </div>
        {showUsers && (
          <Card accent style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                placeholder='Prénom (ex: Papa, Lillia...)'
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addUser()}
                autoComplete='off'
                dir='ltr'
                style={{
                  flex: 1,
                  background: C.bgCard,
                  border: `1.5px solid ${C.borderDark}`,
                  borderRadius: '10px',
                  padding: '10px 13px',
                  color: C.text,
                  fontSize: '16px',
                  fontFamily: "'Lato',sans-serif",
                  outline: 'none',
                  WebkitTextFillColor: C.text,
                  opacity: 1,
                }}
              />
              <button
                onClick={addUser}
                style={{
                  background: `linear-gradient(135deg,${C.green},${C.greenMid})`,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 18px',
                  fontSize: '18px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                +
              </button>
            </div>
          </Card>
        )}
        {users.length === 0 ? (
          <Card>
            <div
              style={{
                textAlign: 'center',
                color: C.textLight,
                fontSize: '13px',
                padding: '12px 0',
              }}
            >
              Ajoute les convives pour noter les recettes ensemble
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[...users].map((u) => (
              <div
                key={u.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: C.bgInset,
                  borderRadius: '20px',
                  padding: '6px 12px',
                  border: `1px solid ${C.border}`,
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 600, color: C.brown }}>
                  👤 {u.name}
                </span>
                <button
                  onClick={() => setUsers((p) => p.filter((x) => x.id !== u.id))}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: C.border,
                    cursor: 'pointer',
                    fontSize: '14px',
                    padding: '0 0 0 4px',
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  // ── Recipes Tab ────────────────────────────────────────────────
  const renderRecettes = () => (
    <div style={st.content}>
      {/* Niveau énergie - grille 2x2 */}
      <Card>
        <SectionLabel>Niveau d'énergie</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {ENERGY_LEVELS.map((e) => (
            <button
              key={e.id}
              onClick={() => setEnergyLevel(e.id)}
              style={{
                padding: '10px 10px',
                borderRadius: '12px',
                textAlign: 'left',
                border: energyLevel === e.id ? `1.5px solid ${C.green}` : `1px solid ${C.border}`,
                background: energyLevel === e.id ? `${C.green}12` : C.bgInset,
                color: energyLevel === e.id ? C.green : C.textMid,
                cursor: 'pointer',
                fontFamily: "'Lato',sans-serif",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '12px' }}>{e.label}</div>
              <div style={{ fontSize: '10px', color: C.textLight, marginTop: '2px' }}>{e.desc}</div>
            </button>
          ))}
        </div>
      </Card>

      {/* Temps + Objectifs sur la même carte */}
      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}
        >
          <SectionLabel style={{ marginBottom: 0 }}>Temps</SectionLabel>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['10', '20', '30', '45', '60'].map((t) => (
              <button key={t} style={st.objBtn(timeAvail === t)} onClick={() => setTimeAvail(t)}>
                {t}m
              </button>
            ))}
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '10px', marginTop: '4px' }}>
          <SectionLabel>Objectifs</SectionLabel>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {OBJECTIVES.map((o) => (
              <button
                key={o.id}
                style={st.objBtn(objectives.includes(o.id))}
                onClick={() => toggleObjective(o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Convives + Checklist sur la même carte */}
      <Card style={{ background: `${C.bgDeep}` }}>
        {users.length > 0 && (
          <div style={{ marginBottom: '10px' }}>
            <SectionLabel>Pour qui ?</SectionLabel>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {users.map((u) => (
                <button
                  key={u.id}
                  style={st.objBtn(selectedConvives.includes(u.id))}
                  onClick={() =>
                    setSelectedConvives((p) =>
                      p.includes(u.id) ? p.filter((x) => x !== u.id) : [...p, u.id]
                    )
                  }
                >
                  👤 {u.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <SectionLabel>Prêt à générer ?</SectionLabel>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[
            { ok: ingredients.length >= 3, label: `${ingredients.length}/3 ingr.` },
            { ok: !!energyLevel, label: 'Énergie' },
            { ok: !!timeAvail, label: 'Temps' },
          ].map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '13px' }}>{c.ok ? '✅' : '⬜'}</span>
              <span
                style={{
                  fontSize: '11px',
                  color: c.ok ? C.green : C.textLight,
                  fontWeight: c.ok ? 600 : 400,
                }}
              >
                {c.label}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Btn onClick={generateRecipes} disabled={ingredients.length < 3 || recipeLoading}>
        {recipeLoading ? '🍳 Le chef réfléchit...' : '✨ Générer 3 recettes'}
      </Btn>

      {recipeLoading && (
        <Card style={{ textAlign: 'center', padding: '32px 14px', marginTop: '14px' }}>
          <div style={{ fontSize: '30px', marginBottom: '8px' }}>🍳</div>
          <div style={{ color: C.textLight, fontSize: '13px' }}>Génération en cours...</div>
        </Card>
      )}

      {/* Anchor pour le scroll auto */}
      <div ref={recipeResultRef} />

      {recipeResult &&
        recipeResult.map((recipe, idx) => {
          const rList = getRecipeRatings(recipe.id)
          const avg = avgRating(recipe.id)
          const open = expandedRecipe === idx
          return (
            <div key={idx} style={st.recipeCard}>
              <div
                style={{ padding: '14px', cursor: 'pointer' }}
                onClick={() => setExpandedRecipe(open ? null : idx)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '26px' }}>{recipe.emoji || '🍽️'}</span>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '15px',
                        fontFamily: "'Playfair Display',serif",
                        color: C.brown,
                      }}
                    >
                      {recipe.nom}
                    </div>
                    <div style={{ fontSize: '12px', color: C.textMid, marginTop: '2px' }}>
                      {recipe.description}
                    </div>
                  </div>
                  <span style={{ color: C.border, fontSize: '16px' }}>{open ? '▲' : '▼'}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: '6px',
                    marginTop: '10px',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                  }}
                >
                  <span style={st.badge(C.brownMid)}>⏱ {recipe.temps} min</span>
                  <span style={st.badge(C.green)}>👤 {recipe.portions} pers.</span>
                  {recipe.difficulte && (
                    <span style={st.badge(C.brownLight)}>{recipe.difficulte}</span>
                  )}
                  {recipe.conservation_label && (
                    <span style={st.badge(C.terra)}>📦 {recipe.conservation_label}</span>
                  )}
                  {avg && (
                    <span style={st.badge(C.star)}>
                      ★ {avg} ({rList.length})
                    </span>
                  )}
                </div>
              </div>

              {open && (
                <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${C.border}` }}>
                  {/* Portions selector */}
                  <div
                    style={{
                      marginTop: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: C.textLight,
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                      }}
                    >
                      Portions
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        onClick={() =>
                          setPortions(recipe.id, recipe.portions || 2, getPortions(recipe) - 1)
                        }
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          border: `1.5px solid ${C.borderDark}`,
                          background: C.bgInset,
                          color: C.brown,
                          fontSize: '16px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                        }}
                      >
                        −
                      </button>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: '18px',
                          color: C.brown,
                          minWidth: '24px',
                          textAlign: 'center',
                          fontFamily: "'Playfair Display',serif",
                        }}
                      >
                        {getPortions(recipe)}
                      </span>
                      <button
                        onClick={() =>
                          setPortions(recipe.id, recipe.portions || 2, getPortions(recipe) + 1)
                        }
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          border: `1.5px solid ${C.borderDark}`,
                          background: C.bgInset,
                          color: C.brown,
                          fontSize: '16px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Scaled ingredients */}
                  {recipe.ingredients_detail?.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <div
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: C.textLight,
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                          marginBottom: '8px',
                        }}
                      >
                        Ingrédients
                      </div>
                      <div
                        style={{
                          background: C.bgInset,
                          borderRadius: '12px',
                          padding: '10px 12px',
                        }}
                      >
                        {recipe.ingredients_detail.map((ing, i) => {
                          const base = recipe.portions || 2
                          const cur = getPortions(recipe)
                          const scaled = scaleQty(ing.quantite, base, cur)
                          const changed = cur !== base
                          return (
                            <div
                              key={i}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '5px 0',
                                borderBottom:
                                  i < recipe.ingredients_detail.length - 1
                                    ? `1px solid ${C.border}`
                                    : 'none',
                              }}
                            >
                              <span style={{ fontSize: '13px', color: C.text }}>{ing.nom}</span>
                              <span
                                style={{
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  color: changed ? C.terra : C.brown,
                                }}
                              >
                                {scaled} {ing.unite}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {recipe.etapes?.length > 0 && (
                    <div style={{ marginTop: '14px' }}>
                      <SectionLabel>Étapes</SectionLabel>
                      {recipe.etapes.map((e, i) => (
                        <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                          <span
                            style={{
                              minWidth: '22px',
                              height: '22px',
                              borderRadius: '50%',
                              background: `${C.brown}18`,
                              color: C.brown,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {i + 1}
                          </span>
                          <span style={{ fontSize: '13px', color: C.text, lineHeight: 1.5 }}>
                            {e}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {recipe.conseil && (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '10px 12px',
                        background: `${C.green}10`,
                        borderRadius: '10px',
                        border: `1px solid ${C.green}30`,
                      }}
                    >
                      <span style={{ fontSize: '12px', color: C.green }}>💡 {recipe.conseil}</span>
                    </div>
                  )}

                  {recipe.termes_expliques && Object.keys(recipe.termes_expliques).length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <SectionLabel>Lexique</SectionLabel>
                      {Object.entries(recipe.termes_expliques).map(([t, e]) => (
                        <div key={t} style={{ fontSize: '12px', marginBottom: '4px' }}>
                          <span style={{ color: C.terra, fontWeight: 700 }}>{t}</span>
                          <span style={{ color: C.textMid }}> : {e}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Ratings section */}
                  {rList.length > 0 && (
                    <div style={{ marginTop: '14px' }}>
                      <SectionLabel>Avis ({rList.length})</SectionLabel>
                      {rList.map((r) => (
                        <div
                          key={r.id}
                          style={{
                            padding: '8px 0',
                            borderBottom: `1px solid ${C.border}`,
                            display: 'flex',
                            gap: '10px',
                            alignItems: 'flex-start',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 700,
                              color: C.brown,
                              minWidth: '50px',
                            }}
                          >
                            {r.userName}
                          </span>
                          <div style={{ flex: 1 }}>
                            <Stars value={r.stars} size={13} />
                            {r.comment && (
                              <div
                                style={{
                                  fontSize: '12px',
                                  color: C.textMid,
                                  marginTop: '2px',
                                  fontStyle: 'italic',
                                }}
                              >
                                "{r.comment}"
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Cook log display */}
                  {getCookLog(recipe.id) && (
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '10px 12px',
                        background: `${C.brownLight}10`,
                        borderRadius: '10px',
                        border: `1px solid ${C.brownLight}30`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: C.brownLight,
                          textTransform: 'uppercase',
                          letterSpacing: '0.8px',
                          marginBottom: '4px',
                        }}
                      >
                        👨‍🍳 Retour cuisinier
                      </div>
                      {getCookLog(recipe.id).difficulty && (
                        <div style={{ fontSize: '12px', color: C.textMid, marginBottom: '2px' }}>
                          ⚠️ <strong>Difficulté :</strong> {getCookLog(recipe.id).difficulty}
                        </div>
                      )}
                      {getCookLog(recipe.id).remark && (
                        <div style={{ fontSize: '12px', color: C.textMid, fontStyle: 'italic' }}>
                          💬 "{getCookLog(recipe.id).remark}"
                        </div>
                      )}
                    </div>
                  )}

                  <div
                    style={{
                      marginTop: '12px',
                      display: 'flex',
                      gap: '7px',
                      flexWrap: 'wrap',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <Btn variant='outline' small onClick={() => openCookFeedback(recipe)}>
                      👨‍🍳 Mon retour
                    </Btn>
                    <Btn variant='outline' small onClick={() => openAdapt(recipe)}>
                      🔧 Adapter
                    </Btn>
                    <Btn variant='outline' small onClick={() => openRating(recipe)}>
                      ⭐ Avis
                    </Btn>
                  </div>
                </div>
              )}
            </div>
          )
        })}
    </div>
  )

  // ── Shopping Tab ───────────────────────────────────────────────
  const renderCourses = () => {
    const current = activeList != null ? shoppingLists.find((l) => l.id == activeList) : null
    console.log('activeList:', activeList, typeof activeList)
    console.log(
      'lists:',
      shoppingLists.map((l) => ({ id: l.id, type: typeof l.id }))
    )
    return (
      <div style={st.content}>
        {!current ? (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
              }}
            >
              <SectionLabel>Mes listes ({shoppingLists.length})</SectionLabel>
              <Btn variant='outline' small onClick={() => setShowAddList(!showAddList)}>
                {showAddList ? '✕' : '+ Nouvelle'}
              </Btn>
            </div>

            {showAddList && (
              <Card accent style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', color: C.textMid, marginBottom: '8px' }}>
                  Décris ton objectif, l'IA génère la liste optimisée
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <Input
                    multiline
                    placeholder='Ex : 5 déjeuners pour la semaine, budget 20€, recettes simples à réchauffer le midi...'
                    value={shoppingGoal}
                    onChange={setShoppingGoal}
                  />
                </div>
                <Btn
                  onClick={generateShoppingList}
                  disabled={!shoppingGoal.trim() || shoppingLoading}
                >
                  {shoppingLoading ? '⏳ Génération...' : '✨ Générer la liste'}
                </Btn>
              </Card>
            )}

            {shoppingLists.length === 0 ? (
              <Card>
                <div style={{ textAlign: 'center', color: C.textLight, padding: '28px 0' }}>
                  <div style={{ fontSize: '30px', marginBottom: '8px' }}>📋</div>Crée ta première
                  liste avec un objectif
                </div>
              </Card>
            ) : (
              shoppingLists.map((list) => {
                const total = list.categories?.reduce((a, c) => a + c.items.length, 0) || 0
                const checked = Object.values(list.checked || {}).filter(Boolean).length
                return (
                  <div
                    key={list.id}
                    style={{
                      background: C.bgCard,
                      borderRadius: '16px',
                      padding: '14px',
                      marginBottom: '11px',
                      border: `1.5px solid ${C.border}`,
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      console.log('clicked', list.id)
                      setActiveList(list.id)
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: '14px',
                            fontFamily: "'Playfair Display',serif",
                            color: C.brown,
                          }}
                        >
                          {list.titre || list.goal}
                        </div>
                        <div style={{ fontSize: '12px', color: C.textMid, marginTop: '2px' }}>
                          {list.repas_couverts}
                        </div>
                      </div>
                      <Pill label={list.budget_estime} color={C.green} />
                    </div>
                    <div
                      style={{
                        marginTop: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          height: '4px',
                          borderRadius: '2px',
                          background: C.border,
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            borderRadius: '2px',
                            background: C.green,
                            width: total > 0 ? `${(checked / total) * 100}%` : '0%',
                            transition: 'width 0.3s',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '11px', color: C.textLight }}>
                        {checked}/{total}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </>
        ) : (
          <>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}
            >
              <button
                onClick={() => setActiveList(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: C.brown,
                  cursor: 'pointer',
                  fontSize: '22px',
                  padding: '0',
                }}
              >
                ←
              </button>
              <div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '16px',
                    fontFamily: "'Playfair Display',serif",
                    color: C.brown,
                  }}
                >
                  {current.titre}
                </div>
                <div style={{ fontSize: '12px', color: C.textMid }}>
                  {current.budget_estime} · {current.repas_couverts}
                </div>
              </div>
            </div>

            {current.categories?.map((cat) => (
              <Card key={cat.nom}>
                <SectionLabel>{cat.nom}</SectionLabel>
                {cat.items.map((item) => {
                  const k = `${cat.nom}-${item.nom}`,
                    done = current.checked?.[k]
                  return (
                    <div
                      key={item.nom}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 0',
                        borderBottom: `1px solid ${C.border}`,
                        cursor: 'pointer',
                        opacity: done ? 0.5 : 1,
                      }}
                      onClick={() => toggleItem(current.id, cat.nom, item.nom)}
                    >
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '6px',
                          border: `2px solid ${done ? C.green : C.border}`,
                          background: done ? C.green : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {done && <span style={{ color: '#fff', fontSize: '12px' }}>✓</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: '14px',
                            color: C.text,
                            textDecoration: done ? 'line-through' : 'none',
                          }}
                        >
                          {item.nom}
                        </span>
                        <span style={{ fontSize: '12px', color: C.textLight, marginLeft: '8px' }}>
                          {item.quantite}
                        </span>
                        {item.conseil && (
                          <div style={{ fontSize: '11px', color: C.textLight, marginTop: '2px' }}>
                            {item.conseil}
                          </div>
                        )}
                      </div>
                      {item.prix_estime && (
                        <span style={{ fontSize: '12px', color: C.textMid }}>
                          {item.prix_estime}
                        </span>
                      )}
                    </div>
                  )
                })}
              </Card>
            ))}

            {current.conseils?.length > 0 && (
              <Card style={{ background: `${C.green}08`, border: `1px solid ${C.green}25` }}>
                <SectionLabel>💡 Conseils batch</SectionLabel>
                {current.conseils.map((c, i) => (
                  <div key={i} style={{ fontSize: '13px', color: C.text, marginBottom: '5px' }}>
                    • {c}
                  </div>
                ))}
              </Card>
            )}

            <Btn
              variant='danger'
              onClick={() => {
                setShoppingLists((p) => p.filter((l) => l.id !== current.id))
                setActiveList(null)
              }}
            >
              🗑 Supprimer cette liste
            </Btn>
          </>
        )}
      </div>
    )
  }

  // ── Rating Panel (Bottom Sheet) ────────────────────────────────
  const renderRatingPanel = () =>
    showRatingPanel && (
      <div
        style={st.ratingPanel}
        onClick={(e) => {
          if (e.target === e.currentTarget) setShowRatingPanel(false)
        }}
      >
        <div style={st.ratingSheet}>
          <div
            style={{
              fontFamily: "'Playfair Display',serif",
              fontSize: '18px',
              fontWeight: 700,
              color: C.brown,
              marginBottom: '4px',
            }}
          >
            ⭐ Donner un avis
          </div>
          <div style={{ fontSize: '13px', color: C.textMid, marginBottom: '16px' }}>
            {ratingTarget?.recipeName}
          </div>

          {users.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                color: C.textLight,
                fontSize: '13px',
                padding: '12px 0',
              }}
            >
              Ajoute des convives dans l'onglet Équipement d'abord
            </div>
          ) : (
            <>
              <SectionLabel>Qui note ?</SectionLabel>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                {users.map((u) => (
                  <button
                    key={u.id}
                    style={st.objBtn(newRating.userId === u.id)}
                    onClick={() => setNewRating((p) => ({ ...p, userId: u.id }))}
                  >
                    👤 {u.name}
                  </button>
                ))}
              </div>

              <SectionLabel>Note</SectionLabel>
              <div style={{ marginBottom: '14px' }}>
                <Stars
                  value={newRating.stars}
                  onChange={(v) => setNewRating((p) => ({ ...p, stars: v }))}
                  size={32}
                />
              </div>

              <SectionLabel>Commentaire (optionnel)</SectionLabel>
              <div style={{ marginBottom: '14px' }}>
                <Input
                  multiline
                  placeholder='Ex: Avec de la vache qui rit ça aurait été meilleur...'
                  value={newRating.comment}
                  onChange={(v) => setNewRating((p) => ({ ...p, comment: v }))}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <Btn variant='outline' onClick={() => setShowRatingPanel(false)}>
                  Annuler
                </Btn>
                <div style={{ flex: 1 }}>
                  <Btn
                    variant='green'
                    onClick={submitRating}
                    disabled={!newRating.userId || !newRating.stars}
                  >
                    ✓ Enregistrer
                  </Btn>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    )

  return (
    <div style={st.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Lato:wght@400;600;700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { display:none; }
        input[type=date]::-webkit-calendar-picker-indicator { filter: opacity(0.4); }
      `}</style>

      {/* Header */}
      <div style={st.header}>
        <div style={st.title}>🧺 Le Garde Manger</div>
        <div style={st.sub}>
          {ingredients.length} ingrédient{ingredients.length !== 1 ? 's' : ''} · {equipment.length}{' '}
          équipement{equipment.length !== 1 ? 's' : ''} · {users.length} convive
          {users.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Tabs */}
      <div style={st.tabs}>
        {[
          { id: 'frigo', label: '🥦 Frigo' },
          { id: 'equipement', label: '🍳 Équip.' },
          { id: 'recettes', label: '✨ Recettes' },
          { id: 'courses', label: '🛒 Courses' },
        ].map((t) => (
          <button key={t.id} style={st.tab(tab === t.id)} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'frigo' && renderFrigo()}
      {tab === 'equipement' && renderEquipement()}
      {tab === 'recettes' && renderRecettes()}
      {tab === 'courses' && renderCourses()}

      {/* Rating bottom sheet */}
      {renderRatingPanel()}

      {/* Adapt bottom sheet */}
      {showAdaptPanel && (
        <div
          style={st.ratingPanel}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAdaptPanel(false)
              setAdaptResult(null)
            }
          }}
        >
          <div style={{ ...st.ratingSheet, maxHeight: '85vh', overflowY: 'auto' }}>
            <div
              style={{
                fontFamily: "'Playfair Display',serif",
                fontSize: '18px',
                fontWeight: 700,
                color: C.terra,
                marginBottom: '4px',
              }}
            >
              🔧 Adapter la recette
            </div>
            <div style={{ fontSize: '13px', color: C.textMid, marginBottom: '16px' }}>
              {adaptTarget?.nom}
            </div>

            {!adaptResult ? (
              <>
                <SectionLabel>Quel est le problème ?</SectionLabel>
                <div style={{ marginBottom: '12px' }}>
                  <Input
                    multiline
                    placeholder="Ex: Mon air fryer est tombé en panne, l'œuf est périmé, je n'ai plus de crème fraîche, je veux éviter le gluten..."
                    value={adaptProblem}
                    onChange={setAdaptProblem}
                  />
                </div>
                <div
                  style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '12px' }}
                >
                  {[
                    'Équipement en panne',
                    'Ingrédient manquant',
                    'Ingrédient périmé',
                    'Sans gluten',
                    'Sans lactose',
                    'Version végé',
                  ].map((s) => (
                    <button
                      key={s}
                      style={st.objBtn(adaptProblem === s)}
                      onClick={() => setAdaptProblem(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Btn variant='outline' onClick={() => setShowAdaptPanel(false)}>
                    Annuler
                  </Btn>
                  <div style={{ flex: 1 }}>
                    <Btn
                      variant='primary'
                      onClick={generateAdaptation}
                      disabled={!adaptProblem.trim() || adaptLoading}
                    >
                      {adaptLoading ? '⏳ Adaptation...' : '✨ Adapter maintenant'}
                    </Btn>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    padding: '12px',
                    background: `${C.terra}10`,
                    borderRadius: '12px',
                    border: `1px solid ${C.terra}30`,
                    marginBottom: '14px',
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Playfair Display',serif",
                      fontWeight: 700,
                      color: C.terra,
                      fontSize: '15px',
                      marginBottom: '6px',
                    }}
                  >
                    {adaptResult.titre}
                  </div>
                  <div style={{ fontSize: '13px', color: C.textMid, lineHeight: 1.5 }}>
                    {adaptResult.explication}
                  </div>
                </div>
                {adaptResult.etapes_modifiees?.length > 0 && (
                  <div style={{ marginBottom: '14px' }}>
                    <SectionLabel>Nouvelles étapes</SectionLabel>
                    {adaptResult.etapes_modifiees.map((e, i) => (
                      <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                        <span
                          style={{
                            minWidth: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            background: `${C.terra}18`,
                            color: C.terra,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {i + 1}
                        </span>
                        <span style={{ fontSize: '13px', color: C.text, lineHeight: 1.5 }}>
                          {e}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {adaptResult.conseil && (
                  <div
                    style={{
                      padding: '10px 12px',
                      background: `${C.green}10`,
                      borderRadius: '10px',
                      border: `1px solid ${C.green}30`,
                      marginBottom: '14px',
                    }}
                  >
                    <span style={{ fontSize: '12px', color: C.green }}>
                      💡 {adaptResult.conseil}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Btn variant='outline' onClick={() => setAdaptResult(null)}>
                    ← Autre problème
                  </Btn>
                  <div style={{ flex: 1 }}>
                    <Btn
                      variant='green'
                      onClick={() => {
                        setShowAdaptPanel(false)
                        setAdaptResult(null)
                      }}
                    >
                      ✓ C'est parti !
                    </Btn>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Cook feedback bottom sheet */}
      {showCookPanel && (
        <div
          style={st.ratingPanel}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCookPanel(false)
          }}
        >
          <div style={st.ratingSheet}>
            <div
              style={{
                fontFamily: "'Playfair Display',serif",
                fontSize: '18px',
                fontWeight: 700,
                color: C.brown,
                marginBottom: '4px',
              }}
            >
              👨‍🍳 Retour du cuisinier
            </div>
            <div style={{ fontSize: '13px', color: C.textMid, marginBottom: '16px' }}>
              {cookTarget?.nom}
            </div>

            <SectionLabel>As-tu rencontré des difficultés ?</SectionLabel>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {[
                'Aucune',
                'Cuisson délicate',
                'Découpe difficile',
                'Timing serré',
                "Manquait d'assaisonnement",
                'Texture pas top',
                'Trop compliqué',
              ].map((d) => (
                <button
                  key={d}
                  style={st.objBtn(cookFeedback.difficulty === d)}
                  onClick={() => setCookFeedback((p) => ({ ...p, difficulty: d }))}
                >
                  {d}
                </button>
              ))}
            </div>

            <SectionLabel>Une remarque ? (optionnel)</SectionLabel>
            <div style={{ marginBottom: '14px' }}>
              <Input
                multiline
                placeholder="Ex: J'ai bien géré la cuisson, la prochaine fois je mets moins de sel, je referais cette recette..."
                value={cookFeedback.remark}
                onChange={(v) => setCookFeedback((p) => ({ ...p, remark: v }))}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <Btn variant='outline' onClick={() => setShowCookPanel(false)}>
                Annuler
              </Btn>
              <div style={{ flex: 1 }}>
                <Btn variant='green' onClick={submitCookFeedback}>
                  ✓ Enregistrer
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
