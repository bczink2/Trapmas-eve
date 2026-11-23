CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY,
  event_name TEXT NOT NULL,
  event_tagline TEXT NOT NULL,
  event_subheading TEXT NOT NULL DEFAULT '',
  event_description TEXT NOT NULL,
  presenter_name TEXT NOT NULL,
  featured_artist TEXT NOT NULL,
  event_date TEXT NOT NULL,
  event_time TEXT NOT NULL,
  venue_name TEXT NOT NULL,
  venue_address TEXT NOT NULL,
  city TEXT NOT NULL,
  fee_cents INTEGER NOT NULL,
  applications_open INTEGER NOT NULL,
  submission_deadline TEXT NOT NULL,
  cashapp_cashtag TEXT NOT NULL,
  cashapp_qr_key TEXT NOT NULL,
  artwork_key TEXT NOT NULL,
  payment_provider TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  instagram_url TEXT NOT NULL,
  genre_options TEXT NOT NULL,
  email_from_name TEXT NOT NULL,
  email_reply_to TEXT NOT NULL,
  terms_text TEXT NOT NULL,
  privacy_text TEXT NOT NULL,
  refund_text TEXT NOT NULL,
  legal_is_draft INTEGER NOT NULL,
  pending_email_subject TEXT NOT NULL,
  pending_email_body TEXT NOT NULL,
  confirmation_email_subject TEXT NOT NULL,
  confirmation_email_body TEXT NOT NULL,
  approved_email_subject TEXT NOT NULL,
  approved_email_body TEXT NOT NULL,
  waitlist_email_subject TEXT NOT NULL,
  waitlist_email_body TEXT NOT NULL,
  declined_email_subject TEXT NOT NULL,
  declined_email_body TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS id_counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  resume_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  legal_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  instagram TEXT NOT NULL,
  genre TEXT NOT NULL,
  bio TEXT NOT NULL,
  organizer_note TEXT NOT NULL,
  song1_title TEXT NOT NULL,
  song2_title TEXT NOT NULL,
  photo_key TEXT NOT NULL,
  photo_name TEXT NOT NULL,
  photo_bytes INTEGER NOT NULL,
  song1_key TEXT NOT NULL,
  song1_name TEXT NOT NULL,
  song1_bytes INTEGER NOT NULL,
  song2_key TEXT NOT NULL,
  song2_name TEXT NOT NULL,
  song2_bytes INTEGER NOT NULL,
  ack_terms INTEGER NOT NULL,
  ack_privacy INTEGER NOT NULL,
  ack_refund INTEGER NOT NULL,
  ack_rights INTEGER NOT NULL,
  ack_photo INTEGER NOT NULL,
  ack_fee INTEGER NOT NULL,
  acked_at TEXT NOT NULL,
  payment_provider TEXT NOT NULL,
  payer_name TEXT NOT NULL,
  payer_cashtag TEXT NOT NULL,
  payment_note TEXT NOT NULL,
  payment_claimed_at TEXT NOT NULL,
  paid_at TEXT NOT NULL,
  paid_by TEXT NOT NULL,
  paid_amount_cents INTEGER NOT NULL,
  payment_reference TEXT NOT NULL,
  provider_session_id TEXT NOT NULL,
  refunded_at TEXT NOT NULL,
  refunded_by TEXT NOT NULL,
  refund_note TEXT NOT NULL,
  decision_email_sent_at TEXT NOT NULL,
  confirmation_email_sent_at TEXT NOT NULL,
  pending_email_sent_at TEXT NOT NULL,
  file_hold TEXT NOT NULL DEFAULT 'disk',
  drive_folder_id TEXT NOT NULL DEFAULT '',
  photo_drive_id TEXT NOT NULL DEFAULT '',
  song1_drive_id TEXT NOT NULL DEFAULT '',
  song2_drive_id TEXT NOT NULL DEFAULT '',
  info_drive_id TEXT NOT NULL DEFAULT '',
  photo_sha256 TEXT NOT NULL DEFAULT '',
  song1_sha256 TEXT NOT NULL DEFAULT '',
  song2_sha256 TEXT NOT NULL DEFAULT '',
  info_sha256 TEXT NOT NULL DEFAULT '',
  synced_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS submission_notes (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS status_events (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  actor TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_provider_event
  ON webhook_events(provider, event_id);

CREATE TABLE IF NOT EXISTS email_log (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  template TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS submissions_email ON submissions(email);
CREATE INDEX IF NOT EXISTS notes_submission ON submission_notes(submission_id);
CREATE INDEX IF NOT EXISTS events_submission ON status_events(submission_id);
CREATE INDEX IF NOT EXISTS email_log_submission ON email_log(submission_id);
