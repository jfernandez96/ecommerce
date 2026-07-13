'use client';

import React, { createContext, useContext } from 'react';
import { useStoreConfig } from './use-store-config';

interface StoreContextType {
  storeName: string;
  isLoading: boolean;
  error: Error | null;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading, error } = useStoreConfig();

  const value: StoreContextType = {
    storeName: data?.storeName || data?.companyBusinessName || '',
    isLoading,
    error: error as Error | null,
  };

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return context;
}
