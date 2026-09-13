import React, { useState, useMemo } from 'react';
import { X, Check, Plus } from 'lucide-react';
import { WheelPicker } from './WheelPicker';
import './SetPickerModal.css';

interface SetPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialWeight?: number;
  initialReps?: number;
  initialUnit?: 'kg' | 'lbs';
  isBodyweight?: boolean;
  setIndex: number;
  totalSets: number;
  onSave: (data: { weight: number; reps: number; unit: 'kg' | 'lbs'; addNext?: boolean }) => void;
}

// 10単位の配列 (0〜300)
const TENS_ITEMS: number[] = Array.from({ length: 31 }, (_, i) => i * 10);

// 0.5単位の配列 (0.0〜9.5)
const DECIMALS_ITEMS: number[] = Array.from({ length: 20 }, (_, i) => Math.round((i * 0.5) * 10) / 10);

// 回数の配列 (1〜50)
const REPS_ITEMS: number[] = Array.from({ length: 50 }, (_, i) => i + 1);

export const SetPickerModal: React.FC<SetPickerModalProps> = ({
  isOpen,
  onClose,
  initialWeight = 0,
  initialReps = 10,
  initialUnit = 'kg',
  isBodyweight = false,
  setIndex,
  totalSets,
  onSave
}) => {
  // initialWeightを10単位と0.5単位に分解
  const initTens = useMemo(() => {
    const validWeight = Math.max(0, initialWeight || 0);
    return Math.floor(validWeight / 10) * 10;
  }, [initialWeight]);

  const initDecimals = useMemo(() => {
    const validWeight = Math.max(0, initialWeight || 0);
    const remainder = Math.round((validWeight % 10) * 2) / 2; // 0.5単位に丸め
    return remainder;
  }, [initialWeight]);

  const [tens, setTens] = useState<number>(initTens);
  const [decimals, setDecimals] = useState<number>(initDecimals);
  const [reps, setReps] = useState<number>(initialReps || 10);
  const [unit, setUnit] = useState<'kg' | 'lbs'>(initialUnit || 'kg');

  // モーダルが開かれた時に状態をリセット
  React.useEffect(() => {
    if (isOpen) {
      setTens(initTens);
      setDecimals(initDecimals);
      setReps(initialReps || 10);
      setUnit(initialUnit || 'kg');
    }
  }, [isOpen, initTens, initDecimals, initialReps, initialUnit]);

  if (!isOpen) return null;

  const currentTotalWeight = Math.round((tens + decimals) * 10) / 10;

  const handleConfirm = (addNext = false) => {
    onSave({
      weight: currentTotalWeight,
      reps,
      unit,
      addNext
    });
    if (!addNext) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay set-picker-overlay" onClick={onClose}>
      <div className="set-picker-dialog card animate-in" onClick={e => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="set-picker-header">
          <div className="set-picker-title">
            <span className="set-badge">SET {setIndex + 1} / {Math.max(setIndex + 1, totalSets)}</span>
            <div className="set-current-preview">
              <span className="preview-weight">
                {isBodyweight ? `自重 + ${currentTotalWeight}` : currentTotalWeight}
                <span className="preview-unit">{unit}</span>
              </span>
              <span className="preview-divider">×</span>
              <span className="preview-reps">{reps} <span className="preview-unit">reps</span></span>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* 単位切り替えバー */}
        <div className="set-picker-unit-bar">
          <span className="unit-bar-label">重量単位</span>
          <div className="unit-toggle-group">
            <button
              type="button"
              className={`unit-toggle-btn ${unit === 'kg' ? 'active' : ''}`}
              onClick={() => setUnit('kg')}
            >
              kg
            </button>
            <button
              type="button"
              className={`unit-toggle-btn ${unit === 'lbs' ? 'active' : ''}`}
              onClick={() => setUnit('lbs')}
            >
              LB (ポンド)
            </button>
          </div>
        </div>

        {/* 3連ホイールスクロールピッカー */}
        <div className="set-picker-wheels-container">
          {/* 10単位 */}
          <WheelPicker
            label="重量 (10の位)"
            items={TENS_ITEMS}
            value={tens}
            onChange={setTens}
            formatItem={val => `${val}`}
          />

          {/* 0.5単位 */}
          <WheelPicker
            label="重量 (0.5刻み)"
            items={DECIMALS_ITEMS}
            value={decimals}
            onChange={setDecimals}
            formatItem={val => `+${val.toFixed(1)}`}
          />

          {/* 回数 */}
          <WheelPicker
            label="回数 (reps)"
            items={REPS_ITEMS}
            value={reps}
            onChange={setReps}
            formatItem={val => `${val} 回`}
          />
        </div>

        {/* クイック加算 / 自重リセット */}
        {isBodyweight && (
          <div className="bodyweight-quick-actions">
            <button
              type="button"
              className={`bw-quick-btn ${currentTotalWeight === 0 ? 'active' : ''}`}
              onClick={() => { setTens(0); setDecimals(0); }}
            >
              加重なし (自重 0kg)
            </button>
          </div>
        )}

        {/* アクションボタン */}
        <div className="set-picker-actions">
          <button
            type="button"
            className="picker-add-next-btn"
            onClick={() => handleConfirm(true)}
          >
            <Plus size={16} />
            <span>セット追加して次へ</span>
          </button>
          <button
            type="button"
            className="picker-save-btn"
            onClick={() => handleConfirm(false)}
          >
            <Check size={16} />
            <span>決定</span>
          </button>
        </div>
      </div>
    </div>
  );
};
