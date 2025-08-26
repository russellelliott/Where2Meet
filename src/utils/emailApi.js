// Utility for calling the where2meet-server email API

const API_BASE = process.env.REACT_APP_EMAIL_API_BASE || 'http://localhost:3010/api/email';

export async function sendInviteEmail({ senderEmail, senderName, recipientEmail, mapId, mapName }) {
  const res = await fetch(`${API_BASE}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senderEmail, senderName, recipientEmail, mapId, mapName })
  });
  if (!res.ok) throw new Error('Failed to send invite email');
  return res.json();
}

export async function sendWelcomeEmail({ email, name }) {
  const res = await fetch(`${API_BASE}/welcome`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name })
  });
  if (!res.ok) throw new Error('Failed to send welcome email');
  return res.json();
}

export async function sendResponseEmail({ senderEmail, senderName, ownerEmail, mapName, response }) {
  const res = await fetch(`${API_BASE}/response`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senderEmail, senderName, ownerEmail, mapName, response })
  });
  if (!res.ok) throw new Error('Failed to send response email');
  return res.json();
}
