import React, { useMemo, useEffect, useState, useRef } from "react";
import { GoogleMap, LoadScript, Polygon, Autocomplete } from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "500px"
};

const center = {
  lat: 37.7749,
  lng: -122.4194
};



// Azure API and map center

// Default center
const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };

function getAzureMapsKey() {
  return process.env.REACT_APP_AZURE_MAPS_KEY;
}

function getGoogleMapsKey() {
  return process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
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


const polygonOptionsA = {
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
const polygonOptionsB = {
  fillColor: "#0000FF",
  fillOpacity: 0.35,
  strokeColor: "#0000FF",
  strokeOpacity: 0.8,
  strokeWeight: 2,
  clickable: false,
  draggable: false,
  editable: false,
  geodesic: false,
  zIndex: 1
};



function MapWithIsochrones() {
  const [locationA, setLocationA] = useState(null);
  const [locationB, setLocationB] = useState(null);
  const [isochroneA, setIsochroneA] = useState(null);
  const [isochroneB, setIsochroneB] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [travelTime, setTravelTime] = useState(null);
  const autocompleteA = useRef(null);
  const autocompleteB = useRef(null);

  // Handle place selection
  const onPlaceChangedA = () => {
    const place = autocompleteA.current.getPlace();
    if (place && place.geometry && place.geometry.location) {
      setLocationA({
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        name: place.formatted_address || place.name
      });
    }
  };
  const onPlaceChangedB = () => {
    const place = autocompleteB.current.getPlace();
    if (place && place.geometry && place.geometry.location) {
      setLocationB({
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        name: place.formatted_address || place.name
      });
    }
  };

  // Get travel time between A and B using Google Maps DirectionsService
  useEffect(() => {
    if (!locationA || !locationB) return;
    setLoading(true);
    setError(null);
    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route(
      {
        origin: { lat: locationA.lat, lng: locationA.lng },
        destination: { lat: locationB.lat, lng: locationB.lng },
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === "OK" && result.routes && result.routes[0] && result.routes[0].legs && result.routes[0].legs[0]) {
          setTravelTime(result.routes[0].legs[0].duration.value); // in seconds
        } else {
          setError("Could not get travel time between cities");
        }
        setLoading(false);
      }
    );
  }, [locationA, locationB]);

  // Fetch isochrones for both cities
  useEffect(() => {
    async function fetchIsochrones() {
      if (!locationA || !locationB || !travelTime) return;
      setLoading(true);
      setError(null);
      const subscriptionKey = getAzureMapsKey();
      if (!subscriptionKey) {
        setError("Azure Maps subscription key missing");
        setLoading(false);
        return;
      }
      // Time budget: slightly more than half the travel time
      const timeBudget = Math.ceil(travelTime / 2 + 300); // +5 min buffer
      const urlA = `https://atlas.microsoft.com/route/range/json?subscription-key=${subscriptionKey}&api-version=1.0&query=${locationA.lat},${locationA.lng}&timeBudgetInSec=${timeBudget}`;
      const urlB = `https://atlas.microsoft.com/route/range/json?subscription-key=${subscriptionKey}&api-version=1.0&query=${locationB.lat},${locationB.lng}&timeBudgetInSec=${timeBudget}`;
      try {
        const [respA, respB] = await Promise.all([fetch(urlA), fetch(urlB)]);
        const [jsonA, jsonB] = await Promise.all([respA.json(), respB.json()]);
        function toGeoJson(json) {
          if (json.reachableRange && json.reachableRange.boundary) {
            const polygonCoordinates = json.reachableRange.boundary.map(point => [point.longitude, point.latitude]);
            if (polygonCoordinates.length > 0) {
              const first = polygonCoordinates[0];
              const last = polygonCoordinates[polygonCoordinates.length - 1];
              if (first[0] !== last[0] || first[1] !== last[1]) {
                polygonCoordinates.push(first);
              }
            }
            return {
              type: "FeatureCollection",
              features: [{
                type: "Feature",
                geometry: { type: "Polygon", coordinates: [polygonCoordinates] },
                properties: {}
              }]
            };
          }
          return null;
        }
        setIsochroneA(toGeoJson(jsonA));
        setIsochroneB(toGeoJson(jsonB));
      } catch (err) {
        setError("Error fetching isochrones: " + err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchIsochrones();
  }, [locationA, locationB, travelTime]);

  const polygonPathA = useMemo(() => geoJsonToGooglePolygonCoords(isochroneA), [isochroneA]);
  const polygonPathB = useMemo(() => geoJsonToGooglePolygonCoords(isochroneB), [isochroneB]);

  return (
    <LoadScript googleMapsApiKey={getGoogleMapsKey()} libraries={["places"]}>
      <div style={{ position: "absolute", zIndex: 200, background: "#fff", padding: 10, left: 10, top: 10, borderRadius: 8, boxShadow: "0 2px 8px #0002" }}>
        <div>
          <label>City A: </label>
          <Autocomplete onLoad={ac => (autocompleteA.current = ac)} onPlaceChanged={onPlaceChangedA}>
            <input type="text" placeholder="Enter city A" style={{ width: 220, marginBottom: 8 }} />
          </Autocomplete>
        </div>
        <div>
          <label>City B: </label>
          <Autocomplete onLoad={ac => (autocompleteB.current = ac)} onPlaceChanged={onPlaceChangedB}>
            <input type="text" placeholder="Enter city B" style={{ width: 220 }} />
          </Autocomplete>
        </div>
        {travelTime && (
          <div style={{ marginTop: 8 }}>
            Travel time: {Math.round(travelTime / 60)} min
          </div>
        )}
      </div>
      <GoogleMap mapContainerStyle={containerStyle} center={locationA || locationB || DEFAULT_CENTER} zoom={8}>
        {loading && <div style={{position:'absolute',zIndex:100,background:'#fff',padding:'10px'}}>Loading...</div>}
        {error && <div style={{position:'absolute',zIndex:100,background:'#fff',padding:'10px',color:'red'}}>Error: {error}</div>}
        {polygonPathA.length > 0 && <Polygon paths={polygonPathA} options={polygonOptionsA} />}
        {polygonPathB.length > 0 && <Polygon paths={polygonPathB} options={polygonOptionsB} />}
      </GoogleMap>
    </LoadScript>
  );
}

export default MapWithIsochrones;
