CREATE TABLE `work_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`person_id` integer NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	`tz` integer NOT NULL,
	`day_key` text NOT NULL,
	`alarm_kind` text,
	`alarm_value` integer,
	`alarm_at` text,
	`snoozes` integer DEFAULT 0 NOT NULL,
	`paused_at` text,
	`pause_kind` text,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `work_stretches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	`sleepy_from` text,
	`carry` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `work_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
