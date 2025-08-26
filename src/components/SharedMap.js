

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { auth, database } from "../firebaseConfig";
import { ref, set, onValue, get } from "firebase/database";
import { GoogleMap, LoadScript, Marker, InfoWindow, Autocomplete } from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "700px"
};
const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };
function getGoogleMapsKey() {
  return process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
}

function SharedMap() {
  const { mapId } = useParams();
  const [markers, setMarkers] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("pending");
  const [ownerName, setOwnerName] = useState("");
  const autocompleteRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    // Check if user is already a collaborator or has accepted/declined
    const collabRef = ref(database, `sharedMaps/${mapId}/collaborators/${user.uid}`);
    get(collabRef).then((snap) => {
      if (snap.exists()) {
        setStatus(snap.val().status);
      }
      setLoading(false);
    });
    // Optionally fetch owner's name
    get(ref(database, `users/${mapId}/profile`)).then((snap) => {
      if (snap.exists()) setOwnerName(snap.val().displayName || "");
    });
  }, [user, mapId]);

  useEffect(() => {
    if (status !== "accepted") return;
    // Listen to markers from owner's map
    const markersRef = ref(database, `users/${mapId}/markers`);
    const unsub = onValue(markersRef, (snap) => {
      const data = snap.val();
      if (data) {
        setMarkers(Object.entries(data).map(([id, marker]) => ({ ...marker, id })));
      } else {
        setMarkers([]);
      }
    });
    return () => unsub();
  }, [status, mapId]);

  // Add marker by clicking map
  const onMapClick = React.useCallback(async (event) => {
    if (status !== "accepted") return;
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    // Geocode for address
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, async (results, statusCode) => {
      let newMarker;
      const markerId = Date.now();
      if (statusCode === "OK" && results && results.length > 0) {
        const place = results[0];
        newMarker = {
          position: { lat, lng },
          name: place.formatted_address || "Dropped Pin",
          address: place.formatted_address || "",
          types: place.types || [],
          placeId: place.place_id,
          notes: "",
          createdAt: markerId
        };
      } else {
        newMarker = {
          position: { lat, lng },
          name: "Dropped Pin",
          address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          types: [],
          placeId: null,
          notes: "",
          createdAt: markerId
        };
      }
      try {
        const newMarkerRef = ref(database, `users/${mapId}/markers/${markerId}`);
        await set(newMarkerRef, newMarker);
        setSelectedMarker({ ...newMarker, id: markerId });
      } catch (error) {
        alert("Error saving marker. Try again.");
      }
    });
  }, [status, mapId]);

  // Add marker by search
  const onPlaceChanged = async () => {
    if (status !== "accepted") return;
    const place = autocompleteRef.current.getPlace();
    if (place && place.geometry && place.geometry.location) {
      const newMarker = {
        position: {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        },
        name: place.name || place.formatted_address || "Unknown Location",
        address: place.formatted_address || "",
        types: place.types || [],
        placeId: place.place_id,
        notes: "",
        createdAt: Date.now()
      };
      try {
        const newMarkerRef = ref(database, `users/${mapId}/markers/${Date.now()}`);
        await set(newMarkerRef, newMarker);
        setSelectedMarker({ ...newMarker, id: newMarkerRef.key });
      } catch (error) {
        alert("Error saving marker. Try again.");
      }
    }
  };

  const handleAccept = async () => {
    if (!user) return;
    await set(ref(database, `sharedMaps/${mapId}/collaborators/${user.uid}`), {
      email: user.email,
      status: "accepted",
      acceptedAt: Date.now(),
    });
    setStatus("accepted");
  };

  const handleDecline = async () => {
    if (!user) return;
    await set(ref(database, `sharedMaps/${mapId}/collaborators/${user.uid}`), {
      email: user.email,
      status: "declined",
      declinedAt: Date.now(),
    });
    setStatus("declined");
  };

  if (!user) return <div style={{ padding: 40 }}>Please sign in to view this shared map.</div>;
  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;

  return (
    <LoadScript googleMapsApiKey={getGoogleMapsKey()} libraries={["places"]}>
      <div style={{ position: "absolute", zIndex: 200, background: "#fff", padding: 15, left: 10, top: 70, borderRadius: 8, boxShadow: "0 2px 8px #0002", maxWidth: 350 }}>
        <h3 style={{ margin: "0 0 10px 0", fontSize: "16px" }}>Shared Map {ownerName && `from ${ownerName}`}</h3>
        {status === "pending" && (
          <div>
            <p>You have been invited to collaborate on this map.</p>
            <button onClick={handleAccept} style={{ marginRight: 10 }}>Accept</button>
            <button onClick={handleDecline}>Decline</button>
          </div>
        )}
        {status === "declined" && <div>You declined the invitation.</div>}
        {status === "accepted" && (
          <>
            <div style={{ marginBottom: 10 }}>
              <Autocomplete onLoad={ac => (autocompleteRef.current = ac)} onPlaceChanged={onPlaceChanged}>
                <input
                  type="text"
                  placeholder="Search for a place..."
                  style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px", boxSizing: "border-box" }}
                />
              </Autocomplete>
            </div>
            <div style={{ fontSize: "12px", color: "#666", marginBottom: 10 }}>
              Click anywhere on the map to drop a pin
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: '12px', border: markers.length > 0 ? "1px solid #eee" : "none", borderRadius: "4px" }}>
              {markers.map((marker) => (
                <div
                  key={marker.id}
                  style={{ margin: '4px 0', cursor: 'pointer', padding: '6px', backgroundColor: selectedMarker?.id === marker.id ? '#e0e0e0' : 'transparent', borderRadius: "3px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  onClick={() => {
                    setSelectedMarker(selectedMarker?.id === marker.id ? null : marker);
                    setMapCenter(marker.position);
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "bold" }}>{marker.name}</div>
                    <div style={{ color: "#666" }}>{marker.address}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={mapCenter}
        zoom={10}
        onClick={status === "accepted" ? onMapClick : undefined}
        onLoad={map => (mapRef.current = map)}
      >
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={marker.position}
            onClick={() => setSelectedMarker(selectedMarker?.id === marker.id ? null : marker)}
          />
        ))}
        {selectedMarker && (
          <InfoWindow
            position={selectedMarker.position}
            onCloseClick={() => setSelectedMarker(null)}
          >
            <div style={{ maxWidth: 250 }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>{selectedMarker.name}</h4>
              <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666' }}>{selectedMarker.address}</p>
              <div style={{ fontSize: '10px', color: '#999', marginBottom: '8px' }}>
                Position: {selectedMarker.position.lat.toFixed(6)}, {selectedMarker.position.lng.toFixed(6)}
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </LoadScript>
  );
}

export default SharedMap;
