import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  fetchPositions,
  createPosition,
  updatePosition,
  closePosition,
  deletePosition,
} from '../services/positions';
import angelOneService from '../services/angelOne';

const PositionsContext = createContext(null);

const initialState = {
  positions: [],
  livePrices: {}, // { symbolToken: ltp }
  loading: true,
  error: null,
  filter: 'active', // 'active' | 'closed' | 'all'
  needsAction: false,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'SET_POSITIONS':
      return { ...state, positions: action.payload, loading: false, error: null };
    case 'ADD_POSITION':
      return { ...state, positions: [action.payload, ...state.positions] };
    case 'UPDATE_POSITION':
      return {
        ...state,
        positions: state.positions.map((p) =>
          p.id === action.payload.id ? { ...p, ...action.payload } : p
        ),
      };
    case 'REMOVE_POSITION':
      return {
        ...state,
        positions: state.positions.filter((p) => p.id !== action.payload),
      };
    case 'SET_LIVE_PRICE':
      return {
        ...state,
        livePrices: { ...state.livePrices, [action.payload.token]: action.payload.ltp },
      };
    case 'SET_LIVE_PRICES_BATCH':
      return { ...state, livePrices: { ...state.livePrices, ...action.payload } };
    case 'SET_FILTER':
      return { ...state, filter: action.payload };
    case 'TOGGLE_NEEDS_ACTION':
      return { ...state, needsAction: !state.needsAction };
    default:
      return state;
  }
}

export function PositionsProvider({ children }) {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load positions
  const loadPositions = useCallback(async () => {
    if (!user) return;
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const data = await fetchPositions(user.id);
      dispatch({ type: 'SET_POSITIONS', payload: data });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message });
    }
  }, [user]);

  useEffect(() => {
    if (user) loadPositions();
  }, [user, loadPositions]);

  // Poll live prices every 5 seconds (REST fallback)
  useEffect(() => {
    const activePositions = state.positions.filter((p) => p.status === 'active');
    if (!activePositions.length) return;

    const pollPrices = async () => {
      try {
        const symbols = activePositions.map((p) => ({
          exchange: p.exchange,
          symbolToken: p.symbol_token,
          tradingSymbol: p.trading_symbol,
        }));
        const prices = await angelOneService.batchLTP(symbols);
        dispatch({ type: 'SET_LIVE_PRICES_BATCH', payload: prices });
      } catch (err) {
        console.error('Price polling error:', err);
      }
    };

    pollPrices();
    const interval = setInterval(pollPrices, 5000);
    return () => clearInterval(interval);
  }, [state.positions]);

  // Actions
  const addPosition = async (positionData) => {
    const newPos = await createPosition(user.id, positionData);
    dispatch({ type: 'ADD_POSITION', payload: newPos });
    return newPos;
  };

  const editPosition = async (id, updates) => {
    const updated = await updatePosition(id, user.id, updates);
    dispatch({ type: 'UPDATE_POSITION', payload: updated });
    return updated;
  };

  const sellPosition = async (id, exitPrice) => {
    const closed = await closePosition(id, user.id, exitPrice);
    dispatch({ type: 'UPDATE_POSITION', payload: closed });
    return closed;
  };

  const removePosition = async (id) => {
    await deletePosition(id, user.id);
    dispatch({ type: 'REMOVE_POSITION', payload: id });
  };

  const getLivePrice = (symbolToken, fallback) => {
    return state.livePrices[symbolToken] ?? fallback;
  };

  const filteredPositions = state.positions.filter((p) => {
    if (state.filter === 'active') return p.status === 'active';
    if (state.filter === 'closed') return p.status === 'closed';
    return true;
  });

  // "Needs Action" = price near stop loss (within 5%)
  const positionsNeedingAction = filteredPositions.filter((p) => {
    const cmp = getLivePrice(p.symbol_token, p.entry_price);
    const distanceToSL = ((cmp - p.stop_loss) / cmp) * 100;
    return distanceToSL < 3 && p.status === 'active';
  });

  return (
    <PositionsContext.Provider
      value={{
        ...state,
        filteredPositions: state.needsAction ? positionsNeedingAction : filteredPositions,
        positionsNeedingAction,
        loadPositions,
        addPosition,
        editPosition,
        sellPosition,
        removePosition,
        getLivePrice,
        setFilter: (f) => dispatch({ type: 'SET_FILTER', payload: f }),
        toggleNeedsAction: () => dispatch({ type: 'TOGGLE_NEEDS_ACTION' }),
      }}
    >
      {children}
    </PositionsContext.Provider>
  );
}

export function usePositions() {
  const ctx = useContext(PositionsContext);
  if (!ctx) throw new Error('usePositions must be used within PositionsProvider');
  return ctx;
}
