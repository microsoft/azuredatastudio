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

import { ExecuteManagerStub, NotebookServiceStub, SerializationManagerStub } from 'sql/workbench/contrib/notebook/test/stubs';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { ModelFactory } from 'sql/workbench/services/notebook/browser/models/modelFactory';
import { ICellModel, INotebookModelOptions } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { Memento } from 'vs/workbench/common/memento';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { mock, TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { ILogService, NullLogService } from 'vs/platform/log/common/log';
import { TestConnectionManagementService } from 'sql/platform/connection/test/common/testConnectionManagementService';
import { NotebookEditorContentLoader } from 'sql/workbench/contrib/notebook/browser/models/notebookInput';
import { SessionManager } from 'sql/workbench/contrib/notebook/test/emptySessionClasses';
import { NullAdsTelemetryService } from 'sql/platform/telemetry/common/adsTelemetryService';
import { CellTypes, NotebookChangeType } from 'sql/workbench/services/notebook/common/contracts';
import { NotebookViewsExtension } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewsExtension';
import { TestConfigurationService } from 'sql/platform/connection/test/common/testConfigurationService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { NotebookViewModel } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewModel';
import { INotebookService, SQL_NOTEBOOK_PROVIDER } from 'sql/workbench/services/notebook/browser/notebookService';
import { NBFORMAT, NBFORMAT_MINOR } from 'sql/workbench/common/constants';
import { Emitter } from 'vs/base/common/event';
import { IStandardKernelWithProvider } from 'sql/workbench/services/notebook/browser/models/notebookUtils';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { ICommandService, NullCommandService } from 'vs/platform/commands/common/commands';
import { ILanguageService } from 'vs/editor/common/languages/language';

let initialNotebookContent: nb.INotebookContents = {
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
		},
	},
	nbformat: NBFORMAT,
	nbformat_minor: NBFORMAT_MINOR
};

let notebookContentWithoutMeta: nb.INotebookContents = {
	cells: [{
		cell_type: CellTypes.Code,
		source: ['insert into t1 values (c1, c2)'],
		execution_count: 1
	}, {
		cell_type: CellTypes.Markdown,
		source: ['I am *markdown*'],
		execution_count: 1
	}],
	metadata: {},
	nbformat: NBFORMAT,
	nbformat_minor: NBFORMAT_MINOR
};

let defaultUri = URI.file('/some/path.ipynb');
let notificationService: TypeMoq.Mock<INotificationService>;
let capabilitiesService: TypeMoq.Mock<ICapabilitiesService>;
let instantiationService: TestInstantiationService;
let configurationService: IConfigurationService;

suite('NotebookViewModel', function (): void {
	let defaultViewName = 'Default New View';
	let serializationManagers = [new SerializationManagerStub()];
	let executeManagers = [new ExecuteManagerStub()];
	let mockSessionManager: TypeMoq.Mock<nb.SessionManager>;
	let memento: TypeMoq.Mock<Memento>;
	let queryConnectionService: TypeMoq.Mock<TestConnectionManagementService>;
	let defaultModelOptions: INotebookModelOptions;
	const logService = new NullLogService();
	setup(() => {
		setupServices();
	});

	test('initialize', async function (): Promise<void> {
		let notebookViews = await initializeNotebookViewsExtension(initialNotebookContent);
		let viewModel = new NotebookViewModel(defaultViewName, notebookViews);
		viewModel.initialize(true); //is new view


		assert.strictEqual(viewModel.cards.length, 2, 'View model was not initialized with the correct number of cards');
		assert.strictEqual(viewModel.cells.length, 2, 'View model was not initialized with the correct number of cells');
		assert.strictEqual(viewModel.name, defaultViewName, 'View model was not inirialized with the correct name');
	});

	test('initialize notebook with no metadata', async function (): Promise<void> {
		let notebookViews = await initializeNotebookViewsExtension(notebookContentWithoutMeta);
		let viewModel = new NotebookViewModel(defaultViewName, notebookViews);
		viewModel.initialize(true);

		assert.strictEqual(viewModel.cards.length, 2, 'View model with no metadata was not initialized with the correct number of cards');
		assert.strictEqual(viewModel.cells.length, 2, 'View model with no metadata was not initialized with the correct number of cells');
		assert.strictEqual(viewModel.name, defaultViewName, 'View model with no metadata was not inirialized with the correct name');
	});

	test('rename', async function (): Promise<void> {
		let exceptionThrown = false;
		let notebookViews = await initializeNotebookViewsExtension(initialNotebookContent);

		const view = notebookViews.createNewView(defaultViewName);

		try {
			view.name = `${defaultViewName} 1`;
		} catch (e) {
			exceptionThrown = true;
		}

		assert.strictEqual(view.name, `${defaultViewName} 1`, 'Rename did not result in expected name');
		assert(!exceptionThrown);
	});

	test('duplicate name', async function (): Promise<void> {
		let exceptionThrown = false;
		let notebookViews = await initializeNotebookViewsExtension(initialNotebookContent);

		notebookViews.createNewView(defaultViewName);
		let viewModel2 = notebookViews.createNewView(`${defaultViewName} 1`);


		try {
			viewModel2.name = defaultViewName;
		} catch (e) {
			exceptionThrown = true;
		}

		assert(exceptionThrown, 'Duplicating a view name should throw an exception');
	});

	test('hide cell', async function (): Promise<void> {
		let notebookViews = await initializeNotebookViewsExtension(initialNotebookContent);
		let viewModel = notebookViews.createNewView(defaultViewName);

		let cellToHide = viewModel.cells[0];

		viewModel.hideCell(cellToHide);

		assert.strictEqual(viewModel.hiddenCells.length, 1, 'Hiding a cell should add it to hiddenCells');
		assert(viewModel.hiddenCells.includes(cellToHide), 'Hiding a cell should add it to hiddenCells');
	});

	test('insert cell', async function (): Promise<void> {
		let notebookViews = await initializeNotebookViewsExtension(initialNotebookContent);
		let viewModel = notebookViews.createNewView(defaultViewName);

		let cellToInsert = viewModel.cells[0];

		viewModel.hideCell(cellToInsert);
		assert(viewModel.hiddenCells.includes(cellToInsert), 'Expecting a hidden cell');

		viewModel.insertCell(cellToInsert);
		assert(!viewModel.hiddenCells.includes(cellToInsert), 'Inserting a cell should remove it from hiddenCells');
	});

	test('move card', async function (): Promise<void> {
		let notebookViews = await initializeNotebookViewsExtension(initialNotebookContent);
		let viewModel = notebookViews.createNewView(defaultViewName);

		viewModel.moveCard(viewModel.cards[0], 98, 99);

		assert.strictEqual(viewModel.cards[0].x, 98, 'Card x position did not update on move');
		assert.strictEqual(viewModel.cards[0].y, 99, 'Card y position did not update on move');
	});

	test('resize card', async function (): Promise<void> {
		let notebookViews = await initializeNotebookViewsExtension(initialNotebookContent);
		let viewModel = notebookViews.createNewView(defaultViewName);

		viewModel.resizeCard(viewModel.cards[0], 3, 4);

		assert.strictEqual(viewModel.cards[0].width, 3, 'Card width did not update on resize');
		assert.strictEqual(viewModel.cards[0].height, 4, 'Card height did not update on resize');
	});

	test('delete', async function (): Promise<void> {
		let notebookViews = await initializeNotebookViewsExtension(initialNotebookContent);
		let viewModel = new NotebookViewModel(defaultViewName, notebookViews);
		viewModel.initialize();

		let CreateOnDeletedPromise = () => {
			return new Promise((resolve, reject) => {
				setTimeout(() => resolve(false), 2000);
				viewModel.onDeleted(() => {
					resolve(true);
				});
			});
		};

		let onDeletedPromise = CreateOnDeletedPromise();
		viewModel.delete();

		let onDeletedCalled = await onDeletedPromise;
		let hasView = notebookViews.getViews().find(view => view.name === defaultViewName);

		assert(onDeletedCalled, 'onDelete event not called');
		assert(!hasView);
	});

	function setupServices() {
		mockSessionManager = TypeMoq.Mock.ofType(SessionManager);
		executeManagers[0].providerId = SQL_NOTEBOOK_PROVIDER;
		executeManagers[0].sessionManager = mockSessionManager.object;
		notificationService = TypeMoq.Mock.ofType<INotificationService>(TestNotificationService, TypeMoq.MockBehavior.Loose);
		capabilitiesService = TypeMoq.Mock.ofType<ICapabilitiesService>(TestCapabilitiesService);
		memento = TypeMoq.Mock.ofType(Memento, TypeMoq.MockBehavior.Loose, '');
		memento.setup(x => x.getMemento(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => void 0);
		queryConnectionService = TypeMoq.Mock.ofType(TestConnectionManagementService, TypeMoq.MockBehavior.Loose, memento.object, undefined, new TestStorageService());
		queryConnectionService.callBase = true;
		configurationService = new TestConfigurationService();

		let serviceCollection = new ServiceCollection();
		serviceCollection.set(ICommandService, NullCommandService);
		serviceCollection.set(IConfigurationService, configurationService);
		serviceCollection.set(ILogService, new NullLogService());
		instantiationService = new TestInstantiationService(serviceCollection, true);
		instantiationService.stub(INotebookService, new class extends mock<INotebookService>() {
			override async serializeNotebookStateChange(notebookUri: URI, changeType: NotebookChangeType, cell?: ICellModel, isTrusted?: boolean): Promise<void> { }
			override notifyCellExecutionStarted(): void { }
		});
		instantiationService.stub(ILanguageService, new class extends mock<ILanguageService>() { });


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
			capabilitiesService: capabilitiesService.object,
			getInputLanguageMode: () => undefined
		};
	}

	async function initializeNotebookViewsExtension(contents: nb.INotebookContents): Promise<NotebookViewsExtension> {
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentLoader);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(contents));
		defaultModelOptions.contentLoader = mockContentManager.object;
		let mockNotebookService = TypeMoq.Mock.ofType(NotebookServiceStub);
		mockNotebookService.setup(s => s.onNotebookKernelsAdded).returns(() => new Emitter<IStandardKernelWithProvider[]>().event);

		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService(), queryConnectionService.object, configurationService, undefined, mockNotebookService.object, undefined, undefined);
		await model.loadContents();
		await model.requestModelLoad();

		const notebookViews = new NotebookViewsExtension(model);
		notebookViews.initialize();

		return notebookViews;
	}
});
