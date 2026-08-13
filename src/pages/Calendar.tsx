import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { getAllWorkouts, getWorkoutByDate, saveWorkout, deleteWorkout, type Workout, type Exercise, type WorkoutSet } from '../lib/db';
import { Info, Calendar as CalendarIcon, List as ListIcon, X, Edit2, Trash2, Plus, Save } from 'lucide-react';
import './Calendar.css';

type ViewMode = 'grid' | 'list';

const CalendarPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [allWorkouts, setAllWorkouts] = useState<Workout[]>([]);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  
  // Edit/Add states
  const [editingExerciseIndex, setEditingExerciseIndex] = useState<number | null>(null);
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [editForm, setEditForm] = useState<Exercise>({
    name: '',
    isBodyweight: false,
    note: '',
    sets: [{ weight: 0, reps: 0 }]
  });

  const [monthsToDisplay, setMonthsToDisplay] = useState<Date[]>([]);
  const [uniqueNames, setUniqueNames] = useState<string[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const listScrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadWorkouts();
    loadUniqueNames();
    const initialMonths = [];
    const baseDate = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      initialMonths.push(d);
    }
    setMonthsToDisplay(initialMonths);

    // カレンダーページでは.contentのスクロールを無効化し、
    // カレンダー/リスト内部のスクロールのみを有効にする
    const contentEl = document.querySelector('.content') as HTMLElement;
    if (contentEl) {
      contentEl.style.overflowY = 'hidden';
    }
    return () => {
      if (contentEl) {
        contentEl.style.overflowY = 'auto';
      }
    };
  }, []);

  const loadUniqueNames = async () => {
    const names = await import('../lib/db').then(db => db.getUniqueExerciseNames());
    setUniqueNames(names);
  };

  const loadWorkouts = async () => {
    const all = await getAllWorkouts();
    setAllWorkouts(all);

    if (all.length > 0) {
      const sorted = [...all].sort((a, b) => b.date.localeCompare(a.date));
      const latestDateStr = sorted[0].date;
      const [year, month, day] = latestDateStr.split('-').map(Number);
      const baseDate = new Date(year, month - 1, day);

      const initialMonths = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(baseDate);
        d.setDate(1);
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

  const workoutMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    allWorkouts.forEach(w => {
      map[w.date] = true;
    });
    return map;
  }, [allWorkouts]);

  const sortedWorkouts = useMemo(() => {
    return [...allWorkouts].sort((a, b) => a.date.localeCompare(b.date));
  }, [allWorkouts]);

  useLayoutEffect(() => {
    if (viewMode === 'grid' && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    } else if (viewMode === 'list' && listScrollContainerRef.current) {
      listScrollContainerRef.current.scrollTop = listScrollContainerRef.current.scrollHeight;
    }
  }, [viewMode, monthsToDisplay[monthsToDisplay.length - 1]?.getTime(), sortedWorkouts.length]);

  const handleDateClick = async (dateStr: string) => {
    const workout = await getWorkoutByDate(dateStr);
    setSelectedDateStr(dateStr);
    setSelectedWorkout(workout || null);
    setShowModal(true);
  };

  // --- Edit/Delete Logic ---

  const handleDeleteDay = async () => {
    if (!window.confirm('この日の記録をすべて削除します。この操作は取り消せません。本当に実行しますか？')) return;
    await deleteWorkout(selectedDateStr);
    setShowModal(false);
    loadWorkouts();
  };

  const handleDeleteExercise = async (index: number) => {
    if (!selectedWorkout) return;
    if (!window.confirm('この種目を削除します。この操作は取り消せません。本当に実行しますか？')) return;
    
    const updatedExercises = [...selectedWorkout.exercises];
    updatedExercises.splice(index, 1);
    
    if (updatedExercises.length === 0) {
      await deleteWorkout(selectedDateStr);
      setShowModal(false);
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
      const hasWorkout = workoutMap[dStr];
      const isSelected = dStr === selectedDateStr;

      days.push(
        <div 
          key={dStr} 
          className={`calendar-day ${hasWorkout ? 'has-workout' : ''} ${isSelected ? 'selected' : ''}`}
          onClick={() => handleDateClick(dStr)}
        >
          <span>{d}</span>
          {hasWorkout && <div className="dot"></div>}
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
            {!editForm.isBodyweight && (
              <input 
                type="number" 
                value={set.weight || ''} 
                onChange={e => handleSetChange(i, 'weight', parseFloat(e.target.value) || 0)}
                placeholder="kg"
              />
            )}
            <input 
              type="number" 
              value={set.reps || ''} 
              onChange={e => handleSetChange(i, 'reps', parseInt(e.target.value) || 0)}
              placeholder="回数"
            />
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

      {viewMode === 'grid' ? (
        <div className="vertical-calendar card animate-in" ref={scrollContainerRef}>
          <button className="load-more-btn top" onClick={() => {
            const lastMonth = monthsToDisplay[0];
            const newMonths = [];
            for (let i = 6; i >= 1; i--) {
              const d = new Date(lastMonth);
              d.setMonth(d.getMonth() - i);
              newMonths.push(d);
            }
            setMonthsToDisplay([...newMonths, ...monthsToDisplay]);
          }}>
            さらに過去を読み込む
          </button>
          {monthsToDisplay.map(m => renderMonthGrid(m))}
        </div>
      ) : (
        <div className="timeline-list animate-in" ref={listScrollContainerRef}>
          {sortedWorkouts.map((w) => (
            <div key={w.date} className="timeline-item card" onClick={() => handleDateClick(w.date)}>
              <div className="timeline-date">
                <span className="date-main">{parseInt(w.date.split('-')[1], 10)}/{parseInt(w.date.split('-')[2], 10)}</span>
                <span className="date-sub">{w.date.split('-')[0]} ({getDayOfWeek(w.date)})</span>
              </div>
              <div className="timeline-summary">
                <div className="exercise-chips">
                  {w.exercises.map((ex, i) => <span key={i} className="chip">{ex.name}</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content card detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedDateStr} ({getDayOfWeek(selectedDateStr)})</h3>
              <div className="header-actions">
                <button className="icon-btn delete-day" onClick={handleDeleteDay} title="日の削除">
                  <Trash2 size={20} />
                </button>
                <button className="close-btn" onClick={() => setShowModal(false)}><X size={20} /></button>
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
                          <h4>{ex.name}</h4>
                          <div className="exercise-actions">
                            <button className="icon-btn edit" onClick={() => startEdit(i)}><Edit2 size={16} /></button>
                            <button className="icon-btn delete" onClick={() => handleDeleteExercise(i)}><Trash2 size={16} /></button>
                          </div>
                        </div>
                        {ex.note && <p className="note"><Info size={12} /> {ex.note}</p>}
                      </div>
                      <div className="sets-grid">
                        {ex.sets.map((set, si) => (
                          <div key={si} className="set-row">
                            <span className="set-num">{si + 1}</span>
                            <span className="set-val">
                              {ex.isBodyweight ? '自重' : `${set.weight}kg`} × {set.reps}回
                            </span>
                          </div>
                        ))}
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
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
