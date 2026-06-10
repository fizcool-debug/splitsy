export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  username?: string;
  photoURL?: string;
}

export interface AuthService {
  signUp(email: string, password: string, displayName: string, username?: string): Promise<UserProfile>;
  signIn(email: string, password: string): Promise<UserProfile>;
  signOut(): Promise<void>;
  onAuthStateChanged(callback: (user: UserProfile | null) => void): () => void;
  getUserByUsername?(username: string): Promise<UserProfile | null>;
  checkUsernameAvailable?(username: string): Promise<boolean>;
}
