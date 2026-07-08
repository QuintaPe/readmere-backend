import { sql } from "drizzle-orm";
import { text, integer, sqliteTable, real, unique, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // UUID string
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  googleId: text("google_id").unique(),
  role: text("role").default('user').notNull(), // 'user' | 'admin'
  status: text("status").default('active').notNull(), // 'active' | 'suspended'
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  displayName: text("display_name"),
  targetLanguage: text("target_language").default('en').notNull(),
  nativeLanguage: text("native_language").default('es').notNull(),
  dailyGoal: integer("daily_goal").default(20).notNull(),
  streakCurrent: integer("streak_current").default(0).notNull(),
  streakLongest: integer("streak_longest").default(0).notNull(),
  lastStudyDate: text("last_study_date"), // YYYY-MM-DD
  newCardsPerDay: integer("new_cards_per_day").default(10).notNull(),
  theme: text("theme").default('dark').notNull(), // 'dark' | 'light' | 'system'
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const words = sqliteTable("words", {
  id: text("id").primaryKey(), // UUID
  userId: text("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  term: text("term").notNull(),
  translation: text("translation"),
  definition: text("definition"),
  example: text("example"),
  language: text("language").default('en').notNull(),
  status: text("status").default('new').notNull(), // 'new', 'learning', 'known', 'ignored'
  source: text("source"),
  sourceBookId: text("source_book_id"),
  phonetic: text("phonetic"),
  partOfSpeech: text("part_of_speech"),
  synonyms: text("synonyms"), // comma-separated
  lemma: text("lemma"),
  difficulty: text("difficulty"), // CEFR: A1, A2, B1, B2, C1, C2 // Can't strongly reference if we don't want strict circularity, but can be a UUID
  srsInterval: real("srs_interval").default(0).notNull(),
  srsEase: real("srs_ease").default(2.5).notNull(),
  srsReps: integer("srs_reps").default(0).notNull(),
  srsLapses: integer("srs_lapses").default(0).notNull(),
  srsDue: text("srs_due").default(sql`CURRENT_TIMESTAMP`).notNull(),
  lastReviewedAt: text("last_reviewed_at"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (t) => ({
  unq: unique().on(t.userId, t.language, t.term),
  // La sesión de flashcards filtra por usuario y ordena por vencimiento en cada carga
  dueIdx: index("words_user_due_idx").on(t.userId, t.srsDue),
}));

export const decks = sqliteTable("decks", {
  id: text("id").primaryKey(), // UUID
  userId: text("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default('#10b981').notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const deckWords = sqliteTable("deck_words", {
  deckId: text("deck_id").notNull().references(() => decks.id, { onDelete: 'cascade' }),
  wordId: text("word_id").notNull().references(() => words.id, { onDelete: 'cascade' }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  addedAt: text("added_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (t) => ({
  pk: unique().on(t.deckId, t.wordId)
}));

export const books = sqliteTable("books", {
  id: text("id").primaryKey(), // UUID
  userId: text("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  author: text("author"),
  language: text("language").default('en').notNull(),
  filePath: text("file_path").notNull(),
  coverPath: text("cover_path"),
  synopsis: text("synopsis"),
  genre: text("genre"),
  publishedYear: integer("published_year"),
  currentCfi: text("current_cfi"),
  progress: real("progress").default(0).notNull(),
  lastOpenedAt: text("last_opened_at"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const bookmarks = sqliteTable("bookmarks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  bookId: text("book_id").notNull().references(() => books.id, { onDelete: 'cascade' }),
  cfi: text("cfi").notNull(),
  chapter: text("chapter"),
  note: text("note"),
  phrase: text("phrase"),
  excerpt: text("excerpt"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Registro individual de cada repaso (para tasa de retención y calibrado SRS).
// studySessions guarda solo agregados diarios; esto guarda cada valoración.
export const reviewLogs = sqliteTable("review_logs", {
  id: text("id").primaryKey(), // UUID
  userId: text("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  wordId: text("word_id").notNull().references(() => words.id, { onDelete: 'cascade' }),
  rating: integer("rating").notNull(), // 0=again 1=hard 2=good 3=easy
  reviewedAt: text("reviewed_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (t) => ({
  userDateIdx: index("review_logs_user_date_idx").on(t.userId, t.reviewedAt),
}));

export const studySessions = sqliteTable("study_sessions", {
  id: text("id").primaryKey(), // UUID
  userId: text("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  day: text("day").notNull(), // YYYY-MM-DD
  reviews: integer("reviews").default(0).notNull(),
  wordsAdded: integer("words_added").default(0).notNull(),
  readingMinutes: integer("reading_minutes").default(0).notNull(),
}, (t) => ({
  unq: unique().on(t.userId, t.day)
}));
