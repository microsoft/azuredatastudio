/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as assert from 'assert';

import { AddCellAction, ClearAllOutputsAction, CollapseCellsAction, TrustedAction } from 'sql/workbench/contrib/notebook/browser/notebookActions';
import { CellType } from 'sql/workbench/contrib/notebook/common/models/contracts';
import { INotebookEditor } from 'sql/workbench/services/notebook/browser/notebookService';
import { NotebookComponentStub } from 'sql/workbench/contrib/notebook/test/browser/common';
import { ICellModel, INotebookModel } from 'sql/workbench/contrib/notebook/browser/models/modelInterfaces';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';

suite('Notebook Actions', function (): void {
	test('Add Cell Action', async function (): Promise<void> {
		let testCellType: CellType = 'code';
		let actualCellType: CellType;

		let mockNotebookComponent = TypeMoq.Mock.ofType<INotebookEditor>(NotebookComponentStub);
		mockNotebookComponent.setup(c => c.addCell(TypeMoq.It.isAny())).returns(cellType => {
			actualCellType = cellType;
		});

		let action = new AddCellAction('TestId', 'TestLabel', 'TestClass');
		action.cellType = testCellType;
		let result = await action.run(mockNotebookComponent.object);

		assert.ok(result, 'Add Cell Action should succeed');
		assert.strictEqual(actualCellType, testCellType);

		mockNotebookComponent.reset();
		mockNotebookComponent.setup(c => c.addCell(TypeMoq.It.isAny())).throws(new Error('Test Error'));
		await assert.rejects(action.run(mockNotebookComponent.object));
	});

	test('Clear All Outputs Action', async function (): Promise<void> {
		let mockNotebookComponent = TypeMoq.Mock.ofType<INotebookEditor>(NotebookComponentStub);
		mockNotebookComponent.setup(c => c.clearAllOutputs()).returns(() => Promise.resolve(true));

		let action = new ClearAllOutputsAction('TestId', 'TestLabel', 'TestClass');
		let result = await action.run(mockNotebookComponent.object);
		assert.ok(result, 'Clear All Outputs Action should succeed');
		mockNotebookComponent.verify(c => c.clearAllOutputs(), TypeMoq.Times.once());

		mockNotebookComponent.reset();
		mockNotebookComponent.setup(c => c.clearAllOutputs()).returns(() => Promise.resolve(false));

		result = await action.run(mockNotebookComponent.object);
		assert.strictEqual(result, false, 'Clear All Outputs Action should have failed');
		mockNotebookComponent.verify(c => c.clearAllOutputs(), TypeMoq.Times.once());
	});

	test('Trusted Action', async function (): Promise<void> {
		let mockNotification = TypeMoq.Mock.ofType<INotificationService>(TestNotificationService);
		mockNotification.setup(n => n.notify(TypeMoq.It.isAny()));

		let action = new TrustedAction('TestId', mockNotification.object);

		assert.strictEqual(action.trusted, false, 'Should not be trusted by default');

		let contextStub = <INotebookEditor>{
			model: <INotebookModel>{
				trustedMode: false
			}
		};
		let result = await action.run(contextStub);
		assert.ok(result, 'Trusted Action should succeed');
		assert.strictEqual(action.trusted, true, 'Should be trusted after toggling trusted state');

		result = await action.run(contextStub);
		assert.ok(result, 'Trusted Action should succeed again');
		assert.strictEqual(action.trusted, true, 'Should stay trusted when trying to toggle trsuted to false');
	});

	test('Run All Cells Action', async function (): Promise<void> {
	});

	test('Collapse Cells Action', async function (): Promise<void> {
		let action = new CollapseCellsAction('TestId');

		assert.strictEqual(action.isCollapsed, false, 'Should not be collapsed by default');

		let context = <INotebookEditor>{
			cells: [<ICellModel>{
				isCollapsed: false
			}, <ICellModel>{
				isCollapsed: true
			}, <ICellModel>{
				isCollapsed: false
			}]
		};
		let result = await action.run(context);
		assert.ok(result, 'Collapse Cells Action should succeed');

		assert.strictEqual(action.isCollapsed, true, 'Action should be collapsed after first toggle');
		context.cells.forEach(cell => {
			assert.strictEqual(cell.isCollapsed, true, 'Cells should be collapsed after first toggle');
		});

		result = await action.run(context);
		assert.ok(result, 'Collapse Cells Action should succeed');

		assert.strictEqual(action.isCollapsed, false, 'Action should not be collapsed after second toggle');
		context.cells.forEach(cell => {
			assert.strictEqual(cell.isCollapsed, false, 'Cells should not be collapsed after second toggle');
		});
	});

	test('Kernels Dropdown', async function (): Promise<void> {
	});

	test('AttachTo Dropdown', async function (): Promise<void> {
	});

	test('New Notebook Action', async function (): Promise<void> {
	});
});
