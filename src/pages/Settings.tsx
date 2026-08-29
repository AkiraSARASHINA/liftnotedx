import { useState, useEffect } from 'react';
import { initDB } from '../lib/db';
import { 
  Trash2, 
  ShieldAlert, 
  Info, 
  Sliders, 
  Moon, 
  Sun, 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  AlertTriangle,
  Check
} from 'lucide-react';
import { 
  linkGoogleDrive, 
  unlinkGoogleDrive, 
  restoreDataFromCloud, 
  isLinked, 
  isAutoUploadEnabled, 
  setAutoUploadEnabled, 
  addStatusListener,
  hasClientId,
  uploadLocalDataToCloud
} from '../lib/googleDriveSync';
import './Settings.css';

const SettingsPage: React.FC = () => {
  const [highlightPB, setHighlightPB] = useState<boolean>(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [summaryFontSize, setSummaryFontSize] = useState<'small' | 'medium' | 'large'>('small');
  const [calendarRingMode, setCalendarRingMode] = useState<'ppl' | 'bodypart' | 'none'>('ppl');
  
  // Sync state
  const [syncStatus, setSyncStatus] = useState<string>('unlinked');
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [autoUpload, setAutoUpload] = useState<boolean>(true);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [hasConfiguredClient, setHasConfiguredClient] = useState<boolean>(true);

  useEffect(() => {
    const stored = localStorage.getItem('settings_highlight_pb');
    setHighlightPB(stored === 'true');

    const storedTheme = (localStorage.getItem('app_theme') as 'dark' | 'light') || 'dark';
    setTheme(storedTheme);

    const storedFontSize = (localStorage.getItem('settings_summary_font_size') as 'small' | 'medium' | 'large') || 'small';
    setSummaryFontSize(storedFontSize);

    const storedRingMode = (localStorage.getItem('settings_calendar_ring_mode') as 'ppl' | 'bodypart' | 'none') || 'ppl';
    setCalendarRingMode(storedRingMode);

    // Initial state check
    setAutoUpload(isAutoUploadEnabled());
    setLastSync(localStorage.getItem('gdrive_last_sync'));
    setHasConfiguredClient(hasClientId());

    // Subscribe to sync status changes
    const unsubscribe = addStatusListener((status, message) => {
      setSyncStatus(status);
      setSyncMessage(message || '');
      
      // Update last sync if it changed
      if (status === 'linked') {
        setLastSync(localStorage.getItem('gdrive_last_sync'));
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleToggleHighlightPB = (checked: boolean) => {
    setHighlightPB(checked);
    localStorage.setItem('settings_highlight_pb', String(checked));
  };

  const handleToggleTheme = (isDark: boolean) => {
    const newTheme = isDark ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('app_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleToggleAutoUpload = (checked: boolean) => {
    setAutoUpload(checked);
    setAutoUploadEnabled(checked);
  };

  const handleLink = async () => {
    try {
      await linkGoogleDrive();
    } catch (e) {
      console.error('Failed to link Google Drive:', e);
    }
  };

  const handleUnlink = () => {
    if (window.confirm('Google Driveとの連携を解除します。クラウド上のバックアップデータは削除されません。よろしいですか？')) {
      unlinkGoogleDrive();
    }
  };

  const handleUploadNow = async () => {
    try {
      await uploadLocalDataToCloud();
    } catch (e: any) {
      alert(`アップロードに失敗しました: ${e.message}`);
    }
  };

  const handleRestore = async () => {
    const confirm1 = window.confirm(
      '【クラウドからのデータ復元】\n' +
      'Google Driveに保存されているバックアップデータをこの端末に取り込みます。\n\n' +
      '■ 復元時の動作:\n' +
      '・同じ日付の記録がある場合: クラウド側のデータで上書きされます\n' +
      '・この端末にしかない別の日付の記録: そのまま残ります（消えません）\n' +
      '・クラウド側にある新しい日付の記録: この端末に追加されます\n\n' +
      '復元を実行してもよろしいですか？'
    );
    if (!confirm1) return;

    try {
      const count = await restoreDataFromCloud();
      if (count > 0) {
        alert(`${count}件の記録を復元しました。最新のデータを反映するため、アプリを再起動（リロード）します。`);
        window.location.reload();
      }
    } catch (e: any) {
      alert(`復元に失敗しました: ${e.message}`);
    }
  };

  const handleClearAllData = async () => {
    // Step 1 Confirmation
    const confirm1 = window.confirm(
      '【重要】全てのトレーニング記録を完全に削除します。この操作を行うと、これまでの全てのデータが失われます。よろしいですか？'
    );
    
    if (!confirm1) return;

    // Step 2 Confirmation
    const confirm2 = window.confirm(
      '【最終確認】この操作は絶対に取り消せません。本当に全てのデータを消去して初期状態に戻してもよろしいですか？'
    );

    if (!confirm2) return;

    try {
      const db = await initDB();
      const tx = db.transaction('workouts', 'readwrite');
      await tx.store.clear();
      await tx.done;
      
      alert('全てのデータを削除しました。アプリを再起動します。');
      window.location.href = window.location.pathname; // Reload to top
    } catch (error) {
      console.error('Failed to clear data:', error);
      alert('データの削除中にエラーが発生しました。');
    }
  };

  // Format date helper
  const formatSyncTime = (isoString: string | null) => {
    if (!isoString) return 'なし';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return isoString;
    }
  };

  // Render status badge
  const renderStatusBadge = () => {
    if (syncStatus === 'linked') {
      return (
        <span className="sync-status-badge linked">
          <Check size={12} /> 連携中
        </span>
      );
    }
    if (syncStatus === 'linking' || syncStatus === 'syncing') {
      return (
        <span className="sync-status-badge linked animate-pulse">
          同期中
        </span>
      );
    }
    if (syncStatus === 'error') {
      return (
        <span className="sync-status-badge error" title={syncMessage}>
          エラー
        </span>
      );
    }
    return (
      <span className="sync-status-badge unlinked">
        <CloudOff size={12} /> 未連携
      </span>
    );
  };

  return (
    <div className="settings-page">
      <section className="settings-section card">
        <div className="section-header">
          <Info size={20} />
          <h3>アプリについて</h3>
        </div>
        <p className="about-text">
          LiftNote DX をご利用いただきありがとうございます。このアプリはブラウザ内のローカルストレージにデータを保存しているため、サーバーにデータが送信されることはありません。
        </p>
      </section>

      <section className="settings-section card">
        <div className="section-header">
          <Sliders size={20} />
          <h3>表示設定</h3>
        </div>
        <div className="settings-options">
          <div className="setting-item">
            <div className="setting-info">
              <span className="setting-title-with-icon">
                {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                <span>ダークモード</span>
              </span>
              <span className="setting-desc">アプリのテーマをダーク/ライトで切り替えます。</span>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={theme === 'dark'} 
                onChange={(e) => handleToggleTheme(e.target.checked)} 
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <span className="setting-title">過去最高記録のハイライト</span>
              <span className="setting-desc">分析詳細画面で、過去最高を更新した日の記録をハイライトします。</span>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={highlightPB} 
                onChange={(e) => handleToggleHighlightPB(e.target.checked)} 
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <span className="setting-title">日別サマリーの文字サイズ</span>
              <span className="setting-desc">サマリー画面の種目一覧の表示サイズ（密度）を調整します。</span>
            </div>
            <div className="font-size-pills">
              {(['small', 'medium', 'large'] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  className={`font-size-pill ${summaryFontSize === size ? 'active' : ''}`}
                  onClick={() => {
                    setSummaryFontSize(size);
                    localStorage.setItem('settings_summary_font_size', size);
                  }}
                >
                  {size === 'small' ? '小' : size === 'medium' ? '中' : '大'}
                </button>
              ))}
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <span className="setting-title">カレンダーの日付リング表示</span>
              <span className="setting-desc">記録がある日の日付周囲にPPLまたは5分割の比率リングを表示します。</span>
            </div>
            <div className="font-size-pills">
              {[
                { key: 'ppl', label: 'PPL' },
                { key: 'bodypart', label: '5分割' },
                { key: 'none', label: 'オフ' }
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  className={`font-size-pill ${calendarRingMode === opt.key ? 'active' : ''}`}
                  onClick={() => {
                    setCalendarRingMode(opt.key as any);
                    localStorage.setItem('settings_calendar_ring_mode', opt.key);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Google Drive Synchronization Settings Section */}
      <section className="settings-section card">
        <div className="section-header">
          <Cloud size={20} />
          <h3>外部バックアップ設定</h3>
        </div>
        
        {!hasConfiguredClient && (
          <div className="client-id-warning">
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <div>
              Google OAuthクライアントIDが設定されていません。
              ローカル開発の場合は <code>.env</code> ファイルに <code>VITE_GOOGLE_CLIENT_ID</code> を設定してください。
            </div>
          </div>
        )}

        <div className="sync-status-row">
          <span className="sync-status-label">連携状態</span>
          {renderStatusBadge()}
        </div>

        {syncMessage && syncStatus === 'error' && (
          <p className="section-desc" style={{ color: 'var(--secondary-color)', marginTop: '-4px' }}>
            {syncMessage}
          </p>
        )}

        {isLinked() ? (
          <div className="settings-options">
            <div className="setting-item">
              <div className="setting-info">
                <span className="setting-title">自動バックアップ</span>
                <span className="setting-desc">記録の保存・削除時に、クラウドへ自動でアップロードします。</span>
              </div>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={autoUpload} 
                  onChange={(e) => handleToggleAutoUpload(e.target.checked)} 
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="sync-meta-info">
              <div>クラウド上のファイル: <code>liftnote_dx_backup.json</code></div>
              <div>最終同期日時: <strong>{formatSyncTime(lastSync)}</strong></div>
            </div>

            <div className="sync-btn-container">
              <button className="btn-sync-action link" onClick={handleUploadNow}>
                <RefreshCw size={16} /> 今すぐバックアップを保存
              </button>
              <button className="btn-sync-action restore" onClick={handleRestore}>
                データをクラウドから復元
              </button>
              <button className="btn-sync-action unlink" onClick={handleUnlink}>
                Google Driveとの連携を解除
              </button>
            </div>
          </div>
        ) : (
          <div className="sync-btn-container">
            <p className="about-text" style={{ fontSize: '13px', marginBottom: '8px' }}>
              Google アカウントと連携すると、アプリ専用のプライベートフォルダ（アプリ以外からはアクセスできない安全な隠し領域）にバックアップを保存し、別端末から簡単にデータを復元できます。
            </p>
            <button className="btn-sync-action link" onClick={handleLink} disabled={!hasConfiguredClient}>
              Google Driveと連携する
            </button>
          </div>
        )}
      </section>

      <section className="settings-section card danger-zone">
        <div className="section-header">
          <ShieldAlert size={20} color="var(--secondary-color)" />
          <h3>危険な操作</h3>
        </div>
        <p className="section-desc">
          以下の操作はデータの紛失を伴います。実行前に必ずバックアップ（登録画面からエクスポート）を取ることをお勧めします。
        </p>
        
        <div className="danger-actions">
          <button className="btn-danger" onClick={handleClearAllData}>
            <Trash2 size={18} />
            全てのデータを削除する
          </button>
        </div>
      </section>

      <div className="version-info">
        <p>LiftNote DX v1.5.0</p>
      </div>
    </div>
  );
};

export default SettingsPage;
