/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Note: the code in the v3 and v4 namespaces has been adapted (with significant changes) from https://github.com/nteract/nteract/tree/master/packages/commutable

import { nb } from 'azdata';

import * as json from 'vs/base/common/json';
import { URI } from 'vs/base/common/uri';
import { localize } from 'vs/nls';
import { IFileService } from 'vs/platform/files/common/files';

import { JSONObject } from 'sql/workbench/services/notebook/common/jsonext';
import { OutputTypes } from 'sql/workbench/services/notebook/common/contracts';
import { nbversion } from 'sql/workbench/services/notebook/common/notebookConstants';
import { nbformat } from 'sql/workbench/services/notebook/common/nbformat';
import { VSBuffer } from 'vs/base/common/buffer';

type MimeBundle = { [key: string]: string | string[] | undefined };

export class LocalContentManager implements nb.ContentManager {

	constructor(@IFileService private readonly fileService: IFileService) { }

	public async loadFromContentString(contentString: string): Promise<nb.INotebookContents> {
		let contents: JSONObject;
		if (contentString === '' || contentString === undefined) {
			return v4.createEmptyNotebook();
		} else {
			contents = this.parseFromJson(contentString);
		}
		if (contents) {
			if (contents.nbformat === 4) {
				return v4.readNotebook(<any>contents);
			} else if (contents.nbformat === 3) {
				return v3.readNotebook(<any>contents);
			}
			if (contents.nbformat) {
				throw new TypeError(localize('nbformatNotRecognized', "nbformat v{0}.{1} not recognized", contents.nbformat as any, contents.nbformat_minor as any));
			}
		}

		// else, fallthrough condition
		throw new TypeError(localize('nbNotSupported', "This file does not have a valid notebook format"));

	}

	public async getNotebookContents(notebookUri: URI): Promise<nb.INotebookContents> {
		if (!notebookUri) {
			return undefined;
		}
		// Note: intentionally letting caller handle exceptions
		let notebookFileBuffer = await this.fileService.readFile(notebookUri);
		let stringContents = notebookFileBuffer.value.toString();
		let contents: JSONObject;
		if (stringContents === '' || stringContents === undefined) {
			// Empty?
			return v4.createEmptyNotebook();
		} else {
			contents = this.parseFromJson(stringContents);
		}

		if (contents) {
			if (contents.nbformat === 4) {
				return v4.readNotebook(<any>contents);
			} else if (contents.nbformat === 3) {
				return v3.readNotebook(<any>contents);
			}
			if (contents.nbformat) {
				throw new TypeError(localize('nbformatNotRecognized', "nbformat v{0}.{1} not recognized", contents.nbformat as any, contents.nbformat_minor as any));
			}
		}

		// else, fallthrough condition
		throw new TypeError(localize('nbNotSupported', "This file does not have a valid notebook format"));

	}

	public async save(notebookUri: URI, notebook: nb.INotebookContents): Promise<nb.INotebookContents> {
		// Convert to JSON with pretty-print functionality
		let contents = JSON.stringify(notebook, undefined, '    ');
		await this.fileService.writeFile(notebookUri, VSBuffer.fromString(contents));
		return notebook;
	}

	private parseFromJson(contentString: string): JSONObject {
		let contents: JSONObject;
		try {
			contents = JSON.parse(contentString);
		} catch {
			contents = json.parse(contentString);
		}
		return contents;
	}
}

namespace v4 {
	export function readNotebook(contents: nb.INotebookContents): nb.INotebookContents {
		let notebook: nb.INotebookContents = {
			cells: [],
			metadata: contents.metadata,
			nbformat: 4,
			nbformat_minor: contents.nbformat_minor
		};

		if (contents.cells) {
			for (let cell of contents.cells) {
				notebook.cells.push(readCell(cell));
			}
		}

		return notebook;
	}

	export function createEmptyNotebook(): nb.INotebookContents {
		return {
			cells: [],
			metadata: undefined,
			nbformat: nbformat.MAJOR_VERSION,
			nbformat_minor: nbformat.MINOR_VERSION
		};
	}

	function readCell(cell: nb.ICellContents): nb.ICellContents {
		switch (cell.cell_type) {
			case 'markdown':
			case 'raw':
				return createDefaultCell(cell);
			case 'code':
				return createCodeCell(cell);
			default:
				throw new TypeError(localize('unknownCellType', "Cell type {0} unknown", cell.cell_type));
		}
	}

	export function createDefaultCell(cell: nb.ICellContents): nb.ICellContents {
		return {
			cell_type: cell.cell_type,
			source: cell.source,
			metadata: cell.metadata
		};
	}

	function createCodeCell(cell: nb.ICellContents): nb.ICellContents {
		return {
			cell_type: cell.cell_type,
			source: cell.source,
			metadata: cell.metadata,
			execution_count: cell.execution_count,
			outputs: createOutputs(cell)
		};
	}

	function createOutputs(cell: nb.ICellContents): nb.ICellOutput[] {
		return cell.outputs && cell.outputs.length > 0 ? cell.outputs.map(output => createOutput(output as nb.Output)) : [];
	}

	function createOutput(output: nb.Output): nb.ICellOutput {
		switch (output.output_type) {
			case OutputTypes.ExecuteResult:
				return <nb.IExecuteResult>{
					output_type: output.output_type,
					execution_count: output.execution_count,
					data: createMimeBundle(output.data),
					metadata: output.metadata
				};
			case OutputTypes.DisplayData:
			case OutputTypes.UpdateDisplayData:
				return <nb.IDisplayResult>{
					output_type: output.output_type,
					data: createMimeBundle(output.data),
					metadata: output.metadata
				};
			case 'stream':
				return <nb.IStreamResult>{
					output_type: output.output_type,
					name: output.name,
					text: demultiline(output.text)
				};
			case 'error':
				return <nb.IErrorResult>{
					output_type: 'error',
					ename: output.ename,
					evalue: output.evalue,
					// Note: this is one of the cases where the Array of strings (for
					// traceback) is part of the format, not a multiline string
					traceback: output.traceback
				};
			default:
				// Should never get here
				throw new TypeError(localize('unrecognizedOutput', "Output type {0} not recognized", (<any>output).output_type));
		}
	}

	function createMimeBundle(oldMimeBundle: MimeBundle): MimeBundle {
		let mimeBundle: MimeBundle = {};
		for (let key of Object.keys(oldMimeBundle)) {
			mimeBundle[key] = cleanMimeData(key, oldMimeBundle[key]);
		}
		return mimeBundle;
	}

	/**
	 * Cleans mimedata, primarily converts an array of strings into a single string
	 * joined by newlines.
	 *
	 * @param key The key, usually a mime type, that is associated with the mime data.
	 * @param data The mime data to clean.
	 *
	 * @returns The cleaned mime data.
	 */
	export function cleanMimeData(key: string, data: string | string[] | undefined) {
		// See https://github.com/jupyter/nbformat/blob/62d6eb8803616d198eaa2024604d1fe923f2a7b3/nbformat/v4/nbformat.v4.schema.json#L368
		if (isJSONKey(key)) {
			// Data stays as is for JSON types
			return data;
		}

		if (typeof data === 'string' || Array.isArray(data)) {
			return demultiline(data);
		}

		throw new TypeError(localize('invalidMimeData', "Data for {0} is expected to be a string or an Array of strings", key));
	}

	export function demultiline(value: nb.MultilineString): string {
		return Array.isArray(value) ? value.join('') : value;
	}

	function isJSONKey(key: string): boolean {
		return /^application\/(.*\+)?json$/.test(key);
	}
}

namespace v3 {

	export function readNotebook(contents: Notebook): nb.INotebookContents {
		let notebook: nb.INotebookContents = {
			cells: [],
			metadata: contents.metadata,
			// Note: upgrading to v4 as we're converting to our codebase
			nbformat: 4,
			nbformat_minor: nbversion.MINOR_VERSION
		};

		if (contents.worksheets) {
			for (let worksheet of contents.worksheets) {
				if (worksheet.cells) {
					notebook.cells.push(...worksheet.cells.map(cell => createCell(cell)));
				}
			}
		}

		return notebook;
	}

	function createCell(cell: Cell): nb.ICellContents {
		switch (cell.cell_type) {
			case 'markdown':
			case 'raw':
				return v4.createDefaultCell(cell);
			case 'code':
				return createCodeCell(cell as CodeCell);
			case 'heading':
				return createHeadingCell(cell);
			default:
				throw new TypeError(`Cell type ${(cell as any).cell_type} unknown`);
		}
	}


	function createMimeBundle(oldMimeBundle: MimeOutput): MimeBundle {
		let mimeBundle: MimeBundle = {};
		for (let key of Object.keys(oldMimeBundle)) {
			// v3 had non-media types for rich media
			if (key in VALID_MIMETYPES) {
				let newKey = VALID_MIMETYPES[key as MimeTypeKey];
				mimeBundle[newKey] = v4.cleanMimeData(newKey, oldMimeBundle[key]);
			}
		}
		return mimeBundle;
	}

	const createOutput = (output: Output): nb.ICellOutput => {
		switch (output.output_type) {
			case 'pyout':
				return <nb.IExecuteResult>{
					output_type: OutputTypes.ExecuteResult,
					execution_count: output.prompt_number,
					data: createMimeBundle(output),
					metadata: output.metadata
				};
			case 'display_data':
				return <nb.IDisplayData>{
					output_type: OutputTypes.DisplayData,
					data: createMimeBundle(output),
					metadata: output.metadata
				};
			case 'stream':
				// Default to stdout in all cases unless it's stderr
				const name = output.stream === 'stderr' ? 'stderr' : 'stdout';
				return <nb.IStreamResult>{
					output_type: OutputTypes.Stream,
					name: name,
					text: v4.demultiline(output.text)
				};
			case 'pyerr':
				return <nb.IErrorResult>{
					output_type: OutputTypes.Error,
					ename: output.ename,
					evalue: output.evalue,
					traceback: output.traceback
				};
			default:
				throw new TypeError(localize('unrecognizedOutputType', "Output type {0} not recognized", output.output_type));
		}
	};

	function createCodeCell(cell: CodeCell): nb.ICellContents {
		return <nb.ICellContents>{
			cell_type: cell.cell_type,
			source: v4.demultiline(cell.input),
			outputs: cell.outputs.map(createOutput),
			execution_count: cell.prompt_number,
			metadata: cell.metadata
		};
	}

	function createHeadingCell(cell: HeadingCell): nb.ICellContents {
		// v3 heading cells are just markdown cells in v4+
		return <nb.ICellContents>{
			cell_type: 'markdown',
			source: Array.isArray(cell.source)
				? v4.demultiline(
					cell.source.map(line =>
						Array(cell.level)
							.join('#')
							.concat(' ')
							.concat(line)
					)
				)
				: cell.source,
			metadata: cell.metadata
		};
	}

	const VALID_MIMETYPES = {
		text: 'text/plain',
		latex: 'text/latex',
		png: 'image/png',
		jpeg: 'image/jpeg',
		svg: 'image/svg+xml',
		html: 'text/html',
		javascript: 'application/x-javascript',
		json: 'application/javascript',
		pdf: 'application/pdf'
	};
	type MimeTypeKey = keyof typeof VALID_MIMETYPES;
	type MimePayload = { [P in MimeTypeKey]?: nb.MultilineString };

	interface MimeOutput<T extends string = string> extends MimePayload {
		output_type: T;
		prompt_number?: number;
		metadata: object;
	}

	export interface ExecuteResult extends MimeOutput<'pyout'> { }
	export interface DisplayData extends MimeOutput<'display_data'> { }

	export interface StreamOutput {
		output_type: 'stream';
		stream: string;
		text: nb.MultilineString;
	}

	export interface ErrorOutput {
		output_type: 'error' | 'pyerr';
		ename: string;
		evalue: string;
		traceback: string[];
	}

	export type Output = ExecuteResult | DisplayData | StreamOutput | ErrorOutput;

	export interface HeadingCell {
		cell_type: 'heading';
		metadata: JSONObject;
		source: nb.MultilineString;
		level: number;
	}

	export interface CodeCell {
		cell_type: 'code';
		language: string;
		collapsed: boolean;
		metadata: JSONObject;
		input: nb.MultilineString;
		prompt_number: number;
		outputs: Array<Output>;
	}

	export type Cell = nb.ICellContents | HeadingCell | CodeCell;

	export interface Worksheet {
		cells: Cell[];
		metadata: object;
	}

	export interface Notebook {
		worksheets: Worksheet[];
		metadata: nb.INotebookMetadata;
		nbformat: 3;
		nbformat_minor: number;
	}
}
