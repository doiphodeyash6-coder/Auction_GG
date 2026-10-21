import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { api } from '../lib/api';

const AuctionContext = createContext(null);
const initialState = { auctions: [], loading: true, error: '' };

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD': return { ...state, loading: true, error: '' };
    case 'LOADED': return { auctions: action.auctions, loading: false, error: '' };
    case 'ERROR': return { ...state, loading: false, error: action.error };
    case 'UPSERT': {
      const exists = state.auctions.some((auction) => auction._id === action.auction._id);
      const auctions = exists
        ? state.auctions.map((auction) => auction._id === action.auction._id ? action.auction : auction)
        : [action.auction, ...state.auctions];
      return { ...state, auctions };
    }
    default: return state;
  }
}

export function AuctionProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const refresh = useCallback(async () => {
    dispatch({ type: 'LOAD' });
    try {
      const { auctions } = await api('/auctions');
      dispatch({ type: 'LOADED', auctions });
    } catch (error) {
      dispatch({ type: 'ERROR', error: error.message });
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  const updateAuction = useCallback((auction) => { if (auction?._id) dispatch({ type: 'UPSERT', auction }); }, []);
  const value = useMemo(() => ({ ...state, refresh, updateAuction }), [state, refresh, updateAuction]);
  return <AuctionContext.Provider value={value}>{children}</AuctionContext.Provider>;
}

export function useAuctions() {
  const context = useContext(AuctionContext);
  if (!context) throw new Error('useAuctions must be used within AuctionProvider.');
  return context;
}
