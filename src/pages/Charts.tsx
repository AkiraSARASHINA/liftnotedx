import { useState, useEffect, useMemo } from 'react';
import { getExercisesByName, getUniqueExerciseNames, getWorkoutByDate, type Exercise, type Workout } from '../lib/db';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { TrendingUp, Activity, RotateCcw, Info, Search, ChevronDown, X, ChevronLeft, Maximize2, List } from 'lucide-react';
import './Charts.css';

interface ChartDataPoint {
  date: string;
  timestamp: number;
  maxWeight: number;
  volume: number;
  reps: number;
  isBodyweight: boolean;
  exerciseDetail: Exercise;
}

const ChartsPage: React.FC = () => {
  const [exerciseNames, setExerciseNames] = useState<string[]>([]);
  const [selectedName, setSelectedName] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [activeDetailType, setActiveDetailType] = useState<'maxWeight' | 'volume' | 'reps' | null>(null);
  const [detailSubView, setDetailSubView] = useState<'summary' | 'chart_only' | 'history_only'>('summary');
  const [onlyShowPB, setOnlyShowPB] = useState<boolean>(false);

  useEffect(() => {
    loadExerciseNames();
    
    // Global click listener to clear active chart point when clicking outside
    const handleGlobalClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.chart-section') && !target.closest('.custom-select-container')) {
        setActiveDate(null);
      }
    };

    window.addEventListener('mousedown', handleGlobalClick);
    window.addEventListener('touchstart', handleGlobalClick);
    return () => {
      window.removeEventListener('mousedown', handleGlobalClick);
      window.removeEventListener('touchstart', handleGlobalClick);
    };
  }, []);

  const loadExerciseNames = async () => {
    const names = await getUniqueExerciseNames();
    setExerciseNames(names);
    const stored = sessionStorage.getItem('charts_selected_name');
    if (stored && names.includes(stored)) {
      setSelectedName(stored);
    } else if (names.length > 0 && !selectedName) {
      setSelectedName(names[0]);
    }
  };

  useEffect(() => {
    if (selectedName) {
      loadChartData();
    }
  }, [selectedName]);

  const loadChartData = async () => {
    const results = await getExercisesByName(selectedName);
    const data: ChartDataPoint[] = results.map(r => {
      const ex = r.exercise!;
      const maxWeight = Math.max(...ex.sets.map(s => s.weight || 0));
      const volume = ex.sets.reduce((sum, s) => sum + (s.weight || 0) * s.reps, 0);
      const reps = ex.sets.reduce((sum, s) => sum + s.reps, 0);
      
      const timestamp = new Date(r.date + 'T00:00:00').getTime();

      return {
        date: r.date,
        timestamp,
        maxWeight,
        volume,
        reps,
        isBodyweight: ex.isBodyweight,
        exerciseDetail: ex
      };
    }).sort((a, b) => a.timestamp - b.timestamp);
    setChartData(data);
    setSelectedWorkout(null);
    setActiveDate(null);
  };

  const filteredNames = useMemo(() => {
    return exerciseNames.filter(name => 
      name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [exerciseNames, searchTerm]);

  const isBodyweight = useMemo(() => {
    return chartData.length > 0 && chartData[0].isBodyweight;
  }, [chartData]);

  const handlePointClick = async (data: any) => {
    let dateStr = '';
    
    if (data?.activePayload?.[0]?.payload?.date) {
      dateStr = data.activePayload[0].payload.date;
    } else if (data?.payload?.date) {
      dateStr = data.payload.date;
    } else if (data?.date) {
      dateStr = data.date;
    }
    
    if (dateStr) {
      const workout = await getWorkoutByDate(dateStr);
      if (workout) {
        setSelectedWorkout(workout);
        setShowModal(true);
      }
    } else {
      setSelectedWorkout(null);
      setActiveDate(null);
    }
  };

  const handleChartMouseMove = (state: any) => {
    if (state && state.activePayload && state.activePayload[0]) {
      setActiveDate(state.activePayload[0].payload.date);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedWorkout(null);
    setActiveDate(null);
  };

  const selectExercise = (name: string) => {
    setSelectedName(name);
    sessionStorage.setItem('charts_selected_name', name);
    setIsDropdownOpen(false);
    setSearchTerm('');
    setActiveDetailType(null);
    setDetailSubView('summary');
    setOnlyShowPB(false);
  };

  const getDayOfWeek = (dateStr: string) => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const d = new Date(dateStr);
    return days[d.getDay()];
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const itemData = payload[0].payload;
      return (
        <div className="custom-tooltip glass">
          <p className="label">{itemData.date}</p>
          {payload.map((p: any, i: number) => (
            <p key={i} className="value" style={{ color: p.color }}>
              {p.name}: {p.value}{p.unit}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderDetailView = () => {
    if (!activeDetailType || chartData.length === 0) return null;

    let chartTitle = '';
    let dataKey = '';
    let unit = '';
    let strokeColor = '';
    let chartIcon = null;

    if (activeDetailType === 'maxWeight') {
      chartTitle = 'MAX重量';
      dataKey = 'maxWeight';
      unit = 'kg';
      strokeColor = 'var(--primary-color)';
      chartIcon = <TrendingUp size={20} />;
    } else if (activeDetailType === 'volume') {
      chartTitle = '総ボリューム';
      dataKey = 'volume';
      unit = 'kg';
      strokeColor = 'rgba(0, 163, 255, 0.6)';
      chartIcon = <Activity size={20} />;
    } else if (activeDetailType === 'reps') {
      chartTitle = '総レップ数';
      dataKey = 'reps';
      unit = '回';
      strokeColor = 'rgba(255, 0, 85, 0.6)';
      chartIcon = <RotateCcw size={20} />;
    }

    // 過去最高の更新日付を古い順から計算（フィルターとハイライトで使用するため常に計算）
    const pbDates = new Set<string>();
    const chronologicalData = [...chartData].sort((a, b) => a.date.localeCompare(b.date));
    let currentMax = 0; // 0より大きい値を記録
    chronologicalData.forEach(item => {
      const val = item[dataKey as keyof ChartDataPoint] as number;
      if (val > currentMax) {
        pbDates.add(item.date);
        currentMax = val;
      }
    });

    const showPBHighlight = localStorage.getItem('settings_highlight_pb') === 'true';
    const sortedHistory = [...chartData].sort((a, b) => b.date.localeCompare(a.date));
    const recentHistory = sortedHistory.slice(0, 5);

    const handleBackClick = () => {
      setOnlyShowPB(false);
      if (detailSubView === 'summary') {
        setActiveDetailType(null);
      } else {
        setDetailSubView('summary');
      }
    };

    // フィルター適用後のチャートデータ
    const displayChartData = onlyShowPB
      ? chartData.filter(item => pbDates.has(item.date))
      : chartData;

    const renderChartSection = (height: number) => (
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={height}>
          {activeDetailType === 'maxWeight' ? (
            <LineChart 
              data={displayChartData} 
              onClick={handlePointClick} 
              onMouseMove={handleChartMouseMove}
              onMouseLeave={() => setActiveDate(null)}
              margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
              <XAxis 
                dataKey="timestamp" 
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                stroke="#a0a0a0" 
                fontSize={10} 
                tickLine={false}
                tickFormatter={(time: number) => {
                  const d = new Date(time);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
              />
              <YAxis stroke="#a0a0a0" fontSize={12} domain={['dataMin - 5', 'dataMax + 5']} />
              <Tooltip 
                content={<CustomTooltip />} 
                wrapperStyle={{ pointerEvents: 'none' }}
                active={activeDate !== null}
              />
              <Line 
                type="monotone" 
                dataKey={dataKey} 
                name={chartTitle} 
                unit={unit} 
                stroke={strokeColor} 
                strokeWidth={3}
                activeDot={{ r: 8, strokeWidth: 0, cursor: 'pointer' }}
                dot={(dotProps: any) => {
                  const { cx, cy, payload } = dotProps;
                  const isPB = pbDates.has(payload.date);
                  // 設定がオン、または最高記録のみフィルターがオンの時にハイライト
                  const shouldHighlight = isPB && (showPBHighlight || onlyShowPB);
                  if (shouldHighlight) {
                    return (
                      <g key={`dot-${payload.date}`}>
                        <circle cx={cx} cy={cy} r={8} fill="#ff9900" stroke="#fff" strokeWidth={2} style={{ cursor: 'pointer' }} />
                        <circle cx={cx} cy={cy} r={12} fill="none" stroke="#ff5500" strokeWidth={1.5} opacity={0.6} style={{ cursor: 'pointer', transformOrigin: `${cx}px ${cy}px`, animation: 'pulse 2s infinite' }} />
                      </g>
                    );
                  }
                  return (
                    <circle key={`dot-${payload.date}`} cx={cx} cy={cy} r={5} fill={strokeColor} strokeWidth={0} style={{ cursor: 'pointer' }} />
                  );
                }}
              />
            </LineChart>
          ) : (
            <BarChart 
              data={displayChartData} 
              onClick={handlePointClick} 
              onMouseMove={handleChartMouseMove}
              onMouseLeave={() => setActiveDate(null)}
              margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
              <XAxis 
                dataKey="timestamp" 
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                stroke="#a0a0a0" 
                fontSize={10} 
                tickLine={false}
                tickFormatter={(time: number) => {
                  const d = new Date(time);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
              />
              <YAxis stroke="#a0a0a0" fontSize={12} />
              <Tooltip 
                content={<CustomTooltip />} 
                wrapperStyle={{ pointerEvents: 'none' }}
                active={activeDate !== null}
              />
              <Bar 
                dataKey={dataKey} 
                name={chartTitle} 
                unit={unit} 
                fill={strokeColor} 
                radius={[6, 6, 0, 0]} 
                cursor="pointer"
                barSize={16}
              >
                {displayChartData.map((entry, index) => {
                  const isPB = pbDates.has(entry.date);
                  const shouldHighlight = isPB && (showPBHighlight || onlyShowPB);
                  let cellColor = strokeColor;
                  if (activeDate === entry.date) {
                    cellColor = 'var(--primary-color)';
                  } else if (shouldHighlight) {
                    cellColor = '#ff9900';
                  }
                  return (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={cellColor} 
                    />
                  );
                })}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    );

    const renderHistoryItems = (items: ChartDataPoint[]) => (
      <div className="history-list">
        {items.map((item) => {
          const isPB = pbDates.has(item.date);
          const shouldHighlight = isPB && (showPBHighlight || onlyShowPB);
          return (
            <div 
              key={item.date} 
              className={`history-item card animate-in ${shouldHighlight ? 'pb-highlight' : ''}`}
              onClick={() => handlePointClick({ date: item.date })}
            >
              <div className="history-date-col">
                <div className="history-date-row">
                  <span className="history-date">{item.date}</span>
                  {shouldHighlight && <span className="pb-badge">最高記録🔥</span>}
                </div>
                <span className="history-dayofweek">({getDayOfWeek(item.date)}曜日)</span>
              </div>
              <div className="history-value-col">
                <span className={`history-value ${activeDetailType === 'reps' ? 'reps' : ''} ${shouldHighlight ? 'pb-text' : ''}`}>
                  {item[dataKey as keyof ChartDataPoint] as number}
                </span>
                <span className="history-unit">{unit}</span>
              </div>
            </div>
          );
        })}
      </div>
    );

    const renderFilterToggle = () => (
      <div className="pb-filter-container">
        <span className="pb-filter-label">最高記録のみ表示🔥</span>
        <label className="toggle-switch-sm">
          <input 
            type="checkbox" 
            checked={onlyShowPB} 
            onChange={(e) => setOnlyShowPB(e.target.checked)} 
          />
          <span className="slider-sm"></span>
        </label>
      </div>
    );

    return (
      <div className="detail-view animate-in">
        <div className="detail-view-header">
          <button className="back-btn" onClick={handleBackClick}>
            <ChevronLeft size={18} />
            戻る
          </button>
          <div className="detail-title-info">
            <h2>
              {chartTitle}
              {detailSubView === 'chart_only' && '（グラフ詳細）'}
              {detailSubView === 'history_only' && '（全記録）'}
              {detailSubView === 'summary' && '（概要）'}
            </h2>
            <span>{selectedName}</span>
          </div>
        </div>

        {detailSubView === 'summary' && (
          <div className="subview-summary-container">
            {/* グラフ概要カード */}
            <div className="chart-section card">
              <div className="chart-header">
                <div className="chart-header-title">
                  {chartIcon}
                  <h3>{chartTitle}推移 ({unit})</h3>
                </div>
                <button 
                  className="icon-btn-text" 
                  onClick={() => setDetailSubView('chart_only')}
                  title="グラフを拡大"
                >
                  <Maximize2 size={16} />
                  <span>拡大する</span>
                </button>
              </div>
              {renderChartSection(220)}
            </div>

            {/* 直近の記録セクション */}
            <div className="history-section">
              <div className="section-header-row">
                <h4 className="sticky-header">直近の記録</h4>
                <button 
                  className="icon-btn-text" 
                  onClick={() => setDetailSubView('history_only')}
                >
                  <List size={16} />
                  <span>すべての記録を表示 ({sortedHistory.length}件)</span>
                </button>
              </div>
              {renderHistoryItems(recentHistory)}
            </div>
          </div>
        )}

        {detailSubView === 'chart_only' && (
          <div className="subview-chart-only-container animate-in">
            <div className="chart-section card full-height-chart">
              <div className="chart-header">
                <div className="chart-header-title">
                  {chartIcon}
                  <h3>{chartTitle}詳細推移 ({unit})</h3>
                </div>
                {renderFilterToggle()}
              </div>
              {renderChartSection(400)}
            </div>
          </div>
        )}

        {detailSubView === 'history_only' && (
          <div className="subview-history-only-container animate-in">
            <div className="history-section full-history-section">
              <div className="section-header-row full-history-header">
                <h4 className="sticky-header">
                  {onlyShowPB ? `最高記録のみ (${sortedHistory.filter(item => pbDates.has(item.date)).length}件)` : `全記録 (${sortedHistory.length}件)`}
                </h4>
                {renderFilterToggle()}
              </div>
              {renderHistoryItems(
                onlyShowPB
                  ? sortedHistory.filter(item => pbDates.has(item.date))
                  : sortedHistory
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="charts-page">
      {activeDetailType === null ? (
        <>
          <div className="exercise-selector card">
            <label>種目を選択</label>
            <div className="custom-select-container">
              <div 
                className="custom-select-trigger" 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <span className={selectedName ? 'selected-val' : 'placeholder'}>
                  {selectedName || '種目を選択してください'}
                </span>
                <ChevronDown size={18} className={isDropdownOpen ? 'rotate' : ''} />
              </div>

              {isDropdownOpen && (
                <div className="custom-dropdown glass animate-in">
                  <div className="search-box">
                    <Search size={16} />
                    <input 
                      type="text" 
                      placeholder="種目名で検索..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      autoFocus
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                  <div className="options-list">
                    {filteredNames.length > 0 ? (
                      filteredNames.map(name => (
                        <div 
                          key={name} 
                          className={`option ${name === selectedName ? 'active' : ''}`}
                          onClick={() => selectExercise(name)}
                        >
                          {name}
                        </div>
                      ))
                    ) : (
                      <div className="no-results">該当する種目がありません</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {!isBodyweight && chartData.length > 0 && (
            <div className="chart-section card" onClick={() => setActiveDetailType('maxWeight')}>
              <div className="chart-header">
                <TrendingUp size={18} />
                <h3>MAX重量推移 (kg)</h3>
              </div>
              <div className="chart-container" style={{ pointerEvents: 'none' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart 
                    data={chartData} 
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                    <XAxis dataKey="timestamp" type="number" scale="time" domain={['dataMin', 'dataMax']} hide />
                    <YAxis stroke="#a0a0a0" fontSize={12} domain={['dataMin - 5', 'dataMax + 5']} />
                    <Line 
                      type="monotone" 
                      dataKey="maxWeight" 
                      stroke="var(--primary-color)" 
                      strokeWidth={3}
                      dot={{ r: 4, fill: 'var(--primary-color)', strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {!isBodyweight && chartData.length > 0 && (
            <div className="chart-section card" onClick={() => setActiveDetailType('volume')}>
              <div className="chart-header">
                <Activity size={18} />
                <h3>総ボリューム (kg)</h3>
              </div>
              <div className="chart-container" style={{ pointerEvents: 'none' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart 
                    data={chartData} 
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                    <XAxis dataKey="timestamp" type="number" scale="time" domain={['dataMin', 'dataMax']} hide />
                    <YAxis stroke="#a0a0a0" fontSize={12} />
                    <Bar dataKey="volume" fill="rgba(0, 163, 255, 0.4)" radius={[4, 4, 0, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {chartData.length > 0 && (
            <div className="chart-section card" onClick={() => setActiveDetailType('reps')}>
              <div className="chart-header">
                <RotateCcw size={18} />
                <h3>総レップ数</h3>
              </div>
              <div className="chart-container" style={{ pointerEvents: 'none' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart 
                    data={chartData} 
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                    <XAxis dataKey="timestamp" type="number" scale="time" domain={['dataMin', 'dataMax']} hide />
                    <YAxis stroke="#a0a0a0" fontSize={12} />
                    <Bar dataKey="reps" fill="rgba(255, 0, 85, 0.4)" radius={[4, 4, 0, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {chartData.length === 0 && selectedName && (
            <div className="no-data card">
              <p>データがありません。</p>
            </div>
          )}
        </>
      ) : (
        renderDetailView()
      )}

      {showModal && selectedWorkout && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content card detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedWorkout.date} ({getDayOfWeek(selectedWorkout.date)}) の全記録</h3>
              <button className="close-btn" onClick={closeModal}><X size={20} /></button>
            </div>
            <div className="exercise-list">
              {selectedWorkout.exercises.map((ex, i) => (
                <div key={i} className="exercise-item card">
                  <div className="exercise-info">
                    <div className="exercise-header">
                      <span className="exercise-num">{i + 1}</span>
                      <h4 className={ex.name === selectedName ? 'highlight' : ''}>{ex.name}</h4>
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
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartsPage;
