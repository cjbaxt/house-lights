-- HL-76: Privacy toggle for ticket purchase status visibility
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS share_ticket_status boolean NOT NULL DEFAULT true;
