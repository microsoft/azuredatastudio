/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as should from 'should';
import * as TypeMoq from 'typemoq';
import * as path from 'path';
import { ContentsManager, Contents } from '@jupyterlab/services';
import { nb } from 'azdata';
import 'mocha';

import { INotebook, CellTypes } from '../../contracts/content';
import { RemoteContentManager } from '../../jupyter/remoteContentManager';
import * as testUtils from '../common/testUtils';

let expectedNotebookContent: INotebook = {
	cells: [{
		cell_type: CellTypes.Code,
		source: 'insert into t1 values (c1, c2)',
		metadata: { language: 'python' },
		execution_count: 1
	}],
	metadata: {
		kernelspec: {
			name: 'mssql',
			language: 'sql'
		}
	},
	nbformat: 5,
	nbformat_minor: 0
};

function verifyMatchesExpectedNotebook(notebook: nb.INotebookContents): void {
	should(notebook.cells).have.length(1, 'Expected 1 cell');
	should(notebook.cells[0].cell_type).equal(CellTypes.Code);
	should(notebook.cells[0].source).equal(expectedNotebookContent.cells[0].source);
	should(notebook.metadata.kernelspec.name).equal(expectedNotebookContent.metadata.kernelspec.name);
	should(notebook.nbformat).equal(expectedNotebookContent.nbformat);
	should(notebook.nbformat_minor).equal(expectedNotebookContent.nbformat_minor);
}

describe('Remote Content Manager', function (): void {
	let mockJupyterManager = TypeMoq.Mock.ofType(ContentsManager);
	let contentManager = new RemoteContentManager(mockJupyterManager.object);

	// TODO re-enable when we bring in usage of remote content managers / binders
	// it('Should return undefined if path is undefined', async function(): Promise<void> {
	//     let content = await contentManager.getNotebookContents(undefined);
	//     should(content).be.undefined();
	//     // tslint:disable-next-line:no-null-keyword
	//     content = await contentManager.getNotebookContents(null);
	//     should(content).be.undefined();
	//     content = await contentManager.getNotebookContents(vscode.Uri.file(''));
	//     should(content).be.undefined();
	// });

	it('Should throw if API call throws', async function (): Promise<void> {
		let exception = new Error('Path was wrong');
		mockJupyterManager.setup(c => c.get(TypeMoq.It.isAny(), TypeMoq.It.isAny())).throws(exception);
		await testUtils.assertThrowsAsync(async () => await contentManager.getNotebookContents(vscode.Uri.file('/path/doesnot/exist.ipynb')), undefined);
	});
	it('Should return notebook contents parsed as INotebook when valid notebook file parsed', async function (): Promise<void> {
		// Given a valid request to the notebook server
		let remotePath = '/remote/path/that/exists.ipynb';
		let contentsModel: Contents.IModel = {
			name: path.basename(remotePath),
			content: expectedNotebookContent,
			path: remotePath,
			type: 'notebook',
			writable: false,
			created: undefined,
			last_modified: undefined,
			mimetype: 'json',
			format: 'json'
		};
		mockJupyterManager.setup(c => c.get(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(contentsModel));
		// when I read the content
		let notebook = await contentManager.getNotebookContents(vscode.Uri.file(remotePath));
		// then I expect notebook format to match
		verifyMatchesExpectedNotebook(notebook);
	});

	it('Should return undefined if service does not return anything', async function (): Promise<void> {
		// Given a valid request to the notebook server
		let remotePath = '/remote/path/that/does/not/exist.ipynb';
		mockJupyterManager.setup(c => c.get(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));
		// when I read the content
		let notebook = await contentManager.getNotebookContents(vscode.Uri.file(remotePath));
		// then I expect notebook format to match
		should(notebook).be.undefined();
	});
});
