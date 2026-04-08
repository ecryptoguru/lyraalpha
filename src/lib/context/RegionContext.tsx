
"use client";

import React, { createContext, useContext, useState, useSyncExternalStore } from "react";
import Cookies from "js-cookie";

export type Region = "US" | "IN";

interface RegionContextType {
  region: Region;
  setRegion: (region: Region) => void;
  currency: string;      // '$' or '₹'
  marketName: string;    // 'US Market' or 'Indian Market'
  mounted: boolean;
}

const RegionContext = createContext<RegionContextType | undefined>(undefined);

export function RegionProvider({ 
  children, 
  initialRegion = "US" 
}: { 
  children: React.ReactNode;
  initialRegion?: Region;
}) {
  const [region, setRegionState] = useState<Region>(initialRegion);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const setRegion = (newRegion: Region) => {
    setRegionState(newRegion);
    // Set cookie for server-side reading (expires in 365 days)
    Cookies.set("user_region_preference", newRegion, { expires: 365, path: "/" });
  };

  const value = {
    region,
    setRegion,
    currency: region === "US" ? "$" : "₹",
    marketName: region === "US" ? "US Market" : "Indian Market",
    mounted,
  };

  return (
    <RegionContext.Provider value={value}>
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion() {
  const context = useContext(RegionContext);
  if (context === undefined) {
    throw new Error("useRegion must be used within a RegionProvider");
  }
  return context;
}
