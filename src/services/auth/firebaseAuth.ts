import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as fbSignOut, 
  updateProfile
} from 'firebase/auth';
import type { User as FbUser } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import type { AuthService, UserProfile } from './types';

export class FirebaseAuthService implements AuthService {
  private getAuthInstance() {
    if (!auth) {
      throw new Error('Firebase Auth is not initialized. Please verify your .env configurations.');
    }
    return auth;
  }

  private mapUser(user: FbUser | null): UserProfile | null {
    if (!user) return null;
    return {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'User',
      photoURL: user.photoURL || undefined,
    };
  }

  async signUp(email: string, password: string, displayName: string): Promise<UserProfile> {
    const authInstance = this.getAuthInstance();
    const userCredential = await createUserWithEmailAndPassword(authInstance, email, password);
    const user = userCredential.user;
    
    // Set the displayName
    await updateProfile(user, { displayName });
    
    return this.mapUser(user)!;
  }

  async signIn(email: string, password: string): Promise<UserProfile> {
    const authInstance = this.getAuthInstance();
    const userCredential = await signInWithEmailAndPassword(authInstance, email, password);
    return this.mapUser(userCredential.user)!;
  }

  async signOut(): Promise<void> {
    const authInstance = this.getAuthInstance();
    await fbSignOut(authInstance);
  }

  onAuthStateChanged(callback: (user: UserProfile | null) => void): () => void {
    try {
      const authInstance = this.getAuthInstance();
      return authInstance.onAuthStateChanged((fbUser) => {
        callback(this.mapUser(fbUser));
      });
    } catch (error) {
      // If Firebase is not configured, we don't crash, we just call callback with null
      callback(null);
      return () => {};
    }
  }
}
