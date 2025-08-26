import React, { useState, useEffect } from 'react';
import { auth, database } from '../firebaseConfig';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';

function MyMaps() {
  const [loading, setLoading] = useState(true);
  const [ownedMaps, setOwnedMaps] = useState([]);
  const [collaborativeMaps, setCollaborativeMaps] = useState([]);
  const user = auth.currentUser;

  useEffect(() => {
    const fetchMaps = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Fetch maps owned by the user
        const ownedMapsRef = query(
          ref(database, 'maps'),
          orderByChild('owner'),
          equalTo(user.uid)
        );
        const ownedSnapshot = await get(ownedMapsRef);
        const ownedMapsData = [];
        ownedSnapshot.forEach((child) => {
          ownedMapsData.push({
            id: child.key,
            ...child.val()
          });
        });
        setOwnedMaps(ownedMapsData);

        // Fetch maps where user is a collaborator
        const allMapsRef = ref(database, 'maps');
        const allMapsSnapshot = await get(allMapsRef);
        const collaborativeMapsData = [];
        
        allMapsSnapshot.forEach((child) => {
          const mapData = child.val();
          if (
            mapData.collaborators &&
            mapData.collaborators[user.uid] &&
            mapData.collaborators[user.uid].status === 'accepted'
          ) {
            collaborativeMapsData.push({
              id: child.key,
              ...mapData
            });
          }
        });
        setCollaborativeMaps(collaborativeMapsData);

      } catch (error) {
        console.error('Error fetching maps:', error);
        toast.error('Failed to load maps. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchMaps();
  }, [user]);

  if (!user) {
    return (
      <div style={styles.container}>
        <h2>My Maps</h2>
        <p>Please sign in to view your maps.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <h2>My Maps</h2>
        <p>Loading maps...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2>My Maps</h2>
      
      <div style={styles.section}>
        <h3>Maps I Own</h3>
        {ownedMaps.length === 0 ? (
          <p>You haven't created any maps yet.</p>
        ) : (
          <div style={styles.mapGrid}>
            {ownedMaps.map(map => (
              <Link to={`/map/${map.id}`} key={map.id} style={styles.mapCard}>
                <h4>{map.name}</h4>
                <p>Created {new Date(map.createdAt).toLocaleDateString()}</p>
                <p>{Object.keys(map.markers || {}).length} places marked</p>
                <p>{Object.keys(map.collaborators || {}).length} collaborators</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div style={styles.section}>
        <h3>Maps I'm Collaborating On</h3>
        {collaborativeMaps.length === 0 ? (
          <p>You're not collaborating on any maps yet.</p>
        ) : (
          <div style={styles.mapGrid}>
            {collaborativeMaps.map(map => (
              <Link to={`/map/${map.id}`} key={map.id} style={styles.mapCard}>
                <h4>{map.name}</h4>
                <p>Owner: {map.ownerEmail}</p>
                <p>{Object.keys(map.markers || {}).length} places marked</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto'
  },
  section: {
    marginBottom: '40px'
  },
  mapGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '20px',
    marginTop: '20px'
  },
  mapCard: {
    padding: '20px',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    textDecoration: 'none',
    color: 'inherit',
    backgroundColor: 'white',
    transition: 'transform 0.2s, box-shadow 0.2s',
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
    }
  }
};

export default MyMaps;
