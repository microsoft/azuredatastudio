/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import { nb } from 'azdata';
import * as assert from 'assert';

import * as objects from 'vs/base/common/objects';

import { CellTypes } from 'sql/workbench/parts/notebook/common/models/contracts';
import { ModelFactory } from 'sql/workbench/parts/notebook/browser/models/modelFactory';
import { NotebookModelStub } from './common';
import { EmptyFuture } from 'sql/workbench/services/notebook/browser/sessionManager';
import { ICellModel } from 'sql/workbench/parts/notebook/browser/models/modelInterfaces';
import { Deferred } from 'sql/base/common/promise';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { startsWith } from 'vs/base/common/strings';

let instantiationService: IInstantiationService;

suite('Cell Model', function (): void {
	let serviceCollection = new ServiceCollection();
	instantiationService = new InstantiationService(serviceCollection, true);

	let factory = new ModelFactory(instantiationService);
	test('Should set default values if none defined', async function (): Promise<void> {
		let cell = factory.createCell(undefined, undefined);
		assert.equal(cell.cellType, CellTypes.Code);
		assert.equal(cell.source, '');
	});

	test('Should update values', async function (): Promise<void> {
		let cell = factory.createCell(undefined, undefined);
		cell.setOverrideLanguage('sql');
		assert.equal(cell.language, 'sql');
		cell.source = 'abcd';
		assert.equal(JSON.stringify(cell.source), JSON.stringify(['abcd']));
	});

	test('Should match ICell values if defined', async function (): Promise<void> {
		let output: nb.IStreamResult = {
			output_type: 'stream',
			text: 'Some output',
			name: 'stdout'
		};
		let cellData: nb.ICellContents = {
			cell_type: CellTypes.Markdown,
			source: 'some *markdown*',
			outputs: [output],
			metadata: { language: 'python' },
			execution_count: 1
		};
		let cell = factory.createCell(cellData, undefined);
		assert.equal(cell.cellType, cellData.cell_type);
		assert.equal(JSON.stringify(cell.source), JSON.stringify([cellData.source]));
		assert.equal(cell.outputs.length, 1);
		assert.equal(cell.outputs[0].output_type, 'stream');
		assert.equal((<nb.IStreamResult>cell.outputs[0]).text, 'Some output');
	});


	test('Should set cell language to python if defined as python in languageInfo', async function (): Promise<void> {
		let cellData: nb.ICellContents = {
			cell_type: CellTypes.Code,
			source: 'print(\'1\')',
			metadata: { language: 'python' },
			execution_count: 1
		};

		let notebookModel = new NotebookModelStub({
			name: 'python',
			version: '',
			mimetype: ''
		});
		let cell = factory.createCell(cellData, { notebook: notebookModel, isTrusted: false });
		assert.equal(cell.language, 'python');
	});

	test('Should set cell language to python if defined as pyspark in languageInfo', async function (): Promise<void> {
		let cellData: nb.ICellContents = {
			cell_type: CellTypes.Code,
			source: 'print(\'1\')',
			metadata: { language: 'python' },
			execution_count: 1
		};

		let notebookModel = new NotebookModelStub({
			name: 'pyspark',
			version: '',
			mimetype: ''
		});
		let cell = factory.createCell(cellData, { notebook: notebookModel, isTrusted: false });
		assert.equal(cell.language, 'python');
	});

	test('Should keep cell language as python if cell has language override', async function (): Promise<void> {
		let cellData: nb.ICellContents = {
			cell_type: CellTypes.Code,
			source: 'print(\'1\')',
			metadata: { language: 'python' },
			execution_count: 1
		};

		let notebookModel = new NotebookModelStub({
			name: 'scala',
			version: '',
			mimetype: ''
		});
		let cell = factory.createCell(cellData, { notebook: notebookModel, isTrusted: false });
		assert.equal(cell.language, 'python');
	});

	test('Should set cell language to python if no language defined', async function (): Promise<void> {
		let cellData: nb.ICellContents = {
			cell_type: CellTypes.Code,
			source: 'print(\'1\')',
			metadata: { language: 'python' },
			execution_count: 1
		};

		let notebookModel = new NotebookModelStub({
			name: '',
			version: '',
			mimetype: ''
		});
		let cell = factory.createCell(cellData, { notebook: notebookModel, isTrusted: false });
		assert.equal(cell.language, 'python');
	});

	test('Should allow source of type string[] with length 1', async function (): Promise<void> {
		let cellData: nb.ICellContents = {
			cell_type: CellTypes.Code,
			source: ['print(1)'],
			metadata: { language: 'sql' },
			execution_count: 1
		};

		let notebookModel = new NotebookModelStub({
			name: '',
			version: '',
			mimetype: ''
		});
		let cell = factory.createCell(cellData, { notebook: notebookModel, isTrusted: false });
		assert(Array.isArray(cell.source));
		assert.equal(cell.source.length, 1);
		assert.equal(cell.source[0], 'print(1)');
	});

	test('Should allow source of type string', async function (): Promise<void> {
		let cellData: nb.ICellContents = {
			cell_type: CellTypes.Code,
			source: 'print(1)',
			metadata: { language: 'sql' },
			execution_count: 1
		};

		let notebookModel = new NotebookModelStub({
			name: '',
			version: '',
			mimetype: ''
		});
		let cell = factory.createCell(cellData, { notebook: notebookModel, isTrusted: false });
		assert(Array.isArray(cell.source));
		assert.equal(JSON.stringify(cell.source), JSON.stringify(['print(1)']));
	});

	test('Should allow source of type string with newline and split it', async function (): Promise<void> {
		let cellData: nb.ICellContents = {
			cell_type: CellTypes.Code,
			source: 'print(1)\nprint(2)',
			metadata: { language: 'sql' },
			execution_count: 1
		};

		let notebookModel = new NotebookModelStub({
			name: '',
			version: '',
			mimetype: ''
		});
		let cell = factory.createCell(cellData, { notebook: notebookModel, isTrusted: false });
		assert(Array.isArray(cell.source));
		assert.equal(cell.source.length, 2);
		assert.equal(cell.source[0], 'print(1)\n');
		assert.equal(cell.source[1], 'print(2)');
	});

	test('Should allow source of type string with Windows style newline and split it', async function (): Promise<void> {
		let cellData: nb.ICellContents = {
			cell_type: CellTypes.Code,
			source: 'print(1)\r\nprint(2)',
			metadata: { language: 'sql' },
			execution_count: 1
		};

		let notebookModel = new NotebookModelStub({
			name: '',
			version: '',
			mimetype: ''
		});
		let cell = factory.createCell(cellData, { notebook: notebookModel, isTrusted: false });
		assert(Array.isArray(cell.source));
		assert.equal(cell.source.length, 2);
		assert.equal(cell.source[0], 'print(1)\r\n');
		assert.equal(cell.source[1], 'print(2)');
	});

	test('Should allow source of type string[] with length 2', async function (): Promise<void> {
		let cellData: nb.ICellContents = {
			cell_type: CellTypes.Code,
			source: ['print(1)\n', 'print(2)'],
			metadata: { language: 'sql' },
			execution_count: 1
		};

		let notebookModel = new NotebookModelStub({
			name: '',
			version: '',
			mimetype: ''
		});
		let cell = factory.createCell(cellData, { notebook: notebookModel, isTrusted: false });
		assert(Array.isArray(cell.source));
		assert.equal(cell.source.length, 2);
		assert.equal(cell.source[0], 'print(1)\n');
		assert.equal(cell.source[1], 'print(2)');
	});

	test('Should allow empty string source', async function (): Promise<void> {
		let cellData: nb.ICellContents = {
			cell_type: CellTypes.Code,
			source: '',
			metadata: { language: 'sql' },
			execution_count: 1
		};

		let notebookModel = new NotebookModelStub({
			name: '',
			version: '',
			mimetype: ''
		});
		let cell = factory.createCell(cellData, { notebook: notebookModel, isTrusted: false });
		assert(Array.isArray(cell.source));
		assert.equal(JSON.stringify(cell.source), JSON.stringify(['']));
	});

	test('Should parse metadata\'s hide_input tag correctly', async function (): Promise<void> {
		let notebookModel = new NotebookModelStub({
			name: '',
			version: '',
			mimetype: ''
		});
		let contents: nb.ICellContents = {
			cell_type: CellTypes.Code,
			source: ''
		};
		let model = factory.createCell(contents, { notebook: notebookModel, isTrusted: false });

		assert(!model.isCollapsed);
		model.isCollapsed = true;
		assert(model.isCollapsed);
		model.isCollapsed = false;
		assert(!model.isCollapsed);

		let modelJson = model.toJSON();
		assert(!isUndefinedOrNull(modelJson.metadata.tags));
		assert(!modelJson.metadata.tags.some(x => x === 'hide_input'));

		contents.metadata = {
			tags: ['hide_input']
		};
		model = factory.createCell(contents, { notebook: notebookModel, isTrusted: false });

		assert(model.isCollapsed);
		model.isCollapsed = false;
		assert(!model.isCollapsed);
		model.isCollapsed = true;
		assert(model.isCollapsed);

		modelJson = model.toJSON();
		assert(!isUndefinedOrNull(modelJson.metadata.tags));
		assert(modelJson.metadata.tags.some(x => x === 'hide_input'));

		contents.metadata = {
			tags: ['not_a_real_tag']
		};
		model = factory.createCell(contents, { notebook: notebookModel, isTrusted: false });
		modelJson = model.toJSON();
		assert(!isUndefinedOrNull(modelJson.metadata.tags));
		assert(!modelJson.metadata.tags.some(x => x === 'hide_input'));

		contents.metadata = {
			tags: ['not_a_real_tag', 'hide_input']
		};
		model = factory.createCell(contents, { notebook: notebookModel, isTrusted: false });
		modelJson = model.toJSON();
		assert(!isUndefinedOrNull(modelJson.metadata.tags));
		assert(modelJson.metadata.tags.some(x => x === 'hide_input'));
	});

	test('Should emit event after collapsing cell', async function (): Promise<void> {
		let notebookModel = new NotebookModelStub({
			name: '',
			version: '',
			mimetype: ''
		});
		let contents: nb.ICellContents = {
			cell_type: CellTypes.Code,
			source: ''
		};
		let model = factory.createCell(contents, { notebook: notebookModel, isTrusted: false });
		assert(!model.isCollapsed);

		let createCollapsePromise = () => {
			return new Promise((resolve, reject) => {
				setTimeout(() => reject(), 2000);
				model.onCollapseStateChanged(isCollapsed => {
					resolve(isCollapsed);
				});
			});
		};

		assert(!model.isCollapsed);
		let collapsePromise = createCollapsePromise();
		model.isCollapsed = true;
		let isCollapsed = await collapsePromise;
		assert(isCollapsed);

		collapsePromise = createCollapsePromise();
		model.isCollapsed = false;
		isCollapsed = await collapsePromise;
		assert(!isCollapsed);
	});

	suite('Model Future handling', function (): void {
		let future: TypeMoq.Mock<EmptyFuture>;
		let cell: ICellModel;
		const stdInDefaultMessage: nb.IStdinMessage = {
			channel: 'stdin',
			type: 'stdin',
			parent_header: undefined,
			metadata: undefined,
			header: <nb.IHeader>{
				msg_type: 'stream'
			},
			content: {
				prompt: 'Prompt',
				password: false
			}
		};
		setup(() => {
			future = TypeMoq.Mock.ofType(EmptyFuture);
			cell = factory.createCell({
				cell_type: CellTypes.Code,
				source: 'print "Hello"',
				metadata: { language: 'python' },
				execution_count: 1
			}, {
				notebook: new NotebookModelStub({
					name: '',
					version: '',
					mimetype: 'x-scala'
				}),
				isTrusted: false
			});
		});

		test('should send and handle incoming messages', async () => {
			// Given a future
			let onReply: nb.MessageHandler<nb.IShellMessage>;
			let onIopub: nb.MessageHandler<nb.IIOPubMessage>;
			future.setup(f => f.setReplyHandler(TypeMoq.It.isAny())).callback((handler) => onReply = handler);
			future.setup(f => f.setIOPubHandler(TypeMoq.It.isAny())).callback((handler) => onIopub = handler);
			let outputs: ReadonlyArray<nb.ICellOutput> = undefined;
			cell.onOutputsChanged((o => outputs = o.outputs));

			// When I set it on the cell
			cell.setFuture(future.object);

			// Then I expect outputs to have been cleared
			assert.equal(outputs.length, 0);
			assert(!isUndefinedOrNull(onReply));
			// ... And when I send an IoPub message
			let message: nb.IIOPubMessage = {
				channel: 'iopub',
				type: 'iopub',
				parent_header: undefined,
				metadata: undefined,
				header: <nb.IHeader>{
					msg_type: 'stream'
				},
				content: {
					text: 'Printed hello world'
				}
			};
			onIopub.handle(message);
			// Then I expect an output to be added
			assert.equal(outputs.length, 1);
			assert.equal(outputs[0].output_type, 'stream');

			message = objects.deepClone(message);
			message.header.msg_type = 'display_data';
			onIopub.handle(message);
			assert.equal(outputs[1].output_type, 'display_data');
		});

		test('stdin should return void if no handler registered', async () => {
			// Given stdIn does not have a request handler setup
			let onStdIn: nb.MessageHandler<nb.IStdinMessage>;
			future.setup(f => f.setStdInHandler(TypeMoq.It.isAny())).callback((handler) => onStdIn = handler);

			// When I set it on the cell
			cell.setFuture(future.object);

			// Then I expect stdIn to have been hooked up
			assert(!isUndefinedOrNull(onStdIn));
			// ... And when I send a stdIn request message
			let result = onStdIn.handle(stdInDefaultMessage);
			// Then I expect the promise to resolve
			await result;
			future.verify(f => f.sendInputReply(TypeMoq.It.isAny()), TypeMoq.Times.never());
		});

		test('stdin should wait on handler if handler registered', async () => {
			// Given stdIn has a handler set up
			let onStdIn: nb.MessageHandler<nb.IStdinMessage>;
			future.setup(f => f.setStdInHandler(TypeMoq.It.isAny())).callback((handler) => onStdIn = handler);

			let deferred = new Deferred<void>();
			let stdInMessage: nb.IStdinMessage = undefined;
			cell.setStdInHandler({
				handle: (msg: nb.IStdinMessage) => {
					stdInMessage = msg;
					return deferred.promise;
				}
			});

			// When I send a stdIn request message
			cell.setFuture(future.object);
			let result = onStdIn.handle(stdInDefaultMessage);
			deferred.resolve();
			// Then I expect promise to resolve since it should wait on upstream handling
			await result;
			// And I expect message to have been passed upstream and no message sent from the cell
			assert(!isUndefinedOrNull(stdInMessage));
			assert.equal(stdInMessage.content.prompt, stdInDefaultMessage.content.prompt);
			assert.equal(stdInMessage.content.password, stdInDefaultMessage.content.password);
			future.verify(f => f.sendInputReply(TypeMoq.It.isAny()), TypeMoq.Times.never());
		});
		test('stdin should send default response if there is upstream error', async () => {
			// Given stdIn has a handler set up
			let onStdIn: nb.MessageHandler<nb.IStdinMessage>;
			future.setup(f => f.setStdInHandler(TypeMoq.It.isAny())).callback((handler) => onStdIn = handler);

			let deferred = new Deferred<void>();
			let stdInMessage: nb.IStdinMessage = undefined;
			cell.setStdInHandler({
				handle: (msg: nb.IStdinMessage) => {
					stdInMessage = msg;
					return deferred.promise;
				}
			});

			// When I send a stdIn request message
			cell.setFuture(future.object);
			let result = onStdIn.handle(stdInDefaultMessage);
			deferred.reject('Something went wrong');
			// Then I expect promise to resolve since it should wait on upstream handling
			await result;
			future.verify(f => f.sendInputReply(TypeMoq.It.isAny()), TypeMoq.Times.once());
		});

		test('should delete transient tag while handling incoming messages', async () => {
			// Given a future
			let onIopub: nb.MessageHandler<nb.IIOPubMessage>;
			future.setup(f => f.setIOPubHandler(TypeMoq.It.isAny())).callback((handler) => onIopub = handler);
			let outputs: ReadonlyArray<nb.ICellOutput> = undefined;
			cell.onOutputsChanged((o => outputs = o.outputs));

			//Set the future
			cell.setFuture(future.object);

			// ... And when I send an IoPub message
			let message: nb.IIOPubMessage = {
				channel: 'iopub',
				type: 'iopub',
				parent_header: undefined,
				metadata: undefined,
				header: <nb.IHeader>{
					msg_type: 'display_data'
				},
				content: {
					text: 'Printed hello world',
					transient: 'transient data'
				}
			};
			onIopub.handle(message);
			//Output array's length should be 1
			//'transient' tag should no longer exist in the output
			assert.equal(outputs.length, 1);
			assert(isUndefinedOrNull(outputs[0]['transient']));
		});

		test('should dispose old future', async () => {
			let oldFuture = TypeMoq.Mock.ofType(EmptyFuture);
			cell.setFuture(oldFuture.object);

			cell.setFuture(future.object);

			oldFuture.verify(f => f.dispose(), TypeMoq.Times.once());
		});

		test('should include cellGuid', async () => {
			let notebookModel = new NotebookModelStub({
				name: '',
				version: '',
				mimetype: ''
			});

			let cell = factory.createCell(undefined, { notebook: notebookModel, isTrusted: false });
			assert(!isUndefinedOrNull(cell.cellGuid));
			assert.equal(cell.cellGuid.length, 36);
			let cellJson = cell.toJSON();
			assert(!isUndefinedOrNull(cellJson.metadata.azdata_cell_guid));
		});

		test('should include azdata_cell_guid in metadata', async () => {
			let notebookModel = new NotebookModelStub({
				name: '',
				version: '',
				mimetype: ''
			});

			let cell = factory.createCell(undefined, { notebook: notebookModel, isTrusted: false });
			let cellJson = cell.toJSON();
			assert(!isUndefinedOrNull(cellJson.metadata.azdata_cell_guid));
		});

		// This is critical for the notebook editor model to parse changes correctly
		// If this test fails, please ensure that the notebookEditorModel tests still pass
		test('should stringify in the correct order', async () => {
			let notebookModel = new NotebookModelStub({
				name: '',
				version: '',
				mimetype: ''
			});

			let cell = factory.createCell(undefined, { notebook: notebookModel, isTrusted: false });
			let content = JSON.stringify(cell.toJSON(), undefined, '    ');
			let contentSplit = content.split('\n');
			assert.equal(contentSplit.length, 9);
			assert(startsWith(contentSplit[0].trim(), '{'));
			assert(startsWith(contentSplit[1].trim(), '"cell_type": "code",'));
			assert(startsWith(contentSplit[2].trim(), '"source": ""'));
			assert(startsWith(contentSplit[3].trim(), '"metadata": {'));
			assert(startsWith(contentSplit[4].trim(), '"azdata_cell_guid": "'));
			assert(startsWith(contentSplit[5].trim(), '}'));
			assert(startsWith(contentSplit[6].trim(), '"outputs": []'));
			assert(startsWith(contentSplit[7].trim(), '"execution_count": 0'));
			assert(startsWith(contentSplit[8].trim(), '}'));
		});
	});

});
