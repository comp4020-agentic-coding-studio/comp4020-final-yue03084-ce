DROP INDEX `worries_enough_id_unique`;--> statement-breakpoint
ALTER TABLE `worries` ADD `since` text;--> statement-breakpoint
ALTER TABLE `worries` ADD `since_at` text;--> statement-breakpoint
-- Drawer notes become worries on the same enough (2026-11-05): they come back
-- a week after they were written, like any worry, and one already put away
-- stays put away. drawer_notes itself is left as it was, unread from now on.
INSERT INTO `worries` (`person_id`, `enough_id`, `text`, `open_from`, `dismissed_at`, `created_at`)
SELECT `person_id`, `enough_id`, `text`, date(`open_from`, '+6 days'), `dismissed_at`, `created_at`
FROM `drawer_notes`;
