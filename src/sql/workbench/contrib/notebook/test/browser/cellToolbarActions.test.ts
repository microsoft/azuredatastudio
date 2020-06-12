/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb } from 'azdata';
import * as TypeMoq from 'typemoq';
import * as assert from 'assert';

import { URI } from 'vs/base/common/uri';
import { CellToggleMoreActions, RunCellsAction } from 'sql/workbench/contrib/notebook/browser/cellToolbarActions';
import { ModelFactory } from 'sql/workbench/services/notebook/browser/models/modelFactory';
import { NotebookService } from 'sql/workbench/services/notebook/browser/notebookServiceImpl';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { NotebookManagerStub } from 'sql/workbench/contrib/notebook/test/stubs';
import { Memento } from 'vs/workbench/common/memento';
import { NullLogService } from 'vs/platform/log/common/log';
import { TestConnectionManagementService } from 'sql/platform/connection/test/common/testConnectionManagementService';
import { TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';
import { TestLifecycleService, TestEnvironmentService } from 'vs/workbench/test/browser/workbenchTestServices';
import { Separator } from 'vs/base/browser/ui/actionbar/actionbar';
import { CellContext } from 'sql/workbench/contrib/notebook/browser/cellViews/codeActions';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { INotebookModelOptions } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { CellModel } from 'sql/workbench/services/notebook/browser/models/cell';
import { NullAdsTelemetryService } from 'sql/platform/telemetry/common/adsTelemetryService';
import { SessionManager } from 'sql/workbench/contrib/notebook/test/emptySessionClasses';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { MockContextKeyService } from 'vs/platform/keybinding/test/common/mockKeybindingService';

let defaultUri = URI.file('/some/path.ipynb');
let notificationService: TypeMoq.Mock<INotificationService>;
let capabilitiesService: TypeMoq.Mock<ICapabilitiesService>;
let instantiationService: TestInstantiationService;


suite('CellToggleMoreActions', function (): void {
	let notebookManagers = [new NotebookManagerStub()];
	let mockSessionManager: TypeMoq.Mock<nb.SessionManager>;
	let mockNotebookService: TypeMoq.Mock<INotebookService>;
	let memento: TypeMoq.Mock<Memento>;
	let queryConnectionService: TypeMoq.Mock<TestConnectionManagementService>;
	let defaultModelOptions: INotebookModelOptions;
	let cellModel: CellModel;
	const logService = new NullLogService();
	setup(() => {
		mockSessionManager = TypeMoq.Mock.ofType(SessionManager);
		notebookManagers[0].sessionManager = mockSessionManager.object;
		notificationService = TypeMoq.Mock.ofType(TestNotificationService, TypeMoq.MockBehavior.Loose);
		capabilitiesService = TypeMoq.Mock.ofType(TestCapabilitiesService);
		memento = TypeMoq.Mock.ofType(Memento, TypeMoq.MockBehavior.Loose, '');
		memento.setup(x => x.getMemento(TypeMoq.It.isAny())).returns(() => void 0);
		queryConnectionService = TypeMoq.Mock.ofType(TestConnectionManagementService, TypeMoq.MockBehavior.Loose, memento.object, undefined, new TestStorageService());
		queryConnectionService.callBase = true;
		let serviceCollection = new ServiceCollection();
		instantiationService = new TestInstantiationService(serviceCollection);
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

		mockNotebookService = TypeMoq.Mock.ofType(NotebookService, undefined, new TestLifecycleService(), undefined, undefined, undefined, instantiationService, new MockContextKeyService(),
			undefined, undefined, undefined, undefined, undefined, undefined, TestEnvironmentService);
		cellModel = new CellModel(undefined, undefined, mockNotebookService.object);
	});

	test('Remove Duplicated And Starting Separators', async function (): Promise<void> {
		let testContainer = HTMLElement;
		let testInstantiationService = new TestInstantiationService();
		let model = new NotebookModel(defaultModelOptions, undefined, logService, undefined, new NullAdsTelemetryService());
		let context = new CellContext(model, cellModel);

		let _actions = testInstantiationService.createInstance(CellToggleMoreActions);

		_actions.push(
			testInstantiationService.createInstance(RunCellsAction, 'runAllBefore', 'hiyo', false),
			new Separator(),
			new Separator(),
			testInstantiationService.createInstance(RunCellsAction, 'runAllBefore', 'hiyo', false),
			new Separator()
		);

		_actions.onInit(testContainer, context);

	});
});
