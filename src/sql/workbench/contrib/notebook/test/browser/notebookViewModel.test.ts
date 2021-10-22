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
import { INotebookModelOptions } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { Memento } from 'vs/workbench/common/memento';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { NullLogService } from 'vs/platform/log/common/log';
import { TestConnectionManagementService } from 'sql/platform/connection/test/common/testConnectionManagementService';
import { NotebookEditorContentManager } from 'sql/workbench/contrib/notebook/browser/models/notebookInput';
import { SessionManager } from 'sql/workbench/contrib/notebook/test/emptySessionClasses';
import { NullAdsTelemetryService } from 'sql/platform/telemetry/common/adsTelemetryService';
import { CellTypes } from 'sql/workbench/services/notebook/common/contracts';
import { NotebookViewsExtension } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewsExtension';
import { TestConfigurationService } from 'sql/platform/connection/test/common/testConfigurationService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { NotebookViewModel } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewModel';
import { isUndefinedOrNull } from 'vs/base/common/types';

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
	nbformat: 4,
	nbformat_minor: 5
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
	nbformat: 4,
	nbformat_minor: 5
};

let defaultUri = URI.file('/some/path.ipynb');
let notificationService: TypeMoq.Mock<INotificationService>;
let capabilitiesService: TypeMoq.Mock<ICapabilitiesService>;
let instantiationService: IInstantiationService;
let configurationService: IConfigurationService;

suite('NotebookViewModel', function (): void {
	let defaultViewName = 'Default New View';
	let notebookManagers = [new NotebookManagerStub()];
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
		viewModel.initialize();

		let cellsWithNewView = notebookViews.getCells().filter(cell => cell.views.find(v => v.guid === viewModel.guid));

		assert.strictEqual(cellsWithNewView.length, 2);
		assert.strictEqual(viewModel.cells.length, 2);
		assert.strictEqual(viewModel.name, defaultViewName);
	});

	test('initialize notebook with no metadata', async function (): Promise<void> {
		let notebookViews = await initializeNotebookViewsExtension(notebookContentWithoutMeta);
		let viewModel = new NotebookViewModel(defaultViewName, notebookViews);
		viewModel.initialize();

		let cellsWithNewView = notebookViews.getCells().filter(cell => cell.views.find(v => v.guid === viewModel.guid));

		assert.strictEqual(cellsWithNewView.length, 2);
		assert.strictEqual(viewModel.cells.length, 2);
		assert.strictEqual(viewModel.name, defaultViewName);
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

		assert.strictEqual(view.name, `${defaultViewName} 1`);
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

		assert(exceptionThrown);
	});

	test('hide cell', async function (): Promise<void> {
		let notebookViews = await initializeNotebookViewsExtension(initialNotebookContent);
		let viewModel = new NotebookViewModel(defaultViewName, notebookViews);
		viewModel.initialize();

		let cellToHide = viewModel.cells[0];

		viewModel.hideCell(cellToHide);

		assert.strictEqual(viewModel.hiddenCells.length, 1);
		assert(viewModel.hiddenCells.includes(cellToHide));
	});

	test('insert cell', async function (): Promise<void> {
		let notebookViews = await initializeNotebookViewsExtension(initialNotebookContent);
		let viewModel = new NotebookViewModel(defaultViewName, notebookViews);
		viewModel.initialize();

		let cellToInsert = viewModel.cells[0];

		viewModel.hideCell(cellToInsert);
		assert(viewModel.hiddenCells.includes(cellToInsert));

		viewModel.insertCell(cellToInsert);
		assert(!viewModel.hiddenCells.includes(cellToInsert));
	});

	test('move cell', async function (): Promise<void> {
		let notebookViews = await initializeNotebookViewsExtension(initialNotebookContent);
		let viewModel = new NotebookViewModel(defaultViewName, notebookViews);
		viewModel.initialize();

		let cellToMove = viewModel.cells[0];

		viewModel.moveCell(cellToMove, 98, 99);
		let cellMeta = viewModel.getCellMetadata(cellToMove);

		assert.strictEqual(cellMeta.x, 98);
		assert.strictEqual(cellMeta.y, 99);
	});

	test('resize cell', async function (): Promise<void> {
		let notebookViews = await initializeNotebookViewsExtension(initialNotebookContent);
		let viewModel = new NotebookViewModel(defaultViewName, notebookViews);
		viewModel.initialize();

		let cellToResize = viewModel.cells[0];

		viewModel.resizeCell(cellToResize, 3, 4);
		let cellMeta = viewModel.getCellMetadata(cellToResize);

		assert.strictEqual(cellMeta.width, 3);
		assert.strictEqual(cellMeta.height, 4);
	});

	test('get cell metadata', async function (): Promise<void> {
		let notebookViews = await initializeNotebookViewsExtension(initialNotebookContent);
		let viewModel = new NotebookViewModel(defaultViewName, notebookViews);
		viewModel.initialize();

		let cell = viewModel.cells[0];
		let cellMeta = notebookViews.getExtensionCellMetadata(cell);

		assert(!isUndefinedOrNull(cellMeta.views.find(v => v.guid === viewModel.guid)));
		assert.deepStrictEqual(viewModel.getCellMetadata(cell), cellMeta.views.find(v => v.guid === viewModel.guid));
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
		notebookManagers[0].sessionManager = mockSessionManager.object;
		notificationService = TypeMoq.Mock.ofType<INotificationService>(TestNotificationService, TypeMoq.MockBehavior.Loose);
		capabilitiesService = TypeMoq.Mock.ofType<ICapabilitiesService>(TestCapabilitiesService);
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
	}

	async function initializeNotebookViewsExtension(contents: nb.INotebookContents): Promise<NotebookViewsExtension> {
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentManager);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(contents));
		defaultModelOptions.contentManager = mockContentManager.object;

		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService(), queryConnectionService.object, configurationService);
		await model.loadContents();
		await model.requestModelLoad();

		return new NotebookViewsExtension(model);
	}
});
