/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


export type CellType = 'code' | 'markdown' | 'raw';

export class CellTypes {
	public static readonly Code = 'code';
	public static readonly Markdown = 'markdown';
	public static readonly Raw = 'raw';
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
	TrustChanged,
	Saved,
	CellExecuted,
	CellOutputCleared
}
