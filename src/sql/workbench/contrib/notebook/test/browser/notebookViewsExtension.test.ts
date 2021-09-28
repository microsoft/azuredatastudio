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

let defaultUri = URI.file('/some/path.ipynb');
let notificationService: TypeMoq.Mock<INotificationService>;
let capabilitiesService: TypeMoq.Mock<ICapabilitiesService>;
let instantiationService: IInstantiationService;
let configurationService: IConfigurationService;

suite('NotebookViews', function (): void {
	let defaultViewName = 'Default New View';
	let notebookManagers = [new NotebookManagerStub()];
	let mockSessionManager: TypeMoq.Mock<nb.SessionManager>;
	let memento: TypeMoq.Mock<Memento>;
	let queryConnectionService: TypeMoq.Mock<TestConnectionManagementService>;
	let defaultModelOptions: INotebookModelOptions;
	let serviceCollection = new ServiceCollection();
	let logService = new NullLogService();
	let notebookViews: NotebookViewsExtension;
	setup(async () => {
		setupServices();
		notebookViews = await initializeExtension();
	});

	test('create new view', async function (): Promise<void> {
		assert.strictEqual(notebookViews.getViews().length, 0, 'notebook should not initially generate any views');

		let newView = notebookViews.createNewView(defaultViewName);
		let cellsWithMatchingGuid = newView.cells.filter(cell => newView.getCellMetadata(cell).guid === newView.guid);

		assert.strictEqual(newView.name, defaultViewName, 'view was not created with its given name');
		assert.strictEqual(newView.cells.length, 2, 'view did not contain the same number of cells as the notebook used to create it');
		assert.strictEqual(cellsWithMatchingGuid.length, newView.cells.length, 'cell metadata was not created for all cells in view');
	});

	test('remove view', async function (): Promise<void> {
		let newView = notebookViews.createNewView(defaultViewName);

		notebookViews.removeView(newView.guid);

		let cellsWithNewView = notebookViews.getCells().filter(cell => cell.views.find(v => v.guid === newView.guid));

		assert.strictEqual(notebookViews.getViews().length, 0, 'view not removed from notebook metadata');
		assert.strictEqual(cellsWithNewView.length, 0, 'view not removed from cells');
	});

	test('default view name', async function (): Promise<void> {
		let newView = notebookViews.createNewView();
		assert.strictEqual(newView.name, NotebookViewsExtension.defaultViewName);

		let newView1 = notebookViews.createNewView();
		assert.strictEqual(newView1.name, `${NotebookViewsExtension.defaultViewName} 1`);
	});

	test('active view', async function (): Promise<void> {
		let newView = notebookViews.createNewView();
		notebookViews.setActiveView(newView);

		assert.strictEqual(notebookViews.getActiveView(), newView);
	});

	test('update cell', async function (): Promise<void> {
		let newView = notebookViews.createNewView();
		let c1 = newView.cells[0];

		let cellData = newView.getCellMetadata(c1);
		cellData = { ...cellData, x: 0, y: 0, hidden: true, width: 0, height: 0 };
		notebookViews.updateCell(c1, newView, cellData);

		cellData = { ...cellData, x: 1, y: 1, hidden: false, width: 1, height: 1 };
		notebookViews.updateCell(c1, newView, cellData);
		assert.deepStrictEqual(newView.getCellMetadata(c1), cellData, 'update did not set all values');

		cellData = { ...cellData, x: 3 };
		notebookViews.updateCell(c1, newView, { x: 3 });
		assert.deepStrictEqual(newView.getCellMetadata(c1), cellData, 'update should only override set values');
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

	async function initializeExtension(): Promise<NotebookViewsExtension> {
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentManager);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(initialNotebookContent));
		defaultModelOptions.contentManager = mockContentManager.object;

		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService(), queryConnectionService.object, configurationService);
		await model.loadContents();
		await model.requestModelLoad();

		return new NotebookViewsExtension(model);
	}
});
