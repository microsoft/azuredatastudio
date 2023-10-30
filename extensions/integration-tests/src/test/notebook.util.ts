/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const NBFORMAT = 4;
const NBFORMAT_MINOR = 2;

export class CellTypes {
	public static readonly Code = 'code';
	public static readonly Markdown = 'markdown';
	public static readonly Raw = 'raw';
}

export const pythonNotebookContent: azdata.nb.INotebookContents = {
	cells: [{
		cell_type: CellTypes.Code,
		source: '1+1',
		metadata: { language: 'python' },
		execution_count: 1
	}],
	metadata: {
		kernelspec: {
			name: 'python3',
			display_name: 'Python 3'
		}
	},
	nbformat: NBFORMAT,
	nbformat_minor: NBFORMAT_MINOR
};

export const notebookContentForCellLanguageTest: azdata.nb.INotebookContents = {
	cells: [{
		cell_type: CellTypes.Code,
		source: '1+1',
		metadata: {},
		execution_count: 1
	}],
	metadata: {
		kernelspec: {
			name: '',
			display_name: ''
		},
	},
	nbformat: NBFORMAT,
	nbformat_minor: NBFORMAT_MINOR
};

export const pythonNotebookMultipleCellsContent: azdata.nb.INotebookContents = {
	cells: [{
		cell_type: CellTypes.Code,
		source: '1+1',
		metadata: { language: 'python' },
		execution_count: 1
	}, {
		cell_type: CellTypes.Code,
		source: '1+2',
		metadata: { language: 'python' },
		execution_count: 1
	}, {
		cell_type: CellTypes.Code,
		source: '1+3',
		metadata: { language: 'python' },
		execution_count: 1
	}, {
		cell_type: CellTypes.Code,
		source: '1+4',
		metadata: { language: 'python' },
		execution_count: 1
	}],
	metadata: {
		kernelspec: {
			name: 'python3',
			display_name: 'Python 3'
		}
	},
	nbformat: NBFORMAT,
	nbformat_minor: NBFORMAT_MINOR
};

export const sqlNotebookContent: azdata.nb.INotebookContents = {
	cells: [{
		cell_type: CellTypes.Code,
		source: 'select 1',
		metadata: { language: 'sql' },
		execution_count: 1
	}],
	metadata: {
		kernelspec: {
			name: 'SQL',
			display_name: 'SQL'
		}
	},
	nbformat: NBFORMAT,
	nbformat_minor: NBFORMAT_MINOR
};

export const sqlNotebookMultipleCellsContent: azdata.nb.INotebookContents = {
	cells: [{
		cell_type: CellTypes.Code,
		source: 'select 0',
		metadata: { language: 'sql' },
		execution_count: 1
	}, {
		cell_type: CellTypes.Code,
		source: `WAITFOR DELAY '00:00:02'\nselect 1`,
		metadata: { language: 'sql' },
		execution_count: 1
	}, {
		cell_type: CellTypes.Code,
		source: 'select 2',
		metadata: { language: 'sql' },
		execution_count: 1
	}],
	metadata: {
		kernelspec: {
			name: 'SQL',
			display_name: 'SQL'
		}
	},
	nbformat: NBFORMAT,
	nbformat_minor: NBFORMAT_MINOR
};

export const sqlKernelMetadata = {
	kernelspec: {
		name: 'SQL',
		display_name: 'SQL'
	}
};

export const sqlKernelSpec: azdata.nb.IKernelSpec = {
	name: 'SQL',
	display_name: 'SQL'
};

export const pythonKernelMetadata = {
	kernelspec: {
		name: 'python3',
		display_name: 'Python 3'
	}
};

export const pythonKernelSpec: azdata.nb.IKernelSpec = {
	name: 'python3',
	display_name: 'Python 3'
};

export const powershellKernelSpec: azdata.nb.IKernelSpec = {
	name: 'powershell',
	display_name: 'PowerShell'
};

export function writeNotebookToFile(pythonNotebook: azdata.nb.INotebookContents, relativeFilePath: string): vscode.Uri {
	let fileName = getTempFilePath(relativeFilePath);
	let notebookContentString = JSON.stringify(pythonNotebook);
	// eslint-disable-next-line no-sync
	fs.mkdirSync(path.dirname(fileName), { recursive: true });
	// eslint-disable-next-line no-sync
	fs.writeFileSync(fileName, notebookContentString);
	console.log(`Local file is created: '${fileName}'`);
	let uri = vscode.Uri.file(fileName);
	return uri;
}

/**
 * Creates the path of a file in the temp directory
 * @param relativeFilePath The relative path of the file in the temp directory
 * @returns The full path of the file
 */
export function getTempFilePath(relativeFilePath: string): string {
	return path.join(os.tmpdir(), relativeFilePath + '.ipynb');
}
