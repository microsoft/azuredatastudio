/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the Source EULA. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import { RequestType, NotificationType, ResponseError } from 'dataprotocol-jsonrpc';

import {
	TextDocument, TextDocumentChangeEvent, TextDocumentContentChangeEvent,
	Range, Position, Location, Diagnostic, DiagnosticSeverity, Command,
	TextEdit, WorkspaceEdit, WorkspaceChange, TextEditChange,
	TextDocumentIdentifier, VersionedTextDocumentIdentifier, TextDocumentItem,
	CompletionItemKind, CompletionItem, CompletionList,
	Hover, MarkedString,
	SignatureHelp, SignatureInformation, ParameterInformation,
	Definition, ReferenceContext,
	DocumentHighlight, DocumentHighlightKind,
	SymbolInformation, SymbolKind,
	CodeLens, CodeActionContext,
	FormattingOptions, DocumentLink,
	ConnectionDetails, ServerInfo,
	ConnectionSummary, ConnectionCompleteParams, IntelliSenseReadyParams,
	ColumnMetadata, IDbColumn,
	ConnectionProviderOptions, DataProtocolServerCapabilities,
	CapabiltiesDiscoveryResult, MetadataQueryParams, MetadataQueryResult,
	ScriptingParams, ScriptingResult, ScriptingCompleteParams,
	BatchSummary, QueryExecuteBatchNotificationParams, ResultSetSummary, IResultMessage, ISelectionData,
	DbCellValue, EditCell, EditRow, CreateSessionResponse, SessionCreatedParameters, ExpandParams, ExpandResponse, CloseSessionParams, CloseSessionResponse,
	BackupInfo, BackupParams, BackupResponse,
	RestoreParams, RestoreResponse, RestorePlanResponse, RestoreConfigInfoRequestParams, RestoreConfigInfoResponse,
	LoginInfo, CreateLoginParams, CreateLoginResponse, GetDatabaseInfoParams, GetDatabaseInfoResponse,
	DatabaseInfo, BackupConfigInfo, CreateDatabaseParams, CreateDatabaseResponse,
	TaskInfo, ListTasksParams, ListTasksResponse, CancelTaskParams, TaskProgressInfo,
	DefaultDatabaseInfoParams, DefaultDatabaseInfoResponse, BackupConfigInfoResponse, FileBrowserOpenParams, FileBrowserOpenedParams,
	FileBrowserCloseParams, FileBrowserExpandParams, FileBrowserValidateParams,
	FileBrowserCloseResponse, FileBrowserExpandedParams, FileBrowserValidatedParams,
	StartProfilingParams, StartProfilingResponse, StopProfilingParams, StopProfilingResponse,
	ProfilerEventsAvailableParams
} from 'dataprotocol-languageserver-types';


/**
 * A parameter literal used in requests to pass a text document and a position inside that
 * document.
 */
export interface TextDocumentPositionParams {
	/**
	 * The text document.
	 */
	textDocument: TextDocumentIdentifier;

	/**
	 * The position inside the text document.
	 */
	position: Position;
}


//---- Initialize Method ----

/**
 * Defines the capabilities provided by the client.
 */
export interface ClientCapabilities {
}

/**
 * Defines how the host (editor) should sync
 * document changes to the language server.
 */
export enum TextDocumentSyncKind {
	/**
	 * Documents should not be synced at all.
	 */
	None = 0,

	/**
	 * Documents are synced by always sending the full content
	 * of the document.
	 */
	Full = 1,

	/**
	 * Documents are synced by sending the full content on open.
	 * After that only incremental updates to the document are
	 * send.
	 */
	Incremental = 2
}

/**
 * Completion options.
 */
export interface CompletionOptions {
	/**
	 * The server provides support to resolve additional
	 * information for a completion item.
	 */
	resolveProvider?: boolean;

	/**
	 * The characters that trigger completion automatically.
	 */
	triggerCharacters?: string[];
}

/**
 * Signature help options.
 */
export interface SignatureHelpOptions {
	/**
	 * The characters that trigger signature help
	 * automatically.
	 */
	triggerCharacters?: string[];
}

/**
 * Code Lens options.
 */
export interface CodeLensOptions {
	/**
	 * Code lens has a resolve provider as well.
	 */
	resolveProvider?: boolean;
}

/**
 * Format document on type options
 */
export interface DocumentOnTypeFormattingOptions {
	/**
	 * A character on which formatting should be triggered, like `}`.
	 */
	firstTriggerCharacter: string;
	/**
	 * More trigger characters.
	 */
	moreTriggerCharacter?: string[]
}

/**
 * Document link options
 */
export interface DocumentLinkOptions {
	/**
	 * Document links have a resolve provider as well.
	 */
	resolveProvider?: boolean;
}

/**
 * Defines the capabilities provided by a language
 * server.
 */
export interface ServerCapabilities {
	/**
	 * Defines how text documents are synced.
	 */
	textDocumentSync?: number;
	/**
	 * The server provides hover support.
	 */
	hoverProvider?: boolean;
	/**
	 * The server provides completion support.
	 */
	completionProvider?: CompletionOptions;
	/**
	 * The server provides signature help support.
	 */
	signatureHelpProvider?: SignatureHelpOptions;
	/**
	 * The server provides goto definition support.
	 */
	definitionProvider?: boolean;
	/**
	 * The server provides find references support.
	 */
	referencesProvider?: boolean;
	/**
	 * The server provides document highlight support.
	 */
	documentHighlightProvider?: boolean;
	/**
	 * The server provides document symbol support.
	 */
	documentSymbolProvider?: boolean;
	/**
	 * The server provides workspace symbol support.
	 */
	workspaceSymbolProvider?: boolean;
	/**
	 * The server provides code actions.
	 */
	codeActionProvider?: boolean;
	/**
	 * The server provides code lens.
	 */
	codeLensProvider?: CodeLensOptions;
	/**
	 * The server provides document formatting.
	 */
	documentFormattingProvider?: boolean;
	/**
	 * The server provides document range formatting.
	 */
	documentRangeFormattingProvider?: boolean;
	/**
	 * The server provides document formatting on typing.
	 */
	documentOnTypeFormattingProvider?: DocumentOnTypeFormattingOptions;
	/**
	 * The server provides rename support.
	 */
	renameProvider?: boolean;
	/**
	 * The server provides document link support.
	 */
	documentLinkProvider?: DocumentLinkOptions;

	connectionProvider?: boolean;
}

/**
 * The initialize method is sent from the client to the server.
 * It is send once as the first method after starting up the
 * worker. The requests parameter is of type [InitializeParams](#InitializeParams)
 * the response if of type [InitializeResult](#InitializeResult) of a Thenable that
 * resolves to such.
 */
export namespace InitializeRequest {
	export const type: RequestType<InitializeParams, InitializeResult, InitializeError> = { get method() { return 'initialize'; } };
}

/**
 * The initialize parameters
 */
export interface InitializeParams {
	/**
	 * The process Id of the parent process that started
	 * the server.
	 */
	processId: number;

	/**
	 * The rootPath of the workspace. Is null
	 * if no folder is open.
	 */
	rootPath: string;

	/**
	 * The capabilities provided by the client (editor)
	 */
	capabilities: ClientCapabilities;

	/**
	 * User provided initialization options.
	 */
	initializationOptions?: any;

	/**
	 * The initial trace setting. If omitted trace is disabled ('off').
	 */
	trace?: 'off' | 'messages' | 'verbose';
}

/**
 * The result returned from an initilize request.
 */
export interface InitializeResult {
	/**
	 * The capabilities the language server provides.
	 */
	capabilities: ServerCapabilities;
}

/**
 * The data type of the ResponseError if the
 * initialize request fails.
 */
export interface InitializeError {
	/**
	 * Indicates whether the client should retry to send the
	 * initilize request after showing the message provided
	 * in the {@link ResponseError}
	 */
	retry: boolean;
}

//---- Shutdown Method ----

/**
 * A shutdown request is sent from the client to the server.
 * It is send once when the client descides to shutdown the
 * server. The only notification that is sent after a shudown request
 * is the exit event.
 */
export namespace ShutdownRequest {
	export const type: RequestType<void, void, void> = { get method() { return 'shutdown'; } };
}

//---- Exit Notification ----

/**
 * The exit event is sent from the client to the server to
 * ask the server to exit its process.
 */
export namespace ExitNotification {
	export const type: NotificationType<void> = { get method() { return 'exit'; } };
}

//---- Configuration notification ----

/**
 * The configuration change notification is sent from the client to the server
 * when the client's configuration has changed. The notification contains
 * the changed configuration as defined by the language client.
 */
export namespace DidChangeConfigurationNotification {
	export const type: NotificationType<DidChangeConfigurationParams> = { get method() { return 'workspace/didChangeConfiguration'; } };
}

/**
 * The parameters of a change configuration notification.
 */
export interface DidChangeConfigurationParams {
	/**
	 * The actual changed settings
	 */
	settings: any;
}

//---- Message show and log notifications ----

/**
 * The message type
 */
export enum MessageType {
	/**
	 * An error message.
	 */
	Error = 1,
	/**
	 * A warning message.
	 */
	Warning = 2,
	/**
	 * An information message.
	 */
	Info = 3,
	/**
	 * A log message.
	 */
	Log = 4
}

/**
 * The parameters of a notification message.
 */
export interface ShowMessageParams {
	/**
	 * The message type. See {@link MessageType}
	 */
	type: number;

	/**
	 * The actual message
	 */
	message: string;
}

/**
 * The show message notification is sent from a server to a client to ask
 * the client to display a particular message in the user interface.
 */
export namespace ShowMessageNotification {
	export const type: NotificationType<ShowMessageParams> = { get method() { return 'window/showMessage'; } };
}

export interface MessageActionItem {
	/**
	 * A short title like 'Retry', 'Open Log' etc.
	 */
	title: string;
}

export interface ShowMessageRequestParams {
	/**
	 * The message type. See {@link MessageType}
	 */
	type: number;

	/**
	 * The actual message
	 */
	message: string;

	/**
	 * The message action items to present.
	 */
	actions?: MessageActionItem[];
}

/**
 * The show message request is send from the server to the clinet to show a message
 * and a set of options actions to the user.
 */
export namespace ShowMessageRequest {
	export const type: RequestType<ShowMessageRequestParams, MessageActionItem, void> = { get method() { return 'window/showMessageRequest'; } };
}

/**
 * The log message notification is send from the server to the client to ask
 * the client to log a particular message.
 */
export namespace LogMessageNotification {
	export let type: NotificationType<LogMessageParams> = { get method() { return 'window/logMessage'; } };
}

/**
 * The log message parameters.
 */
export interface LogMessageParams {
	/**
	 * The message type. See {@link MessageType}
	 */
	type: number;

	/**
	 * The actual message
	 */
	message: string;
}

//---- Telemetry notification

/**
 * The telemetry event notification is send from the server to the client to ask
 * the client to log telemetry data.
 */
export namespace TelemetryEventNotification {
	export let type: NotificationType<any> = { get method() { return 'telemetry/event'; } };
}

//---- Text document notifications ----

/**
 * The parameters send in a open text document notification
 */
export interface DidOpenTextDocumentParams {
	/**
	 * The document that was opened.
	 */
	textDocument: TextDocumentItem;
}

/**
 * The document open notification is sent from the client to the server to signal
 * newly opened text documents. The document's truth is now managed by the client
 * and the server must not try to read the document's truth using the document's
 * uri.
 */
export namespace DidOpenTextDocumentNotification {
	export const type: NotificationType<DidOpenTextDocumentParams> = { get method() { return 'textDocument/didOpen'; } };
}

/**
 * An event describing a change to a text document. If range and rangeLength are omitted
 * the new text is considered to be the full content of the document.
 */
export interface TextDocumentContentChangeEvent {
	/**
	 * The range of the document that changed.
	 */
	range?: Range;

	/**
	 * The length of the range that got replaced.
	 */
	rangeLength?: number;

	/**
	 * The new text of the document.
	 */
	text: string;
}

/**
 * The change text document notification's parameters.
 */
export interface DidChangeTextDocumentParams {
	/**
	 * The document that did change. The version number points
	 * to the version after all provided content changes have
	 * been applied.
	 */
	textDocument: VersionedTextDocumentIdentifier;

	/**
	 * The actual content changes.
	 */
	contentChanges: TextDocumentContentChangeEvent[];
}

/**
 * The document change notification is sent from the client to the server to signal
 * changes to a text document.
 */
export namespace DidChangeTextDocumentNotification {
	export const type: NotificationType<DidChangeTextDocumentParams> = { get method() { return 'textDocument/didChange'; } };
}

/**
 * The parameters send in a close text document notification
 */
export interface DidCloseTextDocumentParams {
	/**
	 * The document that was closed.
	 */
	textDocument: TextDocumentIdentifier;
}

/**
 * The document close notification is sent from the client to the server when
 * the document got closed in the client. The document's truth now exists
 * where the document's uri points to (e.g. if the document's uri is a file uri
 * the truth now exists on disk).
 */
export namespace DidCloseTextDocumentNotification {
	export const type: NotificationType<DidCloseTextDocumentParams> = { get method() { return 'textDocument/didClose'; } };
}

/**
 * The parameters send in a save text document notification
 */
export interface DidSaveTextDocumentParams {
	/**
	 * The document that was closed.
	 */
	textDocument: TextDocumentIdentifier;
}

/**
 * The document save notification is sent from the client to the server when
 * the document got saved in the client.
 */
export namespace DidSaveTextDocumentNotification {
	export const type: NotificationType<DidSaveTextDocumentParams> = { get method() { return 'textDocument/didSave'; } };
}

//---- File eventing ----

/**
 * The watched files notification is sent from the client to the server when
 * the client detects changes to file watched by the lanaguage client.
 */
export namespace DidChangeWatchedFilesNotification {
	export const type: NotificationType<DidChangeWatchedFilesParams> = { get method() { return 'workspace/didChangeWatchedFiles'; } };
}

/**
 * The watched files change notification's parameters.
 */
export interface DidChangeWatchedFilesParams {
	/**
	 * The actual file events.
	 */
	changes: FileEvent[];
}

/**
 * The file event type
 */
export enum FileChangeType {
	/**
	 * The file got created.
	 */
	Created = 1,
	/**
	 * The file got changed.
	 */
	Changed = 2,
	/**
	 * The file got deleted.
	 */
	Deleted = 3
}

/**
 * An event describing a file change.
 */
export interface FileEvent {
	/**
	 * The file's uri.
	 */
	uri: string;
	/**
	 * The change type.
	 */
	type: number;
}

//---- Diagnostic notification ----

/**
 * Diagnostics notification are sent from the server to the client to signal
 * results of validation runs.
 */
export namespace PublishDiagnosticsNotification {
	export const type: NotificationType<PublishDiagnosticsParams> = { get method() { return 'textDocument/publishDiagnostics'; } };
}

/**
 * The publish diagnostic notification's parameters.
 */
export interface PublishDiagnosticsParams {
	/**
	 * The URI for which diagnostic information is reported.
	 */
	uri: string;

	/**
	 * An array of diagnostic information items.
	 */
	diagnostics: Diagnostic[];
}

//---- Completion Support --------------------------

/**
 * Request to request completion at a given text document position. The request's
 * parameter is of type [TextDocumentPosition](#TextDocumentPosition) the response
 * is of type [CompletionItem[]](#CompletionItem) or [CompletionList](#CompletionList)
 * or a Thenable that resolves to such.
 */
export namespace CompletionRequest {
	export const type: RequestType<TextDocumentPositionParams, CompletionItem[] | CompletionList, void> = { get method() { return 'textDocument/completion'; } };
}

/**
 * Request to resolve additional information for a given completion item.The request's
 * parameter is of type [CompletionItem](#CompletionItem) the response
 * is of type [CompletionItem](#CompletionItem) or a Thenable that resolves to such.
 */
export namespace CompletionResolveRequest {
	export const type: RequestType<CompletionItem, CompletionItem, void> = { get method() { return 'completionItem/resolve'; } };
}

//---- Hover Support -------------------------------

export type MarkedString = string | { language: string; value: string };

/**
 * Request to request hover information at a given text document position. The request's
 * parameter is of type [TextDocumentPosition](#TextDocumentPosition) the response is of
 * type [Hover](#Hover) or a Thenable that resolves to such.
 */
export namespace HoverRequest {
	export const type: RequestType<TextDocumentPositionParams, Hover, void> = { get method() { return 'textDocument/hover'; } };
}

//---- SignatureHelp ----------------------------------

export namespace SignatureHelpRequest {
	export const type: RequestType<TextDocumentPositionParams, SignatureHelp, void> = { get method() { return 'textDocument/signatureHelp'; } };
}

//---- Goto Definition -------------------------------------


/**
 * A request to resolve the defintion location of a symbol at a given text
 * document position. The request's parameter is of type [TextDocumentPosition]
 * (#TextDocumentPosition) the response is of type [Definition](#Definition) or a
 * Thenable that resolves to such.
 */
export namespace DefinitionRequest {
	export const type: RequestType<TextDocumentPositionParams, Definition, void> = { get method() { return 'textDocument/definition'; } };
}

//---- Reference Provider ----------------------------------

/**
 * Parameters for a [ReferencesRequest](#ReferencesRequest).
 */
export interface ReferenceParams extends TextDocumentPositionParams {
	context: ReferenceContext
}

/**
 * A request to resolve project-wide references for the symbol denoted
 * by the given text document position. The request's parameter is of
 * type [ReferenceParams](#ReferenceParams) the response is of type
 * [Location[]](#Location) or a Thenable that resolves to such.
 */
export namespace ReferencesRequest {
	export const type: RequestType<ReferenceParams, Location[], void> = { get method() { return 'textDocument/references'; } };
}

//---- Document Highlight ----------------------------------

/**
 * Request to resolve a [DocumentHighlight](#DocumentHighlight) for a given
 * text document position. The request's parameter is of type [TextDocumentPosition]
 * (#TextDocumentPosition) the request reponse is of type [DocumentHighlight[]]
 * (#DocumentHighlight) or a Thenable that resolves to such.
 */
export namespace DocumentHighlightRequest {
	export const type: RequestType<TextDocumentPositionParams, DocumentHighlight[], void> = { get method() { return 'textDocument/documentHighlight'; } };
}

//---- Document Symbol Provider ---------------------------

/**
 * Parameters for a [DocumentSymbolRequest](#DocumentSymbolRequest).
 */
export interface DocumentSymbolParams {
	/**
	 * The text document.
	 */
	textDocument: TextDocumentIdentifier;
}

/**
 * A request to list all symbols found in a given text document. The request's
 * parameter is of type [TextDocumentIdentifier](#TextDocumentIdentifier) the
 * response is of type [SymbolInformation[]](#SymbolInformation) or a Thenable
 * that resolves to such.
 */
export namespace DocumentSymbolRequest {
	export const type: RequestType<DocumentSymbolParams, SymbolInformation[], void> = { get method() { return 'textDocument/documentSymbol'; } };
}

//---- Workspace Symbol Provider ---------------------------

/**
 * The parameters of a [WorkspaceSymbolRequest](#WorkspaceSymbolRequest).
 */
export interface WorkspaceSymbolParams {
	/**
	 * A non-empty query string
	 */
	query: string;
}

/**
 * A request to list project-wide symbols matching the query string given
 * by the [WorkspaceSymbolParams](#WorkspaceSymbolParams). The response is
 * of type [SymbolInformation[]](#SymbolInformation) or a Thenable that
 * resolves to such.
 */
export namespace WorkspaceSymbolRequest {
	export const type: RequestType<WorkspaceSymbolParams, SymbolInformation[], void> = { get method() { return 'workspace/symbol'; } };
}

//---- Code Action Provider ----------------------------------



/**
 * Params for the CodeActionRequest
 */
export interface CodeActionParams {
	/**
	 * The document in which the command was invoked.
	 */
	textDocument: TextDocumentIdentifier;

	/**
	 * The range for which the command was invoked.
	 */
	range: Range;

	/**
	 * Context carrying additional information.
	 */
	context: CodeActionContext;
}

/**
 * A request to provide commands for the given text document and range.
 */
export namespace CodeActionRequest {
	export const type: RequestType<CodeActionParams, Command[], void> = { get method() { return 'textDocument/codeAction'; } };
}

//---- Code Lens Provider -------------------------------------------

/**
 * Params for the Code Lens request.
 */
export interface CodeLensParams {
	/**
	 * The document to request code lens for.
	 */
	textDocument: TextDocumentIdentifier;
}

/**
 * A request to provide code lens for the given text document.
 */
export namespace CodeLensRequest {
	export const type: RequestType<CodeLensParams, CodeLens[], void> = { get method() { return 'textDocument/codeLens'; } };
}

/**
 * A request to resolve a command for a given code lens.
 */
export namespace CodeLensResolveRequest {
	export const type: RequestType<CodeLens, CodeLens, void> = { get method() { return 'codeLens/resolve'; } };
}

//---- Formatting ----------------------------------------------

export interface DocumentFormattingParams {
	/**
	 * The document to format.
	 */
	textDocument: TextDocumentIdentifier;

	/**
	 * The format options
	 */
	options: FormattingOptions;
}

/**
 * A request to to format a whole document.
 */
export namespace DocumentFormattingRequest {
	export const type: RequestType<DocumentFormattingParams, TextEdit[], void> = { get method() { return 'textDocument/formatting'; } };
}

export interface DocumentRangeFormattingParams {
	/**
	 * The document to format.
	 */
	textDocument: TextDocumentIdentifier;

	/**
	 * The range to format
	 */
	range: Range;

	/**
	 * The format options
	 */
	options: FormattingOptions;
}

/**
 * A request to to format a range in a document.
 */
export namespace DocumentRangeFormattingRequest {
	export const type: RequestType<DocumentRangeFormattingParams, TextEdit[], void> = { get method() { return 'textDocument/rangeFormatting'; } };
}

export interface DocumentOnTypeFormattingParams {
	/**
	 * The document to format.
	 */
	textDocument: TextDocumentIdentifier;

	/**
	 * The position at which this request was send.
	 */
	position: Position;

	/**
	 * The character that has been typed.
	 */
	ch: string;

	/**
	 * The format options.
	 */
	options: FormattingOptions;
}

/**
 * A request to format a document on type.
 */
export namespace DocumentOnTypeFormattingRequest {
	export const type: RequestType<DocumentOnTypeFormattingParams, TextEdit[], void> = { get method() { return 'textDocument/onTypeFormatting'; } };
}

//---- Rename ----------------------------------------------

export interface RenameParams {
	/**
	 * The document to format.
	 */
	textDocument: TextDocumentIdentifier;

	/**
	 * The position at which this request was send.
	 */
	position: Position;

	/**
	 * The new name of the symbol. If the given name is not valid the
	 * request must return a [ResponseError](#ResponseError) with an
	 * appropriate message set.
	 */
	newName: string;
}

/**
 * A request to rename a symbol.
 */
export namespace RenameRequest {
	export const type: RequestType<RenameParams, WorkspaceEdit, void> = { get method() { return 'textDocument/rename'; } };
}

//---- Document Links ----------------------------------------------

export interface DocumentLinkParams {
	/**
	 * The document to provide document links for.
	 */
	textDocument: TextDocumentIdentifier;
}

/**
 * A request to provide document links
 */
export namespace DocumentLinkRequest {
	export const type: RequestType<DocumentLinkParams, DocumentLink[], void> = { get method() { return 'textDocument/documentLink'; } };
}

/**
 * Request to resolve additional information for a given document link. The request's
 * parameter is of type [DocumentLink](#DocumentLink) the response
 * is of type [DocumentLink](#DocumentLink) or a Thenable that resolves to such.
 */
export namespace DocumentLinkResolveRequest {
	export const type: RequestType<DocumentLink, DocumentLink, void> = { get method() { return 'documentLink/resolve'; } };
}

//---- Refresh IntelliSense ----------------------------------------

/**
 * Notification sent when the an IntelliSense cache invalidation is requested
 */
export namespace RebuildIntelliSenseNotification {
	export const type: NotificationType<RebuildIntelliSenseParams> = { get method(): string { return 'textDocument/rebuildIntelliSense'; } };
}

/**
 * Rebuild IntelliSense notification parameters
 */
export class RebuildIntelliSenseParams {
	/**
	 * URI identifying the text document
	 */
	public ownerUri: string;
}

// ------------------------------- < Connect Request > ----------------------------------------------

/**
 * Connection request message format
 */
export interface ConnectParams {
	/**
	 * URI identifying the owner of the connection
	 */
	ownerUri: string;

	/**
	 * Details for creating the connection
	 */
	connection: ConnectionDetails;
}


// Connection request message callback declaration
export namespace ConnectionRequest {
	export const type: RequestType<ConnectParams, boolean, void> = { get method(): string { return 'connection/connect'; } };
}

// ------------------------------- < Connection Complete Event > ------------------------------------


export namespace ConnectionCompleteNotification {
	export const type: NotificationType<ConnectionCompleteParams> = { get method(): string { return 'connection/complete'; } };
}

// ------------------------------- < Connection Changed Event > -------------------------------------

/**
 * Parameters for the ConnectionChanged notification.
 */
export class ConnectionChangedParams {
	/**
	 * Owner URI of the connection that changed.
	 */
	public ownerUri: string;

	/**
	 * Summary of details containing any connection changes.
	 */
	public connection: ConnectionSummary;
}

/**
 * Connection changed event callback declaration.
 */
export namespace ConnectionChangedNotification {
	export const type: NotificationType<ConnectionChangedParams> = { get method(): string { return 'connection/connectionchanged'; } };
}

// ------------------------------- < Disconnect Request > -------------------------------------------

// Disconnect request message format
export class DisconnectParams {
	// URI identifying the owner of the connection
	public ownerUri: string;
}

// Disconnect response format
export type DisconnectResult = boolean;

// Disconnect request message callback declaration
export namespace DisconnectRequest {
	export const type: RequestType<DisconnectParams, DisconnectResult, void> = { get method(): string { return 'connection/disconnect'; } };
}

// ------------------------------- < Cancel Connect Request > ---------------------------------------


// Cancel connect request message format
export class CancelConnectParams {
    /**
     * URI identifying the owner of the connection
     */
	public ownerUri: string;
}

// Cancel connect response format.
export type CancelConnectResult = boolean;

// Cancel connect request message callback declaration
export namespace CancelConnectRequest {
	export const type: RequestType<CancelConnectParams, CancelConnectResult, void> = { get method(): string { return 'connection/cancelconnect'; } };
}

// ------------------------------- < Change Database Request > -------------------------------------

export class ChangeDatabaseParams {
	public ownerUri: string;
	public newDatabase: string;
}

export namespace ChangeDatabaseRequest {
	export const type: RequestType<ChangeDatabaseParams, boolean, void> = { get method(): string { return 'connection/changedatabase'; } };
}

// ------------------------------- < List Databases Request > ---------------------------------------

// List databases request format
export class ListDatabasesParams {
	// Connection information to use for querying master
	public ownerUri: string;
}

// List databases response format
export class ListDatabasesResult {
	public databaseNames: Array<string>;
}

// List databases request callback declaration
export namespace ListDatabasesRequest {
	export const type: RequestType<ListDatabasesParams, ListDatabasesResult, void> = { get method(): string { return 'connection/listdatabases'; } };
}

// Language Flavor Changed ================================================================================

/**
 * Parameters to provide when sending a language flavor changed notification
 */
export interface DidChangeLanguageFlavorParams {
	uri: string;
	language: string;
	flavor: string;
}

// ------------------------------- < Language Flavor Changed Notification > ---------------------------------------
export namespace LanguageFlavorChangedNotification {
	export const type: NotificationType<DidChangeLanguageFlavorParams> = { get method(): string { return 'connection/languageflavorchanged'; } };
}

// ------------------------------- < Table Metadata Request > ---------------------------------------

// Table metadata request format
export class TableMetadataParams {
	// Connection information to use for querying master
	public ownerUri: string;

	public schema: string;

	public objectName: string;
}

// Table metadata response format
export class TableMetadataResult {
	public columns: ColumnMetadata[];
}

// Table metadata request callback declaration
export namespace TableMetadataRequest {
	export const type: RequestType<TableMetadataParams, TableMetadataResult, void> = { get method(): string { return 'metadata/table'; } };
}

// ------------------------------- < View Metadata Request > ---------------------------------------

// Table metadata request callback declaration
export namespace ViewMetadataRequest {
	export const type: RequestType<TableMetadataParams, TableMetadataResult, void> = { get method(): string { return 'metadata/view'; } };
}

/**
 * Event sent when the language service is finished updating after a connection
 */
export namespace IntelliSenseReadyNotification {
	export const type: NotificationType<IntelliSenseReadyParams> = { get method(): string { return 'textDocument/intelliSenseReady'; } };
}

// ------------------------------- < Capabilties Discovery Event > ------------------------------------

export class CapabiltiesDiscoveryParams {
	public hostName: string;

	public hostVersion: string;
}

export namespace CapabiltiesDiscoveryRequest {
	export const type: RequestType<CapabiltiesDiscoveryParams, CapabiltiesDiscoveryResult, void> = { get method(): string { return 'capabilities/list'; } };
}

// Query Execution ================================================================================
// ------------------------------- < Query Cancellation Request > ------------------------------------
export namespace QueryCancelRequest {
	export const type: RequestType<QueryCancelParams, QueryCancelResult, void> = { get method(): string { return 'query/cancel'; } };
}

export interface QueryCancelParams {
	ownerUri: string;
}

export interface QueryCancelResult {
	messages: string;
}

// ------------------------------- < Query Dispose Request > ------------------------------------

export namespace QueryDisposeRequest {
	export const type: RequestType<QueryDisposeParams, QueryDisposeResult, void> = { get method(): string { return 'query/dispose'; } };
}

/**
 * Parameters to provide when disposing of a query
 */
export interface QueryDisposeParams {
	ownerUri: string;
}

/**
 * Result received upon successful disposal of a query
 */
export interface QueryDisposeResult {
}

// ------------------------------- < Query Execution Complete Notification > ------------------------------------
export namespace QueryExecuteCompleteNotification {
	export const type: NotificationType<QueryExecuteCompleteNotificationResult> = { get method(): string { return 'query/complete'; } };
}

/**
 * Result received upon successful execution of a query
 */
export interface QueryExecuteCompleteNotificationResult {
	ownerUri: string;
	batchSummaries: BatchSummary[];
}

// ------------------------------- < Query Batch Start  Notification > ------------------------------------
export namespace QueryExecuteBatchStartNotification {
	export const type: NotificationType<QueryExecuteBatchNotificationParams> = { get method(): string { return 'query/batchStart'; } };
}

// ------------------------------- < Query Batch Complete Notification > ------------------------------------
export namespace QueryExecuteBatchCompleteNotification {
	export const type: NotificationType<QueryExecuteBatchNotificationParams> = { get method(): string { return 'query/batchComplete'; } };
}

// ------------------------------- < Query ResultSet Complete Notification > ------------------------------------
export namespace QueryExecuteResultSetCompleteNotification {
	export const type: NotificationType<QueryExecuteResultSetCompleteNotificationParams> = { get method(): string { return 'query/resultSetComplete'; } };
}

export interface QueryExecuteResultSetCompleteNotificationParams {
	resultSetSummary: ResultSetSummary;
	ownerUri: string;
}

// ------------------------------- < Query Message Notification > ------------------------------------
export namespace QueryExecuteMessageNotification {
	export const type: NotificationType<QueryExecuteMessageParams> = { get method(): string { return 'query/message'; } };
}

export class QueryExecuteMessageParams {
	message: IResultMessage;
	ownerUri: string;
}

// ------------------------------- < Query Execution Request > ------------------------------------
export namespace QueryExecuteRequest {
	export const type: RequestType<QueryExecuteParams, QueryExecuteResult, void> = { get method(): string { return 'query/executeDocumentSelection'; } };
}

export interface ExecutionPlanOptions {
	includeEstimatedExecutionPlanXml?: boolean;
	includeActualExecutionPlanXml?: boolean;
}

export interface QueryExecuteParams {
	ownerUri: string;
	querySelection: ISelectionData;
	executionPlanOptions?: ExecutionPlanOptions;
}

export interface QueryExecuteResult { }

// ------------------------------- < Query Results Request > ------------------------------------
export namespace QueryExecuteSubsetRequest {
	export const type: RequestType<QueryExecuteSubsetParams, QueryExecuteSubsetResult, void> = { get method(): string { return 'query/subset'; } };
}

export interface QueryExecuteSubsetParams {
	ownerUri: string;
	batchIndex: number;
	resultSetIndex: number;
	rowsStartIndex: number;
	rowsCount: number;
}

export interface ResultSetSubset {
	rowCount: number;
	rows: DbCellValue[][];
}

export interface QueryExecuteSubsetResult {
	message: string;
	resultSubset: ResultSetSubset;
}

// ------------------------------- < Execute Statement > ------------------------------------
export interface QueryExecuteStatementParams {
	ownerUri: string;
	line: number;
	column: number;
}

export namespace QueryExecuteStatementRequest {
	export const type: RequestType<QueryExecuteStatementParams, QueryExecuteResult, void> = { get method(): string { return 'query/executedocumentstatement'; } };
}

// --------------------------------- < Save Results as CSV Request > ------------------------------------------
export interface SaveResultsRequestParams {
	ownerUri: string;
	filePath: string;
	batchIndex: number;
	resultSetIndex: number;
	rowStartIndex: number;
	rowEndIndex: number;
	columnStartIndex: number;
	columnEndIndex: number;
	includeHeaders?: boolean;
}

export class SaveResultRequestResult {
	messages: string;
}
// save results in csv format
export namespace SaveResultsAsCsvRequest {
	export const type: RequestType<SaveResultsRequestParams, SaveResultRequestResult, void> = { get method(): string { return 'query/saveCsv'; } };
}
// --------------------------------- </ Save Results as CSV Request > ------------------------------------------

// --------------------------------- < Save Results as JSON Request > ------------------------------------------
// save results in json format
export namespace SaveResultsAsJsonRequest {
	export const type: RequestType<SaveResultsRequestParams, SaveResultRequestResult, void> = { get method(): string { return 'query/saveJson'; } };
}
// --------------------------------- </ Save Results as JSON Request > ------------------------------------------

// --------------------------------- < Save Results as Excel Request > ------------------------------------------
// save results in Excel format
export namespace SaveResultsAsExcelRequest {
	export const type: RequestType<SaveResultsRequestParams, SaveResultRequestResult, void> = { get method(): string { return 'query/saveExcel'; } };
}
// --------------------------------- </ Save Results as Excel Request > ------------------------------------------

// ------------------------------- < Execute and Return > -----------------------------------

export interface SimpleExecuteParams {
	queryString: string;
	ownerUri: string;
}

export interface SimpleExecuteResult {
	rowCount: number;
	columnInfo: IDbColumn[];
	rows: DbCellValue[][];
}

export namespace SimpleExecuteRequest {
	export const type: RequestType<SimpleExecuteParams, SimpleExecuteResult, void> = { get method(): string { return 'query/simpleexecute'; } };
}

// ------------------------------- < Execute String > ------------------------------------
export interface QueryExecuteStringParams {
	query: string;
	ownerUri: string;
}

export namespace QueryExecuteStringRequest {
	export const type: RequestType<QueryExecuteStringParams, QueryExecuteResult, void> = { get method(): string { return 'query/executeString'; } };
}

// ------------------------------- < Metadata Events > ------------------------------------

export namespace MetadataQueryRequest {
	export const type: RequestType<MetadataQueryParams, MetadataQueryResult, void> = { get method(): string { return 'metadata/list'; } };
}

// ------------------------------- < Scripting Events > ------------------------------------

export namespace ScriptingRequest {
	export const type: RequestType<ScriptingParams, ScriptingResult, void> = { get method(): string { return 'scripting/script'; } };
}

// ------------------------------- < Scripting Complete Event > ------------------------------------

export namespace ScriptingCompleteNotification {
	export const type: NotificationType<ScriptingCompleteParams> = { get method(): string { return 'scripting/scriptComplete'; } };
}


// Edit Data ======================================================================================
// Shared Interfaces --------------------------------------------------------------------------
export interface EditSessionOperationParams {
	ownerUri: string;
}

export interface EditRowOperationParams extends EditSessionOperationParams {
	rowId: number;
}

export interface EditCellResult {
	cell: EditCell;
	isRowDirty: boolean;
}

// edit/commit --------------------------------------------------------------------------------
export namespace EditCommitRequest {
	export const type: RequestType<EditCommitParams, EditCommitResult, void> = { get method(): string { return 'edit/commit'; } };
}
export interface EditCommitParams extends EditSessionOperationParams { }
export interface EditCommitResult { }

// edit/createRow -----------------------------------------------------------------------------
export namespace EditCreateRowRequest {
	export const type: RequestType<EditCreateRowParams, EditCreateRowResult, void> = { get method(): string { return 'edit/createRow'; } };
}
export interface EditCreateRowParams extends EditSessionOperationParams { }
export interface EditCreateRowResult {
	defaultValues: string[];
	newRowId: number;
}

// edit/deleteRow -----------------------------------------------------------------------------
export namespace EditDeleteRowRequest {
	export const type: RequestType<EditDeleteRowParams, EditDeleteRowResult, void> = { get method(): string { return 'edit/deleteRow'; } };
}
export interface EditDeleteRowParams extends EditRowOperationParams { }
export interface EditDeleteRowResult { }

// edit/dispose -------------------------------------------------------------------------------
export namespace EditDisposeRequest {
	export const type: RequestType<EditDisposeParams, EditDisposeResult, void> = { get method(): string { return 'edit/dispose'; } };
}
export interface EditDisposeParams extends EditSessionOperationParams { }
export interface EditDisposeResult { }

// edit/initialize ----------------------------------------------------------------------------
export namespace EditInitializeRequest {
	export const type: RequestType<EditInitializeParams, EditInitializeResult, void> = { get method(): string { return 'edit/initialize'; } };
}
export interface EditInitializeFiltering {
	LimitResults?: number;
}
export interface EditInitializeParams extends EditSessionOperationParams {
	filters: EditInitializeFiltering;
	objectName: string;
	schemaName: string;
	objectType: string;
}
export interface EditInitializeResult { }

// edit/revertCell --------------------------------------------------------------------------------
export namespace EditRevertCellRequest {
	export const type: RequestType<EditRevertCellParams, EditRevertCellResult, void> = { get method(): string { return 'edit/revertCell'; } };
}
export interface EditRevertCellParams extends EditRowOperationParams {
	columnId: number;
}
export interface EditRevertCellResult extends EditCellResult {
}

// edit/revertRow -----------------------------------------------------------------------------
export namespace EditRevertRowRequest {
	export const type: RequestType<EditRevertRowParams, EditRevertRowResult, void> = { get method(): string { return 'edit/revertRow'; } };
}
export interface EditRevertRowParams extends EditRowOperationParams { }
export interface EditRevertRowResult { }

// edit/sessionReady Event --------------------------------------------------------------------
export namespace EditSessionReadyNotification {
	export const type: NotificationType<EditSessionReadyParams> = { get method(): string { return 'edit/sessionReady'; } };
}
export interface EditSessionReadyParams {
	ownerUri: string;
	success: boolean;
	message: string;
}

// edit/updateCell ----------------------------------------------------------------------------
export namespace EditUpdateCellRequest {
	export const type: RequestType<EditUpdateCellParams, EditUpdateCellResult, void> = { get method(): string { return 'edit/updateCell'; } };
}
export interface EditUpdateCellParams extends EditRowOperationParams {
	columnId: number;
	newValue: string;
}
export interface EditUpdateCellResult extends EditCellResult { }

// edit/subset ------------------------------------------------------------------------------------
export namespace EditSubsetRequest {
	export const type: RequestType<EditSubsetParams, EditSubsetResult, void> = { get method(): string { return 'edit/subset'; } };
}
export interface EditSubsetParams extends EditSessionOperationParams {
	rowStartIndex: number;
	rowCount: number;
}
export interface EditSubsetResult {
	rowCount: number;
	subset: EditRow[];
}

// ------------------------------- < Object Explorer Events > ------------------------------------

export namespace ObjectExplorerCreateSessionRequest {
	export const type: RequestType<ConnectionDetails, CreateSessionResponse, void> = { get method(): string { return 'objectexplorer/createsession'; } };
}

export namespace ObjectExplorerExpandRequest {
	export const type: RequestType<ExpandParams, boolean, void> = { get method(): string { return 'objectexplorer/expand'; } };
}

export namespace ObjectExplorerRefreshRequest {
	export const type: RequestType<ExpandParams, boolean, void> = { get method(): string { return 'objectexplorer/refresh'; } };
}

export namespace ObjectExplorerCloseSessionRequest {
	export const type: RequestType<CloseSessionParams, CloseSessionResponse, void> = { get method(): string { return 'objectexplorer/closesession'; } };
}

// ------------------------------- < Object Explorer Events > ------------------------------------


export namespace ObjectExplorerCreateSessionCompleteNotification {
	export const type: NotificationType<SessionCreatedParameters> = { get method(): string { return 'objectexplorer/sessioncreated'; } };
}


export namespace ObjectExplorerExpandCompleteNotification {
	export const type: NotificationType<ExpandResponse> = { get method(): string { return 'objectexplorer/expandCompleted'; } };
}

// ------------------------------- < Task Service Events > ------------------------------------

export namespace ListTasksRequest {
	export const type: RequestType<ListTasksParams, ListTasksResponse, void> = { get method(): string { return 'tasks/listtasks'; } };
}

export namespace CancelTaskRequest {
	export const type: RequestType<CancelTaskParams, boolean, void> = { get method(): string { return 'tasks/canceltask'; } };
}

// ------------------------------- < Task Service Events > ------------------------------------


export namespace TaskStatusChangedNotification {
	export const type: NotificationType<TaskProgressInfo> = { get method(): string { return 'tasks/statuschanged'; } };
}

export namespace TaskCreatedNotification {
	export const type: NotificationType<TaskInfo> = { get method(): string { return 'tasks/newtaskcreated'; } };
}

// ------------------------------- < Admin Service Events > ------------------------------------

export namespace CreateDatabaseRequest {
	export const type: RequestType<CreateDatabaseParams, CreateDatabaseResponse, void> = { get method(): string { return 'admin/createdatabase'; } };
}

export namespace DefaultDatabaseInfoRequest {
	export const type: RequestType<DefaultDatabaseInfoParams, DefaultDatabaseInfoResponse, void> = { get method(): string { return 'admin/defaultdatabaseinfo'; } };
}

export namespace CreateLoginRequest {
	export const type: RequestType<CreateLoginParams, CreateLoginResponse, void> = { get method(): string { return 'admin/createlogin'; } };
}

export namespace GetDatabaseInfoRequest {
	export const type: RequestType<GetDatabaseInfoParams, GetDatabaseInfoResponse, void> = { get method(): string { return 'admin/getdatabaseinfo'; } };
}

// ------------------------------- < Disaster Recovery Events > ------------------------------------

export namespace BackupRequest {
	export const type: RequestType<BackupParams, BackupResponse, void> = { get method(): string { return 'disasterrecovery/backup'; } };
}

export namespace BackupConfigInfoRequest {
	export const type: RequestType<DefaultDatabaseInfoParams, BackupConfigInfoResponse, void> = { get method(): string { return 'disasterrecovery/backupconfiginfo'; } };
}

export namespace RestoreRequest {
	export const type: RequestType<RestoreParams, RestoreResponse, void> = { get method(): string { return 'disasterrecovery/restore'; } };
}

export namespace RestorePlanRequest {
	export const type: RequestType<RestoreParams, RestorePlanResponse, void> = { get method(): string { return 'disasterrecovery/restoreplan'; } };
}

export namespace CancelRestorePlanRequest {
	export const type: RequestType<RestoreParams, boolean, void> = { get method(): string { return 'disasterrecovery/cancelrestoreplan'; } };
}

export namespace RestoreConfigInfoRequest {
	export const type: RequestType<RestoreConfigInfoRequestParams, RestoreConfigInfoResponse, void> = { get method(): string { return 'disasterrecovery/restoreconfiginfo'; } };
}

// ------------------------------- < File Browser Events > ------------------------------------

export namespace FileBrowserOpenRequest {
	export const type: RequestType<FileBrowserOpenParams, boolean, void> = { get method(): string { return 'filebrowser/open'; } };
}

export namespace FileBrowserOpenedNotification {
	export const type: NotificationType<FileBrowserOpenedParams> = { get method(): string { return 'filebrowser/opencomplete'; } };
}

export namespace FileBrowserExpandRequest {
	export const type: RequestType<FileBrowserExpandParams, boolean, void> = { get method(): string { return 'filebrowser/expand'; } };
}

export namespace FileBrowserExpandedNotification {
	export const type: NotificationType<FileBrowserExpandedParams> = { get method(): string { return 'filebrowser/expandcomplete'; } };
}

export namespace FileBrowserValidateRequest {
	export const type: RequestType<FileBrowserValidateParams, boolean, void> = { get method(): string { return 'filebrowser/validate'; } };
}

export namespace FileBrowserValidatedNotification {
	export const type: NotificationType<FileBrowserValidatedParams> = { get method(): string { return 'filebrowser/validatecomplete'; } };
}

export namespace FileBrowserCloseRequest {
	export const type: RequestType<FileBrowserCloseParams, FileBrowserCloseResponse, void> = { get method(): string { return 'filebrowser/close'; } };
}


// ------------------------------- < Profiler Events > ------------------------------------

export namespace StartProfilingRequest {
	export const type: RequestType<StartProfilingParams, StartProfilingResponse, void> = { get method(): string { return 'profiler/start'; } };
}

export namespace StopProfilingRequest {
	export const type: RequestType<StopProfilingParams, StopProfilingResponse, void> = { get method(): string { return 'profiler/stop'; } };
}
export namespace ProfilerEventsAvailableNotification {
	export const type: NotificationType<ProfilerEventsAvailableParams> = { get method(): string { return 'profiler/eventsavailable'; } };
}
