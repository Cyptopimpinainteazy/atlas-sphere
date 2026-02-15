use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: String,
    pub title: String,
    pub content: String,
    pub source: String,
    pub embedding: Option<Vec<f32>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub document: Document,
    pub score: f32,
}

pub struct RAGSystem {
    documents: Vec<Document>,
    index: HashMap<String, Vec<usize>>,
    data_dir: PathBuf,
}

impl RAGSystem {
    pub fn new(data_dir: impl AsRef<Path>) -> Result<Self> {
        let data_dir = data_dir.as_ref().to_path_buf();

        // Create directories if they don't exist
        fs::create_dir_all(&data_dir.join("docs"))?;
        fs::create_dir_all(&data_dir.join("embeddings"))?;

        let mut rag = Self {
            documents: Vec::new(),
            index: HashMap::new(),
            data_dir,
        };

        // Load documents
        rag.load_documents()?;

        // Build index
        rag.build_index()?;

        Ok(rag)
    }

    fn load_documents(&mut self) -> Result<()> {
        // Load Uniswap V2 docs
        self.load_document_directory(&self.data_dir.join("docs/uniswap-v2"), "uniswap-v2")?;

        // Load Uniswap V3 docs
        self.load_document_directory(&self.data_dir.join("docs/uniswap-v3"), "uniswap-v3")?;

        // Load contract source code
        self.load_document_directory(&self.data_dir.join("docs/contracts"), "contracts")?;

        Ok(())
    }

    fn load_document_directory(&mut self, dir: &Path, source: &str) -> Result<()> {
        if !dir.exists() {
            return Ok(());
        }

        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_file() {
                let file_name = path.file_name().unwrap().to_string_lossy().to_string();
                let id = format!("{}/{}", source, file_name);

                let content = fs::read_to_string(&path)?;

                // Create document
                let document = Document {
                    id: id.clone(),
                    title: file_name,
                    content,
                    source: source.to_string(),
                    embedding: None,
                };

                self.documents.push(document);
            }
        }

        Ok(())
    }

    fn build_index(&mut self) -> Result<()> {
        // Simple keyword-based index for demonstration
        // In a real implementation, you'd use a vector database or similar

        for (doc_idx, doc) in self.documents.iter().enumerate() {
            let words = Self::tokenize(&doc.content);

            for word in words {
                self.index
                    .entry(word)
                    .or_insert_with(Vec::new)
                    .push(doc_idx);
            }
        }

        Ok(())
    }

    fn tokenize(text: &str) -> Vec<String> {
        text.to_lowercase()
            .split(|c: char| !c.is_alphanumeric())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .collect()
    }

    pub fn search(&self, query: &str, limit: usize) -> Vec<SearchResult> {
        let query_tokens = Self::tokenize(query);
        let mut scores: HashMap<usize, f32> = HashMap::new();

        // Calculate TF-IDF like scores
        for token in query_tokens {
            if let Some(doc_indices) = self.index.get(&token) {
                let idf = (self.documents.len() as f32 / doc_indices.len() as f32).ln();

                for &doc_idx in doc_indices {
                    let entry = scores.entry(doc_idx).or_insert(0.0);
                    *entry += idf;
                }
            }
        }

        // Convert to vector and sort
        let mut results: Vec<SearchResult> = scores
            .into_iter()
            .map(|(doc_idx, score)| SearchResult {
                document: self.documents[doc_idx].clone(),
                score,
            })
            .collect();

        results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());

        // Limit results
        results.truncate(limit);

        results
    }

    pub fn add_document(&mut self, title: &str, content: &str, source: &str) -> Result<()> {
        let id = format!("{}/{}", source, title);

        let document = Document {
            id: id.clone(),
            title: title.to_string(),
            content: content.to_string(),
            source: source.to_string(),
            embedding: None,
        };

        // Add to documents
        self.documents.push(document);

        // Update index
        let doc_idx = self.documents.len() - 1;
        let words = Self::tokenize(content);

        for word in words {
            self.index
                .entry(word)
                .or_insert_with(Vec::new)
                .push(doc_idx);
        }

        Ok(())
    }

    pub fn get_document_by_id(&self, id: &str) -> Option<&Document> {
        self.documents.iter().find(|doc| doc.id == id)
    }
}
