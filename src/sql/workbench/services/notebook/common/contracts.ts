/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';

export type CellType = 'code' | 'markdown' | 'raw';

export class CellTypes {
	public static readonly Code = 'code';
	public static readonly Markdown = 'markdown';
}

// to do: add all mime types
export type MimeType = 'text/plain' | 'text/html';

// to do: add all mime types
export class MimeTypes {
	public static readonly PlainText = 'text/plain';
	public static readonly HTML = 'text/html';
}

export type OutputType =
	| 'execute_result'
	| 'display_data'
	| 'stream'
	| 'error'
	| 'update_display_data';

export class OutputTypes {
	public static readonly ExecuteResult = 'execute_result';
	public static readonly DisplayData = 'display_data';
	public static readonly Stream = 'stream';
	public static readonly Error = 'error';
	public static readonly UpdateDisplayData = 'update_display_data';
}

export enum NotebookChangeType {
	CellsModified,
	CellSourceUpdated,
	CellOutputUpdated,
	DirtyStateChanged,
	KernelChanged,
	MetadataChanged,
	TrustChanged,
	Saved,
	CellExecutionStarted,
	CellExecuted,
	CellInputVisibilityChanged,
	CellAwaitingInput,
	CellOutputCleared,
	CellMetadataUpdated
}

export const ImageMimeTypes = ['image/bmp', 'image/png', 'image/jpeg', 'image/gif'];

export class TextCellEditModes {
	public static readonly RichText = localize('notebook.richTextEditMode', 'Rich Text');
	public static readonly SplitView = localize('notebook.splitViewEditMode', 'Split View');
	public static readonly Markdown = localize('notebook.markdownEditMode', 'Markdown');
}
