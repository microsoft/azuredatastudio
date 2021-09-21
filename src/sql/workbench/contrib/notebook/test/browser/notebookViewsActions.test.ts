/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { nb } from 'azdata';
import * as assert from 'assert';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { TestConnectionManagementService } from 'sql/platform/connection/test/common/testConnectionManagementService';
import { NullAdsTelemetryService } from 'sql/platform/telemetry/common/adsTelemetryService';
import { NotebookEditorContentLoader } from 'sql/workbench/contrib/notebook/browser/models/notebookInput';
import { DeleteViewAction, InsertCellAction } from 'sql/workbench/contrib/notebook/browser/notebookViews/notebookViewsActions';
import { SessionManager } from 'sql/workbench/contrib/notebook/test/emptySessionClasses';
import { NotebookManagerStub } from 'sql/workbench/contrib/notebook/test/stubs';
import { ModelFactory } from 'sql/workbench/services/notebook/browser/models/modelFactory';
import { ICellModel, INotebookModelOptions, ViewMode } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { NotebookViewsExtension } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewsExtension';
import { CellTypes } from 'sql/workbench/services/notebook/common/contracts';
import TypeMoq = require('typemoq');
import { URI } from 'vs/base/common/uri';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { TestDialogService } from 'vs/platform/dialogs/test/common/testDialogService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { NullLogService } from 'vs/platform/log/common/log';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { Memento } from 'vs/workbench/common/memento';
import { TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';
import sinon = require('sinon');
import { InsertCellsModal } from 'sql/workbench/contrib/notebook/browser/notebookViews/insertCellsModal';
import { MockContextKeyService } from 'vs/platform/keybinding/test/common/mockKeybindingService';

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

suite('Notebook Views Actions', function (): void {
	let defaultViewName = 'Default New View';
	let notebookManagers = [new NotebookManagerStub()];
	let mockSessionManager: TypeMoq.Mock<nb.SessionManager>;
	let memento: TypeMoq.Mock<Memento>;
	let queryConnectionService: TypeMoq.Mock<TestConnectionManagementService>;
	let defaultModelOptions: INotebookModelOptions;
	const logService = new NullLogService();

	let defaultUri = URI.file('/some/path.ipynb');
	let notificationService: TypeMoq.Mock<INotificationService>;
	let capabilitiesService: TypeMoq.Mock<ICapabilitiesService>;
	let instantiationService: IInstantiationService;
	let configurationService: IConfigurationService;
	let sandbox: sinon.SinonSandbox;

	setup(() => {
		sandbox = sinon.createSandbox();
		setupServices();
	});

	teardown(() => {
		sandbox.restore();
	});

	test('delete view action accept', async function (): Promise<void> {
		const dialogService = new TestDialogService();
		const notificationService = new TestNotificationService();
		const notebookViews = await initializeNotebookViewsExtension(initialNotebookContent);

		const newView = notebookViews.createNewView(defaultViewName);

		assert.strictEqual(notebookViews.getViews().length, 1, 'View not created');

		notebookViews.setActiveView(newView);

		assert.deepStrictEqual(notebookViews.getActiveView(), newView, 'Active view not set properly');

		const deleteAction = new DeleteViewAction(notebookViews, dialogService, notificationService);
		sandbox.stub(deleteAction, 'confirmDelete' as keyof DeleteViewAction).withArgs(newView).returns(Promise.resolve(true));
		await deleteAction.run();

		assert.strictEqual(notebookViews.getViews().length, 0, 'View not deleted');
		assert.strictEqual(notebookViews.notebook.viewMode, ViewMode.Notebook, 'View mode was note set to notebook');
	});

	test('delete view action decline', async function (): Promise<void> {
		const dialogService = new TestDialogService();
		const notificationService = new TestNotificationService();
		const notebookViews = await initializeNotebookViewsExtension(initialNotebookContent);

		const newView = notebookViews.createNewView(defaultViewName);

		assert.strictEqual(notebookViews.getViews().length, 1, 'View not created');

		notebookViews.setActiveView(newView);

		assert.strictEqual(notebookViews.getActiveView(), newView, 'Active view not set properly');

		const deleteAction = new DeleteViewAction(notebookViews, dialogService, notificationService);
		sandbox.stub(deleteAction, 'confirmDelete' as keyof DeleteViewAction).withArgs(newView).returns(Promise.resolve(false));
		await deleteAction.run();

		assert.strictEqual(notebookViews.getViews().length, 1, 'View should not have deleted');
	});

	test('show insertcellmodal', async function (): Promise<void> {
		let opened = false;
		let rendered = false;
		const notebookViews = await initializeNotebookViewsExtension(initialNotebookContent);
		const newView = notebookViews.createNewView(defaultViewName);

		notebookViews.setActiveView(newView);

		let insertCellsModal = TypeMoq.Mock.ofType(InsertCellsModal, TypeMoq.MockBehavior.Strict,
			(cell: ICellModel) => { }, // onInsert
			notebookViews, // _context
			undefined, // _containerRef
			undefined, // _componentFactoryResolver
			undefined, // logService
			undefined, // themeService
			undefined, // layoutService
			undefined, // clipboardService
			new MockContextKeyService(), // contextkeyservice
			undefined, // telemetryService
			undefined, // textResourcePropertiesService
		);

		insertCellsModal.setup(x => x.render()).callback(() => {
			rendered = true;
		});

		insertCellsModal.setup(x => x.open()).callback(() => {
			opened = true;
		});

		const instantiationService = new InstantiationService();
		sinon.stub(instantiationService, 'createInstance').withArgs(InsertCellsModal, sinon.match.any, sinon.match.any, sinon.match.any, sinon.match.any).returns(insertCellsModal.object);

		const insertCellAction = new InsertCellAction((cell: ICellModel) => { }, notebookViews, undefined, undefined, instantiationService);
		await insertCellAction.run();

		assert.ok(rendered);
		assert.ok(opened);
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
			executeManagers: notebookManagers,
			contentLoader: undefined,
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
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentLoader);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(contents));
		defaultModelOptions.contentLoader = mockContentManager.object;

		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService(), queryConnectionService.object, configurationService);
		await model.loadContents();
		await model.requestModelLoad();

		return new NotebookViewsExtension(model);
	}
});
