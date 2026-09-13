import { useState } from 'react';
import { X, Edit3, ChevronRight, Flame } from 'lucide-react';
import { 
  EXERCISE_CATEGORIES, 
  getExercisesByCategory, 
  type ExerciseCategory, 
  type ExerciseDefinition 
} from '../lib/exerciseDictionary';
import type { PPLCategory } from '../lib/db';
import './ExerciseSelectorModal.css';

interface ExerciseSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (exercise: ExerciseDefinition) => void;
  onManualInput: () => void;
  initialCategory?: ExerciseCategory;
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
  initialCategory = '胸'
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory>(initialCategory);

  if (!isOpen) return null;

  const currentExercises = getExercisesByCategory(selectedCategory);

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

        {/* 7カテゴリー切り替えタブ */}
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

        {/* 種目一覧リスト */}
        <div className="exercise-items-scroll">
          <div className="exercise-items-list">
            {currentExercises.map(ex => {
              const badgeStyle = PPL_BADGE_COLORS[ex.ppl] || PPL_BADGE_COLORS['それ以外'];
              return (
                <div
                  key={ex.name}
                  className="exercise-select-item"
                  onClick={() => handleSelect(ex)}
                >
                  <div className="ex-item-info">
                    <span className="ex-item-name">{ex.name}</span>
                    <div className="ex-item-tags">
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
            })}
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
