import { useState, useRef } from 'react';
import { saveWorkout, getWorkoutByDate, getAllWorkouts, type Workout } from '../lib/db';
import { ClipboardCheck, Save, AlertCircle, Copy, HelpCircle, X, Download, Upload } from 'lucide-react';
import './Input.css';

const AI_PROMPT = `ウェイトトレーニングの記録を以下のJSON形式に変換してください。
複数の日程がある場合は、その配列を返してください。

【出力フォーマット】
[
  {
    "date": "YYYY-MM-DD",
    "exercises": [
      {
        "name": "種目名",
        "isBodyweight": false,
        "note": "備考（あれば）",
        "sets": [
          { "weight": 60, "reps": 10 },
          { "weight": 60, "reps": 8 }
        ]
      }
    ]
  }
]

【ルール】
- 重量は数値のみ（kgは含めない）。
- 自重種目の場合は isBodyweight を true にし、weight は含めない。
- 1つの日付に同じ種目が複数回あっても構いません（そのままリストに含めてください）。`;

const InputPage: React.FC = () => {
  const [jsonInput, setJsonInput] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importedData, setImportedData] = useState<any | null>(null);

  const processWorkouts = async (data: any) => {
    const workouts = Array.isArray(data) ? data : [data];
    let count = 0;

    for (const workout of workouts) {
      if (!workout.date || !workout.exercises) continue;

      const existingWorkout = await getWorkoutByDate(workout.date);
      let finalWorkout: Workout;

      if (existingWorkout) {
        finalWorkout = {
          ...existingWorkout,
          exercises: [...existingWorkout.exercises, ...workout.exercises]
        };
      } else {
        finalWorkout = workout;
      }

      await saveWorkout(finalWorkout);
      count++;
    }
    return count;
  };

  const handleSave = async () => {
    try {
      const data = JSON.parse(jsonInput);
      const count = await processWorkouts(data);
      setStatus({ type: 'success', message: `${count}件の記録を保存しました（既存の記録には追記されました）。` });
      setJsonInput('');
    } catch (e) {
      setStatus({ type: 'error', message: '保存に失敗しました。JSONの形式を確認してください。' });
    }
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(AI_PROMPT);
    alert('プロンプトをコピーしました！AIに貼り付けて使用してください。');
  };

  // --- Backup / Restore Functions ---

  const handleExportFile = async () => {
    const all = await getAllWorkouts();
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    a.href = url;
    a.download = `liftnotedx_backup_${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setStatus(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        setImportedData(data);
      } catch (err) {
        setImportedData(null);
        setStatus({ type: 'error', message: 'ファイルの読み込みに失敗しました。正しい形式のJSONファイルを選択してください。' });
      }
    };
    reader.readAsText(file);
  };

  const handleImportExecute = async () => {
    if (!importedData) return;
    try {
      const count = await processWorkouts(importedData);
      setStatus({ type: 'success', message: `ファイルから${count}件の記録をインポートしました。` });
      setSelectedFile(null);
      setImportedData(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setStatus({ type: 'error', message: 'インポートに失敗しました。データを確認してください。' });
    }
  };

  return (
    <div className="input-page">
      <div className="header-row">
        <h2>記録の登録</h2>
        <button className="prompt-guide-btn" onClick={() => setShowPromptModal(true)}>
          <HelpCircle size={18} />
          AIプロンプトを取得
        </button>
      </div>
      
      <p className="description">
        生成AI（ChatGPTなど）で作成したJSONデータを貼り付けて保存してください。
      </p>

      <div className="input-container card">
        <textarea
          placeholder='[{"date": "2024-05-10", "exercises": [...]}]'
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
        />
      </div>

      {status && (
        <div className={`status-message ${status.type} animate-in`}>
          {status.type === 'success' ? <ClipboardCheck size={20} /> : <AlertCircle size={20} />}
          {status.message}
        </div>
      )}

      <button className="btn-primary save-btn" onClick={handleSave}>
        <Save size={20} />
        記録を保存
      </button>

      <div className="backup-section card">
        <h3>データのバックアップ・復元</h3>
        <p className="section-desc">他端末へのデータ移行や保存用に活用してください。</p>
        
        <div className="backup-actions">
          <div className="action-group">
            <label>エクスポート（書き出し）</label>
            <button className="btn-secondary w-full" onClick={handleExportFile}>
              <Download size={16} /> ファイルをダウンロード
            </button>
          </div>

          <div className="action-group">
            <label>インポート（読み込み）</label>
            <input 
              type="file" 
              accept=".json" 
              onChange={handleFileChange} 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
            />
            <button className="btn-secondary w-full" onClick={() => fileInputRef.current?.click()}>
              <Upload size={16} /> ファイルをアップロード
            </button>

            {selectedFile && (
              <div className="selected-file-container animate-in">
                <div className="file-info-row">
                  <span className="file-name" title={selectedFile.name}>選択中: {selectedFile.name}</span>
                  <button 
                    className="cancel-file-btn" 
                    onClick={() => {
                      setSelectedFile(null);
                      setImportedData(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                      setStatus(null);
                    }}
                    title="選択を解除"
                  >
                    <X size={16} />
                  </button>
                </div>
                <button 
                  className="btn-primary import-exec-btn" 
                  onClick={handleImportExecute}
                  disabled={!importedData}
                >
                  インポートを実行
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showPromptModal && (
        <div className="modal-overlay" onClick={() => setShowPromptModal(false)}>
          <div className="modal-content card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>AIプロンプトガイド</h3>
              <button className="close-btn" onClick={() => setShowPromptModal(false)}>
                <X size={20} />
              </button>
            </div>
            <p className="modal-description">
              以下のプロンプトをコピーして、トレーニングノートの写真と一緒にAIに送ってください。
            </p>
            <div className="prompt-box">
              <pre>{AI_PROMPT}</pre>
              <button className="btn-primary copy-btn" onClick={copyPrompt}>
                <Copy size={18} />
                プロンプトをコピーする
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InputPage;
