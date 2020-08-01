/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import { CellToggleMoreActions, RunCellsAction, removeDuplicatedAndStartingSeparators, AddCellFromContextAction, CollapseCellAction, ConvertCellAction } from 'sql/workbench/contrib/notebook/browser/cellToolbarActions';
import { NotebookService } from 'sql/workbench/services/notebook/browser/notebookServiceImpl';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { TestLifecycleService } from 'vs/workbench/test/browser/workbenchTestServices';
import { CellContext } from 'sql/workbench/contrib/notebook/browser/cellViews/codeActions';
import { INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { MockContextKeyService } from 'vs/platform/keybinding/test/common/mockKeybindingService';
import * as DOM from 'vs/base/browser/dom';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { ContextMenuService } from 'vs/platform/contextview/browser/contextMenuService';
import { CellModel } from 'sql/workbench/services/notebook/browser/models/cell';
import { IProductService } from 'vs/platform/product/common/productService';
import { Separator } from 'vs/base/common/actions';
import { INotebookModelOptions } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { NotebookEditorContentManager } from 'sql/workbench/contrib/notebook/browser/models/notebookInput';
import { URI } from 'vs/base/common/uri';
import { ModelFactory } from 'sql/workbench/services/notebook/browser/models/modelFactory';
import { CellTypes } from 'sql/workbench/services/notebook/common/contracts';
import { nb } from 'azdata';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { NotebookManagerStub } from 'sql/workbench/contrib/notebook/test/stubs';

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
			const actions = [new Separator(), new Separator(), new Separator()];
			removeDuplicatedAndStartingSeparators(actions);
			assert(actions.length === 0);
		});
		test('Array with separators not on the ends is unchanged', function (): void {
			const actions = [
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
			const actions = [
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
			const actions = [
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
		const instantiationService: TestInstantiationService = new TestInstantiationService();
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
				instantiationService.get(IProductService)
			);
			instantiationService.stub(INotificationService, new TestNotificationService());
			instantiationService.stub(INotebookService, notebookService);
			instantiationService.stub(IContextMenuService, TypeMoq.Mock.ofType(ContextMenuService).object);
		});

		test('CellToggleMoreActions with Code CellType', function (): void {
			const testContainer = DOM.$('div');
			cellModelMock.setup(x => x.cellType).returns(() => 'code');
			const action = new CellToggleMoreActions(instantiationService);
			action.onInit(testContainer, contextMock.object);
			assert.equal(action['_moreActions']['viewItems'][0]['_action']['_actions'].length, 15, 'Unexpected number of valid elements');
		});

		test('CellToggleMoreActions with Markdown CellType', function (): void {
			const testContainer = DOM.$('div');
			cellModelMock.setup(x => x.cellType).returns(() => 'markdown');
			const action = new CellToggleMoreActions(instantiationService);
			action.onInit(testContainer, contextMock.object);
			// Markdown elements don't show the code-cell related actions such as Run Cell
			assert.equal(action['_moreActions']['viewItems'][0]['_action']['_actions'].length, 7, 'Unexpected number of valid elements');
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
			assert.equal(cellModel.cellType, 'code', 'Cell type should not be affected');
		});

		test('Convert to code cell', async function (): Promise<void> {
			await notebookModel.loadContents();
			await convertCellAction.doRun({ model: notebookModel, cell: notebookModel.cells[0] });
			assert.equal(notebookModel.cells[0].cellType, 'markdown', 'Cell was not converted correctly');
		});

		test('Convert to markdown cell', async function (): Promise<void> {
			await notebookModel.loadContents();
			notebookModel.cells[0].cellType = 'markdown';
			await convertCellAction.doRun({ model: notebookModel, cell: notebookModel.cells[0] });
			assert.equal(notebookModel.cells[0].cellType, 'code', 'Cell was not converted correctly');
		});

		test('Convert to code cell and back', async function (): Promise<void> {
			await notebookModel.loadContents();
			notebookModel.cells[0].cellType = 'markdown';
			await convertCellAction.doRun({ model: notebookModel, cell: notebookModel.cells[0] });
			assert.equal(notebookModel.cells[0].cellType, 'code', 'Cell was not converted correctly');
			await convertCellAction.doRun({ model: notebookModel, cell: notebookModel.cells[0] });
			assert.equal(notebookModel.cells[0].cellType, 'markdown', 'Cell was not converted correctly second time');
		});
	});
});

async function createandLoadNotebookModel(codeContent?: nb.INotebookContents): Promise<NotebookModel> {
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
				language: 'python'
			}
		},
		nbformat: 4,
		nbformat_minor: 5
	};

	let serviceCollection = new ServiceCollection();
	let instantiationService = new InstantiationService(serviceCollection, true);
	let mockContentManager = TypeMoq.Mock.ofType(NotebookEditorContentManager);
	mockContentManager.setup(c => c.loadContent()).returns(() => Promise.resolve(codeContent ? codeContent : defaultCodeContent));
	let defaultModelOptions: INotebookModelOptions = {
		notebookUri: URI.file('/some/path.ipynb'),
		factory: new ModelFactory(instantiationService),
		notebookManagers: [new NotebookManagerStub()],
		contentManager: mockContentManager.object,
		notificationService: undefined,
		connectionService: undefined,
		providerId: 'SQL',
		cellMagicMapper: undefined,
		defaultKernel: undefined,
		layoutChanged: undefined,
		capabilitiesService: undefined
	};
	return new NotebookModel(defaultModelOptions, undefined, undefined, undefined, undefined);
}
