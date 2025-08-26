import React, { useState, useRef, useCallback, useEffect } from "react";
import { sendInviteEmail } from "../utils/emailApi";
import { GoogleMap, Marker, InfoWindow, Autocomplete } from "@react-google-maps/api";
import { auth, db } from "../firebaseConfig";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, writeBatch } from 'firebase/firestore';
import MapInvitation from "./MapInvitation";
import { toast } from 'react-toastify';

const containerStyle = {
  width: "100%",
  height: "700px"
};

const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };

function getGoogleMapsKey() {
  return process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
}

function Map({ mapId }) {
  // Sharing state
  const [shareEmail, setShareEmail] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [markers, setMarkers] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [loading, setLoading] = useState(true);
  const [showInvitation, setShowInvitation] = useState(false);
  const [accessStatus, setAccessStatus] = useState(null);
  const [mapInfo, setMapInfo] = useState(null);
  const [userLocationLoaded, setUserLocationLoaded] = useState(false);
  const autocompleteRef = useRef(null);
  const mapRef = useRef(null);
  const user = auth.currentUser;

  // Get user's location - separate effect to run immediately
  useEffect(() => {
    const getUserLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            console.log('User location obtained:', userLocation);
            setMapCenter(userLocation);
            setUserLocationLoaded(true);
          },
          (error) => {
            console.warn('Error getting user location:', error);
            console.warn('Error code:', error.code, 'Message:', error.message);
            // Keep default location if geolocation fails
            setUserLocationLoaded(true);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
          }
        );
      } else {
        console.warn('Geolocation is not supported by this browser');
        setUserLocationLoaded(true);
      }
    };

    // Only get user location if we haven't already
    if (!userLocationLoaded) {
      getUserLocation();
    }
  }, [userLocationLoaded]);

  // Check user's access and load map data
  useEffect(() => {
    const checkAccess = async () => {
      if (!user || !mapId) {
        setLoading(false);
        return;
      }

      try {
        const mapDocRef = doc(db, 'maps', mapId);
        const snapshot = await getDoc(mapDocRef);
        
        if (!snapshot.exists()) {
          setLoading(false);
          return;
        }

        const mapData = snapshot.data();
        setMapInfo(mapData);
        const isOwner = mapData.owner === user.uid;
        const collaboratorStatus = mapData.collaborators?.[user.uid]?.status;

        if (isOwner) {
          setAccessStatus('owner');
        } else if (collaboratorStatus === 'accepted') {
          setAccessStatus('accepted');
        } else if (collaboratorStatus === 'declined') {
          setAccessStatus('declined');
        } else {
          setAccessStatus('pending');
          setShowInvitation(true);
        }
      } catch (error) {
        console.error('Error checking access:', error);
        setLoading(false);
      }
    };

    checkAccess();
  }, [user, mapId]);

  // Load markers from Firestore
  useEffect(() => {
    if (!mapId || !user) {
      setLoading(false);
      return;
    }

    const markersRef = collection(db, 'maps', mapId, 'markers');
    const unsubscribe = onSnapshot(markersRef, (snapshot) => {
      const markersArray = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));
      setMarkers(markersArray);
      setLoading(false);
    }, (error) => {
      console.error('Error loading markers:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [mapId, user]);

  // Set loading to false when user location is loaded and no mapId is provided
  useEffect(() => {
    if (!mapId && userLocationLoaded) {
      setLoading(false);
    }
  }, [mapId, userLocationLoaded]);

  // Handle place selection from autocomplete
  const onPlaceChanged = async () => {
    if (!auth.currentUser) {
      alert("Please sign in to save places");
      return;
    }

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
        const markersCollection = collection(db, 'maps', mapId, 'markers');
        const newMarkerRef = doc(markersCollection);
        await setDoc(newMarkerRef, newMarker);
        setMapCenter(newMarker.position);
        setSelectedMarker({ ...newMarker, id: newMarkerRef.id });
        
        // Clear the input
        const input = document.querySelector('input[placeholder="Search for a place..."]');
        if (input) input.value = '';
      } catch (error) {
        console.error("Error saving marker:", error);
        alert("Error saving location. Please try again.");
      }
    }
  };

  // Handle map clicks to drop pins
  const onMapClick = useCallback(async (event) => {
    if (!auth.currentUser) {
      alert("Please sign in to save places");
      return;
    }

    // If there's a selected marker, close it first without creating a new marker
    if (selectedMarker) {
      setSelectedMarker(null);
      return;
    }

    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    
    try {
      // Use Google Maps Geocoding API to get place information
      const geocoder = new window.google.maps.Geocoder();
      
      geocoder.geocode(
        { location: { lat, lng } },
        async (results, status) => {
          let newMarker;
          const markerId = Date.now();
          
          if (status === "OK" && results && results.length > 0) {
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
            const markersCollection = collection(db, 'maps', mapId, 'markers');
            const newMarkerRef = doc(markersCollection);
            await setDoc(newMarkerRef, newMarker);
            // Automatically select the newly created marker to show InfoWindow
            setSelectedMarker({ ...newMarker, id: newMarkerRef.id });
          } catch (error) {
            console.error("Error saving marker:", error);
            alert("Error saving location. Please try again.");
          }
          
        }
      );
    } catch (error) {
      console.error("Error geocoding location:", error);
      alert("Error creating marker. Please try again.");
    }
  }, [selectedMarker]);

  // Create a ref to store the timeout
  const updateTimeoutRef = useRef(null);

  // Update marker notes with debouncing
  const updateMarkerNotes = async (markerId, notes) => {
    if (!auth.currentUser) {
      alert("Please sign in to edit places");
      return;
    }

    // Immediately update the local state for smooth typing
    if (selectedMarker && selectedMarker.id === markerId) {
      setSelectedMarker(prev => ({ ...prev, notes }));
    }

    // Clear any existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Set a new timeout to update Firebase after 500ms of no typing
    updateTimeoutRef.current = setTimeout(async () => {
      try {
        const markerRef = doc(db, 'maps', mapId, 'markers', markerId);
        await updateDoc(markerRef, { notes });
      } catch (error) {
        console.error("Error updating marker notes:", error);
        alert("Error updating notes. Please try again.");
      }
    }, 500);
  };

  // Remove a marker
  const removeMarker = async (markerId) => {
    if (!auth.currentUser) {
      alert("Please sign in to remove places");
      return;
    }

    try {
      const markerRef = doc(db, 'maps', mapId, 'markers', markerId);
      await deleteDoc(markerRef);
      setSelectedMarker(null);
    } catch (error) {
      console.error("Error removing marker:", error);
      alert("Error removing location. Please try again.");
    }
  };

  // Clear all markers
  const clearAllMarkers = async () => {
    if (!auth.currentUser) {
      alert("Please sign in to clear places");
      return;
    }

    if (window.confirm("Are you sure you want to remove all saved places? This cannot be undone.")) {
      try {
        // Get all markers
        const markersCollection = collection(db, 'maps', mapId, 'markers');
        const markersSnapshot = await getDocs(markersCollection);
        
        // Create a batch operation
        const batch = writeBatch(db);
        markersSnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        
        // Commit the batch
        await batch.commit();
        setSelectedMarker(null);
      } catch (error) {
        console.error("Error clearing markers:", error);
        alert("Error clearing locations. Please try again.");
      }
    }
  };

  const onLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  // Share handler
  const handleShare = async () => {
    if (!auth.currentUser) {
      toast.error("Please sign in to share your map.");
      return;
    }
    if (!shareEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(shareEmail)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setShareLoading(true);
    try {
      if (!mapInfo) {
        throw new Error('Map information not loaded');
      }
      await sendInviteEmail({
        senderEmail: auth.currentUser.email,
        senderName: auth.currentUser.displayName || auth.currentUser.email,
        recipientEmail: shareEmail,
        mapId: mapId,
        mapName: mapInfo.name
      });
      toast.success("Invitation sent successfully!");
      setShareEmail("");
    } catch (e) {
      toast.error("Failed to send invite. Please try again later.");
    }
    setShareLoading(false);
  };

  // Add a function to recenter on user location
  const centerOnUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setMapCenter(userLocation);
          if (mapRef.current) {
            mapRef.current.panTo(userLocation);
            mapRef.current.setZoom(15);
          }
        },
        (error) => {
          console.warn('Error getting current location:', error);
          toast.error('Could not get your current location');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000 // 1 minute
        }
      );
    } else {
      toast.error('Geolocation is not supported by your browser');
    }
  };

  if (!user) {
    return <div>Please sign in to view and edit maps.</div>;
  }

  if (showInvitation) {
    return (
      <MapInvitation
        mapId={mapId}
        onResponse={(response) => {
          setShowInvitation(false);
          setAccessStatus(response);
        }}
      />
    );
  }

  if (accessStatus === 'declined') {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <p>You have declined this map invitation.</p>
        <button
          onClick={() => {
            setAccessStatus('pending');
            setShowInvitation(true);
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: '#4285f4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Accept Invitation
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        Loading map...
      </div>
    );
  }

  return (
    <div>
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
        {/* Share map UI */}
        {auth.currentUser && mapId && (
          <div style={{ marginBottom: 12, padding: 8, background: '#f6faff', borderRadius: 6, border: '1px solid #e0eaff' }}>
            <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>Share your map by email:</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="email"
                placeholder="Recipient's email"
                value={shareEmail}
                onChange={e => setShareEmail(e.target.value)}
                style={{ flex: 1, padding: 6, border: '1px solid #ccc', borderRadius: 4, fontSize: 13 }}
                disabled={shareLoading}
              />
              <button
                onClick={handleShare}
                disabled={shareLoading}
                style={{ padding: '6px 12px', background: '#4285f4', color: '#fff', border: 'none', borderRadius: 4, fontSize: 13, cursor: 'pointer' }}
              >
                {shareLoading ? 'Sending...' : 'Share'}
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ margin: "0", fontSize: "16px" }}>Personal Map</h3>
          <button
            onClick={centerOnUserLocation}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              background: '#4285f4',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Center map on your location"
          >
            📍 My Location
          </button>
        </div>

        {!auth.currentUser && (
          <div style={{ 
            padding: "10px", 
            marginBottom: "10px", 
            backgroundColor: "#f8f8f8", 
            borderRadius: "4px",
            color: "#666",
            fontSize: "14px"
          }}>
            Please sign in to save and view your places
          </div>
        )}
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
                {marker.notes && (
                  <div style={{ color: "#888", fontSize: "10px", fontStyle: "italic", marginTop: "2px" }}>
                    📝 {marker.notes.length > 50 ? marker.notes.substring(0, 50) + "..." : marker.notes}
                  </div>
                )}
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
        zoom={8}
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
          />
        ))}

        {selectedMarker && (
          <InfoWindow
            position={selectedMarker.position}
            onCloseClick={() => setSelectedMarker(null)}
          >
            <div style={{ maxWidth: 250 }}>
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
                Position: {selectedMarker.position.lat.toFixed(6)}, {selectedMarker.position.lng.toFixed(6)}
              </div>
              
              {/* Notes Section */}
              <div style={{ marginBottom: '8px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '4px' }}>
                  Personal Notes:
                </label>
                <textarea
                  value={selectedMarker.notes}
                  onChange={(e) => updateMarkerNotes(selectedMarker.id, e.target.value)}
                  placeholder="Add your notes about this place..."
                  style={{
                    width: '100%',
                    height: '50px',
                    fontSize: '11px',
                    padding: '4px',
                    border: '1px solid #ccc',
                    borderRadius: '3px',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
              
              <div style={{ display: 'flex', gap: '4px' }}>
                <button 
                  onClick={() => {
                    let url;
                    if (selectedMarker.placeId) {
                      // Use place ID for actual place page
                      url = `https://www.google.com/maps/place/?q=place_id:${selectedMarker.placeId}`;
                    } else {
                      // Fallback to coordinates for dropped pins without place ID
                      url = `https://www.google.com/maps?q=${selectedMarker.position.lat},${selectedMarker.position.lng}`;
                    }
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
    </div>
  );
}

export default Map;