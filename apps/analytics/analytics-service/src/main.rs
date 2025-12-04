use actix_web::{web, App, HttpServer, HttpResponse};
use serde::{Deserialize, Serialize};
use tokio_postgres::{Client, NoTls};
use std::collections::HashMap;
use tokio::sync::Mutex;
use sqlx::types::Json;

#[derive(Serialize, Deserialize, Debug)]
pub struct Event {
    event_type: String,
    timestamp: String,
    user_id: Option<String>,
    metadata: serde_json::Value,
}

struct AppState {
    client: Mutex<Client>,
}

async fn handle_event(
    app_state: web::Data<AppState>,
    event: web::Json<Event>,
) -> HttpResponse {
    let mut client = app_state.client.lock().await;
    let query = "
        INSERT INTO events (event_type, timestamp, user_id, metadata)
        VALUES ($1, $2, $3, $4)
    ";
    client
        .query(query, &[
            &event.event_type,
            &event.timestamp,
            &event.user_id,
            Json(event.metadata),
        ])
        .await
        .expect("Failed to insert event");
    
    HttpResponse::Ok().json("Event recorded")
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let (client, connection) = tokio_postgres::connect(
        "host=localhost user=postgres dbname=analytics password=password",
        NoTls,
    )
    .await
    .expect("Failed to connect to PostgreSQL");
    
    tokio::spawn(async move {
        connection.await.expect("Connection failed");
    });
    
    let app_state = web::Data::new(AppState {
        client: Mutex::new(client),
    });

    let server = HttpServer::new(move || {
        App::new()
            .app_data(app_state.clone())
            .route("/event", web::post().to(handle_event))
    });

    println!("Analytics service starting on http://127.0.0.1:8080");
    server.bind("127.0.0.1:8080")?
        .run()
        .await
}
