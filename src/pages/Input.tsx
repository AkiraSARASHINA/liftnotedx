import { useState, useRef, useEffect } from 'react';
import { saveWorkout, getWorkoutByDate, getAllWorkouts, type Workout, type Exercise } from '../lib/db';
import { ClipboardCheck, Save, AlertCircle, Copy, HelpCircle, X, Download, Upload, Eye } from 'lucide-react';
import { getCustomPromptRules, saveCustomPromptRules, addCustomPromptRulesListener } from '../lib/customPromptRules';
import { ImportPreviewModal } from '../components/ImportPreviewModal';
import './Input.css';

export const getAiPrompt = (baseDateStr?: string, customRules?: string) => {
  const baseDate = baseDateStr ? new Date(baseDateStr) : new Date();
  const todayStr = baseDateStr || `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}-${String(baseDate.getDate()).padStart(2, '0')}`;
  const currentYear = baseDate.getFullYear();
  const prevYear = currentYear - 1;

  const trimmedCustom = customRules?.trim();
  const customSection = trimmedCustom ? `

【ユーザー独自ルール（最優先で適用）】
${trimmedCustom}` : '';

  return `添付されたトレーニングノートの画像から記録を読み取り、以下の【出力フォーマット】のJSON形式に変換してください。
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

【日付（date）の特定・補完ルール】
- "date" は必ず "YYYY-MM-DD" 形式で出力してください。
- ノート内に「年」が書かれておらず「月日」のみの場合など、日付情報が足りない場合は、2020年などの古い年を勝手に補完せず、本日（基準日: ${todayStr}）を前提として矛盾しない【当日を含む最も近い過去の日付】（未来の日付にならない直近の過去）を自動補完してください。
  （例: 基準日が10月25日の場合、「10/12」は ${currentYear}-10-12、「11/5」は ${prevYear}-11-05 と判定）

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
${customSection}

出力はマークダウンのコードブロック（\`\`\`json ... \`\`\`）のみを出力してください。`;
};

export const AI_PROMPT = getAiPrompt();

export const normalizeWorkoutData = (data: any): { workouts: Workout[]; customRules?: string } => {
  if (!data) return { workouts: [] };

  let workoutsArray: any[] = [];
  let customRules: string | undefined = undefined;

  if (Array.isArray(data)) {
    workoutsArray = data;
  } else if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data.workouts)) {
      workoutsArray = data.workouts;
      if (typeof data.customPromptRules === 'string') {
        customRules = data.customPromptRules;
      }
    } else if (data.date && Array.isArray(data.exercises)) {
      workoutsArray = [data];
    }
  }

  const normalized: Workout[] = workoutsArray.map(w => {
    const date = typeof w.date === 'string' ? w.date : new Date().toISOString().split('T')[0];
    const exercises: Exercise[] = Array.isArray(w.exercises)
      ? w.exercises.map((e: any) => ({
          name: typeof e.name === 'string' ? e.name : '',
          isCardio: !!e.isCardio,
          calories: typeof e.calories === 'number' ? e.calories : undefined,
          isBodyweight: !!e.isBodyweight,
          equipment: typeof e.equipment === 'string' ? e.equipment : '',
          note: typeof e.note === 'string' ? e.note : '',
          ppl: e.ppl || undefined,
          bodyPart: e.bodyPart || undefined,
          unit: e.unit === 'lbs' ? 'lbs' : 'kg',
          sets: Array.isArray(e.sets)
            ? e.sets.map((s: any) => ({
                weight: typeof s.weight === 'number' ? s.weight : undefined,
                reps: typeof s.reps === 'number' ? s.reps : 10,
                unit: s.unit || e.unit || 'kg'
              }))
            : []
        }))
      : [];

    return {
      date,
      exercises,
      updatedAt: w.updatedAt || new Date().toISOString()
    };
  });

  return { workouts: normalized, customRules };
};

const InputPage: React.FC = () => {
  const [jsonInput, setJsonInput] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importedData, setImportedData] = useState<any | null>(null);
  const [customRules, setCustomRules] = useState<string>(() => getCustomPromptRules());
  const [rulesSaveStatus, setRulesSaveStatus] = useState<string | null>(null);

  // 登録前確認・編集モーダル用のステート
  const [previewModalData, setPreviewModalData] = useState<{
    workouts: Workout[];
    customPromptRules?: string;
    sourceType: 'json_paste' | 'file_import';
  } | null>(null);

  useEffect(() => {
    const unsubscribe = addCustomPromptRulesListener((rules) => {
      setCustomRules(rules);
    });
    return unsubscribe;
  }, []);

  const handleSaveCustomRules = () => {
    saveCustomPromptRules(customRules);
    setRulesSaveStatus('保存しました（クラウド同期）');
    setTimeout(() => setRulesSaveStatus(null), 3000);
  };

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const currentPrompt = getAiPrompt(todayStr, customRules);

  const processWorkouts = async (data: any) => {
    const workouts = Array.isArray(data) ? data : [data];
    let count = 0;

    for (const workout of workouts) {
      if (!workout.date || !workout.exercises || !Array.isArray(workout.exercises)) continue;
      
      const validExercises = workout.exercises.filter(
        (ex: any) => ex && ex.name && ((Array.isArray(ex.sets) && ex.sets.length > 0) || ex.isCardio)
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

  // JSON貼り付けから確認画面を開く
  const handleOpenPreviewFromJson = () => {
    if (!jsonInput.trim()) {
      setStatus({ type: 'error', message: 'JSONデータを入力してください。' });
      return;
    }
    try {
      const data = JSON.parse(jsonInput);
      const { workouts, customRules: parsedRules } = normalizeWorkoutData(data);
      if (workouts.length === 0) {
        setStatus({ type: 'error', message: '有効なトレーニング記録データが見つかりませんでした。形式を確認してください。' });
        return;
      }
      setStatus(null);
      setPreviewModalData({
        workouts,
        customPromptRules: parsedRules,
        sourceType: 'json_paste'
      });
    } catch (e) {
      setStatus({ type: 'error', message: 'JSONの解析に失敗しました。形式（括弧閉じやカンマ等）を確認してください。' });
    }
  };

  // ファイルインポートから確認画面を開く
  const handleOpenPreviewFromFile = () => {
    if (!importedData) return;
    const { workouts, customRules: parsedRules } = normalizeWorkoutData(importedData);
    if (workouts.length === 0) {
      setStatus({ type: 'error', message: 'ファイル内に有効なトレーニング記録が見つかりませんでした。' });
      return;
    }
    setStatus(null);
    setPreviewModalData({
      workouts,
      customPromptRules: parsedRules,
      sourceType: 'file_import'
    });
  };

  // 確認画面で「確定して保存」が押された際の処理
  const handleConfirmImport = async (confirmedWorkouts: Workout[], rulesToSave?: string) => {
    if (rulesToSave !== undefined && rulesToSave.trim() !== '') {
      saveCustomPromptRules(rulesToSave);
    }
    const count = await processWorkouts(confirmedWorkouts);
    const dateCount = confirmedWorkouts.length;
    setStatus({ 
      type: 'success', 
      message: `${dateCount}日分（計${count}日）の記録を保存しました（既存の記録には追記されました）。` 
    });

    if (previewModalData?.sourceType === 'json_paste') {
      setJsonInput('');
    } else {
      setSelectedFile(null);
      setImportedData(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
    setPreviewModalData(null);
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(currentPrompt);
    alert('プロンプトをコピーしました！AIに貼り付けて使用してください。');
  };

  // --- Backup / Restore Functions ---

  const handleExportFile = async () => {
    const all = await getAllWorkouts();
    const backupObj = {
      workouts: all,
      customPromptRules: getCustomPromptRules(),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
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

      <button className="btn-primary save-btn" onClick={handleOpenPreviewFromJson}>
        <Eye size={20} />
        内容を確認・編集して保存
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
                  onClick={handleOpenPreviewFromFile}
                  disabled={!importedData}
                >
                  <Eye size={16} />
                  内容を確認・編集して復元
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 登録前確認・編集モーダル */}
      {previewModalData && (
        <ImportPreviewModal
          initialWorkouts={previewModalData.workouts}
          customPromptRules={previewModalData.customPromptRules}
          sourceType={previewModalData.sourceType}
          onConfirm={handleConfirmImport}
          onClose={() => setPreviewModalData(null)}
        />
      )}

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
            <button className="btn-primary copy-btn prompt-modal-copy-btn" onClick={copyPrompt}>
              <Copy size={18} />
              プロンプトをコピーする
            </button>

            {/* 独自追加ルールセクション */}
            <div className="custom-rules-box">
              <div className="custom-rules-header">
                <span className="custom-rules-title">📝 独自追加ルール（任意）</span>
                {rulesSaveStatus && <span className="rules-save-toast animate-in">✓ {rulesSaveStatus}</span>}
              </div>
              <p className="custom-rules-desc">
                通っているジム固有のマシン名やあなた独自のメモの解釈ルールを記述できます。自動で下のプロンプトに合体され、クラウド同期されます。
              </p>
              <textarea
                className="custom-rules-textarea"
                rows={3}
                placeholder="例:&#10;- ○○ジムの「インクライン」はマシンインクラインチェストプレスとする&#10;- 「ナロー」と書かれた種目はequipmentに「ナロー」と記載する&#10;- アタッチメント「A」はマググリップとする"
                value={customRules}
                onChange={e => setCustomRules(e.target.value)}
              />
              <div className="custom-rules-footer">
                <button
                  type="button"
                  className="btn-save-rules"
                  onClick={handleSaveCustomRules}
                >
                  <Save size={14} />
                  独自ルールを保存
                </button>
              </div>
            </div>

            <div className="prompt-box">
              <div className="prompt-box-header">
                <span className="prompt-preview-title">プレビュー（完成プロンプト）</span>
              </div>
              <pre>{currentPrompt}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InputPage;
