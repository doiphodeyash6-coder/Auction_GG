import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    const user = JSON.parse(localStorage.getItem('gavel-user') || 'null');
    return user && typeof user.id === 'string' && typeof user.role === 'string' ? user : null;
  } catch {
    return null;
  }
}

const initialState = { user: readStoredUser(), token: localStorage.getItem('gavel-token'), loading: true };

function reducer(state, action) {
  switch (action.type) {
    case 'SESSION': return { user: action.user, token: action.token, loading: false };
    case 'USER': return { ...state, user: action.user, loading: false };
    case 'CLEAR': return { user: null, token: null, loading: false };
    case 'LOADED': return { ...state, loading: false };
    default: return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    let active = true;
    if (!state.token) { dispatch({ type: 'LOADED' }); return () => { active = false; }; }
    api('/auth/me', { token: state.token })
      .then(({ user }) => {
        localStorage.setItem('gavel-user', JSON.stringify(user));
        if (active) dispatch({ type: 'USER', user });
      })
      .catch((error) => {
        if (error.status === 401) {
          localStorage.removeItem('gavel-token');
          localStorage.removeItem('gavel-user');
          if (active) dispatch({ type: 'CLEAR' });
        } else if (active) dispatch({ type: 'LOADED' });
      });
    return () => { active = false; };
  }, []);

  const value = useMemo(() => ({
    ...state,
    async login(credentials) {
      const result = await api('/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
      localStorage.setItem('gavel-token', result.token);
      localStorage.setItem('gavel-user', JSON.stringify(result.user));
      dispatch({ type: 'SESSION', user: result.user, token: result.token });
      return result.user;
    },
    async register(details) {
      const result = await api('/auth/register', { method: 'POST', body: JSON.stringify(details) });
      localStorage.setItem('gavel-token', result.token);
      localStorage.setItem('gavel-user', JSON.stringify(result.user));
      dispatch({ type: 'SESSION', user: result.user, token: result.token });
      return result.user;
    },
    logout() {
      localStorage.removeItem('gavel-token');
      localStorage.removeItem('gavel-user');
      dispatch({ type: 'CLEAR' });
    },
  }), [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
