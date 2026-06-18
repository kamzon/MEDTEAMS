/// Database module for MedTeams
/// Handles SQLite initialization, schema creation, and query management
/// using SQLx for type-safe, async database operations

use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use sqlx::Row;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use std::path::PathBuf;
use std::str::FromStr;
use uuid::Uuid;

/// Global database connection pool
pub type DbPool = SqlitePool;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatientRecord {
    pub id: String,
    pub amo_id: String,
    pub name: String,
    pub cin: Option<String>,
    pub phone: String,
    pub birth_date: String,
    pub insurance_scheme: String,
    pub chronic_conditions: Vec<String>,
    pub allergies: Vec<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewPatientInput {
    pub amo_id: String,
    pub name: String,
    pub cin: Option<String>,
    pub phone: String,
    pub birth_date: String,
    pub insurance_scheme: String,
    pub chronic_conditions: Vec<String>,
    pub allergies: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppointmentRecord {
    pub id: String,
    pub patient_id: String,
    pub date_time: String,
    pub status: String,
    pub checked_in_at: Option<String>,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewAppointmentInput {
    pub patient_id: String,
    pub date_time: String,
    pub status: String,
    pub checked_in_at: Option<String>,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrescriptionMedication {
    pub name: String,
    pub dosage: String,
    pub duration: String,
    pub frequency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsultationInput {
    pub patient_id: String,
    pub appointment_id: String,
    pub date: String,
    pub soap_subjective: String,
    pub soap_objective: String,
    pub soap_assessment: String,
    pub soap_plan: String,
    pub prescribed_meds: Vec<PrescriptionMedication>,
    pub fse_qr_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsultationRecord {
    pub id: String,
    pub patient_id: String,
    pub appointment_id: String,
    pub date: String,
    pub soap_subjective: String,
    pub soap_objective: String,
    pub soap_assessment: String,
    pub soap_plan: String,
    pub prescribed_meds: Vec<PrescriptionMedication>,
    pub fse_qr_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachmentRecord {
    pub id: String,
    pub patient_id: String,
    pub file_path: String,
    pub file_name: String,
    pub file_type: String,
    pub uploaded_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatientQueueResponse {
    pub patient: PatientRecord,
    pub appointment: AppointmentRecord,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserRecord {
    pub id: String,
    pub username: String,
    pub role: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewUserInput {
    pub username: String,
    pub password: String,
    pub role: String,
    pub name: String,
}

#[derive(Debug, FromRow)]
struct PatientRow {
    id: String,
    amo_id: String,
    name: String,
    cin: Option<String>,
    phone: String,
    birth_date: String,
    insurance_scheme: String,
    chronic_conditions: String,
    allergies: String,
    created_at: String,
}

#[derive(Debug, FromRow)]
struct AppointmentRow {
    id: String,
    patient_id: String,
    date_time: String,
    status: String,
    checked_in_at: Option<String>,
    notes: Option<String>,
}

#[derive(Debug, FromRow)]
struct ConsultationRow {
    id: String,
    patient_id: String,
    appointment_id: String,
    date: String,
    soap_subjective: String,
    soap_objective: String,
    soap_assessment: String,
    soap_plan: String,
    prescribed_meds: String,
    fse_qr_token: String,
}

#[derive(Debug, FromRow)]
struct AttachmentRow {
    id: String,
    patient_id: String,
    file_path: String,
    file_name: String,
    file_type: String,
    uploaded_at: String,
}

#[derive(Debug, FromRow)]
struct UserRow {
    id: String,
    username: String,
    role: String,
    name: String,
}

/// Initialize the SQLite database and create tables if they don't exist
/// 
/// This function:
/// 1. Creates the local data directory if it doesn't exist
/// 2. Creates or opens the SQLite database file
/// 3. Executes CREATE TABLE IF NOT EXISTS statements for all core tables
/// 4. Returns a connection pool for use throughout the application
pub async fn init_database() -> Result<DbPool, Box<dyn std::error::Error>> {
    // Determine the database file path in the app's local data directory
    let app_data_dir = get_app_data_dir()?;
    let db_path = app_data_dir.join("medteams.sqlite");

    // Log database location for debugging
    log::info!("Initializing database at: {:?}", db_path);

    // Create the connection options
    let connect_options = SqliteConnectOptions::from_str(
        &format!("sqlite://{}", db_path.display())
    )?
    .create_if_missing(true);

    // Create the connection pool
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(connect_options)
        .await?;

    // Run migrations (create tables if they don't exist)
    create_tables(&pool).await?;
    seed_default_users(&pool).await?;
    ensure_patient_cin_column(&pool).await?;

    log::info!("Database initialized successfully");
    Ok(pool)
}

/// Fetch all patients from the database and deserialize JSON array fields.
pub async fn fetch_patients(pool: &DbPool) -> Result<Vec<PatientRecord>, sqlx::Error> {
    let rows = sqlx::query_as::<_, PatientRow>(
        r#"
        SELECT
            id,
            amo_id,
            name,
            cin,
            phone,
            birth_date,
            insurance_scheme,
            chronic_conditions,
            allergies,
            created_at
        FROM patients
        ORDER BY created_at DESC, name ASC
        "#,
    )
    .fetch_all(pool)
    .await?;

    let patients = rows
        .into_iter()
        .map(|row| PatientRecord {
            id: row.id,
            amo_id: row.amo_id,
            name: row.name,
            cin: row.cin,
            phone: row.phone,
            birth_date: row.birth_date,
            insurance_scheme: row.insurance_scheme,
            chronic_conditions: serde_json::from_str(&row.chronic_conditions).unwrap_or_default(),
            allergies: serde_json::from_str(&row.allergies).unwrap_or_default(),
            created_at: row.created_at,
        })
        .collect();

    Ok(patients)
}

/// Fetch all users from the database without exposing passwords.
pub async fn fetch_users(pool: &DbPool) -> Result<Vec<UserRecord>, sqlx::Error> {
    let rows = sqlx::query_as::<_, UserRow>(
        r#"
        SELECT
            id,
            username,
            password,
            role,
            name
        FROM users
        ORDER BY name ASC, username ASC
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| UserRecord {
            id: row.id,
            username: row.username,
            role: row.role,
            name: row.name,
        })
        .collect())
}

/// Authenticate a user using plaintext credentials for the current prototype.
pub async fn authenticate_user(
    pool: &DbPool,
    username: &str,
    password: &str,
) -> Result<UserRecord, sqlx::Error> {
    let row = sqlx::query_as::<_, UserRow>(
        r#"
        SELECT
            id,
            username,
            role,
            name
        FROM users
        WHERE username = ? AND password = ?
        LIMIT 1
        "#,
    )
    .bind(username)
    .bind(password)
    .fetch_optional(pool)
    .await?;

    match row {
        Some(user) => Ok(UserRecord {
            id: user.id,
            username: user.username,
            role: user.role,
            name: user.name,
        }),
        None => Err(sqlx::Error::RowNotFound),
    }
}

/// Insert a new user into the users table.
pub async fn insert_user(pool: &DbPool, user: NewUserInput) -> Result<UserRecord, sqlx::Error> {
    let user_id = Uuid::new_v4().to_string();

    sqlx::query(
        r#"
        INSERT INTO users (
            id,
            username,
            password,
            role,
            name
        ) VALUES (?, ?, ?, ?, ?)
        "#,
    )
    .bind(&user_id)
    .bind(&user.username)
    .bind(&user.password)
    .bind(&user.role)
    .bind(&user.name)
    .execute(pool)
    .await?;

    Ok(UserRecord {
        id: user_id,
        username: user.username,
        role: user.role,
        name: user.name,
    })
}

/// Fetch all appointments from the database.
pub async fn fetch_appointments(pool: &DbPool) -> Result<Vec<AppointmentRecord>, sqlx::Error> {
    let rows = sqlx::query_as::<_, AppointmentRow>(
        r#"
        SELECT
            id,
            patient_id,
            date_time,
            status,
            checked_in_at,
            notes
        FROM appointments
        ORDER BY datetime(date_time) DESC, datetime(checked_in_at) DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| AppointmentRecord {
            id: row.id,
            patient_id: row.patient_id,
            date_time: row.date_time,
            status: row.status,
            checked_in_at: row.checked_in_at,
            notes: row.notes.unwrap_or_default(),
        })
        .collect())
}

/// Fetch all consultations from the database.
pub async fn fetch_consultations(pool: &DbPool) -> Result<Vec<ConsultationRecord>, sqlx::Error> {
    let rows = sqlx::query_as::<_, ConsultationRow>(
        r#"
        SELECT
            id,
            patient_id,
            appointment_id,
            date,
            soap_subjective,
            soap_objective,
            soap_assessment,
            soap_plan,
            prescribed_meds,
            fse_qr_token
        FROM consultations
        ORDER BY datetime(date) DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| ConsultationRecord {
            id: row.id,
            patient_id: row.patient_id,
            appointment_id: row.appointment_id,
            date: row.date,
            soap_subjective: row.soap_subjective,
            soap_objective: row.soap_objective,
            soap_assessment: row.soap_assessment,
            soap_plan: row.soap_plan,
            prescribed_meds: serde_json::from_str(&row.prescribed_meds).unwrap_or_default(),
            fse_qr_token: row.fse_qr_token,
        })
        .collect())
}

/// Fetch all attachments from the database.
pub async fn fetch_attachments(pool: &DbPool) -> Result<Vec<AttachmentRecord>, sqlx::Error> {
    let rows = sqlx::query_as::<_, AttachmentRow>(
        r#"
        SELECT
            id,
            patient_id,
            file_path,
            file_name,
            file_type,
            uploaded_at
        FROM attachments
        ORDER BY datetime(uploaded_at) DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| AttachmentRecord {
            id: row.id,
            patient_id: row.patient_id,
            file_path: row.file_path,
            file_name: row.file_name,
            file_type: row.file_type,
            uploaded_at: row.uploaded_at,
        })
        .collect())
}

/// Insert a new patient into the database.
pub async fn insert_patient(
    pool: &DbPool,
    patient: NewPatientInput,
) -> Result<PatientRecord, sqlx::Error> {
    let patient_id = Uuid::new_v4().to_string();
    let created_at = chrono::Utc::now().to_rfc3339();
    let chronic_conditions_json = serde_json::to_string(&patient.chronic_conditions)
        .unwrap_or_else(|_| "[]".to_string());
    let allergies_json = serde_json::to_string(&patient.allergies)
        .unwrap_or_else(|_| "[]".to_string());

    sqlx::query(
        r#"
        INSERT INTO patients (
            id,
            amo_id,
            name,
            cin,
            phone,
            birth_date,
            insurance_scheme,
            chronic_conditions,
            allergies,
            created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&patient_id)
    .bind(&patient.amo_id)
    .bind(&patient.name)
    .bind(&patient.cin)
    .bind(&patient.phone)
    .bind(&patient.birth_date)
    .bind(&patient.insurance_scheme)
    .bind(chronic_conditions_json)
    .bind(allergies_json)
    .bind(&created_at)
    .execute(pool)
    .await?;

    Ok(PatientRecord {
        id: patient_id,
        amo_id: patient.amo_id,
        name: patient.name,
        cin: patient.cin,
        phone: patient.phone,
        birth_date: patient.birth_date,
        insurance_scheme: patient.insurance_scheme,
        chronic_conditions: patient.chronic_conditions,
        allergies: patient.allergies,
        created_at,
    })
}

/// Insert a new appointment into the database.
pub async fn insert_appointment(
    pool: &DbPool,
    appointment: NewAppointmentInput,
) -> Result<AppointmentRecord, sqlx::Error> {
    let appointment_id = Uuid::new_v4().to_string();

    sqlx::query(
        r#"
        INSERT INTO appointments (
            id,
            patient_id,
            date_time,
            status,
            checked_in_at,
            notes
        ) VALUES (?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&appointment_id)
    .bind(&appointment.patient_id)
    .bind(&appointment.date_time)
    .bind(&appointment.status)
    .bind(&appointment.checked_in_at)
    .bind(&appointment.notes)
    .execute(pool)
    .await?;

    Ok(AppointmentRecord {
        id: appointment_id,
        patient_id: appointment.patient_id,
        date_time: appointment.date_time,
        status: appointment.status,
        checked_in_at: appointment.checked_in_at,
        notes: appointment.notes,
    })
}

/// Insert a patient and the initial waiting appointment in a single transaction.
pub async fn insert_patient_and_queue(
    pool: &DbPool,
    patient: NewPatientInput,
    appointment_notes: Option<String>,
) -> Result<PatientQueueResponse, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let patient_id = Uuid::new_v4().to_string();
    let appointment_id = Uuid::new_v4().to_string();
    let created_at = chrono::Utc::now().to_rfc3339();
    let notes = appointment_notes.unwrap_or_else(|| "New patient intake pending clinical review.".to_string());
    let chronic_conditions_json = serde_json::to_string(&patient.chronic_conditions)
        .unwrap_or_else(|_| "[]".to_string());
    let allergies_json = serde_json::to_string(&patient.allergies)
        .unwrap_or_else(|_| "[]".to_string());

    sqlx::query(
        r#"
        INSERT INTO patients (
            id,
            amo_id,
            name,
            cin,
            phone,
            birth_date,
            insurance_scheme,
            chronic_conditions,
            allergies,
            created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&patient_id)
    .bind(&patient.amo_id)
    .bind(&patient.name)
    .bind(&patient.cin)
    .bind(&patient.phone)
    .bind(&patient.birth_date)
    .bind(&patient.insurance_scheme)
    .bind(chronic_conditions_json)
    .bind(allergies_json)
    .bind(&created_at)
    .execute(&mut *transaction)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO appointments (
            id,
            patient_id,
            date_time,
            status,
            checked_in_at,
            notes
        ) VALUES (?, ?, ?, 'waiting', ?, ?)
        "#,
    )
    .bind(&appointment_id)
    .bind(&patient_id)
    .bind(&created_at)
    .bind(&created_at)
    .bind(&notes)
    .execute(&mut *transaction)
    .await?;

    transaction.commit().await?;

    Ok(PatientQueueResponse {
        patient: PatientRecord {
            id: patient_id.clone(),
            amo_id: patient.amo_id,
            name: patient.name,
            cin: patient.cin,
            phone: patient.phone,
            birth_date: patient.birth_date,
            insurance_scheme: patient.insurance_scheme,
            chronic_conditions: patient.chronic_conditions,
            allergies: patient.allergies,
            created_at: created_at.clone(),
        },
        appointment: AppointmentRecord {
            id: appointment_id,
            patient_id,
            date_time: created_at.clone(),
            status: "waiting".to_string(),
            checked_in_at: Some(created_at),
            notes,
        },
    })
}

/// Update the first active appointment for a patient to the given status.
///
/// The workflow is modeled against the appointments table, not patients,
/// because the architecture keeps queue state in the appointment lifecycle.
pub async fn update_patient_status_in_appointments(
    pool: &DbPool,
    patient_id: &str,
    status: &str,
) -> Result<u64, sqlx::Error> {
    let result = sqlx::query(
        r#"
        UPDATE appointments
        SET
            status = ?,
            checked_in_at = CASE
                WHEN ? = 'waiting' AND checked_in_at IS NULL THEN CURRENT_TIMESTAMP
                ELSE checked_in_at
            END
        WHERE id = (
            SELECT id
            FROM appointments
            WHERE patient_id = ?
              AND status IN ('scheduled', 'waiting', 'in_exam', 'billing')
            ORDER BY datetime(date_time) DESC, datetime(checked_in_at) DESC
            LIMIT 1
        )
        "#,
    )
    .bind(status)
    .bind(status)
    .bind(patient_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

/// Persist a consultation as a new row in the consultations table.
pub async fn insert_consultation(
    pool: &DbPool,
    consultation: ConsultationInput,
) -> Result<String, sqlx::Error> {
    let consultation_id = Uuid::new_v4().to_string();
    let prescribed_meds_json = serde_json::to_string(&consultation.prescribed_meds)
        .unwrap_or_else(|_| "[]".to_string());

    sqlx::query(
        r#"
        INSERT INTO consultations (
            id,
            patient_id,
            appointment_id,
            date,
            soap_subjective,
            soap_objective,
            soap_assessment,
            soap_plan,
            prescribed_meds,
            fse_qr_token
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&consultation_id)
    .bind(&consultation.patient_id)
    .bind(&consultation.appointment_id)
    .bind(&consultation.date)
    .bind(&consultation.soap_subjective)
    .bind(&consultation.soap_objective)
    .bind(&consultation.soap_assessment)
    .bind(&consultation.soap_plan)
    .bind(prescribed_meds_json)
    .bind(&consultation.fse_qr_token)
    .execute(pool)
    .await?;

    Ok(consultation_id)
}

/// Create all core database tables with proper schema and constraints
async fn create_tables(pool: &DbPool) -> Result<(), Box<dyn std::error::Error>> {
    // Create users table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY NOT NULL,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            name TEXT NOT NULL
        )
        "#
    )
    .execute(pool)
    .await?;

    log::debug!("Created/verified users table");

    // Create patients table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS patients (
            id TEXT PRIMARY KEY NOT NULL,
            amo_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            birth_date TEXT NOT NULL,
            insurance_scheme TEXT CHECK(insurance_scheme IN ('AMO-Achamil', 'AMO-Tadamon', 'CNSS-Private')) NOT NULL,
            chronic_conditions TEXT NOT NULL,
            allergies TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        "#
    )
    .execute(pool)
    .await?;

    log::debug!("Created/verified patients table");

    // Create appointments table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS appointments (
            id TEXT PRIMARY KEY NOT NULL,
            patient_id TEXT NOT NULL,
            date_time TEXT NOT NULL,
            status TEXT CHECK(status IN ('scheduled', 'waiting', 'in_exam', 'billing', 'completed')) NOT NULL DEFAULT 'scheduled',
            checked_in_at TEXT,
            notes TEXT,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
        )
        "#
    )
    .execute(pool)
    .await?;

    log::debug!("Created/verified appointments table");

    // Create consultations table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS consultations (
            id TEXT PRIMARY KEY NOT NULL,
            patient_id TEXT NOT NULL,
            appointment_id TEXT UNIQUE NOT NULL,
            date TEXT NOT NULL,
            soap_subjective TEXT NOT NULL,
            soap_objective TEXT NOT NULL,
            soap_assessment TEXT NOT NULL,
            soap_plan TEXT NOT NULL,
            prescribed_meds TEXT NOT NULL,
            fse_qr_token TEXT NOT NULL,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
            FOREIGN KEY (appointment_id) REFERENCES appointments(id)
        )
        "#
    )
    .execute(pool)
    .await?;

    log::debug!("Created/verified consultations table");

    // Create attachments table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS attachments (
            id TEXT PRIMARY KEY NOT NULL,
            patient_id TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_type TEXT NOT NULL,
            uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
        )
        "#
    )
    .execute(pool)
    .await?;

    log::debug!("Created/verified attachments table");

    Ok(())
}

async fn seed_default_users(pool: &DbPool) -> Result<(), Box<dyn std::error::Error>> {
    let user_count: i64 = sqlx::query_scalar("SELECT COUNT(1) FROM users")
        .fetch_one(pool)
        .await?;

    if user_count == 0 {
        let admin_id = Uuid::new_v4().to_string();

        sqlx::query(
            r#"
            INSERT INTO users (
                id,
                username,
                password,
                role,
                name
            ) VALUES (?, ?, ?, ?, ?)
            "#,
        )
        .bind(&admin_id)
        .bind("admin")
        .bind("admin123")
        .bind("OWNER")
        .bind("Dr. Tazi")
        .execute(pool)
        .await?;

        log::info!("Seeded default admin user");
    }

    Ok(())
}

async fn ensure_patient_cin_column(pool: &DbPool) -> Result<(), Box<dyn std::error::Error>> {
    let columns = sqlx::query("SELECT name FROM pragma_table_info('patients')")
        .fetch_all(pool)
        .await?;

    let has_cin = columns.iter().any(|row| row.get::<String, _>(0) == "cin");

    if !has_cin {
        sqlx::query("ALTER TABLE patients ADD COLUMN cin TEXT")
            .execute(pool)
            .await?;
        log::info!("Added missing cin column to patients table");
    }

    Ok(())
}

/// Get the application's local data directory
/// Creates the directory if it doesn't exist
fn get_app_data_dir() -> Result<PathBuf, Box<dyn std::error::Error>> {
    #[cfg(target_os = "windows")]
    {
        let app_data = std::env::var("APPDATA")?;
        let dir = PathBuf::from(app_data).join("MedTeams");
        std::fs::create_dir_all(&dir)?;
        Ok(dir)
    }

    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME")?;
        let dir = PathBuf::from(home).join("Library/Application Support/MedTeams");
        std::fs::create_dir_all(&dir)?;
        Ok(dir)
    }

    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME")?;
        let dir = PathBuf::from(home).join(".local/share/medteams");
        std::fs::create_dir_all(&dir)?;
        Ok(dir)
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("Unsupported operating system".into())
    }
}

/// Expose the pool in a state object for Tauri commands
/// This will be used by command handlers to access the database
pub struct AppState {
    pub db: DbPool,
}
