CREATE TABLE `look_backs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`person_id` integer NOT NULL,
	`enough_id` integer NOT NULL,
	`text` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`enough_id`) REFERENCES `enoughs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `look_backs_enough_id_unique` ON `look_backs` (`enough_id`);--> statement-breakpoint
-- Lines written on a worry become the one line for its enough (2026-11-07):
-- the latest one, if there were several.
INSERT INTO `look_backs` (`person_id`, `enough_id`, `text`, `created_at`)
SELECT `person_id`, `enough_id`, `since`, `since_at` FROM `worries` AS w
WHERE `since` IS NOT NULL
  AND `since_at` = (SELECT max(`since_at`) FROM `worries` WHERE `enough_id` = w.`enough_id` AND `since` IS NOT NULL);--> statement-breakpoint
ALTER TABLE `worries` DROP COLUMN `since`;--> statement-breakpoint
ALTER TABLE `worries` DROP COLUMN `since_at`;