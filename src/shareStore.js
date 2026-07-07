const crypto = require('node:crypto');

const shares = new Map();
const SHARE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function cleanupExpiredShares() {
  const now = Date.now();

  for (const [id, share] of shares.entries()) {
    if (share.expiresAt <= now) {
      shares.delete(id);
    }
  }
}

function createShare({ code, language }) {
  cleanupExpiredShares();

  const id = crypto.randomBytes(9).toString('base64url');
  shares.set(id, {
    code,
    language,
    createdAt: Date.now(),
    expiresAt: Date.now() + SHARE_TTL_MS
  });

  return id;
}

function getShare(id) {
  cleanupExpiredShares();
  return shares.get(id) || null;
}

function publicBaseUrl() {
  return (process.env.PUBLIC_IDE_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '');
}

function makeEditorUrl(shareId) {
  const baseUrl = publicBaseUrl();

  if (!baseUrl) {
    return null;
  }

  return `${baseUrl}/s/${shareId}`;
}

module.exports = {
  createShare,
  getShare,
  makeEditorUrl
};
