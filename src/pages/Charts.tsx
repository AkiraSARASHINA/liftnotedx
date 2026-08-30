import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { 
  getAllWorkouts, 
  getExercisesByName, 
  getUniqueExerciseNames, 
  getWorkoutByDate, 
  calculate1RM, 
  convertToKg,
  parseEquipmentTags, 
  type Exercise, 
  type Workout,
  type PPLCategory,
  type BodyPartCategory
} from '../lib/db';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip as RechartsTooltip
} from 'recharts';
import { 
  TrendingUp, 
  Zap, 
  Activity, 
  RotateCcw, 
  Info, 
  Search, 
  ChevronDown, 
  X, 
  ChevronLeft, 
  List, 
  Calendar, 
  Flame, 
  Layers, 
  Award, 
  ArrowUpRight, 
  ArrowDownRight, 
  Minus
} from 'lucide-react';
import './Charts.css';

interface ChartDataPoint {
  date: string;
  timestamp: number;
  maxWeight: number;
  max1RM: number;
  volume: number;
  reps: number;
  calories?: number;
  isCardio?: boolean;
  isBodyweight: boolean;
  equipment?: string;
  unit?: 'kg' | 'lbs';
  rawMaxWeight?: number;
  rawMax1RM?: number;
  exerciseDetail: Exercise;
}

export type TimeRangeScale = '6m' | '1y' | '3y' | 'all';

export const SCALE_OPTIONS: { key: TimeRangeScale; label: string; ms: number }[] = [
  { key: '6m', label: '6ヶ月', ms: 180 * 24 * 60 * 60 * 1000 },
  { key: '1y', label: '1年', ms: 365 * 24 * 60 * 60 * 1000 },
  { key: '3y', label: '3年', ms: 365 * 3 * 24 * 60 * 60 * 1000 },
  { key: 'all', label: '全期間', ms: Infinity },
];

const PPL_OPTIONS: PPLCategory[] = ['プッシュ', 'プル', 'レッグ', 'それ以外'];
const BODY_PART_OPTIONS: BodyPartCategory[] = ['胸', '背中', '脚', '肩', '腕', 'それ以外'];

const PPL_COLORS: Record<string, string> = {
  'プッシュ': '#ff2d55',
  'プル': '#00a3ff',
  'レッグ': '#00e5a3',
  'それ以外': '#8e8e93'
};

const BODY_PART_COLORS: Record<string, string> = {
  '胸': '#ff2d55',
  '背中': '#00a3ff',
  '脚': '#34c759',
  '肩': '#ff9500',
  '腕': '#af52de',
  'それ以外': '#8e8e93'
};

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

interface MonthlyExerciseSummary {
  name: string;
  equipment?: string;
  ppl?: PPLCategory;
  bodyPart?: BodyPartCategory;
  isBodyweight: boolean;
  isCardio?: boolean;
  calories?: number;
  totalCalories?: number;
  maxWeight: number;
  max1RM?: number;
  totalReps: number;
  totalVolume: number;
  setsCount: number;
  daysCount: number;
  prevMonth?: {
    maxWeight: number;
    max1RM?: number;
    totalReps: number;
    totalVolume: number;
    totalCalories?: number;
  };
}

interface MonthlySummaryData {
  monthKey: string;
  year: number;
  month: number;
  trainingDays: number;
  strengthDaysCount: number;
  allDaysCount: number;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  pplData: { name: string; value: number }[];
  bodyPartData: { name: string; value: number }[];
  pplLegendData: { name: string; value: number }[];
  bodyPartLegendData: { name: string; value: number }[];
  topExercisesByReps: { 
    name: string; 
    reps: number; 
    sets: number; 
    bodyPart?: string;
    isCardio?: boolean;
    calories?: number;
    daysCount?: number;
  }[];
  pbList: { name: string; date: string; reasons: string[] }[];
  exerciseSummaries: MonthlyExerciseSummary[];
}

const ChartsPage: React.FC = () => {
  const [chartsMainTab, setChartsMainTab] = useState<'by_exercise' | 'monthly_summary'>('by_exercise');
  const [allWorkoutsList, setAllWorkoutsList] = useState<Workout[]>([]);
  const [selectedMonthModalData, setSelectedMonthModalData] = useState<MonthlySummaryData | null>(null);

  const [exerciseNames, setExerciseNames] = useState<string[]>([]);
  const [selectedName, setSelectedName] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [rawChartData, setRawChartData] = useState<ChartDataPoint[]>([]);
  const [selectedEquipments, setSelectedEquipments] = useState<string[]>([]);
  const [availableEquipments, setAvailableEquipments] = useState<string[]>([]);
  const [hasNoEquipmentData, setHasNoEquipmentData] = useState<boolean>(false);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [activeDetailType, setActiveDetailType] = useState<'maxWeight' | 'max1RM' | 'volume' | 'reps' | 'calories' | null>(null);
  const [detailSubView, setDetailSubView] = useState<'summary' | 'chart_only' | 'history_only'>('summary');
  const [onlyShowPB, setOnlyShowPB] = useState<boolean>(false);
  const [timeRangeScale, setTimeRangeScale] = useState<TimeRangeScale>('6m');
  const [unitFilter, setUnitFilter] = useState<'all' | 'kg' | 'lbs'>('all');
  const expandedChartScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadExerciseNames();
    loadAllWorkouts();
    
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

  const loadAllWorkouts = async () => {
    const data = await getAllWorkouts();
    setAllWorkoutsList(data);
  };

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

  // --- 月ごとのサマリーデータ集計 ---
  const monthlySummariesList = useMemo<MonthlySummaryData[]>(() => {
    const activeWorkouts = allWorkoutsList.filter(w => w.exercises && w.exercises.length > 0);
    if (activeWorkouts.length === 0) return [];

    // 日付昇順でソート
    const sortedWorkouts = [...activeWorkouts].sort((a, b) => a.date.localeCompare(b.date));

    // 月ごとにグルーピング
    const monthGroups: Record<string, Workout[]> = {};
    sortedWorkouts.forEach(w => {
      const monthKey = w.date.substring(0, 7); // 'YYYY-MM'
      if (!monthGroups[monthKey]) {
        monthGroups[monthKey] = [];
      }
      monthGroups[monthKey].push(w);
    });

    const monthKeys = Object.keys(monthGroups).sort((a, b) => a.localeCompare(b)); // 昇順

    // 月ごとの種目集計キャッシュ（前月比較用）
    const monthExSummariesCache: Record<string, Record<string, {
      maxWeight: number;
      max1RM?: number;
      totalReps: number;
      totalVolume: number;
      totalCalories?: number;
    }>> = {};

    const summaries: MonthlySummaryData[] = [];

    monthKeys.forEach((mKey, mIdx) => {
      const workouts = monthGroups[mKey];
      const [yearStr, monthStr] = mKey.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);

      // 総セット数、総レップ数、総ボリューム
      let totalSets = 0;
      let totalReps = 0;
      let totalVolume = 0;

      // PPL・5分割集計（レップ数基準）
      // 実施日数（筋トレのみを主日数、有酸素含む総日数も算出）
      const strengthDaysCount = new Set(workouts.filter(w => w.exercises.some(e => !e.isCardio)).map(w => w.date)).size;
      const allDaysCount = new Set(workouts.map(w => w.date)).size;

      // PPL集計
      const pplRepsMap: Record<string, number> = {};
      const bodyPartRepsMap: Record<string, number> = {};

      // 種目別集計
      const exMap: Record<string, {
        name: string;
        equipment?: string;
        ppl?: PPLCategory;
        bodyPart?: BodyPartCategory;
        isBodyweight: boolean;
        isCardio?: boolean;
        calories?: number;
        totalCalories?: number;
        maxWeight: number;
        max1RM?: number;
        totalReps: number;
        totalVolume: number;
        setsCount: number;
        daysCount: number;
        dates: Set<string>;
      }> = {};

      workouts.forEach(w => {
        w.exercises.forEach(ex => {
          if (ex.isCardio) {
            // 有酸素運動の集計
            const cal = ex.calories || 0;
            if (!exMap[ex.name]) {
              exMap[ex.name] = {
                name: ex.name,
                equipment: ex.equipment,
                isBodyweight: false,
                isCardio: true,
                calories: cal,
                totalCalories: cal,
                maxWeight: 0,
                max1RM: undefined,
                totalReps: 0,
                totalVolume: 0,
                setsCount: 1,
                daysCount: 0,
                dates: new Set([w.date])
              };
            } else {
              const cur = exMap[ex.name];
              cur.totalCalories = (cur.totalCalories || 0) + cal;
              cur.setsCount += 1;
              cur.dates.add(w.date);
              if (!cur.equipment && ex.equipment) cur.equipment = ex.equipment;
            }
          } else {
            // 筋トレ種目の集計
            const exVolume = ex.sets.reduce((sSum, s) => sSum + convertToKg(s.weight, ex.unit) * s.reps, 0);
            const exReps = ex.sets.reduce((sSum, s) => sSum + s.reps, 0);
            const exMaxWeight = Math.round(Math.max(...ex.sets.map(s => convertToKg(s.weight, ex.unit))) * 10) / 10;
            const exMax1RM = Math.round(ex.sets.reduce((max, s) => {
              const oneRM = !ex.isBodyweight ? (s.estimated1RM || calculate1RM(s.weight, s.reps, ex.bodyPart) || 0) : 0;
              return Math.max(max, convertToKg(oneRM, ex.unit));
            }, 0) * 10) / 10;

            totalSets += ex.sets.length;
            totalReps += exReps;
            totalVolume += Math.round(exVolume);

            const pplCat = ex.ppl || 'それ以外';
            pplRepsMap[pplCat] = (pplRepsMap[pplCat] || 0) + exReps;

            const bpCat = ex.bodyPart || 'それ以外';
            bodyPartRepsMap[bpCat] = (bodyPartRepsMap[bpCat] || 0) + exReps;

            if (!exMap[ex.name]) {
              exMap[ex.name] = {
                name: ex.name,
                equipment: ex.equipment,
                ppl: ex.ppl,
                bodyPart: ex.bodyPart,
                isBodyweight: ex.isBodyweight,
                isCardio: false,
                maxWeight: exMaxWeight,
                max1RM: exMax1RM > 0 ? exMax1RM : undefined,
                totalReps: exReps,
                totalVolume: Math.round(exVolume),
                setsCount: ex.sets.length,
                daysCount: 0,
                dates: new Set([w.date])
              };
            } else {
              const cur = exMap[ex.name];
              cur.maxWeight = Math.max(cur.maxWeight, exMaxWeight);
              if (exMax1RM > 0) {
                cur.max1RM = Math.max(cur.max1RM || 0, exMax1RM);
              }
              cur.totalReps += exReps;
              cur.totalVolume += Math.round(exVolume);
              cur.setsCount += ex.sets.length;
              cur.dates.add(w.date);
              if (!cur.equipment && ex.equipment) cur.equipment = ex.equipment;
              if (!cur.ppl && ex.ppl) cur.ppl = ex.ppl;
              if (!cur.bodyPart && ex.bodyPart) cur.bodyPart = ex.bodyPart;
            }
          }
        });
      });

      // 前月のデータ
      const prevMonthKey = mIdx > 0 ? monthKeys[mIdx - 1] : null;
      const prevExData = prevMonthKey ? monthExSummariesCache[prevMonthKey] : null;

      // 種目集計配列の生成
      const exSummaries: MonthlyExerciseSummary[] = Object.values(exMap).map(item => {
        const prev = prevExData ? prevExData[item.name] : undefined;
        return {
          name: item.name,
          equipment: item.equipment,
          ppl: item.ppl,
          bodyPart: item.bodyPart,
          isBodyweight: item.isBodyweight,
          isCardio: item.isCardio,
          calories: item.calories,
          totalCalories: item.totalCalories,
          maxWeight: item.maxWeight,
          max1RM: item.max1RM,
          totalReps: item.totalReps,
          totalVolume: item.totalVolume,
          setsCount: item.setsCount,
          daysCount: item.dates.size,
          prevMonth: prev ? {
            maxWeight: prev.maxWeight,
            max1RM: prev.max1RM,
            totalReps: prev.totalReps,
            totalVolume: prev.totalVolume,
            totalCalories: prev.totalCalories
          } : undefined
        };
      }).sort((a, b) => {
        if (a.isCardio && !b.isCardio) return 1;
        if (!a.isCardio && b.isCardio) return -1;
        if (a.isCardio && b.isCardio) return (b.totalCalories || 0) - (a.totalCalories || 0);
        return b.totalReps - a.totalReps;
      });

      // キャッシュに保存
      monthExSummariesCache[mKey] = {};
      exSummaries.forEach(es => {
        monthExSummariesCache[mKey][es.name] = {
          maxWeight: es.maxWeight,
          max1RM: es.max1RM,
          totalReps: es.totalReps,
          totalVolume: es.totalVolume,
          totalCalories: es.totalCalories
        };
      });

      // やり込み種目 TOP 3
      const topExercisesByReps = exSummaries.slice(0, 3).map(es => ({
        name: es.name,
        reps: es.totalReps,
        sets: es.setsCount,
        bodyPart: es.bodyPart,
        isCardio: es.isCardio,
        calories: es.totalCalories,
        daysCount: es.daysCount
      }));

      // その月のPB一覧
      const pbList: { name: string; date: string; reasons: string[] }[] = [];
      workouts.forEach(w => {
        const pastWorkouts = sortedWorkouts.filter(pw => pw.date < w.date);
        w.exercises.forEach(ex => {
          const todayMaxWeight = Math.round(Math.max(...ex.sets.map(s => convertToKg(s.weight, ex.unit))) * 10) / 10;
          const todayMax1RM = Math.round(ex.sets.reduce((max, s) => {
            const oneRM = !ex.isBodyweight ? (s.estimated1RM || calculate1RM(s.weight, s.reps, ex.bodyPart) || 0) : 0;
            return Math.max(max, convertToKg(oneRM, ex.unit));
          }, 0) * 10) / 10;
          const todayTotalReps = ex.sets.reduce((sum, s) => sum + s.reps, 0);
          const todayTotalVolume = Math.round(ex.sets.reduce((sum, s) => sum + convertToKg(s.weight, ex.unit) * s.reps, 0) * 10) / 10;

          const pastSessions: { maxWeight: number; max1RM: number; totalReps: number; totalVolume: number }[] = [];
          pastWorkouts.forEach(pw => {
            pw.exercises.filter(pe => pe.name === ex.name).forEach(pe => {
              const pMaxWeight = Math.round(Math.max(...pe.sets.map(s => convertToKg(s.weight, pe.unit))) * 10) / 10;
              const pMax1RM = Math.round(pe.sets.reduce((max, s) => {
                const oneRM = !pe.isBodyweight ? (s.estimated1RM || calculate1RM(s.weight, s.reps, pe.bodyPart) || 0) : 0;
                return Math.max(max, convertToKg(oneRM, pe.unit));
              }, 0) * 10) / 10;
              const pTotalReps = pe.sets.reduce((sum, s) => sum + s.reps, 0);
              const pTotalVolume = Math.round(pe.sets.reduce((sum, s) => sum + convertToKg(s.weight, pe.unit) * s.reps, 0) * 10) / 10;
              pastSessions.push({ maxWeight: pMaxWeight, max1RM: pMax1RM, totalReps: pTotalReps, totalVolume: pTotalVolume });
            });
          });

          if (pastSessions.length > 0) {
            const pastMaxWeight = Math.max(...pastSessions.map(s => s.maxWeight));
            const pastMax1RM = Math.max(...pastSessions.map(s => s.max1RM));
            const pastMaxTotalReps = Math.max(...pastSessions.map(s => s.totalReps));
            const pastMaxTotalVolume = Math.max(...pastSessions.map(s => s.totalVolume));

            const reasons: string[] = [];
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

            if (reasons.length > 0) {
              pbList.push({
                name: ex.name,
                date: w.date,
                reasons
              });
            }
          }
        });
      });

      const pplData = Object.entries(pplRepsMap)
        .filter(([_, val]) => val > 0)
        .map(([name, value]) => ({ name, value }));

      const pplLegendData = PPL_OPTIONS.map(cat => ({
        name: cat,
        value: pplRepsMap[cat] || 0
      }));

      const bodyPartData = Object.entries(bodyPartRepsMap)
        .filter(([_, val]) => val > 0)
        .map(([name, value]) => ({ name, value }));

      const bodyPartLegendData = BODY_PART_OPTIONS.map(cat => ({
        name: cat,
        value: bodyPartRepsMap[cat] || 0
      }));

      summaries.push({
        monthKey: mKey,
        year,
        month,
        trainingDays: strengthDaysCount,
        strengthDaysCount,
        allDaysCount,
        totalSets,
        totalReps,
        totalVolume,
        pplData,
        bodyPartData,
        pplLegendData,
        bodyPartLegendData,
        topExercisesByReps,
        pbList,
        exerciseSummaries: exSummaries
      });
    });

    // 新しい月が上に来るように降順にして返す
    return summaries.reverse();
  }, [allWorkoutsList]);

  useEffect(() => {
    if (selectedName) {
      loadChartData();
    }
  }, [selectedName]);

  // グラフ拡大表示時に最右端（最新日側）へ自動スクロール
  useLayoutEffect(() => {
    if (detailSubView === 'chart_only' && expandedChartScrollRef.current) {
      const scrollEl = expandedChartScrollRef.current;
      // 要素描画完了後に確実にスクロールさせるため微小遅延も設ける
      scrollEl.scrollLeft = scrollEl.scrollWidth;
      const timer = setTimeout(() => {
        if (scrollEl) scrollEl.scrollLeft = scrollEl.scrollWidth;
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [detailSubView, activeDetailType, selectedName, selectedEquipments, onlyShowPB, timeRangeScale]);

  const loadChartData = async () => {
    const results = await getExercisesByName(selectedName);
    const data: ChartDataPoint[] = results.map(r => {
      const ex = r.exercise!;
      const isCardio = !!ex.isCardio;
      const calories = ex.calories || 0;
      const rawMaxWeight = isCardio ? 0 : Math.max(...(ex.sets || []).map(s => s.weight || 0));
      const rawMax1RM = isCardio ? 0 : (ex.sets || []).reduce((max, s) => {
        const oneRM = !ex.isBodyweight 
          ? (s.estimated1RM || calculate1RM(s.weight, s.reps, ex.bodyPart) || 0)
          : 0;
        return Math.max(max, oneRM);
      }, 0);
      
      const isLbs = ex.unit === 'lbs';
      const maxWeight = isLbs ? Math.round(convertToKg(rawMaxWeight, 'lbs') * 10) / 10 : rawMaxWeight;
      const max1RM = isLbs ? Math.round(convertToKg(rawMax1RM, 'lbs') * 10) / 10 : rawMax1RM;
      const volume = isCardio ? 0 : Math.round((ex.sets || []).reduce((sum, s) => sum + convertToKg(s.weight, ex.unit) * s.reps, 0) * 10) / 10;
      const reps = isCardio ? 0 : (ex.sets || []).reduce((sum, s) => sum + s.reps, 0);
      
      const timestamp = new Date(r.date + 'T00:00:00').getTime();

      return {
        date: r.date,
        timestamp,
        maxWeight,
        max1RM,
        volume,
        reps,
        calories,
        isCardio,
        isBodyweight: ex.isBodyweight,
        equipment: ex.equipment,
        unit: ex.unit || 'kg',
        rawMaxWeight,
        rawMax1RM,
        exerciseDetail: ex
      };
    }).sort((a, b) => a.timestamp - b.timestamp);

    setRawChartData(data);

    // 器具・バリエーションタグのユニーク一覧を抽出（複数タグを個別分解）
    const eqSet = new Set<string>();
    let hasNone = false;
    data.forEach(d => {
      const tags = parseEquipmentTags(d.equipment);
      if (tags.length > 0) {
        tags.forEach(t => eqSet.add(t));
      } else {
        hasNone = true;
      }
    });

    const eqList = Array.from(eqSet).sort((a, b) => a.localeCompare(b, 'ja'));
    setAvailableEquipments(eqList);
    setHasNoEquipmentData(hasNone);
    setSelectedEquipments([]);
    setSelectedWorkout(null);
    setActiveDate(null);
  };

  // タグ選択のトグルハンドラー
  const handleToggleEquipment = (tag: string) => {
    if (tag === 'all') {
      setSelectedEquipments([]);
      return;
    }
    if (tag === '__none__') {
      if (selectedEquipments.includes('__none__')) {
        setSelectedEquipments([]);
      } else {
        setSelectedEquipments(['__none__']);
      }
      return;
    }

    // 個別タグのトグル
    const cleanList = selectedEquipments.filter(t => t !== '__none__');
    if (cleanList.includes(tag)) {
      setSelectedEquipments(cleanList.filter(t => t !== tag));
    } else {
      setSelectedEquipments([...cleanList, tag]);
    }
  };

  // 選択された器具・タグフィルターおよび単位フィルターに基づいてチャートデータを絞り込み
  const chartData = useMemo(() => {
    let list = rawChartData;

    // 1. 単位フィルター
    if (unitFilter === 'kg') {
      list = list.filter(d => d.unit !== 'lbs');
    } else if (unitFilter === 'lbs') {
      list = list.filter(d => d.unit === 'lbs');
    }

    // 2. 器具・タグフィルター
    if (selectedEquipments.length === 0) {
      return list;
    }
    if (selectedEquipments.includes('__none__')) {
      return list.filter(d => parseEquipmentTags(d.equipment).length === 0);
    }
    // 選択されたすべてのタグが含まれているデータを抽出（AND条件）
    return list.filter(d => {
      const itemTags = parseEquipmentTags(d.equipment);
      return selectedEquipments.every(selTag => itemTags.includes(selTag));
    });
  }, [rawChartData, selectedEquipments, unitFilter]);

  const filteredNames = useMemo(() => {
    return exerciseNames.filter(name => 
      name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [exerciseNames, searchTerm]);

  const isBodyweight = useMemo(() => {
    return chartData.length > 0 && chartData[0].isBodyweight;
  }, [chartData]);

  // デフォルト表示（一覧・概要グラフ）用の直近6ヶ月間データ（軽量化）
  const defaultSixMonthsChartData = useMemo(() => {
    if (chartData.length === 0) return [];
    const latestTimestamp = chartData[chartData.length - 1].timestamp;
    const sixMonthsAgo = latestTimestamp - (180 * 24 * 60 * 60 * 1000);
    const filtered = chartData.filter(d => d.timestamp >= sixMonthsAgo);
    return filtered.length > 0 ? filtered : chartData.slice(-10);
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
    setUnitFilter('all');
  };

  const getDayOfWeek = (dateStr: string) => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const d = new Date(dateStr);
    return days[d.getDay()];
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const itemData = payload[0].payload as ChartDataPoint;
      return (
        <div className="custom-tooltip glass">
          <p className="label">{itemData.date} ({getDayOfWeek(itemData.date)})</p>
          {payload.map((p: any, i: number) => {
            const isLbs = itemData.unit === 'lbs';
            let extraLabel = '';
            if (isLbs && (p.dataKey === 'maxWeight' || p.dataKey === 'max1RM')) {
              const rawVal = p.dataKey === 'maxWeight' ? itemData.rawMaxWeight : itemData.rawMax1RM;
              if (rawVal) extraLabel = ` (${rawVal} lbs)`;
            }
            return (
              <p key={i} className="value" style={{ color: p.color }}>
                {p.name}: {p.value} {p.unit || ''}{extraLabel}
              </p>
            );
          })}
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
    } else if (activeDetailType === 'max1RM') {
      chartTitle = '推定1RM';
      dataKey = 'max1RM';
      unit = 'kg';
      strokeColor = '#ff9500';
      chartIcon = <Zap size={20} />;
    } else if (activeDetailType === 'volume') {
      chartTitle = '総ボリューム';
      dataKey = 'volume';
      unit = 'kg';
      strokeColor = '#00e5a3';
      chartIcon = <Activity size={20} />;
    } else if (activeDetailType === 'reps') {
      chartTitle = '総レップ数';
      dataKey = 'reps';
      unit = '回';
      strokeColor = 'rgba(255, 0, 85, 0.6)';
      chartIcon = <RotateCcw size={20} />;
    } else if (activeDetailType === 'calories') {
      chartTitle = '消費カロリー推移';
      dataKey = 'calories';
      unit = 'kcal';
      strokeColor = '#ff5e3a';
      chartIcon = <Flame size={20} color="#ff5e3a" />;
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

    // フィルター適用後の全データ（拡大用）
    const fullDisplayChartData = onlyShowPB
      ? chartData.filter(item => pbDates.has(item.date))
      : chartData;

    // 概要用（直近6ヶ月データ）
    const summaryDisplayChartData = onlyShowPB
      ? defaultSixMonthsChartData.filter(item => pbDates.has(item.date))
      : defaultSixMonthsChartData;

    const renderChartContent = (height: number, isExpanded: boolean = false) => {
      const displayChartData = isExpanded ? fullDisplayChartData : summaryDisplayChartData;

      return (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart 
            data={displayChartData} 
            onClick={isExpanded ? handlePointClick : () => setDetailSubView('chart_only')} 
            onMouseMove={handleChartMouseMove}
            onMouseLeave={() => setActiveDate(null)}
            margin={{ top: 10, right: 20, left: -20, bottom: 20 }}
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
        </ResponsiveContainer>
      );
    };

    const renderChartSection = (height: number, isExpanded: boolean = false) => {
      if (!isExpanded) {
        return (
          <div 
            className="chart-container" 
            style={{ cursor: 'pointer' }} 
            onClick={() => setDetailSubView('chart_only')}
            title="クリックで拡大表示"
          >
            {renderChartContent(height, false)}
          </div>
        );
      }

      const minTimestamp = fullDisplayChartData.length > 0 ? fullDisplayChartData[0].timestamp : 0;
      const maxTimestamp = fullDisplayChartData.length > 0 ? fullDisplayChartData[fullDisplayChartData.length - 1].timestamp : 0;
      const totalSpan = maxTimestamp - minTimestamp;
      
      const currentScaleObj = SCALE_OPTIONS.find(opt => opt.key === timeRangeScale) || SCALE_OPTIONS[0];
      const widthMultiplier = currentScaleObj.key === 'all'
        ? 1
        : (totalSpan > currentScaleObj.ms ? Math.max(1, totalSpan / currentScaleObj.ms) : 1);

      const calculatedWidthPercent = Math.max(100, Math.round(widthMultiplier * 100));

      return (
        <div className="expanded-chart-scroll-container" ref={expandedChartScrollRef}>
          <div className="expanded-chart-inner" style={{ width: `${calculatedWidthPercent}%`, minWidth: '100%' }}>
            {renderChartContent(height, true)}
          </div>
        </div>
      );
    };

    const renderHistoryItems = (items: ChartDataPoint[]) => (
      <div className="history-list">
        {items.map((item, idx) => {
          const isPB = pbDates.has(item.date);
          const shouldHighlight = isPB && (showPBHighlight || onlyShowPB);
          return (
            <div 
              key={`${item.date}-${item.equipment || 'none'}-${idx}`} 
              className={`history-item card animate-in ${shouldHighlight ? 'pb-highlight' : ''}`}
              onClick={() => handlePointClick({ date: item.date })}
            >
              <div className="history-date-col">
                <div className="history-date-row">
                  <span className="history-date">{item.date}</span>
                  {item.equipment && (
                    <span className="equipment-chip">{item.equipment}</span>
                  )}
                  {shouldHighlight && <span className="pb-badge">最高記録🔥</span>}
                </div>
                <span className="history-dayofweek">({getDayOfWeek(item.date)}曜日)</span>
              </div>
              <div className="history-value-col">
                <span className={`history-value ${activeDetailType === 'reps' ? 'reps' : ''} ${shouldHighlight ? 'pb-text' : ''}`}>
                  {item[dataKey as keyof ChartDataPoint] as number}
                </span>
                <span className="history-unit">{unit}</span>
                {item.unit === 'lbs' && (activeDetailType === 'maxWeight' || activeDetailType === 'max1RM') && (
                  <span className="history-raw-lb-badge" title="記録時のポンド重量">
                    ({activeDetailType === 'maxWeight' ? item.rawMaxWeight : item.rawMax1RM} lbs)
                  </span>
                )}
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

    const renderScaleSelector = () => (
      <div className="scale-selector-container">
        <span className="scale-selector-label">表示範囲:</span>
        <div className="scale-pills-group">
          {SCALE_OPTIONS.map(opt => (
            <button
              key={opt.key}
              type="button"
              className={`scale-pill ${timeRangeScale === opt.key ? 'active' : ''}`}
              onClick={() => setTimeRangeScale(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );

    const equipmentDisplayLabel = selectedEquipments.length === 0 
      ? '' 
      : selectedEquipments.includes('__none__') 
        ? ' [指定なし]' 
        : ` [${selectedEquipments.join(', ')}]`;

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
            <span>
              {selectedName}
              {equipmentDisplayLabel && <strong className="detail-equipment-tag">{equipmentDisplayLabel}</strong>}
            </span>
          </div>
        </div>

        {/* 記録単位フィルター */}
        {renderUnitFilter()}

        {detailSubView === 'summary' && (
          <div className="subview-summary-container animate-in">
            {/* 概要推移チャートカード */}
            <div className="chart-section card">
              <div className="chart-header">
                <div className="chart-header-title">
                  {chartIcon}
                  <h3>{chartTitle}推移 ({unit})</h3>
                </div>
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
              <div className="chart-header expanded-chart-header">
                <div className="chart-header-title">
                  {chartIcon}
                  <h3>{chartTitle}詳細推移 ({unit})</h3>
                </div>
                <div className="expanded-chart-controls">
                  {renderScaleSelector()}
                  {renderFilterToggle()}
                </div>
              </div>
              {renderChartSection(400, true)}
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

  const renderDiffBadge = (val: number, prevVal?: number, unit = '') => {
    if (prevVal === undefined) {
      return <span className="diff-badge new">NEW</span>;
    }
    const diff = val - prevVal;
    if (diff > 0) {
      return (
        <span className="diff-badge up">
          <ArrowUpRight size={10} /> +{diff.toLocaleString()}{unit}
        </span>
      );
    }
    if (diff < 0) {
      return (
        <span className="diff-badge down">
          <ArrowDownRight size={10} /> {diff.toLocaleString()}{unit}
        </span>
      );
    }
    return <span className="diff-badge same"><Minus size={10} /> 0{unit}</span>;
  };

  // --- 月別サマリー一覧レンダリング ---
  const renderMonthlySummaryList = () => {
    if (monthlySummariesList.length === 0) {
      return (
        <div className="no-data-card card">
          <Calendar size={36} className="no-data-icon" />
          <p>トレーニング記録がまだありません</p>
        </div>
      );
    }

    return (
      <div className="monthly-summary-list animate-in">
        {monthlySummariesList.map(m => (
          <div 
            key={m.monthKey} 
            className="monthly-summary-card card"
            onClick={() => setSelectedMonthModalData(m)}
          >
            <div className="monthly-card-date">
              <span className="month-main">{m.year}年</span>
              <span className="month-huge">{m.month}月</span>
              <div className="month-days-container">
                <span className="month-days-badge">{m.trainingDays}日実施</span>
                {m.allDaysCount > m.trainingDays && (
                  <span className="month-cardio-days-sub">（有酸素含む: {m.allDaysCount}日）</span>
                )}
              </div>
            </div>

            <div className="monthly-card-metrics">
              <div className="m-metric-item">
                <span className="m-metric-lbl">総レップ数</span>
                <span className="m-metric-val">{m.totalReps.toLocaleString()} <small>reps</small></span>
              </div>
              <div className="m-metric-item">
                <span className="m-metric-lbl">総セット数</span>
                <span className="m-metric-val">{m.totalSets} <small>sets</small></span>
              </div>
              <div className="m-metric-item">
                <span className="m-metric-lbl">総ボリューム</span>
                <span className="m-metric-val">{m.totalVolume.toLocaleString()} <small>kg</small></span>
              </div>
            </div>

            {(() => {
              const pplGradient = generateConicGradient(m.pplData, PPL_COLORS);
              const bodyPartGradient = generateConicGradient(m.bodyPartData, BODY_PART_COLORS);

              return (
                <div className="monthly-card-charts">
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
        ))}
      </div>
    );
  };

  // --- 月別詳細サマリーモーダル ---
  const renderMonthlyDetailModal = () => {
    if (!selectedMonthModalData) return null;
    const m = selectedMonthModalData;

    return (
      <div className="modal-overlay" onClick={() => setSelectedMonthModalData(null)}>
        <div className="modal-content card monthly-detail-modal animate-in" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="summary-title-group">
              <span className="summary-badge">MONTHLY SUMMARY</span>
              <h3>{m.year}年{m.month}月 トレーニングサマリー</h3>
            </div>
            <button className="close-btn" onClick={() => setSelectedMonthModalData(null)}>
              <X size={20} />
            </button>
          </div>

          {/* クイック統計バー */}
          <div className="summary-kpi-grid">
            <div className="summary-kpi-card">
              <span className="kpi-label">実施日数</span>
              <div className="kpi-val-row">
                <span className="kpi-value">{m.trainingDays}</span>
                <span className="kpi-unit">日</span>
              </div>
              {m.allDaysCount > m.trainingDays && (
                <span className="kpi-cardio-sub">（有酸素含む: {m.allDaysCount}日）</span>
              )}
            </div>
            <div className="summary-kpi-card">
              <span className="kpi-label">総レップ数</span>
              <div className="kpi-val-row">
                <span className="kpi-value">{m.totalReps.toLocaleString()}</span>
                <span className="kpi-unit">reps</span>
              </div>
            </div>
            <div className="summary-kpi-card">
              <span className="kpi-label">総セット数</span>
              <div className="kpi-val-row">
                <span className="kpi-value">{m.totalSets}</span>
                <span className="kpi-unit">sets</span>
              </div>
            </div>
            <div className="summary-kpi-card">
              <span className="kpi-label">総ボリューム</span>
              <div className="kpi-val-row">
                <span className="kpi-value">{m.totalVolume.toLocaleString()}</span>
                <span className="kpi-unit">kg</span>
              </div>
            </div>
          </div>

          {/* やり込み種目 TOP 3 */}
          {m.topExercisesByReps.length > 0 && (
            <div className="monthly-top-ranks card">
              <div className="top-ranks-header">
                <Award size={16} color="#ff9500" />
                <h4>月間やり込み種目 TOP 3</h4>
              </div>
              <div className="top-ranks-grid">
                {m.topExercisesByReps.map((top, rankIdx) => (
                  <div key={top.name} className={`rank-card rank-${rankIdx + 1}`}>
                    <span className="rank-badge">#{rankIdx + 1}</span>
                    <div className="rank-info">
                      <span className="rank-name">{top.name}</span>
                      <span className="rank-stat">
                        {top.isCardio ? (
                          <span className="rank-cardio-stat">
                            🔥 {top.calories ? `${top.calories.toLocaleString()} kcal` : '有酸素'} {top.daysCount ? <small>({top.daysCount}日)</small> : null}
                          </span>
                        ) : (
                          <>{top.reps.toLocaleString()} reps <small>({top.sets} sets)</small></>
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 比率ドーナツグラフ（PPL & 5分割部位 / レップ数基準） */}
          <div className="summary-charts-grid">
            {/* PPL 比率 */}
            <div className="summary-chart-card">
              <div className="summary-chart-header">
                <Activity size={14} color="#ff2d55" />
                <h4>PPL比率（総レップ数）</h4>
              </div>
              <div className="summary-chart-body">
                <div className="pie-wrapper">
                  <ResponsiveContainer width={84} height={84}>
                    <PieChart>
                      <Pie
                        data={m.pplData}
                        innerRadius={22}
                        outerRadius={38}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {m.pplData.map((entry) => (
                          <Cell 
                            key={`m-modal-ppl-${entry.name}`} 
                            fill={PPL_COLORS[entry.name] || '#8e8e93'} 
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        formatter={(val: any, name: any) => [`${val} 回 (${m.totalReps > 0 ? Math.round((Number(val) / m.totalReps) * 100) : 0}%)`, name]}
                        contentStyle={{ background: '#1c1c1e', border: '1px solid #333', borderRadius: '8px', fontSize: '11px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="pie-legend">
                  {m.pplLegendData.map((d) => {
                    const pct = m.totalReps > 0 ? Math.round((d.value / m.totalReps) * 100) : 0;
                    return (
                      <div key={d.name} className="legend-item">
                        <span className="legend-dot" style={{ background: PPL_COLORS[d.name] || '#8e8e93' }} />
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
                        data={m.bodyPartData}
                        innerRadius={22}
                        outerRadius={38}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {m.bodyPartData.map((entry) => (
                          <Cell 
                            key={`m-modal-bp-${entry.name}`} 
                            fill={BODY_PART_COLORS[entry.name] || '#8e8e93'} 
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        formatter={(val: any, name: any) => [`${val} 回 (${m.totalReps > 0 ? Math.round((Number(val) / m.totalReps) * 100) : 0}%)`, name]}
                        contentStyle={{ background: '#1c1c1e', border: '1px solid #333', borderRadius: '8px', fontSize: '11px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="pie-legend">
                  {m.bodyPartLegendData.map((d) => {
                    const pct = m.totalReps > 0 ? Math.round((d.value / m.totalReps) * 100) : 0;
                    return (
                      <div key={d.name} className="legend-item">
                        <span className="legend-dot" style={{ background: BODY_PART_COLORS[d.name] || '#8e8e93' }} />
                        <span className="legend-name">{d.name}</span>
                        <span className="legend-pct">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* その月に更新されたPB一覧 */}
          {m.pbList.length > 0 && (
            <div className="summary-pb-banner">
              <div className="pb-banner-header">
                <Flame size={16} color="#ff9500" />
                <span>この月に更新された自己ベスト (PB: {m.pbList.length}件)</span>
              </div>
              <div className="pb-banner-items">
                {m.pbList.map((pb, pidx) => (
                  <div key={pidx} className="pb-banner-group">
                    <div className="pb-group-header">
                      <span className="pb-item-name">{pb.name} <small>({pb.date})</small></span>
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

          {/* 種目別月間実績テーブル（先月比付き） */}
          <div className="monthly-exercises-section">
            <div className="summary-section-header">
              <h4>種目別月間実績（先月比）</h4>
              <span className="section-sub-count">{m.exerciseSummaries.length} 種目</span>
            </div>

            <div className="monthly-table-container">
              <table className="monthly-perf-table">
                <thead>
                  <tr>
                    <th>種目名</th>
                    <th>MAX重量</th>
                    <th>推定1RM</th>
                    <th>総レップ数</th>
                    <th>総ボリューム</th>
                    <th>実施</th>
                  </tr>
                </thead>
                <tbody>
                  {m.exerciseSummaries.map((ex, exIdx) => (
                    <tr key={exIdx}>
                      <td className="cell-name-group">
                        <div className="table-ex-title-row">
                          <span className="table-ex-name">{ex.name}</span>
                          {parseEquipmentTags(ex.equipment).map((t, ti) => (
                            <span key={ti} className="compact-chip eq">{t}</span>
                          ))}
                        </div>
                        <div className="table-ex-chips">
                          {ex.isCardio ? (
                            <span className="compact-chip cardio">🏃 有酸素</span>
                          ) : (
                            <>
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
                            </>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="cell-stat-val">
                          {ex.isCardio ? '-' : (
                            ex.isBodyweight 
                              ? (ex.maxWeight > 0 ? `+${ex.maxWeight}kg` : '自重') 
                              : `${ex.maxWeight}kg`
                          )}
                        </div>
                        <div className="cell-diff">
                          {!ex.isCardio && !ex.isBodyweight && renderDiffBadge(ex.maxWeight, ex.prevMonth?.maxWeight, 'kg')}
                        </div>
                      </td>
                      <td>
                        <div className="cell-stat-val">
                          {!ex.isCardio && !ex.isBodyweight && ex.max1RM ? `${ex.max1RM}kg` : '-'}
                        </div>
                        <div className="cell-diff">
                          {!ex.isCardio && !ex.isBodyweight && ex.max1RM && renderDiffBadge(ex.max1RM, ex.prevMonth?.max1RM, 'kg')}
                        </div>
                      </td>
                      <td>
                        <div className="cell-stat-val">{ex.isCardio ? '-' : `${ex.totalReps.toLocaleString()}回`}</div>
                        <div className="cell-diff">
                          {!ex.isCardio && renderDiffBadge(ex.totalReps, ex.prevMonth?.totalReps, '回')}
                        </div>
                      </td>
                      <td>
                        <div className="cell-stat-val">
                          {ex.isCardio 
                            ? (ex.totalCalories ? `${ex.totalCalories.toLocaleString()} kcal` : '-') 
                            : `${ex.totalVolume.toLocaleString()}kg`}
                        </div>
                        <div className="cell-diff">
                          {ex.isCardio 
                            ? renderDiffBadge(ex.totalCalories || 0, ex.prevMonth?.totalCalories, 'kcal')
                            : renderDiffBadge(ex.totalVolume, ex.prevMonth?.totalVolume, 'kg')}
                        </div>
                      </td>
                      <td className="cell-meta">
                        <span>{ex.daysCount}日</span>
                        {!ex.isCardio && <small>({ex.setsCount}s)</small>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderUnitFilter = () => {
    // LB記録が1件以上ある場合に単位フィルターを表示
    const lbsCount = rawChartData.filter(d => d.unit === 'lbs').length;
    if (lbsCount === 0) return null;

    const allCount = rawChartData.length;
    const kgCount = rawChartData.filter(d => d.unit !== 'lbs').length;

    return (
      <div className="unit-filter-container card">
        <div className="equipment-filter-label">
          <span>記録単位で絞り込み</span>
        </div>
        <div className="equipment-pills-list">
          <button 
            type="button"
            className={`equipment-pill unit-pill ${unitFilter === 'all' ? 'active' : ''}`}
            onClick={() => setUnitFilter('all')}
          >
            すべて <span className="pill-count">({allCount})</span>
          </button>
          <button 
            type="button"
            className={`equipment-pill unit-pill ${unitFilter === 'kg' ? 'active' : ''}`}
            onClick={() => setUnitFilter('kg')}
          >
            kgのみ <span className="pill-count">({kgCount})</span>
          </button>
          <button 
            type="button"
            className={`equipment-pill unit-pill ${unitFilter === 'lbs' ? 'active' : ''}`}
            onClick={() => setUnitFilter('lbs')}
          >
            LBのみ <span className="pill-count">({lbsCount})</span>
          </button>
        </div>
      </div>
    );
  };

  const renderEquipmentFilter = () => {
    // 器具名が1件以上ある場合にフィルターを表示
    if (availableEquipments.length === 0) return null;

    const allCount = rawChartData.length;
    const noneCount = rawChartData.filter(d => parseEquipmentTags(d.equipment).length === 0).length;

    return (
      <div className="equipment-filter-container card">
        <div className="equipment-filter-label">
          <span>マシン / 器具・タグで絞り込み（複数選択可）</span>
        </div>
        <div className="equipment-pills-list">
          <button 
            type="button"
            className={`equipment-pill ${selectedEquipments.length === 0 ? 'active' : ''}`}
            onClick={() => handleToggleEquipment('all')}
          >
            すべて <span className="pill-count">({allCount})</span>
          </button>
          {availableEquipments.map(eq => {
            const count = rawChartData.filter(d => parseEquipmentTags(d.equipment).includes(eq)).length;
            const isSelected = selectedEquipments.includes(eq);
            return (
              <button 
                key={eq} 
                type="button"
                className={`equipment-pill ${isSelected ? 'active' : ''}`}
                onClick={() => handleToggleEquipment(eq)}
              >
                {eq} <span className="pill-count">({count})</span>
              </button>
            );
          })}
          {hasNoEquipmentData && (
            <button 
              type="button"
              className={`equipment-pill ${selectedEquipments.includes('__none__') ? 'active' : ''}`}
              onClick={() => handleToggleEquipment('__none__')}
            >
              指定なし <span className="pill-count">({noneCount})</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="charts-page">
      {/* 上部メインタブ（種目別分析 / 月ごとのサマリー） */}
      {activeDetailType === null && (
        <div className="view-toggle glass charts-main-toggle">
          <button 
            className={chartsMainTab === 'by_exercise' ? 'active' : ''} 
            onClick={() => setChartsMainTab('by_exercise')}
          >
            <TrendingUp size={16} />
            種目別推移
          </button>
          <button 
            className={chartsMainTab === 'monthly_summary' ? 'active' : ''} 
            onClick={() => setChartsMainTab('monthly_summary')}
          >
            <Calendar size={16} />
            月ごとのサマリー
          </button>
        </div>
      )}

      {/* --- 月ごとのサマリー表示 --- */}
      {chartsMainTab === 'monthly_summary' && activeDetailType === null && (
        <>
          {renderMonthlySummaryList()}
          {renderMonthlyDetailModal()}
        </>
      )}

      {/* --- 種目別分析表示（デフォルト） --- */}
      {chartsMainTab === 'by_exercise' && (
        activeDetailType === null ? (
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

          {/* 記録単位フィルター（有酸素種目では非表示） */}
          {!rawChartData[0]?.isCardio && renderUnitFilter()}

          {/* マシン・器具フィルター */}
          {renderEquipmentFilter()}

          {/* --- 有酸素運動の場合：消費カロリーグラフのみ表示 --- */}
          {rawChartData[0]?.isCardio && defaultSixMonthsChartData.length > 0 && (
            <div className="chart-section card" onClick={() => setActiveDetailType('calories')}>
              <div className="chart-header">
                <Flame size={18} color="#ff5e3a" />
                <h3>消費カロリー推移 (kcal)</h3>
              </div>
              <div className="chart-container" style={{ pointerEvents: 'none' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart 
                    data={defaultSixMonthsChartData} 
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                    <XAxis dataKey="timestamp" type="number" scale="time" domain={['dataMin', 'dataMax']} hide />
                    <YAxis stroke="#a0a0a0" fontSize={12} />
                    <Line 
                      type="monotone" 
                      dataKey="calories" 
                      stroke="#ff5e3a" 
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#ff5e3a', strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* --- 筋トレ種目の場合：4つのグラフを表示 --- */}
          {!rawChartData[0]?.isCardio && !isBodyweight && defaultSixMonthsChartData.length > 0 && (
            <div className="chart-section card" onClick={() => setActiveDetailType('maxWeight')}>
              <div className="chart-header">
                <TrendingUp size={18} />
                <h3>MAX重量推移 (kg)</h3>
              </div>
              <div className="chart-container" style={{ pointerEvents: 'none' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart 
                    data={defaultSixMonthsChartData} 
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

          {!rawChartData[0]?.isCardio && !isBodyweight && defaultSixMonthsChartData.some(d => d.max1RM > 0) && (
            <div className="chart-section card" onClick={() => setActiveDetailType('max1RM')}>
              <div className="chart-header">
                <Zap size={18} color="#ff9500" />
                <h3>推定1RM推移 (kg)</h3>
              </div>
              <div className="chart-container" style={{ pointerEvents: 'none' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart 
                    data={defaultSixMonthsChartData} 
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                    <XAxis dataKey="timestamp" type="number" scale="time" domain={['dataMin', 'dataMax']} hide />
                    <YAxis stroke="#a0a0a0" fontSize={12} domain={['dataMin - 5', 'dataMax + 5']} />
                    <Line 
                      type="monotone" 
                      dataKey="max1RM" 
                      stroke="#ff9500" 
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#ff9500', strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {!rawChartData[0]?.isCardio && !isBodyweight && defaultSixMonthsChartData.length > 0 && (
            <div className="chart-section card" onClick={() => setActiveDetailType('volume')}>
              <div className="chart-header">
                <Activity size={18} />
                <h3>総ボリューム (kg)</h3>
              </div>
              <div className="chart-container" style={{ pointerEvents: 'none' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart 
                    data={defaultSixMonthsChartData} 
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                    <XAxis dataKey="timestamp" type="number" scale="time" domain={['dataMin', 'dataMax']} hide />
                    <YAxis stroke="#a0a0a0" fontSize={12} />
                    <Line 
                      type="monotone" 
                      dataKey="volume" 
                      stroke="#00e5a3" 
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#00e5a3', strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {!rawChartData[0]?.isCardio && defaultSixMonthsChartData.length > 0 && (
            <div className="chart-section card" onClick={() => setActiveDetailType('reps')}>
              <div className="chart-header">
                <RotateCcw size={18} />
                <h3>総レップ数</h3>
              </div>
              <div className="chart-container" style={{ pointerEvents: 'none' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart 
                    data={defaultSixMonthsChartData} 
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                    <XAxis dataKey="timestamp" type="number" scale="time" domain={['dataMin', 'dataMax']} hide />
                    <YAxis stroke="#a0a0a0" fontSize={12} />
                    <Line 
                      type="monotone" 
                      dataKey="reps" 
                      stroke="rgba(255, 0, 85, 0.8)" 
                      strokeWidth={3}
                      dot={{ r: 4, fill: 'rgba(255, 0, 85, 0.8)', strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {chartData.length === 0 && selectedName && (
            <div className="no-data card">
              <p>該当する条件のデータがありません。</p>
            </div>
          )}
        </>
      ) : (
        renderDetailView()
      ))}

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
                      <div className="exercise-title-group">
                        <h4 className={ex.name === selectedName ? 'highlight' : ''}>{ex.name}</h4>
                        {parseEquipmentTags(ex.equipment).map((tag, ti) => (
                          <span key={ti} className="equipment-chip">{tag}</span>
                        ))}
                        {ex.ppl && <span className="category-chip ppl">{ex.ppl}</span>}
                        {ex.bodyPart && <span className="category-chip bodypart">{ex.bodyPart}</span>}
                      </div>
                    </div>
                    {ex.note && <p className="note"><Info size={12} /> {ex.note}</p>}
                  </div>
                  <div className="sets-grid">
                    {ex.sets.map((set, si) => {
                      const oneRM = !ex.isBodyweight 
                        ? (set.estimated1RM || calculate1RM(set.weight, set.reps, ex.bodyPart)) 
                        : undefined;

                      const unitLabel = ex.unit === 'lbs' ? 'lbs' : 'kg';
                      let setValText = `${set.weight}${unitLabel} × ${set.reps}回`;
                      if (ex.isBodyweight) {
                        setValText = set.weight && set.weight > 0
                          ? `自重(+${set.weight}${unitLabel}) × ${set.reps}回`
                          : `自重 × ${set.reps}回`;
                      }

                      return (
                        <div key={si} className="set-row">
                          <span className="set-num">{si + 1}</span>
                          <span className="set-val">{setValText}</span>
                          {oneRM !== undefined && (
                            <span className="set-1rm" title={`${ex.bodyPart || ''} 推定1RM`}>
                              1RM {oneRM}{unitLabel}
                            </span>
                          )}
                        </div>
                      );
                    })}
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
