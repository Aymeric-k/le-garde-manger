import { useState, useEffect, useRef } from 'react'
import {
  Refrigerator,
  ChefHat,
  Sparkles,
  ShoppingCart,
  Map,
  Lock,
  Check,
  ScanLine,
  FileText,
} from 'lucide-react'
import TicketCamera from './components/TicketCamera'
import BarcodeScanner from './components/BarcodeScanner'
import { searchProduct, getProductByBarcode } from './services/openFoodFacts'
import { checkAndIncrementQuota } from './services/quota'
import { useAuth } from './hooks/useAuth'
import { useSharedProductCache, writeSharedProduct } from './hooks/useSharedProductCache'
import {
  useSharedAbbreviationDictionary,
  writeSharedAbbreviation,
} from './hooks/useSharedAbbreviationDictionary'
import { httpsCallable } from 'firebase/functions'
import { functions } from './config/firebase'
import {
  migrateLocalStorageToFirestore,
  useFirestoreCollection,
} from './hooks/useFirestoreCollection'
import {
  useFirestoreDoc,
  migrateLocalStorageObjectToFirestore,
  mergeFirestoreDocField,
} from './hooks/useFirestoreDoc'

// ─── Palette & Design Tokens ───────────────────────────────────────────────
// "Golden hour contrasté" — un seul accent fort (terracotta) plutôt que le
// brun+vert+beige qui se diluait. Texte quasi-noir pour du vrai contraste.
// Les clés restent identiques à l'ancienne palette (des centaines d'usages
// dans tout le fichier) — seules les valeurs changent.
const C = {
  bg: '#faf6f1', // blanc cassé chaud
  bgDeep: '#f0e8dd', // un cran plus marqué (header, zones de distinction)
  bgCard: '#ffffff', // cartes blanches nettes
  bgInset: '#f1eae1', // inputs, fond neutre des badges
  brown: '#262220', // quasi-noir chaud — titres et texte fort
  brownMid: '#5c534c', // gris chaud — texte secondaire
  brownLight: '#b8aa9c', // gris-beige discret — bordures décoratives
  green: '#5c8268', // vert sauge éteint — signal fonctionnel, pas un 2e accent
  greenMid: '#7da085', // variante claire (hover, fonds légers)
  greenLight: '#c7d9c9', // fond très clair (badges succès)
  terra: '#d9603d', // L'accent — terracotta vif, unique
  terraLight: '#f2a688', // variante claire de l'accent
  text: '#262220', // texte principal quasi-noir
  textMid: '#6b6259', // texte secondaire
  textLight: '#a69c90', // texte tertiaire
  border: '#e6ddd0', // bordure discrète
  borderDark: '#d3c6b5', // bordure plus marquée
  warning: '#d9603d', // alerte = l'accent
  ok: '#5c8268', // ok = vert fonctionnel
  star: '#d9a03d', // étoile dorée, dans la teinte de l'accent
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

// Seuls ces comptes peuvent écrire dans les données PARTAGÉES (cache
// produit, dictionnaire d'abréviations) — doit rester synchronisé avec
// isAdmin() dans firestore.rules, seul endroit où la protection réelle
// s'applique (ce check côté client n'est qu'un confort d'UX).
const ADMIN_UIDS = ['FH9xwVbW4lSzw4QH7pDqegkOQWt2']

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

// Estimation de dernier recours quand aucun prix réel n'a encore été
// enregistré pour ce produit (voir getPriceEstimate)
const PRICE_FALLBACK_BY_CATEGORY = {
  Légumes: 2.5,
  Fruits: 3,
  'Viande/Poisson': 7,
  Féculents: 2,
  Laitiers: 2.5,
  'Épices/Sauces': 2,
  Conserves: 2,
  Autre: 3,
  Hygiène: 4,
  Entretien: 3.5,
  Beauté: 6,
  Papeterie: 3,
  Animalerie: 5,
  'Autre maison': 4,
}

const UNITS = [
  'g',
  'kg',
  'ml',
  'cl',
  'L',
  'pièce(s)',
  'boîte(s)',
  'sachet(s)',
  'botte(s)',
  'tranche(s)',
]

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
  savedRecipes: 'lgm_saved_recipes',
  priceHistory: 'lgm_price_history',
  productCache: 'lgm_product_cache',
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
        fontFamily: "'Inter',sans-serif",
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
  // Fond neutre + couleur portée par le texte seul, plutôt qu'un badge
  // teinté avec fond ET bordure de la même couleur — sur une carte qui
  // affiche 3-4 pills (catégorie, stockage, quantité, prix), l'ancien
  // rendu les faisait toutes se battre pour l'attention au même niveau.
  return (
    <span
      style={{
        fontSize: '10px',
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: '6px',
        background: C.bgInset,
        color,
        fontFamily: "'Inter',sans-serif",
      }}
    >
      {label}
    </span>
  )
}

function Btn({ children, onClick, disabled, variant = 'primary', small = false }) {
  const base = {
    border: 'none',
    borderRadius: '10px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: "'Fraunces',serif",
    fontWeight: 700,
    transition: 'all 0.18s',
    opacity: disabled ? 0.5 : 1,
  }
  const variants = {
    primary: {
      background: C.terra,
      color: '#fff',
      padding: small ? '8px 14px' : '13px 20px',
      fontSize: small ? '12px' : '14px',
      boxShadow: `0 1px 3px ${C.brown}25`,
    },
    green: {
      background: C.green,
      color: '#fff',
      padding: small ? '8px 14px' : '13px 20px',
      fontSize: small ? '12px' : '14px',
      boxShadow: `0 1px 3px ${C.brown}25`,
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
    fontFamily: "'Inter',sans-serif",
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
        fontFamily: "'Inter',sans-serif",
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
        fontFamily: "'Inter',sans-serif",
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
  const [isFood, setIsFood] = useState(true)

  const submit = () => {
    if (!nom.trim()) return
    onAdd({ nom: nom.trim(), quantity: quantity || '1', unit, isFood })
    setNom('')
    setQuantity('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={() => setIsFood(true)}
          style={{
            flex: 1,
            padding: '6px 10px',
            borderRadius: '10px',
            fontSize: '11px',
            fontWeight: 700,
            border: isFood ? '1.5px solid #4a7c59' : '1px solid #ddd0b8',
            background: isFood ? '#4a7c5918' : '#faf7f0',
            color: isFood ? '#4a7c59' : '#b0987a',
            cursor: 'pointer',
            fontFamily: "'Inter',sans-serif",
          }}
        >
          🥦 Alimentaire
        </button>
        <button
          onClick={() => setIsFood(false)}
          style={{
            flex: 1,
            padding: '6px 10px',
            borderRadius: '10px',
            fontSize: '11px',
            fontWeight: 700,
            border: !isFood ? '1.5px solid #c1602a' : '1px solid #ddd0b8',
            background: !isFood ? '#c1602a18' : '#faf7f0',
            color: !isFood ? '#c1602a' : '#b0987a',
            cursor: 'pointer',
            fontFamily: "'Inter',sans-serif",
          }}
        >
          🧴 Maison
        </button>
      </div>
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
            fontFamily: "'Inter',sans-serif",
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
            fontFamily: "'Inter',sans-serif",
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
            fontFamily: "'Inter',sans-serif",
          }}
        >
          {['pièce(s)', 'g', 'kg', 'ml', 'L', 'boîte(s)', 'sachet(s)', 'rouleau(x)'].map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
        <button
          onClick={submit}
          style={{
            background: C.green,
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
    </div>
  )
}

export default function App() {
  const { user, isLoading: authLoading, isAuthenticated, login, logout } = useAuth()
  const sharedProductCache = useSharedProductCache()
  const sharedAbbreviationDictionary = useSharedAbbreviationDictionary()
  const isAdmin = !!user && ADMIN_UIDS.includes(user.uid)

  const [tab, setTab] = useState('frigo')
  const [ingredients, setIngredients] = useFirestoreCollection(user?.uid, 'ingredients', [])
  const [equipment, setEquipment] = useFirestoreCollection(user?.uid, 'equipment', [])
  const [shoppingLists, setShoppingLists] = useFirestoreCollection(user?.uid, 'shoppingLists', [])
  const [users, setUsers] = useFirestoreCollection(user?.uid, 'users_profile', [])
  const [ratings, setRatings] = useFirestoreCollection(user?.uid, 'ratings', [])
  const [cookLogs, setCookLogs] = useFirestoreCollection(user?.uid, 'cookLogs', [])
  // Un document par LOT de génération (generateRecipes produit 3 recettes
  // d'un coup) — capture le contexte au moment de générer (nombre
  // d'ingrédients, modes actifs) pour pouvoir croiser avec cookLogs
  // ensuite et mesurer le taux généré → cuisiné. Voir generateRecipes et
  // submitCookFeedback ci-dessous. Écriture seule ici — la lecture se
  // fait directement via Firestore (pas de tableau de bord dans l'app
  // pour l'instant), d'où la valeur ignorée.
  const [, setRecipeGenerations] = useFirestoreCollection(user?.uid, 'recipeGenerations', [])
  const [nonFood, setNonFood] = useFirestoreCollection(user?.uid, 'nonFood', [])
  const [mealHistory, setMealHistory] = useFirestoreCollection(user?.uid, 'mealHistory', [])
  const [manualCart, setManualCart] = useFirestoreCollection(user?.uid, 'manualCart', [])
  const [savedRecipes, setSavedRecipes] = useFirestoreCollection(user?.uid, 'savedRecipes', [])
  // priceHistory et productCache sont des objets (clé → valeur), pas des
  // listes — on utilise useFirestoreDoc (un seul document) plutôt que
  // useFirestoreCollection (un document par élément).
  const [priceHistory, setPriceHistory] = useFirestoreDoc(user?.uid, 'priceHistory', {})
  const [productCache, setProductCache] = useFirestoreDoc(user?.uid, 'productCache', {})
  // Dictionnaire d'abréviations par enseigne — lecture seule ici, l'écriture
  // se fait via mergeFirestoreDocField dans recordAbbreviationCorrection.
  const [abbreviationDictionary] = useFirestoreDoc(user?.uid, 'abbreviationDictionary', {})
  // Onboarding "premier scan" — completed passe à true une fois la
  // première recette affichée avec succès (l'événement "activation" pour
  // l'instrumentation de rétention J7/J30). Ne sert PAS seul à décider
  // d'afficher l'écran de démarrage : combiné à ingredients.length === 0
  // (voir renderFrigo) pour ne jamais le montrer à un compte déjà actif
  // qui n'avait simplement pas encore ce champ.
  const [onboarding, setOnboarding] = useFirestoreDoc(user?.uid, 'onboarding', {})
  // true dès que l'utilisateur a choisi drive ou ticket depuis l'écran de
  // démarrage — bascule l'écran de démarrage vers le flux d'import normal
  // (voir renderFrigo) sans quoi le panneau de scan resterait masqué
  // derrière l'écran de démarrage tant que l'inventaire est encore vide.
  const [onboardingMode, setOnboardingMode] = useState(false)
  // true entre la confirmation de l'import et la génération automatique
  // de la Phase 3 — le déclenchement attend que `ingredients` reflète
  // vraiment l'import (écriture Firestore asynchrone), pas juste que le
  // clic ait eu lieu, sans quoi generateRecipes partirait sur un
  // inventaire encore vide (voir l'effet juste après generateRecipes).
  // Ref plutôt que state : c'est un simple loquet "à consommer une fois",
  // pas une donnée qui doit elle-même déclencher un re-render — seul le
  // changement de `ingredients` doit réveiller l'effet qui le consomme
  // (voir plus bas). Évite d'appeler setState en cascade dans l'effet.
  const onboardingPendingGenerationRef = useRef(false)

  // Migration unique localStorage → Firestore au premier login.
  // Tant que cette étape n'est pas branchée collection par collection
  // (prochaine session), l'app continue de fonctionner en localStorage
  // même connecté — la connexion Google ne fait pour l'instant
  // qu'authentifier l'utilisateur, sans encore déplacer les données.
  const migrationRanRef = useRef(false)
  useEffect(() => {
    if (!user || migrationRanRef.current) return
    migrationRanRef.current = true
    migrateLocalStorageToFirestore(user.uid, 'ingredients', STORAGE_KEYS.ingredients)
    migrateLocalStorageToFirestore(user.uid, 'nonFood', STORAGE_KEYS.nonFood)
    migrateLocalStorageToFirestore(user.uid, 'equipment', STORAGE_KEYS.equipment)
    migrateLocalStorageToFirestore(user.uid, 'shoppingLists', STORAGE_KEYS.shoppingLists)
    migrateLocalStorageToFirestore(user.uid, 'manualCart', STORAGE_KEYS.manualCart)
    migrateLocalStorageToFirestore(user.uid, 'savedRecipes', STORAGE_KEYS.savedRecipes)
    migrateLocalStorageToFirestore(user.uid, 'users_profile', STORAGE_KEYS.users)
    migrateLocalStorageToFirestore(user.uid, 'ratings', STORAGE_KEYS.ratings)
    migrateLocalStorageToFirestore(user.uid, 'cookLogs', STORAGE_KEYS.cookLogs)
    migrateLocalStorageToFirestore(user.uid, 'mealHistory', STORAGE_KEYS.mealHistory)
    migrateLocalStorageObjectToFirestore(user.uid, 'priceHistory', STORAGE_KEYS.priceHistory)
    migrateLocalStorageObjectToFirestore(user.uid, 'productCache', STORAGE_KEYS.productCache)
  }, [user])

  // Ticket scan state
  const [showTicketCamera, setShowTicketCamera] = useState(false)
  const [showScanPanel, setShowScanPanel] = useState(false)
  const [scanLoading, setScanLoading] = useState(false)
  // Une seule liste — chaque ligne est déjà classifiée (nom, catégorie,
  // stockage, quantité, unité) et directement importable. Open Food
  // Facts n'est plus interrogé par défaut ; c'est une recherche à la
  // demande, par ligne, via le bouton 🔍 (voir searchOffForLine).
  const [scanPhases, setScanPhases] = useState({ items: [] })
  const [offLoading, setOffLoading] = useState(false) // recherche OFF ponctuelle en cours (par ligne)
  // Étape intermédiaire entre l'extraction (scanLoading/pdfLoading) et le
  // matching Open Food Facts (offLoading) — cleanupLigneNames tournait
  // sans aucun indicateur visuel, laissant l'écran de scan "vide" quelques
  // secondes. Sert la vraie progression par étapes (voir renderScanPanel).
  const [classifyLoading, setClassifyLoading] = useState(false)
  // Distingue ticket/drive pour l'icône affichée pendant TOUTE la
  // progression (pdfLoading/scanLoading redeviennent false dès l'étape 1
  // terminée, donc insuffisants pour savoir quelle icône garder ensuite).
  const [scanSource, setScanSource] = useState('ticket')
  // TODO: scan code-barres — à implémenter avec @zxing/library
  const [currentBarcodeTarget, setCurrentBarcodeTarget] = useState(null)
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [showFrigoBarcode, setShowFrigoBarcode] = useState(false)
  const [scanConfirm, setScanConfirm] = useState(null)
  const [fridgeSubTab, setFridgeSubTab] = useState('food')
  const [lastTicketItems, setLastTicketItems] = useState([]) // 3 derniers articles
  const [photoCount, setPhotoCount] = useState(0)
  const [scanResult, setScanResult] = useState(null)

  // Import PDF — commandes drive (Leclerc, Carrefour, Auchan...)
  const [pdfLoading, setPdfLoading] = useState(false)

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
    unitCount: '', // ex: 8 (pour "8 yaourts de 125g") — optionnel
    category: 'Légumes',
    dlc: '',
    storage: 'frigo_semaine',
    price: '',
  })
  // null = mode "ajout" ; sinon id de l'ingrédient en cours de modification
  const [editingIngredientId, setEditingIngredientId] = useState(null)

  // Confirmation après scan code-barres — pré-rempli, modifiable avant ajout
  const [pendingBarcodeProduct, setPendingBarcodeProduct] = useState(null)
  const [showBarcodeConfirm, setShowBarcodeConfirm] = useState(false)

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
  const [tolerance, setTolerance] = useState('strict')
  const [showRecipeTextInput, setShowRecipeTextInput] = useState(false)
  const [recipeTextInput, setRecipeTextInput] = useState('')

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

  const emptyIngForm = {
    name: '',
    quantity: '',
    unit: 'g',
    unitCount: '',
    category: 'Légumes',
    dlc: '',
    storage: 'frigo_semaine',
    price: '',
  }

  const addIngredient = () => {
    if (!newIng.name.trim()) return

    if (editingIngredientId) {
      // Mode modification — on remplace l'ingrédient existant en gardant son id
      setIngredients((p) =>
        p.map((ing) =>
          ing.id === editingIngredientId ? { ...newIng, id: editingIngredientId } : ing
        )
      )
    } else {
      // Mode ajout — nouvel ingrédient
      setIngredients((p) => [...p, { ...newIng, id: Date.now() }])
    }

    if (newIng.price) {
      recordPrice({ name: newIng.name, price: newIng.price, source: 'manuel' })
    }

    setNewIng(emptyIngForm)
    setEditingIngredientId(null)
    setShowAddIng(false)
  }

  // Ouvre le formulaire pré-rempli avec les valeurs de l'ingrédient à modifier
  const editIngredient = (ing) => {
    setNewIng({
      name: ing.name || '',
      quantity: ing.quantity || '',
      unit: ing.unit || 'g',
      unitCount: ing.unitCount || '',
      category: ing.category || 'Légumes',
      dlc: ing.dlc || '',
      storage: ing.storage || 'frigo_semaine',
      price: ing.price || '',
    })
    setEditingIngredientId(ing.id)
    setShowAddIng(true)
  }

  const cancelIngredientForm = () => {
    setNewIng(emptyIngForm)
    setEditingIngredientId(null)
    setShowAddIng(false)
  }

  const handleBarcodeResult = async (barcode) => {
    setShowBarcodeScanner(false)
    if (!currentBarcodeTarget) return
    const product = await getProductByBarcode(barcode)
    if (!product) return
    const { idx } = currentBarcodeTarget
    setScanPhases((p) => ({
      ...p,
      items: p.items.map((item, i) =>
        i === idx
          ? {
              ...item,
              // Un code-barres scanné = identification certaine —
              // remplace le nom/catégorie par la fiche officielle trouvée
              nom_propre: product.nom || item.nom_propre,
              category: product.categorie || item.category,
              image: product.image || null,
              barcode: product.code_barres || null,
              confianceNom: 'haute',
            }
          : item
      ),
    }))
  }

  const handleFrigoBarcodeResult = async (barcode) => {
    setShowFrigoBarcode(false)
    const product = await getProductByBarcode(barcode)
    if (!product) {
      setPendingBarcodeProduct({
        name: '',
        quantity: '1',
        unit: 'pièce(s)',
        category: 'Autre',
        storage: 'garde_manger',
        dlc: '',
        price: '',
        notFound: true,
        barcode,
        source: 'barcode',
      })
      setShowBarcodeConfirm(true)
      return
    }

    // Parsing prudent du poids OFF — évite les valeurs aberrantes (ex: "1500" sans unité claire)
    const rawPoids = (product.poids || '').trim()
    const weightMatch = rawPoids.match(/([\d.,]+)\s*([a-zA-Zµ]+)/)
    const parsedQty = weightMatch ? weightMatch[1].replace(',', '.') : '1'
    const parsedUnit = weightMatch
      ? weightMatch[2].toLowerCase().replace('cl', 'cl').replace('kg', 'kg')
      : 'pièce(s)'

    setPendingBarcodeProduct({
      name: product.nom?.trim() || `Produit ${barcode}`,
      quantity: parsedQty,
      unit: UNITS.includes(parsedUnit) ? parsedUnit : 'pièce(s)',
      category: 'Autre',
      storage: 'garde_manger',
      dlc: '',
      price: '', // Open Food Facts ne fournit pas de prix — saisie manuelle si connu
      brand: product.marque || '',
      image: product.image || null,
      barcode,
      notFound: false,
      source: 'barcode',
    })
    setShowBarcodeConfirm(true)
  }

  const confirmBarcodeProduct = (chainNext = false) => {
    if (!pendingBarcodeProduct?.name?.trim()) return

    // Édition d'une ligne du scan de ticket/PDF — met juste à jour cette
    // ligne dans la liste, ne l'ajoute PAS encore au frigo. L'import
    // réel se fait par le bouton "✓ Importer" en bas, une fois pour
    // toutes les lignes sélectionnées.
    if (pendingBarcodeProduct.source === 'ticket') {
      const { idx } = pendingBarcodeProduct
      const previousItem = scanPhases.items[idx]
      setScanPhases((p) => ({
        ...p,
        items: p.items.map((item, i) =>
          i === idx
            ? {
                ...item,
                nom_propre: pendingBarcodeProduct.name.trim(),
                category: pendingBarcodeProduct.category,
                storage: pendingBarcodeProduct.storage,
                quantity: parseFloat(pendingBarcodeProduct.quantity) || 1,
                unit: pendingBarcodeProduct.unit,
                prix: pendingBarcodeProduct.price
                  ? parseFloat(pendingBarcodeProduct.price)
                  : item.prix,
                image: pendingBarcodeProduct.image || item.image,
                barcode: pendingBarcodeProduct.barcode || item.barcode,
                confianceNom: 'haute', // corrigée manuellement — confiance rétablie
              }
            : item
        ),
      }))

      // Mémorise cette correction pour l'enseigne du ticket — la prochaine
      // fois que ce même texte brut apparaît sur un ticket de la même
      // enseigne, la classification pourra être résolue instantanément
      // sans repasser par l'IA (voir recordAbbreviationCorrection).
      recordAbbreviationCorrection({
        enseigne: scanResult?.enseigne,
        texteBrut: pendingBarcodeProduct.ticketRawText,
        result: {
          nom_propre: pendingBarcodeProduct.name.trim(),
          type: previousItem?.type,
          category: pendingBarcodeProduct.category,
          storage: pendingBarcodeProduct.storage,
          quantity: parseFloat(pendingBarcodeProduct.quantity) || 1,
          unit: pendingBarcodeProduct.unit,
        },
      })

      setShowBarcodeConfirm(false)
      setPendingBarcodeProduct(null)
      return
    }

    // Scan code-barres direct (onglet Frigo) ou saisie manuelle — ajoute
    // immédiatement au frigo, ce chemin ne passe pas par la liste de scan
    setIngredients((p) => [
      ...p,
      {
        id: Date.now() + Math.random(),
        name: pendingBarcodeProduct.name.trim(),
        quantity: pendingBarcodeProduct.quantity || '1',
        unit: pendingBarcodeProduct.unit || 'pièce(s)',
        category: pendingBarcodeProduct.category || 'Autre',
        dlc: pendingBarcodeProduct.dlc || '',
        storage: pendingBarcodeProduct.storage || 'garde_manger',
        price: pendingBarcodeProduct.price || '',
      },
    ])

    // Enregistre le prix dans l'historique — seulement s'il est renseigné.
    if (pendingBarcodeProduct.price) {
      recordPrice({
        name: pendingBarcodeProduct.name,
        barcode: pendingBarcodeProduct.barcode,
        price: pendingBarcodeProduct.price,
        source: 'manuel',
      })
    }

    // Cache produit — c'est le moment le plus fiable pour mémoriser,
    // le nom a été validé (et potentiellement corrigé) par toi.
    cacheProduct({
      name: pendingBarcodeProduct.name,
      barcode: pendingBarcodeProduct.barcode,
      category: pendingBarcodeProduct.category,
      image: pendingBarcodeProduct.image,
      marque: pendingBarcodeProduct.brand,
      source: pendingBarcodeProduct.source || 'manuel',
    })

    setShowBarcodeConfirm(false)
    setPendingBarcodeProduct(null)

    // Scan en rafale — utile quand on range les courses et qu'on veut
    // enchaîner produit après produit sans repasser par le bouton 📷
    if (chainNext) {
      setShowFrigoBarcode(true)
    }
  }

  // Ouvre la modale d'édition à partir d'une ligne de la liste de scan —
  // tout vient déjà de la classification (nom, catégorie, stockage,
  // quantité, unité), plus besoin de dépendre d'un candidat OFF
  const openTicketLineEditor = (idx) => {
    const item = scanPhases.items[idx]

    setPendingBarcodeProduct({
      name: item.nom_propre || item.texte_brut || '',
      quantity: String(item.quantity || 1),
      unit: item.unit || 'pièce(s)',
      category: item.category || 'Autre',
      storage: item.storage || 'garde_manger',
      dlc: '',
      // Le prix vient directement du ticket (réellement payé) — c'est
      // une donnée fiable, on la pré-remplit mais reste modifiable
      // (utile pour les formats promo/lot qui faussent le prix unitaire)
      price: item.prix != null ? String(item.prix) : '',
      brand: '',
      image: item.image || null,
      barcode: item.barcode || null,
      notFound: item.confianceNom === 'basse',
      source: 'ticket',
      idx,
      ticketRawText: item.texte_brut,
    })
    setShowBarcodeConfirm(true)
  }

  // Recherche OFF À LA DEMANDE — plus jamais automatique en masse.
  // Un clic, une ligne, une vraie recherche. Si un match est trouvé, on
  // propose de l'adopter (photo + nom officiel) via la modale d'édition
  // déjà pré-remplie ; sinon on informe simplement qu'il n'y a rien.
  async function searchOffForLine(idx) {
    const item = scanPhases.items[idx]
    if (!item) return

    setOffLoading(true)
    const candidats = await searchProduct(item.nom_propre || item.texte_brut)
    setOffLoading(false)

    if (!candidats || candidats.length === 0) {
      alert('Aucune fiche trouvée sur Open Food Facts pour ce produit.')
      return
    }

    const best = candidats[0]
    setPendingBarcodeProduct({
      name: best.nom || item.nom_propre || item.texte_brut,
      quantity: String(item.quantity || 1),
      unit: item.unit || 'pièce(s)',
      category: item.category || 'Autre',
      storage: item.storage || 'garde_manger',
      dlc: '',
      price: item.prix != null ? String(item.prix) : '',
      brand: best.marque || '',
      image: best.image || null,
      barcode: best.code_barres || null,
      notFound: false,
      source: 'ticket',
      idx,
      ticketRawText: item.texte_brut,
    })
    setShowBarcodeConfirm(true)
  }

  // ═══════════════════════════════════════════════════════════════
  // CACHE PRODUIT — accéléré par tes propres scans
  // ═══════════════════════════════════════════════════════════════
  // Chaque produit identifié avec certitude (scan code-barres réussi,
  // ou correction manuelle validée) est mémorisé ici. Sur un scan de
  // ticket futur, ce cache est consulté EN PREMIER — avant Open Food
  // Facts — pour les produits que tu as déjà rencontrés. Zéro appel
  // externe, zéro latence, zéro limite de débit pour tes achats
  // récurrents. Le cache grossit à chaque usage réel de l'app.

  function cacheProduct({ name, barcode, category, image, marque, source }) {
    if (!name?.trim()) return
    const key = barcode ? `bc_${barcode}` : `nm_${normalizePriceKey(name)}`
    const entry = {
      name: name.trim(),
      barcode: barcode || null,
      category: category || null,
      image: image || null,
      marque: marque || '',
      source,
      lastSeen: new Date().toISOString(),
    }
    // Écriture ciblée sur cette seule clé — safe même si plusieurs
    // produits sont mis en cache coup sur coup (import de ticket)
    mergeFirestoreDocField(user?.uid, 'productCache', key, entry)

    // Si le compte courant est admin, la correction alimente AUSSI le
    // cache partagé — tout le monde en profite immédiatement, pas
    // seulement toi. Un utilisateur normal ne touche que son cache perso.
    if (isAdmin) {
      writeSharedProduct(key, entry)
    }
  }

  function getFromCache(name, barcode) {
    const byBarcode = barcode ? productCache[`bc_${barcode}`] : null
    if (byBarcode) return byBarcode
    const byName = productCache[`nm_${normalizePriceKey(name)}`]
    if (byName) return byName

    // Rien dans le cache personnel — on retombe sur le cache partagé,
    // enrichi par l'admin, avant de devoir interroger Open Food Facts
    const sharedByBarcode = barcode ? sharedProductCache[`bc_${barcode}`] : null
    if (sharedByBarcode) return sharedByBarcode
    const sharedByName = sharedProductCache[`nm_${normalizePriceKey(name)}`]
    return sharedByName || null
  }

  // ═══════════════════════════════════════════════════════════════
  // PRIX — historique réel & estimation
  // ═══════════════════════════════════════════════════════════════
  // Principe : chaque prix connu (issu d'un scan de ticket = prix
  // réellement payé, ou saisi manuellement) est enregistré dans un
  // historique par produit. L'estimation utilisée pour les courses
  // prend la MÉDIANE des derniers prix connus — plus robuste qu'une
  // moyenne face à un prix aberrant (ex: prix d'un lot promo isolé).
  // Clé de préférence : le code-barres (fiable, univoque). À défaut,
  // le nom normalisé (moins fiable — deux produits différents peuvent
  // partager un nom proche).

  function normalizePriceKey(name) {
    return (name || '').toLowerCase().trim().replace(/\s+/g, ' ')
  }

  function recordPrice({ name, barcode, price, source, enseigne }) {
    const numPrice = parseFloat(price)
    if (!numPrice || numPrice <= 0) return // ignore prix vide/invalide — ne pollue pas l'historique

    const key = barcode ? `bc_${barcode}` : `nm_${normalizePriceKey(name)}`
    const now = new Date().toISOString()
    // On part de l'état local en mémoire (priceHistory) pour construire
    // l'historique de CETTE clé précise — même s'il est parfois légèrement
    // périmé de quelques centaines de ms, ça ne concerne que cette clé.
    // L'écriture elle-même est ciblée (merge sur cette seule clé), donc
    // aucun risque d'écraser les prix des AUTRES produits en cours d'ajout.
    const existing = priceHistory[key]?.entries || []
    const entries = [...existing, { price: numPrice, date: now, source }].slice(-8) // garde les 8 derniers prix — suffisant pour une médiane stable (agrégat, sert getPriceEstimate ci-dessous)

    // Historique COMPLET — contrairement à `entries` ci-dessus (fenêtre
    // glissante de 8 valeurs, uniquement pour la médiane), rien n'est
    // jamais tronqué ici. Une donnée de prix non capturée ne se retrouve
    // plus jamais ; les deux structures coexistent délibérément : `entries`
    // pour l'estimation de budget courante, `fullHistory` pour ne rien
    // perdre (analyse future, litige de prix, historique par enseigne...).
    const existingFullHistory = priceHistory[key]?.fullHistory || []
    const fullHistory = [
      ...existingFullHistory,
      { price: numPrice, enseigne: enseigne || null, date: now, productId: key, source },
    ]

    mergeFirestoreDocField(user?.uid, 'priceHistory', key, {
      name,
      barcode: barcode || null,
      entries,
      fullHistory,
    })
  }

  function median(numbers) {
    const sorted = [...numbers].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  }

  function getPriceEstimate(name, barcode, category) {
    const keyByBarcode = barcode ? `bc_${barcode}` : null
    const keyByName = `nm_${normalizePriceKey(name)}`

    const fromBarcode = keyByBarcode ? priceHistory[keyByBarcode] : null
    const fromName = priceHistory[keyByName]
    const record = fromBarcode || fromName

    if (record?.entries?.length > 0) {
      const prices = record.entries.map((e) => e.price)
      return {
        estimated: median(prices),
        confidence: fromBarcode ? 'high' : 'medium',
        source: fromBarcode ? 'historique (code-barres)' : 'historique (nom)',
      }
    }

    const base = PRICE_FALLBACK_BY_CATEGORY[category] || 3
    return { estimated: base, confidence: 'low', source: 'estimation par catégorie' }
  }

  // ═══════════════════════════════════════════════════════════════
  // DICTIONNAIRE D'ABRÉVIATIONS PAR ENSEIGNE
  // ═══════════════════════════════════════════════════════════════
  // Distinct du cache produit ci-dessus : le cache produit mémorise une
  // IDENTITÉ produit (nom propre, catégorie, image), retrouvable par nom
  // ou code-barres, tous magasins confondus. Ici on mémorise une
  // CORRESPONDANCE texte brut du ticket → résultat de classification
  // complet (nom, type, catégorie, stockage, quantité, unité), propre à
  // une enseigne — car une même abréviation ("BISC.CHOC.PTIT DEJ") peut
  // désigner des produits différents selon le magasin qui l'imprime.
  //
  // Phase 1 (actuelle) : uniquement l'écriture, déclenchée quand une
  // correction manuelle de ligne de ticket est validée. La lecture (qui
  // permettra de sauter l'appel IA quand la correspondance est déjà
  // connue) arrive dans une phase suivante.

  function normalizeAbbrevKey(str) {
    return (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // accents
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  }

  function recordAbbreviationCorrection({ enseigne, texteBrut, result }) {
    if (!texteBrut?.trim() || !result?.nom_propre?.trim()) return

    const texteBrutKey = normalizeAbbrevKey(texteBrut)
    if (!texteBrutKey) return
    const enseigneKey = normalizeAbbrevKey(enseigne) || 'enseigne_inconnue'
    const key = `${enseigneKey}__${texteBrutKey}`
    const entry = {
      enseigne: enseigne || null,
      texteBrut,
      nom_propre: result.nom_propre,
      type: result.type || 'alimentaire',
      category: result.category || null,
      storage: result.storage || null,
      quantity: result.quantity ?? 1,
      unit: result.unit || 'pièce(s)',
      correctedAt: new Date().toISOString(),
    }

    mergeFirestoreDocField(user?.uid, 'abbreviationDictionary', key, entry)

    // Phase 3 — si le compte courant est admin, la correction alimente
    // AUSSI le dictionnaire partagé : tout le monde en profite pour la
    // même enseigne, pas seulement toi (voir useSharedAbbreviationDictionary
    // pour la justification du choix admin-only en écriture partagée).
    if (isAdmin) {
      writeSharedAbbreviation(key, entry)
    }
  }

  // Phase 2/3 — lecture. Même clé que l'écriture (enseigne + texte brut
  // normalisés). Consulte d'abord le dictionnaire personnel, puis le
  // partagé en repli — priorité au personnel car l'utilisateur a pu
  // corriger différemment pour une raison qui lui est propre (ex: sa
  // façon de ranger un produit peut différer de celle de l'admin).
  // Retourne null si cette ligne n'a jamais été corrigée par personne
  // pour cette enseigne.
  function getAbbreviationMatch(enseigne, texteBrut) {
    const texteBrutKey = normalizeAbbrevKey(texteBrut)
    if (!texteBrutKey) return null
    const enseigneKey = normalizeAbbrevKey(enseigne) || 'enseigne_inconnue'
    const key = `${enseigneKey}__${texteBrutKey}`
    return abbreviationDictionary[key] || sharedAbbreviationDictionary[key] || null
  }

  // ═══════════════════════════════════════════════════════════════
  // MATCHING PARTAGÉ — cache local puis Open Food Facts
  // ═══════════════════════════════════════════════════════════════
  // Utilisé à la fois par le scan de ticket (photo) et l'import PDF
  // (commande drive) — même moteur de reconnaissance pour les deux
  // sources, avec le cache local consulté en priorité absolue.

  // ═══════════════════════════════════════════════════════════════
  // NETTOYAGE + CLASSIFICATION — séparé de la recherche OFF
  // ═══════════════════════════════════════════════════════════════
  // Reformuler "PANZANI SERPENTINI 500G" en "Pâtes Serpentini Panzani",
  // déterminer si c'est alimentaire ou pas, choisir une catégorie et
  // un mode de stockage adapté — tout ça n'a RIEN à voir avec chercher
  // le bon produit dans la base OFF. C'est de la classification de
  // texte, pas une recherche ambiguë. Un modèle de langage fait ça très
  // bien et sans hésitation, contrairement à la recherche floue OFF qui
  // échoue souvent sur les tickets français.
  //
  // Utilisé à la fois par le scan de ticket ET l'import PDF — les deux
  // sources se contentaient avant d'un "alimentaire" codé en dur, d'où
  // le mélange alimentaire/non-alimentaire et le "tout au garde-manger"
  // même pour de la viande ou des produits frais.
  async function cleanupLigneNames(lignes, enseigne) {
    if (!lignes || lignes.length === 0) return lignes

    // Phase 2 — avant tout appel GPT, vérifie pour chaque ligne si une
    // correction manuelle existe déjà pour cette enseigne (dictionnaire
    // d'abréviations). Si oui, le résultat mémorisé est réutilisé tel
    // quel — zéro token consommé sur cette ligne. Les lignes sans
    // correspondance suivent le chemin GPT habituel, inchangé.
    const resolved = new Array(lignes.length)
    const toClassify = []

    lignes.forEach((ligne, i) => {
      const match = getAbbreviationMatch(enseigne, ligne.texte_brut)
      if (match) {
        resolved[i] = {
          ...ligne,
          nom_propre: match.nom_propre,
          type: match.type || 'alimentaire',
          category: match.category || 'Autre',
          storage: match.storage || 'garde_manger',
          quantity: match.quantity ?? 1,
          unit: UNITS.includes(match.unit) ? match.unit : 'pièce(s)',
          confianceNom: 'haute',
          fromDictionary: true,
        }
      } else {
        toClassify.push({ ligne, i })
      }
    })

    // Tout était déjà connu — aucun appel GPT nécessaire
    if (toClassify.length === 0) return resolved

    try {
      const prompt = `Voici des lignes de ticket de caisse ou de commande drive français, extraites par un OCR automatique. Certaines sont juste abrégées (facile à déchiffrer), d'autres sont du BRUIT OCR corrompu (caractères incohérents, mots fusionnés, aucun sens réel) — les deux cas doivent être traités différemment.

Pour CHAQUE ligne, détermine :
1. "nom_propre" : le nom du produit reformulé clairement et naturellement.
   - Si la ligne est abrégée mais déchiffrable (ex: "PANZANI SERPENTINI 500G"),
     reformule-la normalement, sans changer le sens, sans inventer de marque ou
     de détail non suggéré, sans mentions d'origine/prix au kilo qui alourdissent
     inutilement, ET sans le grammage (qui va dans des champs séparés).
   - Si la ligne est du BRUIT OCR incohérent où aucun produit réel n'est
     identifiable avec confiance (ex: "N.JARDINA, P.P.CA GR.1/4.31X906") —
     NE DEVINE PAS un produit plausible mais possiblement faux. Renvoie le
     texte tel quel, et mets "confiance": "basse" (voir point 7).
2. "type" : "alimentaire" ou "non_alimentaire"
3. "category" : une catégorie parmi EXACTEMENT ces valeurs :
   Légumes, Fruits, Viande/Poisson, Féculents, Laitiers, Épices/Sauces,
   Conserves, Autre (si alimentaire) — ou Hygiène, Entretien, Beauté,
   Papeterie, Animalerie, Autre maison (si non alimentaire)
4. "storage" : UNIQUEMENT si alimentaire, un mode de stockage parmi
   EXACTEMENT ces valeurs :
   - "frigo_jour" : produits très frais à consommer vite (poisson cru, viande hachée fraîche)
   - "frigo_semaine" : frigo classique (viande, charcuterie, produits laitiers, légumes frais)
   - "congelateur" : surgelés
   - "garde_manger" : NON périssable à température ambiante (pâtes, conserves, riz, huile, épices)
   Une charcuterie, de la viande, du poulet, du fromage frais → "frigo_semaine", JAMAIS "garde_manger".
5. "quantity" : la VALEUR NUMÉRIQUE du grammage/volume/nombre trouvé dans le texte
   (ex: "500G" → 500, "1kg" → 1, "4 tranches" → 4, "1L" → 1).
   Si aucune quantité n'est identifiable, mets 1.
6. "unit" : l'unité correspondante, EXACTEMENT une de ces valeurs :
   g, kg, ml, cl, L, pièce(s), boîte(s), sachet(s), botte(s), tranche(s)
   Si aucune unité n'est identifiable, mets "pièce(s)".
7. "confiance" : "haute" si tu es sûr du produit identifié, "basse" si le
   texte est du bruit OCR où tu as dû deviner ou renvoyer le texte brut.
   Cette valeur sert à prévenir l'utilisateur de vérifier cette ligne
   avant de faire confiance aux autres champs (catégorie, stockage...).

Exemples :
"PANZANI, SERPENTINI C.RAP.,500G" → nom_propre: "Pâtes Serpentini Panzani", type: alimentaire, category: Féculents, storage: garde_manger, quantity: 500, unit: g, confiance: haute
"Carrefour extra jambon le supérieur cuit à l'etouffée 4 tranches 160g" → nom_propre: "Jambon supérieur cuit Carrefour", type: alimentaire, category: Viande/Poisson, storage: frigo_semaine, quantity: 160, unit: g, confiance: haute
"N.JARDINA, P.P.CA GR.1/4.31X906" → nom_propre: "N.JARDINA, P.P.CA GR.1/4.31X906" (inchangé), type: alimentaire, category: Autre, storage: garde_manger, quantity: 1, unit: pièce(s), confiance: basse

Lignes à traiter :
${toClassify.map(({ ligne }, i) => `${i}: ${ligne.texte_brut}`).join('\n')}

Réponds UNIQUEMENT en JSON valide, un tableau dans le MÊME ORDRE :
[{ "nom_propre": "...", "type": "alimentaire", "category": "...", "storage": "garde_manger", "quantity": 500, "unit": "g", "confiance": "haute" }, ...]`

      const res = await fetch('/app/api-proxy.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proxy_token: 'lgm_2024_xK9mP3',
          model: 'gpt-4o-mini',
          // 3000 suffisait pour un ticket de caisse classique, mais une
          // facture PDF (potentiellement 60+ lignes en un seul lot) dépasse
          // cette limite : la réponse JSON est tronquée, le parse échoue,
          // et on retombe sur les lignes brutes non classifiées (d'où un
          // générique "Autre / Garde-manger" partout). Plafond de capacité
          // relevé — les règles de classification elles-mêmes ne changent pas.
          max_tokens: 12000,
          temperature: 0,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      const text = data.content?.map((b) => b.text || '').join('') || ''
      const classified = JSON.parse(text.replace(/```json|```/g, '').trim())

      if (!Array.isArray(classified) || classified.length !== toClassify.length) {
        // format inattendu — les lignes non résolues gardent leurs données
        // brutes plutôt que de planter tout le scan
        toClassify.forEach(({ ligne, i }) => {
          resolved[i] = ligne
        })
        return resolved
      }

      toClassify.forEach(({ ligne, i }, idx) => {
        const c = classified[idx] || {}
        const parsedQty = parseFloat(c.quantity)
        resolved[i] = {
          ...ligne,
          nom_propre: c.nom_propre || ligne.texte_brut,
          type: c.type || ligne.type || 'alimentaire',
          category: c.category || 'Autre',
          storage: c.storage || 'garde_manger',
          quantity: !isNaN(parsedQty) && parsedQty > 0 ? parsedQty : 1,
          // Sécurité — si le modèle renvoie une unité hors de notre liste
          // connue, on retombe sur "pièce(s)" plutôt que de laisser passer
          // une valeur qui casserait le <Select> du formulaire
          unit: UNITS.includes(c.unit) ? c.unit : 'pièce(s)',
          // "basse" = texte OCR probablement corrompu, le modèle n'a pas
          // pu identifier un vrai produit — à vérifier avant de faire
          // confiance aux autres champs (catégorie, stockage...)
          confianceNom: c.confiance === 'basse' ? 'basse' : 'haute',
        }
      })

      return resolved
    } catch {
      // Échec de la classification — pas grave, on continue avec les
      // données brutes plutôt que de bloquer tout le scan pour cette
      // étape optionnelle (seules les lignes non résolues par le
      // dictionnaire sont concernées)
      toClassify.forEach(({ ligne, i }) => {
        resolved[i] = ligne
      })
      return resolved
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // MATCHING PARTAGÉ — cache local uniquement, plus de recherche OFF
  // automatique en masse
  // ═══════════════════════════════════════════════════════════════
  // Chaque ligne arrive déjà classifiée (nom propre, catégorie, stockage,
  // quantité, unité) via cleanupLigneNames — elle est DIRECTEMENT
  // importable sans avoir besoin d'une fiche Open Food Facts. Le cache
  // (perso + partagé) reste consulté en priorité car il est gratuit et
  // enrichit avec une vraie photo/nom officiel quand disponible — mais
  // ce n'est plus un passage obligé, juste un bonus quand il y a un hit.
  //
  // La recherche OFF en direct n'a plus lieu ici du tout — elle devient
  // une action ponctuelle, à la demande, par ligne (voir searchOffForLine),
  // ce qui supprime le problème de la limite de débit d'Open Food Facts
  // (10 requêtes/minute) qu'on ne peut plus cogner puisqu'on ne l'appelle
  // plus automatiquement pour un ticket entier.
  async function matchLinesToProducts(lignes) {
    let cacheHits = 0

    const items = (lignes || []).map((ligne) => {
      const searchKey = ligne.nom_propre || ligne.texte_brut
      // On tente le nom propre en priorité (plus lisible = souvent
      // mieux reconnu par le cache constitué via scans code-barres),
      // avec repli sur le texte brut pour les entrées de cache plus
      // anciennes qui auraient été indexées avant ce nettoyage.
      const cached = getFromCache(searchKey, null) || getFromCache(ligne.texte_brut, null)

      if (cached) {
        cacheHits++
        return {
          ...ligne,
          selected: true,
          // Le cache peut affiner le nom/catégorie si la classification
          // GPT était moins précise, mais garde le stockage classifié
          // (le cache ne connaît pas forcément ton organisation de frigo)
          nom_propre: cached.name || ligne.nom_propre,
          category: cached.category || ligne.category,
          image: cached.image || null,
          barcode: cached.barcode || null,
          fromCache: true,
        }
      }

      return { ...ligne, selected: true, fromCache: false }
    })

    return { items, cacheHits, total: lignes?.length || 0 }
  }

  // ═══════════════════════════════════════════════════════════════
  // IMPORT PDF — commande drive (Leclerc, Carrefour, Auchan...)
  // ═══════════════════════════════════════════════════════════════
  // Contrairement à la photo de ticket, le PDF contient déjà du texte
  // numérique propre — pas besoin de vision/OCR. On extrait le texte
  // directement (fiable à 100%), puis on demande à l'IA de le
  // structurer en lignes produit (même format que le scan ticket),
  // avant de passer par le même moteur de matching (cache + OFF).
  const importDrivePdf = async (file) => {
    if (!file) return

    // Quota AVANT l'action coûteuse (extraction + classification GPT),
    // jamais après — même compteur "scans" que le scan de ticket, voir
    // src/services/quota.js. Sans compte connecté, rien ne persiste de
    // toute façon (ingredients/priceHistory n'écrivent que si un uid
    // existe) : pas de quota à faire respecter à personne.
    if (user?.uid) {
      const scanQuota = await checkAndIncrementQuota(user.uid, 'scans')
      if (!scanQuota.allowed) {
        setScanResult({ error: true, quotaExceeded: true, quotaLimit: scanQuota.limit })
        setShowScanPanel(true)
        return
      }
    }

    setPdfLoading(true)
    setScanSource('drive')
    setScanResult(null)
    setScanPhases({ items: [] })
    setShowScanPanel(true)

    try {
      // Extraction texte via pdf.js — 100% côté client, aucune donnée envoyée
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.mjs',
        import.meta.url
      ).toString()

      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

      const pageTexts = []
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        pageTexts.push(content.items.map((it) => it.str).join(' '))
      }

      // Les documents multi-pages (factures...) répètent souvent tout
      // l'en-tête (vendeur, client, n° de facture...) en haut de chaque
      // nouvelle page, y compris quand une section continue sur la page
      // suivante — un bloc de texte IDENTIQUE au début de chaque page.
      // Le garder perturbe la structuration IA en aval : elle peut
      // confondre la répétition avec du contenu déjà vu et sauter les
      // articles juste après. On le détecte en comparant chaque page au
      // préfixe de la première (déterministe, ne dépend pas du modèle),
      // et on le retire des pages suivantes avant de les concaténer.
      const sharedHeaderLen =
        pageTexts.length > 1
          ? Math.min(
              ...pageTexts.slice(1).map((pageText) => {
                let len = 0
                while (
                  len < pageTexts[0].length &&
                  len < pageText.length &&
                  pageTexts[0][len] === pageText[len]
                )
                  len++
                return len
              })
            )
          : 0
      // Ne retire le préfixe partagé que s'il est substantiel (un vrai
      // en-tête répété), pas juste quelques caractères communs par hasard
      const headerCut = sharedHeaderLen > 100 ? sharedHeaderLen : 0

      let fullText = pageTexts[0] || ''
      for (let i = 1; i < pageTexts.length; i++) {
        fullText += '\n' + pageTexts[i].slice(headerCut)
      }

      if (!fullText.trim()) {
        // PDF lu techniquement, mais aucune couche de texte trouvée —
        // presque toujours signe d'un PDF scanné/capture d'écran plutôt
        // qu'un export numérique natif. Différent d'une erreur technique.
        setScanResult({ error: true, pdfNoText: true })
        setPdfLoading(false)
        return
      }

      // Structuration du texte brut en lignes produit — prompt texte
      // uniquement (pas de vision), donc plus rapide et moins cher.
      // Couvre deux formats : le récapitulatif de préparation de commande
      // (liste simple, déjà géré) et la FACTURE téléchargée depuis
      // l'espace client (tableau Désignation/Quantité/Prix HT/Taux TVA/
      // Total TTC, avec lignes de détail Origine/Calibre/Variété et
      // en-têtes de rayon à filtrer).
      const prompt = `Tu reçois le texte brut extrait d'un document de commande drive (supermarché en ligne) — soit un récapitulatif de préparation de commande, soit une FACTURE téléchargée depuis l'espace client. Ce texte peut être mal formaté (colonnes fusionnées, espaces multiples) car extrait automatiquement d'un PDF.

Ta mission : identifier chaque article acheté avec le prix RÉELLEMENT PAYÉ pour cette ligne.

RÈGLES GÉNÉRALES :
- Une ligne = un article avec son prix associé
- Si une quantité/un poids est indiqué dans le nom de l'article (ex: "x2", "500g"), garde-le dans le texte
- Copie le nom de l'article le plus fidèlement possible — ne cherche pas à le nettoyer,
  ça sera fait dans une étape séparée
- Ignore : sous-totaux, totaux de commande/facture, frais de livraison, bons de réduction,
  moyen de paiement (carte bancaire...), récapitulatif de TVA par taux, informations de
  compte/adresse client, mentions légales

SI LE DOCUMENT EST UNE FACTURE avec un tableau à colonnes "Désignation / Quantité / Prix
unitaire HT / Taux TVA / Total TTC" (souvent dans cet ordre visuel, mais parfois mélangé
à l'extraction) :
- Chaque ligne d'article se termine par 4 nombres : quantité, prix unitaire HT, taux de
  TVA, puis Total TTC. Le prix à retenir est TOUJOURS le DERNIER nombre de la ligne
  (Total TTC) — jamais le prix unitaire HT (hors taxes, et souvent différent du total
  réellement payé pour cette ligne)
- Ignore les en-têtes de rayon en majuscules suivis de "(N produits)"
  (ex: "FRUITS LÉGUMES (10 produits)") — ce sont des titres de section, pas des articles
- Ignore les lignes de détail SANS prix propre qui suivent parfois un article
  (ex: "Origine : FRANCE • Catégorie : CAT-1- • Calibre : 25/35MM") — c'est de
  l'information complémentaire sur l'article juste au-dessus, pas un article séparé
  à zéro euro
- La date à retenir est celle du ticket/de la commande (ex: "Ticket 21/04/2026" ou
  "Commande n°... du 21/04/2026"), JAMAIS la "Date impression" qui n'est que la date
  de téléchargement du document
- L'enseigne à retenir est le nom du magasin dans l'en-tête VENDEUR en haut du document
  (ex: "Centre E.Leclerc" + ville) — jamais le nom/adresse du CLIENT destinataire de la
  facture, qui apparaît juste à côté dans le document
- Le document fait plusieurs pages : le bloc en-tête vendeur/client/facture (coordonnées,
  numéro de facture, date d'impression...) et parfois le titre de la section en cours SE
  RÉPÈTENT en haut de chaque nouvelle page, y compris quand une section continue sur la
  page suivante. Cette répétition n'est PAS un doublon du contenu déjà vu : traite chaque
  article qui la suit comme un nouvel article à part entière, ne saute jamais de lignes
  juste après une répétition d'en-tête ou de titre de section

Texte du PDF :
---
${fullText.slice(0, 20000)}
---

Réponds UNIQUEMENT en JSON valide :
{
  "enseigne": "Nom du magasin si identifiable, sinon null",
  "lieu": null,
  "date": "date du ticket/de la commande si visible, sinon null",
  "lignes": [
    { "texte_brut": "Nom exact de l'article", "prix": 3.45, "poids": "500g", "section": null }
  ]
}`

      const res = await fetch('/app/api-proxy.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proxy_token: 'lgm_2024_xK9mP3',
          model: 'gpt-4o-mini',
          max_tokens: 10000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      const text = data.content?.map((b) => b.text || '').join('') || ''
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())

      setScanResult({
        enseigne: parsed.enseigne || 'Commande Drive',
        lieu: parsed.lieu,
        date: parsed.date,
      })
      setPdfLoading(false)

      // Classification — cette étape manquait entièrement avant, d'où le
      // mélange alimentaire/non-alimentaire et le "tout au garde-manger".
      // Même enseigne que celle stockée dans scanResult ci-dessus, pour
      // que la clé du dictionnaire d'abréviations corresponde à celle
      // utilisée lors d'une correction manuelle sur ce même import.
      setClassifyLoading(true)
      parsed.lignes = await cleanupLigneNames(parsed.lignes, parsed.enseigne || 'Commande Drive')
      setClassifyLoading(false)

      setOffLoading(true)
      const { items, cacheHits } = await matchLinesToProducts(parsed.lignes)

      setScanPhases({ items })
      setOffLoading(false)
      setScanResult((r) => ({ ...r, cacheHits }))
    } catch (e) {
      console.error('Erreur import PDF:', e)
      setScanResult({ error: true, pdfTechnicalError: e?.message || 'inconnue' })
      setPdfLoading(false)
      setClassifyLoading(false)
      setOffLoading(false)
    }
  }

  const scanTicket = async (file) => {
    if (!file) return

    // Garde d'authentification — sans ça, un scan lancé juste après un
    // rechargement de page (avant que Firebase Auth ait fini de
    // restaurer la session en arrière-plan) part SANS token valide,
    // la Cloud Function le rejette silencieusement côté serveur, et
    // l'utilisateur voit juste "erreur" sans comprendre pourquoi.
    if (authLoading) {
      setScanResult({ error: true, authNotReady: true })
      setShowScanPanel(true)
      return
    }
    if (!isAuthenticated) {
      setScanResult({ error: true, needsAuth: true })
      setShowScanPanel(true)
      return
    }

    // Quota AVANT l'action coûteuse (Document AI), jamais après. En
    // bêta (betaUnlimited), ne bloque jamais mais compte quand même —
    // voir src/services/quota.js.
    const scanQuota = await checkAndIncrementQuota(user.uid, 'scans')
    if (!scanQuota.allowed) {
      setScanResult({ error: true, quotaExceeded: true, quotaLimit: scanQuota.limit })
      setShowScanPanel(true)
      return
    }

    setScanLoading(true)
    setScanSource('ticket')
    setScanResult(null)
    setScanConfirm(null)
    setScanPhases({ items: [] })
    setShowScanPanel(true)

    try {
      const base64 = await compressImage(file)

      /* ═══════════════════════════════════════════════════════════════
         ANCIEN PROMPT (v1 puis v2) — conservé pour référence, ne plus
         utiliser. GPT-4o-mini vision servait à l'OCR du ticket, mais
         un modèle vision généraliste n'est pas fait pour du texte
         thermique dense — trop de lignes sautées, trop d'erreurs.

         v1 avait aussi un bug de fond : les lignes "haute confiance"
         étaient importées sans jamais interroger Open Food Facts.

         REMPLACÉ (v3) PAR : Google Document AI — Expense Parser,
         un processeur spécifiquement entraîné sur les tickets de
         caisse, appelé via Cloud Function (voir functions/index.js).
         Plus de prompt à écrire : Document AI retourne directement
         des champs structurés (article, prix, enseigne, date) avec un
         score de confiance par champ.

      const continuityContext = ...
      const prompt = `Tu es un OCR spécialisé tickets de caisse français. ...`
      const res = await fetch('/app/api-proxy.php', { ... model: 'gpt-4o-mini' ... })
      ═══════════════════════════════════════════════════════════════ */

      const parseReceipt = httpsCallable(functions, 'parseReceiptWithDocumentAI')

      const response = await parseReceipt({
        imageBase64: base64,
        mimeType: file.type || 'image/jpeg',
      })
      const parsed = response.data

      setScanResult({ enseigne: parsed.enseigne, lieu: parsed.lieu, date: parsed.date })
      setScanLoading(false)

      // Nettoyage des noms — étape séparée de la recherche OFF (voir
      // commentaire sur cleanupLigneNames). Se fait AVANT le matching.
      setClassifyLoading(true)
      parsed.lignes = await cleanupLigneNames(parsed.lignes, parsed.enseigne)
      setClassifyLoading(false)

      setOffLoading(true)
      const { items, cacheHits } = await matchLinesToProducts(parsed.lignes)

      const itemsDedup = detectDoublons(items, lastTicketItems)
      setScanPhases({ items: itemsDedup })
      const derniersArticles = parsed.lignes?.slice(-3) || []
      setLastTicketItems(derniersArticles)
      setPhotoCount((p) => p + 1)
      setOffLoading(false)

      // Toujours afficher combien de lignes viennent du cache local —
      // c'est le signal que le système s'améliore avec l'usage.
      setScanResult((r) => ({ ...r, cacheHits }))
    } catch (e) {
      setScanResult({ error: true })
      setScanLoading(false)
      setClassifyLoading(false)
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

  // Import définitif des lignes cochées de scanPhases.items vers
  // ingredients/nonFood — logique du bouton "✓ Importer", extraite pour
  // être appelable aussi bien depuis le flux normal que depuis l'écran
  // de démarrage de l'onboarding (voir renderOnboardingStart), sans
  // dupliquer cette boucle. Retourne le nombre d'articles réellement
  // importés, pour que l'appelant sache s'il peut enchaîner (Phase 3).
  const importScannedItems = () => {
    const selected = scanPhases.items.filter((i) => i.selected)
    selected.forEach((item) => {
      const nom = (item.nom_propre || item.texte_brut).trim()

      // Prix réel du ticket — enregistré dans l'historique pour
      // affiner les futures estimations de liste de courses.
      // L'enseigne du ticket est capturée dans l'historique
      // complet (voir recordPrice) pour ne pas la perdre.
      if (item.prix) {
        recordPrice({
          name: nom,
          barcode: item.barcode,
          price: item.prix,
          source: 'ticket',
          enseigne: scanResult?.enseigne,
        })
      }

      // Cache produit — sauf si déjà connu (évite d'écraser
      // une entrée déjà validée par une simple ré-apparition)
      if (!item.fromCache) {
        cacheProduct({
          name: nom,
          barcode: item.barcode,
          category: item.category || null,
          image: item.image || null,
          marque: '',
          source: 'ticket',
        })
      }

      if (item.type === 'alimentaire') {
        setIngredients((p) => [
          ...p,
          {
            id: Date.now() + Math.random(),
            name: nom,
            quantity: String(item.quantity || 1),
            unit: item.unit || 'pièce(s)',
            category: item.category || 'Autre',
            dlc: '',
            storage: item.storage || 'garde_manger',
            price: item.prix ? String(item.prix) : '',
          },
        ])
      } else {
        setNonFood((p) => [
          ...p,
          {
            id: Date.now() + Math.random(),
            name: nom,
            quantity: String(item.quantity || 1),
            unit: item.unit || 'pièce(s)',
            category: item.category || 'Autre maison',
            prix: item.prix,
          },
        ])
      }
    })
    setShowScanPanel(false)
    setScanPhases({ items: [] })
    return selected.length
  }

  const compressImage = (file, maxWidth = 2400) =>
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
          const compressed = canvas.toDataURL('image/jpeg', 0.92).split(',')[1]
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

      const res = await fetch('/app/api-proxy.php', {
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
  const analyzeRecipeText = async (input) => {
    if (!input.trim()) return
    setRecipeAnalysisLoading(true)
    setRecipeAnalysisResult(null)
    setShowRecipeAnalysis(true)
    setShowRecipeTextInput(false)

    try {
      const inventaire =
        ingredients.map((i) => `${i.name} (${i.quantity}${i.unit})`).join(', ') || 'Inventaire vide'

      // Étape 1 — classification
      const classPrompt = `Analyse ce texte et réponds UNIQUEMENT en JSON :
  {
    "type": "recette" | "lien_externe" | "rien",
    "url_trouvee": "https://..." ou null,
    "contenu_recette": "texte de la recette si type=recette" ou null
  }

  Texte :
  ---
  ${input}
  ---`

      const res1 = await fetch('/app/api-proxy.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proxy_token: 'lgm_2024_xK9mP3',
          model: 'gpt-4o-mini',
          max_tokens: 500,
          temperature: 0,
          messages: [{ role: 'user', content: classPrompt }],
        }),
      })
      const d1 = await res1.json()
      const classified = JSON.parse(
        d1.content
          ?.map((b) => b.text || '')
          .join('')
          .replace(/```json\n?|```/g, '')
          .trim()
      )

      let recipeText = null

      if (classified.type === 'rien') {
        setRecipeAnalysisResult({ error: true, message: 'Aucune recette trouvée dans ce texte.' })
        setRecipeAnalysisLoading(false)
        return
      }

      if (classified.type === 'lien_externe' && classified.url_trouvee) {
        // Fetch le lien
        const res2 = await fetch('/app/api-proxy.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proxy_token: 'lgm_2024_xK9mP3',
            model: 'gpt-4o-mini',
            max_tokens: 1000,
            temperature: 0,
            messages: [
              {
                role: 'user',
                content: `Fetch et résume la recette sur cette URL : ${classified.url_trouvee}\nRéponds avec juste le texte de la recette (ingrédients + étapes).`,
              },
            ],
          }),
        })
        const d2 = await res2.json()
        recipeText = d2.content?.map((b) => b.text || '').join('') || ''
      } else {
        recipeText = classified.contenu_recette || input
      }

      // Étape 2 — extraction ingrédients
      const extractPrompt = `Tu es un chef cuisinier. Voici une recette :
  ---
  ${recipeText}
  ---

  INVENTAIRE DISPONIBLE : ${inventaire}

  Analyse et réponds UNIQUEMENT en JSON valide :
  {
    "nom_recette": "Nom",
    "portions_recette": 4,
    "ingredients": [
      { "nom": "Œufs", "quantite_recette": "3", "quantite_course": "6", "unite": "pièce(s)", "statut": "disponible"|"substituable"|"manquant", "note": "...", "note_quantite": "..." }
    ],
    "conseil_chef": "..."
  }`

      const res3 = await fetch('/app/api-proxy.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proxy_token: 'lgm_2024_xK9mP3',
          model: 'gpt-4o-mini',
          max_tokens: 2000,
          temperature: 0,
          messages: [{ role: 'user', content: extractPrompt }],
        }),
      })
      const d3 = await res3.json()
      const text3 = d3.content?.map((b) => b.text || '').join('') || ''
      const parsed = JSON.parse(text3.replace(/```json\n?|```/g, '').trim())
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
  const saveRecipe = (recipe, source = 'ia') => {
    const already = savedRecipes.find((r) => r.nom === recipe.nom)
    if (already) {
      setSavedRecipes((p) => p.filter((r) => r.nom !== recipe.nom))
    } else {
      setSavedRecipes((p) => [
        { ...recipe, id: `saved_${Date.now()}`, source, savedAt: new Date().toISOString() },
        ...p,
      ])
    }
  }
  const isRecipeSaved = (nom) => savedRecipes.some((r) => r.nom === nom)
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

    // Quota AVANT l'action coûteuse (génération GPT), jamais après —
    // voir src/services/quota.js. Sans compte connecté, rien ne
    // persisterait de toute façon, pas de quota à faire respecter.
    if (user?.uid) {
      const recipeQuota = await checkAndIncrementQuota(user.uid, 'recipes')
      if (!recipeQuota.allowed) {
        setRecipeResult([
          {
            id: 'quota',
            nom: 'Limite mensuelle atteinte',
            emoji: '🚦',
            description: `Tu as utilisé tes ${recipeQuota.limit} générations de recettes gratuites ce mois-ci. Reviens le mois prochain !`,
            etapes: [],
          },
        ])
        setTimeout(
          () => recipeResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
          100
        )
        return
      }
    }

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

    // Ingrédients — mode vide-frigo priorise les expirants. L'id est
    // exposé pour que le modèle puisse le recopier tel quel dans le
    // manifeste structuré (stock_utilise) — voir plus bas — au lieu de
    // ne référencer les ingrédients que par leur nom en prose.
    const ingList = ingredients
      .map((i) => {
        const d = getDaysLeft(i.dlc)
        const urgent = d !== null && d <= 2
        return `- id:${i.id} | ${i.name} (${i.quantity}${i.unit}${urgent ? ' ⚠️URGENT' : ''})`
      })
      .join('\n')
    // Taux de tolérance

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
    // Taux de tolérance
    const toleranceContext = {
      strict:
        '\n\nCONTRAINTE STRICTE : Utilise UNIQUEMENT les ingrédients disponibles. Aucun ingrédient manquant autorisé.',
      un: '\n\nTOLÉRANCE +1 : Tu peux proposer des recettes avec AU MAXIMUM 1 ingrédient manquant. Indique-le clairement.',
      deux: '\n\nTOLÉRANCE +2-3 : Tu peux proposer des recettes avec 2 à 3 ingrédients manquants maximum. Indique-les clairement.',
      libre:
        '\n\nMODE LIBRE : Propose les meilleures recettes possibles avec ou sans ingrédients manquants. Indique ce qui manque.',
    }[tolerance]
    // Saison
    const seasonContext = `\n\nSAISON : ${season.label}. Légumes/fruits de saison à privilégier : ${season.hint}.`

    const portions = modeSoiree ? guestCount : selectedConvives.length || 2

    const prompt = `Tu es un chef cuisinier bienveillant. Parle simplement, sans jargon technique.

INGRÉDIENTS DISPONIBLES :
${ingList}

ÉQUIPEMENT : ${eqList}
NIVEAU D'ÉNERGIE : ${eLvl}
TEMPS DISPONIBLE : ${timeAvail} minutes
OBJECTIFS : ${objList}${convivesContext}${historyContext}${ratingContext}${cookContext}${soireeContext}${budgetContext}${videContext}${toleranceContext}${seasonContext}

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
      "stock_utilise": [
        { "ingredientId": 1234567890, "quantiteUtilisee": 3, "unite": "pièce(s)" }
      ],
      "etapes": ["Étape 1", "Étape 2"],
      "conseil": "Un conseil pratique",
      "termes_expliques": {}
    }
  ]
}

IMPORTANT pour "stock_utilise" : c'est un champ SÉPARÉ de "ingredients_detail",
à ne remplir qu'avec les ingrédients RÉELLEMENT piochés dans la liste
INGRÉDIENTS DISPONIBLES ci-dessus (jamais les ingrédients manquants/à
acheter). Pour chaque ligne, "ingredientId" doit être recopié EXACTEMENT
tel qu'il apparaît après "id:" dans cette liste (jamais un nom, jamais
un id inventé). Si un ingrédient disponible n'est pas utilisé par la
recette, ne l'inclus pas. Un même ingredientId ne doit apparaître qu'une
seule fois par recette (additionne les quantités si besoin).`

    try {
      const res = await fetch('/app/api-proxy.php', {
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

      // Instrumentation rétention — un seul événement pour tout le LOT
      // généré (les 3 recettes partagent le même contexte : inventaire,
      // modes actifs, horodatage). Chaque recette est taguée avec ce même
      // generationId pour que "J'ai cuisiné ça" puisse plus tard relier
      // le cookLog à sa génération d'origine (voir submitCookFeedback).
      // Ne compte QUE les générations qui aboutissent réellement — pas
      // les tentatives bloquées par le quota (retour anticipé plus haut)
      // ni les échecs (bloc catch ci-dessous).
      const generationId = Date.now()

      // Garde-fou contre l'hallucination : le modèle recopie des ids en
      // théorie exacts, mais rien ne garantit qu'il ne s'en invente pas
      // un ou n'en déforme pas un au passage. On ne fait confiance qu'aux
      // lignes dont l'ingredientId correspond à un ingrédient RÉELLEMENT
      // présent dans l'inventaire au moment de la génération — les autres
      // sont silencieusement écartées plutôt que de fausser une future
      // déduction de stock sur un id qui n'existe pas.
      const validIngredientIds = new Set(ingredients.map((i) => String(i.id)))
      const recettesGenerees = (parsed.recettes || []).map((r) => ({
        ...r,
        generationId,
        stock_utilise: (r.stock_utilise || []).filter((s) =>
          validIngredientIds.has(String(s.ingredientId))
        ),
      }))
      setRecipeResult(recettesGenerees)

      // Événement "activation" de l'onboarding — marqué ICI (première
      // recette réellement affichée) plutôt qu'au moment de confirmer
      // l'import : un import réussi suivi d'un échec de génération (API
      // en carafe, quota...) ne doit jamais compter comme une activation,
      // et ne bloque jamais non plus l'utilisateur — l'onglet Recettes
      // reste utilisable normalement pour réessayer (voir le bouton
      // habituel, plus caché derrière onboardingMode une fois ici).
      if (onboardingMode) {
        setOnboarding({ completed: true, completedAt: new Date().toISOString() })
      }

      setRecipeGenerations((p) => [
        ...p,
        {
          id: generationId,
          ingredientCount: ingredients.length,
          modeSoiree,
          modeVideFrigo,
          modeBudget: !!weeklyBudget,
          convivesCount: selectedConvives.length,
          recipeCount: recettesGenerees.length,
          date: new Date().toISOString(),
          // Manifeste structuré par recette — voir stock_utilise dans le
          // prompt ci-dessus. Sert à la fois de trace d'audit (Phase 2 du
          // chantier "déduction de stock") et de vérification manuelle :
          // on peut comparer ces ingredientId à l'inventaire réel au
          // moment T pour confirmer qu'ils ne sont pas approximatifs.
          manifests: recettesGenerees.map((r) => ({
            recipeId: r.id,
            recipeName: r.nom,
            stockUtilise: r.stock_utilise,
          })),
        },
      ])

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

  // Phase 3 de l'onboarding "premier scan" — déclenche generateRecipes()
  // automatiquement une fois l'inventaire importé, SANS que l'utilisateur
  // ait à trouver le bouton lui-même. On attend que `ingredients` reflète
  // vraiment l'import (écriture Firestore asynchrone via
  // useFirestoreCollection — le simple clic ne suffit pas) plutôt que
  // d'appeler generateRecipes() juste après importScannedItems(), ce qui
  // partirait sur l'ancien inventaire encore vide à ce moment précis.
  useEffect(() => {
    if (!onboardingPendingGenerationRef.current || ingredients.length === 0) return
    onboardingPendingGenerationRef.current = false
    // Tolérance stricte (réglage par défaut) exigerait zéro ingrédient
    // manquant — un risque réel d'échec sur un inventaire tout juste
    // importé et encore imprévisible. Choix de compromis pour maximiser
    // les chances d'une première recette réussie ; explicitement signalé
    // plutôt qu'ajouté silencieusement (voir rapport de ce chantier).
    setTolerance('libre')
    setTab('recettes')
    generateRecipes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredients])

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
      const res = await fetch('/app/api-proxy.php', {
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

  // Déduit du stock les ingrédients réellement utilisés par la recette
  // cuisinée, à partir du manifeste structuré capturé à la génération
  // (voir stock_utilise dans generateRecipes). Ne fait AUCUNE conversion
  // d'unité : soit l'unité du manifeste correspond exactement à celle de
  // l'ingrédient en stock (déduction précise, ex: g contre g), soit elle
  // ne correspond pas (ex: "200g" demandés contre un ingrédient stocké en
  // "pièce(s)" sans grammage) et on se rabat sur un décompte d'une unité
  // entière plutôt que de deviner un poids partiel qui fausserait
  // silencieusement les données. Chaque ligne est renvoyée avec son type
  // ('precise' | 'approximative') pour pouvoir mesurer la fréquence de ce
  // repli — voir cookLogs.stockDeductions. Ne touche jamais aux
  // ingrédients absents du manifeste (recette non générée par l'IA, ou
  // ingrédient déjà supprimé manuellement depuis).
  const applyStockDeduction = (manifest) => {
    if (!manifest || manifest.length === 0) return []
    const deductions = []
    const updated = ingredients.map((ing) => {
      const line = manifest.find((m) => String(m.ingredientId) === String(ing.id))
      if (!line) return ing

      const currentQty = parseFloat(ing.quantity) || 0
      const sameUnit = (ing.unit || '').trim().toLowerCase() === (line.unite || '').trim().toLowerCase()
      const type = sameUnit ? 'precise' : 'approximative'
      const newQty = sameUnit
        ? Math.max(0, currentQty - (parseFloat(line.quantiteUtilisee) || 0))
        : Math.max(0, currentQty - 1)

      deductions.push({
        ingredientId: ing.id,
        ingredientName: ing.name,
        quantiteUtilisee: line.quantiteUtilisee,
        unite: line.unite,
        type,
        quantityBefore: currentQty,
        quantityAfter: newQty,
      })

      // Ingrédient épuisé : reste visible avec une quantité à 0 plutôt
      // que supprimé — évite de perdre l'historique et laisse
      // l'utilisateur décider de le retirer ou de le racheter.
      return { ...ing, quantity: String(newQty) }
    })
    setIngredients(updated)
    return deductions
  }

  const submitCookFeedback = () => {
    if (!cookTarget) return
    const stockDeductions = applyStockDeduction(cookTarget.stock_utilise)
    setCookLogs((p) => [
      ...p,
      {
        id: Date.now(),
        recipeId: cookTarget.id,
        recipeName: cookTarget.nom,
        // Référence vers le lot de génération d'origine (voir
        // generateRecipes) — absent si la recette vient d'ailleurs
        // (analyse photo/texte, pas de generateRecipes derrière) plutôt
        // que d'une génération IA classique. C'est ce qui permet de
        // croiser "généré avec X ingrédients" et "effectivement cuisiné".
        generationId: cookTarget.generationId || null,
        // Trace d'audit de la déduction de stock (voir applyStockDeduction
        // ci-dessus) — tableau vide si la recette n'a pas de manifeste
        // (pas générée par l'IA) plutôt qu'absent, pour distinguer "pas de
        // manifeste" de "champ jamais écrit" lors d'une requête Firestore.
        stockDeductions,
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
TOLÉRANCE INGRÉDIENTS MANQUANTS : ${toleranceContext}
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
      const res = await fetch('/app/api-proxy.php', {
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
      fontFamily: "'Inter',sans-serif",
      maxWidth: '430px',
      margin: '0 auto',
    },
    header: {
      padding: '20px 18px 14px',
      background: C.bgDeep,
      borderBottom: `1.5px solid ${C.border}`,
    },
    title: {
      fontFamily: "'Fraunces',serif",
      fontSize: '26px',
      fontWeight: 900,
      color: C.brown,
      letterSpacing: '-0.5px',
      fontStyle: 'italic',
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
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '3px',
      padding: '11px 4px',
      fontSize: '10px',
      fontWeight: a ? 700 : 400,
      color: a ? C.brown : C.textLight,
      background: 'none',
      border: 'none',
      borderBottom: a ? `2.5px solid ${C.brown}` : '2.5px solid transparent',
      cursor: 'pointer',
      fontFamily: "'Inter',sans-serif",
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
      fontFamily: "'Inter',sans-serif",
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
      fontFamily: "'Inter',sans-serif",
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
      fontFamily: "'Inter',sans-serif",
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
  // Écran de démarrage "premier scan" — remplace l'interface normale
  // (vide et intimidante) tant qu'un nouveau compte n'a encore aucun
  // ingrédient. Drive en premier choix visuel (canal mis en avant dans
  // le positionnement — inventaire fiable à 100%), ticket en alternative
  // égale. Volontairement PAS de 3ème option "ajout manuel" ici : ça
  // casserait la promesse "l'inventaire se remplit tout seul" qui porte
  // tout ce parcours.
  const renderOnboardingStart = () => (
    <div
      style={{
        textAlign: 'center',
        padding: '40px 16px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      <div style={{ fontSize: '44px', marginBottom: '4px' }}>🏺</div>
      <div
        style={{
          fontFamily: "'Fraunces',serif",
          fontSize: '20px',
          fontWeight: 700,
          color: C.brown,
        }}
      >
        Remplissons ton frigo
      </div>
      <div
        style={{
          fontSize: '13px',
          color: C.textMid,
          maxWidth: '300px',
          marginBottom: '22px',
          lineHeight: 1.4,
        }}
      >
        Importe tes derniers achats et ton inventaire se construit tout seul.
      </div>

      <label
        style={{
          width: '100%',
          maxWidth: '320px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '5px',
          padding: '20px 16px',
          borderRadius: '18px',
          background: `${C.brown}10`,
          border: `2px solid ${C.brown}70`,
          cursor: 'pointer',
          marginBottom: '12px',
          position: 'relative',
          fontFamily: "'Inter',sans-serif",
        }}
      >
        <FileText size={26} color={C.brown} strokeWidth={1.75} />
        <span style={{ fontSize: '14px', fontWeight: 700, color: C.brown }}>
          As-tu une facture ou confirmation de commande drive récente ?
        </span>
        <span style={{ fontSize: '11px', color: C.textLight }}>
          Carrefour, Leclerc, Intermarché... — inventaire fiable à 100%
        </span>
        <input
          type='file'
          accept='application/pdf'
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
          onChange={(e) => {
            if (e.target.files?.[0]) {
              setOnboardingMode(true)
              importDrivePdf(e.target.files[0])
            }
            e.target.value = ''
          }}
        />
      </label>

      <button
        onClick={() => {
          setOnboardingMode(true)
          setShowTicketCamera(true)
        }}
        style={{
          width: '100%',
          maxWidth: '320px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '5px',
          padding: '16px',
          borderRadius: '18px',
          background: `${C.green}0d`,
          border: `2px solid ${C.green}60`,
          cursor: 'pointer',
          fontFamily: "'Inter',sans-serif",
        }}
      >
        <ScanLine size={22} color={C.green} strokeWidth={1.75} />
        <span style={{ fontSize: '13px', fontWeight: 700, color: C.green }}>
          Ou un ticket de caisse sous la main ?
        </span>
      </button>
    </div>
  )

  const renderFrigo = () => {
    // Combine le nouveau flag persisté (voir plus haut) avec un signal déjà
    // existant (inventaire vide) plutôt que de se fier au seul flag — ça
    // évite d'imposer rétroactivement cet écran à un compte déjà actif qui
    // n'avait simplement pas encore ce champ en base.
    const showOnboardingStart =
      isAuthenticated &&
      !authLoading &&
      ingredients.length === 0 &&
      !onboarding?.completed &&
      !onboardingMode

    return (
    <>
      <div style={st.content}>
        {showOnboardingStart ? (
          renderOnboardingStart()
        ) : (
        <>
        {!isAuthenticated && (
          <div
            style={{
              padding: '12px 14px',
              background: `${C.brown}12`,
              border: `1px solid ${C.brown}40`,
              borderRadius: '12px',
              marginBottom: '12px',
              fontSize: '12px',
              color: C.brown,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <span>
              🔐 Connecte-toi pour voir et modifier ton frigo — tes ingrédients sont maintenant
              synchronisés entre tes appareils.
            </span>
            <button
              onClick={login}
              style={{
                background: C.brown,
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Se connecter
            </button>
          </div>
        )}

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
                fontFamily: "'Inter',sans-serif",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Scan ticket + Import PDF drive */}
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
              background: `${C.green}10`,
              border: `2px solid ${C.green}70`,
              cursor: 'pointer',
              fontFamily: "'Inter',sans-serif",
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <ScanLine size={22} color={C.green} strokeWidth={1.75} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: C.green }}>
              Scanner un ticket
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
              background: `${C.brown}10`,
              border: `2px solid ${C.brown}70`,
              cursor: 'pointer',
              fontFamily: "'Inter',sans-serif",
              WebkitTapHighlightColor: 'transparent',
              position: 'relative',
            }}
          >
            <FileText size={22} color={C.brown} strokeWidth={1.75} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: C.brown }}>
              Commande drive (PDF)
            </span>
            <input
              type='file'
              accept='application/pdf'
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
              onChange={(e) => {
                if (e.target.files?.[0]) importDrivePdf(e.target.files[0])
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
                  if (showAddIng) {
                    cancelIngredientForm()
                  } else {
                    setShowAddIng(true)
                  }
                  setLastTicketItems([])
                  setPhotoCount(0)
                }}
              >
                {showAddIng ? '✕ Annuler' : '+ Ajouter'}
              </Btn>
            </div>

            {showAddIng && (
              <Card accent style={{ marginBottom: '12px' }}>
                {editingIngredientId && (
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: C.terra,
                      marginBottom: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    ✏️ Modification de l'ingrédient
                  </div>
                )}
                <div
                  style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}
                >
                  <div style={{ flex: 1 }}>
                    <Input
                      placeholder="Nom de l'ingrédient *"
                      value={newIng.name}
                      onChange={(v) => setNewIng((p) => ({ ...p, name: v }))}
                    />
                  </div>
                  <button
                    onClick={() => setShowFrigoBarcode(true)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: `${C.brown}15`,
                      border: `1px solid ${C.brown}40`,
                      color: C.brown,
                      cursor: 'pointer',
                      fontSize: '18px',
                      flexShrink: 0,
                    }}
                  >
                    📷
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                  <div style={{ flex: 2 }}>
                    <Input
                      placeholder='Quantité (ex: 125)'
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
                  <Input
                    placeholder="Nombre d'unités (optionnel)"
                    value={newIng.unitCount}
                    onChange={(v) =>
                      setNewIng((p) => ({ ...p, unitCount: v.replace(/[^\d]/g, '') }))
                    }
                  />
                  <div style={{ fontSize: '10px', color: C.textLight, marginTop: '3px' }}>
                    Ex : 8 pour "8 yaourts de 125g". Laisse vide pour un seul contenant.
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
                <div style={{ fontSize: '11px', color: C.textLight, marginBottom: '4px' }}>
                  Prix payé (optionnel — alimente l'estimation des courses)
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <Input
                    placeholder='ex: 2.50'
                    value={newIng.price}
                    onChange={(v) => setNewIng((p) => ({ ...p, price: v.replace(',', '.') }))}
                  />
                </div>
                <Btn onClick={addIngredient}>
                  {editingIngredientId ? '✓ Modifier' : '✓ Ajouter'}
                </Btn>
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
                          <Pill
                            label={
                              ing.unitCount
                                ? `${ing.unitCount} × ${ing.quantity}${ing.unit}`
                                : `${ing.quantity}${ing.unit}`
                            }
                            color={C.textLight}
                          />
                          <Pill label={ing.category} color={C.brownLight} />
                          {st2 && <Pill label={`${st2.icon} ${st2.label}`} color={st2.color} />}
                          {ing.price && <Pill label={`${ing.price}€`} color={C.green} />}
                        </div>
                      </div>
                      <button
                        onClick={() => editIngredient(ing)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: C.textLight,
                          cursor: 'pointer',
                          fontSize: '15px',
                          padding: '4px',
                          flexShrink: 0,
                        }}
                        title='Modifier'
                      >
                        ✏️
                      </button>
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
              {scanLoading || pdfLoading || classifyLoading || offLoading ? (
                (() => {
                  // Progression réelle par étape plutôt qu'un simple spinner —
                  // couvre aussi le "trou" qui existait entre l'extraction
                  // (scanLoading/pdfLoading) et le matching OFF (offLoading),
                  // pendant lequel cleanupLigneNames tournait sans aucun
                  // indicateur visuel.
                  const steps = [
                    {
                      label: scanSource === 'drive' ? 'Lecture de la commande' : 'Lecture du ticket',
                      active: scanLoading || pdfLoading,
                    },
                    { label: 'Classification des articles', active: classifyLoading },
                    { label: 'Recherche des fiches produits', active: offLoading },
                  ]
                  const currentIdx = steps.findIndex((s) => s.active)
                  return (
                    <div style={{ padding: '32px 12px' }}>
                      <div style={{ fontSize: '32px', textAlign: 'center', marginBottom: '18px' }}>
                        {scanSource === 'drive' ? '📄' : '🧾'}
                      </div>
                      {steps.map((step, i) => {
                        const done = currentIdx === -1 || i < currentIdx
                        const isCurrent = i === currentIdx
                        return (
                          <div
                            key={step.label}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 4px',
                              opacity: done || isCurrent ? 1 : 0.4,
                            }}
                          >
                            <span
                              style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: 700,
                                background: done ? C.green : isCurrent ? `${C.green}20` : C.bgInset,
                                color: done ? '#fff' : C.green,
                                border: isCurrent ? `2px solid ${C.green}` : 'none',
                              }}
                            >
                              {done ? '✓' : isCurrent ? '' : i + 1}
                            </span>
                            <span
                              style={{
                                fontSize: '13px',
                                fontWeight: isCurrent ? 700 : 400,
                                color: isCurrent ? C.brown : done ? C.textMid : C.textLight,
                              }}
                            >
                              {step.label}
                              {isCurrent ? '...' : ''}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()
              ) : scanResult?.error ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div style={{ fontSize: '30px', marginBottom: '8px' }}>
                    {scanResult.authNotReady || scanResult.needsAuth
                      ? '🔐'
                      : scanResult.quotaExceeded
                        ? '🚦'
                        : '❌'}
                  </div>
                  <div style={{ color: C.textMid, fontSize: '13px', marginBottom: '16px' }}>
                    {scanResult.quotaExceeded ? (
                      <>
                        Limite mensuelle atteinte.
                        <br />
                        <span style={{ fontSize: '11px', color: C.textLight }}>
                          Tu as utilisé tes {scanResult.quotaLimit} scans gratuits ce mois-ci.
                          Reviens le mois prochain !
                        </span>
                      </>
                    ) : scanResult.authNotReady ? (
                      <>
                        Ta session se charge encore.
                        <br />
                        <span style={{ fontSize: '11px', color: C.textLight }}>
                          Patiente 1-2 secondes après avoir ouvert l'app, puis réessaie de scanner.
                        </span>
                      </>
                    ) : scanResult.needsAuth ? (
                      <>
                        Connecte-toi pour scanner un ticket.
                        <br />
                        <span style={{ fontSize: '11px', color: C.textLight }}>
                          Le scan a besoin d'un compte pour appeler Document AI en toute sécurité.
                        </span>
                      </>
                    ) : scanResult.pdfNoText ? (
                      <>
                        Aucun texte trouvé dans ce PDF.
                        <br />
                        <span style={{ fontSize: '11px', color: C.textLight }}>
                          C'est probablement une image/capture d'écran collée dans un PDF, pas un
                          export numérique — le texte n'existe pas à l'intérieur du fichier.
                        </span>
                      </>
                    ) : scanResult.pdfTechnicalError ? (
                      <>
                        Erreur technique pendant la lecture du PDF.
                        <br />
                        <span
                          style={{
                            fontSize: '10px',
                            color: C.textLight,
                            fontFamily: 'monospace',
                          }}
                        >
                          {scanResult.pdfTechnicalError}
                        </span>
                      </>
                    ) : (
                      'Impossible de lire ce ticket.'
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    {scanResult.needsAuth && (
                      <Btn
                        variant='green'
                        onClick={() => {
                          setShowScanPanel(false)
                          login()
                        }}
                      >
                        Se connecter
                      </Btn>
                    )}
                    <Btn
                      variant='outline'
                      onClick={() => {
                        setShowScanPanel(false)
                        if (onboardingMode) setOnboardingMode(false)
                      }}
                    >
                      Fermer
                    </Btn>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      fontFamily: "'Fraunces',serif",
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

                  {/* Stat unique — plus de 3 catégories, chaque ligne est déjà importable */}
                  {!offLoading && scanPhases.items.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        marginBottom: '14px',
                        borderRadius: '10px',
                        background: `${C.green}10`,
                        border: `1px solid ${C.green}25`,
                      }}
                    >
                      <span style={{ fontSize: '12px', color: C.green, fontWeight: 600 }}>
                        {scanPhases.items.length} article{scanPhases.items.length > 1 ? 's' : ''}{' '}
                        prêt{scanPhases.items.length > 1 ? 's' : ''} à importer
                      </span>
                      {scanResult?.cacheHits > 0 && (
                        <span style={{ fontSize: '11px', color: C.textLight }}>
                          ⚡ {scanResult.cacheHits} depuis ton historique
                        </span>
                      )}
                    </div>
                  )}

                  {/* Liste unique — chaque ligne déjà classifiée (nom, catégorie,
                      stockage, quantité, unité) et directement importable */}
                  {scanPhases.items.length > 0 && (
                    <div style={{ marginBottom: '14px' }}>
                      {scanPhases.items.map((item, idx) => {
                        const storageInfo = STORAGE_TYPES.find((s) => s.id === item.storage)
                        const isUncertain = item.confianceNom === 'basse'
                        return (
                          <div
                            key={idx}
                            style={{
                              padding: '10px 0',
                              borderBottom: `1px solid ${C.border}`,
                              opacity: item.selected ? 1 : 0.5,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                              <div
                                onClick={() =>
                                  setScanPhases((p) => ({
                                    ...p,
                                    items: p.items.map((x, i) =>
                                      i === idx ? { ...x, selected: !x.selected } : x
                                    ),
                                  }))
                                }
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
                                  cursor: 'pointer',
                                  marginTop: '2px',
                                }}
                              >
                                {item.selected && (
                                  <span style={{ color: '#fff', fontSize: '11px' }}>✓</span>
                                )}
                              </div>

                              {item.image && (
                                <img
                                  src={item.image}
                                  alt=''
                                  style={{
                                    width: '28px',
                                    height: '28px',
                                    objectFit: 'contain',
                                    borderRadius: '4px',
                                    flexShrink: 0,
                                  }}
                                />
                              )}

                              <div style={{ flex: 1 }}>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  <span
                                    style={{ fontWeight: 600, fontSize: '13px', color: C.text }}
                                  >
                                    {item.nom_propre || item.texte_brut}
                                  </span>
                                  {isUncertain && (
                                    <span
                                      style={{
                                        fontSize: '9px',
                                        fontWeight: 700,
                                        color: '#d4a017',
                                        background: '#d4a01718',
                                        padding: '2px 6px',
                                        borderRadius: '999px',
                                      }}
                                      title='Le texte du ticket était difficile à lire — vérifie ce nom'
                                    >
                                      ⚠️ à vérifier
                                    </span>
                                  )}
                                  {item.fromCache && (
                                    <span
                                      style={{ fontSize: '9px', color: C.green }}
                                      title='Reconnu depuis ton historique'
                                    >
                                      ⚡
                                    </span>
                                  )}
                                </div>

                                {item.nom_propre && item.nom_propre !== item.texte_brut && (
                                  <div
                                    style={{
                                      fontSize: '10px',
                                      color: C.textLight,
                                      fontFamily: 'monospace',
                                      marginTop: '1px',
                                    }}
                                  >
                                    Ticket : {item.texte_brut}
                                  </div>
                                )}

                                <div
                                  style={{
                                    display: 'flex',
                                    gap: '5px',
                                    flexWrap: 'wrap',
                                    marginTop: '5px',
                                  }}
                                >
                                  <Pill label={item.category || 'Autre'} color={C.brownLight} />
                                  {storageInfo && (
                                    <Pill
                                      label={`${storageInfo.icon} ${storageInfo.label}`}
                                      color={storageInfo.color}
                                    />
                                  )}
                                  <Pill
                                    label={`${item.quantity || 1}${item.unit || 'pièce(s)'}`}
                                    color={C.textLight}
                                  />
                                  {item.prix != null && (
                                    <Pill label={`${item.prix}€`} color={C.green} />
                                  )}
                                </div>
                              </div>
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                gap: '6px',
                                marginTop: '8px',
                                marginLeft: '28px',
                              }}
                            >
                              <button
                                onClick={() => openTicketLineEditor(idx)}
                                style={{
                                  flex: 1,
                                  padding: '6px',
                                  borderRadius: '10px',
                                  border: `1px solid ${C.green}40`,
                                  background: `${C.green}12`,
                                  color: C.green,
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  fontFamily: "'Inter',sans-serif",
                                }}
                              >
                                ✏️ Corriger
                              </button>
                              {!item.fromCache && (
                                <button
                                  onClick={() => searchOffForLine(idx)}
                                  style={{
                                    flex: 1,
                                    padding: '6px',
                                    borderRadius: '10px',
                                    border: `1px solid ${C.brown}40`,
                                    background: `${C.brown}12`,
                                    color: C.brown,
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    fontFamily: "'Inter',sans-serif",
                                  }}
                                >
                                  🔍 Chercher une fiche
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setCurrentBarcodeTarget({ idx })
                                  setShowBarcodeScanner(true)
                                }}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '10px',
                                  border: `1px solid ${C.border}`,
                                  background: 'transparent',
                                  color: C.textLight,
                                  fontSize: '13px',
                                  cursor: 'pointer',
                                }}
                                title='Scanner le code-barres pour une identification précise'
                              >
                                📷
                              </button>
                              <button
                                onClick={() =>
                                  setScanPhases((p) => ({
                                    ...p,
                                    items: p.items.filter((_, i) => i !== idx),
                                  }))
                                }
                                style={{
                                  padding: '6px 10px',
                                  background: 'none',
                                  border: 'none',
                                  color: C.border,
                                  cursor: 'pointer',
                                  fontSize: '15px',
                                }}
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>
                    <Btn
                      variant='outline'
                      onClick={() => {
                        setShowScanPanel(false)
                        // Rien d'importé — retour à l'écran de choix plutôt
                        // que de laisser l'onboarding "coincé" en mode import.
                        if (onboardingMode) setOnboardingMode(false)
                      }}
                    >
                      Annuler
                    </Btn>
                    <div style={{ flex: 1 }}>
                      <Btn
                        variant='green'
                        onClick={() => {
                          const imported = importScannedItems()
                          if (onboardingMode) {
                            // La génération (Phase 3) attend que `ingredients`
                            // reflète vraiment l'import avant de partir — voir
                            // l'effet dédié plus bas, déclenché par ce flag.
                            if (imported > 0) onboardingPendingGenerationRef.current = true
                            else setOnboardingMode(false) // rien d'importé, retour à l'écran de choix
                          }
                        }}
                      >
                        {onboardingMode
                          ? "C'est bon, je vois mes ingrédients"
                          : `✓ Importer (${scanPhases.items.filter((i) => i.selected).length})`}
                      </Btn>
                    </div>
                  </div>
                </>
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
      {showFrigoBarcode && (
        <BarcodeScanner
          onResult={handleFrigoBarcodeResult}
          onClose={() => setShowFrigoBarcode(false)}
        />
      )}
      {showBarcodeScanner && (
        <BarcodeScanner
          onResult={handleBarcodeResult}
          onClose={() => setShowBarcodeScanner(false)}
        />
      )}
    </>
    )
  }

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
                  fontFamily: "'Inter',sans-serif",
                  outline: 'none',
                  WebkitTextFillColor: C.text,
                }}
              />
              <button
                onClick={addUser}
                style={{
                  background: C.green,
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
      {savedRecipes.length > 0 && (
        <div style={{ marginBottom: '14px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
            }}
          >
            <SectionLabel>🔖 Mon carnet ({savedRecipes.length})</SectionLabel>
          </div>
          {savedRecipes.map((recipe, idx) => {
            const open = expandedRecipe === `saved_${idx}`
            return (
              <div key={recipe.id} style={{ ...st.recipeCard, border: `1.5px solid ${C.brown}30` }}>
                <div
                  style={{ padding: '14px', cursor: 'pointer' }}
                  onClick={() => setExpandedRecipe(open ? null : `saved_${idx}`)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '26px' }}>{recipe.emoji || '🍽️'}</span>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: '15px',
                          fontFamily: "'Fraunces',serif",
                          color: C.brown,
                        }}
                      >
                        {recipe.nom}
                      </div>
                      <div style={{ fontSize: '12px', color: C.textMid, marginTop: '2px' }}>
                        {recipe.description}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        saveRecipe(recipe)
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '16px',
                        cursor: 'pointer',
                        opacity: 0.6,
                      }}
                    >
                      🗑
                    </button>
                    <span style={{ color: C.border, fontSize: '16px' }}>{open ? '▲' : '▼'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                    <span style={st.badge(C.brownMid)}>⏱ {recipe.temps} min</span>
                    <span style={st.badge(C.green)}>👤 {recipe.portions} pers.</span>
                    {recipe.difficulte && (
                      <span style={st.badge(C.brownLight)}>{recipe.difficulte}</span>
                    )}
                    <span style={st.badge(C.brown)}>
                      🔖 {recipe.source === 'ia' ? 'Générée' : 'Analysée'}
                    </span>
                  </div>
                </div>
                {open && (
                  <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${C.border}` }}>
                    {recipe.ingredients_detail?.length > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        <SectionLabel>Ingrédients</SectionLabel>
                        <div
                          style={{
                            background: C.bgInset,
                            borderRadius: '12px',
                            padding: '10px 12px',
                          }}
                        >
                          {recipe.ingredients_detail.map((ing, i) => (
                            <div
                              key={i}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                padding: '5px 0',
                                borderBottom:
                                  i < recipe.ingredients_detail.length - 1
                                    ? `1px solid ${C.border}`
                                    : 'none',
                              }}
                            >
                              <span style={{ fontSize: '13px', color: C.text }}>{ing.nom}</span>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: C.brown }}>
                                {ing.quantite} {ing.unite}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {recipe.etapes?.length > 0 && (
                      <div style={{ marginTop: '14px' }}>
                        <SectionLabel>Étapes</SectionLabel>
                        {recipe.etapes.map((e, i) => (
                          <div
                            key={i}
                            style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}
                          >
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
                        <span style={{ fontSize: '12px', color: C.green }}>
                          💡 {recipe.conseil}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {/* Analyser une recette */}
      <Card>
        <SectionLabel>Analyser une recette</SectionLabel>
        <div style={{ display: 'flex', gap: '8px' }}>
          <label
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: '12px 8px',
              borderRadius: '14px',
              background: `${C.terra}10`,
              border: `2px solid ${C.terra}70`,
              cursor: 'pointer',
              fontFamily: "'Inter',sans-serif",
            }}
          >
            <span style={{ fontSize: '20px' }}>📖</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: C.terra }}>
              Photo / Screenshot
            </span>
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
          <button
            onClick={() => setShowRecipeTextInput((p) => !p)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: '12px 8px',
              borderRadius: '14px',
              background: `${C.brown}10`,
              border: `2px solid ${C.brown}70`,
              cursor: 'pointer',
              fontFamily: "'Inter',sans-serif",
            }}
          >
            <span style={{ fontSize: '20px' }}>🔗</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: C.brown }}>URL / Texte</span>
          </button>
        </div>
        {showRecipeTextInput && (
          <div style={{ marginTop: '12px' }}>
            <textarea
              placeholder={
                "Colle une URL (Marmiton, YouTube, Instagram...)\nou le texte d'une recette directement"
              }
              value={recipeTextInput}
              onChange={(e) => setRecipeTextInput(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: '80px',
                background: C.bgInset,
                border: `1.5px solid ${C.border}`,
                borderRadius: '10px',
                padding: '10px 13px',
                color: C.text,
                fontSize: '13px',
                fontFamily: "'Inter',sans-serif",
                outline: 'none',
                resize: 'vertical',
              }}
            />
            <div style={{ marginTop: '8px' }}>
              <Btn
                onClick={() => {
                  analyzeRecipeText(recipeTextInput)
                  setRecipeTextInput('')
                }}
                disabled={!recipeTextInput.trim()}
              >
                🔍 Analyser
              </Btn>
            </div>
          </div>
        )}
      </Card>
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
                fontFamily: "'Inter',sans-serif",
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
        <div style={{ marginBottom: '12px' }}>
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
            Ingrédients manquants tolérés
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { id: 'strict', label: '🔒 Strict', desc: "Que ce que j'ai" },
              { id: 'un', label: '+1', desc: 'Un achat possible' },
              { id: 'deux', label: '+2-3', desc: 'Petite course' },
              { id: 'libre', label: '🌐 Libre', desc: 'Peu importe' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTolerance(t.id)}
                style={{
                  flex: 1,
                  padding: '6px 4px',
                  borderRadius: '10px',
                  fontSize: '10px',
                  fontWeight: 700,
                  border: tolerance === t.id ? `1.5px solid ${C.green}` : `1px solid ${C.border}`,
                  background: tolerance === t.id ? `${C.green}15` : C.bgInset,
                  color: tolerance === t.id ? C.green : C.textLight,
                  cursor: 'pointer',
                  fontFamily: "'Inter',sans-serif",
                  textAlign: 'center',
                }}
              >
                <div>{t.label}</div>
                <div
                  style={{
                    fontSize: '9px',
                    fontWeight: 400,
                    marginTop: '2px',
                    color: tolerance === t.id ? C.green : C.textLight,
                  }}
                >
                  {t.desc}
                </div>
              </button>
            ))}
          </div>
        </div>
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
                  fontFamily: "'Inter',sans-serif",
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
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          {recipeLoading ? (
            <ChefHat size={16} />
          ) : (
            <Sparkles size={16} />
          )}
          {recipeLoading ? 'Le chef réfléchit...' : "Qu'est-ce qu'on s'fait à soir ?"}
        </span>
      </Btn>

      {recipeLoading && (
        <Card style={{ textAlign: 'center', padding: '32px 14px', marginTop: '14px' }}>
          <div style={{ fontSize: '30px', marginBottom: '8px' }}>🍳</div>
          <div style={{ color: C.textLight, fontSize: '13px' }}>Génération en cours...</div>
        </Card>
      )}

      {/* Anchor pour le scroll auto */}
      <div ref={recipeResultRef} />

      {/* Phase 3 de l'onboarding — rend explicite le lien avec ce qui
          vient d'être importé, plutôt qu'une recette qui apparaît sans
          contexte. Masqué si la génération a échoué (id 'err') : la carte
          d'erreur normale parle déjà d'elle-même, pas besoin d'un
          bandeau "voilà ce que tu peux cuisiner" à côté d'une erreur. */}
      {onboardingMode && recipeResult && recipeResult[0]?.id !== 'err' && (
        <div
          style={{
            textAlign: 'center',
            padding: '14px',
            marginBottom: '14px',
            borderRadius: '14px',
            background: `${C.green}12`,
            border: `1px solid ${C.green}40`,
          }}
        >
          <div style={{ fontSize: '22px', marginBottom: '4px' }}>🎉</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: C.green }}>
            Voilà ce que tu peux cuisiner avec ce que tu viens d'importer
          </div>
        </div>
      )}

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
                        fontFamily: "'Fraunces',serif",
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
                          fontFamily: "'Fraunces',serif",
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
                    <button
                      onClick={() => saveRecipe(recipe)}
                      style={{
                        padding: '7px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 700,
                        border: `1.5px solid ${C.borderDark}`,
                        background: isRecipeSaved(recipe.nom) ? `${C.brown}20` : 'transparent',
                        color: isRecipeSaved(recipe.nom) ? C.brown : C.textLight,
                        cursor: 'pointer',
                        fontFamily: "'Fraunces',serif",
                      }}
                    >
                      {isRecipeSaved(recipe.nom) ? '🔖 Sauvegardée' : '🔖 Sauvegarder'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
    </div>
  )

  // ── Shopping Tab ───────────────────────────────────────────────
  // NOTE : l'estimation de prix utilise désormais getPriceEstimate()
  // (défini plus haut) qui interroge l'historique réel des prix avant
  // de retomber sur PRICE_FALLBACK_BY_CATEGORY (constante top-level).

  const renderCourses = () => {
    const activeLists = JSON.parse(sessionStorage.getItem('lgm_active_lists') || '[]')
    const setActiveLists = (v) =>
      sessionStorage.setItem(
        'lgm_active_lists',
        JSON.stringify(typeof v === 'function' ? v(activeLists) : v)
      )

    // Consolide recettes + panier manuel — séparé alimentaire / maison
    const consolidatedFood = {}
    const consolidatedNonFood = {}

    const addToConsolidated = (bucket, key, nom, quantite, listTitre, category) => {
      if (!bucket[key]) {
        const priceInfo = getPriceEstimate(nom, null, category)
        bucket[key] = { nom, quantites: [], source: 'liste', priceInfo }
      }
      bucket[key].quantites.push({ quantite, listTitre })
    }

    // Items des listes recettes sélectionnées — toujours alimentaire
    shoppingLists
      .filter((l) => activeLists.includes(l.id))
      .forEach((list) => {
        list.categories?.forEach((cat) => {
          cat.items.forEach((item) => {
            const key = item.nom.toLowerCase().trim()
            addToConsolidated(consolidatedFood, key, item.nom, item.quantite, list.titre, 'Autre')
          })
        })
      })

    // Items du panier manuel — répartis selon isFood
    manualCart.forEach((item) => {
      const key = item.nom.toLowerCase().trim()
      const bucket = item.isFood === false ? consolidatedNonFood : consolidatedFood
      const category = item.isFood === false ? 'Autre maison' : 'Autre'
      if (!bucket[key]) {
        const priceInfo = getPriceEstimate(item.nom, null, category)
        bucket[key] = { nom: item.nom, quantites: [], source: 'manuel', priceInfo }
      }
      bucket[key].quantites.push({
        quantite: `${item.quantity} ${item.unit}`,
        listTitre: 'Panier',
      })
    })

    const consolidatedFoodList = Object.values(consolidatedFood)
    const consolidatedNonFoodList = Object.values(consolidatedNonFood)
    const consolidatedList = [...consolidatedFoodList, ...consolidatedNonFoodList]

    const totalEstimatedFood = consolidatedFoodList.reduce(
      (sum, i) => sum + (i.priceInfo?.estimated || 0),
      0
    )
    const totalEstimatedNonFood = consolidatedNonFoodList.reduce(
      (sum, i) => sum + (i.priceInfo?.estimated || 0),
      0
    )

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
                      fontFamily: "'Inter',sans-serif",
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

        {/* Vue consolidée — Alimentaire */}
        {consolidatedFoodList.length > 0 && (
          <Card>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}
            >
              <SectionLabel style={{ marginBottom: 0 }}>🥦 Courses alimentaires</SectionLabel>
              <div style={{ flex: 1 }} />
              <span
                style={{ fontSize: '11px', fontWeight: 700, color: C.green, whiteSpace: 'nowrap' }}
              >
                ~{totalEstimatedFood.toFixed(2)}€
              </span>
            </div>

            {consolidatedFoodList.map((item, i) => {
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
                      i < consolidatedFoodList.length - 1 ? `1px solid ${C.border}` : 'none',
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
                  {item.priceInfo && (
                    <span
                      style={{
                        fontSize: '11px',
                        color: item.priceInfo.confidence === 'high' ? C.green : C.textLight,
                        fontWeight: 600,
                        fontStyle: item.priceInfo.confidence === 'low' ? 'italic' : 'normal',
                      }}
                      title={
                        item.priceInfo.confidence === 'low'
                          ? 'Estimation approximative — pas de prix enregistré'
                          : 'Prix basé sur historique'
                      }
                    >
                      ~{item.priceInfo.estimated.toFixed(2)}€
                    </span>
                  )}
                </div>
              )
            })}
          </Card>
        )}

        {/* Vue consolidée — Maison */}
        {consolidatedNonFoodList.length > 0 && (
          <Card>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}
            >
              <SectionLabel style={{ marginBottom: 0 }}>🧴 Courses maison</SectionLabel>
              <div style={{ flex: 1 }} />
              <span
                style={{ fontSize: '11px', fontWeight: 700, color: C.terra, whiteSpace: 'nowrap' }}
              >
                ~{totalEstimatedNonFood.toFixed(2)}€
              </span>
            </div>

            {consolidatedNonFoodList.map((item, i) => {
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
                      i < consolidatedNonFoodList.length - 1 ? `1px solid ${C.border}` : 'none',
                    cursor: 'pointer',
                    opacity: done ? 0.45 : 1,
                  }}
                >
                  <div
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '6px',
                      border: `2px solid ${done ? C.terra : C.border}`,
                      background: done ? C.terra : 'transparent',
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
                  </div>
                  {item.priceInfo && (
                    <span
                      style={{
                        fontSize: '11px',
                        color: item.priceInfo.confidence === 'high' ? C.green : C.textLight,
                        fontWeight: 600,
                        fontStyle: item.priceInfo.confidence === 'low' ? 'italic' : 'normal',
                      }}
                      title={
                        item.priceInfo.confidence === 'low'
                          ? 'Estimation approximative — pas de prix enregistré'
                          : 'Prix basé sur historique'
                      }
                    >
                      ~{item.priceInfo.estimated.toFixed(2)}€
                    </span>
                  )}
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
              fontFamily: "'Fraunces',serif",
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
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700;900&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { display:none; }
        input[type=date]::-webkit-calendar-picker-indicator { filter: opacity(0.4); }
      `}</style>

      {/* Header */}
      <div style={st.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src='/app/logo_kesoir.png'
              alt='Kësoir'
              style={{ width: '56px', height: '56px', objectFit: 'contain', borderRadius: '10px' }}
            />
            <div style={st.title}>Kësoir</div>
          </div>

          {/* Une seule ligne : les 2 boutons empilés (colonne) prenaient
              autant de hauteur que le titre+sous-titre, ce qui forçait le
              sous-titre à se replier sur 2 lignes faute de place. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <a
              href='/roadmap'
              target='_blank'
              rel='noopener noreferrer'
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 700,
                color: C.textLight,
                textDecoration: 'none',
                padding: '6px 10px',
                borderRadius: '999px',
                border: `1px solid ${C.border}`,
                background: C.bgInset,
                whiteSpace: 'nowrap',
              }}
            >
              <Map size={12} /> Roadmap
            </a>

            {!authLoading &&
              (isAuthenticated ? (
                <button
                  onClick={logout}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: C.green,
                    padding: '6px 10px',
                    borderRadius: '999px',
                    border: `1px solid ${C.green}50`,
                    background: `${C.green}12`,
                    cursor: 'pointer',
                    fontFamily: "'Inter',sans-serif",
                    whiteSpace: 'nowrap',
                  }}
                  title={user?.email}
                >
                  <Check size={12} /> {user?.displayName?.split(' ')[0] || 'Connecté'}
                </button>
              ) : (
                <button
                  onClick={login}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: C.brown,
                    padding: '6px 10px',
                    borderRadius: '999px',
                    border: `1px solid ${C.brown}50`,
                    background: `${C.brown}12`,
                    cursor: 'pointer',
                    fontFamily: "'Inter',sans-serif",
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Lock size={12} /> Se connecter
                </button>
              ))}
          </div>
        </div>

        {/* Sous-titre sur toute la largeur du header plutôt que coincé à
            côté du logo — une seule ligne au lieu de 2. */}
        <div style={st.sub}>
          {ingredients.length} ingr. · {equipment.length} équip. · {users.length} convive
          {users.length !== 1 ? 's' : ''} · <em>On mange quoi ce soir ?</em>
        </div>
      </div>

      {/* Tabs */}
      <div style={st.tabs}>
        {[
          { id: 'frigo', label: 'Frigo', Icon: Refrigerator },
          { id: 'equipement', label: 'Équip.', Icon: ChefHat },
          { id: 'recettes', label: 'Recettes', Icon: Sparkles },
          { id: 'courses', label: 'Courses', Icon: ShoppingCart },
        ].map((t) => (
          <button key={t.id} style={st.tab(tab === t.id)} onClick={() => setTab(t.id)}>
            <t.Icon size={18} strokeWidth={tab === t.id ? 2.25 : 1.75} />
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

      {/* Confirmation après scan code-barres */}
      {showBarcodeConfirm && pendingBarcodeProduct && (
        <div
          style={st.ratingPanel}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowBarcodeConfirm(false)
              setPendingBarcodeProduct(null)
            }
          }}
        >
          <div style={{ ...st.ratingSheet, maxHeight: '85vh', overflowY: 'auto' }}>
            <div
              style={{
                fontFamily: "'Fraunces',serif",
                fontSize: '18px',
                fontWeight: 700,
                color: pendingBarcodeProduct.notFound ? C.terra : C.green,
                marginBottom: '4px',
              }}
            >
              {pendingBarcodeProduct.source === 'ticket'
                ? '✏️ Saisir cet article'
                : pendingBarcodeProduct.notFound
                  ? '❓ Produit non trouvé'
                  : '✅ Article trouvé'}
            </div>
            <div style={{ fontSize: '12px', color: C.textMid, marginBottom: '10px' }}>
              {pendingBarcodeProduct.source === 'ticket'
                ? 'Le texte du ticket est repris comme point de départ — modifie-le librement.'
                : pendingBarcodeProduct.notFound
                  ? `Code-barres ${pendingBarcodeProduct.barcode} inconnu sur Open Food Facts — renseigne-le manuellement.`
                  : 'Vérifie et corrige si besoin avant de l’ajouter au frigo.'}
            </div>

            {pendingBarcodeProduct.ticketRawText && (
              <div
                style={{
                  fontSize: '11px',
                  color: C.textLight,
                  fontFamily: 'monospace',
                  background: C.bgInset,
                  padding: '6px 10px',
                  borderRadius: '8px',
                  marginBottom: '14px',
                }}
              >
                Texte du ticket : {pendingBarcodeProduct.ticketRawText}
              </div>
            )}

            {pendingBarcodeProduct.image && (
              <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                <img
                  src={pendingBarcodeProduct.image}
                  alt=''
                  style={{
                    maxHeight: '90px',
                    borderRadius: '10px',
                    border: `1px solid ${C.border}`,
                  }}
                />
              </div>
            )}

            <SectionLabel>Nom du produit</SectionLabel>
            <div style={{ marginBottom: '10px' }}>
              <Input
                placeholder="Nom de l'ingrédient"
                value={pendingBarcodeProduct.name}
                onChange={(v) => setPendingBarcodeProduct((p) => ({ ...p, name: v }))}
              />
            </div>

            {pendingBarcodeProduct.brand && (
              <div style={{ fontSize: '11px', color: C.textLight, marginBottom: '10px' }}>
                Marque détectée : {pendingBarcodeProduct.brand}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <div style={{ flex: 2 }}>
                <Input
                  placeholder='Quantité'
                  value={pendingBarcodeProduct.quantity}
                  onChange={(v) => setPendingBarcodeProduct((p) => ({ ...p, quantity: v }))}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Select
                  value={pendingBarcodeProduct.unit}
                  onChange={(v) => setPendingBarcodeProduct((p) => ({ ...p, unit: v }))}
                >
                  {UNITS.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <Select
                value={pendingBarcodeProduct.category}
                onChange={(v) => setPendingBarcodeProduct((p) => ({ ...p, category: v }))}
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <Select
                value={pendingBarcodeProduct.storage}
                onChange={(v) => setPendingBarcodeProduct((p) => ({ ...p, storage: v }))}
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
                value={pendingBarcodeProduct.dlc}
                onChange={(v) => setPendingBarcodeProduct((p) => ({ ...p, dlc: v }))}
              />
            </div>

            <div style={{ fontSize: '11px', color: C.textLight, marginBottom: '4px' }}>
              {pendingBarcodeProduct.source === 'ticket'
                ? 'Prix payé (détecté sur le ticket — vérifie-le)'
                : 'Prix payé (optionnel — Open Food Facts ne le fournit pas)'}
            </div>
            <div style={{ marginBottom: '14px' }}>
              <Input
                placeholder='ex: 2.50'
                value={pendingBarcodeProduct.price || ''}
                onChange={(v) =>
                  setPendingBarcodeProduct((p) => ({ ...p, price: v.replace(',', '.') }))
                }
              />
              {pendingBarcodeProduct.source === 'ticket' && (
                <div style={{ fontSize: '10px', color: C.textLight, marginTop: '4px' }}>
                  ⚠️ Si ce produit fait partie d'un lot ou d'une promo, corrige le prix pour qu'il
                  reflète un seul article — sinon l'estimation des courses sera faussée.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Btn
                variant='outline'
                onClick={() => {
                  setShowBarcodeConfirm(false)
                  setPendingBarcodeProduct(null)
                }}
              >
                Annuler
              </Btn>
              <div style={{ flex: 1, minWidth: '140px' }}>
                <Btn
                  variant='green'
                  onClick={() => confirmBarcodeProduct(false)}
                  disabled={!pendingBarcodeProduct.name?.trim()}
                >
                  ✓ Ajouter au frigo
                </Btn>
              </div>
              {pendingBarcodeProduct.source === 'barcode' && (
                <div style={{ flex: 1, minWidth: '140px' }}>
                  <Btn
                    variant='primary'
                    onClick={() => confirmBarcodeProduct(true)}
                    disabled={!pendingBarcodeProduct.name?.trim()}
                  >
                    ✓ + scanner le suivant
                  </Btn>
                </div>
              )}
            </div>
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
                    fontFamily: "'Fraunces',serif",
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
                      fontFamily: "'Fraunces',serif",
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
                                <span style={{ fontWeight: 700, fontSize: '13px', color: C.text }}>
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
                fontFamily: "'Fraunces',serif",
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
                      fontFamily: "'Fraunces',serif",
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
                fontFamily: "'Fraunces',serif",
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
