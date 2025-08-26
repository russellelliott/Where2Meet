import React from 'react';
import { LoadScript } from "@react-google-maps/api";

export const GoogleMapsContext = React.createContext(null);

function getGoogleMapsKey() {
  return process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
}

export function GoogleMapsProvider({ children }) {
  return (
    <LoadScript googleMapsApiKey={getGoogleMapsKey()} libraries={["places"]}>
      <GoogleMapsContext.Provider value={true}>
        {children}
      </GoogleMapsContext.Provider>
    </LoadScript>
  );
}
