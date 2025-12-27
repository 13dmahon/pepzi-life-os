'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

// ============================================================
// NAVIGATION CONTEXT - To hide nav from modals
// ============================================================

interface NavigationContextType {
  isNavHidden: boolean;
  hideNav: () => void;
  showNav: () => void;
}

const NavigationContext = createContext<NavigationContextType>({
  isNavHidden: false,
  hideNav: () => {},
  showNav: () => {},
});

export function useNavigation() {
  return useContext(NavigationContext);
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [isNavHidden, setIsNavHidden] = useState(false);

  return (
    <NavigationContext.Provider
      value={{
        isNavHidden,
        hideNav: () => setIsNavHidden(true),
        showNav: () => setIsNavHidden(false),
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}