/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import { nb } from 'azdata';
import * as assert from 'assert';
import * as sinon from 'sinon';

import { INotificationService } from 'vs/platform/notification/common/notification';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { URI } from 'vs/base/common/uri';

import { ExecuteManagerStub, SerializationManagerStub } from 'sql/workbench/contrib/notebook/test/stubs';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { ModelFactory } from 'sql/workbench/services/notebook/browser/models/modelFactory';
import { IClientSession, INotebookModelOptions, NotebookContentChange, IClientSessionOptions, ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { ClientSession } from 'sql/workbench/services/notebook/browser/models/clientSession';
import { CellTypes, NotebookChangeType } from 'sql/workbench/services/notebook/common/contracts';
import { Deferred } from 'sql/base/common/promise';
import { Memento } from 'vs/workbench/common/memento';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { NullLogService } from 'vs/platform/log/common/log';
import { TestConnectionManagementService } from 'sql/platform/connection/test/common/testConnectionManagementService';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { NotebookEditorContentLoader } from 'sql/workbench/contrib/notebook/browser/models/notebookInput';
import { SessionManager } from 'sql/workbench/contrib/notebook/test/emptySessionClasses';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { uriPrefixes } from 'sql/platform/connection/common/utils';
import { NullAdsTelemetryService } from 'sql/platform/telemetry/common/adsTelemetryService';
import { TestConfigurationService } from 'sql/platform/connection/test/common/testConfigurationService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

let expectedNotebookContent: nb.INotebookContents = {
	cells: [{
		cell_type: CellTypes.Code,
		source: ['insert into t1 values (c1, c2)'],
		metadata: { language: 'sql' },
		execution_count: 1
	}, {
		cell_type: CellTypes.Markdown,
		source: ['I am *markdown*'],
		execution_count: 1
	}],
	metadata: {
		kernelspec: {
			name: 'mssql',
			language: 'sql',
			display_name: 'SQL'
		},
		language_info: {
			name: 'sql'
		}
	},
	nbformat: 4,
	nbformat_minor: 5
};

let expectedNotebookContentOneCell: nb.INotebookContents = {
	cells: [{
		cell_type: CellTypes.Code,
		source: ['insert into t1 values (c1, c2)'],
		metadata: { language: 'sql' },
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
	nbformat_minor: 5
};

let expectedKernelAliasNotebookContentOneCell: nb.INotebookContents = {
	cells: [{
		cell_type: CellTypes.Code,
		source: ['StormEvents | summarize Count = count() by State | sort by Count | limit 10'],
		execution_count: 1
	}],
	metadata: {
		kernelspec: {
			name: 'mssql',
			language: 'sql',
			display_name: 'SQL'
		},
		language_info: {
			name: 'fake',
			version: ''
		}
	},
	nbformat: 4,
	nbformat_minor: 5
};

let expectedParameterizedNotebookContent: nb.INotebookContents = {
	cells: [{
		cell_type: CellTypes.Code,
		source: ['x = 1 \ny = 2'],
		metadata: { language: 'python', tags: ['parameters'] },
		execution_count: 1
	}, {
		cell_type: CellTypes.Code,
		source: ['x = 2 \ny = 5)'],
		metadata: { language: 'python', tags: ['injected-parameters'] },
		execution_count: 2
	}],
	metadata: {
		kernelspec: {
			name: 'python3',
			language: 'python',
			display_name: 'Python 3'
		}
	},
	nbformat: 4,
	nbformat_minor: 5
};

let defaultUri = URI.file('/some/path.ipynb');
let notebookUriParams = URI.parse('https://hello.ipynb?x=1&y=2');

let mockClientSession: IClientSession;
let clientSessionOptions: IClientSessionOptions;
let sessionReady: Deferred<void>;
let mockModelFactory: TypeMoq.Mock<ModelFactory>;
let notificationService: TypeMoq.Mock<INotificationService>;
let capabilitiesService: ICapabilitiesService;
let instantiationService: IInstantiationService;
let configurationService: IConfigurationService;

suite('notebook model', function (): void {
	let serializationManagers = [new SerializationManagerStub()];
	let executeManagers = [new ExecuteManagerStub()];
	let mockSessionManager: TypeMoq.Mock<nb.SessionManager>;
	let memento: TypeMoq.Mock<Memento>;
	let queryConnectionService: TypeMoq.Mock<TestConnectionManagementService>;
	let defaultModelOptions: INotebookModelOptions;
	const logService = new NullLogService();
	setup(() => {
		mockSessionManager = TypeMoq.Mock.ofType(SessionManager);
		executeManagers[0].sessionManager = mockSessionManager.object;
		sessionReady = new Deferred<void>();
		notificationService = TypeMoq.Mock.ofType<INotificationService>(TestNotificationService, TypeMoq.MockBehavior.Loose);
		capabilitiesService = new TestCapabilitiesService();
		memento = TypeMoq.Mock.ofType(Memento, TypeMoq.MockBehavior.Loose, '');
		memento.setup(x => x.getMemento(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => void 0);
		queryConnectionService = TypeMoq.Mock.ofType(TestConnectionManagementService, TypeMoq.MockBehavior.Loose, memento.object, undefined, new TestStorageService());
		queryConnectionService.callBase = true;
		let serviceCollection = new ServiceCollection();
		instantiationService = new InstantiationService(serviceCollection, true);
		configurationService = new TestConfigurationService();
		defaultModelOptions = {
			notebookUri: defaultUri,
			factory: new ModelFactory(instantiationService),
			serializationManagers: serializationManagers,
			executeManagers: executeManagers,
			contentLoader: undefined,
			notificationService: notificationService.object,
			connectionService: queryConnectionService.object,
			providerId: 'SQL',
			cellMagicMapper: undefined,
			defaultKernel: undefined,
			layoutChanged: undefined,
			capabilitiesService: capabilitiesService
		};
		clientSessionOptions = {
			notebookManager: defaultModelOptions.executeManagers[0],
			notebookUri: defaultModelOptions.notebookUri,
			notificationService: notificationService.object,
			kernelSpec: defaultModelOptions.defaultKernel
		};
		mockClientSession = new ClientSession(clientSessionOptions);
		mockClientSession.initialize();
		mockModelFactory = TypeMoq.Mock.ofType(ModelFactory);
		mockModelFactory.callBase = true;
		mockModelFactory.setup(f => f.createClientSession(TypeMoq.It.isAny())).returns(() => {
			return mockClientSession;
		});
	});

	test('Should create no cells if model has no contents', async function (): Promise<void> {
		// Given an empty notebook
		let emptyNotebook: nb.INotebookContents = {
			cells: [],
			metadata: {
				kernelspec: {
					name: 'mssql',
					language: 'sql',
					display_name: 'SQL'
				}
			},
			nbformat: 4,
			nbformat_minor: 5
		};

		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentLoader);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(emptyNotebook));
		defaultModelOptions.contentLoader = mockContentManager.object;
		// When I initialize the model
		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService(), queryConnectionService.object, configurationService);
		await model.loadContents();

		// Then I expect to have 0 code cell as the contents
		assert.strictEqual(model.cells.length, 0);

		// And Trust should be true by default if there are no cells
		assert(model.trustedMode);
	});

	test('Should use trusted state set in model load', async function (): Promise<void> {
		// Given a notebook
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentLoader);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(expectedNotebookContent));
		defaultModelOptions.contentLoader = mockContentManager.object;
		// When I initialize the model
		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService(), queryConnectionService.object, configurationService);
		await model.loadContents(true);
		await model.requestModelLoad();

		// Then Trust should be true
		assert(model.trustedMode);
	});

	test('Should throw if model load fails', async function (): Promise<void> {
		// Given a call to get Contents fails
		let error = new Error('File not found');
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentLoader);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.reject(error));//.throws(error);
		defaultModelOptions.contentLoader = mockContentManager.object;

		// When I initalize the model
		// Then it should throw
		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService(), queryConnectionService.object, configurationService);
		assert.strictEqual(model.inErrorState, false);
		await assert.rejects(async () => { await model.loadContents(); });
		assert.strictEqual(model.inErrorState, true);
	});

	test('Should convert cell info to CellModels', async function (): Promise<void> {
		// Given a notebook with 2 cells
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentLoader);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(expectedNotebookContent));
		defaultModelOptions.contentLoader = mockContentManager.object;

		// When I initalize the model
		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService(), queryConnectionService.object, configurationService);
		await model.loadContents();

		// Then I expect all cells to be in the model
		assert.strictEqual(model.cells.length, 2);
		assert.deepStrictEqual(model.cells[0].source, expectedNotebookContent.cells[0].source);
		assert.deepStrictEqual(model.cells[1].source, expectedNotebookContent.cells[1].source);
	});

	test('Should handle multiple notebook managers', async function (): Promise<void> {
		// Given a notebook with 2 cells
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentLoader);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(expectedNotebookContent));
		defaultModelOptions.contentLoader = mockContentManager.object;

		let defaultNotebookManager = new ExecuteManagerStub();
		defaultNotebookManager.providerId = 'SQL';

		let jupyterNotebookManager = new ExecuteManagerStub();
		jupyterNotebookManager.providerId = 'jupyter';

		// Setup 2 notebook managers
		defaultModelOptions.executeManagers = [defaultNotebookManager, jupyterNotebookManager];

		// Change default notebook provider id to jupyter
		defaultModelOptions.providerId = 'jupyter';

		// When I initalize the model
		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService(), queryConnectionService.object, configurationService);
		await model.loadContents();

		// I expect the default provider to be jupyter
		assert.strictEqual(model.executeManager.providerId, 'jupyter', 'Notebook manager provider id incorrect');

		// Similarly, change default notebook provider id to SQL
		defaultModelOptions.providerId = 'SQL';

		// When I initalize the model
		model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService(), queryConnectionService.object, configurationService);
		await model.loadContents();

		// I expect the default provider to be SQL
		assert.strictEqual(model.executeManager.providerId, 'SQL', 'Notebook manager provider id incorrect after 2nd model load');

		// Check that the getters return  the correct values
		assert.strictEqual(model.executeManagers.length, 2, 'There should be 2 notebook managers');
		assert(!isUndefinedOrNull(model.getExecuteManager('SQL')), 'SQL notebook manager is not defined');
		assert(!isUndefinedOrNull(model.getExecuteManager('jupyter')), 'Jupyter notebook manager is not defined');
		assert(isUndefinedOrNull(model.getExecuteManager('foo')), 'foo notebook manager is incorrectly defined');

		// Check other properties to ensure that they're returning as expected
		// No server manager was passed into the notebook manager stub, so expect hasServerManager to return false
		assert.strictEqual(model.hasServerManager, false, 'Notebook model should not have a server manager');
		assert.strictEqual(model.notebookUri, defaultModelOptions.notebookUri, 'Notebook model has incorrect URI');
	});

	test('Should set active cell correctly', async function (): Promise<void> {
		// Given a notebook with 2 cells
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentLoader);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(expectedNotebookContent));
		defaultModelOptions.contentLoader = mockContentManager.object;

		// When I initalize the model
		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService(), queryConnectionService.object, configurationService);
		await model.loadContents();

		let activeCellChangeCount = 0;
		let activeCellFromEvent: ICellModel = undefined;

		model.onActiveCellChanged(c => {
			activeCellChangeCount++;
			activeCellFromEvent = c;
		});

		let notebookContentChange: NotebookContentChange;
		model.contentChanged(c => notebookContentChange = c);

		// Then I expect all cells to be in the model
		assert.strictEqual(model.cells.length, 2, 'Cell count in notebook model is not correct');

		// Set the first cell as active
		model.updateActiveCell(model.cells[0]);
		assert.deepStrictEqual(model.activeCell, model.cells[0], 'Active cell does not match the first cell');
		assert.deepStrictEqual(model.activeCell, activeCellFromEvent, 'Active cell returned from the event does not match');
		assert.strictEqual(activeCellChangeCount, 1, 'Active cell change count is incorrect');
		assert(isUndefinedOrNull(notebookContentChange), 'Content change should be undefined');


		// Set the second cell as active
		model.updateActiveCell(model.cells[1]);
		assert.deepStrictEqual(model.activeCell, model.cells[1], 'Active cell does not match expected value');
		assert.deepStrictEqual(model.activeCell, activeCellFromEvent, 'Active cell returned from the event does not match (2nd)');
		assert.strictEqual(activeCellChangeCount, 2, 'Active cell change count is incorrect; should be 2');

		// Delete the active cell
		model.deleteCell(model.cells[1]);
		assert(isUndefinedOrNull(model.activeCell), 'Active cell should be undefined after active cell is deleted');
		assert.deepStrictEqual(model.activeCell, activeCellFromEvent, 'Active cell should match value from event');
		assert.strictEqual(activeCellChangeCount, 3, 'Active cell change count is incorrect; should be 3');

		// Set the remaining cell as active
		model.updateActiveCell(model.cells[0]);
		assert.deepStrictEqual(model.activeCell, activeCellFromEvent, 'Active cell should match value from event');
		assert.strictEqual(activeCellChangeCount, 4, 'Active cell change count is incorrect; should be 4');

		// Add new cell
		let newCell = model.addCell(CellTypes.Code, 0);

		// Ensure new cell is active cell
		assert.deepStrictEqual(model.activeCell, newCell, 'Active cell does not match newly created cell');
		assert.strictEqual(activeCellChangeCount, 5, 'Active cell change count is incorrect; should be 5');
	});

	test('Should set notebook parameter and injected parameter cell correctly', async function (): Promise<void> {
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentLoader);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(expectedParameterizedNotebookContent));
		defaultModelOptions.notebookUri = defaultUri;
		defaultModelOptions.contentLoader = mockContentManager.object;

		// When I initialize the model
		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService(), queryConnectionService.object, configurationService);
		await model.loadContents();

		assert.strictEqual(model.notebookUri, defaultModelOptions.notebookUri, 'Notebook model has incorrect URI');
		assert.strictEqual(model.cells.length, 2, 'Cell count in notebook model is not correct');

		// Set parameter cell and injected parameters cell
		let notebookParamsCell = model.cells[0];
		let notebookInjectedParamsCell = model.cells[1];

		// Parameters Cell Validation
		assert.strictEqual(model.cells.indexOf(notebookParamsCell), 0, 'Notebook parameters cell should be first cell in notebook');
		assert.strictEqual(notebookParamsCell.isParameter, true, 'Notebook parameters cell should be tagged parameter');
		assert.strictEqual(notebookParamsCell.isInjectedParameter, false, 'Notebook parameters cell should not be tagged injected parameter');

		// Injected Parameters Cell Validation
		assert.strictEqual(model.cells.indexOf(notebookInjectedParamsCell), 1, 'Notebook injected parameters cell should be second cell in notebook');
		assert.strictEqual(notebookInjectedParamsCell.isParameter, false, 'Notebook injected parameters cell should not be tagged parameter cell');
		assert.strictEqual(notebookInjectedParamsCell.isInjectedParameter, true, 'Notebook injected parameters cell should be tagged injected parameter');
	});

	test('Should set notebookUri parameters to new cell correctly', async function (): Promise<void> {
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentLoader);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(expectedNotebookContentOneCell));
		defaultModelOptions.notebookUri = notebookUriParams;
		defaultModelOptions.contentLoader = mockContentManager.object;

		// When I initialize the model
		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService(), queryConnectionService.object, configurationService);
		await model.loadContents();

		assert.strictEqual(model.notebookUri, defaultModelOptions.notebookUri, 'Notebook model has incorrect URI');
		assert.strictEqual(model.cells.length, 2, 'Cell count in notebook model is not correct');

		// Validate notebookUri parameter cell is set as the only parameter cell
		let notebookUriParamsCell = model.cells[0];
		assert.strictEqual(model.cells.indexOf(notebookUriParamsCell), 0, 'NotebookURI parameters cell should be first cell in notebook');
		assert.strictEqual(notebookUriParamsCell.isParameter, true, 'NotebookURI parameters cell should be tagged parameter');
		assert.strictEqual(notebookUriParamsCell.isInjectedParameter, false, 'NotebookURI parameters Cell should not be injected parameter');
	});

	test('Should set notebookUri parameters to new cell after parameters cell correctly', async function (): Promise<void> {
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentLoader);
		let expectedNotebookContentParameterCell = expectedNotebookContentOneCell;
		//Set the cell to be tagged as parameter cell
		expectedNotebookContentParameterCell.cells[0].metadata.tags = ['parameters'];

		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(expectedNotebookContentParameterCell));
		defaultModelOptions.notebookUri = notebookUriParams;
		defaultModelOptions.contentLoader = mockContentManager.object;

		// When I initialize the model
		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService(), queryConnectionService.object, configurationService);
		await model.loadContents();

		assert.strictEqual(model.notebookUri, defaultModelOptions.notebookUri, 'Notebook model has incorrect URI');
		assert.strictEqual(model.cells.length, 2, 'Cell count in notebook model is not correct');

		// Validate notebookUri parameter cell is set as injected parameter
		let notebookUriParamsCell = model.cells[1];
		assert.strictEqual(model.cells.indexOf(notebookUriParamsCell), 1, 'NotebookURI parameters cell should be second cell in notebook');
		assert.strictEqual(notebookUriParamsCell.isParameter, false, 'NotebookURI parameters cell should not be tagged parameter cell');
		assert.strictEqual(notebookUriParamsCell.isInjectedParameter, true, 'NotebookURI parameters Cell should be injected parameter');
	});

	test('Should set notebookUri parameters to new cell after injected parameters cell correctly', async function (): Promise<void> {
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentLoader);

		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(expectedParameterizedNotebookContent));
		defaultModelOptions.notebookUri = notebookUriParams;
		defaultModelOptions.contentLoader = mockContentManager.object;

		// When I initialize the model
		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService(), queryConnectionService.object, configurationService);
		await model.loadContents();

		assert.strictEqual(model.notebookUri, defaultModelOptions.notebookUri, 'Notebook model has incorrect URI');
		assert.strictEqual(model.cells.length, 3, 'Cell count in notebook model is not correct');

		// Validate notebookUri parameter cell is set as an injected parameter after parameter and injected parameter cells
		let notebookUriParamsCell = model.cells[2];
		assert.strictEqual(model.cells.indexOf(notebookUriParamsCell), 2, 'NotebookURI parameters cell should be third cell in notebook');
		assert.strictEqual(notebookUriParamsCell.isParameter, false, 'NotebookURI parameters cell should not be tagged parameter cell');
		assert.strictEqual(notebookUriParamsCell.isInjectedParameter, true, 'NotebookURI parameters Cell should be injected parameter');
	});

	test('Should move first cell below second cell correctly', async function (): Promise<void> {
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentLoader);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(expectedNotebookContent));
		defaultModelOptions.contentLoader = mockContentManager.object;

		// When I initialize the model
		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService(), queryConnectionService.object, configurationService);
		await model.loadContents();

		assert.strictEqual(model.notebookUri, defaultModelOptions.notebookUri, 'Notebook model has incorrect URI');
		assert.strictEqual(model.cells.length, 2, 'Cell count in notebook model is not correct');

		let firstCell = model.cells[0];
		let secondCell = model.cells[1];
		// Move First Cell down
		model.moveCell(firstCell, 1);
		assert.strictEqual(model.cells.indexOf(firstCell), 1, 'First Cell did not move down correctly');
		assert.strictEqual(model.cells.indexOf(secondCell), 0, 'Second Cell did not move up correctly');
	});

	test('Should move second cell up above the first cell correctly', async function (): Promise<void> {
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentLoader);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(expectedNotebookContent));
		defaultModelOptions.contentLoader = mockContentManager.object;

		// When I initialize the model
		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService(), queryConnectionService.object, configurationService);
		await model.loadContents();

		assert.strictEqual(model.notebookUri, defaultModelOptions.notebookUri, 'Notebook model has incorrect URI');
		assert.strictEqual(model.cells.length, 2, 'Cell count in notebook model is not correct');

		let firstCell = model.cells[0];
		let secondCell = model.cells[1];
		// Move Second Cell up
		model.moveCell(secondCell, 0);
		assert.strictEqual(model.cells.indexOf(firstCell), 1, 'First Cell did not move down correctly');
		assert.strictEqual(model.cells.indexOf(secondCell), 0, 'Second Cell did not move up correctly');
	});

	test('Should delete cells correctly', async function (): Promise<void> {
		// Given a notebook with 2 cells
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentLoader);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(expectedNotebookContent));
		defaultModelOptions.contentLoader = mockContentManager.object;

		// When I initalize the model
		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService(), queryConnectionService.object, configurationService);
		await model.loadContents();

		// Count number of times onError event is fired
		let errorCount = 0;
		let notebookContentChange: NotebookContentChange;
		model.onError(() => errorCount++);
		model.contentChanged(c => notebookContentChange = c);

		// Then I expect all cells to be in the model
		assert.strictEqual(model.cells.length, 2, 'Cell count in model is incorrect');

		assert.strictEqual(model.findCellIndex(model.cells[0]), 0, 'findCellIndex returned wrong cell info for first cell');
		assert.strictEqual(model.findCellIndex(model.cells[1]), 1, 'findCellIndex returned wrong cell info for second cell');
		// Delete the first cell
		model.deleteCell(model.cells[0]);
		assert.strictEqual(model.cells.length, 1, 'Cell model length should be 1 after cell deletion');
		assert.deepStrictEqual(model.cells[0].source, expectedNotebookContent.cells[1].source, 'Expected cell source is incorrect');
		assert.strictEqual(model.findCellIndex(model.cells[0]), 0, 'findCellIndex returned wrong cell info for only remaining cell');
		assert.strictEqual(notebookContentChange.changeType, NotebookChangeType.CellsModified, 'notebookContentChange changeType is incorrect');
		assert.strictEqual(notebookContentChange.isDirty, true, 'notebookContentChange should set dirty flag');
		assert.strictEqual(model.activeCell, undefined, 'active cell is not undefined');

		// Delete the remaining cell
		notebookContentChange = undefined;
		model.deleteCell(model.cells[0]);
		assert.strictEqual(model.cells.length, 0, 'There should be no cells tracked in the notebook model');
		assert.strictEqual(model.findCellIndex(model.cells[0]), -1, 'findCellIndex is incorrectly finding a deleted cell');
		assert.strictEqual(errorCount, 0, 'There should be no errors after deleting a cell that exists');
		assert.strictEqual(notebookContentChange.changeType, NotebookChangeType.CellsModified, 'notebookContentChange changeType should indicate CellsModified');
		assert.strictEqual(model.activeCell, undefined, 'Active cell should be undefined');

		// Try deleting the cell again
		notebookContentChange = undefined;
		model.deleteCell(model.cells[0]);
		assert.strictEqual(errorCount, 1, 'The model should record an error after trying to delete a cell that does not exist');
		assert(isUndefinedOrNull(notebookContentChange), 'There should be no content change after an error is recorded');

		// Try deleting as notebook model is in error state
		notebookContentChange = undefined;
		model.deleteCell(model.cells[0]);
		assert.strictEqual(errorCount, 2, 'Error count should be 2 after trying to delete a cell that does not exist a second time');
		assert(isUndefinedOrNull(notebookContentChange), 'There still should be no content change after an error is recorded');
	});

	test('Should notify cell on metadata change', async function (): Promise<void> {
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentLoader);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(expectedNotebookContent));
		defaultModelOptions.contentLoader = mockContentManager.object;

		// When I initalize the model
		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService(), queryConnectionService.object, configurationService);
		await model.loadContents();

		let notebookContentChange: NotebookContentChange;
		model.contentChanged(c => notebookContentChange = c);

		model.cells[0].metadata = { 'test-field': 'test-value' };
		assert(!isUndefinedOrNull(notebookContentChange));
		assert.strictEqual(notebookContentChange.changeType, NotebookChangeType.CellMetadataUpdated, 'notebookContentChange changeType should indicate ');
	});

	test('Should set cell language correctly after cell type conversion', async function (): Promise<void> {
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentLoader);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(expectedNotebookContent));
		defaultModelOptions.contentLoader = mockContentManager.object;

		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService(), queryConnectionService.object, configurationService);
		await model.loadContents();

		let newCell: ICellModel;
		model.onCellTypeChanged(c => newCell = c);

		let firstCell = model.cells[0];
		let secondCell = model.cells[1];

		assert.strictEqual(firstCell.cellType, CellTypes.Code, 'Initial cell type for first cell should be code');
		assert.strictEqual(firstCell.language, 'sql', 'Initial language should be sql for first cell');

		model.convertCellType(firstCell);
		assert.strictEqual(firstCell.cellType, CellTypes.Markdown, 'Failed to convert cell type after conversion');
		assert.strictEqual(firstCell.language, 'markdown', 'Language should be markdown for text cells');
		assert.deepStrictEqual(newCell, firstCell);

		model.convertCellType(secondCell);
		assert.strictEqual(secondCell.cellType, CellTypes.Code, 'Failed to convert second cell type');
		assert.strictEqual(secondCell.language, 'sql', 'Language should be sql again for second cell');
		assert.deepStrictEqual(newCell, secondCell);
	});

	test('Should load contents but then go to error state if client session startup fails', async function (): Promise<void> {
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentLoader);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(expectedNotebookContentOneCell));
		defaultModelOptions.contentLoader = mockContentManager.object;

		// Given I have a session that fails to start
		sessionReady.resolve();
		let sessionFired = false;

		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService(), queryConnectionService.object, configurationService);
		model.onClientSessionReady((session) => sessionFired = true);
		await model.loadContents();
		await model.requestModelLoad();
		// starting client session fails at startSessionInstance due to:
		// Cannot set property 'defaultKernelLoaded' of undefined
		await assert.rejects(async () => { await model.startSession(executeManagers[0]); });
		// Then I expect load to succeed
		assert.strictEqual(model.cells.length, 1);
		assert(model.clientSession);
		// but on server load completion I expect error state to be set
		// Note: do not expect serverLoad event to throw even if failed
		await model.sessionLoadFinished;
		assert.strictEqual(model.inErrorState, false);
		assert.strictEqual(sessionFired, false);
	});

	test('Should not be in error state if client session initialization succeeds', async function (): Promise<void> {
		let model = await loadModelAndStartClientSession(expectedNotebookContent);

		assert.strictEqual(model.inErrorState, false);
		assert.strictEqual(model.executeManagers.length, 1);
		assert.deepStrictEqual(model.clientSession, mockClientSession);
	});

	test('Should notify on trust set', async function () {
		// Given a notebook that's been loaded
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentLoader);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(expectedNotebookContent));
		defaultModelOptions.contentLoader = mockContentManager.object;
		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService(), queryConnectionService.object, configurationService);
		await model.requestModelLoad();

		let actualChanged: NotebookContentChange;
		model.contentChanged((changed) => actualChanged = changed);
		// When I change trusted state
		model.trustedMode = true;

		// Then content changed notification should be sent
		assert(model.trustedMode);
		assert(!isUndefinedOrNull(actualChanged));
		assert.strictEqual(actualChanged.changeType, NotebookChangeType.TrustChanged);
	});

	test('Should close active session when closed', async function () {
		let model = await loadModelAndStartClientSession(expectedNotebookContent);
		// After client session is started, ensure session is ready
		assert(model.isSessionReady);

		// After closing the notebook
		await model.handleClosed();
		// Ensure client session is cleaned up
		assert(isUndefinedOrNull(model.clientSession), 'clientSession is not cleaned up properly');
		// Ensure session is no longer ready
		assert.strictEqual(model.isSessionReady, false, 'session is incorrectly showing as ready');
	});

	test('Should disconnect when connection profile created by notebook', async function () {
		let model = await loadModelAndStartClientSession(expectedNotebookContent);
		// Ensure notebook prefix is present in the connection URI
		queryConnectionService.setup(c => c.getConnectionUri(TypeMoq.It.isAny())).returns(() => `${uriPrefixes.notebook}some/path`);
		await changeContextWithConnectionProfile(model);

		// After client session is started, ensure context isn't null/undefined
		assert(!isUndefinedOrNull(model.context), 'context should exist after call to change context');

		// After closing the notebook
		await model.handleClosed();

		// Ensure disconnect is called once
		queryConnectionService.verify((c) => c.disconnect(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	test('Should not disconnect when connection profile not created by notebook', async function () {
		let model = await loadModelAndStartClientSession(expectedNotebookContent);
		// Ensure notebook prefix isn't present in connection URI
		queryConnectionService.setup(c => c.getConnectionUri(TypeMoq.It.isAny())).returns(() => `${uriPrefixes.default}some/path`);
		await changeContextWithConnectionProfile(model);

		// After client session is started, ensure context isn't null/undefined
		assert(!isUndefinedOrNull(model.context), 'context should exist after call to change context');

		// After closing the notebook
		await model.handleClosed();

		// Ensure disconnect is never called
		queryConnectionService.verify((c) => c.disconnect(TypeMoq.It.isAny()), TypeMoq.Times.never());

	});

	test('Should not delete custom metadata', async function (): Promise<void> {
		expectedNotebookContent.metadata['custom-string'] = 'some_string';
		expectedNotebookContent.metadata['custom-object'] = { prop1: 'value1', prop2: 'value2' };

		// Given a notebook
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentLoader);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(expectedNotebookContent));
		defaultModelOptions.contentLoader = mockContentManager.object;
		// When I initialize the model
		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, undefined, queryConnectionService.object, configurationService);
		await model.loadContents();

		let output = model.toJSON();
		assert(output.metadata['custom-string'] === 'some_string', 'Custom metadata was not preserved');
		assert(output.metadata['custom-object']['prop1'] === 'value1', 'Custom metadata for object was not preserved');
		assert(output.metadata['custom-object']['prop2'] === 'value2', 'Custom metadata for object was not preserved');
	});

	test('Should connect to Fake (kernel alias) connection and set kernelAlias', async function () {
		let model = await loadModelAndStartClientSession(expectedNotebookContent);

		// Ensure notebook prefix is present in the connection URI
		queryConnectionService.setup(c => c.getConnectionUri(TypeMoq.It.isAny())).returns(() => `${uriPrefixes.notebook}some/path`);
		await changeContextWithFakeConnectionProfile(model);

		//Check to see if Alias is added to kernelAliases
		assert(!isUndefinedOrNull(model.kernelAliases));
		let expectedAlias = ['fakeAlias'];
		let kernelAliases = model.kernelAliases;

		assert.strictEqual(kernelAliases.length, 1);
		assert(kernelAliases.includes(expectedAlias[0]));

		// // After client session is started, ensure context isn't null/undefined
		assert(!isUndefinedOrNull(model.context), 'context should exist after call to change context');

		// After closing the notebook
		await model.handleClosed();

		// Ensure disconnect is called once
		queryConnectionService.verify((c) => c.disconnect(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	test('Should change kernel when connecting to a Fake (kernel alias) connection', async function () {
		let model = await loadModelAndStartClientSession(expectedNotebookContent);
		// Ensure notebook prefix is present in the connection URI
		queryConnectionService.setup(c => c.getConnectionUri(TypeMoq.It.isAny())).returns(() => `${uriPrefixes.notebook}some/path`);
		await changeContextWithFakeConnectionProfile(model);

		// // After client session is started, ensure context isn't null/undefined
		assert(!isUndefinedOrNull(model.context), 'context should exist after call to change context');

		let notebookKernelAlias = model.context.serverCapabilities.notebookKernelAlias;
		let doChangeKernelStub = sinon.spy(model, 'doChangeKernel' as keyof NotebookModel);

		model.changeKernel(notebookKernelAlias);
		assert.strictEqual(model.selectedKernelDisplayName, notebookKernelAlias);
		assert.strictEqual(model.currentKernelAlias, notebookKernelAlias);
		sinon.assert.calledWith(doChangeKernelStub, model.kernelAliases[0]);
		doChangeKernelStub.restore();

		// After closing the notebook
		await model.handleClosed();

		// Ensure disconnect is called once
		queryConnectionService.verify((c) => c.disconnect(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	test('Should change kernel from Fake (kernel alias) to SQL kernel when connecting to SQL connection', async function () {
		let model = await loadModelAndStartClientSession(expectedNotebookContent);

		// Ensure notebook prefix is present in the connection URI
		queryConnectionService.setup(c => c.getConnectionUri(TypeMoq.It.isAny())).returns(() => `${uriPrefixes.notebook}some/path`);
		// Connect to fake connection enables kernel alias connection
		await changeContextWithFakeConnectionProfile(model);

		// After client session is started, ensure context isn't null/undefined
		assert(!isUndefinedOrNull(model.context), 'context should exist after call to change context');

		let notebookKernelAlias = model.context.serverCapabilities.notebookKernelAlias;
		let doChangeKernelStub = sinon.spy(model, 'doChangeKernel' as keyof NotebookModel);

		// Change kernel first to alias kernel and then connect to SQL connection
		model.changeKernel(notebookKernelAlias);
		assert.strictEqual(model.selectedKernelDisplayName, notebookKernelAlias);
		assert.strictEqual(model.currentKernelAlias, notebookKernelAlias);
		sinon.assert.called(doChangeKernelStub);
		doChangeKernelStub.restore();

		// Change to SQL connection from Fake connection
		await changeContextWithConnectionProfile(model);
		let expectedKernel = 'SQL';
		model.changeKernel(expectedKernel);
		assert.strictEqual(model.selectedKernelDisplayName, expectedKernel);
		assert.strictEqual(model.currentKernelAlias, undefined);
		sinon.assert.called(doChangeKernelStub);
		doChangeKernelStub.restore();

		// After closing the notebook
		await model.handleClosed();

		// Ensure disconnect is called once
		queryConnectionService.verify((c) => c.disconnect(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	test('Should read connection name from notebook metadata and use its corresponding connection profile', async function () {
		const connectionName = 'connectionName';
		// Given a notebook with a connection name in metadata
		let notebook: nb.INotebookContents = {
			cells: [],
			metadata: {
				connection_name: connectionName
			},
			nbformat: 4,
			nbformat_minor: 5
		};
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentLoader);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(notebook));
		defaultModelOptions.contentLoader = mockContentManager.object;

		// And a matching connection profile
		let expectedConnectionProfile = <ConnectionProfile>{
			connectionName: connectionName,
			serverName: '',
			databaseName: '',
			userName: '',
			password: '',
			authenticationType: '',
			savePassword: true,
			groupFullName: '',
			groupId: '',
			getOptionsKey: () => '',
			matches: undefined,
			providerName: '',
			saveProfile: true,
			id: '',
			options: {}
		};
		sinon.stub(queryConnectionService.object, 'getConnections').returns([expectedConnectionProfile]);
		sinon.stub(configurationService, 'getValue').returns(true);

		// When I initialize the model
		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService(), queryConnectionService.object, configurationService);
		await model.loadContents();

		// I expect the saved connection name to be read
		assert.strictEqual(model.savedConnectionName, connectionName);

		// When I request a connection
		let spy = sinon.stub(model, 'changeContext').returns(Promise.resolve());
		model.requestConnection();

		// I expect the connection profile matching the saved connection name to be used
		assert.ok(spy.calledWith(connectionName, expectedConnectionProfile));
	});

	test('should read and write multi_connection_mode to notebook metadata correctly', async function () {
		// Given a notebook with multi_connection_mode: true in metadata
		let notebook: nb.INotebookContents = {
			cells: [],
			metadata: {
				multi_connection_mode: true
			},
			nbformat: 4,
			nbformat_minor: 5
		};
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentLoader);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(notebook));
		defaultModelOptions.contentLoader = mockContentManager.object;

		// When I initialize the model
		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService(), queryConnectionService.object, configurationService);
		await model.loadContents();

		// I expect multiConnectionMode to be set to true
		assert.strictEqual(model.multiConnectionMode, true, 'multi_connection_mode not read correctly from notebook metadata');

		// When I change multiConnectionMode to false
		model.multiConnectionMode = false;

		// I expect multi_connection_mode to not be in the notebook metadata
		let output: nb.INotebookContents = model.toJSON();
		assert.strictEqual(output.metadata['multi_connection_mode'], undefined, 'multi_connection_mode saved in notebook metadata when it should not be');

		// When I change multiConnectionMode to true
		model.multiConnectionMode = true;

		// I expect multi_connection_mode to be in the notebook metadata
		output = model.toJSON();
		assert.strictEqual(output.metadata['multi_connection_mode'], true, 'multi_connection_mode not saved correctly to notebook metadata');
	});

	test('Should keep kernel alias as language info kernel alias name even if kernel spec is seralized as SQL', async function () {
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentLoader);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(expectedKernelAliasNotebookContentOneCell));
		defaultModelOptions.contentLoader = mockContentManager.object;

		queryConnectionService.setup(c => c.getActiveConnections(TypeMoq.It.isAny())).returns(() => null);

		// Given I have a session that fails to start
		sessionReady.resolve();

		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService(), queryConnectionService.object, configurationService);
		await model.loadContents();

		await model.requestModelLoad();

		// Check to see if language info is set to kernel alias
		assert.strictEqual(model.languageInfo.name, 'fake', 'Notebook language info is not set properly');
	});

	async function loadModelAndStartClientSession(notebookContent: nb.INotebookContents): Promise<NotebookModel> {
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentLoader);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(notebookContent));
		defaultModelOptions.contentLoader = mockContentManager.object;

		queryConnectionService.setup(c => c.getActiveConnections(TypeMoq.It.isAny())).returns(() => null);

		sessionReady.resolve();
		let actualSession: IClientSession = undefined;

		let options: INotebookModelOptions = Object.assign({}, defaultModelOptions, <Partial<INotebookModelOptions>>{
			factory: mockModelFactory.object
		});
		let model = new NotebookModel(options, undefined, logService, undefined, new NullAdsTelemetryService(), queryConnectionService.object, configurationService, capabilitiesService);
		model.onClientSessionReady((session) => actualSession = session);

		await model.requestModelLoad();

		await model.startSession(executeManagers[0]);

		// Then I expect load to succeed
		assert(!isUndefinedOrNull(model.clientSession), 'clientSession should exist after session is started');

		assert.deepStrictEqual(actualSession, mockClientSession, 'session returned is not the expected object');

		// but on server load completion I expect error state to be set
		// Note: do not expect serverLoad event to throw even if failed
		await model.sessionLoadFinished;
		return model;
	}

	async function changeContextWithConnectionProfile(model: NotebookModel) {
		let connection = new ConnectionProfile(capabilitiesService, {
			connectionName: 'newName',
			savePassword: false,
			groupFullName: 'testGroup',
			serverName: 'testServerName',
			databaseName: 'testDatabaseName',
			authenticationType: 'integrated',
			password: 'test',
			userName: 'testUsername',
			groupId: undefined,
			providerName: mssqlProviderName,
			options: {},
			saveProfile: true,
			id: 'testID'
		});

		await model.changeContext(connection.connectionName, connection);
	}

	async function changeContextWithFakeConnectionProfile(model: NotebookModel) {
		let fakeConnection = new ConnectionProfile(capabilitiesService, {
			connectionName: 'newName',
			savePassword: false,
			groupFullName: 'testGroup',
			serverName: 'testServerName',
			databaseName: 'testDatabaseName',
			authenticationType: 'integrated',
			password: 'test',
			userName: 'testUsername',
			groupId: undefined,
			providerName: 'FAKE',
			options: {},
			saveProfile: true,
			id: 'testID'
		});

		await model.changeContext(fakeConnection.connectionName, fakeConnection);
	}
});

