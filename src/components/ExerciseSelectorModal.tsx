import { useState, useMemo, useEffect } from 'react';
import { X, Edit3, ChevronRight, Flame, Search, History } from 'lucide-react';
import { 
  EXERCISE_CATEGORIES, 
  buildUnifiedExerciseList,
  type ExerciseCategory, 
  type ExerciseDefinition 
} from '../lib/exerciseDictionary';
import { getAllWorkouts, type PPLCategory, type Workout } from '../lib/db';
import './ExerciseSelectorModal.css';

interface ExerciseSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (exercise: ExerciseDefinition) => void;
  onManualInput: () => void;
  initialCategory?: ExerciseCategory;
  workouts?: Workout[];
}

const PPL_BADGE_COLORS: Record<PPLCategory, { bg: string; color: string; border: string }> = {
  'プッシュ': { bg: 'rgba(255, 45, 85, 0.12)', color: '#ff2d55', border: 'rgba(255, 45, 85, 0.3)' },
  'プル': { bg: 'rgba(0, 163, 255, 0.12)', color: '#00a3ff', border: 'rgba(0, 163, 255, 0.3)' },
  'レッグ': { bg: 'rgba(0, 229, 163, 0.12)', color: '#00e5a3', border: 'rgba(0, 229, 163, 0.3)' },
  'それ以外': { bg: 'rgba(255, 255, 255, 0.08)', color: '#8e8e93', border: 'rgba(255, 255, 255, 0.15)' }
};

export const ExerciseSelectorModal: React.FC<ExerciseSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  onManualInput,
  initialCategory = '胸',
  workouts: propWorkouts
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory>(initialCategory);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadedWorkouts, setLoadedWorkouts] = useState<Workout[]>([]);

  // 外部から workouts が渡されていない場合は DB から自動取得
  useEffect(() => {
    if (isOpen && !propWorkouts) {
      getAllWorkouts().then(data => {
        setLoadedWorkouts(data || []);
      }).catch(err => {
        console.error('Failed to load workouts for exercise dictionary:', err);
      });
    }
  }, [isOpen, propWorkouts]);

  // モーダルが開くたびに検索バーをリセット
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      if (initialCategory) {
        setSelectedCategory(initialCategory);
      }
    }
  }, [isOpen, initialCategory]);

  const targetWorkouts = propWorkouts || loadedWorkouts;

  // デフォルト辞書と過去の記録を統合
  const unifiedExercises = useMemo(() => {
    return buildUnifiedExerciseList(targetWorkouts);
  }, [targetWorkouts]);

  // 検索またはカテゴリーでフィルタリング
  const displayedExercises = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      // 検索時は全カテゴリーを横断して検索
      return unifiedExercises.filter(ex => 
        ex.name.toLowerCase().includes(q) ||
        ex.category.toLowerCase().includes(q) ||
        ex.ppl.toLowerCase().includes(q)
      );
    }
    // 検索語がない場合は選択中カテゴリーの種目を表示
    return unifiedExercises.filter(ex => ex.category === selectedCategory);
  }, [unifiedExercises, searchQuery, selectedCategory]);

  if (!isOpen) return null;

  const handleSelect = (ex: ExerciseDefinition) => {
    onSelect(ex);
    onClose();
  };

  return (
    <div className="modal-overlay exercise-selector-overlay" onClick={onClose}>
      <div className="exercise-selector-dialog card animate-in" onClick={e => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="selector-header">
          <div className="selector-title-group">
            <span className="selector-badge">EXERCISE SELECTOR</span>
            <h3>種目を選択</h3>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* 検索バー */}
        <div className="selector-search-container">
          <div className="selector-search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="種目名・部位で検索 (例: ベンチ, 背中)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoFocus={false}
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
        </div>

        {/* 7カテゴリー切り替えタブ (検索中以外に表示) */}
        {!searchQuery && (
          <div className="category-tabs-container">
            <div className="category-tabs-grid">
              {EXERCISE_CATEGORIES.map(cat => {
                const isActive = selectedCategory === cat;
                const isCardio = cat === '有酸素運動';
                return (
                  <button
                    key={cat}
                    type="button"
                    className={`category-tab-btn ${isActive ? 'active' : ''} ${isCardio ? 'cardio-tab' : ''}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {isCardio ? (
                      <span className="tab-icon-label">
                        <Flame size={13} color="#ff5e3a" />
                        <span>有酸素</span>
                      </span>
                    ) : (
                      <span>{cat}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 検索結果ヘッダー（検索中のみ） */}
        {searchQuery && (
          <div className="search-results-header">
            <span>検索結果: {displayedExercises.length}件</span>
          </div>
        )}

        {/* 種目一覧リスト */}
        <div className="exercise-items-scroll">
          <div className="exercise-items-list">
            {displayedExercises.length === 0 ? (
              <div className="no-exercises-found">
                <p>該当する種目が見つかりませんでした</p>
                <button
                  type="button"
                  className="quick-manual-input-btn"
                  onClick={() => {
                    onClose();
                    onManualInput();
                  }}
                >
                  <Edit3 size={14} />
                  <span>「{searchQuery}」を直接入力して追加</span>
                </button>
              </div>
            ) : (
              displayedExercises.map(ex => {
                const badgeStyle = PPL_BADGE_COLORS[ex.ppl] || PPL_BADGE_COLORS['それ以外'];
                return (
                  <div
                    key={`${ex.category}-${ex.name}`}
                    className="exercise-select-item"
                    onClick={() => handleSelect(ex)}
                  >
                    <div className="ex-item-info">
                      <div className="ex-item-name-row">
                        <span className="ex-item-name">{ex.name}</span>
                        {/* 過去の記録からの種目には「履歴」バッジを表示 */}
                        {ex.isFromHistory && (
                          <span className="ex-tag-history" title="過去の記録から参照">
                            <History size={11} />
                            <span>履歴</span>
                          </span>
                        )}
                      </div>

                      <div className="ex-item-tags">
                        {/* 検索中ならカテゴリー名もバッジとして表示 */}
                        {searchQuery && (
                          <span className="ex-tag-category">
                            {ex.category}
                          </span>
                        )}

                        {ex.isCardio ? (
                          <span className="ex-tag-cardio">🏃 有酸素運動</span>
                        ) : (
                          <>
                            <span 
                              className="ex-tag-ppl"
                              style={{ 
                                background: badgeStyle.bg, 
                                color: badgeStyle.color, 
                                borderColor: badgeStyle.border 
                              }}
                            >
                              {ex.ppl}
                            </span>
                            {ex.isBodyweight && (
                              <span className="ex-tag-bw">自重</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={18} className="ex-item-arrow" />
                  </div>
                );
              })
            )}
          </div>

          {/* 最下部: キーボード直接入力オプション */}
          <div className="manual-input-footer">
            <button
              type="button"
              className="manual-input-btn"
              onClick={() => {
                onClose();
                onManualInput();
              }}
            >
              <Edit3 size={15} />
              <span>一覧にない種目をキーボードで直接入力</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
