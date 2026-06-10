import type { AuthService, UserProfile } from './types';

const USER_KEY = 'splitsy_current_user';
const USERS_LIST_KEY = 'splitsy_users';

interface LocalUserRecord extends UserProfile {
  passwordHash: string;
}

export class LocalAuthService implements AuthService {
  private listeners: ((user: UserProfile | null) => void)[] = [];

  constructor() {
    // Listen for storage changes in case of multi-tab sync
    window.addEventListener('storage', (e) => {
      if (e.key === USER_KEY) {
        const user = this.getCurrentUserSync();
        this.notify(user);
      }
    });
  }

  private getCurrentUserSync(): UserProfile | null {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  }

  private notify(user: UserProfile | null) {
    this.listeners.forEach((cb) => cb(user));
  }

  private getUsersList(): LocalUserRecord[] {
    const data = localStorage.getItem(USERS_LIST_KEY);
    return data ? JSON.parse(data) : [];
  }

  async checkUsernameAvailable(username: string): Promise<boolean> {
    const users = this.getUsersList();
    return !users.some((u) => u.username?.toLowerCase() === username.toLowerCase());
  }

  async getUserByUsername(username: string): Promise<UserProfile | null> {
    const users = this.getUsersList();
    const found = users.find((u) => u.username?.toLowerCase() === username.toLowerCase());
    if (!found) return null;
    const { passwordHash, ...profile } = found;
    return profile;
  }

  async signUp(email: string, password: string, displayName: string, username?: string): Promise<UserProfile> {
    // Small delay to simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 600));

    const users = this.getUsersList();

    const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      throw new Error('Email already exists');
    }

    if (username) {
      const lowerUsername = username.toLowerCase();
      const taken = users.some((u) => u.username?.toLowerCase() === lowerUsername);
      if (taken) {
        throw new Error(`Username "@${username}" is already taken. Please choose another.`);
      }
    }

    const newUser: LocalUserRecord = {
      uid: 'local_' + Math.random().toString(36).substr(2, 9),
      email: email.toLowerCase(),
      displayName,
      username: username ? username.toLowerCase() : undefined,
      passwordHash: btoa(password), // Simple encoding for local mock
    };

    users.push(newUser);
    localStorage.setItem(USERS_LIST_KEY, JSON.stringify(users));

    const { passwordHash, ...profile } = newUser;
    localStorage.setItem(USER_KEY, JSON.stringify(profile));
    this.notify(profile);

    return profile;
  }

  async signIn(email: string, password: string): Promise<UserProfile> {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const users = this.getUsersList();

    const user = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === btoa(password)
    );

    if (!user) {
      throw new Error('Invalid email or password');
    }

    const { passwordHash, ...profile } = user;
    localStorage.setItem(USER_KEY, JSON.stringify(profile));
    this.notify(profile);

    return profile;
  }

  async signOut(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    localStorage.removeItem(USER_KEY);
    this.notify(null);
  }

  onAuthStateChanged(callback: (user: UserProfile | null) => void): () => void {
    this.listeners.push(callback);
    // Call immediately with current value
    const currentUser = this.getCurrentUserSync();
    callback(currentUser);

    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }
}
