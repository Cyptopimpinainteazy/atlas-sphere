use rusqlite::{Connection, Result as SqlResult};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct CrmDb {
    pub conn: Mutex<Connection>,
}

impl CrmDb {
    pub fn new(app_dir: PathBuf) -> SqlResult<Self> {
        std::fs::create_dir_all(&app_dir).ok();
        let db_path = app_dir.join("atlas_crm.db");
        let conn = Connection::open(db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        let db = Self { conn: Mutex::new(conn) };
        db.run_migrations()?;
        Ok(db)
    }

    fn run_migrations(&self) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch("
            /* ── Contacts ── */
            CREATE TABLE IF NOT EXISTS crm_contacts (
                id              TEXT PRIMARY KEY,
                owner_user_id   TEXT NOT NULL,
                first_name      TEXT NOT NULL,
                last_name       TEXT DEFAULT '',
                email           TEXT DEFAULT '',
                phone           TEXT DEFAULT '',
                company         TEXT DEFAULT '',
                job_title       TEXT DEFAULT '',
                avatar_url      TEXT DEFAULT '',
                address         TEXT DEFAULT '',
                city            TEXT DEFAULT '',
                state           TEXT DEFAULT '',
                zip             TEXT DEFAULT '',
                country         TEXT DEFAULT '',
                website         TEXT DEFAULT '',
                notes           TEXT DEFAULT '',
                tags            TEXT DEFAULT '',
                source          TEXT DEFAULT 'manual',
                stage           TEXT DEFAULT 'lead',
                priority        TEXT DEFAULT 'medium',
                last_contacted  TEXT DEFAULT '',
                created_at      TEXT NOT NULL,
                updated_at      TEXT NOT NULL
            );

            /* ── Calendar Events ── */
            CREATE TABLE IF NOT EXISTS crm_events (
                id              TEXT PRIMARY KEY,
                owner_user_id   TEXT NOT NULL,
                title           TEXT NOT NULL,
                description     TEXT DEFAULT '',
                location        TEXT DEFAULT '',
                event_type      TEXT DEFAULT 'meeting',
                start_at        TEXT NOT NULL,
                end_at          TEXT NOT NULL,
                all_day         INTEGER DEFAULT 0,
                color           TEXT DEFAULT '#ff6b35',
                recurrence      TEXT DEFAULT '',
                reminder_mins   INTEGER DEFAULT 15,
                contact_id      TEXT DEFAULT '',
                deal_id         TEXT DEFAULT '',
                completed       INTEGER DEFAULT 0,
                created_at      TEXT NOT NULL,
                updated_at      TEXT NOT NULL
            );

            /* ── Deals / Pipeline ── */
            CREATE TABLE IF NOT EXISTS crm_deals (
                id              TEXT PRIMARY KEY,
                owner_user_id   TEXT NOT NULL,
                contact_id      TEXT DEFAULT '',
                title           TEXT NOT NULL,
                value           REAL DEFAULT 0.0,
                currency        TEXT DEFAULT 'USD',
                stage           TEXT DEFAULT 'prospect',
                probability     INTEGER DEFAULT 10,
                expected_close  TEXT DEFAULT '',
                notes           TEXT DEFAULT '',
                won             INTEGER DEFAULT 0,
                lost            INTEGER DEFAULT 0,
                created_at      TEXT NOT NULL,
                updated_at      TEXT NOT NULL
            );

            /* ── Activity Log ── */
            CREATE TABLE IF NOT EXISTS crm_activities (
                id              TEXT PRIMARY KEY,
                owner_user_id   TEXT NOT NULL,
                contact_id      TEXT DEFAULT '',
                deal_id         TEXT DEFAULT '',
                event_id        TEXT DEFAULT '',
                activity_type   TEXT NOT NULL DEFAULT 'note',
                subject         TEXT DEFAULT '',
                body            TEXT DEFAULT '',
                created_at      TEXT NOT NULL
            );

            /* ── Email Templates ── */
            CREATE TABLE IF NOT EXISTS crm_email_templates (
                id              TEXT PRIMARY KEY,
                owner_user_id   TEXT NOT NULL,
                name            TEXT NOT NULL,
                subject         TEXT NOT NULL DEFAULT '',
                body            TEXT NOT NULL DEFAULT '',
                created_at      TEXT NOT NULL,
                updated_at      TEXT NOT NULL
            );

            /* ── SMTP Config ── */
            CREATE TABLE IF NOT EXISTS crm_smtp_config (
                id              TEXT PRIMARY KEY,
                owner_user_id   TEXT NOT NULL UNIQUE,
                host            TEXT NOT NULL DEFAULT '',
                port            INTEGER DEFAULT 587,
                username        TEXT DEFAULT '',
                password        TEXT DEFAULT '',
                from_name       TEXT DEFAULT '',
                from_email      TEXT DEFAULT '',
                use_tls         INTEGER DEFAULT 1,
                created_at      TEXT NOT NULL,
                updated_at      TEXT NOT NULL
            );

            /* ── Sent Emails Log ── */
            CREATE TABLE IF NOT EXISTS crm_sent_emails (
                id              TEXT PRIMARY KEY,
                owner_user_id   TEXT NOT NULL,
                contact_id      TEXT DEFAULT '',
                to_email        TEXT NOT NULL,
                subject         TEXT NOT NULL,
                body            TEXT NOT NULL,
                status          TEXT DEFAULT 'sent',
                error_message   TEXT DEFAULT '',
                template_id     TEXT DEFAULT '',
                created_at      TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_crm_contacts_owner ON crm_contacts(owner_user_id);
            CREATE INDEX IF NOT EXISTS idx_crm_events_owner ON crm_events(owner_user_id);
            CREATE INDEX IF NOT EXISTS idx_crm_events_start ON crm_events(start_at);
            CREATE INDEX IF NOT EXISTS idx_crm_deals_owner ON crm_deals(owner_user_id);
            CREATE INDEX IF NOT EXISTS idx_crm_activities_owner ON crm_activities(owner_user_id);
            CREATE INDEX IF NOT EXISTS idx_crm_activities_contact ON crm_activities(contact_id);
            CREATE INDEX IF NOT EXISTS idx_crm_sent_emails_owner ON crm_sent_emails(owner_user_id);
        ")?;
        Ok(())
    }
}
