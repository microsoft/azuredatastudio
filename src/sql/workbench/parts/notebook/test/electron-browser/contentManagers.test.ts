/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import { nb } from 'azdata';

import { URI } from 'vs/base/common/uri';
import * as tempWrite from 'temp-write';
import { LocalContentManager } from 'sql/workbench/services/notebook/common/localContentManager';
import * as testUtils from '../../../../../../sqltest/utils/testUtils';
import { CellTypes } from 'sql/workbench/parts/notebook/common/models/contracts';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { TestFileService } from 'vs/workbench/test/workbenchTestServices';
import { IFileService, IReadFileOptions, IFileContent, IWriteFileOptions, IFileStatWithMetadata } from 'vs/platform/files/common/files';
import * as pfs from 'vs/base/node/pfs';
import { VSBuffer, VSBufferReadable } from 'vs/base/common/buffer';

let expectedNotebookContent: nb.INotebookContents = {
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
	nbformat: 4,
	nbformat_minor: 2
};
let notebookContentString = JSON.stringify(expectedNotebookContent);

function verifyMatchesExpectedNotebook(notebook: nb.INotebookContents): void {
	should(notebook.cells).have.length(1, 'Expected 1 cell');
	should(notebook.cells[0].cell_type).equal(CellTypes.Code);
	should(notebook.cells[0].source).equal(expectedNotebookContent.cells[0].source);
	should(notebook.metadata.kernelspec.name).equal(expectedNotebookContent.metadata.kernelspec.name);
	should(notebook.nbformat).equal(expectedNotebookContent.nbformat);
	should(notebook.nbformat_minor).equal(expectedNotebookContent.nbformat_minor);
}

suite('Local Content Manager', function (): void {
	let contentManager: LocalContentManager;

	setup(() => {
		const instantiationService = new TestInstantiationService();
		const fileService = new class extends TestFileService {
			async readFile(resource: URI, options?: IReadFileOptions | undefined): Promise<IFileContent> {
				const content = await pfs.readFile(resource.fsPath);
				return { name: ',', size: 0, etag: '', mtime: 0, value: VSBuffer.fromString(content.toString()), resource };
			}
			async writeFile(resource: URI, bufferOrReadable: VSBuffer | VSBufferReadable, options?: IWriteFileOptions): Promise<IFileStatWithMetadata> {
				await pfs.writeFile(resource.fsPath, bufferOrReadable.toString());
				return { resource: resource, mtime: 0, etag: '', size: 0, name: '', isDirectory: false };
			}
		};
		instantiationService.set(IFileService, fileService);
		contentManager = instantiationService.createInstance(LocalContentManager);
	});

	test('Should return undefined if path is undefined', async function (): Promise<void> {
		let content = await contentManager.getNotebookContents(undefined);
		should(content).be.undefined();
		// tslint:disable-next-line:no-null-keyword
		content = await contentManager.getNotebookContents(null);
		should(content).be.undefined();
	});

	test('Should throw if file does not exist', async function (): Promise<void> {
		await testUtils.assertThrowsAsync(async () => await contentManager.getNotebookContents(URI.file('/path/doesnot/exist.ipynb')), undefined);
	});
	test('Should return notebook contents parsed as INotebook when valid notebook file parsed', async function (): Promise<void> {
		// Given a file containing a valid notebook
		let localFile = tempWrite.sync(notebookContentString, 'notebook.ipynb');
		// when I read the content
		let notebook = await contentManager.getNotebookContents(URI.file(localFile));
		// then I expect notebook format to match
		verifyMatchesExpectedNotebook(notebook);
	});
	test('Should ignore invalid content in the notebook file', async function (): Promise<void> {
		// Given a file containing a notebook with some garbage properties
		let invalidContent = notebookContentString + '\\nasddfdsafasdf';
		let localFile = tempWrite.sync(invalidContent, 'notebook.ipynb');
		// when I read the content
		let notebook = await contentManager.getNotebookContents(URI.file(localFile));
		// then I expect notebook format to still be valid
		verifyMatchesExpectedNotebook(notebook);
	});
	test('Should inline mime data into a single string', async function (): Promise<void> {
		let mimeNotebook: nb.INotebookContents = {
			cells: [{
				cell_type: CellTypes.Code,
				source: 'insert into t1 values (c1, c2)',
				metadata: { language: 'python' },
				execution_count: 1,
				outputs: [
					<nb.IDisplayData>{
						output_type: 'display_data',
						data: {
							'text/html': [
								'<div>',
								'</div>'
							]
						}
					}
				]
			}],
			metadata: {
				kernelspec: {
					name: 'mssql',
					language: 'sql'
				}
			},
			nbformat: 4,
			nbformat_minor: 2
		};
		let mimeContentString = JSON.stringify(mimeNotebook);
		// Given a file containing a valid notebook with multiline mime type
		let localFile = tempWrite.sync(mimeContentString, 'notebook.ipynb');
		// when I read the content
		let notebook = await contentManager.getNotebookContents(URI.file(localFile));
		// then I expect output to have been normalized into a single string
		let displayOutput = <nb.IDisplayData>notebook.cells[0].outputs[0];
		should(displayOutput.data['text/html']).equal('<div></div>');
	});
});
