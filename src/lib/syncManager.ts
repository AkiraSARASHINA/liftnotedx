import { addDBChangeListener } from './db';
import { 
  initGoogleAuth, 
  isLinked, 
  isAutoUploadEnabled, 
  uploadLocalDataToCloud,
  silentSignIn
} from './googleDriveSync';

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// Trigger upload with debounce to prevent excessive API calls
export const triggerAutoUpload = () => {
  if (!isLinked() || !isAutoUploadEnabled()) return;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  // Debounce for 2.5 seconds
  debounceTimer = setTimeout(async () => {
    try {
      await uploadLocalDataToCloud();
    } catch (e) {
      console.warn('Debounced auto-upload failed (possibly offline):', e);
    }
  }, 2500);
};

// Check and upload if there are unsynced changes
export const checkAndSyncPendingChanges = async () => {
  if (!isLinked()) return;

  const isUnsynced = localStorage.getItem('gdrive_unsynced') === 'true';
  if (isUnsynced && navigator.onLine) {
    try {
      // Refresh token first silently
      await silentSignIn();
      await uploadLocalDataToCloud();
    } catch (e) {
      console.error('Failed to sync pending changes:', e);
    }
  }
};

// Initialize listeners for visibility, online status, and db changes
export const initSyncManager = async () => {
  // 1. Initialize Google Identity Services
  try {
    await initGoogleAuth();
    if (isLinked() && navigator.onLine) {
      silentSignIn().catch(err => {
        console.warn('Initial silent sign-in failed:', err);
      });
    }
  } catch (e) {
    console.warn('Google Auth initialization skipped or failed:', e);
  }

  // 2. Listen to local DB changes
  addDBChangeListener(() => {
    triggerAutoUpload();
  });

  // 3. Listen to online status (retry sync when back online)
  window.addEventListener('online', () => {
    checkAndSyncPendingChanges();
  });

  // 4. Listen to visibility change (sync when app goes to background)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // If there is a pending debounced upload, run it immediately before hidden
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
        if (isLinked() && isAutoUploadEnabled() && navigator.onLine) {
          uploadLocalDataToCloud().catch(err => {
            console.error('Immediate sync on hide failed:', err);
          });
        }
      }
    }
  });

  // 5. Initial sync check on startup
  if (navigator.onLine) {
    checkAndSyncPendingChanges();
  }
};
