/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'mocha';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export class CellTypes {
	public static readonly Code = 'code';
	public static readonly Markdown = 'markdown';
	public static readonly Raw = 'raw';
}

export const pySparkNotebookContent: azdata.nb.INotebookContents = {
	cells: [{
		cell_type: CellTypes.Code,
		source: '1+1',
		metadata: { language: 'python' },
		execution_count: 1
	}],
	metadata: {
		'kernelspec': {
			'name': 'pysparkkernel',
			'display_name': 'PySpark'
		}
	},
	nbformat: 4,
	nbformat_minor: 2
};

export const notebookContentForCellLanguageTest: azdata.nb.INotebookContents = {
	cells: [{
		cell_type: CellTypes.Code,
		source: '1+1',
		metadata: {},
		execution_count: 1
	}],
	metadata: {
		'kernelspec': {
			'name': ''
		},
	},
	nbformat: 4,
	nbformat_minor: 2
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
		'kernelspec': {
			'name': 'python3',
			'display_name': 'Python 3'
		}
	},
	nbformat: 4,
	nbformat_minor: 2
};

export const sqlNotebookContent: azdata.nb.INotebookContents = {
	cells: [{
		cell_type: CellTypes.Code,
		source: 'select 1',
		metadata: { language: 'sql' },
		execution_count: 1
	}],
	metadata: {
		'kernelspec': {
			'name': 'SQL',
			'display_name': 'SQL'
		}
	},
	nbformat: 4,
	nbformat_minor: 2
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
		'kernelspec': {
			'name': 'SQL',
			'display_name': 'SQL'
		}
	},
	nbformat: 4,
	nbformat_minor: 2
};

export const pySparkKernelMetadata = {
	'kernelspec': {
		'name': 'pysparkkernel',
		'display_name': 'PySpark'
	}
};

export const pySparkKernelSpec = {
	name: 'pyspark',
	display_name: 'PySpark'
};

export const sqlKernelMetadata = {
	'kernelspec': {
		'name': 'SQL',
		'display_name': 'SQL'
	}
};

export const sqlKernelSpec: azdata.nb.IKernelSpec = {
	name: 'SQL',
	display_name: 'SQL'
};

export const pythonKernelMetadata = {
	'kernelspec': {
		'name': 'python3',
		'display_name': 'Python 3'
	}
};

export const pythonKernelSpec: azdata.nb.IKernelSpec = {
	name: 'python3',
	display_name: 'Python 3'
};

export function writeNotebookToFile(pythonNotebook: azdata.nb.INotebookContents, testName: string): vscode.Uri {
	let fileName = getFileName(testName);
	let notebookContentString = JSON.stringify(pythonNotebook);
	fs.writeFileSync(fileName, notebookContentString);
	console.log(`Local file is created: '${fileName}'`);
	let uri = vscode.Uri.file(fileName);
	return uri;
}

export function getFileName(testName: string): string {
	if (testName) {
		return path.join(os.tmpdir(), testName + '.ipynb');
	}
	return undefined;
}
