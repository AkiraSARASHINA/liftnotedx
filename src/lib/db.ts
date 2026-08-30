import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export type PPLCategory = 'プッシュ' | 'プル' | 'レッグ' | 'それ以外';
export type BodyPartCategory = '胸' | '背中' | '脚' | '肩' | '腕' | 'それ以外';

export interface WorkoutSet {
  weight?: number;
  reps: number;
  estimated1RM?: number;
}

/**
 * 5分割法の部位に応じた推定1RMの算出
 * - 胸: Mayhew 式   1RM = (100 * w) / (52.2 + 41.9 * e^(-0.055 * r))
 * - 背中 / 脚: Epley 式 1RM = w * (1 + r / 30)
 * - 肩: Brzycki 式  1RM = w * (36 / (37 - r))
 * - 腕 / それ以外(その他): Wathan 式 1RM = (100 * w) / (48.8 + 53.8 * e^(-0.075 * r))
 * - 未分類: 対象外 (undefined)
 */
export const calculate1RM = (
  weight?: number, 
  reps?: number, 
  bodyPart?: BodyPartCategory
): number | undefined => {
  if (weight === undefined || weight === null || weight <= 0 || !reps || reps <= 0) {
    return undefined;
  }
  if (!bodyPart) {
    return undefined;
  }
  if (reps === 1) {
    return weight;
  }

  let oneRM: number | undefined;

  switch (bodyPart) {
    case '胸':
      // Mayhew 式
      oneRM = (100 * weight) / (52.2 + 41.9 * Math.exp(-0.055 * reps));
      break;

    case '背中':
    case '脚':
      // Epley 式
      oneRM = weight * (1 + reps / 30);
      break;

    case '肩':
      // Brzycki 式
      if (reps >= 37) return undefined;
      oneRM = weight * (36 / (37 - reps));
      break;

    case '腕':
    case 'それ以外':
      // Wathan 式
      oneRM = (100 * weight) / (48.8 + 53.8 * Math.exp(-0.075 * reps));
      break;

    default:
      return undefined;
  }

  return oneRM !== undefined ? Math.round(oneRM * 10) / 10 : undefined;
};

export const LB_TO_KG = 0.45359237;

/**
 * 重量をkg単位に換算するヘルパー
 */
export const convertToKg = (weight?: number, unit?: 'kg' | 'lbs'): number => {
  if (weight === undefined || weight === null) return 0;
  if (unit === 'lbs') {
    return weight * LB_TO_KG;
  }
  return weight;
};

export interface WorkoutSet {
  weight?: number;
  reps: number;
  estimated1RM?: number;
  unit?: 'kg' | 'lbs';
}

// 互換用 Brzycki式
export const calculateBrzycki1RM = (weight?: number, reps?: number): number | undefined => {
  return calculate1RM(weight, reps, '肩');
};

export interface Exercise {
  name: string;
  isCardio?: boolean;
  calories?: number;
  isBodyweight: boolean;
  equipment?: string;
  note?: string;
  ppl?: PPLCategory;
  bodyPart?: BodyPartCategory;
  unit?: 'kg' | 'lbs';
  sets: WorkoutSet[];
}

export interface Workout {
  date: string; // YYYY-MM-DD
  exercises: Exercise[];
  updatedAt: string; // ISO 8601
}

interface LiftNoteDXDB extends DBSchema {
  workouts: {
    key: string;
    value: Workout;
    indexes: { 'by-date': string };
  };
}

const DB_NAME = 'lift-note-dx-db';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<LiftNoteDXDB>>;

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<LiftNoteDXDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (oldVersion < 1) {
          const store = db.createObjectStore('workouts', {
            keyPath: 'date',
          });
          store.createIndex('by-date', 'date');
        }
        if (oldVersion < 2) {
          // v1→v2: 既存の全ワークアウトに updatedAt を付与
          const store = transaction.objectStore('workouts');
          store.getAll().then(workouts => {
            const now = new Date().toISOString();
            for (const workout of workouts) {
              store.put({ ...workout, updatedAt: now });
            }
          });
        }
      },
    });
  }
  return dbPromise;
};

type DBChangeListener = () => void;
const dbListeners = new Set<DBChangeListener>();

export const addDBChangeListener = (listener: DBChangeListener) => {
  dbListeners.add(listener);
  return () => {
    dbListeners.delete(listener);
  };
};

const notifyDBChange = () => {
  dbListeners.forEach(listener => listener());
};

export const saveWorkout = async (workout: Workout) => {
  const db = await initDB();

  // 自重種目以外の全セットに対して、5分割法部位ごとのモデルで推定1RMを自動計算・付与
  const normalizedExercises = workout.exercises.map(ex => ({
    ...ex,
    sets: ex.sets.map(set => {
      if (ex.isBodyweight || !set.weight || !ex.bodyPart) {
        const { estimated1RM, ...rest } = set;
        return rest;
      }
      const calculated1RM = calculate1RM(set.weight, set.reps, ex.bodyPart);
      return {
        ...set,
        estimated1RM: calculated1RM
      };
    })
  }));

  const workoutWithTimestamp: Workout = {
    ...workout,
    exercises: normalizedExercises,
    updatedAt: new Date().toISOString(),
  };
  const result = await db.put('workouts', workoutWithTimestamp);
  notifyDBChange();
  return result;
};

export const getWorkoutByDate = async (date: string) => {
  const db = await initDB();
  return db.get('workouts', date);
};

export const getAllWorkouts = async () => {
  const db = await initDB();
  return db.getAll('workouts');
};

export const deleteWorkout = async (date: string) => {
  const db = await initDB();
  const result = await db.delete('workouts', date);
  notifyDBChange();
  return result;
};


export const getExercisesByName = async (name: string) => {
  const workouts = await getAllWorkouts();
  const results: { date: string; exercise: Exercise }[] = [];

  workouts
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(w => {
      const matchingExercises = w.exercises.filter(e => e.name === name);
      if (matchingExercises.length === 0) return;

      // 器具ごとにグループ化するか、または各セッションを展開
      // 器具が同じ場合はマージ、異なる場合はそれぞれのセッションとして保持
      const equipmentGroups = new Map<string, Exercise[]>();
      matchingExercises.forEach(ex => {
        const eqKey = ex.equipment?.trim() || '';
        if (!equipmentGroups.has(eqKey)) {
          equipmentGroups.set(eqKey, []);
        }
        equipmentGroups.get(eqKey)!.push(ex);
      });

      equipmentGroups.forEach((exList, eqKey) => {
        const mergedExercise: Exercise = {
          name,
          isCardio: exList[0].isCardio,
          calories: exList.reduce((sum, e) => sum + (e.calories || 0), 0) || undefined,
          isBodyweight: exList[0].isBodyweight,
          equipment: eqKey || undefined,
          ppl: exList.find(e => !!e.ppl)?.ppl,
          bodyPart: exList.find(e => !!e.bodyPart)?.bodyPart,
          unit: exList.find(e => !!e.unit)?.unit,
          note: exList
            .map(e => e.note)
            .filter(n => !!n)
            .join(' / '),
          sets: exList.flatMap(e => e.sets)
        };

        results.push({
          date: w.date,
          exercise: mergedExercise
        });
      });
    });

  return results;
};

export const getUniqueExerciseNames = async () => {
  const workouts = await getAllWorkouts();
  const exerciseMap = new Map<string, string>(); // name -> latestDate

  workouts.forEach(w => {
    w.exercises.forEach(e => {
      const existingDate = exerciseMap.get(e.name);
      if (!existingDate || w.date > existingDate) {
        exerciseMap.set(e.name, w.date);
      }
    });
  });

  // Sort by latestDate descending, then by name
  return Array.from(exerciseMap.entries())
    .sort((a, b) => {
      const dateCompare = b[1].localeCompare(a[1]);
      if (dateCompare !== 0) return dateCompare;
      return a[0].localeCompare(b[0]);
    })
    .map(entry => entry[0]);
};

/**
 * カンマやスラッシュで区切られた器具・マシン・バリエーションタグを配列に分解する
 */
export const parseEquipmentTags = (equipment?: string): string[] => {
  if (!equipment) return [];
  return equipment
    .split(/[,/、]/)
    .map(t => t.trim())
    .filter(Boolean);
};

export const getUniqueEquipmentNames = async (exerciseName?: string) => {
  const workouts = await getAllWorkouts();
  const equipmentSet = new Set<string>();

  workouts.forEach(w => {
    w.exercises.forEach(e => {
      if (exerciseName && e.name !== exerciseName) return;
      if (e.equipment && e.equipment.trim()) {
        const tags = parseEquipmentTags(e.equipment);
        tags.forEach(tag => equipmentSet.add(tag));
      }
    });
  });

  return Array.from(equipmentSet).sort((a, b) => a.localeCompare(b, 'ja'));
};

