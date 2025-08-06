import React, { useState, useRef, useCallback, useEffect } from "react";
import { GoogleMap, LoadScript, Marker, InfoWindow, Autocomplete } from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "700px"
};

const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };

function getGoogleMapsKey() {
  return process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
}

function PersonalMap() {
  const [markers, setMarkers] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [loading, setLoading] = useState(false);
  const autocompleteRef = useRef(null);
  const mapRef = useRef(null);

  // Get user's location on component mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setMapCenter(userLocation);
        },
        (error) => {
          console.warn('Error getting user location:', error);
          // Keep default location if geolocation fails
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    }
  }, []);

  // Handle place selection from autocomplete
  const onPlaceChanged = () => {
    const place = autocompleteRef.current.getPlace();
    if (place && place.geometry && place.geometry.location) {
      const newMarker = {
        id: Date.now(), // Simple ID generation
        position: {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        },
        name: place.name || place.formatted_address || "Unknown Location",
        address: place.formatted_address || "",
        types: place.types || [],
        placeId: place.place_id,
        source: "autocomplete"
      };
      
      setMarkers(prev => [...prev, newMarker]);
      setMapCenter(newMarker.position);
      
      // Clear the input
      const input = document.querySelector('input[placeholder="Search for a place..."]');
      if (input) input.value = '';
    }
  };

  // Handle map clicks to drop pins
  const onMapClick = useCallback(async (event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    
    setLoading(true);
    
    try {
      // Use Google Maps Geocoding API to get place information
      const geocoder = new window.google.maps.Geocoder();
      
      geocoder.geocode(
        { location: { lat, lng } },
        (results, status) => {
          if (status === "OK" && results && results.length > 0) {
            const place = results[0];
            const newMarker = {
              id: Date.now(),
              position: { lat, lng },
              name: place.formatted_address || "Dropped Pin",
              address: place.formatted_address || "",
              types: place.types || [],
              placeId: place.place_id,
              source: "dropped"
            };
            
            setMarkers(prev => [...prev, newMarker]);
            // Automatically select the newly created marker to show InfoWindow
            setSelectedMarker(newMarker);
          } else {
            // If geocoding fails, still create a marker with basic info
            const newMarker = {
              id: Date.now(),
              position: { lat, lng },
              name: "Dropped Pin",
              address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
              types: [],
              placeId: null,
              source: "dropped"
            };
            
            setMarkers(prev => [...prev, newMarker]);
            // Automatically select the newly created marker to show InfoWindow
            setSelectedMarker(newMarker);
          }
          setLoading(false);
        }
      );
    } catch (error) {
      console.error("Error geocoding location:", error);
      // Still create a basic marker
      const newMarker = {
        id: Date.now(),
        position: { lat, lng },
        name: "Dropped Pin",
        address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        types: [],
        placeId: null,
        source: "dropped"
      };
      
      setMarkers(prev => [...prev, newMarker]);
      // Automatically select the newly created marker to show InfoWindow
      setSelectedMarker(newMarker);
      setLoading(false);
    }
  }, []);

  // Remove a marker
  const removeMarker = (markerId) => {
    setMarkers(prev => prev.filter(marker => marker.id !== markerId));
    setSelectedMarker(null);
  };

  // Clear all markers
  const clearAllMarkers = () => {
    setMarkers([]);
    setSelectedMarker(null);
  };

  const onLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  return (
    <LoadScript googleMapsApiKey={getGoogleMapsKey()} libraries={["places"]}>
      <div style={{ 
        position: "absolute", 
        zIndex: 200, 
        background: "#fff", 
        padding: 15, 
        left: 10, 
        top: 70, 
        borderRadius: 8, 
        boxShadow: "0 2px 8px #0002", 
        maxWidth: 350 
      }}>
        <h3 style={{ margin: "0 0 10px 0", fontSize: "16px" }}>Personal Map</h3>
        <div style={{ marginBottom: 10 }}>
          <Autocomplete 
            onLoad={ac => (autocompleteRef.current = ac)} 
            onPlaceChanged={onPlaceChanged}
          >
            <input 
              type="text" 
              placeholder="Search for a place..." 
              style={{ 
                width: "100%", 
                padding: "8px", 
                border: "1px solid #ccc", 
                borderRadius: "4px",
                boxSizing: "border-box"
              }} 
            />
          </Autocomplete>
        </div>
        
        <div style={{ fontSize: "12px", color: "#666", marginBottom: 10 }}>
          Click anywhere on the map to drop a pin
        </div>
        
        <div style={{ marginBottom: 10 }}>
          <strong>Saved Places ({markers.length}):</strong>
          {markers.length > 0 && (
            <button 
              onClick={clearAllMarkers}
              style={{
                marginLeft: 10,
                padding: "2px 6px",
                fontSize: "10px",
                background: "#ff4444",
                color: "white",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer"
              }}
            >
              Clear All
            </button>
          )}
        </div>
        
        <div style={{ 
          maxHeight: 200, 
          overflowY: 'auto', 
          fontSize: '12px',
          border: markers.length > 0 ? "1px solid #eee" : "none",
          borderRadius: "4px"
        }}>
          {markers.map((marker) => (
            <div 
              key={marker.id} 
              style={{ 
                margin: '4px 0', 
                cursor: 'pointer', 
                padding: '6px', 
                backgroundColor: selectedMarker?.id === marker.id ? '#e0e0e0' : 'transparent',
                borderRadius: "3px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
              onClick={() => {
                setSelectedMarker(selectedMarker?.id === marker.id ? null : marker);
                setMapCenter(marker.position);
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "bold" }}>{marker.name}</div>
                <div style={{ color: "#666" }}>{marker.address}</div>
                <div style={{ color: "#999", fontSize: "10px" }}>
                  {marker.source === "autocomplete" ? "📍 Search" : "📌 Dropped"}
                </div>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  removeMarker(marker.id);
                }}
                style={{
                  padding: "2px 4px",
                  fontSize: "10px",
                  background: "#ff4444",
                  color: "white",
                  border: "none",
                  borderRadius: "2px",
                  cursor: "pointer"
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <GoogleMap 
        mapContainerStyle={containerStyle} 
        center={mapCenter} 
        zoom={10}
        onClick={onMapClick}
        onLoad={onLoad}
      >
        {loading && (
          <div style={{
            position:'absolute',
            zIndex:100,
            background:'#fff',
            padding:'10px',
            borderRadius: '4px',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}>
            Loading place information...
          </div>
        )}
        
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={marker.position}
            onClick={() => setSelectedMarker(selectedMarker?.id === marker.id ? null : marker)}
            icon={{
              url: marker.source === "autocomplete" 
                ? 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#4285f4"/>
                    </svg>
                  `)
                : 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#ea4335"/>
                    </svg>
                  `),
              scaledSize: new window.google.maps.Size(24, 24),
              anchor: new window.google.maps.Point(12, 24)
            }}
          />
        ))}

        {selectedMarker && (
          <InfoWindow
            position={selectedMarker.position}
            onCloseClick={() => setSelectedMarker(null)}
          >
            <div style={{ maxWidth: 200 }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>
                {selectedMarker.name}
              </h4>
              <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666' }}>
                {selectedMarker.address}
              </p>
              {selectedMarker.types && selectedMarker.types.length > 0 && (
                <div style={{ fontSize: '10px', color: '#999', marginBottom: '8px' }}>
                  Types: {selectedMarker.types.slice(0, 3).join(', ')}
                </div>
              )}
              <div style={{ fontSize: '10px', color: '#999', marginBottom: '8px' }}>
                {selectedMarker.source === "autocomplete" ? "Added via search" : "Dropped pin"}
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button 
                  onClick={() => {
                    const url = `https://www.google.com/maps?q=${selectedMarker.position.lat},${selectedMarker.position.lng}`;
                    window.open(url, '_blank');
                  }}
                  style={{
                    padding: "4px 8px",
                    fontSize: "10px",
                    background: "#4285f4",
                    color: "white",
                    border: "none",
                    borderRadius: "3px",
                    cursor: "pointer",
                    flex: 1
                  }}
                >
                  🗺️ Google Maps
                </button>
                <button 
                  onClick={() => removeMarker(selectedMarker.id)}
                  style={{
                    padding: "4px 8px",
                    fontSize: "10px",
                    background: "#ff4444",
                    color: "white",
                    border: "none",
                    borderRadius: "3px",
                    cursor: "pointer",
                    flex: 1
                  }}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </LoadScript>
  );
}

export default PersonalMap;
