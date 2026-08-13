import { getAllWorkouts, saveWorkout, type Workout } from './db';

// Vite environment variable
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const BACKUP_FILE_NAME = 'liftnote_dx_backup.json';

interface SyncData {
  workouts: Workout[];
  updatedAt: string;
}

let tokenClient: any = null;
let accessToken: string | null = null;
let tokenExpiryTime: number = 0; // Epoch ms

// Subscriptions for sync status changes
type SyncStatus = 'unlinked' | 'linking' | 'linked' | 'syncing' | 'error';
type StatusListener = (status: SyncStatus, message?: string) => void;
const listeners = new Set<StatusListener>();

export const addStatusListener = (listener: StatusListener) => {
  listeners.add(listener);
  // Emit current state
  listener(getSyncStatus(), getStatusMessage());
  return () => {
    listeners.delete(listener);
  };
};

let currentStatus: SyncStatus = 'unlinked';
let currentMessage = '';

const setSyncStatus = (status: SyncStatus, message = '') => {
  currentStatus = status;
  currentMessage = message;
  listeners.forEach(l => l(status, message));
};

export const getSyncStatus = () => currentStatus;
export const getStatusMessage = () => currentMessage;

// Check if user has linked Google Drive before
export const isLinked = (): boolean => {
  return localStorage.getItem('gdrive_linked') === 'true';
};

// Get client ID configuration warning
export const hasClientId = (): boolean => {
  return !!CLIENT_ID;
};

let authInitPromise: Promise<void> | null = null;

// Initialize Google Identity Services
export const initGoogleAuth = (): Promise<void> => {
  if (authInitPromise) {
    return authInitPromise;
  }

  authInitPromise = new Promise((resolve, reject) => {
    if (!CLIENT_ID) {
      setSyncStatus('error', 'Google Client ID が設定されていません。');
      reject(new Error('Client ID missing'));
      return;
    }

    const checkAndInit = (attempts = 0) => {
      if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
        try {
          tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (tokenResponse: any) => {
              if (tokenResponse.error) {
                setSyncStatus('error', `認証エラー: ${tokenResponse.error_description || tokenResponse.error}`);
                reject(tokenResponse);
                return;
              }
              accessToken = tokenResponse.access_token;
              // Set expiry time (expires_in is in seconds, e.g. 3600)
              tokenExpiryTime = Date.now() + (parseInt(tokenResponse.expires_in, 10) * 1000);
              localStorage.setItem('gdrive_linked', 'true');
              setSyncStatus('linked', 'Google Driveと連携しました。');
              resolve();
            },
          });
          
          if (isLinked()) {
            setSyncStatus('linked');
          } else {
            setSyncStatus('unlinked');
          }
          resolve();
        } catch (err: any) {
          setSyncStatus('error', `初期化エラー: ${err.message}`);
          reject(err);
        }
      } else if (attempts < 20) { // 250ms * 20 = 5 seconds
        setTimeout(() => checkAndInit(attempts + 1), 250);
      } else {
        setSyncStatus('error', 'Google Identity Services SDK の読み込み待ちがタイムアウトしました。');
        reject(new Error('GIS SDK loading timed out'));
      }
    };

    checkAndInit();
  });

  return authInitPromise;
};

// Sign in / Link Google Drive (Shows popup if needed)
export const linkGoogleDrive = async (): Promise<void> => {
  if (!CLIENT_ID) {
    const msg = 'Google Client ID が設定されていません。.env ファイル等を確認してください。';
    setSyncStatus('error', msg);
    throw new Error(msg);
  }

  // If not initialized, try to initialize now
  if (!tokenClient) {
    try {
      await initGoogleAuth();
    } catch (err: any) {
      setSyncStatus('error', `初期化失敗: ${err.message}`);
      throw err;
    }
  }

  return new Promise((resolve, reject) => {
    setSyncStatus('linking', '認証ポップアップを開いています...');
    try {
      tokenClient.requestAccessToken();
      // The callback initialized in initGoogleAuth will resolve/reject and update status
      const checkStatus = setInterval(() => {
        if (currentStatus === 'linked') {
          clearInterval(checkStatus);
          resolve();
        } else if (currentStatus === 'error') {
          clearInterval(checkStatus);
          reject(new Error(currentMessage));
        }
      }, 500);
    } catch (err: any) {
      setSyncStatus('error', `サインインエラー: ${err.message}`);
      reject(err);
    }
  });
};

// Silent Sign In (Refresh token without popup)
export const silentSignIn = (): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    if (!tokenClient) {
      try {
        await initGoogleAuth();
      } catch (err: any) {
        reject(new Error(`初期化失敗: ${err.message}`));
        return;
      }
    }

    if (!tokenClient || !CLIENT_ID) {
      reject(new Error('Not initialized or client ID missing'));
      return;
    }

    // Reuse valid token
    if (accessToken && Date.now() < tokenExpiryTime - 60000) { // 1 min buffer
      resolve(accessToken as string);
      return;
    }

    try {
      tokenClient.callback = (tokenResponse: any) => {
        if (tokenResponse.error) {
          setSyncStatus('unlinked', '認証の有効期限が切れました。再連携してください。');
          localStorage.removeItem('gdrive_linked');
          reject(tokenResponse);
          return;
        }
        accessToken = tokenResponse.access_token;
        tokenExpiryTime = Date.now() + (parseInt(tokenResponse.expires_in, 10) * 1000);
        localStorage.setItem('gdrive_linked', 'true');
        setSyncStatus('linked');
        resolve(tokenResponse.access_token);
      };
      // prompt: '' enables silent token request
      tokenClient.requestAccessToken({ prompt: '' });
    } catch (err) {
      reject(err);
    }
  });
};

// Unlink Google Drive
export const unlinkGoogleDrive = () => {
  if (accessToken) {
    try {
      (window as any).google.accounts.oauth2.revoke(accessToken, () => {
        // Token revoked
      });
    } catch (e) {
      console.error('Failed to revoke token:', e);
    }
  }
  accessToken = null;
  tokenExpiryTime = 0;
  localStorage.removeItem('gdrive_linked');
  localStorage.removeItem('gdrive_last_sync');
  setSyncStatus('unlinked', 'Google Driveとの連携を解除しました。');
};

// Helper: Ensure valid token
const getValidToken = async (): Promise<string> => {
  if (!isLinked()) {
    throw new Error('Google Drive is not linked');
  }
  return await silentSignIn();
};

let activeAbortController: AbortController | null = null;

// Get/Set Auto-Upload setting
export const isAutoUploadEnabled = (): boolean => {
  return localStorage.getItem('gdrive_auto_upload') !== 'false';
};

export const setAutoUploadEnabled = (enabled: boolean) => {
  localStorage.setItem('gdrive_auto_upload', enabled ? 'true' : 'false');
};

// Cancel current synchronization
export const cancelCurrentSync = () => {
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
    setSyncStatus('linked', '同期がキャンセルされました。');
  }
};

// Fetch json backup file from Google Drive appDataFolder
interface GDriveFile {
  id: string;
  name: string;
}

const findBackupFile = async (token: string, signal?: AbortSignal): Promise<GDriveFile | null> => {
  const url = `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(BACKUP_FILE_NAME)}'&spaces=appDataFolder&fields=files(id,name)`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal
  });
  if (!res.ok) {
    throw new Error(`Failed to list files: ${res.statusText}`);
  }
  const data = await res.json();
  return data.files && data.files.length > 0 ? data.files[0] : null;
};

// Download sync data
export const downloadBackupData = async (signal?: AbortSignal): Promise<SyncData | null> => {
  const token = await getValidToken();
  const file = await findBackupFile(token, signal);
  if (!file) return null;

  const url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal
  });
  if (!res.ok) {
    throw new Error(`Failed to download backup: ${res.statusText}`);
  }
  return await res.json();
};

// Upload sync data
export const uploadBackupData = async (syncData: SyncData, signal?: AbortSignal): Promise<void> => {
  const token = await getValidToken();
  const file = await findBackupFile(token, signal);

  const metadata = {
    name: BACKUP_FILE_NAME,
    parents: ['appDataFolder']
  };

  const boundary = '3d9f1024-81b2-498b-90f7-11fd1024d293';
  const delimiter = `\n--${boundary}\n`;
  const closeDelimiter = `\n--${boundary}--\n`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\n\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json; charset=UTF-8\n\n' +
    JSON.stringify(syncData) +
    closeDelimiter;

  let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  let method = 'POST';

  if (file) {
    // Update existing file
    url = `https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=multipart`;
    method = 'PATCH';
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody,
    signal
  });

  if (!res.ok) {
    throw new Error(`Failed to upload backup: ${res.statusText}`);
  }
};

// Generate overall updatedAt from workouts
export const getLocalSyncData = async (): Promise<SyncData> => {
  const workouts = await getAllWorkouts();
  // Find latest updatedAt
  let latestTime = new Date(0).toISOString();
  workouts.forEach(w => {
    if (w.updatedAt && w.updatedAt > latestTime) {
      latestTime = w.updatedAt;
    }
  });

  return {
    workouts,
    updatedAt: latestTime
  };
};

// Upload Local Data to Google Drive (with loading state capability)
export const uploadLocalDataToCloud = async (): Promise<void> => {
  if (!isLinked()) return;
  
  cancelCurrentSync();
  activeAbortController = new AbortController();
  
  setSyncStatus('syncing', 'クラウドへデータをアップロード中...');
  try {
    const localData = await getLocalSyncData();
    await uploadBackupData(localData, activeAbortController.signal);
    localStorage.setItem('gdrive_last_sync', new Date().toISOString());
    // Clear unsynced flag on success
    localStorage.removeItem('gdrive_unsynced');
    setSyncStatus('linked', 'アップロードが完了しました。');
  } catch (err: any) {
    if (err.name === 'AbortError') {
      // Intentionally cancelled
      return;
    }
    // Set unsynced flag on failure (e.g. offline)
    localStorage.setItem('gdrive_unsynced', 'true');
    setSyncStatus('error', `アップロード失敗: ${err.message}`);
    throw err;
  } finally {
    activeAbortController = null;
  }
};

// Restore from Cloud (Manual download)
export const restoreDataFromCloud = async (): Promise<number> => {
  if (!isLinked()) return 0;

  cancelCurrentSync();
  activeAbortController = new AbortController();

  setSyncStatus('syncing', 'クラウドからデータをダウンロード中...');
  try {
    const cloudData = await downloadBackupData(activeAbortController.signal);
    if (!cloudData) {
      setSyncStatus('linked', 'クラウドにデータが見つかりませんでした。');
      return 0;
    }

    const workouts = cloudData.workouts;
    let count = 0;
    for (const workout of workouts) {
      if (!workout.date || !workout.exercises) continue;
      // Overwrite local with cloud data (Last-writer-wins at database level)
      // Since it's a restore, we directly save the cloud record
      await saveWorkout(workout);
      count++;
    }
    
    localStorage.setItem('gdrive_last_sync', new Date().toISOString());
    localStorage.removeItem('gdrive_unsynced');
    setSyncStatus('linked', `クラウドから${count}件の記録を復元しました。`);
    return count;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      // Intentionally cancelled
      return 0;
    }
    setSyncStatus('error', `復元に失敗しました: ${err.message}`);
    throw err;
  } finally {
    activeAbortController = null;
  }
};
