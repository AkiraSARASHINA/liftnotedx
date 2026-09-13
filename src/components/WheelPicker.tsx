import { useRef, useEffect, useCallback } from 'react';
import './WheelPicker.css';

interface WheelPickerProps<T extends string | number> {
  items: T[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  itemHeight?: number;
  visibleItems?: number;
  formatItem?: (item: T) => string;
}

export function WheelPicker<T extends string | number>({
  items,
  value,
  onChange,
  label,
  itemHeight = 42,
  visibleItems = 5,
  formatItem = (item) => String(item)
}: WheelPickerProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  const middleIndex = Math.floor(visibleItems / 2);
  const containerHeight = itemHeight * visibleItems;

  // 指定インデックスの位置へスクロール
  const scrollToIndex = useCallback((index: number, smooth = true) => {
    if (scrollRef.current) {
      const top = index * itemHeight;
      scrollRef.current.scrollTo({
        top,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  }, [itemHeight]);

  // 初期化または値が外部から変わったときにスクロール位置を同期
  useEffect(() => {
    if (isUserScrollingRef.current) return;
    const currentIndex = items.indexOf(value);
    if (currentIndex !== -1) {
      scrollToIndex(currentIndex, false);
    }
  }, [value, items, scrollToIndex]);

  // スクロール完了時に中央のアイテムを選択
  const handleScroll = () => {
    isUserScrollingRef.current = true;
    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = window.setTimeout(() => {
      if (!scrollRef.current) return;
      const scrollTop = scrollRef.current.scrollTop;
      const nearestIndex = Math.round(scrollTop / itemHeight);
      const clampedIndex = Math.max(0, Math.min(items.length - 1, nearestIndex));

      const selectedValue = items[clampedIndex];
      if (selectedValue !== undefined && selectedValue !== value) {
        onChange(selectedValue);
      }
      isUserScrollingRef.current = false;
    }, 100);
  };

  return (
    <div className="wheel-picker-wrapper">
      {label && <div className="wheel-picker-label">{label}</div>}
      <div 
        className="wheel-picker-container" 
        style={{ height: `${containerHeight}px` }}
      >
        {/* ハイライトバー（選択中の中央ライン） */}
        <div 
          className="wheel-picker-highlight" 
          style={{ 
            height: `${itemHeight}px`,
            top: `${middleIndex * itemHeight}px`
          }}
        />

        {/* スクロール要素 */}
        <div 
          ref={scrollRef}
          className="wheel-picker-scroll"
          onScroll={handleScroll}
        >
          {/* 上部パディング（中央に最初のアイテムが来るようにする） */}
          <div style={{ height: `${middleIndex * itemHeight}px`, flexShrink: 0 }} />

          {items.map((item, index) => {
            const isSelected = item === value;
            return (
              <div
                key={`${item}-${index}`}
                className={`wheel-picker-item ${isSelected ? 'selected' : ''}`}
                style={{ height: `${itemHeight}px`, lineHeight: `${itemHeight}px` }}
                onClick={() => {
                  onChange(item);
                  scrollToIndex(index, true);
                }}
              >
                {formatItem(item)}
              </div>
            );
          })}

          {/* 下部パディング（中央に最後のアイテムが来るようにする） */}
          <div style={{ height: `${middleIndex * itemHeight}px`, flexShrink: 0 }} />
        </div>
      </div>
    </div>
  );
}
