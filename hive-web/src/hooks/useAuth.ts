/**
 * `useAuth` — consume the AuthContext (MH-008).
 *
 * @throws when called outside <AuthProvider>.
 */
import { useAuthContext, type AuthContextValue } from '../contexts/auth-context';

export function useAuth(): AuthContextValue {
  return useAuthContext();
}
