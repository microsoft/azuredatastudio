/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the Source EULA. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import * as code from 'vscode';
import * as data from 'data';
import * as ls from 'dataprotocol-languageserver-types';
import * as proto from './protocol';
import * as is from './utils/is';
import ProtocolCompletionItem from './protocolCompletionItem';
import ProtocolCodeLens from './protocolCodeLens';
import os = require('os');
import path = require('path');

export interface Converter {

	asUri(uri: code.Uri): string;

	asTextDocumentIdentifier(textDocument: code.TextDocument): ls.TextDocumentIdentifier;

	asOpenTextDocumentParams(textDocument: code.TextDocument): proto.DidOpenTextDocumentParams;

	asChangeTextDocumentParams(textDocument: code.TextDocument): proto.DidChangeTextDocumentParams;
	asChangeTextDocumentParams(event: code.TextDocumentChangeEvent): proto.DidChangeTextDocumentParams;

	asCloseTextDocumentParams(textDocument: code.TextDocument): proto.DidCloseTextDocumentParams;

	asSaveTextDocumentParams(textDocument: code.TextDocument): proto.DidSaveTextDocumentParams;

	asTextDocumentPositionParams(textDocument: code.TextDocument, position: code.Position): proto.TextDocumentPositionParams;

	asWorkerPosition(position: code.Position): ls.Position;

	asRange(value: code.Range): ls.Range;

	asPosition(value: code.Position): ls.Position;

	asDiagnosticSeverity(value: code.DiagnosticSeverity): ls.DiagnosticSeverity;

	asDiagnostic(item: code.Diagnostic): ls.Diagnostic;
	asDiagnostics(items: code.Diagnostic[]): ls.Diagnostic[];

	asCompletionItem(item: code.CompletionItem): ls.CompletionItem;

	asTextEdit(edit: code.TextEdit): ls.TextEdit;

	asReferenceParams(textDocument: code.TextDocument, position: code.Position, options: { includeDeclaration: boolean; }): proto.ReferenceParams;

	asCodeActionContext(context: code.CodeActionContext): ls.CodeActionContext;

	asCommand(item: code.Command): ls.Command;

	asCodeLens(item: code.CodeLens): ls.CodeLens;

	asFormattingOptions(item: code.FormattingOptions): ls.FormattingOptions;

	asDocumentSymbolParams(textDocument: code.TextDocument): proto.DocumentSymbolParams;

	asCodeLensParams(textDocument: code.TextDocument): proto.CodeLensParams;

	asDocumentLink(item: code.DocumentLink): ls.DocumentLink;

	asDocumentLinkParams(textDocument: code.TextDocument): proto.DocumentLinkParams;

	asConnectionParams(connectionUri: string, connectionInfo: data.ConnectionInfo): proto.ConnectParams;

	asCapabilitiesParams(client: data.DataProtocolClientCapabilities): proto.CapabiltiesDiscoveryParams;

	asMetadataQueryParams(connectionUri: string): ls.MetadataQueryParams;

	asListDatabasesParams(connectionUri: string): proto.ListDatabasesParams;

	asTableMetadataParams(connectionUri: string, metadata: data.ObjectMetadata): proto.TableMetadataParams;

	asScriptingParams(connectionUri: string, operation: ls.ScriptOperation, metadata: data.ObjectMetadata, paramDetails: data.ScriptingParamDetails): ls.ScriptingParams;

	asConnectionDetail(connInfo: data.ConnectionInfo): ls.ConnectionDetails;

	asExpandInfo(nodeInfo: data.ExpandNodeInfo): ls.ExpandParams;

	asCloseSessionInfo(nodeInfo: data.ObjectExplorerCloseSessionInfo): ls.CloseSessionParams;

	asExecutionPlanOptions(planOptions: data.ExecutionPlanOptions): proto.ExecutionPlanOptions;

	asListTasksParams(params: data.ListTasksParams): ls.ListTasksParams;

	asCancelTaskParams(params: data.CancelTaskParams): ls.CancelTaskParams;

	asRestoreParams(ownerUri: string, params: data.RestoreInfo): ls.RestoreParams;

	asRestoreConfigInfoParams(ownerUri: string): ls.RestoreConfigInfoRequestParams;
}

export interface URIConverter {
	(value: code.Uri): string;
}

export function createConverter(uriConverter?: URIConverter): Converter {

	const nullConverter = (value: code.Uri) => value.toString();

	const _uriConverter: URIConverter = uriConverter || nullConverter;

	function asUri(value: code.Uri): string {
		return _uriConverter(value);
	}

	function asTextDocumentIdentifier(textDocument: code.TextDocument): ls.TextDocumentIdentifier {
		return {
			uri: _uriConverter(textDocument.uri)
		};
	}

	function asOpenTextDocumentParams(textDocument: code.TextDocument): proto.DidOpenTextDocumentParams {
		return {
			textDocument: {
				uri: _uriConverter(textDocument.uri),
				languageId: textDocument.languageId,
				version: textDocument.version,
				text: textDocument.getText()
			}
		};
	}

	function isTextDocumentChangeEvent(value: any): value is code.TextDocumentChangeEvent {
		let candidate = <code.TextDocumentChangeEvent>value;
		return is.defined(candidate.document) && is.defined(candidate.contentChanges);
	}

	function isTextDocument(value: any): value is code.TextDocument {
		let candidate = <code.TextDocument>value;
		return is.defined(candidate.uri) && is.defined(candidate.version);
	}

	function asChangeTextDocumentParams(textDocument: code.TextDocument): proto.DidChangeTextDocumentParams;
	function asChangeTextDocumentParams(event: code.TextDocumentChangeEvent): proto.DidChangeTextDocumentParams;
	function asChangeTextDocumentParams(arg: code.TextDocumentChangeEvent | code.TextDocument): proto.DidChangeTextDocumentParams {
		if (isTextDocument(arg)) {
			let result: proto.DidChangeTextDocumentParams = {
				textDocument: {
					uri: _uriConverter(arg.uri),
					version: arg.version
				},
				contentChanges: [{ text: arg.getText() }]
			}
			return result;
		} else if (isTextDocumentChangeEvent(arg)) {
			let document = arg.document;
			let result: proto.DidChangeTextDocumentParams = {
				textDocument: {
					uri: _uriConverter(document.uri),
					version: document.version
				},
				contentChanges: arg.contentChanges.map((change): proto.TextDocumentContentChangeEvent => {
					let range = change.range;
					return {
						range: {
							start: { line: range.start.line, character: range.start.character },
							end: { line: range.end.line, character: range.end.character }
						},
						rangeLength: change.rangeLength,
						text: change.text
					}
				})
			}
			return result;
		} else {
			throw Error('Unsupported text document change parameter');
		}
	}

	function asCloseTextDocumentParams(textDocument: code.TextDocument): proto.DidCloseTextDocumentParams {
		return {
			textDocument: asTextDocumentIdentifier(textDocument)
		};
	}

	function asSaveTextDocumentParams(textDocument: code.TextDocument): proto.DidSaveTextDocumentParams {
		return {
			textDocument: asTextDocumentIdentifier(textDocument)
		}
	}

	function asTextDocumentPositionParams(textDocument: code.TextDocument, position: code.Position): proto.TextDocumentPositionParams {
		return {
			textDocument: asTextDocumentIdentifier(textDocument),
			position: asWorkerPosition(position)
		};
	}

	function asWorkerPosition(position: code.Position): ls.Position {
		return { line: position.line, character: position.character };
	}

	function asRange(value: code.Range): ls.Range {
		if (is.undefined(value)) {
			return undefined;
		} else if (is.nil(value)) {
			return null;
		}
		return { start: asPosition(value.start), end: asPosition(value.end) };
	}

	function asPosition(value: code.Position): ls.Position {
		if (is.undefined(value)) {
			return undefined;
		} else if (is.nil(value)) {
			return null;
		}
		return { line: value.line, character: value.character };
	}

	function set(value, func: () => void): void {
		if (is.defined(value)) {
			func();
		}
	}

	function asDiagnosticSeverity(value: code.DiagnosticSeverity): ls.DiagnosticSeverity {
		switch (value) {
			case code.DiagnosticSeverity.Error:
				return ls.DiagnosticSeverity.Error;
			case code.DiagnosticSeverity.Warning:
				return ls.DiagnosticSeverity.Warning;
			case code.DiagnosticSeverity.Information:
				return ls.DiagnosticSeverity.Information;
			case code.DiagnosticSeverity.Hint:
				return ls.DiagnosticSeverity.Hint;
		}
	}

	function asDiagnostic(item: code.Diagnostic): ls.Diagnostic {
		let result: ls.Diagnostic = ls.Diagnostic.create(asRange(item.range), item.message);
		set(item.severity, () => result.severity = asDiagnosticSeverity(item.severity));
		set(item.code, () => result.code = item.code);
		set(item.source, () => result.source = item.source);
		return result;
	}

	function asDiagnostics(items: code.Diagnostic[]): ls.Diagnostic[] {
		if (is.undefined(items) || is.nil(items)) {
			return items;
		}
		return items.map(asDiagnostic);
	}

	function asCompletionItem(item: code.CompletionItem): ls.CompletionItem {
		let result: ls.CompletionItem = { label: item.label };
		set(item.detail, () => result.detail = item.detail);
		set(item.documentation, () => result.documentation = item.documentation);
		set(item.filterText, () => result.filterText = item.filterText);
		set(item.insertText, () => result.insertText = String(item.insertText));
		// Protocol item kind is 1 based, codes item kind is zero based.
		set(item.kind, () => result.kind = item.kind + 1);
		set(item.sortText, () => result.sortText = item.sortText);
		set(item.textEdit, () => result.textEdit = asTextEdit(item.textEdit));
		set(item.additionalTextEdits, () => result.additionalTextEdits = asTextEdits(item.additionalTextEdits));
		set(item.command, () => result.command = asCommand(item.command));
		if (item instanceof ProtocolCompletionItem) {
			set(item.data, () => result.data = item.data);
		}
		return result;
	}

	function asTextEdit(edit: code.TextEdit): ls.TextEdit {
		return { range: asRange(edit.range), newText: edit.newText };
	}

	function asTextEdits(edits: code.TextEdit[]): ls.TextEdit[] {
		if (is.undefined(edits) || is.nil(edits)) {
			return edits;
		}
		return edits.map(asTextEdit);
	}

	function asReferenceParams(textDocument: code.TextDocument, position: code.Position, options: { includeDeclaration: boolean; }): proto.ReferenceParams {
		return {
			textDocument: asTextDocumentIdentifier(textDocument),
			position: asWorkerPosition(position),
			context: { includeDeclaration: options.includeDeclaration }
		};
	}

	function asCodeActionContext(context: code.CodeActionContext): ls.CodeActionContext {
		if (is.undefined(context) || is.nil(context)) {
			return context;
		}
		return ls.CodeActionContext.create(asDiagnostics(context.diagnostics));
	}

	function asCommand(item: code.Command): ls.Command {
		let result = ls.Command.create(item.title, item.command);
		if (is.defined(item.arguments)) result.arguments = item.arguments;
		return result;
	}

	function asCodeLens(item: code.CodeLens): ls.CodeLens {
		let result = ls.CodeLens.create(asRange(item.range));
		if (is.defined(item.command)) result.command = asCommand(item.command);
		if (item instanceof ProtocolCodeLens) {
			if (is.defined(item.data)) result.data = item.data;
		}
		return result;
	}

	function asFormattingOptions(item: code.FormattingOptions): ls.FormattingOptions {
		return { tabSize: item.tabSize, insertSpaces: item.insertSpaces };
	}

	function asDocumentSymbolParams(textDocument: code.TextDocument): proto.DocumentSymbolParams {
		return {
			textDocument: asTextDocumentIdentifier(textDocument)
		}
	}

	function asCodeLensParams(textDocument: code.TextDocument): proto.CodeLensParams {
		return {
			textDocument: asTextDocumentIdentifier(textDocument)
		};
	}

	function asDocumentLink(item: code.DocumentLink): ls.DocumentLink {
		let result = ls.DocumentLink.create(asRange(item.range));
		if (is.defined(item.target)) result.target = asUri(item.target);
		return result;
	}

	function asDocumentLinkParams(textDocument: code.TextDocument): proto.DocumentLinkParams {
		return {
			textDocument: asTextDocumentIdentifier(textDocument)
		};
	}

	function asCapabilitiesParams(client: data.DataProtocolClientCapabilities): proto.CapabiltiesDiscoveryParams {
		let params: proto.CapabiltiesDiscoveryParams = {
			hostName: client.hostName,
			hostVersion: client.hostVersion
		};
		return params;
	}

	function asConnectionParams(connUri: string, connInfo: data.ConnectionInfo): proto.ConnectParams {
		return {
			ownerUri: connUri,
			connection: {
				options: connInfo.options
			}
		};
	}

	function asMetadataQueryParams(connectionUri: string): ls.MetadataQueryParams {
		return <ls.MetadataQueryParams>{
			ownerUri: connectionUri
		};
	}

	function asListDatabasesParams(connectionUri: string): proto.ListDatabasesParams {
		return <proto.ListDatabasesParams>{
			ownerUri: connectionUri
		};
	}

	function asTableMetadataParams(connectionUri: string, metadata: data.ObjectMetadata): proto.TableMetadataParams {
		return <proto.TableMetadataParams>{
			ownerUri: connectionUri,
			schema: metadata.schema,
			objectName: metadata.name
		};
	}

	function asScriptingParams(connectionUri: string, operation: ls.ScriptOperation, metadata: data.ObjectMetadata, paramDetails: data.ScriptingParamDetails): ls.ScriptingParams {
		let scriptingObject: ls.ScriptingObject = {
			type: metadata.metadataTypeName,
			schema: metadata.schema,
			name: metadata.name
		}
		let targetDatabaseEngineEdition = paramDetails.targetDatabaseEngineEdition;
		let targetDatabaseEngineType = paramDetails.targetDatabaseEngineType;
		let scriptCompatibilityOption = paramDetails.scriptCompatibilityOption;
		let options: ls.ScriptOptions = {
			scriptCreateDrop: (operation === ls.ScriptOperation.Delete) ? "ScriptDrop" :
							  (operation === ls.ScriptOperation.Select) ? "ScriptSelect" : "ScriptCreate",
			typeOfDataToScript: "SchemaOnly",
			scriptStatistics: "ScriptStatsNone",
			targetDatabaseEngineEdition: targetDatabaseEngineEdition ? targetDatabaseEngineEdition : "SqlServerEnterpriseEdition",
			targetDatabaseEngineType: targetDatabaseEngineType ? targetDatabaseEngineType : "SingleInstance",
			scriptCompatibilityOption: scriptCompatibilityOption ? scriptCompatibilityOption : "Script140Compat"
		}
		return <ls.ScriptingParams> {
			connectionString: null,
			filePath: paramDetails.filePath,
			scriptingObjects: [scriptingObject],
			scriptDestination: "ToEditor",
			includeObjectCriteria: null,
			excludeObjectCriteria: null,
			includeSchemas: null,
			excludeSchemas: null,
			includeTypes: null,
			excludeTypes: null,
			scriptOptions: options,
			connectionDetails: null,
			ownerURI: connectionUri,
			operation: operation
		};
	}

	function asConnectionDetail(connInfo: data.ConnectionInfo): ls.ConnectionDetails {
		return <ls.ConnectionDetails>{
			options: connInfo.options
		};
	}

	function asExpandInfo(nodeInfo: data.ExpandNodeInfo): ls.ExpandParams {
		return <ls.ExpandParams>{
			sessionId: nodeInfo.sessionId,
			nodePath: nodeInfo.nodePath
		};
	}

	function asCloseSessionInfo(nodeInfo: data.ObjectExplorerCloseSessionInfo): ls.CloseSessionParams {
		return <ls.CloseSessionParams>{
			sessionId: nodeInfo.sessionId
		};
	}

	function asExecutionPlanOptions(planOptions: data.ExecutionPlanOptions): proto.ExecutionPlanOptions {
		return <proto.ExecutionPlanOptions>{
			includeEstimatedExecutionPlanXml: planOptions ? planOptions.displayEstimatedQueryPlan : undefined,
			includeActualExecutionPlanXml: planOptions ? planOptions.displayActualQueryPlan : undefined
		};
	}

	function asListTasksParams(params: data.ListTasksParams): ls.ListTasksParams {
		return <ls.ListTasksParams>{
			listActiveTasksOnly: params.listActiveTasksOnly
		};
	}

	function asCancelTaskParams(params: data.CancelTaskParams): ls.CancelTaskParams {
		return <ls.CancelTaskParams>{
			taskId: params.taskId
		};
	}

	function asRestoreParams(ownerUri: string, params: data.RestoreInfo): ls.RestoreParams {
		return <ls.RestoreParams>{
			ownerUri: ownerUri,
			options: params.options,
			taskExecutionMode: params.taskExecutionMode
		};
	}

	function asRestoreConfigInfoParams(ownerUri: string): ls.RestoreConfigInfoRequestParams {
		return <ls.RestoreConfigInfoRequestParams>{
			ownerUri: ownerUri
		};
	}

	return {
		asUri,
		asTextDocumentIdentifier,
		asOpenTextDocumentParams,
		asChangeTextDocumentParams,
		asCloseTextDocumentParams,
		asSaveTextDocumentParams,
		asTextDocumentPositionParams,
		asWorkerPosition,
		asRange,
		asPosition,
		asDiagnosticSeverity,
		asDiagnostic,
		asDiagnostics,
		asCompletionItem,
		asTextEdit,
		asReferenceParams,
		asCodeActionContext,
		asCommand,
		asCodeLens,
		asFormattingOptions,
		asDocumentSymbolParams,
		asCodeLensParams,
		asDocumentLink,
		asDocumentLinkParams,
		asCapabilitiesParams,
		asConnectionParams,
		asMetadataQueryParams,
		asTableMetadataParams,
		asListDatabasesParams,
		asScriptingParams,
		asConnectionDetail,
		asExpandInfo,
		asCloseSessionInfo,
		asExecutionPlanOptions,
		asListTasksParams,
		asCancelTaskParams,
		asRestoreParams,
		asRestoreConfigInfoParams
	};
}

// This for backward compatibility since we exported the converter functions as API.
let defaultConverter = createConverter();

export const asTextDocumentIdentifier: (textDocument: code.TextDocument) => ls.TextDocumentIdentifier = defaultConverter.asTextDocumentIdentifier;
export const asOpenTextDocumentParams: (textDocument: code.TextDocument) => proto.DidOpenTextDocumentParams = defaultConverter.asOpenTextDocumentParams;
export const asChangeTextDocumentParams: (arg: code.TextDocumentChangeEvent | code.TextDocument) => proto.DidChangeTextDocumentParams = defaultConverter.asChangeTextDocumentParams;
export const asCloseTextDocumentParams: (textDocument: code.TextDocument) => proto.DidCloseTextDocumentParams = defaultConverter.asCloseTextDocumentParams;
export const asSaveTextDocumentParams: (textDocument: code.TextDocument) => proto.DidSaveTextDocumentParams = defaultConverter.asSaveTextDocumentParams;
export const asTextDocumentPositionParams: (textDocument: code.TextDocument, position: code.Position) => proto.TextDocumentPositionParams = defaultConverter.asTextDocumentPositionParams;
export const asWorkerPosition: (position: code.Position) => ls.Position = defaultConverter.asWorkerPosition;
export const asRange: (value: code.Range) => ls.Range = defaultConverter.asRange;
export const asPosition: (value: code.Position) => ls.Position = defaultConverter.asPosition;
export const asDiagnosticSeverity: (value: code.DiagnosticSeverity) => ls.DiagnosticSeverity = defaultConverter.asDiagnosticSeverity;
export const asDiagnostic: (item: code.Diagnostic) => ls.Diagnostic = defaultConverter.asDiagnostic;
export const asDiagnostics: (items: code.Diagnostic[]) => ls.Diagnostic[] = defaultConverter.asDiagnostics;
export const asCompletionItem: (item: code.CompletionItem) => ls.CompletionItem = defaultConverter.asCompletionItem;
export const asTextEdit: (edit: code.TextEdit) => ls.TextEdit = defaultConverter.asTextEdit;
export const asReferenceParams: (textDocument: code.TextDocument, position: code.Position, options: { includeDeclaration: boolean; }) => proto.ReferenceParams = defaultConverter.asReferenceParams;
export const asCodeActionContext: (context: code.CodeActionContext) => ls.CodeActionContext = defaultConverter.asCodeActionContext;
export const asCommand: (item: code.Command) => ls.Command = defaultConverter.asCommand;
export const asCodeLens: (item: code.CodeLens) => ls.CodeLens = defaultConverter.asCodeLens;
export const asFormattingOptions: (item: code.FormattingOptions) => ls.FormattingOptions = defaultConverter.asFormattingOptions;
export const asDocumentSymbolParams: (textDocument: code.TextDocument) => proto.DocumentSymbolParams = defaultConverter.asDocumentSymbolParams;
export const asCodeLensParams: (textDocument: code.TextDocument) => proto.CodeLensParams = defaultConverter.asCodeLensParams;