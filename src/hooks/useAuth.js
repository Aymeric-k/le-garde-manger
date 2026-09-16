import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider } from '../config/firebase'

/**
 * Hook d'authentification Google — remplace le mode 100% local par
 * un vrai compte, ce qui permet de synchroniser les données entre
 * appareils (téléphone + PC) au lieu d'être coincé dans un seul
 * localStorage.
 */
export function useAuth() {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setIsLoading(false)
    })
    return unsubscribe
  }, [])

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (error) {
      console.error('Erreur de connexion Google:', error)
    }
  }

  const logout = async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error('Erreur de déconnexion:', error)
    }
  }

  return { user, isLoading, isAuthenticated: !!user, login, logout }
}
