/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import { nb } from 'azdata';
import * as assert from 'assert';

import * as objects from 'vs/base/common/objects';

import { CellTypes } from 'sql/workbench/services/notebook/common/contracts';
import { ModelFactory } from 'sql/workbench/services/notebook/browser/models/modelFactory';
import { NotebookModelStub, ClientSessionStub, KernelStub, FutureStub } from 'sql/workbench/contrib/notebook/test/stubs';
import { EmptyFuture } from 'sql/workbench/contrib/notebook/test/emptySessionClasses';
import { ICellModel, ICellModelOptions, IClientSession, INotebookModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { Deferred } from 'sql/base/common/promise';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { startsWith } from 'vs/base/common/strings';
import { Schemas } from 'vs/base/common/network';
import { URI } from 'vs/base/common/uri';
import { IModelContentChangedEvent } from 'vs/editor/common/model/textModelEvents';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';

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

	test('Should not allow markdown cells to be collapsible', async function (): Promise<void> {
		let mdCellData: nb.ICellContents = {
			cell_type: CellTypes.Markdown,
			source: 'some *markdown*',
			outputs: [],
			metadata: { language: 'python' }
		};
		let cell = factory.createCell(mdCellData, undefined);
		assert(cell.isCollapsed === false);
		cell.isCollapsed = true;
		// The typescript compiler will complain if we don't ignore the error from the following line,
		// claiming that cell.isCollapsed will return true. It doesn't.
		// @ts-ignore
		assert(cell.isCollapsed === false);

		let codeCellData: nb.ICellContents = {
			cell_type: CellTypes.Code,
			source: '1+1',
			outputs: [],
			metadata: { language: 'python' },
			execution_count: 1
		};
		cell = factory.createCell(codeCellData, undefined);
		assert(cell.isCollapsed === false);
		cell.isCollapsed = true;
		assert(cell.isCollapsed === true);
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
			cell.setStdInHandler({
				handle: (msg: nb.IStdinMessage) => {
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
			assert(startsWith(contentSplit[7].trim(), '"execution_count": null'));
			assert(startsWith(contentSplit[8].trim(), '}'));
		});
	});

	test('Getters and setters test', async function (): Promise<void> {
		// Code Cell
		let cellData: nb.ICellContents = {
			cell_type: CellTypes.Code,
			source: '1+1',
			outputs: [],
			metadata: { language: 'python' },
			execution_count: 1
		};
		let cell = factory.createCell(cellData, undefined);

		assert.strictEqual(cell.trustedMode, false, 'Cell should not be trusted by default');
		cell.trustedMode = true;
		assert.strictEqual(cell.trustedMode, true, 'Cell should be trusted after manually setting trustedMode');

		assert.strictEqual(cell.isEditMode, true, 'Code cells should be editable by default');
		cell.isEditMode = false;
		assert.strictEqual(cell.isEditMode, false, 'Cell should not be editable after manually setting isEditMode');

		cell.hover = true;
		assert.strictEqual(cell.hover, true, 'Cell should be hovered after manually setting hover=true');
		cell.hover = false;
		assert.strictEqual(cell.hover, false, 'Cell should be hovered after manually setting hover=false');

		let cellUri = URI.from({ scheme: Schemas.untitled, path: `notebook-editor-${cell.id}` });
		assert.deepStrictEqual(cell.cellUri, cellUri);
		cellUri = URI.from({ scheme: Schemas.untitled, path: `test-uri-12345` });
		cell.cellUri = cellUri;
		assert.deepStrictEqual(cell.cellUri, cellUri);

		assert.strictEqual(cell.language, 'python');

		assert.strictEqual(cell.notebookModel, undefined);

		assert.strictEqual(cell.modelContentChangedEvent, undefined);
		let contentChangedEvent = <IModelContentChangedEvent>{};
		cell.modelContentChangedEvent = contentChangedEvent;
		assert.strictEqual(cell.modelContentChangedEvent, contentChangedEvent);

		assert.strictEqual(cell.stdInVisible, false, 'Cell stdin should not be visible by default');
		cell.stdInVisible = true;
		assert.strictEqual(cell.stdInVisible, true, 'Cell stdin should not be visible by default');

		cell.loaded = true;
		assert.strictEqual(cell.loaded, true, 'Cell should be loaded after manually setting loaded=true');
		cell.loaded = false;
		assert.strictEqual(cell.loaded, false, 'Cell should be loaded after manually setting loaded=false');

		assert.ok(cell.onExecutionStateChange !== undefined, 'onExecutionStateChange event should not be undefined');

		assert.ok(cell.onLoaded !== undefined, 'onLoaded event should not be undefined');

		// Markdown cell
		cellData = {
			cell_type: CellTypes.Markdown,
			source: 'some *markdown*',
			outputs: [],
			metadata: { language: 'python' }
		};
		let notebookModel = new NotebookModelStub({
			name: 'python',
			version: '',
			mimetype: ''
		});

		let cellOptions: ICellModelOptions = { notebook: notebookModel, isTrusted: true };
		cell = factory.createCell(cellData, cellOptions);

		assert.strictEqual(cell.isEditMode, false, 'Markdown cells should not be editable by default');
		assert.strictEqual(cell.trustedMode, true, 'Cell should be trusted when providing isTrusted=true in the cell options');
		assert.strictEqual(cell.language, 'markdown');
		assert.strictEqual(cell.notebookModel, notebookModel);
	});

	test('Equals test', async function (): Promise<void> {
		let cell = factory.createCell(undefined, undefined);

		let result = cell.equals(undefined);
		assert.strictEqual(result, false, 'Cell should not be equal to undefined');

		result = cell.equals(cell);
		assert.strictEqual(result, true, 'Cell should be equal to itself');

		let otherCell = factory.createCell(undefined, undefined);
		result = cell.equals(otherCell);
		assert.strictEqual(result, false, 'Cell should not be equal to a different cell');
	});

	suite('Run Cell tests', function (): void {
		let cellOptions: ICellModelOptions;
		let mockClientSession: TypeMoq.Mock<IClientSession>;
		let mockNotebookModel: TypeMoq.Mock<INotebookModel>;
		let mockKernel: TypeMoq.Mock<nb.IKernel>;

		const codeCellContents: nb.ICellContents = {
			cell_type: CellTypes.Code,
			source: '1+1',
			outputs: [],
			metadata: { language: 'python' },
			execution_count: 1
		};
		const markdownCellContents: nb.ICellContents = {
			cell_type: CellTypes.Markdown,
			source: 'some *markdown*',
			outputs: [],
			metadata: { language: 'python' }
		};

		setup(() => {
			mockKernel = TypeMoq.Mock.ofType<nb.IKernel>(KernelStub);

			mockClientSession = TypeMoq.Mock.ofType<IClientSession>(ClientSessionStub);
			mockClientSession.setup(s => s.kernel).returns(() => mockKernel.object);
			mockClientSession.setup(s => s.isReady).returns(() => true);

			mockNotebookModel = TypeMoq.Mock.ofType<INotebookModel>(NotebookModelStub);
			mockNotebookModel.setup(m => m.clientSession).returns(() => mockClientSession.object);
			mockNotebookModel.setup(m => m.updateActiveCell(TypeMoq.It.isAny()));

			cellOptions = { notebook: mockNotebookModel.object, isTrusted: true };
		});

		test('Run markdown cell', async function (): Promise<void> {
			let cell = factory.createCell(markdownCellContents, cellOptions);
			let result = await cell.runCell();
			assert.strictEqual(result, false, 'Markdown cells should not be runnable');
		});

		test('No client session provided', async function (): Promise<void> {
			mockNotebookModel.reset();
			mockNotebookModel.setup(m => m.clientSession).returns(() => undefined);
			mockNotebookModel.setup(m => m.updateActiveCell(TypeMoq.It.isAny()));
			cellOptions.notebook = mockNotebookModel.object;

			let cell = factory.createCell(codeCellContents, cellOptions);
			let result = await cell.runCell();
			assert.strictEqual(result, false, 'Running code cell without a client session should fail');
		});

		test('No Kernel provided', async function (): Promise<void> {
			mockClientSession.reset();
			mockClientSession.setup(s => s.kernel).returns(() => null);
			mockClientSession.setup(s => s.isReady).returns(() => true);
			mockNotebookModel.reset();
			mockNotebookModel.setup(m => m.defaultKernel).returns(() => null);
			mockNotebookModel.setup(m => m.clientSession).returns(() => mockClientSession.object);
			mockNotebookModel.setup(m => m.updateActiveCell(TypeMoq.It.isAny()));
			cellOptions.notebook = mockNotebookModel.object;

			let cell = factory.createCell(codeCellContents, cellOptions);
			let result = await cell.runCell();
			assert.strictEqual(result, false, 'Running code cell without a kernel should fail');
		});

		test('Kernel fails to connect', async function (): Promise<void> {
			mockKernel.setup(k => k.requiresConnection).returns(() => true);
			mockNotebookModel.setup(m => m.requestConnection()).returns(() => Promise.resolve(false));

			let cell = factory.createCell(codeCellContents, cellOptions);
			let result = await cell.runCell();
			assert.strictEqual(result, false, 'Running code cell should fail after connection fails');
		});

		test('Normal execute', async function (): Promise<void> {
			mockKernel.setup(k => k.requiresConnection).returns(() => false);
			mockKernel.setup(k => k.requestExecute(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
				let replyMsg: nb.IExecuteReplyMsg = <nb.IExecuteReplyMsg>{
					content: <nb.IExecuteReply>{
						execution_count: 1,
						status: 'ok'
					}
				};

				return new FutureStub(undefined, Promise.resolve(replyMsg));
			});

			let cell = factory.createCell(codeCellContents, cellOptions);
			let result = await cell.runCell();
			assert.strictEqual(result, true, 'Running normal code cell should succeed');
		});

		test('Execute returns error status', async function (): Promise<void> {
			mockKernel.setup(k => k.requiresConnection).returns(() => false);
			mockKernel.setup(k => k.requestExecute(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
				let replyMsg: nb.IExecuteReplyMsg = <nb.IExecuteReplyMsg>{
					content: <nb.IExecuteReply>{
						execution_count: 1,
						status: 'error'
					}
				};

				return new FutureStub(undefined, Promise.resolve(replyMsg));
			});

			let cell = factory.createCell(codeCellContents, cellOptions);
			let result = await cell.runCell();
			assert.strictEqual(result, false, 'Run cell should fail if execute returns error status');
		});

		test('Execute returns abort status', async function (): Promise<void> {
			mockKernel.setup(k => k.requiresConnection).returns(() => false);
			mockKernel.setup(k => k.requestExecute(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
				let replyMsg: nb.IExecuteReplyMsg = <nb.IExecuteReplyMsg>{
					content: <nb.IExecuteReply>{
						execution_count: 1,
						status: 'abort'
					}
				};

				return new FutureStub(undefined, Promise.resolve(replyMsg));
			});

			let cell = factory.createCell(codeCellContents, cellOptions);
			let result = await cell.runCell();
			assert.strictEqual(result, false, 'Run cell should fail if execute returns abort status');
		});

		test('Execute throws exception', async function (): Promise<void> {
			let testMsg = 'Test message';
			mockKernel.setup(k => k.requiresConnection).returns(() => false);
			mockKernel.setup(k => k.requestExecute(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
				throw new Error(testMsg);
			});

			let actualMsg: string;
			let mockNotification = TypeMoq.Mock.ofType<INotificationService>(TestNotificationService);
			mockNotification.setup(n => n.notify(TypeMoq.It.isAny())).returns(notification => {
				actualMsg = notification.message;
				return undefined;
			});

			let cell = factory.createCell(codeCellContents, cellOptions);
			let result = await cell.runCell(mockNotification.object);
			assert.strictEqual(result, true, 'Run cell should report errors via notification service');
			assert.ok(actualMsg !== undefined, 'Should have received an error notification');
			assert.strictEqual(actualMsg, testMsg);
		});
	});

	test('Should emit event on markdown cell edit', async function (): Promise<void> {
		let notebookModel = new NotebookModelStub({
			name: '',
			version: '',
			mimetype: ''
		});
		let contents: nb.ICellContents = {
			cell_type: CellTypes.Markdown,
			source: ''
		};
		let model = factory.createCell(contents, { notebook: notebookModel, isTrusted: false });
		assert(!model.isEditMode);

		let createCellModePromise = () => {
			return new Promise((resolve, reject) => {
				setTimeout((error) => reject(error), 2000);
				model.onCellModeChanged(isEditMode => {
					resolve(isEditMode);
				});
			});
		};

		assert(!model.isEditMode);
		let cellModePromise = createCellModePromise();
		model.isEditMode = true;
		let isEditMode = await cellModePromise;
		assert(isEditMode);

		cellModePromise = createCellModePromise();
		model.isEditMode = false;
		isEditMode = await cellModePromise;
		assert(!isEditMode);
	});

});
