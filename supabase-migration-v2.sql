-- Migration: add read tracking to messages
-- Run this in Supabase SQL Editor

-- Add a 'read' column. Defaults to false for new rows.
-- Existing messages get set to true (we don't want them all showing as unread retroactively)
alter table messages add column if not exists read boolean default false;

-- Mark all existing messages as read so old chats don't show unread badges
update messages set read = true where read is null or read = false;

-- Index for fast unread-count queries
create index if not exists idx_messages_unread
  on messages (recipient_username, sender_username, read)
  where read = false;
