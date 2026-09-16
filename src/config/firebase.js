import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'

const firebaseConfig = {
  apiKey: 'AIzaSyDurF36_3MGiJ5lx2meLi8qGbu6KjICubQ',
  authDomain: 'kesoir.firebaseapp.com',
  projectId: 'kesoir',
  storageBucket: 'kesoir.firebasestorage.app',
  messagingSenderId: '172517745945',
  appId: '1:172517745945:web:91bba9a8907e9195c3d188',
  measurementId: 'G-F7JX6TC0QE',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()
// ⚠️ La région doit correspondre exactement à celle déclarée dans
// functions/index.js (region: 'europe-west1') — sinon le SDK appelle
// la mauvaise URL et la fonction ne répond jamais.
export const functions = getFunctions(app, 'europe-west1')
