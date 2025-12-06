//! LSP Backend implementation.

use crate::completion::CompletionProvider;
use crate::diagnostics::DiagnosticsProvider;
use crate::document::DocumentStore;
use crate::hover::HoverProvider;
use crate::semantic::SemanticTokensProvider;
use lsp_types::*;
use std::sync::Arc;
use tower_lsp::jsonrpc::Result;
use tower_lsp::{Client, LanguageServer};
use tracing::{debug, info};

/// LSP Backend for Atlas Sphere.
pub struct Backend {
    client: Client,
    documents: Arc<DocumentStore>,
    completion: CompletionProvider,
    diagnostics: DiagnosticsProvider,
    hover: HoverProvider,
    semantic: SemanticTokensProvider,
}

impl Backend {
    pub fn new(client: Client) -> Self {
        let documents = Arc::new(DocumentStore::new());
        Self {
            client,
            documents: documents.clone(),
            completion: CompletionProvider::new(documents.clone()),
            diagnostics: DiagnosticsProvider::new(documents.clone()),
            hover: HoverProvider::new(documents.clone()),
            semantic: SemanticTokensProvider::new(documents),
        }
    }
}

#[tower_lsp::async_trait]
impl LanguageServer for Backend {
    async fn initialize(&self, _params: InitializeParams) -> Result<InitializeResult> {
        info!("Atlas LSP initialized");

        Ok(InitializeResult {
            capabilities: ServerCapabilities {
                // Text document sync
                text_document_sync: Some(TextDocumentSyncCapability::Options(
                    TextDocumentSyncOptions {
                        open_close: Some(true),
                        change: Some(TextDocumentSyncKind::INCREMENTAL),
                        save: Some(TextDocumentSyncSaveOptions::SaveOptions(SaveOptions {
                            include_text: Some(true),
                        })),
                        ..Default::default()
                    },
                )),

                // Completion
                completion_provider: Some(CompletionOptions {
                    trigger_characters: Some(vec![
                        ".".to_string(),
                        ":".to_string(),
                        "<".to_string(),
                        "\"".to_string(),
                    ]),
                    resolve_provider: Some(true),
                    ..Default::default()
                }),

                // Hover
                hover_provider: Some(HoverProviderCapability::Simple(true)),

                // Signature help
                signature_help_provider: Some(SignatureHelpOptions {
                    trigger_characters: Some(vec!["(".to_string(), ",".to_string()]),
                    retrigger_characters: None,
                    work_done_progress_options: Default::default(),
                }),

                // Go to definition
                definition_provider: Some(OneOf::Left(true)),

                // References
                references_provider: Some(OneOf::Left(true)),

                // Document symbols
                document_symbol_provider: Some(OneOf::Left(true)),

                // Workspace symbols
                workspace_symbol_provider: Some(OneOf::Left(true)),

                // Code actions
                code_action_provider: Some(CodeActionProviderCapability::Simple(true)),

                // Formatting
                document_formatting_provider: Some(OneOf::Left(true)),

                // Semantic tokens
                semantic_tokens_provider: Some(
                    SemanticTokensServerCapabilities::SemanticTokensOptions(
                        SemanticTokensOptions {
                            legend: SemanticTokensLegend {
                                token_types: vec![
                                    SemanticTokenType::NAMESPACE,
                                    SemanticTokenType::TYPE,
                                    SemanticTokenType::CLASS,
                                    SemanticTokenType::ENUM,
                                    SemanticTokenType::INTERFACE,
                                    SemanticTokenType::STRUCT,
                                    SemanticTokenType::TYPE_PARAMETER,
                                    SemanticTokenType::PARAMETER,
                                    SemanticTokenType::VARIABLE,
                                    SemanticTokenType::PROPERTY,
                                    SemanticTokenType::ENUM_MEMBER,
                                    SemanticTokenType::FUNCTION,
                                    SemanticTokenType::METHOD,
                                    SemanticTokenType::MACRO,
                                    SemanticTokenType::KEYWORD,
                                    SemanticTokenType::MODIFIER,
                                    SemanticTokenType::COMMENT,
                                    SemanticTokenType::STRING,
                                    SemanticTokenType::NUMBER,
                                    SemanticTokenType::OPERATOR,
                                ],
                                token_modifiers: vec![
                                    SemanticTokenModifier::DECLARATION,
                                    SemanticTokenModifier::DEFINITION,
                                    SemanticTokenModifier::READONLY,
                                    SemanticTokenModifier::STATIC,
                                    SemanticTokenModifier::DEPRECATED,
                                    SemanticTokenModifier::ASYNC,
                                ],
                            },
                            full: Some(SemanticTokensFullOptions::Bool(true)),
                            range: Some(true),
                            ..Default::default()
                        },
                    ),
                ),

                ..Default::default()
            },
            server_info: Some(ServerInfo {
                name: "atlas-lsp".to_string(),
                version: Some(env!("CARGO_PKG_VERSION").to_string()),
            }),
        })
    }

    async fn initialized(&self, _params: InitializedParams) {
        info!("Atlas LSP server initialized");
        self.client
            .log_message(MessageType::INFO, "Atlas LSP ready")
            .await;
    }

    async fn shutdown(&self) -> Result<()> {
        info!("Atlas LSP shutting down");
        Ok(())
    }

    // ========================================================================
    // Document Synchronization
    // ========================================================================

    async fn did_open(&self, params: DidOpenTextDocumentParams) {
        let uri = params.text_document.uri.clone();
        debug!("Document opened: {}", uri);

        self.documents.open(
            uri.clone(),
            params.text_document.text,
            params.text_document.language_id,
        );

        // Run diagnostics
        let diagnostics = self.diagnostics.diagnose(&uri).await;
        self.client
            .publish_diagnostics(uri, diagnostics, None)
            .await;
    }

    async fn did_change(&self, params: DidChangeTextDocumentParams) {
        let uri = params.text_document.uri.clone();
        debug!("Document changed: {}", uri);

        for change in params.content_changes {
            if let Some(range) = change.range {
                self.documents.apply_change(&uri, range, &change.text);
            } else {
                // Full document sync
                self.documents.set_content(&uri, &change.text);
            }
        }

        // Run diagnostics
        let diagnostics = self.diagnostics.diagnose(&uri).await;
        self.client
            .publish_diagnostics(uri, diagnostics, None)
            .await;
    }

    async fn did_save(&self, params: DidSaveTextDocumentParams) {
        let uri = params.text_document.uri.clone();
        debug!("Document saved: {}", uri);

        if let Some(text) = params.text {
            self.documents.set_content(&uri, &text);
        }

        // Run full diagnostics on save
        let diagnostics = self.diagnostics.diagnose(&uri).await;
        self.client
            .publish_diagnostics(uri, diagnostics, None)
            .await;
    }

    async fn did_close(&self, params: DidCloseTextDocumentParams) {
        let uri = params.text_document.uri;
        debug!("Document closed: {}", uri);
        self.documents.close(&uri);
        
        // Clear diagnostics
        self.client.publish_diagnostics(uri, vec![], None).await;
    }

    // ========================================================================
    // Language Features
    // ========================================================================

    async fn completion(&self, params: CompletionParams) -> Result<Option<CompletionResponse>> {
        let uri = &params.text_document_position.text_document.uri;
        let position = params.text_document_position.position;
        
        debug!("Completion requested at {:?}", position);

        let items = self.completion.complete(uri, position).await;
        Ok(Some(CompletionResponse::Array(items)))
    }

    async fn completion_resolve(&self, item: CompletionItem) -> Result<CompletionItem> {
        Ok(self.completion.resolve(item).await)
    }

    async fn hover(&self, params: HoverParams) -> Result<Option<Hover>> {
        let uri = &params.text_document_position_params.text_document.uri;
        let position = params.text_document_position_params.position;

        debug!("Hover requested at {:?}", position);

        Ok(self.hover.hover(uri, position).await)
    }

    async fn goto_definition(
        &self,
        params: GotoDefinitionParams,
    ) -> Result<Option<GotoDefinitionResponse>> {
        let uri = &params.text_document_position_params.text_document.uri;
        let position = params.text_document_position_params.position;

        debug!("Go to definition at {:?}", position);

        // TODO: Implement definition lookup
        Ok(None)
    }

    async fn references(&self, params: ReferenceParams) -> Result<Option<Vec<Location>>> {
        let uri = &params.text_document_position.text_document.uri;
        let position = params.text_document_position.position;

        debug!("Find references at {:?}", position);

        // TODO: Implement reference finding
        Ok(None)
    }

    async fn document_symbol(
        &self,
        params: DocumentSymbolParams,
    ) -> Result<Option<DocumentSymbolResponse>> {
        let uri = &params.text_document.uri;

        debug!("Document symbols for {}", uri);

        // TODO: Implement document symbols
        Ok(None)
    }

    async fn code_action(&self, params: CodeActionParams) -> Result<Option<CodeActionResponse>> {
        let uri = &params.text_document.uri;
        let range = params.range;

        debug!("Code action at {:?}", range);

        // TODO: Implement code actions
        Ok(Some(vec![]))
    }

    async fn formatting(&self, params: DocumentFormattingParams) -> Result<Option<Vec<TextEdit>>> {
        let uri = &params.text_document.uri;

        debug!("Format document {}", uri);

        // TODO: Implement formatting
        Ok(None)
    }

    async fn semantic_tokens_full(
        &self,
        params: SemanticTokensParams,
    ) -> Result<Option<SemanticTokensResult>> {
        let uri = &params.text_document.uri;

        debug!("Semantic tokens for {}", uri);

        match self.semantic.full(uri).await {
            Some(tokens) => Ok(Some(SemanticTokensResult::Tokens(tokens))),
            None => Ok(None),
        }
    }

    async fn semantic_tokens_range(
        &self,
        params: SemanticTokensRangeParams,
    ) -> Result<Option<SemanticTokensRangeResult>> {
        let uri = &params.text_document.uri;
        let range = params.range;

        debug!("Semantic tokens range {:?}", range);

        match self.semantic.range(uri, range).await {
            Some(tokens) => Ok(Some(SemanticTokensRangeResult::Tokens(tokens))),
            None => Ok(None),
        }
    }
}
