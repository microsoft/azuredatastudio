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
import { TestDialogService } from 'vs/platform/dialogs/test/common/testDialogService';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';
import { UndoRedoService } from 'vs/platform/undoRedo/common/undoRedoService';
import { IUndoRedoService } from 'vs/platform/undoRedo/common/undoRedo';
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

let defaultUri = URI.file('/some/path.ipynb');
let notificationService: TypeMoq.Mock<INotificationService>;
let capabilitiesService: TypeMoq.Mock<ICapabilitiesService>;
let dialogService: TypeMoq.Mock<IDialogService>;
let instantiationService: TestInstantiationService;
let configurationService: IConfigurationService;
let undoRedoService: IUndoRedoService;

suite('NotebookViews', function (): void {
	let defaultViewName = 'Default New View';
	let serializationManagers = [new SerializationManagerStub()];
	let executeManagers = [new ExecuteManagerStub()];
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

	test('should not modify the notebook document until a view is created', async () => {
		//Create some content
		notebookViews.notebook.addCell(CellTypes.Code, 0);

		assert.strictEqual(notebookViews.getExtensionMetadata(), undefined);

		//Check that the view is created
		notebookViews.createNewView(defaultViewName);
		assert.notStrictEqual(notebookViews.getExtensionMetadata(), undefined);
	});

	test('create new view', async function (): Promise<void> {
		assert.strictEqual(notebookViews.getViews().length, 0, 'notebook should not initially generate any views');

		let newView = notebookViews.createNewView(defaultViewName);

		assert.strictEqual(notebookViews.getViews().length, 1, 'only one view was created');
		assert.strictEqual(newView.name, defaultViewName, 'view was not created with its given name');
		assert.strictEqual(newView.cells.length, 2, 'view did not contain the same number of cells as the notebook used to create it');
	});

	test('remove view', async function (): Promise<void> {
		let newView = notebookViews.createNewView(defaultViewName);

		notebookViews.removeView(newView.guid);

		assert.strictEqual(notebookViews.getViews().length, 0, 'view not removed from notebook metadata');
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

	test('update card', async function (): Promise<void> {
		let newView = notebookViews.createNewView();
		let card = newView.cards[0];

		let cardData = { ...card, x: 0, y: 0, width: 0, height: 0 };
		notebookViews.updateCard(card, cardData, newView);

		cardData = { ...cardData, x: 1, y: 1, width: 1, height: 1 };
		notebookViews.updateCard(newView.cards[0], cardData, newView);
		assert.deepStrictEqual(newView.cards[0], cardData, 'update did not set all values');

		cardData = { ...cardData, x: 3 };
		notebookViews.updateCard(newView.cards[0], { x: 3 }, newView);
		assert.deepStrictEqual(newView.cards[0], cardData, 'update should only override set values');
	});

	function setupServices() {
		mockSessionManager = TypeMoq.Mock.ofType(SessionManager);
		executeManagers[0].providerId = SQL_NOTEBOOK_PROVIDER;
		executeManagers[0].sessionManager = mockSessionManager.object;
		notificationService = TypeMoq.Mock.ofType<INotificationService>(TestNotificationService, TypeMoq.MockBehavior.Loose);
		capabilitiesService = TypeMoq.Mock.ofType<ICapabilitiesService>(TestCapabilitiesService);
		dialogService = TypeMoq.Mock.ofType<IDialogService>(TestDialogService, TypeMoq.MockBehavior.Loose);
		undoRedoService = new UndoRedoService(dialogService.object, notificationService.object);
		memento = TypeMoq.Mock.ofType(Memento, TypeMoq.MockBehavior.Loose, '');
		memento.setup(x => x.getMemento(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => void 0);
		queryConnectionService = TypeMoq.Mock.ofType(TestConnectionManagementService, TypeMoq.MockBehavior.Loose, memento.object, undefined, new TestStorageService());
		queryConnectionService.callBase = true;
		configurationService = new TestConfigurationService();

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

	async function initializeExtension(): Promise<NotebookViewsExtension> {
		let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentLoader);
		mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(initialNotebookContent));
		defaultModelOptions.contentLoader = mockContentManager.object;
		let mockNotebookService = TypeMoq.Mock.ofType(NotebookServiceStub);
		mockNotebookService.setup(s => s.onNotebookKernelsAdded).returns(() => new Emitter<IStandardKernelWithProvider[]>().event);

		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService(), queryConnectionService.object, configurationService, undoRedoService, mockNotebookService.object, undefined, undefined);
		await model.loadContents();
		await model.requestModelLoad();

		return new NotebookViewsExtension(model);
	}
});
