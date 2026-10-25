import React, { useState, useMemo } from 'react';
import type { Workout, Exercise, WorkoutSet, PPLCategory, BodyPartCategory } from '../lib/db';
import { 
  X, 
  Trash2, 
  Plus, 
  Check, 
  ChevronRight, 
  ChevronLeft,
  Flame, 
  Search,
  Calendar,
  AlertCircle
} from 'lucide-react';
import './ImportPreviewModal.css';

const PPL_OPTIONS: PPLCategory[] = ['プッシュ', 'プル', 'レッグ', 'それ以外'];
const BODY_PART_OPTIONS: BodyPartCategory[] = ['胸', '背中', '脚', '肩', '腕', 'それ以外'];

interface ImportPreviewModalProps {
  initialWorkouts: Workout[];
  customPromptRules?: string;
  sourceType: 'json_paste' | 'file_import';
  onConfirm: (workouts: Workout[], customPromptRules?: string) => Promise<void>;
  onClose: () => void;
}

const getDayOfWeek = (dateStr: string): string => {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return days[d.getDay()] || '';
  }
  return '';
};

export const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({
  initialWorkouts,
  customPromptRules,
  sourceType,
  onConfirm,
  onClose
}) => {
  // 編集可能なワークアウトのリスト（ディープコピー）
  const [workouts, setWorkouts] = useState<Workout[]>(() => 
    JSON.parse(JSON.stringify(initialWorkouts))
  );

  // 詳細・編集表示中のワークアウトのインデックス (null ならリスト表示)
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

  // リスト検索クエリ
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 全体サマリー計算
  const totalExercises = useMemo(() => {
    return workouts.reduce((sum, w) => sum + (w.exercises?.length || 0), 0);
  }, [workouts]);

  const totalSets = useMemo(() => {
    return workouts.reduce((sum, w) => {
      return sum + (w.exercises?.reduce((exSum, ex) => exSum + (ex.sets?.length || 0), 0) || 0);
    }, 0);
  }, [workouts]);

  // 検索フィルタリング
  const filteredWorkouts = useMemo(() => {
    if (!searchQuery.trim()) {
      return workouts.map((w, index) => ({ workout: w, originalIndex: index }));
    }
    const q = searchQuery.toLowerCase().trim();
    return workouts
      .map((w, index) => ({ workout: w, originalIndex: index }))
      .filter(({ workout }) => {
        if (workout.date.includes(q)) return true;
        const matchesEx = workout.exercises?.some(ex => 
          ex.name.toLowerCase().includes(q) ||
          (ex.bodyPart && ex.bodyPart.toLowerCase().includes(q)) ||
          (ex.ppl && ex.ppl.toLowerCase().includes(q))
        );
        return matchesEx;
      });
  }, [workouts, searchQuery]);

  // --- ワークアウト全体の操作 ---
  const handleDeleteWorkout = (indexToDelete: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (workouts.length <= 1) {
      if (!window.confirm('すべての記録を削除すると登録対象がなくなります。よろしいですか？')) {
        return;
      }
    }
    setWorkouts(prev => prev.filter((_, i) => i !== indexToDelete));
    if (selectedDayIndex === indexToDelete) {
      setSelectedDayIndex(null);
    } else if (selectedDayIndex !== null && selectedDayIndex > indexToDelete) {
      setSelectedDayIndex(selectedDayIndex - 1);
    }
  };

  const handleAddWorkout = () => {
    const today = new Date().toISOString().split('T')[0];
    const newWorkout: Workout = {
      date: today,
      exercises: [
        {
          name: '',
          isBodyweight: false,
          isCardio: false,
          unit: 'kg',
          sets: [{ weight: 60, reps: 10 }]
        }
      ],
      updatedAt: new Date().toISOString()
    };
    setWorkouts(prev => [newWorkout, ...prev]);
    // 追加した日の編集画面を即座に開く
    setSelectedDayIndex(0);
  };

  // --- 選択中のワークアウトの編集操作 ---
  const curWorkout = selectedDayIndex !== null ? workouts[selectedDayIndex] : null;

  const handleCurrentDateChange = (newDate: string) => {
    if (selectedDayIndex === null) return;
    setWorkouts(prev => {
      const updated = [...prev];
      updated[selectedDayIndex] = { ...updated[selectedDayIndex], date: newDate };
      return updated;
    });
  };

  const handleUpdateExercise = (exIdx: number, patch: Partial<Exercise>) => {
    if (selectedDayIndex === null) return;
    setWorkouts(prev => {
      const updated = [...prev];
      const targetWorkout = { ...updated[selectedDayIndex] };
      const updatedExercises = [...targetWorkout.exercises];
      const curEx = updatedExercises[exIdx];

      let newSets = curEx.sets;
      if (patch.isCardio !== undefined) {
        if (patch.isCardio && !curEx.isCardio) {
          newSets = [];
        } else if (!patch.isCardio && curEx.isCardio) {
          newSets = [{ weight: 60, reps: 10 }];
        }
      }

      updatedExercises[exIdx] = {
        ...curEx,
        ...patch,
        sets: patch.sets !== undefined ? patch.sets : newSets
      };
      targetWorkout.exercises = updatedExercises;
      updated[selectedDayIndex] = targetWorkout;
      return updated;
    });
  };

  const handleDeleteExercise = (exIdx: number) => {
    if (selectedDayIndex === null) return;
    setWorkouts(prev => {
      const updated = [...prev];
      const targetWorkout = { ...updated[selectedDayIndex] };
      targetWorkout.exercises = targetWorkout.exercises.filter((_, i) => i !== exIdx);
      updated[selectedDayIndex] = targetWorkout;
      return updated;
    });
  };

  const handleAddExercise = () => {
    if (selectedDayIndex === null) return;
    setWorkouts(prev => {
      const updated = [...prev];
      const targetWorkout = { ...updated[selectedDayIndex] };
      const newEx: Exercise = {
        name: '',
        isBodyweight: false,
        isCardio: false,
        unit: 'kg',
        sets: [{ weight: 60, reps: 10 }]
      };
      targetWorkout.exercises = [...targetWorkout.exercises, newEx];
      updated[selectedDayIndex] = targetWorkout;
      return updated;
    });
  };

  // セット操作
  const handleUpdateSet = (exIdx: number, setIdx: number, patch: Partial<WorkoutSet>) => {
    if (selectedDayIndex === null) return;
    setWorkouts(prev => {
      const updated = [...prev];
      const targetWorkout = { ...updated[selectedDayIndex] };
      const updatedExercises = [...targetWorkout.exercises];
      const curEx = { ...updatedExercises[exIdx] };
      const updatedSets = [...curEx.sets];

      updatedSets[setIdx] = {
        ...updatedSets[setIdx],
        ...patch
      };

      curEx.sets = updatedSets;
      updatedExercises[exIdx] = curEx;
      targetWorkout.exercises = updatedExercises;
      updated[selectedDayIndex] = targetWorkout;
      return updated;
    });
  };

  const handleAddSet = (exIdx: number) => {
    if (selectedDayIndex === null) return;
    setWorkouts(prev => {
      const updated = [...prev];
      const targetWorkout = { ...updated[selectedDayIndex] };
      const updatedExercises = [...targetWorkout.exercises];
      const curEx = { ...updatedExercises[exIdx] };
      const sets = [...curEx.sets];

      const lastSet = sets[sets.length - 1];
      const newSet: WorkoutSet = lastSet
        ? { weight: lastSet.weight, reps: lastSet.reps }
        : { weight: 60, reps: 10 };

      curEx.sets = [...sets, newSet];
      updatedExercises[exIdx] = curEx;
      targetWorkout.exercises = updatedExercises;
      updated[selectedDayIndex] = targetWorkout;
      return updated;
    });
  };

  const handleDeleteSet = (exIdx: number, setIdx: number) => {
    if (selectedDayIndex === null) return;
    setWorkouts(prev => {
      const updated = [...prev];
      const targetWorkout = { ...updated[selectedDayIndex] };
      const updatedExercises = [...targetWorkout.exercises];
      const curEx = { ...updatedExercises[exIdx] };
      curEx.sets = curEx.sets.filter((_, i) => i !== setIdx);
      updatedExercises[exIdx] = curEx;
      targetWorkout.exercises = updatedExercises;
      updated[selectedDayIndex] = targetWorkout;
      return updated;
    });
  };

  // 確定保存
  const handleSaveAll = async () => {
    if (workouts.length === 0) {
      alert('登録する記録がありません。');
      return;
    }

    // 簡易バリデーション：空の日付をチェック
    for (let i = 0; i < workouts.length; i++) {
      if (!workouts[i].date) {
        alert(`${i + 1}番目の記録の日付が入力されていません。`);
        setSelectedDayIndex(i);
        return;
      }
    }

    try {
      setIsSaving(true);
      await onConfirm(workouts, customPromptRules);
    } catch (err: any) {
      console.error('Failed to import workouts:', err);
      alert('保存中にエラーが発生しました: ' + (err?.message || '不明なエラー'));
      setIsSaving(false);
    }
  };

  return (
    <div className="import-preview-overlay" onClick={onClose}>
      <div 
        className="import-preview-modal" 
        onClick={e => e.stopPropagation()}
      >
        {/* ========================================================
            VIEW 1: 日別詳細編集ビュー (selectedDayIndex !== null)
            ======================================================== */}
        {selectedDayIndex !== null && curWorkout ? (
          <div className="preview-detail-view animate-fade-in">
            {/* 詳細ヘッダー */}
            <div className="preview-detail-header">
              <button 
                type="button" 
                className="preview-back-btn"
                onClick={() => setSelectedDayIndex(null)}
              >
                <ChevronLeft size={20} />
                <span>一覧に戻る</span>
              </button>

              <div className="preview-date-editor">
                <input
                  type="date"
                  className="preview-date-input"
                  value={curWorkout.date}
                  onChange={e => handleCurrentDateChange(e.target.value)}
                />
                <span className="preview-date-day-badge">
                  ({getDayOfWeek(curWorkout.date)})
                </span>
              </div>

              <div className="preview-detail-header-actions">
                <button
                  type="button"
                  className="preview-delete-day-btn"
                  onClick={() => handleDeleteWorkout(selectedDayIndex)}
                  title="この日の記録を削除"
                >
                  <Trash2 size={16} />
                  <span>この日を削除</span>
                </button>
              </div>
            </div>

            {/* 詳細ボディ */}
            <div className="preview-detail-body">
              {/* 日別サマリーバッジ */}
              <div className="preview-day-summary-banner">
                <div className="day-metric-item">
                  <span className="day-metric-val">{curWorkout.exercises.length}</span>
                  <span className="day-metric-lbl">種目</span>
                </div>
                <div className="day-metric-item">
                  <span className="day-metric-val">
                    {curWorkout.exercises.reduce((s, ex) => s + (ex.sets?.length || 0), 0)}
                  </span>
                  <span className="day-metric-lbl">総セット</span>
                </div>
                {(() => {
                  const cardioCal = curWorkout.exercises.reduce((s, ex) => s + (ex.isCardio ? (ex.calories || 0) : 0), 0);
                  if (cardioCal > 0) {
                    return (
                      <div className="day-metric-item highlight-cardio">
                        <Flame size={14} className="flame-icon" />
                        <span className="day-metric-val">{cardioCal}</span>
                        <span className="day-metric-lbl">kcal</span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* 種目リスト */}
              <div className="preview-exercise-list">
                {curWorkout.exercises.map((ex, exIdx) => (
                  <div key={exIdx} className="preview-exercise-card card">
                    {/* 種目ヘッダー */}
                    <div className="preview-exercise-header">
                      <div className="exercise-number-badge">#{exIdx + 1}</div>
                      <input
                        type="text"
                        className="preview-exercise-name-input"
                        placeholder="種目名（例: ベンチプレス）"
                        value={ex.name}
                        onChange={e => handleUpdateExercise(exIdx, { name: e.target.value })}
                      />
                      <button
                        type="button"
                        className="preview-icon-btn danger"
                        onClick={() => handleDeleteExercise(exIdx)}
                        title="この種目を削除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* カテゴリ & 属性セレクター */}
                    <div className="preview-exercise-meta-row">
                      <div className="meta-item">
                        <label>部位</label>
                        <select
                          value={ex.bodyPart || 'それ以外'}
                          onChange={e => handleUpdateExercise(exIdx, { bodyPart: e.target.value as BodyPartCategory })}
                        >
                          {BODY_PART_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>

                      <div className="meta-item">
                        <label>PPL</label>
                        <select
                          value={ex.ppl || 'それ以外'}
                          onChange={e => handleUpdateExercise(exIdx, { ppl: e.target.value as PPLCategory })}
                        >
                          {PPL_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>

                      <div className="meta-item-toggle">
                        <label className="toggle-label">
                          <input
                            type="checkbox"
                            checked={!!ex.isCardio}
                            onChange={e => handleUpdateExercise(exIdx, { isCardio: e.target.checked })}
                          />
                          <span>有酸素運動</span>
                        </label>
                      </div>

                      {!ex.isCardio && (
                        <div className="meta-item-toggle">
                          <label className="toggle-label">
                            <input
                              type="checkbox"
                              checked={!!ex.isBodyweight}
                              onChange={e => handleUpdateExercise(exIdx, { isBodyweight: e.target.checked })}
                            />
                            <span>自重</span>
                          </label>
                        </div>
                      )}
                    </div>

                    {/* 有酸素運動の場合: 消費カロリー入力 */}
                    {ex.isCardio ? (
                      <div className="preview-cardio-box">
                        <Flame size={16} className="text-orange" />
                        <label>消費カロリー:</label>
                        <input
                          type="number"
                          className="preview-calorie-input"
                          placeholder="0"
                          value={ex.calories || ''}
                          onChange={e => handleUpdateExercise(exIdx, { calories: e.target.value ? Number(e.target.value) : undefined })}
                        />
                        <span className="unit-label">kcal</span>
                      </div>
                    ) : (
                      /* 通常ウェイトトレーニング: セットリスト */
                      <div className="preview-sets-section">
                        <div className="preview-sets-table-header">
                          <span className="col-set">SET</span>
                          <span className="col-weight">重量 ({ex.unit || 'kg'})</span>
                          <span className="col-reps">回数 (reps)</span>
                          <span className="col-action"></span>
                        </div>
                        <div className="preview-sets-table-body">
                          {ex.sets.map((set, setIdx) => (
                            <div key={setIdx} className="preview-set-row">
                              <span className="set-num">{setIdx + 1}</span>
                              <div className="set-input-wrap">
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  className="set-input"
                                  value={set.weight}
                                  onChange={e => handleUpdateSet(exIdx, setIdx, { weight: Number(e.target.value) || 0 })}
                                />
                              </div>
                              <div className="set-input-wrap">
                                <input
                                  type="number"
                                  min="0"
                                  className="set-input"
                                  value={set.reps}
                                  onChange={e => handleUpdateSet(exIdx, setIdx, { reps: Number(e.target.value) || 0 })}
                                />
                              </div>
                              <button
                                type="button"
                                className="set-delete-btn"
                                onClick={() => handleDeleteSet(exIdx, setIdx)}
                                title="セット削除"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          className="preview-add-set-btn"
                          onClick={() => handleAddSet(exIdx)}
                        >
                          <Plus size={14} />
                          <span>セットを追加</span>
                        </button>
                      </div>
                    )}

                    {/* メモ */}
                    <div className="preview-note-row">
                      <input
                        type="text"
                        className="preview-note-input"
                        placeholder="メモ・備考（任意）"
                        value={ex.note || ''}
                        onChange={e => handleUpdateExercise(exIdx, { note: e.target.value })}
                      />
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  className="preview-add-exercise-btn"
                  onClick={handleAddExercise}
                >
                  <Plus size={16} />
                  <span>この日に種目を追加</span>
                </button>
              </div>
            </div>

            {/* 詳細フッター */}
            <div className="preview-detail-footer">
              <button
                type="button"
                className="btn-primary full-width"
                onClick={() => setSelectedDayIndex(null)}
              >
                <Check size={16} />
                <span>編集完了（一覧に戻る）</span>
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================
             VIEW 2: メイン一覧ビュー (selectedDayIndex === null)
             ======================================================== */
          <div className="preview-list-view">
            {/* ヘッダー */}
            <div className="preview-modal-header">
              <div className="preview-title-group">
                <div className="preview-title-row">
                  <Calendar size={20} className="preview-title-icon" />
                  <h2 className="preview-modal-title">
                    {sourceType === 'file_import' ? 'バックアップデータの確認・修正' : '取り込み記録の確認・修正'}
                  </h2>
                </div>
                <p className="preview-modal-subtitle">
                  日付をタップすると種目やセットの内容を確認・編集できます。
                </p>
              </div>
              <button 
                type="button" 
                className="preview-close-btn"
                onClick={onClose}
                aria-label="閉じる"
              >
                <X size={20} />
              </button>
            </div>

            {/* サマリー ＆ 検索バー */}
            <div className="preview-toolbar">
              <div className="preview-search-box">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="日付や種目名で絞り込み (例: 2026-10, ベンチ)"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button 
                    type="button" 
                    className="search-clear-btn"
                    onClick={() => setSearchQuery('')}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="preview-toolbar-meta">
                <div className="preview-badge-group">
                  <span className="summary-badge highlight">{workouts.length} 日分</span>
                  <span className="summary-badge">{totalExercises} 種目</span>
                  <span className="summary-badge">{totalSets} sets</span>
                </div>
                <button
                  type="button"
                  className="preview-btn-add-day"
                  onClick={handleAddWorkout}
                  title="新しい日付の記録を追加"
                >
                  <Plus size={15} />
                  <span>日付追加</span>
                </button>
              </div>
            </div>

            {/* 日付リスト（スクロール領域） */}
            <div className="preview-timeline-container">
              {filteredWorkouts.length === 0 ? (
                <div className="preview-empty-state">
                  <AlertCircle size={32} />
                  <p>該当する記録が見つかりません</p>
                </div>
              ) : (
                filteredWorkouts.map(({ workout, originalIndex }) => {
                  const parts = workout.date.split('-');
                  const month = parts[1] ? parseInt(parts[1], 10) : '';
                  const day = parts[2] ? parseInt(parts[2], 10) : '';
                  const year = parts[0] || '';
                  const dayOfWeek = getDayOfWeek(workout.date);

                  const exCount = workout.exercises?.length || 0;
                  const setsCount = workout.exercises?.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0) || 0;
                  const repsCount = workout.exercises?.reduce((sum, ex) => {
                    return sum + (ex.sets?.reduce((s, set) => s + (set.reps || 0), 0) || 0);
                  }, 0) || 0;
                  const cardioCal = workout.exercises?.reduce((sum, ex) => sum + (ex.isCardio ? (ex.calories || 0) : 0), 0) || 0;

                  return (
                    <div 
                      key={`${workout.date}-${originalIndex}`}
                      className="preview-timeline-item card"
                      onClick={() => setSelectedDayIndex(originalIndex)}
                      role="button"
                      tabIndex={0}
                    >
                      {/* 日付カラム */}
                      <div className="timeline-date">
                        <span className="date-main">{month}/{day}</span>
                        <span className="date-sub">{year} ({dayOfWeek})</span>
                      </div>

                      {/* メトリクス & 種目プレビュー */}
                      <div className="timeline-content">
                        <div className="timeline-metrics">
                          <div className="metrics-main">
                            <span className="metric-main-num">{exCount}</span>
                            <span className="metric-main-label">種目</span>
                          </div>
                          <div className="metrics-sub">
                            <span>{setsCount} sets</span>
                            <span className="metric-dot">·</span>
                            <span>{repsCount} reps</span>
                            {cardioCal > 0 && (
                              <>
                                <span className="metric-dot">·</span>
                                <span className="metric-cardio">
                                  <Flame size={12} />
                                  {cardioCal} kcal
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* 種目バッジ一覧（最大4件） */}
                        <div className="timeline-exercise-tags">
                          {workout.exercises.slice(0, 4).map((ex, idx) => (
                            <span key={idx} className="exercise-chip">
                              {ex.name || '無題の種目'}
                              {ex.isCardio ? ' (有酸素)' : ` (${ex.sets?.length || 0}s)`}
                            </span>
                          ))}
                          {workout.exercises.length > 4 && (
                            <span className="exercise-chip more">
                              +{workout.exercises.length - 4}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* アクション */}
                      <div className="timeline-actions">
                        <button
                          type="button"
                          className="timeline-delete-btn"
                          onClick={(e) => handleDeleteWorkout(originalIndex, e)}
                          title="この日を削除"
                        >
                          <Trash2 size={16} />
                        </button>
                        <div className="timeline-arrow">
                          <ChevronRight size={18} />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* フッター */}
            <div className="preview-modal-footer">
              <button 
                type="button" 
                className="btn-secondary"
                onClick={onClose}
                disabled={isSaving}
              >
                キャンセル
              </button>
              <button 
                type="button" 
                className="btn-primary confirm-btn"
                onClick={handleSaveAll}
                disabled={isSaving || workouts.length === 0}
              >
                <Check size={18} />
                <span>
                  {isSaving 
                    ? '保存中...' 
                    : `この内容で登録する (${workouts.length}日分 / ${totalExercises}種目)`}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
