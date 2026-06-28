import { useState, useEffect } from 'react';
import { initDB } from '../lib/db';
import { Trash2, ShieldAlert, Info, Sliders } from 'lucide-react';
import './Settings.css';

const SettingsPage: React.FC = () => {
  const [highlightPB, setHighlightPB] = useState<boolean>(false);

  useEffect(() => {
    const stored = localStorage.getItem('settings_highlight_pb');
    setHighlightPB(stored === 'true');
  }, []);

  const handleToggleHighlightPB = (checked: boolean) => {
    setHighlightPB(checked);
    localStorage.setItem('settings_highlight_pb', String(checked));
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
        </div>
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
