use anyhow::Result;
use shared::rag::RAGSystem;
use shared::{DocumentQuery, DocumentResult};
use std::path::Path;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Clone)]
pub struct RAGService {
  rag_system: Arc<RwLock<RAGSystem>>,
}

impl RAGService {
  pub fn new(data_dir: impl AsRef<Path>) -> Result<Self> {
      let rag_system = RAGSystem::new(data_dir)?;
      
      Ok(Self {
          rag_system: Arc::new(RwLock::new(rag_system)),
      })
  }
  
  pub async fn search_documents(&self, query: DocumentQuery) -> Result<Vec<DocumentResult>> {
      let rag_system = self.rag_system.read().await;
      
      let search_results = rag_system.search(&query.query, query.limit);
      
      let results = search_results
          .into_iter()
          .map(|result| DocumentResult {
              id: result.document.id,
              title: result.document.title,
              content: result.document.content,
              source: result.document.source,
              score: result.score,
          })
          .collect();
      
      Ok(results)
  }
  
  pub async fn get_document(&self, id: &str) -> Result<Option<DocumentResult>> {
      let rag_system = self.rag_system.read().await;
      
      if let Some(doc) = rag_system.get_document_by_id(id) {
          Ok(Some(DocumentResult {
              id: doc.id.clone(),
              title: doc.title.clone(),
              content: doc.content.clone(),
              source: doc.source.clone(),
              score: 1.0, // Default score for direct retrieval
          }))
      } else {
          Ok(None)
      }
  }
  
  pub async fn add_document(&self, title: &str, content: &str, source: &str) -> Result<()> {
      let mut rag_system = self.rag_system.write().await;
      rag_system.add_document(title, content, source)?;
      Ok(())
  }
}