CREATE TABLE `scenes` (
	`person_id` integer PRIMARY KEY NOT NULL,
	`thing` text NOT NULL,
	`weather` text NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
