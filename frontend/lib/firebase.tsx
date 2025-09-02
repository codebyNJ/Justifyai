// <CHANGE> add Firebase singleton for Auth + Firestore</CHANGE>
"use client"

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app"
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, type User } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getAnalytics, isSupported } from "firebase/analytics"

const firebaseConfig = {
  apiKey: "AIzaSyBx2T8qVZ-UaNqGNAlAf2DJCrdmGDhJCZM",
  authDomain: "justifyai-d7c4f.firebaseapp.com",
  projectId: "justifyai-d7c4f",
  storageBucket: "justifyai-d7c4f.firebasestorage.app",
  messagingSenderId: "787205620567",
  appId: "1:787205620567:web:998ffd5bef13cd9c96f412",
  measurementId: "G-DJ7EEDBTPM",
}

let app: FirebaseApp
if (!getApps().length) {
  app = initializeApp(firebaseConfig)
  isSupported().then((ok) => {
    if (ok) {
      try {
        getAnalytics(app)
      } catch {}
    }
  })
} else {
  app = getApp()
}

export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()

export function listenAuth(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb)
}

export async function signInWithGoogle() {
  return await signInWithPopup(auth, googleProvider)
}

export async function signOutGoogle() {
  return await signOut(auth)
}