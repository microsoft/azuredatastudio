/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import { CellToggleMoreActions, RunCellsAction, removeDuplicatedAndStartingSeparators, AddCellFromContextAction, CollapseCellAction } from 'sql/workbench/contrib/notebook/browser/cellToolbarActions';
import { NotebookService } from 'sql/workbench/services/notebook/browser/notebookServiceImpl';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { TestLifecycleService } from 'vs/workbench/test/browser/workbenchTestServices';
import { Separator } from 'vs/base/browser/ui/actionbar/actionbar';
import { CellContext } from 'sql/workbench/contrib/notebook/browser/cellViews/codeActions';
import { INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { MockContextKeyService } from 'vs/platform/keybinding/test/common/mockKeybindingService';
import * as DOM from 'vs/base/browser/dom';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { ContextMenuService } from 'vs/platform/contextview/browser/contextMenuService';
import { CellModel } from 'sql/workbench/services/notebook/browser/models/cell';
import { IProductService } from 'vs/platform/product/common/productService';

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
			assert(action['_moreActions']['viewItems'][0]['_action']['_actions'].length === 13, 'Unexpected number of valid elements');
		});

		test('CellToggleMoreActions with Markdown CellType', function (): void {
			const testContainer = DOM.$('div');
			cellModelMock.setup(x => x.cellType).returns(() => 'markdown');
			const action = new CellToggleMoreActions(instantiationService);
			action.onInit(testContainer, contextMock.object);
			// Markdown elements don't show the code-cell related actions such as Run Cell
			assert(action['_moreActions']['viewItems'][0]['_action']['_actions'].length === 5, 'Unexpected number of valid elements');
		});
	});
});
