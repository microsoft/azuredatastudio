/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import { CellToggleMoreActionViewItem, RunCellsAction, removeDuplicatedAndStartingSeparators, AddCellFromContextAction, CollapseCellAction, ConvertCellAction, CellToggleMoreAction } from 'sql/workbench/contrib/notebook/browser/cellToolbarActions';
import { NotebookService } from 'sql/workbench/services/notebook/browser/notebookServiceImpl';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { TestLifecycleService } from 'vs/workbench/test/browser/workbenchTestServices';
import { TestDialogService } from 'vs/platform/dialogs/test/common/testDialogService';
import { NullAdsTelemetryService } from 'sql/platform/telemetry/common/adsTelemetryService';
import { CellContext } from 'sql/workbench/contrib/notebook/browser/cellViews/codeActions';
import { INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { MockContextKeyService } from 'vs/platform/keybinding/test/common/mockKeybindingService';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { ContextMenuService } from 'vs/platform/contextview/browser/contextMenuService';
import { CellModel } from 'sql/workbench/services/notebook/browser/models/cell';
import { IProductService } from 'vs/platform/product/common/productService';
import { Action, Separator } from 'vs/base/common/actions';
import { ICellModel, INotebookModelOptions } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { NotebookEditorContentLoader } from 'sql/workbench/contrib/notebook/browser/models/notebookInput';
import { URI } from 'vs/base/common/uri';
import { ModelFactory } from 'sql/workbench/services/notebook/browser/models/modelFactory';
import { CellTypes, NotebookChangeType } from 'sql/workbench/services/notebook/common/contracts';
import { nb } from 'azdata';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { ExecuteManagerStub, NotebookServiceStub, SerializationManagerStub } from 'sql/workbench/contrib/notebook/test/browser/stubs';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';
import { UndoRedoService } from 'vs/platform/undoRedo/common/undoRedoService';
import { NBFORMAT, NBFORMAT_MINOR } from 'sql/workbench/common/constants';
import { Emitter } from 'vs/base/common/event';
import { IStandardKernelWithProvider } from 'sql/workbench/services/notebook/browser/models/notebookUtils';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ILanguageService } from 'vs/editor/common/languages/language';
import { ILogService, NullLogService } from 'vs/platform/log/common/log';
import { mock } from 'vs/base/test/common/mock';
import { NullCommandService } from 'vs/platform/commands/test/common/nullCommandService';

suite('CellToolbarActions', function (): void {
	suite('removeDuplicatedAndStartingSeparators', function (): void {
		test('Empty actions array is unchanged', function (): void {
			const actions = [];
			removeDuplicatedAndStartingSeparators(actions);
			assert(actions.length === 0);
		});
		test('Array with only non-separator actions is unchanged', function (): void {
			const actions = [
				TypeMoq.Mock.ofType(RunCellsAction).object,
				TypeMoq.Mock.ofType(AddCellFromContextAction).object,
				TypeMoq.Mock.ofType(CollapseCellAction).object
			];
			removeDuplicatedAndStartingSeparators(actions);
			assert(actions.length === 3);
		});
		test('Array with only separators is cleared', function (): void {
			const actions = <Action[]>[new Separator(), new Separator(), new Separator()];
			removeDuplicatedAndStartingSeparators(actions);
			assert(actions.length === 0);
		});
		test('Array with separators not on the ends is unchanged', function (): void {
			const actions = <Action[]>[
				TypeMoq.Mock.ofType(RunCellsAction).object,
				new Separator(),
				TypeMoq.Mock.ofType(AddCellFromContextAction).object,
				new Separator(),
				TypeMoq.Mock.ofType(CollapseCellAction).object
			];
			removeDuplicatedAndStartingSeparators(actions);
			assert(actions.length === 5);
		});
		test('Duplicate separators are removed', function (): void {
			const actions = <Action[]>[
				TypeMoq.Mock.ofType(RunCellsAction).object,
				new Separator(),
				new Separator(),
				new Separator(),
				TypeMoq.Mock.ofType(AddCellFromContextAction).object,
				new Separator(),
				new Separator(),
				TypeMoq.Mock.ofType(CollapseCellAction).object
			];
			removeDuplicatedAndStartingSeparators(actions);
			assert(actions.length === 5);
		});
		test('Starting and ending separators are removed', function (): void {
			const actions = <Action[]>[
				new Separator(),
				new Separator(),
				TypeMoq.Mock.ofType(RunCellsAction).object,
				new Separator(),
				TypeMoq.Mock.ofType(AddCellFromContextAction).object,
				new Separator(),
				TypeMoq.Mock.ofType(CollapseCellAction).object,
				new Separator(),
				new Separator()
			];
			removeDuplicatedAndStartingSeparators(actions);
			assert(actions.length === 5);
		});
	});

	suite('CellToggleMoreActions', function (): void {
		let configurationService = new TestConfigurationService();
		let serviceCollection = new ServiceCollection();
		serviceCollection.set(ICommandService, NullCommandService);
		serviceCollection.set(IConfigurationService, configurationService);
		serviceCollection.set(ILogService, new NullLogService());
		let instantiationService: TestInstantiationService = new TestInstantiationService(serviceCollection, true);
		instantiationService.stub(INotebookService, new class extends mock<INotebookService>() {
			override async serializeNotebookStateChange(notebookUri: URI, changeType: NotebookChangeType, cell?: ICellModel, isTrusted?: boolean): Promise<void> { }
			override notifyCellExecutionStarted(): void { }
		});
		instantiationService.stub(ILanguageService, new class extends mock<ILanguageService>() { });

		const contextMock = TypeMoq.Mock.ofType(CellContext);
		const cellModelMock = TypeMoq.Mock.ofType(CellModel);

		instantiationService.stub(IProductService, { quality: 'stable' });

		suiteSetup(function (): void {
			contextMock.setup(x => x.cell).returns(() => cellModelMock.object);
			let notebookService = new NotebookService(
				new TestLifecycleService(),
				undefined,
				undefined,
				undefined,
				instantiationService,
				undefined,
				undefined,
				undefined,
				new MockContextKeyService(),
				instantiationService.get(IProductService),
				undefined,
				undefined,
				undefined,
				undefined,
			);
			instantiationService.stub(INotificationService, new TestNotificationService());
			instantiationService.stub(INotebookService, notebookService);
			instantiationService.stub(IContextMenuService, TypeMoq.Mock.ofType(ContextMenuService).object);
		});

		test('CellToggleMoreActionViewItem with Code CellType displays correct number of actions', function (): void {
			cellModelMock.setup(x => x.cellType).returns(() => 'code');
			const action = new CellToggleMoreActionViewItem(new CellToggleMoreAction(), undefined, contextMock.object, undefined, instantiationService);
			assert.equal(action.getValidActions().length, 18);
		});

		test('CellToggleMoreActionViewItem with Markdown CellType displays correct number of actions', function (): void {
			cellModelMock.setup(x => x.cellType).returns(() => 'markdown');
			const action = new CellToggleMoreActionViewItem(new CellToggleMoreAction(), undefined, contextMock.object, undefined, instantiationService);
			assert.equal(action.getValidActions().length, 7);
		});
	});

	suite('ConvertCellAction', function (): void {
		let convertCellAction: ConvertCellAction;
		let notebookModel: NotebookModel;

		suiteSetup(async function (): Promise<void> {
			convertCellAction = new ConvertCellAction('id', 'label', undefined);
			notebookModel = await createandLoadNotebookModel();
		});

		test('No notebook model passed in', async function (): Promise<void> {
			let cellModel = new CellModel({ cell_type: 'code', source: '' }, { isTrusted: true, notebook: undefined });
			await convertCellAction.doRun({ cell: cellModel, model: undefined });
			assert.strictEqual(cellModel.cellType, 'code', 'Cell type should not be affected');
		});

		test('Convert to code cell', async function (): Promise<void> {
			await notebookModel.loadContents();
			await convertCellAction.doRun({ model: notebookModel, cell: notebookModel.cells[0] });
			assert.strictEqual(notebookModel.cells[0].cellType, 'markdown', 'Cell was not converted correctly');
		});

		test('Convert to markdown cell', async function (): Promise<void> {
			await notebookModel.loadContents();
			notebookModel.cells[0].cellType = 'markdown';
			await convertCellAction.doRun({ model: notebookModel, cell: notebookModel.cells[0] });
			assert.strictEqual(notebookModel.cells[0].cellType, 'code', 'Cell was not converted correctly');
		});

		test('Convert to code cell and back', async function (): Promise<void> {
			await notebookModel.loadContents();
			notebookModel.cells[0].cellType = 'markdown';
			await convertCellAction.doRun({ model: notebookModel, cell: notebookModel.cells[0] });
			assert.strictEqual(notebookModel.cells[0].cellType, 'code', 'Cell was not converted correctly');
			await convertCellAction.doRun({ model: notebookModel, cell: notebookModel.cells[0] });
			assert.strictEqual(notebookModel.cells[0].cellType, 'markdown', 'Cell was not converted correctly second time');
		});

		test('Undo/redo convert cell', async function (): Promise<void> {
			await notebookModel.loadContents();
			notebookModel.cells[0].cellType = 'markdown';
			await convertCellAction.doRun({ model: notebookModel, cell: notebookModel.cells[0] });
			assert.strictEqual(notebookModel.cells[0].cellType, 'code', 'Cell was not converted correctly');
			notebookModel.undo();
			assert.strictEqual(notebookModel.cells[0].cellType, 'markdown', 'Undo not converting cell correctly');
			notebookModel.redo();
			assert.strictEqual(notebookModel.cells[0].cellType, 'code', 'Redo not converting cell correctly');
		});
	});
});

export async function createandLoadNotebookModel(codeContent?: nb.INotebookContents): Promise<NotebookModel> {
	let defaultCodeContent: nb.INotebookContents = {
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
		nbformat: NBFORMAT,
		nbformat_minor: NBFORMAT_MINOR
	};

	let configurationService = new TestConfigurationService();
	let serviceCollection = new ServiceCollection();
	serviceCollection.set(ICommandService, NullCommandService);
	serviceCollection.set(IConfigurationService, configurationService);
	serviceCollection.set(ILogService, new NullLogService());
	let instantiationService: TestInstantiationService = new TestInstantiationService(serviceCollection, true);
	instantiationService.stub(INotebookService, new class extends mock<INotebookService>() {
		override async serializeNotebookStateChange(notebookUri: URI, changeType: NotebookChangeType, cell?: ICellModel, isTrusted?: boolean): Promise<void> { }
		override notifyCellExecutionStarted(): void { }
	});
	instantiationService.stub(ILanguageService, new class extends mock<ILanguageService>() { });

	let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentLoader);
	let dialogService = TypeMoq.Mock.ofType<IDialogService>(TestDialogService, TypeMoq.MockBehavior.Loose);
	let notificationService = TypeMoq.Mock.ofType<INotificationService>(TestNotificationService, TypeMoq.MockBehavior.Loose);
	let undoRedoService = new UndoRedoService(dialogService.object, notificationService.object);

	mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(codeContent ? codeContent : defaultCodeContent));
	let defaultModelOptions: INotebookModelOptions = {
		notebookUri: URI.file('/some/path.ipynb'),
		factory: new ModelFactory(instantiationService),
		serializationManagers: [new SerializationManagerStub()],
		executeManagers: [new ExecuteManagerStub()],
		contentLoader: mockContentManager.object,
		notificationService: undefined,
		connectionService: undefined,
		providerId: 'SQL',
		cellMagicMapper: undefined,
		defaultKernel: undefined,
		layoutChanged: undefined,
		capabilitiesService: undefined,
		getInputLanguageMode: () => undefined
	};
	let mockNotebookService = TypeMoq.Mock.ofType(NotebookServiceStub);
	mockNotebookService.setup(s => s.onNotebookKernelsAdded).returns(() => new Emitter<IStandardKernelWithProvider[]>().event);

	return new NotebookModel(defaultModelOptions, undefined, undefined, undefined, new NullAdsTelemetryService(), undefined, undefined, undoRedoService, mockNotebookService.object, undefined, undefined);
}
