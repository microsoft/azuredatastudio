/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as azdata from 'azdata';
import * as sinon from 'sinon';
import { TestConfigurationService } from 'sql/platform/connection/test/common/testConfigurationService';
import { AddCellAction, ClearAllOutputsAction, CollapseCellsAction, CreateNotebookViewAction, DashboardViewAction, kernelNotSupported, KernelsDropdown, msgChanging, NewNotebookAction, noKernelName, noParameterCell, noParametersInCell, NotebookViewAction, NotebookViewsActionProvider, RunAllCellsAction, RunParametersAction, TrustedAction } from 'sql/workbench/contrib/notebook/browser/notebookActions';
import { ClientSessionStub, ContextViewProviderStub, NotebookComponentStub, NotebookModelStub, NotebookServiceStub, NotebookViewsStub, NotebookViewStub } from 'sql/workbench/contrib/notebook/test/stubs';
import { NotebookEditorStub } from 'sql/workbench/contrib/notebook/test/testCommon';
import { ICellModel, INotebookModel, ViewMode } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { IStandardKernelWithProvider } from 'sql/workbench/services/notebook/browser/models/notebookUtils';
import { INotebookEditor, INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { CellType, CellTypes } from 'sql/workbench/services/notebook/common/contracts';
import * as TypeMoq from 'typemoq';
import { Emitter, Event } from 'vs/base/common/event';
import { TestCommandService } from 'vs/editor/test/browser/editorTestServices';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IConfigurationChangeEvent, IConfigurationOverrides, IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { workbenchInstantiationService } from 'vs/workbench/test/browser/workbenchTestServices';
import { URI } from 'vs/base/common/uri';
import { NullAdsTelemetryService } from 'sql/platform/telemetry/common/adsTelemetryService';
import { MockQuickInputService } from 'sql/workbench/contrib/notebook/test/common/quickInputServiceMock';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { Separator } from 'vs/base/common/actions';
import { INotebookView, INotebookViews } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViews';

class TestClientSession extends ClientSessionStub {
	private _errorState: boolean = false;
	setErrorState = (value: boolean) => this._errorState = value;
	override get isInErrorState(): boolean {
		return this._errorState;
	}
	override get kernel(): azdata.nb.IKernel {
		return <azdata.nb.IKernel>{
			name: 'StandardKernel1'
		};
	}
}
class TestNotebookModel extends NotebookModelStub {
	private _clientSession: TestClientSession = new TestClientSession();
	public kernelChangedEmitter: Emitter<azdata.nb.IKernelChangedArgs> = new Emitter<azdata.nb.IKernelChangedArgs>();

	public override get kernelChanged() {
		return this.kernelChangedEmitter.event;
	}

	public override get clientSession(): TestClientSession {
		return this._clientSession;
	}

	private _standardKernelsMap: Map<string, IStandardKernelWithProvider> = new Map<string, IStandardKernelWithProvider>(
		[
			// The name and displayName are set to same value
			// for ease of expected result calculation for kernelDropdown.updateKernel tests.
			[
				'StandardKernel1',
				{
					name: 'StandardKernel1',
					displayName: 'StandardKernel1',
					connectionProviderIds: ['Kernel1 connection 1', 'Kernel1 connection2'],
					notebookProvider: 'kernel provider1'
				}
			],
			[
				'StandardKernel2',
				{
					name: 'StandardKernel2',
					displayName: 'StandardKernel2',
					connectionProviderIds: ['Kernel1 connection 2', 'Kernel1 connection2'],
					notebookProvider: 'kernel provider2'
				}
			]
		]
	);

	public standardKernelsDisplayName(): string[] {
		return [...this._standardKernelsMap.values()].map(x => x.displayName);
	}

	public override get specs(): azdata.nb.IAllKernels | undefined {
		return {
			defaultKernel: 'SpecKernel1',
			// The name and displayName are set to same value
			// for ease of expected result calculation for kernelDropdown.updateKernel tests.
			kernels: [
				{
					name: 'SpecKernel1',
					language: 'SpecLanguage1',
					display_name: 'SpecKernel1'
				},
				{
					name: 'SpecKernel2',
					language: 'SpecLanguage2',
					display_name: 'SpecKernel2'
				}
			]
		};
	}

	public override getStandardKernelFromName(name: string): IStandardKernelWithProvider {
		return this._standardKernelsMap.get(name);
	}
}

suite('Notebook Actions', function (): void {

	let mockNotebookEditor: TypeMoq.Mock<INotebookEditor>;
	let mockNotebookService: TypeMoq.Mock<INotebookService>;
	const testUri = URI.parse('untitled');

	suiteSetup(function (): void {
		mockNotebookEditor = TypeMoq.Mock.ofType<INotebookEditor>(NotebookEditorStub);
		mockNotebookService = TypeMoq.Mock.ofType<INotebookService>(NotebookServiceStub);
		mockNotebookService.setup(x => x.findNotebookEditor(TypeMoq.It.isAny())).returns(uri => mockNotebookEditor.object);
	});

	teardown(function (): void {
		mockNotebookEditor.reset();
	});

	test('Add Cell Action', async function (): Promise<void> {
		let testCellType: CellType = 'code';
		let actualCellType: CellType;


		let action = new AddCellAction('TestId', 'TestLabel', 'TestClass', mockNotebookService.object, new NullAdsTelemetryService());
		action.cellType = testCellType;

		// Normal use case
		mockNotebookEditor.setup(x => x.addCell(TypeMoq.It.isAny(), TypeMoq.It.isAnyNumber())).returns((cellType, index) => { actualCellType = cellType; });
		let mockNotebookComponent = TypeMoq.Mock.ofType<INotebookEditor>(NotebookComponentStub);
		mockNotebookComponent.setup(c => c.addCell(TypeMoq.It.isAny(), TypeMoq.It.isAnyNumber())).returns(cellType => {
			actualCellType = cellType;
		});

		assert.doesNotThrow(() => action.run(testUri));
		assert.strictEqual(actualCellType, testCellType);

		// Handle error case
		mockNotebookEditor.reset();
		mockNotebookEditor.setup(x => x.addCell(TypeMoq.It.isAny(), TypeMoq.It.isAnyNumber())).throws(new Error('Test Error'));
		await assert.rejects(action.run(URI.parse('untitled')));
	});

	test('Clear All Outputs Action', async function (): Promise<void> {
		let action = new ClearAllOutputsAction('TestId', true, mockNotebookService.object);

		// Normal use case
		mockNotebookEditor.setup(c => c.clearAllOutputs()).returns(() => Promise.resolve(true));

		await action.run(testUri);
		mockNotebookEditor.verify(c => c.clearAllOutputs(), TypeMoq.Times.once());

		// Handle failure case
		mockNotebookEditor.reset();
		mockNotebookEditor.setup(c => c.clearAllOutputs()).returns(() => Promise.resolve(false));

		await action.run(testUri);
		mockNotebookEditor.verify(c => c.clearAllOutputs(), TypeMoq.Times.once());
	});

	test('Trusted Action', async function (): Promise<void> {
		let mockNotification = TypeMoq.Mock.ofType<INotificationService>(TestNotificationService);
		mockNotification.setup(n => n.notify(TypeMoq.It.isAny()));

		let action = new TrustedAction('TestId', true, mockNotebookService.object);
		assert.strictEqual(action.trusted, false, 'Should not be trusted by default');

		const testNotebookModel: INotebookModel = <INotebookModel>{
			trustedMode: false
		};

		mockNotebookEditor.setup(x => x.model).returns(() => testNotebookModel);
		// Normal use case
		await action.run(testUri);
		assert.strictEqual(action.trusted, true, 'Should be trusted after toggling trusted state');
		assert.strictEqual(testNotebookModel.trustedMode, true, 'Model should be true after toggling trusted state');

		// Should toggle trusted to false on subsequent action
		await action.run(testUri);
		assert.strictEqual(action.trusted, false, 'Should toggle trusted to false');
		assert.strictEqual(testNotebookModel.trustedMode, false, 'Model should be false again after toggling trusted state');
	});

	test('Run All Cells Action', async function (): Promise<void> {
		const testNotebookModel = TypeMoq.Mock.ofType<INotebookModel>(NotebookModelStub);
		testNotebookModel.setup(x => x.getMetaValue(TypeMoq.It.isAny())).returns(() => undefined);
		mockNotebookEditor.setup(x => x.model).returns(() => testNotebookModel.object);

		let mockNotification = TypeMoq.Mock.ofType<INotificationService>(TestNotificationService);
		mockNotification.setup(n => n.notify(TypeMoq.It.isAny()));

		let action = new RunAllCellsAction('TestId', 'TestLabel', 'TestClass', mockNotification.object, mockNotebookService.object, new NullAdsTelemetryService());

		// Normal use case
		mockNotebookEditor.setup(c => c.runAllCells()).returns(() => Promise.resolve(true));

		await action.run(testUri);
		mockNotebookEditor.verify(c => c.runAllCells(), TypeMoq.Times.once());

		// Handle errors
		mockNotebookEditor.reset();
		mockNotebookEditor.setup(c => c.runAllCells()).throws(new Error('Test Error'));

		await action.run(testUri);
	});

	test('Collapse Cells Action', async function (): Promise<void> {
		let action = new CollapseCellsAction('TestId', true, mockNotebookService.object);
		assert.strictEqual(action.isCollapsed, false, 'Should not be collapsed by default');

		const testCells = [<ICellModel>{
			isCollapsed: false
		}, <ICellModel>{
			isCollapsed: true
		}, <ICellModel>{
			isCollapsed: false
		}];

		mockNotebookEditor.setup(x => x.cells).returns(() => testCells);

		// Collapse cells case
		await action.run(testUri);

		assert.strictEqual(action.isCollapsed, true, 'Action should be collapsed after first toggle');
		testCells.forEach(cell => {
			assert.strictEqual(cell.isCollapsed, true, 'Cells should be collapsed after first toggle');
		});

		// Toggle cells to uncollapsed
		await action.run(testUri);

		assert.strictEqual(action.isCollapsed, false, 'Action should not be collapsed after second toggle');
		testCells.forEach(cell => {
			assert.strictEqual(cell.isCollapsed, false, 'Cells should not be collapsed after second toggle');
		});
	});

	test('New Notebook Action', async function (): Promise<void> {
		let actualCmdId: string;

		let mockCommandService = TypeMoq.Mock.ofType<ICommandService>(TestCommandService);
		mockCommandService.setup(s => s.executeCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
			.returns((commandId) => {
				actualCmdId = commandId;
				return Promise.resolve(true);
			});

		let action = new NewNotebookAction('TestId', 'TestLabel', mockCommandService.object, undefined, new NullAdsTelemetryService());
		await action.run(undefined);

		assert.strictEqual(actualCmdId, NewNotebookAction.INTERNAL_NEW_NOTEBOOK_CMD_ID);
	});

	test('Should Run with Parameters Action', async function (): Promise<void> {
		const testContents: azdata.nb.INotebookContents = {
			cells: [{
				cell_type: CellTypes.Code,
				source: ['x=2.0\n', 'y=5.0'],
				metadata: { language: 'python' },
				execution_count: 1
			}],
			metadata: {
				kernelspec: {
					name: 'python',
					language: 'python',
					display_name: 'Python 3'
				}
			},
			nbformat: 4,
			nbformat_minor: 5
		};

		let mockNotification = TypeMoq.Mock.ofType<INotificationService>(TestNotificationService);
		mockNotification.setup(n => n.notify(TypeMoq.It.isAny()));
		let quickInputService = new MockQuickInputService;
		let testLanguageInfo: azdata.nb.ILanguageInfo = {
			name: 'python',
		};
		let mockNotebookModel = new NotebookModelStub(testLanguageInfo, undefined, testContents);
		let action = new RunParametersAction('TestId', true, testUri, quickInputService, mockNotebookService.object, mockNotification.object);

		const testCells = [<ICellModel>{
			isParameter: true,
			source: ['x=2.0\n', 'y=5.0']
		}];
		mockNotebookEditor.setup(x => x.model).returns(() => mockNotebookModel);
		mockNotebookEditor.setup(x => x.cells).returns(() => testCells);

		// Run Parameters Action
		await action.run(testUri);
		let testShowOptions = {
			initialContent: JSON.stringify(mockNotebookModel.toJSON()),
			preserveFocus: true
		};
		assert.call(mockNotebookService.object.openNotebook(testUri, testShowOptions), 'Should Open Parameterized Notebook');
	});

	test('Should inform user to add a parameter cell if Run with Parameters Action has no parameter cell', async function (): Promise<void> {
		const testContents: azdata.nb.INotebookContents = {
			cells: [{
				cell_type: CellTypes.Code,
				source: [''],
				metadata: { language: 'python' },
				execution_count: 1
			}],
			metadata: {
				kernelspec: {
					name: 'python',
					language: 'python',
					display_name: 'Python 3'
				}
			},
			nbformat: 4,
			nbformat_minor: 5
		};
		let expectedMsg: string = noParameterCell;

		let actualMsg: string;
		let mockNotification = TypeMoq.Mock.ofType<INotificationService>(TestNotificationService);
		mockNotification.setup(n => n.notify(TypeMoq.It.isAny())).returns(notification => {
			actualMsg = notification.message;
			return undefined;
		});
		let quickInputService = new MockQuickInputService;
		let testLanguageInfo: azdata.nb.ILanguageInfo = {
			name: 'python',
		};
		let mockNotebookModel = new NotebookModelStub(testLanguageInfo, undefined, testContents);
		let action = new RunParametersAction('TestId', true, testUri, quickInputService, mockNotebookService.object, mockNotification.object);

		mockNotebookEditor.setup(x => x.model).returns(() => mockNotebookModel);

		// Run Parameters Action
		await action.run(testUri);

		assert.strictEqual(actualMsg, expectedMsg);
	});

	test('Should inform user to add parameters if Run with Parameters Action contains empty string parameter cell', async function (): Promise<void> {
		const testContents: azdata.nb.INotebookContents = {
			cells: [{
				cell_type: CellTypes.Code,
				source: [' '],
				metadata: { language: 'python' },
				execution_count: 1
			}],
			metadata: {
				kernelspec: {
					name: 'python',
					language: 'python',
					display_name: 'Python 3'
				}
			},
			nbformat: 4,
			nbformat_minor: 5
		};
		let expectedMsg: string = noParametersInCell;

		let actualMsg: string;
		let mockNotification = TypeMoq.Mock.ofType<INotificationService>(TestNotificationService);
		mockNotification.setup(n => n.notify(TypeMoq.It.isAny())).returns(notification => {
			actualMsg = notification.message;
			return undefined;
		});
		let quickInputService = new MockQuickInputService;
		let testLanguageInfo: azdata.nb.ILanguageInfo = {
			name: 'python',
		};
		let mockNotebookModel = new NotebookModelStub(testLanguageInfo, undefined, testContents);
		let action = new RunParametersAction('TestId', true, testUri, quickInputService, mockNotebookService.object, mockNotification.object);
		const testCells = [<ICellModel>{
			isParameter: true,
			source: [' ']
		}];
		mockNotebookEditor.setup(x => x.model).returns(() => mockNotebookModel);
		mockNotebookEditor.setup(x => x.cells).returns(() => testCells);

		// Run Parameters Action
		await action.run(testUri);

		assert.strictEqual(actualMsg, expectedMsg);
	});

	test('Should inform user to add parameters if Run with Parameters Action contains empty array string parameter cell', async function (): Promise<void> {
		const testContents: azdata.nb.INotebookContents = {
			cells: [{
				cell_type: CellTypes.Code,
				source: [' ', ' '],
				metadata: { language: 'python' },
				execution_count: 1
			}],
			metadata: {
				kernelspec: {
					name: 'python',
					language: 'python',
					display_name: 'Python 3'
				}
			},
			nbformat: 4,
			nbformat_minor: 5
		};
		let expectedMsg: string = noParametersInCell;

		let actualMsg: string;
		let mockNotification = TypeMoq.Mock.ofType<INotificationService>(TestNotificationService);
		mockNotification.setup(n => n.notify(TypeMoq.It.isAny())).returns(notification => {
			actualMsg = notification.message;
			return undefined;
		});
		let quickInputService = new MockQuickInputService;
		let testLanguageInfo: azdata.nb.ILanguageInfo = {
			name: 'python',
		};
		let mockNotebookModel = new NotebookModelStub(testLanguageInfo, undefined, testContents);
		let action = new RunParametersAction('TestId', true, testUri, quickInputService, mockNotebookService.object, mockNotification.object);

		const testCells = [<ICellModel>{
			isParameter: true,
			source: [' ', ' ']
		}];
		mockNotebookEditor.setup(x => x.model).returns(() => mockNotebookModel);
		mockNotebookEditor.setup(x => x.cells).returns(() => testCells);

		// Run Parameters Action
		await action.run(testUri);

		assert.strictEqual(actualMsg, expectedMsg);
	});

	test('Should inform user to add parameters if Run with Parameters Action contains empty parameter cell', async function (): Promise<void> {
		const testContents: azdata.nb.INotebookContents = {
			cells: [{
				cell_type: CellTypes.Code,
				source: [],
				metadata: { language: 'python' },
				execution_count: 1
			}],
			metadata: {
				kernelspec: {
					name: 'python',
					language: 'python',
					display_name: 'Python 3'
				}
			},
			nbformat: 4,
			nbformat_minor: 5
		};
		let expectedMsg: string = noParametersInCell;

		let actualMsg: string;
		let mockNotification = TypeMoq.Mock.ofType<INotificationService>(TestNotificationService);
		mockNotification.setup(n => n.notify(TypeMoq.It.isAny())).returns(notification => {
			actualMsg = notification.message;
			return undefined;
		});
		let quickInputService = new MockQuickInputService;
		let testLanguageInfo: azdata.nb.ILanguageInfo = {
			name: 'python',
		};
		let mockNotebookModel = new NotebookModelStub(testLanguageInfo, undefined, testContents);

		let action = new RunParametersAction('TestId', true, testUri, quickInputService, mockNotebookService.object, mockNotification.object);

		const testCells = [<ICellModel>{
			isParameter: true,
			source: []
		}];
		mockNotebookEditor.setup(x => x.model).returns(() => mockNotebookModel);
		mockNotebookEditor.setup(x => x.cells).returns(() => testCells);

		// Run Parameters Action
		await action.run(testUri);

		assert.strictEqual(actualMsg, expectedMsg);
	});

	test('Should inform user kernel is not supported if Run with Parameters Action is run with unsupported kernels', async function (): Promise<void> {
		// Kernels that are supported (Python, PySpark, PowerShell)

		const testContents: azdata.nb.INotebookContents = {
			cells: [{
				cell_type: CellTypes.Code,
				source: [],
				metadata: { language: 'sql' },
				execution_count: 1
			}],
			metadata: {
				kernelspec: {
					name: 'sql',
					language: 'sql',
					display_name: 'SQL'
				}
			},
			nbformat: 4,
			nbformat_minor: 5
		};
		let expectedMsg: string = kernelNotSupported;

		let actualMsg: string;
		let mockNotification = TypeMoq.Mock.ofType<INotificationService>(TestNotificationService);
		mockNotification.setup(n => n.notify(TypeMoq.It.isAny())).returns(notification => {
			actualMsg = notification.message;
			return undefined;
		});

		let quickInputService = new MockQuickInputService;
		let testLanguageInfo: azdata.nb.ILanguageInfo = {
			name: 'sql',
		};
		let mockNotebookModel = new NotebookModelStub(testLanguageInfo, undefined, testContents);

		let action = new RunParametersAction('TestId', true, testUri, quickInputService, mockNotebookService.object, mockNotification.object);

		mockNotebookEditor.setup(x => x.model).returns(() => mockNotebookModel);

		// Run Parameters Action
		await action.run(testUri);

		assert.strictEqual(actualMsg, expectedMsg);
	});

	test('notebookViewsActionProvider', async () => {
		const testGuid = '1';
		const testName = 'Notebook-0';

		const testNotebookModel: INotebookModel = <INotebookModel>{
			viewMode: ViewMode.Notebook
		};

		const notebookEditor = new NotebookEditorStub({ model: testNotebookModel });

		const mockNotification = TypeMoq.Mock.ofType<INotificationService>(TestNotificationService);
		const notebookViews = TypeMoq.Mock.ofType<INotebookViews>(NotebookViewsStub);

		const notebookView = TypeMoq.Mock.ofType<INotebookView>(NotebookViewStub);
		notebookView.setup(x => x.guid).returns(() => testGuid);
		notebookView.setup(x => x.name).returns(() => testName);
		const views: INotebookView[] = [notebookView.object];

		notebookViews.setup(x => x.getViews()).returns(() => views);
		notebookViews.setup(x => x.getActiveView()).returns(() => undefined);

		const notebookViewAction = new NotebookViewAction('notebookView.backToNotebook', 'Editor', 'notebook-button', mockNotebookService.object);
		const createNotebookViewAction = new CreateNotebookViewAction('notebookView.newView', 'Create New View', 'notebook-button notebook-button-newview', mockNotebookService.object);
		const separator = new Separator();

		// Create a mocked out instantiation service
		const mockInstantiationService = TypeMoq.Mock.ofType(InstantiationService, TypeMoq.MockBehavior.Strict);
		mockInstantiationService.setup(x => x.createInstance(TypeMoq.It.isValue(NotebookViewAction), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => notebookViewAction);
		mockInstantiationService.setup(x => x.createInstance(TypeMoq.It.isValue(CreateNotebookViewAction), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => createNotebookViewAction);
		mockInstantiationService.setup(x => x.createInstance(TypeMoq.It.isValue(Separator))).returns(() => separator);

		const viewsContainer = document.createElement('li');
		const viewsActionsProvider = new NotebookViewsActionProvider(viewsContainer, notebookViews.object, notebookEditor.modelReady, mockNotebookService.object, mockNotification.object, mockInstantiationService.object);

		await Event.toPromise(viewsActionsProvider.onUpdated);

		const actions = viewsActionsProvider.getActions();

		// It includes all the options
		assert.strictEqual(actions.filter(a => a instanceof DashboardViewAction).length, 1);
		assert.strictEqual(actions.filter(a => a instanceof NotebookViewAction).length, 1);
		assert.strictEqual(actions.filter(a => a instanceof CreateNotebookViewAction).length, 1);
	});

	suite('Kernels dropdown', async () => {
		let kernelsDropdown: KernelsDropdown;
		let contextViewProvider: ContextViewProviderStub;
		let container: HTMLElement;
		let notebookModel: TestNotebookModel;
		let configurationService: TestConfigurationService;
		let notebookEditor: NotebookEditorStub;
		let sandbox: sinon.SinonSandbox;
		let setOptionsSpy: sinon.SinonSpy;

		setup(async () => {
			sandbox = sinon.createSandbox();
			container = document.createElement('div');
			contextViewProvider = new ContextViewProviderStub();
			const instantiationService = <TestInstantiationService>workbenchInstantiationService();
			configurationService = new TestConfigurationService();
			instantiationService.set(IConfigurationService, configurationService);
			notebookModel = new TestNotebookModel();
			notebookEditor = new NotebookEditorStub({ model: notebookModel });
			await notebookEditor.modelReady;
			kernelsDropdown = new KernelsDropdown(container, contextViewProvider, notebookEditor.modelReady, configurationService);
			setOptionsSpy = sandbox.spy(kernelsDropdown, 'setOptions');
		});

		teardown(() => {
			sandbox.restore();
		});

		suite('updateKernel', () => {
			suite(`kernel not defined or ready and showAllKernels is true`, () => {
				for (const kernel of [undefined, { isReady: false }] as azdata.nb.IKernel[]) {
					for (const clientSessionErrorState of [true, false]) {
						test(`verify for kernel:${JSON.stringify(kernel)} and notebookModel's clientSession error state: ${clientSessionErrorState}`, () => {
							sandbox.stub(configurationService, 'getValue').returns(true); // returns true for all configuration values.
							const e: IConfigurationChangeEvent = <IConfigurationChangeEvent>{
								affectsConfiguration(_configuration: string, _overrides?: IConfigurationOverrides) {
									return true;
								}
							};
							configurationService.onDidChangeConfigurationEmitter.fire(e); //reconfigure kernelDropdown object based on config changes
							const expectedSetOptionsArgs = {
								kernels: [noKernelName, ...notebookModel.specs.kernels.map(x => x.display_name), ...notebookModel.standardKernelsDisplayName()], // these are the kernels fed into the update method via the testNotebookModel object
								selected: 0 // the selected value is NoKernelName value when no kernel is defined or is ready.
							};
							verifyUpdateKernelForNoKernelCase(notebookModel, kernelsDropdown, kernel, setOptionsSpy, expectedSetOptionsArgs, clientSessionErrorState);
						});
					}
				}
			});

			suite(`kernel not defined or ready and showAllKernels is false`, () => {
				for (const kernel of [undefined, { isReady: false }] as azdata.nb.IKernel[]) {
					for (const clientSessionErrorState of [true, false]) {
						test(`verify for kernel:${JSON.stringify(kernel)} and notebookModel's clientSession error state: ${clientSessionErrorState}`, () => {
							const expectedSetOptionsArgs = {
								kernels: [noKernelName, ...notebookModel.standardKernelsDisplayName()], // these are the kernels fed into the update method via the testNotebookModel object
								selected: 0 // the selected value is NoKernelName value when no kernel is defined or is ready.
							};
							verifyUpdateKernelForNoKernelCase(notebookModel, kernelsDropdown, kernel, setOptionsSpy, expectedSetOptionsArgs, clientSessionErrorState);
						});
					}
				}
			});

			suite(`kernel defined and ready and showAllKernels is true`, () => {
				for (const kernel of [{ name: 'StandardKernel1', isReady: true }, { name: 'SpecKernel1', isReady: true }, { name: 'Unknown', isReady: true }] as azdata.nb.IKernel[]) {
					test(`verify for kernel: '${kernel.name}'`, () => {
						sandbox.stub(configurationService, 'getValue').returns(true); // returns true for all configuration values.
						const e: IConfigurationChangeEvent = <IConfigurationChangeEvent>{
							affectsConfiguration(_configuration: string, _overrides?: IConfigurationOverrides) {
								return true;
							}
						};
						configurationService.onDidChangeConfigurationEmitter.fire(e); //reconfigure kernelDropdown object based on config changes
						testDefinedAndReadyKernelForTrueShowKernels(notebookModel, kernel, kernelsDropdown, setOptionsSpy);
					});
				}
			});

			suite(`kernel defined and ready and showAllKernels is false`, () => {
				for (const kernel of [{ name: 'StandardKernel1', isReady: true }, { name: 'SpecKernel1', isReady: true }, { name: undefined, isReady: true }] as azdata.nb.IKernel[]) {
					test(`verify for kernel with name: '${kernel.name}'`, () => {
						sandbox.stub(configurationService, 'getValue').returns(false); // returns false for all configuration values.
						const e: IConfigurationChangeEvent = <IConfigurationChangeEvent>{
							affectsConfiguration(_configuration: string, _overrides?: IConfigurationOverrides) {
								return true;
							}
						};
						configurationService.onDidChangeConfigurationEmitter.fire(e); //reconfigure kernelDropdown object based on config changes
						testDefinedAndReadyKernelForFalseShowKernels(notebookModel, kernel, kernelsDropdown, setOptionsSpy);
					});
				}

				test(`verify showAllKernels is not affected when onDidChangeConfigurationEmitter fires with both ShowAllKernelConfigName and WorkbenchPreviewConfigName not changed`, () => {
					const kernel = <azdata.nb.IKernel>{ name: 'StandardKernel1', isReady: true };
					const getValueStub = sandbox.stub(configurationService, 'getValue').returns(false); // returns false for all configuration values.
					let e: IConfigurationChangeEvent = <IConfigurationChangeEvent>{
						affectsConfiguration(_configuration: string, _overrides?: IConfigurationOverrides) {
							return true;
						}
					};
					configurationService.onDidChangeConfigurationEmitter.fire(e); //reconfigure kernelDropdown object based on config changes
					//showAllKernels should now be set to false

					//Now fire another changeConfiguration but with affectsConfiguration returning false for all values. Even though configuration service returns true for the config values that affect showAllKernels, the test that follows proves that showAllKernels remained false.
					getValueStub.restore();
					sandbox.stub(configurationService, 'getValue').returns(true); // returns false for all configuration values.
					e = <IConfigurationChangeEvent>{
						// the following fake of returning false, simulates the scenario where config changes have occurred but none that affect should affect 'showAllKernels'
						affectsConfiguration(_configuration: string, _overrides?: IConfigurationOverrides) {
							return false;
						}
					};
					configurationService.onDidChangeConfigurationEmitter.fire(e); //reconfigure kernelDropdown object based on config changes

					// test for showKernels = false
					testDefinedAndReadyKernelForFalseShowKernels(notebookModel, kernel, kernelsDropdown, setOptionsSpy);
				});
			});
		});

		suite(`doChangeKernel`, () => {
			for (const displayName of [undefined, '', 'Arbitrary Kernel Name']) {
				test(`verify for kernel displayName='${displayName}'`, () => {
					const changeKernelStub = sandbox.stub(notebookModel, 'changeKernel');
					kernelsDropdown.doChangeKernel(displayName);
					assert.ok(setOptionsSpy.calledOnce, `setOptions should be called exactly once`);
					assert.ok(setOptionsSpy.calledWithExactly([msgChanging], 0), `setOptions should be called with a options value of ${[msgChanging]} and selected value of 0`);
					assert.ok(changeKernelStub.calledOnce, `notebookModel.changeKernel should be called exactly once`);
					assert.ok(changeKernelStub.calledWithExactly(displayName), `notebookModel.changeKernel should be called with the kernel displayName that was passed to doChangeKernel`);
				});
			}
		});

		test(`verify that firing of notebookModel.kernelChanged event calls updateKernel`, () => {
			const updateKernelStub = sandbox.stub(kernelsDropdown, 'updateKernel');
			const e: azdata.nb.IKernelChangedArgs = <azdata.nb.IKernelChangedArgs>{
				newValue: <azdata.nb.IKernel>{
					name: 'StandardKernel2'
				},
				nbKernelAlias: ''
			};
			notebookModel.kernelChangedEmitter.fire(e);
			assert.ok(updateKernelStub.calledOnce, `updateKernel should be called exactly once`);
			assert.ok(updateKernelStub.calledWithExactly(e.newValue, e.nbKernelAlias), `updateKernel should be called with the parameter: ${JSON.stringify(e.newValue), JSON.stringify(e.nbKernelAlias)}`);
		});

	});
});


function testDefinedAndReadyKernelForTrueShowKernels(notebookModel: TestNotebookModel, kernel: azdata.nb.IKernel, kernelsDropdown: KernelsDropdown, setOptionsSpy: sinon.SinonSpy) {
	// these are the kernels fed into the update method via the testNotebookModel object
	const kernels = [...notebookModel.specs.kernels.map(x => x.display_name), ...notebookModel.standardKernelsDisplayName()];
	let index = kernels.findIndex(x => x === kernel.name);
	if (index === -1) {
		index = 0;
	}
	const expectedSetOptionsArgs = {
		kernels: kernels,
		selected: index // selected value from the kernelDropdown options must point to the index within 'kernels' corresponding to kernel.name
	};
	verifyUpdateKernelForKernelDefinedAndReadyCase(notebookModel, kernelsDropdown, kernel, setOptionsSpy, expectedSetOptionsArgs);
}

function testDefinedAndReadyKernelForFalseShowKernels(notebookModel: TestNotebookModel, kernel: azdata.nb.IKernel, kernelsDropdown: KernelsDropdown, setOptionsSpy: sinon.SinonSpy) {
	// these are the kernels fed into the update method via the testNotebookModel object
	const kernels = [...notebookModel.standardKernelsDisplayName()];
	let index = kernels.findIndex(x => x === kernel.name);
	if (index === -1) {
		index = 0;
	}
	const expectedSetOptionsArgs = {
		kernels: kernels,
		selected: index // selected value from the kernelDropdown options must point to the index within 'kernels' corresponding to kernel.name
	};
	verifyUpdateKernelForKernelDefinedAndReadyCase(notebookModel, kernelsDropdown, kernel, setOptionsSpy, expectedSetOptionsArgs);
}

function verifyUpdateKernelForNoKernelCase(notebookModel: TestNotebookModel, kernelsDropdown: KernelsDropdown, kernel: azdata.nb.IKernel, setOptionsSpy: sinon.SinonSpy, expectedSetOptionsArgs: {
	kernels: string[]; // these are the kernels fed into the update method via the testNotebookModel object
	selected: number; // the selected value is NoKernelName value when no kernel is defined or is ready.
}, clientSessionErrorState: boolean) {
	notebookModel.clientSession.setErrorState(clientSessionErrorState);
	kernelsDropdown.updateKernel(kernel);
	// setOptions is expected to get called only when clientSession is in error state
	if (notebookModel.clientSession.isInErrorState) {
		assert.ok(setOptionsSpy.calledOnce, `setOptions should be be called exactly once when kernel is not defined or ready and clientSession is in error state`);
		assert.ok(setOptionsSpy.calledWithExactly(expectedSetOptionsArgs.kernels, expectedSetOptionsArgs.selected), `setOptions should be called with a options value of ${JSON.stringify(expectedSetOptionsArgs.kernels, undefined, '\t')} and selected value of ${expectedSetOptionsArgs.selected}`);
	}
	else {
		assert.ok(setOptionsSpy.notCalled, `setOptions should be not be called when kernel is not defined or ready and clientSession is not in error state`);
	}
}

function verifyUpdateKernelForKernelDefinedAndReadyCase(notebookModel: TestNotebookModel, kernelsDropdown: KernelsDropdown, kernel: azdata.nb.IKernel, setOptionsSpy: sinon.SinonSpy, expectedSetOptionsArgs: {
	kernels: string[]; // these are the kernels fed into the update method via the testNotebookModel object
	selected: number; // the selected value is NoKernelName value when no kernel is defined or is ready.
}) {
	kernelsDropdown.updateKernel(kernel);
	assert.ok(setOptionsSpy.calledOnce, `setOptions should be be called exactly once when kernel is not defined or ready and clientSession is in error state`);
	assert.ok(setOptionsSpy.calledWithExactly(expectedSetOptionsArgs.kernels, expectedSetOptionsArgs.selected), `setOptions should be called with a options value of ${JSON.stringify(expectedSetOptionsArgs.kernels)} and selected value of ${expectedSetOptionsArgs.selected}`);
}
