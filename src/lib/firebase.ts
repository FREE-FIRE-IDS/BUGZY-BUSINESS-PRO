
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Ensure authDomain is correct (project-id.firebaseapp.com)
// This matches the requirement for Google Sign-In to work correctly on custom domains like Vercel
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

// Force account selection to avoid "This page is invalid" when stuck in a bad session
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

/**
 * Handle Google Sign-In using a Popup
 * Note: signInWithPopup is preferred over redirect in this environment
 */
export const signInWithGoogle = async () => {
  try {
    // Set persistence to local to ensure session survives refreshes
    await setPersistence(auth, browserLocalPersistence);
    
    // Trigger the popup
    const result = await signInWithPopup(auth, googleProvider);
    
    // The signed-in user info
    const user = result.user;
    
    if (!user) {
      throw new Error("No user data returned from Google");
    }

    return user;
  } catch (error: any) {
    // Handle specific Firebase Auth errors
    console.error("Firebase Auth Error:", error.code, error.message);
    
    if (error.code === 'auth/popup-blocked') {
      alert("Please allow popups for this site to sign in with Google.");
    } else if (error.code === 'auth/operation-not-allowed') {
      console.error("Google Sign-In is not enabled in the Firebase Console.");
    } else if (error.code === 'auth/unauthorized-domain') {
      console.error("This domain is not authorized in the Firebase Console.");
    }
    
    throw error;
  }
};

export const logOut = () => signOut(auth);
