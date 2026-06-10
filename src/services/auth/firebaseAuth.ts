import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as fbSignOut, 
  updateProfile
} from 'firebase/auth';
import type { User as FbUser } from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import type { AuthService, UserProfile } from './types';

export class FirebaseAuthService implements AuthService {
  private getAuthInstance() {
    if (!auth) {
      throw new Error('Firebase Auth is not initialized. Please verify your .env configurations.');
    }
    return auth;
  }

  private getDbInstance() {
    if (!db) {
      throw new Error('Firestore is not initialized. Please verify your .env configurations.');
    }
    return db;
  }

  private async mapUser(user: FbUser | null): Promise<UserProfile | null> {
    if (!user) return null;

    // Try to fetch username from Firestore
    let username: string | undefined;
    try {
      const dbInstance = this.getDbInstance();
      const userDocRef = doc(dbInstance, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        username = userDoc.data().username as string | undefined;
      }
    } catch {
      // Non-critical: if Firestore fetch fails, username is just undefined
    }

    return {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'User',
      username,
      photoURL: user.photoURL || undefined,
    };
  }

  private mapUserSync(user: FbUser | null): UserProfile | null {
    if (!user) return null;
    return {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'User',
      photoURL: user.photoURL || undefined,
    };
  }

  async checkUsernameAvailable(username: string): Promise<boolean> {
    const dbInstance = this.getDbInstance();
    const usernameDocRef = doc(dbInstance, 'usernames', username.toLowerCase());
    const snap = await getDoc(usernameDocRef);
    return !snap.exists();
  }

  async getUserByUsername(username: string): Promise<UserProfile | null> {
    const dbInstance = this.getDbInstance();
    const q = query(
      collection(dbInstance, 'users'),
      where('username', '==', username.toLowerCase())
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const data = snap.docs[0].data();
    return {
      uid: data.uid as string,
      email: data.email as string,
      displayName: data.displayName as string,
      username: data.username as string,
    };
  }

  async signUp(email: string, password: string, displayName: string, username?: string): Promise<UserProfile> {
    const authInstance = this.getAuthInstance();
    const dbInstance = this.getDbInstance();

    // Check username uniqueness before creating account
    if (username) {
      const lowerUsername = username.toLowerCase();
      const available = await this.checkUsernameAvailable(lowerUsername);
      if (!available) {
        throw new Error(`Username "@${username}" is already taken. Please choose another.`);
      }
    }

    const userCredential = await createUserWithEmailAndPassword(authInstance, email, password);
    const user = userCredential.user;

    // Set the displayName on Firebase Auth profile
    await updateProfile(user, { displayName });

    const lowerUsername = username ? username.toLowerCase() : undefined;

    // Write user profile doc to Firestore
    const userDocRef = doc(dbInstance, 'users', user.uid);
    await setDoc(userDocRef, {
      uid: user.uid,
      email: email.toLowerCase(),
      displayName,
      username: lowerUsername ?? null,
      createdAt: Date.now(),
    });

    // Reserve the username in a separate uniqueness collection
    if (lowerUsername) {
      const usernameDocRef = doc(dbInstance, 'usernames', lowerUsername);
      await setDoc(usernameDocRef, { uid: user.uid });
    }

    return {
      uid: user.uid,
      email: email,
      displayName,
      username: lowerUsername,
    };
  }

  async signIn(email: string, password: string): Promise<UserProfile> {
    const authInstance = this.getAuthInstance();
    const userCredential = await signInWithEmailAndPassword(authInstance, email, password);
    // Fetch full profile including username from Firestore
    return (await this.mapUser(userCredential.user)) ?? this.mapUserSync(userCredential.user)!;
  }

  async signOut(): Promise<void> {
    const authInstance = this.getAuthInstance();
    await fbSignOut(authInstance);
  }

  onAuthStateChanged(callback: (user: UserProfile | null) => void): () => void {
    try {
      const authInstance = this.getAuthInstance();
      return authInstance.onAuthStateChanged(async (fbUser) => {
        if (fbUser) {
          // Fetch full profile with username asynchronously
          const profile = await this.mapUser(fbUser);
          callback(profile);
        } else {
          callback(null);
        }
      });
    } catch (error) {
      callback(null);
      return () => {};
    }
  }
}
