/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as modes from 'vs/editor/common/modes';
import * as types from './extHostTypes';
import { Position as EditorPosition, ITextEditorOptions } from 'vs/platform/editor/common/editor';
import { IDecorationOptions } from 'vs/editor/common/editorCommon';
import { EndOfLineSequence } from 'vs/editor/common/model';
import * as vscode from 'vscode';
import URI from 'vs/base/common/uri';
import { ProgressLocation as MainProgressLocation } from 'vs/platform/progress/common/progress';
import { SaveReason } from 'vs/workbench/services/textfile/common/textfiles';
import { IPosition } from 'vs/editor/common/core/position';
import { IRange } from 'vs/editor/common/core/range';
import { ISelection } from 'vs/editor/common/core/selection';
import * as htmlContent from 'vs/base/common/htmlContent';
import { IRelativePattern } from 'vs/base/common/glob';
import { LanguageSelector, LanguageFilter } from 'vs/editor/common/modes/languageSelector';
import { WorkspaceEditDto, ResourceTextEditDto } from 'vs/workbench/api/node/extHost.protocol';
import { MarkerSeverity, IRelatedInformation, IMarkerData } from 'vs/platform/markers/common/markers';

export interface PositionLike {
	line: number;
	character: number;
}

export interface RangeLike {
	start: PositionLike;
	end: PositionLike;
}

export interface SelectionLike extends RangeLike {
	anchor: PositionLike;
	active: PositionLike;
}

export function toSelection(selection: ISelection): types.Selection {
	let { selectionStartLineNumber, selectionStartColumn, positionLineNumber, positionColumn } = selection;
	let start = new types.Position(selectionStartLineNumber - 1, selectionStartColumn - 1);
	let end = new types.Position(positionLineNumber - 1, positionColumn - 1);
	return new types.Selection(start, end);
}

export function fromSelection(selection: SelectionLike): ISelection {
	let { anchor, active } = selection;
	return {
		selectionStartLineNumber: anchor.line + 1,
		selectionStartColumn: anchor.character + 1,
		positionLineNumber: active.line + 1,
		positionColumn: active.character + 1
	};
}

export function fromRange(range: RangeLike): IRange {
	if (!range) {
		return undefined;
	}
	let { start, end } = range;
	return {
		startLineNumber: start.line + 1,
		startColumn: start.character + 1,
		endLineNumber: end.line + 1,
		endColumn: end.character + 1
	};
}

export function toRange(range: IRange): types.Range {
	if (!range) {
		return undefined;
	}
	let { startLineNumber, startColumn, endLineNumber, endColumn } = range;
	return new types.Range(startLineNumber - 1, startColumn - 1, endLineNumber - 1, endColumn - 1);
}

export function toPosition(position: IPosition): types.Position {
	return new types.Position(position.lineNumber - 1, position.column - 1);
}

export function fromPosition(position: types.Position): IPosition {
	return { lineNumber: position.line + 1, column: position.character + 1 };
}

export function fromDiagnostic(value: vscode.Diagnostic): IMarkerData {
	return {
		...fromRange(value.range),
		message: value.message,
		source: value.source,
		code: String(value.code),
		severity: fromDiagnosticSeverity(value.severity),
		relatedInformation: value.relatedInformation && value.relatedInformation.map(fromDiagnosticRelatedInformation)
	};
}

export function fromDiagnosticRelatedInformation(value: types.DiagnosticRelatedInformation): IRelatedInformation {
	return {
		...fromRange(value.location.range),
		message: value.message,
		resource: value.location.uri
	};
}

export function toDiagnosticRelatedInformation(value: IRelatedInformation): types.DiagnosticRelatedInformation {
	return new types.DiagnosticRelatedInformation(new types.Location(value.resource, toRange(value)), value.message);
}

export function fromDiagnosticSeverity(value: number): MarkerSeverity {
	switch (value) {
		case types.DiagnosticSeverity.Error:
			return MarkerSeverity.Error;
		case types.DiagnosticSeverity.Warning:
			return MarkerSeverity.Warning;
		case types.DiagnosticSeverity.Information:
			return MarkerSeverity.Info;
		case types.DiagnosticSeverity.Hint:
			return MarkerSeverity.Hint;
	}
	return MarkerSeverity.Error;
}

export function toDiagnosticSeverty(value: MarkerSeverity): types.DiagnosticSeverity {
	switch (value) {
		case MarkerSeverity.Info:
			return types.DiagnosticSeverity.Information;
		case MarkerSeverity.Warning:
			return types.DiagnosticSeverity.Warning;
		case MarkerSeverity.Error:
			return types.DiagnosticSeverity.Error;
		case MarkerSeverity.Hint:
			return types.DiagnosticSeverity.Hint;
	}
	return types.DiagnosticSeverity.Error;
}


export function fromViewColumn(column?: vscode.ViewColumn): EditorPosition {
	let editorColumn = EditorPosition.ONE;
	if (typeof column !== 'number') {
		// stick with ONE
	} else if (column === <number>types.ViewColumn.Two) {
		editorColumn = EditorPosition.TWO;
	} else if (column === <number>types.ViewColumn.Three) {
		editorColumn = EditorPosition.THREE;
	} else if (column === <number>types.ViewColumn.Active) {
		editorColumn = undefined;
	}
	return editorColumn;
}

export function toViewColumn(position?: EditorPosition): vscode.ViewColumn {
	if (typeof position !== 'number') {
		return undefined;
	}
	if (position === EditorPosition.ONE) {
		return <number>types.ViewColumn.One;
	} else if (position === EditorPosition.TWO) {
		return <number>types.ViewColumn.Two;
	} else if (position === EditorPosition.THREE) {
		return <number>types.ViewColumn.Three;
	}
	return undefined;
}

function isDecorationOptions(something: any): something is vscode.DecorationOptions {
	return (typeof something.range !== 'undefined');
}

export function isDecorationOptionsArr(something: vscode.Range[] | vscode.DecorationOptions[]): something is vscode.DecorationOptions[] {
	if (something.length === 0) {
		return true;
	}
	return isDecorationOptions(something[0]) ? true : false;
}

export namespace MarkdownString {

	export function fromMany(markup: (vscode.MarkdownString | vscode.MarkedString)[]): htmlContent.IMarkdownString[] {
		return markup.map(MarkdownString.from);
	}

	interface Codeblock {
		language: string;
		value: string;
	}

	function isCodeblock(thing: any): thing is Codeblock {
		return thing && typeof thing === 'object'
			&& typeof (<Codeblock>thing).language === 'string'
			&& typeof (<Codeblock>thing).value === 'string';
	}

	export function from(markup: vscode.MarkdownString | vscode.MarkedString): htmlContent.IMarkdownString {
		if (isCodeblock(markup)) {
			const { language, value } = markup;
			return { value: '```' + language + '\n' + value + '\n```\n' };
		} else if (htmlContent.isMarkdownString(markup)) {
			return markup;
		} else if (typeof markup === 'string') {
			return { value: <string>markup };
		} else {
			return { value: '' };
		}
	}
	export function to(value: htmlContent.IMarkdownString): vscode.MarkdownString {
		const ret = new htmlContent.MarkdownString(value.value);
		ret.isTrusted = value.isTrusted;
		return ret;
	}

	export function fromStrict(value: string | types.MarkdownString): undefined | string | htmlContent.IMarkdownString {
		if (!value) {
			return undefined;
		}
		return typeof value === 'string' ? value : MarkdownString.from(value);
	}
}

export function fromRangeOrRangeWithMessage(ranges: vscode.Range[] | vscode.DecorationOptions[]): IDecorationOptions[] {
	if (isDecorationOptionsArr(ranges)) {
		return ranges.map(r => {
			return {
				range: fromRange(r.range),
				hoverMessage: Array.isArray(r.hoverMessage) ? MarkdownString.fromMany(r.hoverMessage) : r.hoverMessage && MarkdownString.from(r.hoverMessage),
				renderOptions: <any> /* URI vs Uri */r.renderOptions
			};
		});
	} else {
		return ranges.map((r): IDecorationOptions => {
			return {
				range: fromRange(r)
			};
		});
	}
}

export const TextEdit = {

	from(edit: vscode.TextEdit): modes.TextEdit {
		return <modes.TextEdit>{
			text: edit.newText,
			eol: EndOfLine.from(edit.newEol),
			range: fromRange(edit.range)
		};
	},
	to(edit: modes.TextEdit): types.TextEdit {
		let result = new types.TextEdit(toRange(edit.range), edit.text);
		result.newEol = EndOfLine.to(edit.eol);
		return result;
	}
};

export namespace WorkspaceEdit {
	export function from(value: vscode.WorkspaceEdit): modes.WorkspaceEdit {
		const result: modes.WorkspaceEdit = {
			edits: []
		};
		for (const entry of value.entries()) {
			const [uri, uriOrEdits] = entry;
			if (Array.isArray(uriOrEdits)) {
				// text edits
				result.edits.push({ resource: uri, edits: uriOrEdits.map(TextEdit.from) });
			} else {
				// resource edits
				result.edits.push({ oldUri: uri, newUri: uriOrEdits });
			}
		}
		return result;
	}

	export function to(value: WorkspaceEditDto) {
		const result = new types.WorkspaceEdit();
		for (const edit of value.edits) {
			if (Array.isArray((<ResourceTextEditDto>edit).edits)) {
				result.set(
					URI.revive((<ResourceTextEditDto>edit).resource),
					<types.TextEdit[]>(<ResourceTextEditDto>edit).edits.map(TextEdit.to)
				);
				// } else {
				// 	result.renameResource(
				// 		URI.revive((<ResourceFileEditDto>edit).oldUri),
				// 		URI.revive((<ResourceFileEditDto>edit).newUri)
				// 	);
			}
		}
		return result;
	}
}


export namespace SymbolKind {

	const _fromMapping: { [kind: number]: modes.SymbolKind } = Object.create(null);
	_fromMapping[types.SymbolKind.File] = modes.SymbolKind.File;
	_fromMapping[types.SymbolKind.Module] = modes.SymbolKind.Module;
	_fromMapping[types.SymbolKind.Namespace] = modes.SymbolKind.Namespace;
	_fromMapping[types.SymbolKind.Package] = modes.SymbolKind.Package;
	_fromMapping[types.SymbolKind.Class] = modes.SymbolKind.Class;
	_fromMapping[types.SymbolKind.Method] = modes.SymbolKind.Method;
	_fromMapping[types.SymbolKind.Property] = modes.SymbolKind.Property;
	_fromMapping[types.SymbolKind.Field] = modes.SymbolKind.Field;
	_fromMapping[types.SymbolKind.Constructor] = modes.SymbolKind.Constructor;
	_fromMapping[types.SymbolKind.Enum] = modes.SymbolKind.Enum;
	_fromMapping[types.SymbolKind.Interface] = modes.SymbolKind.Interface;
	_fromMapping[types.SymbolKind.Function] = modes.SymbolKind.Function;
	_fromMapping[types.SymbolKind.Variable] = modes.SymbolKind.Variable;
	_fromMapping[types.SymbolKind.Constant] = modes.SymbolKind.Constant;
	_fromMapping[types.SymbolKind.String] = modes.SymbolKind.String;
	_fromMapping[types.SymbolKind.Number] = modes.SymbolKind.Number;
	_fromMapping[types.SymbolKind.Boolean] = modes.SymbolKind.Boolean;
	_fromMapping[types.SymbolKind.Array] = modes.SymbolKind.Array;
	_fromMapping[types.SymbolKind.Object] = modes.SymbolKind.Object;
	_fromMapping[types.SymbolKind.Key] = modes.SymbolKind.Key;
	_fromMapping[types.SymbolKind.Null] = modes.SymbolKind.Null;
	_fromMapping[types.SymbolKind.EnumMember] = modes.SymbolKind.EnumMember;
	_fromMapping[types.SymbolKind.Struct] = modes.SymbolKind.Struct;
	_fromMapping[types.SymbolKind.Event] = modes.SymbolKind.Event;
	_fromMapping[types.SymbolKind.Operator] = modes.SymbolKind.Operator;
	_fromMapping[types.SymbolKind.TypeParameter] = modes.SymbolKind.TypeParameter;

	export function from(kind: vscode.SymbolKind): modes.SymbolKind {
		return _fromMapping[kind] || modes.SymbolKind.Property;
	}

	export function to(kind: modes.SymbolKind): vscode.SymbolKind {
		for (let k in _fromMapping) {
			if (_fromMapping[k] === kind) {
				return Number(k);
			}
		}
		return types.SymbolKind.Property;
	}
}

export function fromSymbolInformation(info: vscode.SymbolInformation): modes.SymbolInformation {
	return <modes.SymbolInformation>{
		name: info.name,
		kind: SymbolKind.from(info.kind),
		containerName: info.containerName,
		location: location.from(info.location)
	};
}

export function toSymbolInformation(bearing: modes.SymbolInformation): types.SymbolInformation {
	return new types.SymbolInformation(
		bearing.name,
		SymbolKind.to(bearing.kind),
		bearing.containerName,
		location.to(bearing.location)
	);
}


export const location = {
	from(value: vscode.Location): modes.Location {
		return {
			range: value.range && fromRange(value.range),
			uri: value.uri
		};
	},
	to(value: modes.Location): types.Location {
		return new types.Location(value.uri, toRange(value.range));
	}
};

export function fromHover(hover: vscode.Hover): modes.Hover {
	return <modes.Hover>{
		range: fromRange(hover.range),
		contents: MarkdownString.fromMany(hover.contents)
	};
}

export function toHover(info: modes.Hover): types.Hover {
	return new types.Hover(info.contents.map(MarkdownString.to), toRange(info.range));
}

export function toDocumentHighlight(occurrence: modes.DocumentHighlight): types.DocumentHighlight {
	return new types.DocumentHighlight(toRange(occurrence.range), occurrence.kind);
}

export namespace CompletionTriggerKind {
	export function from(kind: modes.SuggestTriggerKind) {
		switch (kind) {
			case modes.SuggestTriggerKind.TriggerCharacter:
				return types.CompletionTriggerKind.TriggerCharacter;
			case modes.SuggestTriggerKind.TriggerForIncompleteCompletions:
				return types.CompletionTriggerKind.TriggerForIncompleteCompletions;
			case modes.SuggestTriggerKind.Invoke:
			default:
				return types.CompletionTriggerKind.Invoke;
		}
	}
}

export namespace CompletionContext {
	export function from(context: modes.SuggestContext): types.CompletionContext {
		return {
			triggerKind: CompletionTriggerKind.from(context.triggerKind),
			triggerCharacter: context.triggerCharacter
		};
	}
}

export const CompletionItemKind = {

	from(kind: types.CompletionItemKind): modes.SuggestionType {
		switch (kind) {
			case types.CompletionItemKind.Method: return 'method';
			case types.CompletionItemKind.Function: return 'function';
			case types.CompletionItemKind.Constructor: return 'constructor';
			case types.CompletionItemKind.Field: return 'field';
			case types.CompletionItemKind.Variable: return 'variable';
			case types.CompletionItemKind.Class: return 'class';
			case types.CompletionItemKind.Interface: return 'interface';
			case types.CompletionItemKind.Struct: return 'struct';
			case types.CompletionItemKind.Module: return 'module';
			case types.CompletionItemKind.Property: return 'property';
			case types.CompletionItemKind.Unit: return 'unit';
			case types.CompletionItemKind.Value: return 'value';
			case types.CompletionItemKind.Constant: return 'constant';
			case types.CompletionItemKind.Enum: return 'enum';
			case types.CompletionItemKind.EnumMember: return 'enum-member';
			case types.CompletionItemKind.Keyword: return 'keyword';
			case types.CompletionItemKind.Snippet: return 'snippet';
			case types.CompletionItemKind.Text: return 'text';
			case types.CompletionItemKind.Color: return 'color';
			case types.CompletionItemKind.File: return 'file';
			case types.CompletionItemKind.Reference: return 'reference';
			case types.CompletionItemKind.Folder: return 'folder';
			case types.CompletionItemKind.Event: return 'event';
			case types.CompletionItemKind.Operator: return 'operator';
			case types.CompletionItemKind.TypeParameter: return 'type-parameter';
		}
		return 'property';
	},

	to(type: modes.SuggestionType): types.CompletionItemKind {
		if (!type) {
			return types.CompletionItemKind.Property;
		} else {
			return types.CompletionItemKind[type.charAt(0).toUpperCase() + type.substr(1)];
		}
	}
};

export namespace Suggest {

	export function to(position: types.Position, suggestion: modes.ISuggestion): types.CompletionItem {
		const result = new types.CompletionItem(suggestion.label);
		result.insertText = suggestion.insertText;
		result.kind = CompletionItemKind.to(suggestion.type);
		result.detail = suggestion.detail;
		result.documentation = htmlContent.isMarkdownString(suggestion.documentation) ? MarkdownString.to(suggestion.documentation) : suggestion.documentation;
		result.sortText = suggestion.sortText;
		result.filterText = suggestion.filterText;

		// 'overwrite[Before|After]'-logic
		let overwriteBefore = (typeof suggestion.overwriteBefore === 'number') ? suggestion.overwriteBefore : 0;
		let startPosition = new types.Position(position.line, Math.max(0, position.character - overwriteBefore));
		let endPosition = position;
		if (typeof suggestion.overwriteAfter === 'number') {
			endPosition = new types.Position(position.line, position.character + suggestion.overwriteAfter);
		}
		result.range = new types.Range(startPosition, endPosition);

		// 'inserText'-logic
		if (suggestion.snippetType === 'textmate') {
			result.insertText = new types.SnippetString(suggestion.insertText);
		} else {
			result.insertText = suggestion.insertText;
			result.textEdit = new types.TextEdit(result.range, result.insertText);
		}

		// TODO additionalEdits, command

		return result;
	}
}

export namespace ParameterInformation {
	export function from(info: types.ParameterInformation): modes.ParameterInformation {
		return {
			label: info.label,
			documentation: MarkdownString.fromStrict(info.documentation)
		};
	}
	export function to(info: modes.ParameterInformation): types.ParameterInformation {
		return {
			label: info.label,
			documentation: htmlContent.isMarkdownString(info.documentation) ? MarkdownString.to(info.documentation) : info.documentation
		};
	}
}

export namespace SignatureInformation {

	export function from(info: types.SignatureInformation): modes.SignatureInformation {
		return {
			label: info.label,
			documentation: MarkdownString.fromStrict(info.documentation),
			parameters: info.parameters && info.parameters.map(ParameterInformation.from)
		};
	}

	export function to(info: modes.SignatureInformation): types.SignatureInformation {
		return {
			label: info.label,
			documentation: htmlContent.isMarkdownString(info.documentation) ? MarkdownString.to(info.documentation) : info.documentation,
			parameters: info.parameters && info.parameters.map(ParameterInformation.to)
		};
	}
}

export namespace SignatureHelp {

	export function from(help: types.SignatureHelp): modes.SignatureHelp {
		return {
			activeSignature: help.activeSignature,
			activeParameter: help.activeParameter,
			signatures: help.signatures && help.signatures.map(SignatureInformation.from)
		};
	}

	export function to(help: modes.SignatureHelp): types.SignatureHelp {
		return {
			activeSignature: help.activeSignature,
			activeParameter: help.activeParameter,
			signatures: help.signatures && help.signatures.map(SignatureInformation.to)
		};
	}
}

export namespace DocumentLink {

	export function from(link: vscode.DocumentLink): modes.ILink {
		return {
			range: fromRange(link.range),
			url: link.target && link.target.toString()
		};
	}

	export function to(link: modes.ILink): vscode.DocumentLink {
		return new types.DocumentLink(toRange(link.range), link.url && URI.parse(link.url));
	}
}

export namespace ColorPresentation {
	export function to(colorPresentation: modes.IColorPresentation): types.ColorPresentation {
		let cp = new types.ColorPresentation(colorPresentation.label);
		if (colorPresentation.textEdit) {
			cp.textEdit = TextEdit.to(colorPresentation.textEdit);
		}
		if (colorPresentation.additionalTextEdits) {
			cp.additionalTextEdits = colorPresentation.additionalTextEdits.map(value => TextEdit.to(value));
		}
		return cp;
	}

	export function from(colorPresentation: vscode.ColorPresentation): modes.IColorPresentation {
		return {
			label: colorPresentation.label,
			textEdit: colorPresentation.textEdit ? TextEdit.from(colorPresentation.textEdit) : undefined,
			additionalTextEdits: colorPresentation.additionalTextEdits ? colorPresentation.additionalTextEdits.map(value => TextEdit.from(value)) : undefined
		};
	}
}

export namespace Color {
	export function to(c: [number, number, number, number]): types.Color {
		return new types.Color(c[0], c[1], c[2], c[3]);
	}
	export function from(color: types.Color): [number, number, number, number] {
		return [color.red, color.green, color.blue, color.alpha];
	}
}

export namespace TextDocumentSaveReason {

	export function to(reason: SaveReason): vscode.TextDocumentSaveReason {
		switch (reason) {
			case SaveReason.AUTO:
				return types.TextDocumentSaveReason.AfterDelay;
			case SaveReason.EXPLICIT:
				return types.TextDocumentSaveReason.Manual;
			case SaveReason.FOCUS_CHANGE:
			case SaveReason.WINDOW_CHANGE:
				return types.TextDocumentSaveReason.FocusOut;
		}
	}
}


export namespace EndOfLine {

	export function from(eol: vscode.EndOfLine): EndOfLineSequence {
		if (eol === types.EndOfLine.CRLF) {
			return EndOfLineSequence.CRLF;
		} else if (eol === types.EndOfLine.LF) {
			return EndOfLineSequence.LF;
		}
		return undefined;
	}

	export function to(eol: EndOfLineSequence): vscode.EndOfLine {
		if (eol === EndOfLineSequence.CRLF) {
			return types.EndOfLine.CRLF;
		} else if (eol === EndOfLineSequence.LF) {
			return types.EndOfLine.LF;
		}
		return undefined;
	}
}

export namespace ProgressLocation {
	export function from(loc: vscode.ProgressLocation): MainProgressLocation {
		switch (loc) {
			case types.ProgressLocation.SourceControl: return MainProgressLocation.Scm;
			case types.ProgressLocation.Window: return MainProgressLocation.Window;
			case types.ProgressLocation.Notification: return MainProgressLocation.Notification;
		}
		return undefined;
	}
}

export namespace FoldingRange {
	export function from(r: vscode.FoldingRange): modes.FoldingRange {
		let range: modes.FoldingRange = { start: r.start + 1, end: r.end + 1 };
		if (r.kind) {
			range.kind = FoldingRangeKind.from(r.kind);
		}
		return range;
	}
}

export namespace FoldingRangeKind {
	export function from(kind: vscode.FoldingRangeKind | undefined): modes.FoldingRangeKind | undefined {
		if (kind) {
			switch (kind) {
				case types.FoldingRangeKind.Comment:
					return modes.FoldingRangeKind.Comment;
				case types.FoldingRangeKind.Imports:
					return modes.FoldingRangeKind.Imports;
				case types.FoldingRangeKind.Region:
					return modes.FoldingRangeKind.Region;
			}
		}
		return void 0;
	}
}

export function toTextEditorOptions(options?: vscode.TextDocumentShowOptions): ITextEditorOptions {
	if (options) {
		return {
			pinned: typeof options.preview === 'boolean' ? !options.preview : undefined,
			preserveFocus: options.preserveFocus,
			selection: typeof options.selection === 'object' ? fromRange(options.selection) : undefined
		} as ITextEditorOptions;
	}

	return undefined;
}

export function toGlobPattern(pattern: vscode.GlobPattern): string | IRelativePattern {
	if (typeof pattern === 'string') {
		return pattern;
	}

	if (isRelativePattern(pattern)) {
		return new types.RelativePattern(pattern.base, pattern.pattern);
	}

	return pattern; // preserve `undefined` and `null`
}

function isRelativePattern(obj: any): obj is vscode.RelativePattern {
	const rp = obj as vscode.RelativePattern;

	return rp && typeof rp.base === 'string' && typeof rp.pattern === 'string';
}

export function toLanguageSelector(selector: vscode.DocumentSelector): LanguageSelector {
	if (Array.isArray(selector)) {
		return selector.map(sel => doToLanguageSelector(sel));
	}

	return doToLanguageSelector(selector);
}

function doToLanguageSelector(selector: string | vscode.DocumentFilter): string | LanguageFilter {
	if (typeof selector === 'string') {
		return selector;
	}

	if (selector) {
		return {
			language: selector.language,
			scheme: selector.scheme,
			pattern: toGlobPattern(selector.pattern),
			exclusive: selector.exclusive
		};
	}

	return undefined;
}
