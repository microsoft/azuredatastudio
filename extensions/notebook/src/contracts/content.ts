/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

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

export interface IJupyterBookToc {
	sections: IJupyterBookSection[];
}

/**
 * A section of a Jupyter book.
 *
 * This is taken from https://github.com/jupyter/jupyter-book/blob/master/jupyter_book/book_template/_data/toc.yml but is not
 * enforced so invalid JSON may result in expected values being undefined.
 */
export interface IJupyterBookSection {
	/**
	 * Title of chapter or section
	 */
	title?: string;
	/**
	 * URL of section relative to the /content/ folder.
	 */
	url?: string;
	/**
	 * Contains a list of more entries that make up the chapter's/section's sub-sections
	 */
	sections?: IJupyterBookSection[];
	/**
	 * If the section shouldn't have a number in the sidebar
	 */
	not_numbered?: string;
	/**
	 * If you'd like the sections of this chapter to always be expanded in the sidebar.
	 */
	expand_sections?: boolean;
	/**
	 * Whether the URL is an external link or points to content in the book
	 */
	external?: boolean;

	// Below are some special values that trigger specific behavior:

	/**
	 * Will provide a link to a search page
	 */
	search?: boolean;
	/**
	 * Will insert a divider in the sidebar
	 */
	divider?: boolean;
	/**
	 * Will insert a header with no link in the sidebar
	 */
	header?: boolean;
}
