import React, { createContext, useContext, useMemo, useState, useEffect } from "react";

let globalOnline = true;

export function getIsOnline(): boolean {
  return globalOnline;
}

type NetworkCtx = { isOnline: boolean };

const NetworkContext = createContext<NetworkCtx>({ isOnline: true });

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    globalOnline = true;
    setIsOnline(true);
    return () => {
      globalOnline = true;
    };
  }, []);

  const value = useMemo(() => {
    globalOnline = isOnline;
    return { isOnline };
  }, [isOnline]);

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork(): NetworkCtx {
  return useContext(NetworkContext);
}
