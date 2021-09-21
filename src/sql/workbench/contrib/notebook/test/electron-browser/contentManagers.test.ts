/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb } from 'azdata';
import * as assert from 'assert';

import * as fs from 'fs';
import * as pfs from 'vs/base/node/pfs';

import { URI } from 'vs/base/common/uri';
import { LocalContentManager } from 'sql/workbench/services/notebook/common/localContentManager';
import { CellTypes } from 'sql/workbench/services/notebook/common/contracts';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { TestFileService } from 'vs/workbench/test/browser/workbenchTestServices';
import { IFileService, IReadFileOptions, IFileContent, IWriteFileOptions, IFileStatWithMetadata } from 'vs/platform/files/common/files';
import { VSBuffer, VSBufferReadable } from 'vs/base/common/buffer';
import { promisify } from 'util';

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
			language: 'sql',
			display_name: 'SQL'
		}
	},
	nbformat: 4,
	nbformat_minor: 2
};

let notebookContentString = JSON.stringify(expectedNotebookContent);

function verifyMatchesExpectedNotebook(notebook: nb.INotebookContents): void {
	assert.strictEqual(notebook.cells.length, 1, 'Expected 1 cell');
	assert.strictEqual(notebook.cells[0].cell_type, CellTypes.Code);
	assert.strictEqual(notebook.cells[0].source, expectedNotebookContent.cells[0].source);
	assert.strictEqual(notebook.metadata.kernelspec.name, expectedNotebookContent.metadata.kernelspec.name);
	assert.strictEqual(notebook.nbformat, expectedNotebookContent.nbformat);
	assert.strictEqual(notebook.nbformat_minor, expectedNotebookContent.nbformat_minor);
}

suite('Local Content Manager', function (): void {
	let contentManager: LocalContentManager;

	setup(() => {
		const instantiationService = new TestInstantiationService();
		const fileService = new class extends TestFileService {
			override async readFile(resource: URI, options?: IReadFileOptions | undefined): Promise<IFileContent> {
				const content = await promisify(fs.readFile)(resource.fsPath);

				return { name: ',', size: 0, etag: '', mtime: 0, value: VSBuffer.fromString(content.toString()), resource, ctime: 0, readonly: false };
			}
			override async writeFile(resource: URI, bufferOrReadable: VSBuffer | VSBufferReadable, options?: IWriteFileOptions): Promise<IFileStatWithMetadata> {
				await pfs.Promises.writeFile(resource.fsPath, bufferOrReadable.toString());
				return { resource: resource, mtime: 0, etag: '', size: 0, name: '', isDirectory: false, ctime: 0, isFile: true, isSymbolicLink: false, readonly: false };
			}
		};
		instantiationService.set(IFileService, fileService);
		contentManager = instantiationService.createInstance(LocalContentManager);
	});

	test('Should return notebook contents parsed as INotebook when valid notebook file parsed', async function (): Promise<void> {
		let notebook = await contentManager.deserializeNotebook(notebookContentString);
		// then I expect notebook format to match
		verifyMatchesExpectedNotebook(notebook);
	});
	test('Should ignore invalid content in the notebook file', async function (): Promise<void> {
		// Given a file containing a notebook with some garbage properties
		let invalidContent = notebookContentString + '\\nasddfdsafasdf';
		let notebook = await contentManager.deserializeNotebook(invalidContent);
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
					language: 'sql',
					display_name: 'SQL'
				}
			},
			nbformat: 4,
			nbformat_minor: 2
		};
		let mimeContentString = JSON.stringify(mimeNotebook);
		// when I read the content
		let notebook = await contentManager.deserializeNotebook(mimeContentString);
		// then I expect output to have been normalized into a single string
		let displayOutput = <nb.IDisplayData>notebook.cells[0].outputs[0];
		assert.strictEqual(displayOutput.data['text/html'], '<div></div>');
	});

	test('Should create a new empty notebook if content is undefined', async function (): Promise<void> {
		// verify that when loading content from an empty string, a new notebook is created.
		let content = await contentManager.deserializeNotebook(undefined);
		assert.strictEqual(content.metadata, undefined, 'Verify that metadata is undefined');
		// verify that the notebook is empty
		assert.strictEqual(content.cells.length, 0, 'Notebook should be empty, so the number of cells should be 0');
	});

	test('Should create a new empty notebook if content is an empty string', async function (): Promise<void> {
		// verify that when loading content from an empty string, a new notebook is created.
		let content = await contentManager.deserializeNotebook('');
		assert.strictEqual(content.metadata, undefined, 'Verify that metadata is undefined');
		// verify that the notebook is empty
		assert.strictEqual(content.cells.length, 0, 'Notebook should be empty, so the number of cells should be 0');
	});

	test('Should create a markdown cell', async function (): Promise<void> {
		let expectedNotebookMarkdownContent: nb.INotebookContents = {
			cells: [{
				cell_type: CellTypes.Markdown,
				source: '# Header 1'
			}],
			metadata: {
				kernelspec: {
					name: 'mssql',
					language: 'sql',
					display_name: 'SQL'
				}
			},
			nbformat: 4,
			nbformat_minor: 2
		};
		let markdownNotebookContent = JSON.stringify(expectedNotebookMarkdownContent);
		// verify that notebooks support markdown cells
		let notebook = await contentManager.deserializeNotebook(markdownNotebookContent);
		// assert that markdown cell is supported by
		// verifying the notebook matches the expectedNotebookMarkdownContent format
		assert.strictEqual(notebook.cells.length, 1, 'The number of cells should be equal to 1');
		assert.strictEqual(notebook.cells[0].cell_type, CellTypes.Markdown, 'The cell type should be markdown');
		assert.strictEqual(notebook.cells[0].source, expectedNotebookMarkdownContent.cells[0].source, 'The content of the cell must match the expectedNotebookMarkdownContent');
	});

	test('Should allow stream for output types', async function (): Promise<void> {
		let expectedNotebookStreamOutputContent: nb.INotebookContents = {
			cells: [{
				cell_type: CellTypes.Code,
				source: [],
				metadata: { language: 'python' },
				execution_count: 1,
				outputs: [
					<nb.IStreamResult>{
						output_type: 'stream',
						text: 'Select * FROM database WHERE x = 0  \nSelect * FROM database WHERE x = 0\n'
					}
				]
			}],
			metadata: {
				kernelspec: {
					name: 'Python 3',
					language: 'python3',
					display_name: 'Python 3'
				}
			},
			nbformat: 4,
			nbformat_minor: 2
		};
		let streamOutputContent = JSON.stringify(expectedNotebookStreamOutputContent);
		// Verify that the stream output type is supported
		let notebook = await contentManager.deserializeNotebook(streamOutputContent);
		assert.strictEqual(notebook.cells[0].outputs[0].output_type, 'stream', 'Cell output from notebook should be stream');
		assert.strictEqual(notebook.cells[0].cell_type, expectedNotebookStreamOutputContent.cells[0].cell_type, 'Cell type of notebook should match the expectedNotebookStreamOutputContent');
	});
});
