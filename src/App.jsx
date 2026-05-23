import { useState, useEffect, useRef } from 'react'
import TicketCamera from './components/TicketCamera'
import { searchProduct, getProductByBarcode } from './services/openFoodFacts'

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
  mealHistory: 'lgm_meal_history',
  manualCart: 'lgm_manual_cart',
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

const AGE_GROUPS = [
  { id: 'enfant', label: 'Enfant', icon: '🧒', desc: '< 12 ans' },
  { id: 'ado', label: 'Ado', icon: '🧑', desc: '12-17 ans' },
  { id: 'adulte', label: 'Adulte', icon: '👤', desc: '18-64 ans' },
  { id: 'senior', label: 'Senior', icon: '🧓', desc: '65+ ans' },
]

const PREF_TAGS = [
  { id: 'epice', label: '🌶️ Épicé' },
  { id: 'fromage', label: '🧀 Fromage' },
  { id: 'viande', label: '🥩 Viande' },
  { id: 'poisson', label: '🐟 Poisson' },
  { id: 'pates', label: '🍝 Pâtes' },
  { id: 'legumes', label: '🥦 Légumes' },
  { id: 'sucre', label: '🍯 Sucré' },
  { id: 'grille', label: '🔥 Grillé' },
]

const RESTRICTION_TAGS = [
  { id: 'vegetarien', label: '🌿 Végétarien' },
  { id: 'vegan', label: '🌱 Végétalien' },
  { id: 'sans_gluten', label: '🌾 Sans gluten' },
  { id: 'sans_lactose', label: '🥛 Sans lactose' },
  { id: 'allergie_noix', label: '🥜 Allergie noix' },
  { id: 'sans_porc', label: '🐷 Sans porc' },
  { id: 'sans_poisson', label: '🐟 Sans poisson' },
  { id: 'halal', label: '☪️ Halal' },
]

const COOK_LEVELS = [
  { id: 'debutant', label: '👶 Débutant' },
  { id: 'amateur', label: '🧑‍🍳 Amateur' },
  { id: 'confirme', label: '👨‍🍳 Confirmé' },
]

function getSeason() {
  const m = new Date().getMonth()
  if (m >= 2 && m <= 4)
    return { label: 'Printemps 🌸', hint: 'asperges, radis, épinards, fraises, petits pois' }
  if (m >= 5 && m <= 7)
    return { label: 'Été ☀️', hint: 'tomates, courgettes, aubergines, poivrons, abricots, pêches' }
  if (m >= 8 && m <= 10)
    return { label: 'Automne 🍂', hint: 'potiron, champignons, pommes, poires, châtaignes' }
  return { label: 'Hiver ❄️', hint: 'poireaux, choux, carottes, betteraves, oranges, clémentines' }
}

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

function detectDoublons(newItems, existingItems) {
  return newItems.map((item) => {
    const doublon = existingItems.find(
      (e) =>
        e.texte_brut.toLowerCase().includes(item.texte_brut.toLowerCase().slice(0, 8)) ||
        item.texte_brut.toLowerCase().includes(e.texte_brut.toLowerCase().slice(0, 8))
    )
    return { ...item, doublon: doublon || null }
  })
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
// ── Manuel Cart Add Component ──────────────────────────────────
function ManualCartAdd({ onAdd }) {
  const [nom, setNom] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('pièce(s)')

  const submit = () => {
    if (!nom.trim()) return
    onAdd({ nom: nom.trim(), quantity: quantity || '1', unit })
    setNom('')
    setQuantity('')
  }

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <input
        placeholder='Nutella, Pain de mie...'
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        dir='ltr'
        autoComplete='off'
        style={{
          flex: 2,
          background: '#faf7f0',
          border: `1.5px solid #c4af90`,
          borderRadius: '10px',
          padding: '9px 11px',
          color: '#3a2a1a',
          fontSize: '14px',
          fontFamily: "'Lato',sans-serif",
          outline: 'none',
        }}
      />
      <input
        placeholder='Qté'
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        style={{
          width: '52px',
          background: '#faf7f0',
          border: `1.5px solid #c4af90`,
          borderRadius: '10px',
          padding: '9px 8px',
          color: '#3a2a1a',
          fontSize: '13px',
          fontFamily: "'Lato',sans-serif",
          outline: 'none',
          textAlign: 'center',
        }}
      />
      <select
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
        style={{
          width: '72px',
          background: '#faf7f0',
          border: `1.5px solid #c4af90`,
          borderRadius: '10px',
          padding: '9px 4px',
          color: '#3a2a1a',
          fontSize: '11px',
          fontFamily: "'Lato',sans-serif",
        }}
      >
        {['pièce(s)', 'g', 'kg', 'ml', 'L', 'boîte(s)', 'sachet(s)', 'rouleau(x)'].map((u) => (
          <option key={u}>{u}</option>
        ))}
      </select>
      <button
        onClick={submit}
        style={{
          background: 'linear-gradient(135deg,#4a7c59,#6a9e78)',
          color: '#fff',
          border: 'none',
          borderRadius: '10px',
          padding: '9px 14px',
          fontSize: '16px',
          fontWeight: 700,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        +
      </button>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState('frigo')
  const [ingredients, setIngredients] = useStorage(STORAGE_KEYS.ingredients, [])
  const [equipment, setEquipment] = useStorage(STORAGE_KEYS.equipment, [])
  const [shoppingLists, setShoppingLists] = useStorage(STORAGE_KEYS.shoppingLists, [])
  const [users, setUsers] = useStorage(STORAGE_KEYS.users, [])
  const [ratings, setRatings] = useStorage(STORAGE_KEYS.ratings, [])
  const [cookLogs, setCookLogs] = useStorage(STORAGE_KEYS.cookLogs, [])
  const [nonFood, setNonFood] = useStorage(STORAGE_KEYS.nonFood, [])
  const [mealHistory, setMealHistory] = useStorage(STORAGE_KEYS.mealHistory, [])
  const [manualCart, setManualCart] = useStorage(STORAGE_KEYS.manualCart, [])

  // Ticket scan state
  const [showTicketCamera, setShowTicketCamera] = useState(false)
  const [showScanPanel, setShowScanPanel] = useState(false)
  const [scanLoading, setScanLoading] = useState(false)
  const [scanPhases, setScanPhases] = useState({
    haute: [], // import direct
    moyenne: [], // candidats OFF proposés
    basse: [], // scan code-barres requis
    validated: [], // tous les articles confirmés
  })
  const [offLoading, setOffLoading] = useState(false) // Open Food Facts en cours
  // TODO: scan code-barres — à implémenter avec @zxing/library
  // const [currentBarcodeTarget, setCurrentBarcodeTarget] = useState(null)
  const [scanConfirm, setScanConfirm] = useState(null)
  const [fridgeSubTab, setFridgeSubTab] = useState('food')
  const [lastTicketItems, setLastTicketItems] = useState([]) // 3 derniers articles
  const [photoCount, setPhotoCount] = useState(0)

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

  // Convive profile editing
  const [editingUser, setEditingUser] = useState(null) // userId being edited
  const [cuisinierId, setCuisinierIdState] = useState(null) // who's cooking tonight
  const lastTapRef = useRef({}) // for double-tap detection

  // Recipe state
  const [energyLevel, setEnergyLevel] = useState('faible')
  const [timeAvail, setTimeAvail] = useState('20')
  const [objectives, setObjectives] = useState([])
  const [recipeResult, setRecipeResult] = useState(null)
  const [recipeLoading, setRecipeLoading] = useState(false)
  const [expandedRecipe, setExpandedRecipe] = useState(null)
  const [recipePortions, setRecipePortions] = useState({})
  const recipeResultRef = useRef(null)
  const [selectedConvives, setSelectedConvives] = useState([])

  // Mode soirée / budget / vide-frigo
  const [modeSoiree, setModeSoiree] = useState(false)
  const [guestCount, setGuestCount] = useState(4)
  const [weeklyBudget, setWeeklyBudget] = useState('')
  const [modeVideFrigo, setModeVideFrigo] = useState(false)

  // Rating state
  const [ratingTarget, setRatingTarget] = useState(null)
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
    setScanPhases({ haute: [], moyenne: [], basse: [] })
    setShowScanPanel(true)

    try {
      const base64 = await compressImage(file)
      const continuityContext =
        lastTicketItems.length > 0
          ? `\nCONTINUATION : Cette photo fait suite à une précédente.
         Les derniers articles de la photo précédente étaient :
         ${lastTicketItems.map((i) => i.texte_brut).join(', ')}.
         Ne les répète PAS — commence à partir des articles qui suivent.`
          : ''
      const prompt = `Tu es un OCR spécialisé tickets de caisse français.

  Extrais TOUTES les lignes de produits. RÈGLES STRICTES :
  - Copie le texte du ticket le plus fidèlement possible, NE L'INTERPRÈTE PAS
  - Garde les abréviations telles quelles (ex: "TH.ENT.LISTAO NAT" pas "Thon entier")
  - Inclus le poids/volume si visible
  - Inclus le prix
  - Ignore : numéros de caisse, totaux, remises globales, TVA
  ${continuityContext}

  Réponds UNIQUEMENT en JSON valide :
  {
    "enseigne": "E.Leclerc",
    "lieu": "Conflans",
    "date": "2026-05-22",
    "lignes": [
      {
        "texte_brut": "TRANIER,OLIV.VTES -25% SEL,160G",
        "prix": 1.96,
        "poids": "160g",
        "section": "EPICERIE SALEE",
        "type": "alimentaire",
        "confiance": "haute"
      },
      {
        "texte_brut": "ECO+,TH.ENT.LISTAO NAT,140G",
        "prix": 1.32,
        "poids": "140g",
        "section": "EPICERIE SALEE",
        "type": "alimentaire",
        "confiance": "basse"
      }
    ]
  }

  Niveaux de confiance :
  - "haute" : nom clair et complet, peu d'abréviations
  - "moyenne" : quelques abréviations mais déchiffrable
  - "basse" : fortement abrégé ou illisible
  Type : "alimentaire" ou "non_alimentaire"`

      const res = await fetch('/gardemanger/api-proxy.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proxy_token: 'lgm_2024_xK9mP3',
          model: 'gpt-4o-mini',
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

      setScanResult({ enseigne: parsed.enseigne, lieu: parsed.lieu, date: parsed.date })
      setScanLoading(false)

      // Phase 2 — Open Food Facts pour moyenne et basse
      setOffLoading(true)
      const haute = [],
        moyenne = [],
        basse = []

      for (const ligne of parsed.lignes || []) {
        if (ligne.confiance === 'haute') {
          haute.push({ ...ligne, selected: true, candidats: null, selected_candidat: 0 })
        } else {
          const candidats = await searchProduct(ligne.texte_brut)
          const item = { ...ligne, selected: true, candidats, selected_candidat: 0 }
          if (candidats?.length) {
            moyenne.push(item)
          } else {
            basse.push(item)
          }
        }
      }
      const hauteDedup = detectDoublons(haute, lastTicketItems)
      setScanPhases({ haute: hauteDedup, moyenne, basse })
      const derniersArticles = parsed.lignes?.slice(-3) || []
      setLastTicketItems(derniersArticles)
      setPhotoCount((p) => p + 1)
      setOffLoading(false)
    } catch (e) {
      setScanResult({ error: true })
      setScanLoading(false)
      setOffLoading(false)
    }
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
    setLastTicketItems([])
    setPhotoCount(0)
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
      const equipmentList = equipment.map((e) => e.label).join(', ') || 'Équipement de base'

      const prompt = `Tu es un chef cuisinier intelligent. Analyse cette photo de recette et croise avec l'inventaire.

INVENTAIRE DISPONIBLE : ${inventaire}
ÉQUIPEMENT : ${equipmentList}

Pour chaque ingrédient manquant, applique ces règles de proportions intelligentes :
- Ingrédients de base très utilisés (œufs, oignons, ail, pommes de terre, carottes, pâtes, riz) : GONFLE les quantités (x2 ou x3) car ça se conserve et c'est toujours utile
- Si l'user a un air fryer ou congélateur : gonfle encore plus les féculents et viandes
- Liquides (lait, crème, huile), épices, herbes fraîches : NE PAS gonfler, juste la quantité exacte
- Indique dans "note_quantite" pourquoi tu as gonflé si tu l'as fait

Réponds UNIQUEMENT en JSON valide :
{
  "nom_recette": "Nom identifié",
  "portions_recette": 4,
  "ingredients": [
    {
      "nom": "Œufs",
      "quantite_recette": "2",
      "quantite_course": "6",
      "unite": "pièce(s)",
      "statut": "manquant",
      "note": "Quantité gonflée — les œufs se conservent 3 semaines",
      "note_quantite": "x3 car base du frigo"
    },
    {
      "nom": "Crème fraîche",
      "quantite_recette": "200",
      "quantite_course": "200",
      "unite": "ml",
      "statut": "substituable",
      "substitut": "Yaourt grec",
      "note": "Le yaourt grec fonctionne ici"
    },
    {
      "nom": "Lardons",
      "quantite_recette": "150",
      "quantite_course": "150",
      "unite": "g",
      "statut": "disponible",
      "note": "Tu en as dans ton frigo"
    }
  ],
  "conseil_chef": "Conseil global"
}

Statuts : "disponible", "substituable", "manquant"`

      const res = await fetch('/gardemanger/api-proxy.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const addSingleToShoppingList = (ing) => {
    setShoppingLists((p) => {
      // Cherche une liste "Recette en cours" existante ou en crée une
      const existing = p.find((l) => l.goal === `Recette : ${recipeAnalysisResult?.nom_recette}`)
      const item = {
        nom: ing.nom,
        quantite: `${ing.quantite_course || ing.quantite_recette} ${ing.unite}`,
        conseil: ing.note || '',
        prix_estime: '',
      }
      if (existing) {
        return p.map((l) => {
          if (l.goal !== `Recette : ${recipeAnalysisResult?.nom_recette}`) return l
          const cats = l.categories.map((c) =>
            c.nom === 'Ingrédients manquants' ? { ...c, items: [...c.items, item] } : c
          )
          return { ...l, categories: cats }
        })
      }
      return [
        {
          id: Date.now(),
          goal: `Recette : ${recipeAnalysisResult?.nom_recette}`,
          titre: recipeAnalysisResult?.nom_recette,
          budget_estime: 'À estimer',
          repas_couverts: `${recipeAnalysisResult?.portions_recette || '?'} portions`,
          categories: [{ nom: 'Ingrédients manquants', items: [item] }],
          conseils: [],
          checked: {},
        },
        ...p,
      ]
    })
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
            quantite: `${i.quantite_course || i.quantite_recette} ${i.unite}`,
            conseil: i.note || '',
            prix_estime: '',
          })),
        },
      ],
      conseils: recipeAnalysisResult.conseil_chef ? [recipeAnalysisResult.conseil_chef] : [],
      checked: {},
    }
    setShoppingLists((p) => [newList, ...p])
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

  // ── Convive helpers
  const handleConviveTap = (uid) => {
    const now = Date.now()
    const last = lastTapRef.current[uid] || 0
    lastTapRef.current[uid] = now
    if (now - last < 400) {
      // Double tap → cuisinier du soir
      setCuisinierIdState((p) => (p === uid ? null : uid))
      if (!selectedConvives.includes(uid)) setSelectedConvives((p) => [...p, uid])
    } else {
      // Simple tap → mange ce soir
      setSelectedConvives((p) => (p.includes(uid) ? p.filter((x) => x !== uid) : [...p, uid]))
    }
  }

  const updateUserProfile = (uid, field, value) => {
    setUsers((p) => p.map((u) => (u.id === uid ? { ...u, [field]: value } : u)))
  }

  const toggleUserTag = (uid, field, tagId) => {
    setUsers((p) =>
      p.map((u) => {
        if (u.id !== uid) return u
        const arr = u[field] || []
        return {
          ...u,
          [field]: arr.includes(tagId) ? arr.filter((t) => t !== tagId) : [...arr, tagId],
        }
      })
    )
  }

  const addToHistory = (recipeName) => {
    setMealHistory((p) =>
      [
        {
          id: Date.now(),
          name: recipeName,
          date: new Date().toISOString(),
          convives: selectedConvives
            .map((id) => users.find((u) => u.id === id)?.name)
            .filter(Boolean),
        },
        ...p,
      ].slice(0, 50)
    ) // garde 50 repas max
  }

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

    const season = getSeason()
    const eqList =
      equipment.map((e) => `${e.label}${e.model ? ` (${e.model})` : ''}`).join(', ') ||
      'Équipement de base'
    const eLvl = ENERGY_LEVELS.find((e) => e.id === energyLevel)?.label || energyLevel
    const objList =
      objectives
        .map((o) => OBJECTIVES.find((x) => x.id === o)?.label)
        .filter(Boolean)
        .join(', ') || 'Aucun'

    // Ingrédients — mode vide-frigo priorise les expirants
    const ingList = ingredients
      .map((i) => {
        const d = getDaysLeft(i.dlc)
        const urgent = d !== null && d <= 2
        return `${i.name} (${i.quantity}${i.unit}${urgent ? ' ⚠️URGENT' : ''})`
      })
      .join('\n')

    // Profils convives enrichis
    const convivesContext =
      selectedConvives.length > 0
        ? '\n\nCONVIVES CE SOIR :\n' +
          selectedConvives
            .map((id) => {
              const u = users.find((u) => u.id === id)
              if (!u) return null
              const age = AGE_GROUPS.find((a) => a.id === u.age_group)?.label || 'Adulte'
              const prefs = (u.preferences || [])
                .map((p) => PREF_TAGS.find((t) => t.id === p)?.label)
                .filter(Boolean)
                .join(', ')
              const restr = (u.restrictions || [])
                .map((r) => RESTRICTION_TAGS.find((t) => t.id === r)?.label)
                .filter(Boolean)
                .join(', ')
              const level = COOK_LEVELS.find((l) => l.id === u.cook_level)?.label || ''
              const isCook = id === cuisinierId
              return `- ${u.name} (${age}${isCook ? ' 👨‍🍳 CUISINIER DU SOIR' : ''})${level ? ' niveau ' + level : ''}${prefs ? ' | Aime: ' + prefs : ''}${restr ? ' | RESTRICTIONS: ' + restr : ''}`
            })
            .filter(Boolean)
            .join('\n')
        : ''

    // Historique repas récents (éviter répétitions)
    const historyContext =
      mealHistory.length > 0
        ? '\n\nREPAS DES 7 DERNIERS JOURS (évite les répétitions) :\n' +
          mealHistory
            .slice(0, 7)
            .map((m) => m.name)
            .join(', ')
        : ''

    // Notes et retours
    const ratingContext =
      ratings.length > 0
        ? '\n\nPRÉFÉRENCES NOTÉES :\n' +
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
        ? '\n\nRETOURS CUISINIER :\n' +
          cookLogs
            .slice(-5)
            .map(
              (l) =>
                `${l.recipeName}${l.difficulty ? ` — ${l.difficulty}` : ''}${l.remark ? ` — ${l.remark}` : ''}`
            )
            .join('\n')
        : ''

    // Mode soirée
    const soireeContext = modeSoiree
      ? `\n\nMODE SOIRÉE : ${guestCount} personnes. Génère un menu complet : entrée + plat + dessert (3 recettes).`
      : ''

    // Budget
    const budgetContext = weeklyBudget
      ? `\n\nBUDGET SEMAINE : ${weeklyBudget}€ — privilégie les recettes économiques.`
      : ''

    // Mode vide-frigo
    const videContext = modeVideFrigo
      ? '\n\nMODE VIDE-FRIGO : PRIORITÉ ABSOLUE aux ingrédients marqués ⚠️URGENT. Utilise-les tous si possible.'
      : ''

    // Saison
    const seasonContext = `\n\nSAISON : ${season.label}. Légumes/fruits de saison à privilégier : ${season.hint}.`

    const portions = modeSoiree ? guestCount : selectedConvives.length || 2

    const prompt = `Tu es un chef cuisinier bienveillant. Parle simplement, sans jargon technique.

INGRÉDIENTS DISPONIBLES :
${ingList}

ÉQUIPEMENT : ${eqList}
NIVEAU D'ÉNERGIE : ${eLvl}
TEMPS DISPONIBLE : ${timeAvail} minutes
OBJECTIFS : ${objList}${convivesContext}${historyContext}${ratingContext}${cookContext}${soireeContext}${budgetContext}${videContext}${seasonContext}

Génère exactement 3 recettes pour ${portions} personnes. ${modeSoiree ? 'Une entrée, un plat, un dessert.' : ''}
Réponds UNIQUEMENT en JSON valide :

{
  "recettes": [
    {
      "id": "unique_id_1",
      "nom": "Nom de la recette",
      "emoji": "🍳",
      "type": "plat",
      "temps": 15,
      "difficulte": "facile",
      "portions": ${portions},
      "conservation_label": "Se conserve 5 jours au frigo",
      "de_saison": true,
      "budget_estime": "3-5€",
      "objectifs_couverts": ["rapide"],
      "description": "Description courte et appétissante",
      "ingredients_detail": [
        { "nom": "Œufs", "quantite": 3, "unite": "pièce(s)" }
      ],
      "etapes": ["Étape 1", "Étape 2"],
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
    const season = getSeason()
    const eqList =
      equipment.map((e) => `${e.label}${e.model ? ` (${e.model})` : ''}`).join(', ') || 'Basique'

    // Inventaire détaillé avec DLC
    const ingList =
      ingredients
        .map((i) => {
          const d = getDaysLeft(i.dlc)
          return `${i.name} (${i.quantity}${i.unit}${d !== null && d <= 3 ? ' ⚠️expire bientôt' : ''})`
        })
        .join(', ') || 'Vide'

    // Profils convives
    const convivesInfo =
      users.length > 0
        ? users
            .map((u) => {
              const age = AGE_GROUPS.find((a) => a.id === u.age_group)?.label || 'Adulte'
              const prefs = (u.preferences || [])
                .map((p) => PREF_TAGS.find((t) => t.id === p)?.label)
                .filter(Boolean)
                .join(', ')
              const restr = (u.restrictions || [])
                .map((r) => RESTRICTION_TAGS.find((t) => t.id === r)?.label)
                .filter(Boolean)
                .join(', ')
              return `${u.name} (${age}${prefs ? ' | aime: ' + prefs : ''}${restr ? ' | RESTRICTIONS: ' + restr : ''})`
            })
            .join('\n')
        : 'Non renseignés'

    // Historique repas récents
    const historyInfo =
      mealHistory.length > 0
        ? mealHistory
            .slice(0, 7)
            .map((m) => m.name)
            .join(', ')
        : 'Aucun'

    const prompt = `Tu es un chef cuisinier et assistant courses intelligent. Génère une liste de courses PERSONNALISÉE et INTELLIGENTE.

OBJECTIF : ${shoppingGoal}

ÉQUIPEMENT DISPONIBLE : ${eqList}

DÉJÀ EN STOCK (ne pas racheter sauf si insuffisant) :
${ingList}

PROFILS DES CONVIVES :
${convivesInfo}

REPAS DES 7 DERNIERS JOURS (évite les répétitions) :
${historyInfo}

SAISON ACTUELLE : ${season.label} — privilégie : ${season.hint}

RÈGLES IMPORTANTES :
- Ne liste PAS ce qui est déjà en stock en quantité suffisante
- Adapte les quantités aux profils (enfant de 3 ans = petites portions, pas d'épices fortes)
- Tiens compte des restrictions alimentaires de chaque convive
- Propose des ingrédients polyvalents qui servent plusieurs repas
- Inclus des produits de base qui manquent (huile, sel, etc.) si pas en stock
- Favorise les légumes et fruits de saison
- Si objectif économique : privilégie les protéines économiques (œufs, légumineuses, poulet)

Réponds UNIQUEMENT en JSON valide :
{
  "titre": "Courses semaine du [date]",
  "budget_estime": "45-55€",
  "repas_couverts": "7 dîners + 5 midis",
  "categories": [
    {
      "nom": "Légumes & Fruits",
      "items": [
        {
          "nom": "Courgettes",
          "quantite": "4",
          "conseil": "De saison, idéales pour la ratatouille et les pâtes",
          "prix_estime": "2€",
          "utilisation": "Ratatouille lundi, gratin mercredi"
        }
      ]
    }
  ],
  "conseils": [
    "Conseil batch cooking concret",
    "Astuce pour éviter le gaspillage"
  ]
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
    <>
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
          <button
            onClick={() => setShowTicketCamera(true)}
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
          </button>
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
              <Btn
                variant='outline'
                small
                onClick={() => {
                  setShowAddIng(!showAddIng)
                  setLastTicketItems([])
                  setPhotoCount(0)
                }}
              >
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
                        borderBottom:
                          i < filteredIngs.length - 1 ? `1px solid ${C.border}` : 'none',
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
                          style={{
                            display: 'flex',
                            gap: '4px',
                            marginTop: '4px',
                            flexWrap: 'wrap',
                          }}
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
                  <div style={{ fontSize: '30px', marginBottom: '8px' }}>🧴</div>Aucun produit.
                  Scanne un ticket !
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
                  <div style={{ fontSize: '12px', color: C.textLight }}>Extraction en cours</div>
                </div>
              ) : scanResult?.error ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div style={{ fontSize: '30px', marginBottom: '8px' }}>❌</div>
                  <div style={{ color: C.textMid, fontSize: '13px', marginBottom: '16px' }}>
                    Impossible de lire ce ticket.
                  </div>
                  <Btn variant='outline' onClick={() => setShowScanPanel(false)}>
                    Fermer
                  </Btn>
                </div>
              ) : (
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
                    🧾 {scanResult?.enseigne} — {scanResult?.lieu}
                  </div>
                  <div style={{ fontSize: '12px', color: C.textMid, marginBottom: '14px' }}>
                    {scanResult?.date}
                  </div>

                  {offLoading && (
                    <div
                      style={{
                        padding: '10px 12px',
                        background: `${C.green}10`,
                        borderRadius: '10px',
                        marginBottom: '14px',
                        fontSize: '12px',
                        color: C.green,
                      }}
                    >
                      🔍 Recherche Open Food Facts en cours...
                    </div>
                  )}

                  {/* Stats */}
                  {!offLoading && (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                      {[
                        { label: '✅ Reconnus', count: scanPhases.haute.length, color: C.green },
                        {
                          label: '🔍 À confirmer',
                          count: scanPhases.moyenne.length,
                          color: '#d4a017',
                        },
                        { label: '❓ Inconnus', count: scanPhases.basse.length, color: C.terra },
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
                  )}

                  {/* ✅ Haute confiance */}
                  {scanPhases.haute.length > 0 && (
                    <div style={{ marginBottom: '14px' }}>
                      <SectionLabel>✅ Reconnus directement</SectionLabel>
                      {scanPhases.haute.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() =>
                            setScanPhases((p) => ({
                              ...p,
                              haute: p.haute.map((x, i) =>
                                i === idx ? { ...x, selected: !x.selected } : x
                              ),
                            }))
                          }
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '7px 0',
                            borderBottom: `1px solid ${C.border}`,
                            cursor: 'pointer',
                            opacity: item.selected ? 1 : 0.5,
                          }}
                        >
                          <div
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '5px',
                              border: `2px solid ${item.selected ? C.green : C.border}`,
                              background: item.selected ? C.green : 'transparent',
                              flexShrink: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {item.selected && (
                              <span style={{ color: '#fff', fontSize: '11px' }}>✓</span>
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 600, fontSize: '13px', color: C.text }}>
                              {item.texte_brut}
                            </span>
                            <span
                              style={{ fontSize: '11px', color: C.textLight, marginLeft: '8px' }}
                            >
                              {item.poids}
                            </span>
                          </div>
                          {item.prix && (
                            <span style={{ fontSize: '11px', color: C.green }}>{item.prix}€</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 🔍 Moyenne confiance — candidats OFF */}
                  {scanPhases.moyenne.length > 0 && (
                    <div style={{ marginBottom: '14px' }}>
                      <SectionLabel>🔍 À confirmer</SectionLabel>
                      {scanPhases.moyenne.map((item, idx) => (
                        <div
                          key={idx}
                          style={{
                            marginBottom: '10px',
                            padding: '10px',
                            background: '#d4a01710',
                            borderRadius: '12px',
                            border: '1px solid #d4a01730',
                          }}
                        >
                          <div
                            style={{ fontSize: '11px', color: C.textLight, marginBottom: '6px' }}
                          >
                            Ticket :{' '}
                            <span style={{ fontFamily: 'monospace' }}>{item.texte_brut}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {item.candidats?.map((c, ci) => (
                              <button
                                key={ci}
                                onClick={() =>
                                  setScanPhases((p) => ({
                                    ...p,
                                    moyenne: p.moyenne.map((x, i) =>
                                      i === idx
                                        ? { ...x, selected_candidat: ci, selected: true }
                                        : x
                                    ),
                                  }))
                                }
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '6px 8px',
                                  borderRadius: '10px',
                                  border:
                                    item.selected_candidat === ci
                                      ? `2px solid ${C.green}`
                                      : `1px solid ${C.border}`,
                                  background:
                                    item.selected_candidat === ci ? `${C.green}15` : C.bgInset,
                                  cursor: 'pointer',
                                }}
                              >
                                {c.image && (
                                  <img
                                    src={c.image}
                                    style={{
                                      width: '28px',
                                      height: '28px',
                                      objectFit: 'contain',
                                      borderRadius: '4px',
                                    }}
                                  />
                                )}
                                <span style={{ fontSize: '11px', fontWeight: 600, color: C.text }}>
                                  {c.nom} {c.poids}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ❓ Basse confiance */}
                  {scanPhases.basse.length > 0 && (
                    <div style={{ marginBottom: '14px' }}>
                      <SectionLabel>
                        ❓ Non reconnus — à ignorer ou corriger manuellement
                      </SectionLabel>
                      {scanPhases.basse.map((item, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '7px 0',
                            borderBottom: `1px solid ${C.border}`,
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <span
                              style={{
                                fontSize: '12px',
                                fontFamily: 'monospace',
                                color: C.textMid,
                              }}
                            >
                              {item.texte_brut}
                            </span>
                            {item.prix && (
                              <span style={{ fontSize: '11px', color: C.green, marginLeft: '8px' }}>
                                {item.prix}€
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() =>
                              setScanPhases((p) => ({
                                ...p,
                                basse: p.basse.filter((_, i) => i !== idx),
                              }))
                            }
                            style={{
                              background: 'none',
                              border: 'none',
                              color: C.border,
                              cursor: 'pointer',
                              fontSize: '16px',
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>
                    <Btn variant='outline' onClick={() => setShowScanPanel(false)}>
                      Annuler
                    </Btn>
                    <div style={{ flex: 1 }}>
                      <Btn
                        variant='green'
                        onClick={() => {
                          const today = new Date()
                          // Import haute confiance sélectionnés
                          ;[
                            ...scanPhases.haute.filter((i) => i.selected),
                            ...scanPhases.moyenne.filter((i) => i.selected),
                          ].forEach((item) => {
                            const nom =
                              item.candidats?.[item.selected_candidat]?.nom || item.texte_brut
                            if (item.type === 'alimentaire') {
                              setIngredients((p) => [
                                ...p,
                                {
                                  id: Date.now() + Math.random(),
                                  name: nom,
                                  quantity: '1',
                                  unit: item.poids || 'pièce(s)',
                                  category: 'Autre',
                                  dlc: '',
                                  storage: 'garde_manger',
                                },
                              ])
                            } else {
                              setNonFood((p) => [
                                ...p,
                                {
                                  id: Date.now() + Math.random(),
                                  name: nom,
                                  quantity: '1',
                                  unit: 'pièce(s)',
                                  category: 'Autre maison',
                                  prix: item.prix,
                                },
                              ])
                            }
                          })
                          setShowScanPanel(false)
                          setScanPhases({ haute: [], moyenne: [], basse: [] })
                        }}
                      >
                        ✓ Importer (
                        {scanPhases.haute.filter((i) => i.selected).length +
                          scanPhases.moyenne.filter((i) => i.selected).length}
                        )
                      </Btn>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
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
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'flex-start',
                                }}
                              >
                                <div style={{ flex: 1 }}>
                                  <span
                                    style={{ fontWeight: 700, fontSize: '13px', color: C.text }}
                                  >
                                    {ing.nom}
                                  </span>
                                  <div
                                    style={{
                                      display: 'flex',
                                      gap: '6px',
                                      alignItems: 'center',
                                      marginTop: '2px',
                                      flexWrap: 'wrap',
                                    }}
                                  >
                                    {/* Quantité recette */}
                                    <span style={{ fontSize: '11px', color: C.textMid }}>
                                      Recette : {ing.quantite_recette || ing.quantite} {ing.unite}
                                    </span>
                                    {/* Quantité gonflée si différente */}
                                    {ing.quantite_course &&
                                      ing.quantite_course !== ing.quantite_recette && (
                                        <span
                                          style={{
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            color: C.terra,
                                            background: `${C.terra}15`,
                                            padding: '1px 6px',
                                            borderRadius: '8px',
                                          }}
                                        >
                                          → À acheter : {ing.quantite_course} {ing.unite}
                                        </span>
                                      )}
                                  </div>
                                  {ing.note_quantite && (
                                    <div
                                      style={{
                                        fontSize: '10px',
                                        color: C.terra,
                                        marginTop: '2px',
                                        fontStyle: 'italic',
                                      }}
                                    >
                                      💡 {ing.note_quantite}
                                    </div>
                                  )}
                                  {ing.substitut && (
                                    <div
                                      style={{
                                        fontSize: '11px',
                                        color: '#d4a017',
                                        marginTop: '2px',
                                      }}
                                    >
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
                                {/* Bouton + pour ajouter à la liste */}
                                {statut === 'manquant' && (
                                  <button
                                    onClick={() => addSingleToShoppingList(ing)}
                                    style={{
                                      background: C.terra,
                                      border: 'none',
                                      borderRadius: '8px',
                                      color: '#fff',
                                      fontWeight: 700,
                                      fontSize: '16px',
                                      width: '28px',
                                      height: '28px',
                                      cursor: 'pointer',
                                      flexShrink: 0,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      marginLeft: '8px',
                                    }}
                                  >
                                    +
                                  </button>
                                )}
                              </div>
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
      {showTicketCamera && (
        <TicketCamera
          onCapture={(file) => {
            setShowTicketCamera(false)
            scanTicket(file)
          }}
          onClose={() => setShowTicketCamera(false)}
        />
      )}
    </>
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
              Ajoute les convives pour des recettes personnalisées
            </div>
          </Card>
        ) : (
          users.map((u) => (
            <Card key={u.id} style={{ marginBottom: '10px' }}>
              {/* Header convive */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>
                    {AGE_GROUPS.find((a) => a.id === u.age_group)?.icon || '👤'}
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: C.brown }}>
                      {u.name}
                    </div>
                    {u.cook_level && (
                      <div style={{ fontSize: '10px', color: C.textLight }}>
                        {COOK_LEVELS.find((l) => l.id === u.cook_level)?.label}
                      </div>
                    )}
                  </div>
                  {/* Note moyenne */}
                  {ratings.filter((r) => r.userId === u.id).length > 0 && (
                    <span style={{ fontSize: '11px', color: C.star }}>
                      ★{' '}
                      {(
                        ratings.filter((r) => r.userId === u.id).reduce((s, r) => s + r.stars, 0) /
                        ratings.filter((r) => r.userId === u.id).length
                      ).toFixed(1)}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => setEditingUser(editingUser === u.id ? null : u.id)}
                    style={{
                      background: 'none',
                      border: `1px solid ${C.border}`,
                      borderRadius: '8px',
                      color: C.textMid,
                      fontSize: '11px',
                      padding: '4px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    {editingUser === u.id ? '✕' : '✏️ Profil'}
                  </button>
                  <button
                    onClick={() => setUsers((p) => p.filter((x) => x.id !== u.id))}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: C.border,
                      cursor: 'pointer',
                      fontSize: '16px',
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Profil éditable */}
              {editingUser === u.id && (
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '12px' }}>
                  {/* Tranche d'âge */}
                  <div style={{ marginBottom: '10px' }}>
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: C.textLight,
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        marginBottom: '6px',
                      }}
                    >
                      Tranche d'âge
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {AGE_GROUPS.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => updateUserProfile(u.id, 'age_group', a.id)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: 700,
                            border:
                              u.age_group === a.id
                                ? `1.5px solid ${C.brown}`
                                : `1px solid ${C.border}`,
                            background: u.age_group === a.id ? `${C.brown}15` : C.bgInset,
                            color: u.age_group === a.id ? C.brown : C.textLight,
                            cursor: 'pointer',
                          }}
                        >
                          {a.icon} {a.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Niveau cuisine */}
                  <div style={{ marginBottom: '10px' }}>
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: C.textLight,
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        marginBottom: '6px',
                      }}
                    >
                      Niveau cuisine
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {COOK_LEVELS.map((l) => (
                        <button
                          key={l.id}
                          onClick={() => updateUserProfile(u.id, 'cook_level', l.id)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: 700,
                            border:
                              u.cook_level === l.id
                                ? `1.5px solid ${C.green}`
                                : `1px solid ${C.border}`,
                            background: u.cook_level === l.id ? `${C.green}15` : C.bgInset,
                            color: u.cook_level === l.id ? C.green : C.textLight,
                            cursor: 'pointer',
                          }}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Préférences */}
                  <div style={{ marginBottom: '10px' }}>
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: C.green,
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        marginBottom: '6px',
                      }}
                    >
                      + Aime
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {PREF_TAGS.map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => toggleUserTag(u.id, 'preferences', tag.id)}
                          style={{
                            padding: '5px 9px',
                            borderRadius: '16px',
                            fontSize: '11px',
                            fontWeight: 600,
                            border: (u.preferences || []).includes(tag.id)
                              ? `1.5px solid ${C.green}`
                              : `1px solid ${C.border}`,
                            background: (u.preferences || []).includes(tag.id)
                              ? `${C.green}15`
                              : C.bgInset,
                            color: (u.preferences || []).includes(tag.id) ? C.green : C.textLight,
                            cursor: 'pointer',
                          }}
                        >
                          {tag.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Restrictions */}
                  <div>
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: C.terra,
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        marginBottom: '6px',
                      }}
                    >
                      — Restrictions / Allergies
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {RESTRICTION_TAGS.map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => toggleUserTag(u.id, 'restrictions', tag.id)}
                          style={{
                            padding: '5px 9px',
                            borderRadius: '16px',
                            fontSize: '11px',
                            fontWeight: 600,
                            border: (u.restrictions || []).includes(tag.id)
                              ? `1.5px solid ${C.terra}`
                              : `1px solid ${C.border}`,
                            background: (u.restrictions || []).includes(tag.id)
                              ? `${C.terra}15`
                              : C.bgInset,
                            color: (u.restrictions || []).includes(tag.id) ? C.terra : C.textLight,
                            cursor: 'pointer',
                          }}
                        >
                          {tag.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tags résumé si pas en édition */}
              {editingUser !== u.id && (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {(u.preferences || []).map((p) => (
                    <span
                      key={p}
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '8px',
                        background: `${C.green}15`,
                        color: C.green,
                      }}
                    >
                      {PREF_TAGS.find((t) => t.id === p)?.label}
                    </span>
                  ))}
                  {(u.restrictions || []).map((r) => (
                    <span
                      key={r}
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '8px',
                        background: `${C.terra}15`,
                        color: C.terra,
                      }}
                    >
                      {RESTRICTION_TAGS.find((t) => t.id === r)?.label}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Historique repas */}
      {mealHistory.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
            }}
          >
            <SectionLabel>Historique repas</SectionLabel>
            <button
              onClick={() => setMealHistory([])}
              style={{
                background: 'none',
                border: 'none',
                color: C.textLight,
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              Effacer
            </button>
          </div>
          <Card>
            {mealHistory.slice(0, 7).map((m, i) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom:
                    i < Math.min(mealHistory.length, 7) - 1 ? `1px solid ${C.border}` : 'none',
                }}
              >
                <span style={{ fontSize: '13px', color: C.text }}>{m.name}</span>
                <span style={{ fontSize: '11px', color: C.textLight }}>
                  {new Date(m.date).toLocaleDateString('fr-FR', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </div>
            ))}
          </Card>
        </div>
      )}
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
          <div style={{ marginBottom: '12px' }}>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: C.textLight,
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                marginBottom: '4px',
              }}
            >
              Pour qui ? (2× tap = cuisinier 👨‍🍳)
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {users.map((u) => {
                const selected = selectedConvives.includes(u.id)
                const isCook = cuisinierId === u.id
                const age = AGE_GROUPS.find((a) => a.id === u.age_group)
                return (
                  <button
                    key={u.id}
                    onClick={() => handleConviveTap(u.id)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 700,
                      border: isCook
                        ? `2px solid ${C.terra}`
                        : selected
                          ? `1.5px solid ${C.brown}`
                          : `1px solid ${C.border}`,
                      background: isCook ? `${C.terra}20` : selected ? `${C.brown}15` : C.bgInset,
                      color: isCook ? C.terra : selected ? C.brown : C.textLight,
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    {age?.icon || '👤'} {u.name} {isCook ? '👨‍🍳' : ''}
                    {(u.restrictions || []).length > 0 && (
                      <span style={{ fontSize: '9px', marginLeft: '4px' }}>⚠️</span>
                    )}
                  </button>
                )
              })}
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

      {/* Modes spéciaux */}
      <Card>
        <SectionLabel>Modes spéciaux</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Mode soirée */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderRadius: '10px',
              background: modeSoiree ? `${C.brown}10` : C.bgInset,
              border: `1px solid ${modeSoiree ? C.brown : C.border}`,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: modeSoiree ? C.brown : C.textMid,
                }}
              >
                🥂 Mode soirée
              </div>
              <div style={{ fontSize: '10px', color: C.textLight }}>
                Menu entrée + plat + dessert
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {modeSoiree && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    onClick={() => setGuestCount((p) => Math.max(2, p - 1))}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      border: `1px solid ${C.border}`,
                      background: C.bgCard,
                      color: C.brown,
                      cursor: 'pointer',
                      fontSize: '14px',
                    }}
                  >
                    −
                  </button>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: C.brown }}>
                    {guestCount}
                  </span>
                  <button
                    onClick={() => setGuestCount((p) => Math.min(20, p + 1))}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      border: `1px solid ${C.border}`,
                      background: C.bgCard,
                      color: C.brown,
                      cursor: 'pointer',
                      fontSize: '14px',
                    }}
                  >
                    +
                  </button>
                </div>
              )}
              <button
                onClick={() => setModeSoiree((p) => !p)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  border: 'none',
                  background: modeSoiree ? C.brown : 'transparent',
                  color: modeSoiree ? '#fff' : C.textLight,
                  cursor: 'pointer',
                  border: `1px solid ${modeSoiree ? C.brown : C.border}`,
                }}
              >
                {modeSoiree ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {/* Mode vide-frigo */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderRadius: '10px',
              background: modeVideFrigo ? `${C.terra}10` : C.bgInset,
              border: `1px solid ${modeVideFrigo ? C.terra : C.border}`,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: modeVideFrigo ? C.terra : C.textMid,
                }}
              >
                ♻️ Vide-frigo
              </div>
              <div style={{ fontSize: '10px', color: C.textLight }}>
                Priorité aux produits qui expirent
              </div>
            </div>
            <button
              onClick={() => setModeVideFrigo((p) => !p)}
              style={{
                padding: '5px 10px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 700,
                border: `1px solid ${modeVideFrigo ? C.terra : C.border}`,
                background: modeVideFrigo ? C.terra : 'transparent',
                color: modeVideFrigo ? '#fff' : C.textLight,
                cursor: 'pointer',
              }}
            >
              {modeVideFrigo ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Budget semaine */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderRadius: '10px',
              background: weeklyBudget ? `${C.green}10` : C.bgInset,
              border: `1px solid ${weeklyBudget ? C.green : C.border}`,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: weeklyBudget ? C.green : C.textMid,
                }}
              >
                💶 Budget semaine
              </div>
              <div style={{ fontSize: '10px', color: C.textLight }}>L'IA optimise les recettes</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type='number'
                placeholder='80'
                value={weeklyBudget}
                onChange={(e) => setWeeklyBudget(e.target.value)}
                style={{
                  width: '52px',
                  padding: '5px 6px',
                  borderRadius: '8px',
                  border: `1px solid ${C.border}`,
                  background: C.bgCard,
                  color: C.text,
                  fontSize: '12px',
                  fontFamily: "'Lato',sans-serif",
                  textAlign: 'center',
                }}
              />
              <span style={{ fontSize: '11px', color: C.textLight }}>€</span>
            </div>
          </div>
        </div>

        {/* Saison */}
        <div
          style={{
            marginTop: '10px',
            padding: '6px 10px',
            borderRadius: '8px',
            background: `${C.green}08`,
            border: `1px solid ${C.green}25`,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span style={{ fontSize: '11px', color: C.green, fontWeight: 600 }}>
            🌱 {getSeason().label} — {getSeason().hint}
          </span>
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
                  {recipe.de_saison && <span style={st.badge(C.green)}>🌱 De saison</span>}
                  {recipe.budget_estime && (
                    <span style={st.badge(C.brownMid)}>💶 {recipe.budget_estime}</span>
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
                    <Btn
                      variant='outline'
                      small
                      onClick={() => {
                        addToHistory(recipe.nom)
                        openCookFeedback(recipe)
                      }}
                    >
                      👨‍🍳 J'ai cuisiné ça
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
    const activeLists = JSON.parse(sessionStorage.getItem('lgm_active_lists') || '[]')
    const setActiveLists = (v) =>
      sessionStorage.setItem(
        'lgm_active_lists',
        JSON.stringify(typeof v === 'function' ? v(activeLists) : v)
      )

    // Consolide recettes + panier manuel
    const consolidatedItems = {}

    // Items des listes recettes sélectionnées
    shoppingLists
      .filter((l) => activeLists.includes(l.id))
      .forEach((list) => {
        list.categories?.forEach((cat) => {
          cat.items.forEach((item) => {
            const key = item.nom.toLowerCase().trim()
            if (!consolidatedItems[key])
              consolidatedItems[key] = { nom: item.nom, quantites: [], source: 'liste' }
            consolidatedItems[key].quantites.push({
              quantite: item.quantite,
              listTitre: list.titre,
            })
          })
        })
      })

    // Items du panier manuel — toujours présents
    manualCart.forEach((item) => {
      const key = item.nom.toLowerCase().trim()
      if (!consolidatedItems[key])
        consolidatedItems[key] = { nom: item.nom, quantites: [], source: 'manuel' }
      consolidatedItems[key].quantites.push({
        quantite: `${item.quantity} ${item.unit}`,
        listTitre: 'Panier',
      })
    })

    const consolidatedList = Object.values(consolidatedItems)
    const checkedKey = 'lgm_checked_consolidated'
    const checkedItems = JSON.parse(sessionStorage.getItem(checkedKey) || '{}')
    const toggleChecked = (key) => {
      const updated = { ...checkedItems, [key]: !checkedItems[key] }
      sessionStorage.setItem(checkedKey, JSON.stringify(updated))
      setShoppingLists((p) => [...p]) // force re-render
    }

    const totalItems = consolidatedList.length
    const doneItems = consolidatedList.filter(
      (i) => checkedItems[i.nom.toLowerCase().trim()]
    ).length

    return (
      <div style={st.content}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
          }}
        >
          <SectionLabel>Mes courses</SectionLabel>
          <Btn variant='outline' small onClick={() => setShowAddList(!showAddList)}>
            {showAddList ? '✕' : '+ Nouvelle liste IA'}
          </Btn>
        </div>

        {showAddList && (
          <Card accent style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', color: C.textMid, marginBottom: '8px' }}>
              L'IA génère une liste depuis ton objectif
            </div>
            <div style={{ marginBottom: '10px' }}>
              <Input
                multiline
                placeholder='Ex : 5 déjeuners pour la semaine, budget 20€...'
                value={shoppingGoal}
                onChange={setShoppingGoal}
              />
            </div>
            <Btn onClick={generateShoppingList} disabled={!shoppingGoal.trim() || shoppingLoading}>
              {shoppingLoading ? '⏳ Génération...' : '✨ Générer la liste'}
            </Btn>
          </Card>
        )}

        {/* Boutons recettes */}
        {shoppingLists.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: C.textLight,
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                marginBottom: '8px',
              }}
            >
              Recettes à combiner
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {shoppingLists.map((list) => {
                const total = list.categories?.reduce((a, c) => a + c.items.length, 0) || 0
                const isActive = activeLists.includes(list.id)
                return (
                  <button
                    key={list.id}
                    onClick={() => {
                      setActiveLists(
                        isActive
                          ? activeLists.filter((id) => id !== list.id)
                          : [...activeLists, list.id]
                      )
                      sessionStorage.removeItem(checkedKey)
                      setShoppingLists((p) => [...p])
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderRadius: '14px',
                      border: isActive ? `2px solid ${C.brown}` : `1px solid ${C.border}`,
                      background: isActive ? `${C.brown}15` : C.bgInset,
                      cursor: 'pointer',
                      fontFamily: "'Lato',sans-serif",
                      minWidth: '80px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: isActive ? C.brown : C.textMid,
                        maxWidth: '90px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {list.titre || list.goal}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        color: isActive ? C.terra : C.textLight,
                        marginTop: '2px',
                      }}
                    >
                      {Object.values(list.checked || {}).filter(Boolean).length}/{total}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShoppingLists((p) => p.filter((l) => l.id !== list.id))
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: C.textLight,
                        fontSize: '10px',
                        cursor: 'pointer',
                        marginTop: '2px',
                      }}
                    >
                      🗑
                    </button>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Panier manuel — ajout rapide */}
        <Card>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
            }}
          >
            <SectionLabel>🧺 Panier perso ({manualCart.length})</SectionLabel>
            {manualCart.length > 0 && (
              <button
                onClick={() => setManualCart([])}
                style={{
                  background: 'none',
                  border: 'none',
                  color: C.textLight,
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                Vider
              </button>
            )}
          </div>

          {/* Formulaire ajout rapide */}
          <ManualCartAdd
            onAdd={(item) => setManualCart((p) => [...p, { ...item, id: Date.now() }])}
          />

          {/* Items du panier */}
          {manualCart.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              {manualCart.map((item, i) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 0',
                    borderBottom: i < manualCart.length - 1 ? `1px solid ${C.border}` : 'none',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: C.text }}>
                      {item.nom}
                    </span>
                    <span style={{ fontSize: '12px', color: C.terra, marginLeft: '8px' }}>
                      {item.quantity} {item.unit}
                    </span>
                  </div>
                  <button
                    onClick={() => setManualCart((p) => p.filter((x) => x.id !== item.id))}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: C.border,
                      cursor: 'pointer',
                      fontSize: '16px',
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Vue consolidée */}
        {consolidatedList.length > 0 && (
          <Card>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}
            >
              <SectionLabel style={{ marginBottom: 0 }}>📋 Liste consolidée</SectionLabel>
              <div style={{ flex: 1, height: '5px', borderRadius: '3px', background: C.border }}>
                <div
                  style={{
                    height: '100%',
                    borderRadius: '3px',
                    background: C.green,
                    width: totalItems > 0 ? `${(doneItems / totalItems) * 100}%` : '0%',
                    transition: 'width 0.3s',
                  }}
                />
              </div>
              <span
                style={{ fontSize: '11px', fontWeight: 700, color: C.green, whiteSpace: 'nowrap' }}
              >
                {doneItems}/{totalItems}
              </span>
            </div>

            {consolidatedList.map((item, i) => {
              const key = item.nom.toLowerCase().trim()
              const done = checkedItems[key]
              const qtDisplay = item.quantites.map((q) => q.quantite).join(' + ')
              return (
                <div
                  key={key}
                  onClick={() => toggleChecked(key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '9px 0',
                    borderBottom:
                      i < consolidatedList.length - 1 ? `1px solid ${C.border}` : 'none',
                    cursor: 'pointer',
                    opacity: done ? 0.45 : 1,
                  }}
                >
                  <div
                    style={{
                      width: '22px',
                      height: '22px',
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
                    <span
                      style={{
                        fontSize: '12px',
                        color: C.terra,
                        marginLeft: '8px',
                        fontWeight: 700,
                      }}
                    >
                      {qtDisplay}
                    </span>
                    {item.quantites.length > 1 && (
                      <div
                        style={{ display: 'flex', gap: '4px', marginTop: '3px', flexWrap: 'wrap' }}
                      >
                        {item.quantites.map((q, qi) => (
                          <span
                            key={qi}
                            style={{
                              fontSize: '9px',
                              padding: '1px 5px',
                              borderRadius: '6px',
                              background: `${C.brown}15`,
                              color: C.brownMid,
                            }}
                          >
                            {q.listTitre} : {q.quantite}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </Card>
        )}

        {consolidatedList.length === 0 && shoppingLists.length === 0 && manualCart.length === 0 && (
          <Card>
            <div style={{ textAlign: 'center', color: C.textLight, padding: '28px 0' }}>
              <div style={{ fontSize: '30px', marginBottom: '8px' }}>🛒</div>
              Ajoute des articles dans le panier ou crée une liste IA
            </div>
          </Card>
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
