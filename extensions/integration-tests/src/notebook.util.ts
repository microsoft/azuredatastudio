/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'mocha';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as tempWrite from 'temp-write';

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
			'name': 'pyspark3kernel',
			'display_name': 'PySpark3'
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

export const pyPark3KernelMetadata = {
	'kernelspec': {
		'name': 'pyspark3kernel',
		'display_name': 'PySpark3'
	}
};

export const sqlKernelMetadata = {
	'kernelspec': {
		'name': 'SQL',
		'display_name': 'SQL'
	}
};

export const pythonKernelMetadata = {
	'kernelspec': {
		'name': 'python3',
		'display_name': 'Python 3'
	}
};

export function writeNotebookToFile(pythonNotebook: azdata.nb.INotebookContents): vscode.Uri {
	let notebookContentString = JSON.stringify(pythonNotebook);
	let localFile = tempWrite.sync(notebookContentString, 'notebook.ipynb');
	let uri = vscode.Uri.file(localFile);
	return uri;
}
