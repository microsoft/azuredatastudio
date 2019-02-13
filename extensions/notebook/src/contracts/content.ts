/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

export interface INotebook {

	readonly cells: ICell[];
	readonly metadata: INotebookMetadata;
	readonly nbformat: number;
	readonly nbformat_minor: number;
}

export interface INotebookMetadata {
	kernelspec: IKernelInfo;
	language_info?: ILanguageInfo;
}

export interface IKernelInfo {
	name: string;
	language?: string;
	display_name?: string;
}

export interface ILanguageInfo {
	name: string;
	version: string;
	mimetype?: string;
	codemirror_mode?: string | ICodeMirrorMode;
}

export interface ICodeMirrorMode {
	name: string;
	version: string;
}

export interface ICell {
	cell_type: CellType;
	source: string | string[];
	metadata: {
		language?: string;
	};
	execution_count: number;
	outputs?: ICellOutput[];
}

export type CellType = 'code' | 'markdown' | 'raw';

export class CellTypes {
	public static readonly Code = 'code';
	public static readonly Markdown = 'markdown';
	public static readonly Raw = 'raw';
}

export interface ICellOutput {
	output_type: OutputType;
}

export type OutputType =
	| 'execute_result'
	| 'display_data'
	| 'stream'
	| 'error'
	| 'update_display_data';
