CREATE TABLE `outfits` (
	`person_id` integer PRIMARY KEY NOT NULL,
	`head` text,
	`neck` text,
	`held` text,
	`companion` text,
	`ground` text,
	`sky` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `breaks` ADD `from_alarm` integer DEFAULT false NOT NULL;