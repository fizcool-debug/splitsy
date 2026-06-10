export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

export interface AuthService {
  signUp(email: string, password: string, displayName: string): Promise<UserProfile>;
  signIn(email: string, password: string): Promise<UserProfile>;
  signOut(): Promise<void>;
  onAuthStateChanged(callback: (user: UserProfile | null) => void): () => void;
}
