/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import { nb } from 'azdata';
import * as assert from 'assert';

import { INotificationService } from 'vs/platform/notification/common/notification';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { URI } from 'vs/base/common/uri';

import { NotebookManagerStub } from 'sql/workbench/contrib/notebook/test/stubs';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { ModelFactory } from 'sql/workbench/services/notebook/browser/models/modelFactory';
import { IClientSession, INotebookModelOptions, NotebookContentChange, IClientSessionOptions, ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { ClientSession } from 'sql/workbench/services/notebook/browser/models/clientSession';
import { CellTypes, NotebookChangeType } from 'sql/workbench/services/notebook/common/contracts';
import { Deferred } from 'sql/base/common/promise';
import { Memento } from 'vs/workbench/common/memento';
import { Emitter } from 'vs/base/common/event';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { NullLogService } from 'vs/platform/log/common/log';
import { TestConnectionManagementService } from 'sql/platform/connection/test/common/testConnectionManagementService';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { assign } from 'vs/base/common/objects';
import { NotebookEditorContentManager } from 'sql/workbench/contrib/notebook/browser/models/notebookInput';
import { SessionManager } from 'sql/workbench/contrib/notebook/test/emptySessionClasses';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { uriPrefixes } from 'sql/platform/connection/common/utils';
import { NullAdsTelemetryService } from 'sql/platform/telemetry/common/adsTelemetryService';

let expectedNotebookContent: nb.INotebookContents = {
	cells: [{
		cell_type: CellTypes.Code,
		source: ['insert into t1 values (c1, c2)'],
		metadata: { language: 'python' },
		execution_count: 1
	}, {
		cell_type: CellTypes.Markdown,
		source: ['I am *markdown*'],
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
	nbformat_minor: 5
};

let expectedNotebookContentOneCell: nb.INotebookContents = {
	cells: [{
		cell_type: CellTypes.Code,
		source: ['insert into t1 values (c1, c2)'],
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
	nbformat_minor: 5
};

let defaultUri = URI.file('/some/path.ipynb');

let mockClientSession: TypeMoq.Mock<IClientSession>;
let clientSessionOptions: IClientSessionOptions;
let sessionReady: Deferred<void>;
let mockModelFactory: TypeMoq.Mock<ModelFactory>;
let notificationService: TypeMoq.Mock<INotificationService>;
let capabilitiesService: TypeMoq.Mock<ICapabilitiesService>;
let instantiationService: IInstantiationService;

suite('notebook model', function (): void {
	let notebookManagers = [new NotebookManagerStub()];
	let mockSessionManager: TypeMoq.Mock<nb.SessionManager>;
	let memento: TypeMoq.Mock<Memento>;
	let queryConnectionService: TypeMoq.Mock<TestConnectionManagementService>;
	let defaultModelOptions: INotebookModelOptions;
	const logService = new NullLogService();
	setup(() => {
		mockSessionManager = TypeMoq.Mock.ofType(SessionManager);
		notebookManagers[0].sessionManager = mockSessionManager.object;
		sessionReady = new Deferred<void>();
		notificationService = TypeMoq.Mock.ofType(TestNotificationService, TypeMoq.MockBehavior.Loose);
		capabilitiesService = TypeMoq.Mock.ofType(TestCapabilitiesService);
		memento = TypeMoq.Mock.ofType(Memento, TypeMoq.MockBehavior.Loose, '');
		memento.setup(x => x.getMemento(TypeMoq.It.isAny())).returns(() => void 0);
		queryConnectionService = TypeMoq.Mock.ofType(TestConnectionManagementService, TypeMoq.MockBehavior.Loose, memento.object, undefined, new TestStorageService());
		queryConnectionService.callBase = true;
		let serviceCollection = new ServiceCollection();
		instantiationService = new InstantiationService(serviceCollection, true);
		defaultModelOptions = {
			notebookUri: defaultUri,
			factory: new ModelFactory(instantiationService),
			notebookManagers,
			contentManager: undefined,
			notificationService: notificationService.object,
			connectionService: queryConnectionService.object,
			providerId: 'SQL',
			cellMagicMapper: undefined,
			defaultKernel: undefined,
			layoutChanged: undefined,
			capabilitiesService: capabilitiesService.object
		};
		clientSessionOptions = {
			notebookManager: defaultModelOptions.notebookManagers[0],
			notebookUri: defaultModelOptions.notebookUri,
			notificationService: notificationService.object,
			kernelSpec: defaultModelOptions.defaultKernel
		};
		mockClientSession = TypeMoq.Mock.ofType(ClientSession, undefined, clientSessionOptions);
		mockClientSession.setup(c => c.initialize()).returns(() => {
			return Promise.resolve();
		});
		mockClientSession.setup(c => c.ready).returns(() => sessionReady.promise);
		mockModelFactory = TypeMoq.Mock.ofType(ModelFactory);
		mockModelFactory.callBase = true;
		mockModelFactory.setup(f => f.createClientSession(TypeMoq.It.isAny())).returns(() => {
			return mockClientSession.object;
		});
	});

	test('Should create no cells if model has no contents', async function (): Promise<void> {
		// Given an empty notebook
		let emptyNotebook: nb.INotebookContents = {
			cells: [],
			metadata: {
				kernelspec: {
					name: 'mssql',
					language: 'sql'
				}
			},
			nbformat: 4,
			nbformat_minor: 5
		};

		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentManager);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(emptyNotebook));
		defaultModelOptions.contentManager = mockContentManager.object;
		// When I initialize the model
		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService());
		await model.loadContents();

		// Then I expect to have 0 code cell as the contents
		assert.equal(model.cells.length, 0);

		// And Trust should be true by default if there are no cells
		assert(model.trustedMode);
	});

	test('Should use trusted state set in model load', async function (): Promise<void> {
		// Given a notebook
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentManager);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(expectedNotebookContent));
		defaultModelOptions.contentManager = mockContentManager.object;
		// When I initialize the model
		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService());
		await model.loadContents(true);
		await model.requestModelLoad();

		// Then Trust should be true
		assert(model.trustedMode);
	});

	test('Should throw if model load fails', async function (): Promise<void> {
		// Given a call to get Contents fails
		let error = new Error('File not found');
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentManager);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.reject(error));//.throws(error);
		defaultModelOptions.contentManager = mockContentManager.object;

		// When I initalize the model
		// Then it should throw
		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService());
		assert.equal(model.inErrorState, false);
		await assert.rejects(async () => { await model.loadContents(); });
		assert.equal(model.inErrorState, true);
	});

	test('Should convert cell info to CellModels', async function (): Promise<void> {
		// Given a notebook with 2 cells
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentManager);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(expectedNotebookContent));
		defaultModelOptions.contentManager = mockContentManager.object;

		// When I initalize the model
		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService());
		await model.loadContents();

		// Then I expect all cells to be in the model
		assert.equal(model.cells.length, 2);
		assert.deepEqual(model.cells[0].source, expectedNotebookContent.cells[0].source);
		assert.deepEqual(model.cells[1].source, expectedNotebookContent.cells[1].source);
	});

	test('Should handle multiple notebook managers', async function (): Promise<void> {
		// Given a notebook with 2 cells
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentManager);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(expectedNotebookContent));
		defaultModelOptions.contentManager = mockContentManager.object;

		let defaultNotebookManager = new NotebookManagerStub();
		defaultNotebookManager.providerId = 'SQL';

		let jupyterNotebookManager = new NotebookManagerStub();
		jupyterNotebookManager.providerId = 'jupyter';

		// Setup 2 notebook managers
		defaultModelOptions.notebookManagers = [defaultNotebookManager, jupyterNotebookManager];

		// Change default notebook provider id to jupyter
		defaultModelOptions.providerId = 'jupyter';

		// When I initalize the model
		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService());
		await model.loadContents();

		// I expect the default provider to be jupyter
		assert.equal(model.notebookManager.providerId, 'jupyter', 'Notebook manager provider id incorrect');

		// Similarly, change default notebook provider id to SQL
		defaultModelOptions.providerId = 'SQL';

		// When I initalize the model
		model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService());
		await model.loadContents();

		// I expect the default provider to be SQL
		assert.equal(model.notebookManager.providerId, 'SQL', 'Notebook manager provider id incorrect after 2nd model load');

		// Check that the getters return  the correct values
		assert.equal(model.notebookManagers.length, 2, 'There should be 2 notebook managers');
		assert(!isUndefinedOrNull(model.getNotebookManager('SQL')), 'SQL notebook manager is not defined');
		assert(!isUndefinedOrNull(model.getNotebookManager('jupyter')), 'Jupyter notebook manager is not defined');
		assert(isUndefinedOrNull(model.getNotebookManager('foo')), 'foo notebook manager is incorrectly defined');

		// Check other properties to ensure that they're returning as expected
		// No server manager was passed into the notebook manager stub, so expect hasServerManager to return false
		assert.equal(model.hasServerManager, false, 'Notebook model should not have a server manager');
		assert.equal(model.notebookUri, defaultModelOptions.notebookUri, 'Notebook model has incorrect URI');
	});

	test('Should set active cell correctly', async function (): Promise<void> {
		// Given a notebook with 2 cells
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentManager);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(expectedNotebookContent));
		defaultModelOptions.contentManager = mockContentManager.object;

		// When I initalize the model
		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService());
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
		assert.equal(model.cells.length, 2, 'Cell count in notebook model is not correct');

		// Set the first cell as active
		model.updateActiveCell(model.cells[0]);
		assert.deepEqual(model.activeCell, model.cells[0], 'Active cell does not match the first cell');
		assert.deepEqual(model.activeCell, activeCellFromEvent, 'Active cell returned from the event does not match');
		assert.equal(activeCellChangeCount, 1, 'Active cell change count is incorrect');
		assert(isUndefinedOrNull(notebookContentChange), 'Content change should be undefined');


		// Set the second cell as active
		model.updateActiveCell(model.cells[1]);
		assert.deepEqual(model.activeCell, model.cells[1], 'Active cell does not match expected value');
		assert.deepEqual(model.activeCell, activeCellFromEvent, 'Active cell returned from the event does not match (2nd)');
		assert.equal(activeCellChangeCount, 2, 'Active cell change count is incorrect; should be 2');

		// Delete the active cell
		model.deleteCell(model.cells[1]);
		assert(isUndefinedOrNull(model.activeCell), 'Active cell should be undefined after active cell is deleted');
		assert.deepEqual(model.activeCell, activeCellFromEvent, 'Active cell should match value from event');
		assert.equal(activeCellChangeCount, 3, 'Active cell change count is incorrect; should be 3');

		// Set the remaining cell as active
		model.updateActiveCell(model.cells[0]);
		assert.deepEqual(model.activeCell, activeCellFromEvent, 'Active cell should match value from event');
		assert.equal(activeCellChangeCount, 4, 'Active cell change count is incorrect; should be 4');

		// Add new cell
		let newCell = model.addCell(CellTypes.Code, 0);

		// Ensure new cell is active cell
		assert.deepEqual(model.activeCell, newCell, 'Active cell does not match newly created cell');
		assert.equal(activeCellChangeCount, 5, 'Active cell change count is incorrect; should be 5');
	});

	test('Should delete cells correctly', async function (): Promise<void> {
		// Given a notebook with 2 cells
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentManager);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(expectedNotebookContent));
		defaultModelOptions.contentManager = mockContentManager.object;

		// When I initalize the model
		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService());
		await model.loadContents();

		// Count number of times onError event is fired
		let errorCount = 0;
		let notebookContentChange: NotebookContentChange;
		model.onError(() => errorCount++);
		model.contentChanged(c => notebookContentChange = c);

		// Then I expect all cells to be in the model
		assert.equal(model.cells.length, 2, 'Cell count in model is incorrect');

		assert.equal(model.findCellIndex(model.cells[0]), 0, 'findCellIndex returned wrong cell info for first cell');
		assert.equal(model.findCellIndex(model.cells[1]), 1, 'findCellIndex returned wrong cell info for second cell');
		// Delete the first cell
		model.deleteCell(model.cells[0]);
		assert.equal(model.cells.length, 1, 'Cell model length should be 1 after cell deletion');
		assert.deepEqual(model.cells[0].source, expectedNotebookContent.cells[1].source, 'Expected cell source is incorrect');
		assert.equal(model.findCellIndex(model.cells[0]), 0, 'findCellIndex returned wrong cell info for only remaining cell');
		assert.equal(notebookContentChange.changeType, NotebookChangeType.CellsModified, 'notebookContentChange changeType is incorrect');
		assert.equal(notebookContentChange.isDirty, true, 'notebookContentChange should set dirty flag');
		assert.equal(model.activeCell, undefined, 'active cell is not undefined');

		// Delete the remaining cell
		notebookContentChange = undefined;
		model.deleteCell(model.cells[0]);
		assert.equal(model.cells.length, 0, 'There should be no cells tracked in the notebook model');
		assert.equal(model.findCellIndex(model.cells[0]), -1, 'findCellIndex is incorrectly finding a deleted cell');
		assert.equal(errorCount, 0, 'There should be no errors after deleting a cell that exists');
		assert.equal(notebookContentChange.changeType, NotebookChangeType.CellsModified, 'notebookContentChange changeType should indicate CellsModified');
		assert.equal(model.activeCell, undefined, 'Active cell should be undefined');

		// Try deleting the cell again
		notebookContentChange = undefined;
		model.deleteCell(model.cells[0]);
		assert.equal(errorCount, 1, 'The model should record an error after trying to delete a cell that does not exist');
		assert(isUndefinedOrNull(notebookContentChange), 'There should be no content change after an error is recorded');

		// Try deleting as notebook model is in error state
		notebookContentChange = undefined;
		model.deleteCell(model.cells[0]);
		assert.equal(errorCount, 2, 'Error count should be 2 after trying to delete a cell that does not exist a second time');
		assert(isUndefinedOrNull(notebookContentChange), 'There still should be no content change after an error is recorded');

	});

	test('Should load contents but then go to error state if client session startup fails', async function (): Promise<void> {
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentManager);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(expectedNotebookContentOneCell));
		defaultModelOptions.contentManager = mockContentManager.object;

		// Given I have a session that fails to start
		mockClientSession.setup(c => c.isInErrorState).returns(() => true);
		mockClientSession.setup(c => c.errorMessage).returns(() => 'Error');
		sessionReady.resolve();
		let sessionFired = false;

		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService());
		model.onClientSessionReady((session) => sessionFired = true);
		await model.loadContents();
		await model.requestModelLoad();
		// starting client session fails at startSessionInstance due to:
		// Cannot set property 'defaultKernelLoaded' of undefined
		await assert.rejects(async () => { await model.startSession(notebookManagers[0]); });
		// Then I expect load to succeed
		assert.equal(model.cells.length, 1);
		assert(model.clientSession);
		// but on server load completion I expect error state to be set
		// Note: do not expect serverLoad event to throw even if failed
		await model.sessionLoadFinished;
		assert.equal(model.inErrorState, false);
		assert.equal(sessionFired, false);
	});

	test('Should not be in error state if client session initialization succeeds', async function (): Promise<void> {
		let model = await loadModelAndStartClientSession();

		assert.equal(model.inErrorState, false);
		assert.equal(model.notebookManagers.length, 1);
		assert.deepEqual(model.clientSession, mockClientSession.object);
	});

	test('Should notify on trust set', async function () {
		// Given a notebook that's been loaded
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentManager);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(expectedNotebookContent));
		defaultModelOptions.contentManager = mockContentManager.object;
		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService());
		await model.requestModelLoad();

		let actualChanged: NotebookContentChange;
		model.contentChanged((changed) => actualChanged = changed);
		// When I change trusted state
		model.trustedMode = true;

		// Then content changed notification should be sent
		assert(model.trustedMode);
		assert(!isUndefinedOrNull(actualChanged));
		assert.equal(actualChanged.changeType, NotebookChangeType.TrustChanged);
	});

	test('Should close active session when closed', async function () {
		let model = await loadModelAndStartClientSession();
		// After client session is started, ensure session is ready
		assert(model.isSessionReady);

		// After closing the notebook
		await model.handleClosed();
		// Ensure client session is cleaned up
		assert(isUndefinedOrNull(model.clientSession), 'clientSession is not cleaned up properly');
		// Ensure session is no longer ready
		assert.equal(model.isSessionReady, false, 'session is incorrectly showing as ready');
	});

	test('Should disconnect when connection profile created by notebook', async function () {
		let model = await loadModelAndStartClientSession();
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
		let model = await loadModelAndStartClientSession();
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
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentManager);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(expectedNotebookContent));
		defaultModelOptions.contentManager = mockContentManager.object;
		// When I initialize the model
		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, undefined);
		await model.loadContents();

		let output = model.toJSON();
		assert(output.metadata['custom-string'] === 'some_string', 'Custom metadata was not preserved');
		assert(output.metadata['custom-object']['prop1'] === 'value1', 'Custom metadata for object was not preserved');
		assert(output.metadata['custom-object']['prop2'] === 'value2', 'Custom metadata for object was not preserved');
	});

	async function loadModelAndStartClientSession(): Promise<NotebookModel> {
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentManager);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(expectedNotebookContent));
		defaultModelOptions.contentManager = mockContentManager.object;
		let kernelChangedEmitter: Emitter<nb.IKernelChangedArgs> = new Emitter<nb.IKernelChangedArgs>();
		let statusChangedEmitter: Emitter<nb.ISession> = new Emitter<nb.ISession>();

		mockClientSession.setup(c => c.isInErrorState).returns(() => false);
		mockClientSession.setup(c => c.isReady).returns(() => true);
		mockClientSession.setup(c => c.kernelChanged).returns(() => kernelChangedEmitter.event);
		mockClientSession.setup(c => c.statusChanged).returns(() => statusChangedEmitter.event);

		queryConnectionService.setup(c => c.getActiveConnections(TypeMoq.It.isAny())).returns(() => null);

		sessionReady.resolve();
		let actualSession: IClientSession = undefined;

		let options: INotebookModelOptions = assign({}, defaultModelOptions, <Partial<INotebookModelOptions>>{
			factory: mockModelFactory.object
		});
		let model = new NotebookModel(options, undefined, logService, undefined, new NullAdsTelemetryService());
		model.onClientSessionReady((session) => actualSession = session);
		await model.requestModelLoad();

		await model.startSession(notebookManagers[0]);

		// Then I expect load to succeed
		assert(!isUndefinedOrNull(model.clientSession), 'clientSession should exist after session is started');

		assert.deepEqual(actualSession, mockClientSession.object, 'session returned is not the expected object');

		// but on server load completion I expect error state to be set
		// Note: do not expect serverLoad event to throw even if failed
		await model.sessionLoadFinished;
		return model;
	}

	async function changeContextWithConnectionProfile(model: NotebookModel) {
		let connection = new ConnectionProfile(capabilitiesService.object, {
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
});

