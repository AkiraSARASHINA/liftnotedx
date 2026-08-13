import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface WorkoutSet {
  weight?: number;
  reps: number;
}

export interface Exercise {
  name: string;
  isBodyweight: boolean;
  note?: string;
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
  const workoutWithTimestamp: Workout = {
    ...workout,
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
  return workouts
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(w => {
      const matchingExercises = w.exercises.filter(e => e.name === name);
      if (matchingExercises.length === 0) return null;

      // Merge multiple sessions of the same exercise on the same day
      const mergedExercise: Exercise = {
        name,
        isBodyweight: matchingExercises[0].isBodyweight,
        note: matchingExercises
          .map(e => e.note)
          .filter(n => !!n)
          .join(' / '),
        sets: matchingExercises.flatMap(e => e.sets)
      };

      return {
        date: w.date,
        exercise: mergedExercise
      };
    })
    .filter((item): item is { date: string; exercise: Exercise } => item !== null);
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
