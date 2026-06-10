import type { AuthService } from './auth/types';
import type { DatabaseService } from './db/types';
import { LocalAuthService } from './auth/localAuth';
import { LocalDatabaseService } from './db/localDb';
import { FirebaseAuthService } from './auth/firebaseAuth';
import { FirebaseDatabaseService } from './db/firebaseDb';

const provider = import.meta.env.VITE_BACKEND_PROVIDER || 'local';

let authService: AuthService;
let databaseService: DatabaseService;

console.log(`Splitsy is running with backend provider: ${provider}`);

if (provider === 'firebase') {
  authService = new FirebaseAuthService();
  databaseService = new FirebaseDatabaseService();
} else {
  // Default to local mock backend
  authService = new LocalAuthService();
  databaseService = new LocalDatabaseService();
}

export { authService, databaseService };
export * from './auth/types';
export * from './db/types';
