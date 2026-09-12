// src/lib/qrSecurity.ts

// Un sel secret pour l'application.
const APP_SECRET_SALT = "EduMatrix_Secure_QR_2026_x!$";

/**
 * Calcule un checksum simple mais robuste pour une chaîne de caractères
 */
function calculateChecksum(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

export interface SecureQRData {
  id: string;
  chk: string;
  v: number; // version
}

/**
 * Génère une donnée sécurisée (Base64) à partir de l'ID de l'élève
 */
export function generateSecureQRData(eleveId: string): string {
  const checksum = calculateChecksum(`${eleveId}:${APP_SECRET_SALT}`);
  
  const payload: SecureQRData = {
    id: eleveId,
    chk: checksum,
    v: 1
  };
  
  // Convertit l'objet en chaîne JSON puis en Base64
  if (typeof btoa !== 'undefined') {
    return btoa(JSON.stringify(payload));
  } else {
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }
}

/**
 * Décode et vérifie une donnée scannée.
 * Retourne l'ID de l'élève si valide, sinon null.
 */
export function verifySecureQRData(scannedData: string): string | null {
  try {
    let jsonStr = '';
    
    if (typeof atob !== 'undefined') {
      jsonStr = atob(scannedData);
    } else {
      jsonStr = Buffer.from(scannedData, 'base64').toString('utf8');
    }
    
    const payload = JSON.parse(jsonStr) as SecureQRData;
    
    if (!payload.id || !payload.chk || payload.v !== 1) {
      return null;
    }
    
    const expectedChecksum = calculateChecksum(`${payload.id}:${APP_SECRET_SALT}`);
    
    if (payload.chk !== expectedChecksum) {
      return null;
    }
    
    return payload.id;
  } catch (error) {
    return null;
  }
}
