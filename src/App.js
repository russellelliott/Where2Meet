import React, { useMemo, useEffect, useState } from "react";
import { GoogleMap, LoadScript, Polygon } from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "500px"
};

const center = {
  lat: 37.7749,
  lng: -122.4194
};



// Azure API and map center
const AZURE_CENTER = { lat: 37.7749, lng: -122.4194 }; // same as Google map center
const AZURE_QUERY = `${AZURE_CENTER.lat},${AZURE_CENTER.lng}`;
const AZURE_TIME_BUDGET = 1800; // 30 min

function getAzureMapsKey() {
  return process.env.REACT_APP_AZURE_MAPS_KEY;
}

function geoJsonToGooglePolygonCoords(geoJson) {
  if (
    !geoJson ||
    !geoJson.features ||
    !geoJson.features[0] ||
    !geoJson.features[0].geometry ||
    !geoJson.features[0].geometry.coordinates
  ) {
    return [];
  }
  return geoJson.features[0].geometry.coordinates[0].map(([lng, lat]) => ({ lat, lng }));
}

const polygonOptions = {
  fillColor: "#FF0000",
  fillOpacity: 0.35,
  strokeColor: "#FF0000",
  strokeOpacity: 0.8,
  strokeWeight: 2,
  clickable: false,
  draggable: false,
  editable: false,
  geodesic: false,
  zIndex: 1
};



function MapWithPolygon() {
  const [isochroneGeoJson, setIsochroneGeoJson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchIsochrone() {
      setLoading(true);
      setError(null);
      const subscriptionKey = getAzureMapsKey();
      if (!subscriptionKey) {
        setError("Azure Maps subscription key missing");
        setLoading(false);
        return;
      }
      const url = `https://atlas.microsoft.com/route/range/json?subscription-key=${subscriptionKey}&api-version=1.0&query=${AZURE_QUERY}&timeBudgetInSec=${AZURE_TIME_BUDGET}`;
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Azure API error: ${response.status} ${response.statusText}`);
        }
        const json = await response.json();
        if (json.reachableRange && json.reachableRange.boundary) {
          // Convert boundary to GeoJSON
          const polygonCoordinates = json.reachableRange.boundary.map(point => [point.longitude, point.latitude]);
          // Ensure closed loop
          if (polygonCoordinates.length > 0) {
            const first = polygonCoordinates[0];
            const last = polygonCoordinates[polygonCoordinates.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
              polygonCoordinates.push(first);
            }
          }
          const isochroneFeature = {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [polygonCoordinates],
            },
            properties: {},
          };
          setIsochroneGeoJson({ type: "FeatureCollection", features: [isochroneFeature] });
        } else {
          setError("No isochrone data in Azure response");
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchIsochrone();
  }, []);

  const polygonPath = useMemo(() => {
    const coords = geoJsonToGooglePolygonCoords(isochroneGeoJson);
    if (coords.length > 0) return coords;
    // fallback to a default polygon if needed
    return [
      { lat: 37.782, lng: -122.447 },
      { lat: 37.782, lng: -122.443 },
      { lat: 37.778, lng: -122.443 },
      { lat: 37.778, lng: -122.447 }
    ];
  }, [isochroneGeoJson]);

  return (
    <LoadScript googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}>
      <GoogleMap mapContainerStyle={containerStyle} center={AZURE_CENTER} zoom={10}>
        {loading && <div style={{position:'absolute',zIndex:100,background:'#fff',padding:'10px'}}>Loading isochrone...</div>}
        {error && <div style={{position:'absolute',zIndex:100,background:'#fff',padding:'10px',color:'red'}}>Error: {error}</div>}
        <Polygon paths={polygonPath} options={polygonOptions} />
      </GoogleMap>
    </LoadScript>
  );
}

export default MapWithPolygon;
