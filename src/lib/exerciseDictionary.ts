import type { BodyPartCategory, PPLCategory } from './db';

export type ExerciseCategory = BodyPartCategory | '有酸素運動';

export interface ExerciseDefinition {
  name: string;
  category: ExerciseCategory;
  ppl: PPLCategory;
  isCardio?: boolean;
  isBodyweight?: boolean;
}

/**
 * 7カテゴリー（5分割 + それ以外 + 有酸素運動）の定義順
 */
export const EXERCISE_CATEGORIES: ExerciseCategory[] = [
  '胸',
  '背中',
  '脚',
  '肩',
  '腕',
  'それ以外',
  '有酸素運動'
];

/**
 * 一般的な種目・マシン名の辞書マスターデータ
 * - 特定メーカー名（ハンマーストレングス等）は除外
 * - 派生形容詞（ナロー、ワイド、クローズグリップ等）は除外
 */
export const EXERCISE_DICTIONARY: ExerciseDefinition[] = [
  // ==========================================
  // 1. 胸 (Chest) - 基本PPL: プッシュ
  // ==========================================
  { name: 'ベンチプレス', category: '胸', ppl: 'プッシュ' },
  { name: 'インクラインベンチプレス', category: '胸', ppl: 'プッシュ' },
  { name: 'デクラインベンチプレス', category: '胸', ppl: 'プッシュ' },
  { name: 'ダンベルベンチプレス', category: '胸', ppl: 'プッシュ' },
  { name: 'インクラインダンベルベンチプレス', category: '胸', ppl: 'プッシュ' },
  { name: 'デクラインダンベルベンチプレス', category: '胸', ppl: 'プッシュ' },
  { name: 'チェストプレス', category: '胸', ppl: 'プッシュ' },
  { name: 'インクラインチェストプレス', category: '胸', ppl: 'プッシュ' },
  { name: 'デクラインチェストプレス', category: '胸', ppl: 'プッシュ' },
  { name: 'スミスマシンベンチプレス', category: '胸', ppl: 'プッシュ' },
  { name: 'スミスマシンインクラインベンチプレス', category: '胸', ppl: 'プッシュ' },
  { name: 'ダンベルフライ', category: '胸', ppl: 'プッシュ' },
  { name: 'インクラインダンベルフライ', category: '胸', ppl: 'プッシュ' },
  { name: 'ペックフライ', category: '胸', ppl: 'プッシュ' },
  { name: 'ケーブルクロスオーバー', category: '胸', ppl: 'プッシュ' },
  { name: 'ケーブルチェストプレス', category: '胸', ppl: 'プッシュ' },
  { name: 'ディップス', category: '胸', ppl: 'プッシュ', isBodyweight: true },
  { name: 'プッシュアップ', category: '胸', ppl: 'プッシュ', isBodyweight: true },
  { name: 'ダンベルプルオーバー', category: '胸', ppl: 'プッシュ' },

  // ==========================================
  // 2. 背中 (Back) - 基本PPL: プル
  // ==========================================
  { name: 'デッドリフト', category: '背中', ppl: 'プル' },
  { name: 'ラットプルダウン', category: '背中', ppl: 'プル' },
  { name: 'チンニング', category: '背中', ppl: 'プル', isBodyweight: true },
  { name: 'ベントオーバーロウ', category: '背中', ppl: 'プル' },
  { name: 'ダンベルロウ', category: '背中', ppl: 'プル' },
  { name: 'シーテッドケーブルロウ', category: '背中', ppl: 'プル' },
  { name: 'シーテッドロウ', category: '背中', ppl: 'プル' },
  { name: 'Tバーロウ', category: '背中', ppl: 'プル' },
  { name: 'スミスマシンロウ', category: '背中', ppl: 'プル' },
  { name: 'ストレートアームプルダウン', category: '背中', ppl: 'プル' },
  { name: 'インバーテッドロウ', category: '背中', ppl: 'プル', isBodyweight: true },
  { name: 'バックエクステンション', category: '背中', ppl: 'プル', isBodyweight: true },
  { name: 'グッドモーニング', category: '背中', ppl: 'プル' },
  { name: 'バーベルシュラッグ', category: '背中', ppl: 'プル' },
  { name: 'ダンベルシュラッグ', category: '背中', ppl: 'プル' },

  // ==========================================
  // 3. 脚 (Legs) - 基本PPL: レッグ
  // ==========================================
  { name: 'スクワット', category: '脚', ppl: 'レッグ' },
  { name: 'フロントスクワット', category: '脚', ppl: 'レッグ' },
  { name: 'スミスマシンスクワット', category: '脚', ppl: 'レッグ' },
  { name: 'レッグプレス', category: '脚', ppl: 'レッグ' },
  { name: 'ハックスクワット', category: '脚', ppl: 'レッグ' },
  { name: 'レッグエクステンション', category: '脚', ppl: 'レッグ' },
  { name: 'レッグカール', category: '脚', ppl: 'レッグ' },
  { name: 'シーテッドレッグカール', category: '脚', ppl: 'レッグ' },
  { name: 'ルーマニアンデッドリフト', category: '脚', ppl: 'レッグ' },
  { name: 'スティフレッグデッドリフト', category: '脚', ppl: 'レッグ' },
  { name: 'ブルガリアンスクワット', category: '脚', ppl: 'レッグ' },
  { name: 'ランジ', category: '脚', ppl: 'レッグ' },
  { name: 'ヒップスラスト', category: '脚', ppl: 'レッグ' },
  { name: 'ヒップアブダクション', category: '脚', ppl: 'レッグ' },
  { name: 'ヒップアダクション', category: '脚', ppl: 'レッグ' },
  { name: 'スタンディングカーフレイズ', category: '脚', ppl: 'レッグ' },
  { name: 'シーテッドカーフレイズ', category: '脚', ppl: 'レッグ' },

  // ==========================================
  // 4. 肩 (Shoulders) - PPL: プッシュ（前面・側部）/ プル（後面）
  // ==========================================
  { name: 'バーベルショルダープレス', category: '肩', ppl: 'プッシュ' },
  { name: 'ミリタリープレス', category: '肩', ppl: 'プッシュ' },
  { name: 'ダンベルショルダープレス', category: '肩', ppl: 'プッシュ' },
  { name: 'マシンショルダープレス', category: '肩', ppl: 'プッシュ' },
  { name: 'スミスマシンショルダープレス', category: '肩', ppl: 'プッシュ' },
  { name: 'アーノルドプレス', category: '肩', ppl: 'プッシュ' },
  { name: 'サイドレイズ', category: '肩', ppl: 'プッシュ' },
  { name: 'ラテラルレイズ', category: '肩', ppl: 'プッシュ' },
  { name: 'ケーブルサイドレイズ', category: '肩', ppl: 'プッシュ' },
  { name: 'フロントレイズ', category: '肩', ppl: 'プッシュ' },
  { name: 'アップライトロウ', category: '肩', ppl: 'プッシュ' },
  { name: 'リアレイズ', category: '肩', ppl: 'プル' },
  { name: 'リバースペックフライ', category: '肩', ppl: 'プル' },
  { name: 'フェイスプル', category: '肩', ppl: 'プル' },

  // ==========================================
  // 5. 腕 (Arms) - PPL: プル（二頭）/ プッシュ（三頭）
  // ==========================================
  // 上腕二頭筋 (プル)
  { name: 'バーベルカール', category: '腕', ppl: 'プル' },
  { name: 'ダンベルカール', category: '腕', ppl: 'プル' },
  { name: 'インクラインダンベルカール', category: '腕', ppl: 'プル' },
  { name: 'ハンマーカール', category: '腕', ppl: 'プル' },
  { name: 'プリチャーカール', category: '腕', ppl: 'プル' },
  { name: 'ケーブルカール', category: '腕', ppl: 'プル' },
  { name: 'コンセントレーションカール', category: '腕', ppl: 'プル' },
  { name: 'リバースカール', category: '腕', ppl: 'プル' },
  { name: 'リストカール', category: '腕', ppl: 'プル' },
  // 上腕三頭筋 (プッシュ)
  { name: 'スカルクラッシャー', category: '腕', ppl: 'プッシュ' },
  { name: 'トライセプスプッシュダウン', category: '腕', ppl: 'プッシュ' },
  { name: 'トライセプスエクステンション', category: '腕', ppl: 'プッシュ' },
  { name: 'フレンチプレス', category: '腕', ppl: 'プッシュ' },
  { name: 'キックバック', category: '腕', ppl: 'プッシュ' },
  { name: 'ベンチディップス', category: '腕', ppl: 'プッシュ', isBodyweight: true },

  // ==========================================
  // 6. それ以外 (Abs & Others) - 基本PPL: それ以外
  // ==========================================
  { name: 'クランチ', category: 'それ以外', ppl: 'それ以外', isBodyweight: true },
  { name: 'シットアップ', category: 'それ以外', ppl: 'それ以外', isBodyweight: true },
  { name: 'レッグレイズ', category: 'それ以外', ppl: 'それ以外', isBodyweight: true },
  { name: 'ハンギングレッグレイズ', category: 'それ以外', ppl: 'それ以外', isBodyweight: true },
  { name: 'アブドミナル', category: 'それ以外', ppl: 'それ以外' },
  { name: 'アブローラー', category: 'それ以外', ppl: 'それ以外', isBodyweight: true },
  { name: 'プランク', category: 'それ以外', ppl: 'それ以外', isBodyweight: true },
  { name: 'サイドプランク', category: 'それ以外', ppl: 'それ以外', isBodyweight: true },
  { name: 'ロシアンツイスト', category: 'それ以外', ppl: 'それ以外', isBodyweight: true },
  { name: 'トーソローテーション', category: 'それ以外', ppl: 'それ以外' },

  // ==========================================
  // 7. 有酸素運動 (Cardio) - isCardio: true
  // ==========================================
  { name: 'ランニング', category: '有酸素運動', ppl: 'それ以外', isCardio: true },
  { name: 'トレッドミル', category: '有酸素運動', ppl: 'それ以外', isCardio: true },
  { name: 'ウォーキング', category: '有酸素運動', ppl: 'それ以外', isCardio: true },
  { name: 'エアロバイク', category: '有酸素運動', ppl: 'それ以外', isCardio: true },
  { name: 'スピンバイク', category: '有酸素運動', ppl: 'それ以外', isCardio: true },
  { name: 'リカンベントバイク', category: '有酸素運動', ppl: 'それ以外', isCardio: true },
  { name: 'クロストレーナー', category: '有酸素運動', ppl: 'それ以外', isCardio: true },
  { name: 'ステアマスター', category: '有酸素運動', ppl: 'それ以外', isCardio: true },
  { name: 'ローイングマシン', category: '有酸素運動', ppl: 'それ以外', isCardio: true },
  { name: '水泳', category: '有酸素運動', ppl: 'それ以外', isCardio: true },
  { name: '縄跳び', category: '有酸素運動', ppl: 'それ以外', isCardio: true }
];

/**
 * カテゴリー別にグループ化された種目一覧を取得するヘルパー
 */
export const getExercisesByCategory = (category: ExerciseCategory): ExerciseDefinition[] => {
  return EXERCISE_DICTIONARY.filter(ex => ex.category === category);
};

/**
 * 種目名から辞書定義を検索するヘルパー
 */
export const findExerciseDefinition = (name: string): ExerciseDefinition | undefined => {
  return EXERCISE_DICTIONARY.find(ex => ex.name.toLowerCase() === name.toLowerCase());
};
