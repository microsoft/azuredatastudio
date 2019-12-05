/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as assert from 'assert';

// import { NotebookContexts } from 'sql/workbench/contrib/notebook/browser/models/notebookContexts';
// import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
// import { TestConnectionManagementService } from 'sql/platform/connection/test/common/testConnectionManagementService';
// import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
// import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
// import { mssqlProviderName } from 'sql/platform/connection/common/constants';
// import { IDefaultConnection } from 'sql/workbench/contrib/notebook/browser/models/modelInterfaces';
import { AddCellAction, ClearAllOutputsAction, ToggleableAction, CollapseCellsAction } from 'sql/workbench/contrib/notebook/browser/notebookActions';
import { CellType } from 'sql/workbench/contrib/notebook/common/models/contracts';
import { INotebookEditor } from 'sql/workbench/services/notebook/browser/notebookService';
import { NotebookComponentStub } from 'sql/workbench/contrib/notebook/test/browser/common';
import { ICellModel } from 'sql/workbench/contrib/notebook/browser/models/modelInterfaces';

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
