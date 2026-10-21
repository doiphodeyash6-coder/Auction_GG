import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);
const initialState = { user: null, token: localStorage.getItem('gavel-token'), loading: true };

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
      .then(({ user }) => { if (active) dispatch({ type: 'USER', user }); })
      .catch(() => { localStorage.removeItem('gavel-token'); if (active) dispatch({ type: 'CLEAR' }); });
    return () => { active = false; };
  }, []);

  const value = useMemo(() => ({
    ...state,
    async login(credentials) {
      const result = await api('/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
      localStorage.setItem('gavel-token', result.token);
      dispatch({ type: 'SESSION', user: result.user, token: result.token });
      return result.user;
    },
    async register(details) {
      const result = await api('/auth/register', { method: 'POST', body: JSON.stringify(details) });
      localStorage.setItem('gavel-token', result.token);
      dispatch({ type: 'SESSION', user: result.user, token: result.token });
      return result.user;
    },
    logout() { localStorage.removeItem('gavel-token'); dispatch({ type: 'CLEAR' }); },
  }), [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
