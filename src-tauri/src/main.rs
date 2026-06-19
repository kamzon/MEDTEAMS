// Tauri app entry point
// Initializes the database and launches the desktop application window

#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod database;

use database::{
    authenticate_user,
    fetch_appointments,
    fetch_attachments,
    fetch_consultations,
    fetch_patients,
    fetch_users,
    delete_user,
    init_database,
    insert_appointment,
    insert_patient,
    insert_patient_and_queue,
    insert_user,
    insert_consultation,
    update_patient_status_in_appointments,
    update_user_role,
    AppointmentRecord,
    AppState,
    AttachmentRecord,
    ConsultationInput,
    ConsultationRecord,
    NewAppointmentInput,
    NewPatientInput,
    NewUserInput,
    PatientRecord,
    PatientQueueResponse,
    UserRecord,
};
use tauri::State;

#[tauri::command]
async fn get_patients(state: State<'_, AppState>) -> Result<Vec<PatientRecord>, String> {
    fetch_patients(&state.db)
        .await
        .map_err(|error| format!("Failed to fetch patients: {}", error))
}

#[tauri::command]
async fn get_appointments(state: State<'_, AppState>) -> Result<Vec<AppointmentRecord>, String> {
    fetch_appointments(&state.db)
        .await
        .map_err(|error| format!("Failed to fetch appointments: {}", error))
}

#[tauri::command]
async fn get_consultations(state: State<'_, AppState>) -> Result<Vec<ConsultationRecord>, String> {
    fetch_consultations(&state.db)
        .await
        .map_err(|error| format!("Failed to fetch consultations: {}", error))
}

#[tauri::command]
async fn get_attachments(state: State<'_, AppState>) -> Result<Vec<AttachmentRecord>, String> {
    fetch_attachments(&state.db)
        .await
        .map_err(|error| format!("Failed to fetch attachments: {}", error))
}

#[tauri::command]
async fn login(
    state: State<'_, AppState>,
    username: String,
    password: String,
) -> Result<UserRecord, String> {
    authenticate_user(&state.db, &username, &password)
        .await
        .map_err(|error| match error {
            sqlx::Error::RowNotFound => "Invalid username or password".to_string(),
            other => format!("Failed to authenticate user: {}", other),
        })
}

#[tauri::command]
async fn get_users(state: State<'_, AppState>) -> Result<Vec<UserRecord>, String> {
    fetch_users(&state.db)
        .await
        .map_err(|error| format!("Failed to fetch users: {}", error))
}

#[tauri::command]
async fn add_patient(
    state: State<'_, AppState>,
    patient: NewPatientInput,
) -> Result<PatientRecord, String> {
    insert_patient(&state.db, patient)
        .await
        .map_err(|error| format!("Failed to add patient: {}", error))
}

#[tauri::command]
async fn add_appointment(
    state: State<'_, AppState>,
    appointment: NewAppointmentInput,
) -> Result<AppointmentRecord, String> {
    insert_appointment(&state.db, appointment)
        .await
        .map_err(|error| format!("Failed to add appointment: {}", error))
}

#[tauri::command]
async fn add_patient_and_queue(
    state: State<'_, AppState>,
    patient: NewPatientInput,
    appointment_notes: Option<String>,
) -> Result<PatientQueueResponse, String> {
    insert_patient_and_queue(&state.db, patient, appointment_notes)
        .await
        .map_err(|error| format!("Failed to add patient and queue: {}", error))
}

#[tauri::command]
async fn add_user(
    state: State<'_, AppState>,
    username: String,
    password: String,
    role: String,
    name: String,
) -> Result<UserRecord, String> {
    let user = NewUserInput {
        username,
        password,
        role,
        name,
    };

    insert_user(&state.db, user)
        .await
        .map_err(|error| format!("Failed to add user: {}", error))
}

#[tauri::command]
async fn update_user_role_command(
    state: State<'_, AppState>,
    user_id: String,
    role: String,
) -> Result<UserRecord, String> {
    update_user_role(&state.db, &user_id, &role)
        .await
        .map_err(|error| match error {
            sqlx::Error::RowNotFound => "Staff member not found".to_string(),
            other => format!("Failed to update user role: {}", other),
        })
}

#[tauri::command]
async fn delete_user_command(state: State<'_, AppState>, user_id: String) -> Result<(), String> {
    delete_user(&state.db, &user_id)
        .await
        .map_err(|error| match error {
            sqlx::Error::RowNotFound => "Staff member not found".to_string(),
            other => format!("Failed to delete user: {}", other),
        })
}

#[tauri::command]
async fn update_patient_status(
    state: State<'_, AppState>,
    patient_id: String,
    status: String,
) -> Result<u64, String> {
    update_patient_status_in_appointments(&state.db, &patient_id, &status)
        .await
        .map_err(|error| format!("Failed to update patient status: {}", error))
}

#[tauri::command]
async fn save_consultation(
    state: State<'_, AppState>,
    consultation: ConsultationInput,
) -> Result<String, String> {
    insert_consultation(&state.db, consultation)
        .await
        .map_err(|error| format!("Failed to save consultation: {}", error))
}

#[tokio::main]
async fn main() {
    // Initialize logging
    env_logger::Builder::from_default_env()
        .format_timestamp_secs()
        .init();

    log::info!("Starting MedTeams Desktop Application");

    // Initialize the SQLite database
    let db_pool = match init_database().await {
        Ok(pool) => {
            log::info!("Database initialized successfully");
            pool
        }
        Err(e) => {
            log::error!("Failed to initialize database: {}", e);
            panic!("Database initialization failed: {}", e);
        }
    };

    // Create the application state
    let app_state = AppState { db: db_pool };

    // Build and run the Tauri app
    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_patients,
            get_appointments,
            get_consultations,
            get_attachments,
            login,
            get_users,
            add_patient,
            add_appointment,
            add_patient_and_queue,
            add_user,
            update_user_role_command,
            delete_user_command,
            update_patient_status,
            save_consultation
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
