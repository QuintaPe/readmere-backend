CREATE TABLE `bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`book_id` text NOT NULL,
	`cfi` text NOT NULL,
	`chapter` text,
	`note` text,
	`phrase` text,
	`excerpt` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
DROP INDEX "deck_words_deck_id_word_id_unique";--> statement-breakpoint
DROP INDEX "study_sessions_user_id_day_unique";--> statement-breakpoint
DROP INDEX "users_email_unique";--> statement-breakpoint
DROP INDEX "users_google_id_unique";--> statement-breakpoint
DROP INDEX "words_user_due_idx";--> statement-breakpoint
DROP INDEX "words_user_id_language_term_unique";--> statement-breakpoint
ALTER TABLE `users` ALTER COLUMN "password_hash" TO "password_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX `deck_words_deck_id_word_id_unique` ON `deck_words` (`deck_id`,`word_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `study_sessions_user_id_day_unique` ON `study_sessions` (`user_id`,`day`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_id_unique` ON `users` (`google_id`);--> statement-breakpoint
CREATE INDEX `words_user_due_idx` ON `words` (`user_id`,`srs_due`);--> statement-breakpoint
CREATE UNIQUE INDEX `words_user_id_language_term_unique` ON `words` (`user_id`,`language`,`term`);--> statement-breakpoint
ALTER TABLE `users` ADD `google_id` text;--> statement-breakpoint
ALTER TABLE `users` ADD `role` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `synopsis` text;--> statement-breakpoint
ALTER TABLE `books` ADD `genre` text;--> statement-breakpoint
ALTER TABLE `books` ADD `published_year` integer;--> statement-breakpoint
ALTER TABLE `profiles` ADD `new_cards_per_day` integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `theme` text DEFAULT 'dark' NOT NULL;--> statement-breakpoint
ALTER TABLE `words` ADD `phonetic` text;--> statement-breakpoint
ALTER TABLE `words` ADD `part_of_speech` text;--> statement-breakpoint
ALTER TABLE `words` ADD `synonyms` text;--> statement-breakpoint
ALTER TABLE `words` ADD `lemma` text;--> statement-breakpoint
ALTER TABLE `words` ADD `difficulty` text;