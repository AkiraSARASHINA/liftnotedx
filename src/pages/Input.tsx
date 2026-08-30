import { useState, useRef } from 'react';
import { saveWorkout, getWorkoutByDate, getAllWorkouts, type Workout } from '../lib/db';
import { ClipboardCheck, Save, AlertCircle, Copy, HelpCircle, X, Download, Upload } from 'lucide-react';
import './Input.css';

const AI_PROMPT = `添付されたトレーニングノートの画像から記録を読み取り、以下の【出力フォーマット】のJSON形式に変換してください。
ノートに明記されていなくても、各種目名から【PPL分類】および【5分割法部位】を自動判定して付与してください。
複数日の記録がある場合は、それらを配列に含めて出力してください。

【出力フォーマット】
[
  {
    "date": "YYYY-MM-DD",
    "exercises": [
      {
        "name": "種目名",
        "ppl": "プッシュ",
        "bodyPart": "胸",
        "equipment": "マシンメーカー名・器具名・バリエーション（該当があれば）",
        "isBodyweight": false,
        "unit": "kg",
        "note": "備考（セットの感想、グリップ、反動の有無、シート位置など）",
        "sets": [
          { "weight": 60, "reps": 10 },
          { "weight": 60, "reps": 8 }
        ]
      }
    ]
  }
]

【自動分類ルール（種目から自動判定）】
1. PPL分類（pplプロパティ）:
   - "プッシュ": 胸・肩（前部/側部）・三頭筋などの押す種目（ベンチプレス、チェストプレス、ショルダープレス、ディップス、サイドレイズ、トライセップス等）
   - "プル": 背中・二頭筋・リアデルトなどの引く種目（ラットプルダウン、チンニング、ローイング、デッドリフト、リアレイズ、アームカール等）
   - "レッグ": 脚・臀部・カーフなどの下半身種目（スクワット、レッグプレス、レッグエクステンション、レッグカール、カーフレイズ、ヒップスラスト等）
   - "それ以外": 腹筋（クランチ、レッグレイズ等）や有酸素運動など

2. 5分割法部位（bodyPartプロパティ）:
   - "胸": ベンチプレス、チェストプレス、ペックフライ、ディップス、インクラインベンチ等
   - "背中": ラットプルダウン、チンニング、ローイング、デッドリフト、プルオーバー等
   - "脚": スクワット、レッグプレス、レッグエクステンション、レッグカール、カーフレイズ、ヒップスラスト等
   - "肩": ショルダープレス、サイドレイズ、ミリタリープレス、リアレイズ、デルトイド等
   - "腕": アームカール、ハンマーカール、プリチャーカール、トライセップエクステンション等
   - "それ以外": クランチ、リバースクランチ、有酸素運動など

【その他の入力ルール】
3. 種目名（name）の統一ルール:
   - 「ベンチプレス（止めアリ）」「ベンチプレス（テンポベンチ）」などは種目名を「ベンチプレス」とし、「止めアリ」「テンポベンチ」は equipment に記載してください。
   - 「スクワット（止めアリ）」も種目名を「スクワット」とし、「止めアリ」は equipment に記載してください。
   - 「ラットプルダウン（大円筋）」などの対象部位やバリエーションが記載されている種目も、種目名は「ラットプルダウン」とし、対象部位（「大円筋」等）は equipment に記載してください。

4. 器具・メーカー名・対象部位・バリエーション（equipment）の記載ルール（複数可）:
   - マシンメーカー名（ノーチラス, ハンマーストレングス, FLEX, CYBEX, NITRO evo, TECA, STRIVE, テクノジム, PRIME, Life Fitness, PRECOR, 初動負荷 など）、バー種別（EZバー, ストレートバー など）、マシン形状（ヒジで押すタイプ など）、動作バリエーション（止めアリ, テンポベンチ など）、対象部位（大円筋, 広背筋 など）を equipment に抽出してください。
   - 複数該当する場合は、カンマ区切り（例: "ノーチラス, 大円筋"）で複数記載してください。
   - 器具情報やバリエーション指定がないフリーウェイト等は省略（または空文字）にしてください。

5. 備考（note）の記載ルール:
   - マシン名や対象部位以外のメモ（例: 「ナローグリップ」「サムレス」「ラスト2レップ反動アリ」「120kgまでノーギア」「イスの高さ9」など）は note に記載してください。

6. 自重種目（isBodyweight）とセット内容（sets）:
   - チンニング（懸垂）、ディップス、クランチ、ツイスティングリバースクランチ、レッグレイズ等の本来自重で行う種目は、加重重量（例: +10kg, 15kg加重 等）が書かれていても常に isBodyweight: true としてください。
   - 加重した場合は sets の weight に加重した重量（例: 10）を数値で記載し、加重なし（自重のみ）の場合は weight を省略（または 0）にしてください。
   - 重量は単位（kg/lb）を含めず数値のみとしてください。

7. 重量単位（unitプロパティ）:
   - ポンド表記（例: 100lb, 120ポンド, LB 等）が明記されている種目は "lbs"、それ以外（kg表記または単位無指定）は "kg" としてください。

8. 有酸素運動（isCardio, caloriesプロパティ）:
   - ランニング、トレッドミル、エアロバイク、バイク、クロストレーナー、ステッパー等の有酸素運動が記録されている場合は "isCardio": true としてください。
   - 消費カロリー（例: 300kcal, 250cal 等）が記載されている場合は "calories": 300 のように数値で記載してください。
   - 有酸素運動の場合は "sets": [] とし、ppl, bodyPart, isBodyweight, unit の指定は不要です（マシン名があれば equipment に記載）。

出力はマークダウンのコードブロック（\`\`\`json ... \`\`\`）のみを出力してください。`;

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
      if (!workout.date || !workout.exercises || !Array.isArray(workout.exercises)) continue;
      
      const validExercises = workout.exercises.filter(
        (ex: any) => ex && ex.name && Array.isArray(ex.sets) && ex.sets.length > 0
      );
      if (validExercises.length === 0) continue;

      const existingWorkout = await getWorkoutByDate(workout.date);
      let finalWorkout: Workout;

      if (existingWorkout) {
        finalWorkout = {
          ...existingWorkout,
          exercises: [...existingWorkout.exercises, ...validExercises]
        };
      } else {
        finalWorkout = {
          ...workout,
          exercises: validExercises
        };
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
