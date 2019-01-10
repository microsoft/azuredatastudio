/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Note: the code in the v3 and v4 namespaces has been adapted (with significant changes) from https://github.com/nteract/nteract/tree/master/packages/commutable

'use strict';

import { nb } from 'sqlops';

import * as json from 'vs/base/common/json';
import * as pfs from 'vs/base/node/pfs';
import URI from 'vs/base/common/uri';
import { localize } from 'vs/nls';
import { JSONObject } from 'sql/parts/notebook/models/jsonext';

import ContentManager = nb.ContentManager;
import { OutputTypes } from 'sql/parts/notebook/models/contracts';

type MimeBundle = { [key: string]: string | string[] | undefined };

export class LocalContentManager implements ContentManager {
	public async getNotebookContents(notebookUri: URI): Promise<nb.INotebookContents> {
		if (!notebookUri) {
			return undefined;
		}
		// TODO validate this is an actual file URI, and error if not
		let path = notebookUri.fsPath;
		// Note: intentionally letting caller handle exceptions
		let notebookFileBuffer = await pfs.readFile(path);
		let contents: JSONObject = json.parse(notebookFileBuffer.toString());

		if (contents) {
			if (contents.nbformat === 4) {
				return v4.readNotebook(<any>contents);
			} else if (contents.nbformat === 3) {
				return v3.readNotebook(<any>contents);
			}
			if (contents.nbformat) {
				throw new TypeError(localize('nbformatNotRecognized', 'nbformat v{0}.{1} not recognized', contents.nbformat, contents.nbformat_minor));
			}
		}
		// else, fallthrough condition
		throw new TypeError(localize('nbNotSupported', 'This notebook format is not supported'));

	}

	public async save(notebookUri: URI, notebook: nb.INotebookContents): Promise<nb.INotebookContents> {
		// Convert to JSON with pretty-print functionality
		let contents = JSON.stringify(notebook, undefined, '    ');
		let path = notebookUri.fsPath;
		await pfs.writeFile(path, contents);
		return notebook;
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

		for (let cell of contents.cells) {
			notebook.cells.push(readCell(cell));
		}

		return notebook;
	}
	function readCell(cell: nb.ICellContents): nb.ICellContents {
		switch (cell.cell_type) {
			case 'markdown':
			case 'raw':
				return createDefaultCell(cell);
			case 'code':
				return createCodeCell(cell);
			default:
			  throw new TypeError(localize('unknownCellType', 'Cell type {0} unknown', cell.cell_type));
		  }
	}

	function createDefaultCell(cell: nb.ICellContents): nb.ICellContents {
		return {
			cell_type: cell.cell_type,
			source: demultiline(cell.source),
			metadata: cell.metadata
		};
	}
	function createCodeCell(cell: nb.ICellContents): nb.ICellContents {
		return {
			cell_type: cell.cell_type,
			source: demultiline(cell.source),
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
				return <nb.IExecuteResult> {
					output_type: output.output_type,
					execution_count: output.execution_count,
					data: createMimeBundle(output.data),
					metadata: output.metadata
				};
			case OutputTypes.DisplayData:
			case OutputTypes.UpdateDisplayData:
				return <nb.IDisplayResult> {
					output_type: output.output_type,
					data: createMimeBundle(output.data),
					metadata: output.metadata
				};
			case 'stream':
				return <nb.IStreamResult> {
					output_type: output.output_type,
					name: output.name,
					text: demultiline(output.text)
				};
			case 'error':
				return <nb.IErrorResult> {
					output_type: 'error',
					ename: output.ename,
					evalue: output.evalue,
					// Note: this is one of the cases where the Array of strings (for
					// traceback) is part of the format, not a multiline string
					traceback: output.traceback
				};
			default:
				// Should never get here
				throw new TypeError(localize('unrecognizedOutput', 'Output type {0} not recognized', (<any>output).output_type));
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
	function cleanMimeData(key: string, data: string | string[] | undefined) {
		// See https://github.com/jupyter/nbformat/blob/62d6eb8803616d198eaa2024604d1fe923f2a7b3/nbformat/v4/nbformat.v4.schema.json#L368
		if (isJSONKey(key)) {
			// Data stays as is for JSON types
			return data;
		}

		if (typeof data === 'string' || Array.isArray(data)) {
			return demultiline(data);
		}

		throw new TypeError(localize('invalidMimeData', 'Data for {0} is expected to be a string or an Array of strings', key));
	}

	function demultiline(value: nb.MultilineString): string {
		return Array.isArray(value) ? value.join('') : value;
	}

	function isJSONKey(key: string): boolean {
		return /^application\/(.*\+)?json$/.test(key);
	}
}

namespace v3 {

	export function readNotebook(contents: nb.INotebookContents): nb.INotebookContents {
		// TODO will add v3 support in future update
		throw new TypeError(localize('nbNotSupported', 'This notebook format is not supported'));
	}
}
