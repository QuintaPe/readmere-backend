CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`author` text,
	`language` text DEFAULT 'en' NOT NULL,
	`file_path` text NOT NULL,
	`cover_path` text,
	`current_cfi` text,
	`progress` real DEFAULT 0 NOT NULL,
	`last_opened_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `deck_words` (
	`deck_id` text NOT NULL,
	`word_id` text NOT NULL,
	`user_id` text NOT NULL,
	`added_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`deck_id`) REFERENCES `decks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`word_id`) REFERENCES `words`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deck_words_deck_id_word_id_unique` ON `deck_words` (`deck_id`,`word_id`);--> statement-breakpoint
CREATE TABLE `decks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text DEFAULT '#10b981' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`target_language` text DEFAULT 'en' NOT NULL,
	`native_language` text DEFAULT 'es' NOT NULL,
	`daily_goal` integer DEFAULT 20 NOT NULL,
	`streak_current` integer DEFAULT 0 NOT NULL,
	`streak_longest` integer DEFAULT 0 NOT NULL,
	`last_study_date` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `study_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`reviews` integer DEFAULT 0 NOT NULL,
	`words_added` integer DEFAULT 0 NOT NULL,
	`reading_minutes` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `study_sessions_user_id_day_unique` ON `study_sessions` (`user_id`,`day`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `words` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`term` text NOT NULL,
	`translation` text,
	`definition` text,
	`example` text,
	`language` text DEFAULT 'en' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`source` text,
	`source_book_id` text,
	`srs_interval` real DEFAULT 0 NOT NULL,
	`srs_ease` real DEFAULT 2.5 NOT NULL,
	`srs_reps` integer DEFAULT 0 NOT NULL,
	`srs_lapses` integer DEFAULT 0 NOT NULL,
	`srs_due` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_reviewed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `words_user_id_language_term_unique` ON `words` (`user_id`,`language`,`term`);