import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { 
  getAllWorkouts, 
  getWorkoutByDate, 
  saveWorkout, 
  deleteWorkout, 
  calculate1RM,
  parseEquipmentTags,
  type Workout, 
  type Exercise, 
  type WorkoutSet,
  type PPLCategory,
  type BodyPartCategory 
} from '../lib/db';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip 
} from 'recharts';
import { 
  Info, 
  Calendar as CalendarIcon, 
  List as ListIcon, 
  X, 
  Edit2, 
  Trash2, 
  Plus, 
  Save, 
  ChevronDown, 
  Dumbbell, 
  Activity, 
  RotateCcw, 
  Layers, 
  LayoutGrid,
  ChevronLeft,
  Flame
} from 'lucide-react';
import './Calendar.css';

type ViewMode = 'grid' | 'list';
type ModalView = 'summary' | 'edit_list';

const PPL_OPTIONS: PPLCategory[] = ['プッシュ', 'プル', 'レッグ', 'それ以外'];
const BODY_PART_OPTIONS: BodyPartCategory[] = ['胸', '背中', '脚', '肩', '腕', 'それ以外'];

const PPL_COLORS: Record<PPLCategory, string> = {
  'プッシュ': '#ff2d55',
  'プル': '#00a3ff',
  'レッグ': '#00e5a3',
  'それ以外': '#8e8e93'
};

const BODY_PART_COLORS: Record<BodyPartCategory, string> = {
  '胸': '#ff2d55',
  '背中': '#00a3ff',
  '脚': '#34c759',
  '肩': '#ff9500',
  '腕': '#af52de',
  'それ以外': '#8e8e93'
};

const CalendarPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [allWorkouts, setAllWorkouts] = useState<Workout[]>([]);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [modalView, setModalView] = useState<ModalView>('summary');
  const [summaryFontSize, setSummaryFontSize] = useState<'small' | 'medium' | 'large'>('small');
  const [calendarRingMode, setCalendarRingMode] = useState<'ppl' | 'bodypart' | 'none'>('ppl');
  
  // Edit/Add states
  const [editingExerciseIndex, setEditingExerciseIndex] = useState<number | null>(null);
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [editForm, setEditForm] = useState<Exercise>({
    name: '',
    equipment: '',
    ppl: undefined,
    bodyPart: undefined,
    isBodyweight: false,
    note: '',
    sets: [{ weight: 0, reps: 0 }]
  });

  const [monthsToDisplay, setMonthsToDisplay] = useState<Date[]>([]);
  const [uniqueNames, setUniqueNames] = useState<string[]>([]);
  const [uniqueEquipments, setUniqueEquipments] = useState<string[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const listScrollContainerRef = useRef<HTMLDivElement>(null);

  // 各ビューモードのスクロール位置記憶Ref
  const lastScrollTopGridRef = useRef<number | null>(null);
  const lastScrollTopListRef = useRef<number | null>(null);

  // 各ビューモードの初回スクロール完了フラグ
  const initialScrollGridRef = useRef<boolean>(false);
  const initialScrollListRef = useRef<boolean>(false);

  useEffect(() => {
    loadWorkouts(true);
    loadUniqueNames();
    
    const syncSettings = () => {
      const storedRingMode = (localStorage.getItem('settings_calendar_ring_mode') as 'ppl' | 'bodypart' | 'none') || 'ppl';
      setCalendarRingMode(storedRingMode);
      const storedFontSize = (localStorage.getItem('settings_summary_font_size') as 'small' | 'medium' | 'large') || 'small';
      setSummaryFontSize(storedFontSize);
    };

    syncSettings();
    window.addEventListener('focus', syncSettings);

    // カレンダーページでは.contentのスクロールを無効化し、
    // カレンダー/リスト内部のスクロールのみを有効にする
    const contentEl = document.querySelector('.content') as HTMLElement;
    if (contentEl) {
      contentEl.style.overflowY = 'hidden';
    }
    return () => {
      window.removeEventListener('focus', syncSettings);
      if (contentEl) {
        contentEl.style.overflowY = 'auto';
      }
    };
  }, []);

  // 超軽量CSS conic-gradient 生成ヘルパー
  const generateConicGradient = (
    items: { name: string; value: number }[],
    colorMap: Record<string, string>
  ): string => {
    const activeItems = items.filter(i => i.value > 0);
    const total = activeItems.reduce((sum, i) => sum + i.value, 0);
    if (total === 0 || activeItems.length === 0) return 'rgba(255, 255, 255, 0.08)';
    if (activeItems.length === 1) {
      return colorMap[activeItems[0].name] || '#8e8e93';
    }

    let currentPct = 0;
    const segments: string[] = [];
    activeItems.forEach((item, idx) => {
      const color = colorMap[item.name] || '#8e8e93';
      const isLast = idx === activeItems.length - 1;
      const nextPct = isLast ? 100 : Math.round(currentPct + (item.value / total) * 100);
      segments.push(`${color} ${currentPct}% ${nextPct}%`);
      currentPct = nextPct;
    });

    return `conic-gradient(${segments.join(', ')})`;
  };

  // 日付セルのconic-gradient生成ヘルパー
  const getDayRingGradient = (workout: Workout | undefined, mode: 'ppl' | 'bodypart' | 'none'): string | null => {
    if (!workout || mode === 'none' || !workout.exercises || workout.exercises.length === 0) {
      return null;
    }

    const repsMap: Record<string, number> = {};
    let totalReps = 0;

    workout.exercises.forEach(ex => {
      const reps = ex.sets.reduce((sum, s) => sum + s.reps, 0);
      totalReps += reps;
      if (mode === 'ppl') {
        const cat = ex.ppl || 'それ以外';
        repsMap[cat] = (repsMap[cat] || 0) + reps;
      } else {
        const cat = ex.bodyPart || 'それ以外';
        repsMap[cat] = (repsMap[cat] || 0) + reps;
      }
    });

    if (totalReps === 0) return null;

    const colorMap = mode === 'ppl' ? PPL_COLORS : BODY_PART_COLORS;
    const entries = Object.entries(repsMap)
      .filter(([_, val]) => val > 0)
      .map(([name, value]) => ({ name, value }));

    if (entries.length === 0) return null;
    return generateConicGradient(entries, colorMap as any);
  };

  const loadUniqueNames = async () => {
    const { getUniqueExerciseNames, getUniqueEquipmentNames } = await import('../lib/db');
    const [names, equipments] = await Promise.all([
      getUniqueExerciseNames(),
      getUniqueEquipmentNames()
    ]);
    setUniqueNames(names);
    setUniqueEquipments(equipments);
  };

  const loadWorkouts = async (isInitial = false) => {
    const data = await getAllWorkouts();
    setAllWorkouts(data);
    
    // Initial display of last 6 months
    if (isInitial && monthsToDisplay.length === 0) {
      const initialMonths = [];
      const current = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(current);
        d.setMonth(d.getMonth() - i);
        initialMonths.push(d);
      }
      setMonthsToDisplay(initialMonths);
    }

    // Refresh selected workout if modal is open
    if (selectedDateStr) {
      const updated = await getWorkoutByDate(selectedDateStr);
      setSelectedWorkout(updated || null);
    }
  };

  const workoutObjectMap = useMemo(() => {
    const map: Record<string, Workout> = {};
    allWorkouts.forEach(w => {
      if (w.exercises && w.exercises.length > 0) {
        map[w.date] = w;
      }
    });
    return map;
  }, [allWorkouts]);

  const sortedWorkouts = useMemo(() => {
    return allWorkouts
      .filter(w => w.exercises && w.exercises.length > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [allWorkouts]);

  // 初回表示時の最下部スクロール & ビュー切り替え時の位置復元
  useLayoutEffect(() => {
    if (viewMode === 'grid' && scrollContainerRef.current) {
      const el = scrollContainerRef.current;
      if (!initialScrollGridRef.current && monthsToDisplay.length > 0) {
        el.scrollTop = el.scrollHeight;
        initialScrollGridRef.current = true;
      } else if (lastScrollTopGridRef.current !== null) {
        el.scrollTop = lastScrollTopGridRef.current;
      }
    } else if (viewMode === 'list' && listScrollContainerRef.current) {
      const el = listScrollContainerRef.current;
      if (!initialScrollListRef.current && sortedWorkouts.length > 0) {
        el.scrollTop = el.scrollHeight;
        initialScrollListRef.current = true;
      } else if (lastScrollTopListRef.current !== null) {
        el.scrollTop = lastScrollTopListRef.current;
      }
    }
  }, [viewMode, monthsToDisplay.length, sortedWorkouts.length]);

  const handleDateClick = async (dateStr: string) => {
    const workout = await getWorkoutByDate(dateStr);
    setSelectedDateStr(dateStr);
    setSelectedWorkout(workout || null);
    
    // フォントサイズ設定の読み込み
    const storedFontSize = (localStorage.getItem('settings_summary_font_size') as 'small' | 'medium' | 'large') || 'small';
    setSummaryFontSize(storedFontSize);

    if (workout && workout.exercises && workout.exercises.length > 0) {
      setModalView('summary');
      setEditingExerciseIndex(null);
      setIsAddingExercise(false);
    } else {
      setModalView('edit_list');
      setIsAddingExercise(true);
      setEditForm({
        name: '',
        equipment: '',
        ppl: undefined,
        bodyPart: undefined,
        isBodyweight: false,
        note: '',
        sets: [{ weight: 0, reps: 0 }]
      });
    }

    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedDateStr('');
    setSelectedWorkout(null);
    setEditingExerciseIndex(null);
    setIsAddingExercise(false);
  };

  // --- Edit/Delete Logic ---

  const handleDeleteDay = async () => {
    if (!window.confirm('この日の記録をすべて削除します。この操作は取り消せません。本当に実行しますか？')) return;
    await deleteWorkout(selectedDateStr);
    handleCloseModal();
    loadWorkouts();
  };

  const handleDeleteExercise = async (index: number) => {
    if (!selectedWorkout) return;
    if (!window.confirm('この種目を削除します。この操作は取り消せません。本当に実行しますか？')) return;
    
    const updatedExercises = [...selectedWorkout.exercises];
    updatedExercises.splice(index, 1);
    
    if (updatedExercises.length === 0) {
      await deleteWorkout(selectedDateStr);
      handleCloseModal();
    } else {
      await saveWorkout({ ...selectedWorkout, exercises: updatedExercises });
    }
    loadWorkouts();
  };

  const startEdit = (index: number) => {
    if (!selectedWorkout) return;
    const ex = selectedWorkout.exercises[index];
    setEditingExerciseIndex(index);
    setEditForm({ ...ex, sets: [...ex.sets.map(s => ({ ...s }))] });
    loadUniqueNames();
  };

  const startAdd = () => {
    setIsAddingExercise(true);
    setEditForm({
      name: '',
      equipment: '',
      ppl: undefined,
      bodyPart: undefined,
      isBodyweight: false,
      note: '',
      sets: [{ weight: 0, reps: 0 }]
    });
    loadUniqueNames();
  };

  const saveEdit = async () => {
    // Confirmation only for EDITING existing exercises, not for ADDING
    if (editingExerciseIndex !== null) {
      if (!window.confirm('既存の種目データを修正して上書き保存します。よろしいですか？')) return;
    }

    if (!selectedWorkout || !selectedDateStr) {
      // Manual add to a day that doesn't have a record yet
      const newWorkout: Workout = {
        date: selectedDateStr,
        exercises: [editForm],
        updatedAt: '', // saveWorkout 内で自動設定される
      };
      await saveWorkout(newWorkout);
    } else {
      const updatedExercises = [...selectedWorkout.exercises];
      if (editingExerciseIndex !== null) {
        updatedExercises[editingExerciseIndex] = editForm;
      } else {
        updatedExercises.push(editForm);
      }
      await saveWorkout({ ...selectedWorkout, exercises: updatedExercises });
    }
    
    setEditingExerciseIndex(null);
    setIsAddingExercise(false);
    loadWorkouts();
    loadUniqueNames();
  };

  const addSet = () => {
    setEditForm({
      ...editForm,
      sets: [...editForm.sets, { weight: 0, reps: 0 }]
    });
  };

  const removeSet = (index: number) => {
    const updated = [...editForm.sets];
    updated.splice(index, 1);
    setEditForm({ ...editForm, sets: updated });
  };

  const handleSetChange = (index: number, field: keyof WorkoutSet, value: number) => {
    const updated = [...editForm.sets];
    updated[index] = { ...updated[index], [field]: value };
    setEditForm({ ...editForm, sets: updated });
  };

  // --- Rendering Helpers ---

  const getDayOfWeek = (dateStr: string) => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const d = new Date(dateStr);
    return days[d.getDay()];
  };

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  // 現在月が表示範囲に含まれているか
  const isCurrentMonthVisible = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    return monthsToDisplay.some(m => m.getFullYear() === currentYear && m.getMonth() === currentMonth);
  }, [monthsToDisplay]);

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    const lastDisplayed = monthsToDisplay[monthsToDisplay.length - 1];
    // 最後に表示された月から今月までの月を追加
    const newMonths: Date[] = [];
    const d = new Date(lastDisplayed);
    d.setMonth(d.getMonth() + 1);
    while (d.getFullYear() < now.getFullYear() || (d.getFullYear() === now.getFullYear() && d.getMonth() <= now.getMonth())) {
      newMonths.push(new Date(d));
      d.setMonth(d.getMonth() + 1);
    }
    if (newMonths.length > 0) {
      setMonthsToDisplay([...monthsToDisplay, ...newMonths]);
      // スクロールを一番下に移動（新しい月が追加された後）
      setTimeout(scrollToBottom, 100);
    }
  };

  const renderMonthGrid = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthLabel = date.toLocaleString('ja-JP', { year: 'numeric', month: 'long' });

    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${year}-${month}-${i}`} className="calendar-day empty"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const workout = workoutObjectMap[dStr];
      const hasWorkout = !!workout;
      const ringGradient = getDayRingGradient(workout, calendarRingMode);
      const isSelected = dStr === selectedDateStr;
      const isFuture = dStr > todayStr;
      const isToday = dStr === todayStr;

      days.push(
        <div 
          key={dStr} 
          className={`calendar-day ${hasWorkout ? 'has-workout' : ''} ${ringGradient ? 'has-ring' : ''} ${isSelected ? 'selected' : ''} ${isFuture ? 'future' : ''} ${isToday ? 'today' : ''}`}
          onClick={() => !isFuture && handleDateClick(dStr)}
        >
          {ringGradient ? (
            <div 
              className="day-ring" 
              style={{ background: ringGradient }}
            >
              <div className="day-ring-inner">
                <span className="day-number">{d}</span>
              </div>
            </div>
          ) : (
            <>
              <span className="day-number">{d}</span>
              {hasWorkout && <div className="dot"></div>}
            </>
          )}
        </div>
      );
    }

    return (
      <div key={`${year}-${month}`} className="month-section">
        <h3 className="month-label">{monthLabel}</h3>
        <div className="calendar-weekdays">
          {['日', '月', '火', '水', '木', '金', '土'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="calendar-grid">
          {days}
        </div>
      </div>
    );
  };

  const renderEditForm = () => (
    <div className="edit-form card animate-in">
      <div className="form-header">
        <h4>{editingExerciseIndex !== null ? '種目の編集' : '種目の追加'}</h4>
        <button className="close-btn" onClick={() => { setEditingExerciseIndex(null); setIsAddingExercise(false); }}>
          <X size={18} />
        </button>
      </div>
      
      <div className="form-group">
        <label>種目名</label>
        <input 
          type="text" 
          list="exercise-options"
          value={editForm.name} 
          onChange={e => setEditForm({ ...editForm, name: e.target.value })}
          placeholder="例: ベンチプレス"
        />
        <datalist id="exercise-options">
          {uniqueNames.map(name => <option key={name} value={name} />)}
        </datalist>
      </div>

      <div className="form-group">
        <label>マシン・器具 / タグ（複数可）</label>
        <input 
          type="text" 
          list="equipment-options"
          value={editForm.equipment || ''} 
          onChange={e => setEditForm({ ...editForm, equipment: e.target.value })}
          placeholder="例: ノーチラス, 大円筋（カンマ区切りで複数可）"
        />
        <datalist id="equipment-options">
          {uniqueEquipments.map(eq => <option key={eq} value={eq} />)}
        </datalist>
      </div>

      <div className="form-group">
        <label>PPL 分類</label>
        <div className="category-pill-group">
          {PPL_OPTIONS.map(opt => (
            <button
              key={opt}
              type="button"
              className={`category-pill ${editForm.ppl === opt ? 'active' : ''}`}
              onClick={() => setEditForm({ ...editForm, ppl: editForm.ppl === opt ? undefined : opt })}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>5分割法（部位）</label>
        <div className="category-pill-group">
          {BODY_PART_OPTIONS.map(opt => (
            <button
              key={opt}
              type="button"
              className={`category-pill ${editForm.bodyPart === opt ? 'active' : ''}`}
              onClick={() => setEditForm({ ...editForm, bodyPart: editForm.bodyPart === opt ? undefined : opt })}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group row">
        <label>
          <input 
            type="checkbox" 
            checked={editForm.isBodyweight} 
            onChange={e => setEditForm({ ...editForm, isBodyweight: e.target.checked })} 
          />
          自重種目
        </label>
      </div>

      <div className="form-group">
        <label>セット内容</label>
        {editForm.sets.map((set, i) => (
          <div key={i} className="edit-set-row">
            <span className="set-label">{i + 1}</span>
            <input 
              type="number" 
              value={set.weight !== undefined && set.weight !== null ? set.weight || '' : ''} 
              onChange={e => handleSetChange(i, 'weight', parseFloat(e.target.value) || 0)}
              placeholder={editForm.isBodyweight ? '+kg' : 'kg'}
            />
            <input 
              type="number" 
              value={set.reps || ''} 
              onChange={e => handleSetChange(i, 'reps', parseInt(e.target.value) || 0)}
              placeholder="回数"
            />
            {!editForm.isBodyweight && set.weight && set.reps && editForm.bodyPart ? (
              (() => {
                const oneRM = calculate1RM(set.weight, set.reps, editForm.bodyPart);
                return oneRM !== undefined ? (
                  <span className="edit-set-1rm" title={`${editForm.bodyPart}向け 推定1RM`}>
                    1RM: {oneRM}kg
                  </span>
                ) : null;
              })()
            ) : null}
            <button className="remove-set-btn" onClick={() => removeSet(i)}>
              <X size={14} />
            </button>
          </div>
        ))}
        <button className="add-set-btn" onClick={addSet}>
          <Plus size={14} /> セットを追加
        </button>
      </div>

      <div className="form-group">
        <label>備考</label>
        <textarea 
          value={editForm.note} 
          onChange={e => setEditForm({ ...editForm, note: e.target.value })}
          placeholder="メモを入力..."
        />
      </div>

      <button className="btn-primary save-edit-btn" onClick={saveEdit}>
        <Save size={18} />
        保存する
      </button>
    </div>
  );

  return (
    <div className="calendar-page">
      <div className="view-toggle glass">
        <button 
          className={viewMode === 'grid' ? 'active' : ''} 
          onClick={() => setViewMode('grid')}
        >
          <CalendarIcon size={18} />
          カレンダー
        </button>
        <button 
          className={viewMode === 'list' ? 'active' : ''} 
          onClick={() => setViewMode('list')}
        >
          <ListIcon size={18} />
          リスト
        </button>
      </div>

      <div 
        className={`vertical-calendar card ${viewMode === 'grid' ? 'animate-in' : 'hidden'}`} 
        ref={scrollContainerRef}
        onScroll={(e) => {
          lastScrollTopGridRef.current = e.currentTarget.scrollTop;
        }}
      >
        <button className="load-more-btn top" onClick={() => {
          const container = scrollContainerRef.current;
          const previousScrollHeight = container ? container.scrollHeight : 0;
          const previousScrollTop = container ? container.scrollTop : 0;

          const lastMonth = monthsToDisplay[0];
          const newMonths = [];
          for (let i = 6; i >= 1; i--) {
            const d = new Date(lastMonth);
            d.setMonth(d.getMonth() - i);
            newMonths.push(d);
          }
          setMonthsToDisplay([...newMonths, ...monthsToDisplay]);

          // DOM更新後に過去月が上に追加された分の高さを補正して見ていた位置を維持
          requestAnimationFrame(() => {
            if (container) {
              const heightDiff = container.scrollHeight - previousScrollHeight;
              container.scrollTop = previousScrollTop + heightDiff;
              lastScrollTopGridRef.current = container.scrollTop;
            }
          });
        }}>
          さらに過去を読み込む
        </button>
        {monthsToDisplay.map(m => renderMonthGrid(m))}
        {!isCurrentMonthVisible && (
          <button className="load-more-btn bottom" onClick={goToCurrentMonth}>
            <ChevronDown size={16} />
            今月へ
          </button>
        )}
      </div>

      <div 
        className={`timeline-list ${viewMode === 'list' ? 'animate-in' : 'hidden'}`} 
        ref={listScrollContainerRef}
        onScroll={(e) => {
          lastScrollTopListRef.current = e.currentTarget.scrollTop;
        }}
      >
          {sortedWorkouts.map((w) => {
            const totalSets = w.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
            const totalReps = w.exercises.reduce((sum, ex) => sum + ex.sets.reduce((sSum, s) => sSum + s.reps, 0), 0);
            const exerciseCount = w.exercises.length;

            // PPL集計
            const pplRepsMap: Record<string, number> = {};
            w.exercises.forEach(ex => {
              const cat = ex.ppl || 'それ以外';
              const reps = ex.sets.reduce((sSum, s) => sSum + s.reps, 0);
              pplRepsMap[cat] = (pplRepsMap[cat] || 0) + reps;
            });
            const pplData = Object.entries(pplRepsMap)
              .filter(([_, val]) => val > 0)
              .map(([name, value]) => ({ name, value }));

            // 5分割部位集計
            const bodyPartRepsMap: Record<string, number> = {};
            w.exercises.forEach(ex => {
              const cat = ex.bodyPart || 'それ以外';
              const reps = ex.sets.reduce((sSum, s) => sSum + s.reps, 0);
              bodyPartRepsMap[cat] = (bodyPartRepsMap[cat] || 0) + reps;
            });
            const bodyPartData = Object.entries(bodyPartRepsMap)
              .filter(([_, val]) => val > 0)
              .map(([name, value]) => ({ name, value }));

            return (
              <div key={w.date} className="timeline-item card" onClick={() => handleDateClick(w.date)}>
                <div className="timeline-date">
                  <span className="date-main">{parseInt(w.date.split('-')[1], 10)}/{parseInt(w.date.split('-')[2], 10)}</span>
                  <span className="date-sub">{w.date.split('-')[0]} ({getDayOfWeek(w.date)})</span>
                </div>

                <div className="timeline-metrics">
                  <div className="metrics-inline">
                    <div className="metric-unit">
                      <span className="metric-num">{exerciseCount}</span>
                      <span className="metric-label">種目</span>
                    </div>
                    <span className="metric-divider">/</span>
                    <div className="metric-unit">
                      <span className="metric-num">{totalSets}</span>
                      <span className="metric-label">sets</span>
                    </div>
                    <span className="metric-divider">/</span>
                    <div className="metric-unit">
                      <span className="metric-num">{totalReps}</span>
                      <span className="metric-label">reps</span>
                    </div>
                  </div>
                </div>

                {(() => {
                  const pplGradient = generateConicGradient(pplData, PPL_COLORS as any);
                  const bodyPartGradient = generateConicGradient(bodyPartData, BODY_PART_COLORS as any);

                  return (
                    <div className="timeline-charts">
                      {/* PPL Mini Donut */}
                      <div className="mini-chart-box" title="PPL比率（レップ数）">
                        <div className="mini-pie-wrapper">
                          <div className="mini-donut-ring" style={{ background: pplGradient }}>
                            <div className="mini-donut-inner" />
                          </div>
                        </div>
                        <span className="mini-chart-lbl ppl">PPL</span>
                      </div>

                      {/* 5分割部位 Mini Donut */}
                      <div className="mini-chart-box" title="5分割部位比率（レップ数）">
                        <div className="mini-pie-wrapper">
                          <div className="mini-donut-ring" style={{ background: bodyPartGradient }}>
                            <div className="mini-donut-inner" />
                          </div>
                        </div>
                        <span className="mini-chart-lbl bodypart">部位</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>

        {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content card detail-modal" onClick={e => e.stopPropagation()}>
            
            {/* --- サマリー画面 --- */}
            {modalView === 'summary' && selectedWorkout && selectedWorkout.exercises && selectedWorkout.exercises.length > 0 ? (
              (() => {
                const exercises = selectedWorkout.exercises;
                const totalVolume = exercises.reduce((sum, ex) => sum + ex.sets.reduce((sSum, s) => sSum + (s.weight || 0) * s.reps, 0), 0);
                const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
                const totalReps = exercises.reduce((sum, ex) => sum + ex.sets.reduce((sSum, s) => sSum + s.reps, 0), 0);

                // --- 自己ベスト（PB🔥）判定ロジック ---
                const pastWorkouts = allWorkouts.filter(w => w.date < selectedDateStr);
                const pbExerciseDetails = exercises.map(ex => {
                  const todayMaxWeight = Math.max(...ex.sets.map(s => s.weight || 0));
                  const todayMax1RM = ex.sets.reduce((max, s) => {
                    const oneRM = !ex.isBodyweight ? (s.estimated1RM || calculate1RM(s.weight, s.reps, ex.bodyPart) || 0) : 0;
                    return Math.max(max, oneRM);
                  }, 0);
                  const todayTotalReps = ex.sets.reduce((sum, s) => sum + s.reps, 0);
                  const todayTotalVolume = ex.sets.reduce((sum, s) => sum + (s.weight || 0) * s.reps, 0);

                  // 過去の同種目セッションを集計（日単位でMAX重量、MAX 1RM、総レップ数、総ボリューム）
                  const pastSessions: {
                    maxWeight: number;
                    max1RM: number;
                    totalReps: number;
                    totalVolume: number;
                  }[] = [];

                  pastWorkouts.forEach(pw => {
                    const matchingExs = pw.exercises.filter(pe => pe.name === ex.name);
                    matchingExs.forEach(pe => {
                      const pMaxWeight = Math.max(...pe.sets.map(s => s.weight || 0));
                      const pMax1RM = pe.sets.reduce((max, s) => {
                        const oneRM = !pe.isBodyweight ? (s.estimated1RM || calculate1RM(s.weight, s.reps, pe.bodyPart) || 0) : 0;
                        return Math.max(max, oneRM);
                      }, 0);
                      const pTotalReps = pe.sets.reduce((sum, s) => sum + s.reps, 0);
                      const pTotalVolume = pe.sets.reduce((sum, s) => sum + (s.weight || 0) * s.reps, 0);

                      pastSessions.push({
                        maxWeight: pMaxWeight,
                        max1RM: pMax1RM,
                        totalReps: pTotalReps,
                        totalVolume: pTotalVolume,
                      });
                    });
                  });

                  const hasPastHistory = pastSessions.length > 0;
                  const pastMaxWeight = hasPastHistory ? Math.max(...pastSessions.map(s => s.maxWeight)) : 0;
                  const pastMax1RM = hasPastHistory ? Math.max(...pastSessions.map(s => s.max1RM)) : 0;
                  const pastMaxTotalReps = hasPastHistory ? Math.max(...pastSessions.map(s => s.totalReps)) : 0;
                  const pastMaxTotalVolume = hasPastHistory ? Math.max(...pastSessions.map(s => s.totalVolume)) : 0;

                  const reasons: string[] = [];

                  if (hasPastHistory) {
                    if (todayMaxWeight > pastMaxWeight && todayMaxWeight > 0) {
                      reasons.push(`MAX重量 (${pastMaxWeight}kg → ${todayMaxWeight}kg)`);
                    }
                    if (!ex.isBodyweight && todayMax1RM > pastMax1RM && todayMax1RM > 0) {
                      reasons.push(`推定1RM (${pastMax1RM}kg → ${todayMax1RM}kg)`);
                    }
                    if (todayTotalVolume > pastMaxTotalVolume && todayTotalVolume > 0) {
                      reasons.push(`総ボリューム (${pastMaxTotalVolume.toLocaleString()}kg → ${todayTotalVolume.toLocaleString()}kg)`);
                    }
                    if (todayTotalReps > pastMaxTotalReps && todayTotalReps > 0) {
                      reasons.push(`総レップ数 (${pastMaxTotalReps}回 → ${todayTotalReps}回)`);
                    }
                  }

                  return {
                    name: ex.name,
                    isPB: reasons.length > 0,
                    reasons,
                    maxWeight: todayMaxWeight,
                    max1RM: todayMax1RM > 0 ? todayMax1RM : undefined
                  };
                });

                const pbList = pbExerciseDetails.filter(p => p.isPB);

                // PPL割合集計（レップ数基準）
                const pplRepsMap: Record<string, number> = {};
                exercises.forEach(ex => {
                  const cat = ex.ppl || 'それ以外';
                  const reps = ex.sets.reduce((sSum, s) => sSum + s.reps, 0);
                  pplRepsMap[cat] = (pplRepsMap[cat] || 0) + reps;
                });
                const pplData = Object.entries(pplRepsMap)
                  .filter(([_, val]) => val > 0)
                  .map(([name, value]) => ({ name, value }));

                const pplLegendList = PPL_OPTIONS.map(cat => ({
                  name: cat,
                  value: pplRepsMap[cat] || 0
                }));

                // 5分割部位割合集計（レップ数基準）
                const bodyPartRepsMap: Record<string, number> = {};
                exercises.forEach(ex => {
                  const cat = ex.bodyPart || 'それ以外';
                  const reps = ex.sets.reduce((sSum, s) => sSum + s.reps, 0);
                  bodyPartRepsMap[cat] = (bodyPartRepsMap[cat] || 0) + reps;
                });
                const bodyPartData = Object.entries(bodyPartRepsMap)
                  .filter(([_, val]) => val > 0)
                  .map(([name, value]) => ({ name, value }));

                const bodyPartLegendList = BODY_PART_OPTIONS.map(cat => ({
                  name: cat,
                  value: bodyPartRepsMap[cat] || 0
                }));

                return (
                  <div className="workout-summary-container animate-in">
                    <div className="modal-header">
                      <div className="summary-title-group">
                        <span className="summary-badge">DAY SUMMARY</span>
                        <h3>{selectedDateStr} ({getDayOfWeek(selectedDateStr)})</h3>
                      </div>
                      <div className="header-actions">
                        <button 
                          className="icon-btn-text primary-action-btn" 
                          onClick={() => setModalView('edit_list')}
                          title="記録を編集"
                        >
                          <Edit2 size={15} />
                          <span>編集する</span>
                        </button>
                        <button className="icon-btn delete-day" onClick={handleDeleteDay} title="日の削除">
                          <Trash2 size={18} />
                        </button>
                        <button className="close-btn" onClick={handleCloseModal}><X size={20} /></button>
                      </div>
                    </div>

                    {/* クイック統計バー */}
                    <div className="summary-kpi-grid">
                      <div className="summary-kpi-card">
                        <span className="kpi-label">総ボリューム</span>
                        <div className="kpi-val-row">
                          <span className="kpi-value">{totalVolume.toLocaleString()}</span>
                          <span className="kpi-unit">kg</span>
                        </div>
                      </div>
                      <div className="summary-kpi-card">
                        <span className="kpi-label">総セット数</span>
                        <div className="kpi-val-row">
                          <span className="kpi-value">{totalSets}</span>
                          <span className="kpi-unit">sets</span>
                        </div>
                      </div>
                      <div className="summary-kpi-card">
                        <span className="kpi-label">総レップ数</span>
                        <div className="kpi-val-row">
                          <span className="kpi-value">{totalReps}</span>
                          <span className="kpi-unit">reps</span>
                        </div>
                      </div>
                      <div className="summary-kpi-card">
                        <span className="kpi-label">種目数</span>
                        <div className="kpi-val-row">
                          <span className="kpi-value">{exercises.length}</span>
                          <span className="kpi-unit">種目</span>
                        </div>
                      </div>
                    </div>

                    {/* 自己ベスト（PB🔥）達成カード */}
                    {pbList.length > 0 && (
                      <div className="summary-pb-banner animate-in">
                        <div className="pb-banner-header">
                          <Flame size={16} color="#ff9500" />
                          <span>本日更新された自己ベスト (PB)</span>
                        </div>
                        <div className="pb-banner-items">
                          {pbList.map((pb, pidx) => (
                            <div key={pidx} className="pb-banner-group">
                              <div className="pb-group-header">
                                <span className="pb-item-name">{pb.name}</span>
                                {pb.reasons.length > 1 && (
                                  <span className="pb-count-chip">{pb.reasons.length}項目更新🔥</span>
                                )}
                              </div>
                              <div className="pb-reasons-list">
                                {pb.reasons.map((r, ri) => (
                                  <span key={ri} className="pb-reason-pill">{r}</span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 比率ドーナツグラフ（PPL & 5分割部位） */}
                    <div className="summary-charts-grid">
                      {/* PPL 比率 */}
                      <div className="summary-chart-card">
                        <div className="summary-chart-header">
                          <Activity size={14} color="#ff2d55" />
                          <h4>PPL比率（レップ数）</h4>
                        </div>
                        <div className="summary-chart-body">
                          <div className="pie-wrapper">
                            <ResponsiveContainer width={84} height={84}>
                              <PieChart>
                                <Pie
                                  data={pplData}
                                  innerRadius={22}
                                  outerRadius={38}
                                  paddingAngle={2}
                                  dataKey="value"
                                >
                                  {pplData.map((entry) => (
                                    <Cell 
                                      key={`cell-ppl-${entry.name}`} 
                                      fill={PPL_COLORS[entry.name as PPLCategory] || '#8e8e93'} 
                                    />
                                  ))}
                                </Pie>
                                <RechartsTooltip 
                                  formatter={(val: any, name: any) => [`${val} 回 (${totalReps > 0 ? Math.round((Number(val) / totalReps) * 100) : 0}%)`, name]}
                                  contentStyle={{ background: '#1c1c1e', border: '1px solid #333', borderRadius: '8px', fontSize: '11px' }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="pie-legend">
                            {pplLegendList.map((d) => {
                              const pct = totalReps > 0 ? Math.round((d.value / totalReps) * 100) : 0;
                              return (
                                <div key={d.name} className="legend-item">
                                  <span className="legend-dot" style={{ background: PPL_COLORS[d.name as PPLCategory] || '#8e8e93' }} />
                                  <span className="legend-name">{d.name}</span>
                                  <span className="legend-pct">{pct}%</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* 5分割部位 比率 */}
                      <div className="summary-chart-card">
                        <div className="summary-chart-header">
                          <Layers size={14} color="#af52de" />
                          <h4>5分割比率（レップ数）</h4>
                        </div>
                        <div className="summary-chart-body">
                          <div className="pie-wrapper">
                            <ResponsiveContainer width={84} height={84}>
                              <PieChart>
                                <Pie
                                  data={bodyPartData}
                                  innerRadius={22}
                                  outerRadius={38}
                                  paddingAngle={2}
                                  dataKey="value"
                                >
                                  {bodyPartData.map((entry) => (
                                    <Cell 
                                      key={`cell-bp-${entry.name}`} 
                                      fill={BODY_PART_COLORS[entry.name as BodyPartCategory] || '#8e8e93'} 
                                    />
                                  ))}
                                </Pie>
                                <RechartsTooltip 
                                  formatter={(val: any, name: any) => [`${val} 回 (${totalReps > 0 ? Math.round((Number(val) / totalReps) * 100) : 0}%)`, name]}
                                  contentStyle={{ background: '#1c1c1e', border: '1px solid #333', borderRadius: '8px', fontSize: '11px' }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="pie-legend">
                            {bodyPartLegendList.map((d) => {
                              const pct = totalReps > 0 ? Math.round((d.value / totalReps) * 100) : 0;
                              return (
                                <div key={d.name} className="legend-item">
                                  <span className="legend-dot" style={{ background: BODY_PART_COLORS[d.name as BodyPartCategory] || '#8e8e93' }} />
                                  <span className="legend-name">{d.name}</span>
                                  <span className="legend-pct">{pct}%</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* コンパクト種目・セット一覧 */}
                    <div className="summary-section-header">
                      <h4>実施種目一覧</h4>
                    </div>
                    <div className={`summary-compact-list summary-font-${summaryFontSize}`}>
                      {exercises.map((ex, i) => (
                        <div key={i} className="summary-compact-item">
                          <div className="compact-header-row">
                            <span className="compact-num">#{i + 1}</span>
                            <span className="compact-name">{ex.name}</span>
                            {parseEquipmentTags(ex.equipment).map((tag, ti) => (
                              <span key={ti} className="compact-chip eq">{tag}</span>
                            ))}
                            {pbExerciseDetails[i]?.isPB && (
                              <span 
                                className="compact-pb-badge" 
                                title={pbExerciseDetails[i]?.reasons.join('\n')}
                              >
                                🔥PB{pbExerciseDetails[i]?.reasons.length > 1 ? ` (${pbExerciseDetails[i]?.reasons.length})` : ''}
                              </span>
                            )}
                            <div className="compact-category-chips">
                              {ex.ppl && (
                                <span 
                                  className="compact-chip ppl"
                                  style={{
                                    color: PPL_COLORS[ex.ppl] || '#8e8e93',
                                    background: `${PPL_COLORS[ex.ppl] || '#8e8e93'}18`,
                                    borderColor: `${PPL_COLORS[ex.ppl] || '#8e8e93'}40`
                                  }}
                                >
                                  {ex.ppl}
                                </span>
                              )}
                              {ex.bodyPart && (
                                <span 
                                  className="compact-chip bodypart"
                                  style={{
                                    color: BODY_PART_COLORS[ex.bodyPart] || '#8e8e93',
                                    background: `${BODY_PART_COLORS[ex.bodyPart] || '#8e8e93'}18`,
                                    borderColor: `${BODY_PART_COLORS[ex.bodyPart] || '#8e8e93'}40`
                                  }}
                                >
                                  {ex.bodyPart}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="compact-sets-row">
                            {ex.sets.map((set, si) => {
                              const oneRM = !ex.isBodyweight 
                                ? (set.estimated1RM || calculate1RM(set.weight, set.reps, ex.bodyPart)) 
                                : undefined;
                              
                              let setVal = `${set.weight}kg×${set.reps}`;
                              if (ex.isBodyweight) {
                                setVal = set.weight && set.weight > 0 ? `自重(+${set.weight}k)×${set.reps}` : `自重×${set.reps}`;
                              }

                              return (
                                <span key={si} className="compact-set-pill">
                                  <span className="set-idx">{si + 1}</span>
                                  <span className="set-data">{setVal}</span>
                                  {oneRM !== undefined && <span className="set-1rm-mini">{oneRM}k</span>}
                                </span>
                              );
                            })}
                          </div>
                          {ex.note && <div className="compact-note"><Info size={11} /> {ex.note}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()
            ) : (
              /* --- 編集・追加画面 --- */
              <div className="workout-edit-container animate-in">
                <div className="modal-header">
                  <div className="header-title-with-back">
                    {selectedWorkout && selectedWorkout.exercises && selectedWorkout.exercises.length > 0 && !isAddingExercise && editingExerciseIndex === null && (
                      <button 
                        className="back-btn-sm" 
                        onClick={() => setModalView('summary')}
                        title="サマリーに戻る"
                      >
                        <ChevronLeft size={16} /> サマリー
                      </button>
                    )}
                    <h3>{selectedDateStr} ({getDayOfWeek(selectedDateStr)})</h3>
                  </div>
                  <div className="header-actions">
                    {selectedWorkout && selectedWorkout.exercises && selectedWorkout.exercises.length > 0 && (
                      <button className="icon-btn delete-day" onClick={handleDeleteDay} title="日の削除">
                        <Trash2 size={20} />
                      </button>
                    )}
                    <button className="close-btn" onClick={handleCloseModal}><X size={20} /></button>
                  </div>
                </div>

                {editingExerciseIndex !== null || isAddingExercise ? renderEditForm() : (
                  <>
                    <div className="exercise-list">
                      {selectedWorkout?.exercises.map((ex, i) => (
                        <div key={i} className="exercise-item card">
                          <div className="exercise-info">
                            <div className="exercise-header">
                              <span className="exercise-num">{i + 1}</span>
                              <div className="exercise-title-group">
                                <h4>{ex.name}</h4>
                                {parseEquipmentTags(ex.equipment).map((tag, ti) => (
                                  <span key={ti} className="equipment-chip">{tag}</span>
                                ))}
                                {ex.ppl && (
                                  <span 
                                    className="category-chip ppl"
                                    style={{
                                      color: PPL_COLORS[ex.ppl] || '#8e8e93',
                                      background: `${PPL_COLORS[ex.ppl] || '#8e8e93'}18`,
                                      borderColor: `${PPL_COLORS[ex.ppl] || '#8e8e93'}40`
                                    }}
                                  >
                                    {ex.ppl}
                                  </span>
                                )}
                                {ex.bodyPart && (
                                  <span 
                                    className="category-chip bodypart"
                                    style={{
                                      color: BODY_PART_COLORS[ex.bodyPart] || '#8e8e93',
                                      background: `${BODY_PART_COLORS[ex.bodyPart] || '#8e8e93'}18`,
                                      borderColor: `${BODY_PART_COLORS[ex.bodyPart] || '#8e8e93'}40`
                                    }}
                                  >
                                    {ex.bodyPart}
                                  </span>
                                )}
                              </div>
                              <div className="exercise-actions">
                                <button className="icon-btn edit" onClick={() => startEdit(i)}><Edit2 size={16} /></button>
                                <button className="icon-btn delete" onClick={() => handleDeleteExercise(i)}><Trash2 size={16} /></button>
                              </div>
                            </div>
                            {ex.note && <p className="note"><Info size={12} /> {ex.note}</p>}
                          </div>
                          <div className="sets-grid">
                            {ex.sets.map((set, si) => {
                              const oneRM = !ex.isBodyweight 
                                ? (set.estimated1RM || calculate1RM(set.weight, set.reps, ex.bodyPart)) 
                                : undefined;
                              
                              let setValText = `${set.weight}kg × ${set.reps}回`;
                              if (ex.isBodyweight) {
                                setValText = set.weight && set.weight > 0
                                  ? `自重(+${set.weight}kg) × ${set.reps}回`
                                  : `自重 × ${set.reps}回`;
                              }

                              return (
                                <div key={si} className="set-row">
                                  <span className="set-num">{si + 1}</span>
                                  <span className="set-val">{setValText}</span>
                                  {oneRM !== undefined && (
                                    <span className="set-1rm" title={`${ex.bodyPart || ''} 推定1RM`}>
                                      1RM {oneRM}kg
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button className="btn-secondary add-ex-btn" onClick={startAdd}>
                      <Plus size={18} /> 種目を追加する
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
