/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as should from 'should';
import { WorkspaceTreeDataProvider } from '../common/workspaceTreeDataProvider';
import { WorkspaceService } from '../services/workspaceService';
import { IProjectProvider, WorkspaceTreeItem } from 'dataworkspace';
import { MockTreeDataProvider } from './projectProviderRegistry.test';

suite('workspaceTreeDataProvider Tests', function (): void {
	const workspaceService = new WorkspaceService();
	const treeProvider = new WorkspaceTreeDataProvider(workspaceService);

	this.afterEach(() => {
		sinon.restore();
	});

	test('test refresh()', () => {
		const treeDataChangeHandler = sinon.stub();
		treeProvider.onDidChangeTreeData!((e) => {
			treeDataChangeHandler(e);
		});
		treeProvider.refresh();
		should.strictEqual(treeDataChangeHandler.calledOnce, true);
	});

	test('test getTreeItem()', () => {
		const getTreeItemStub = sinon.stub();
		treeProvider.getTreeItem(({
			treeDataProvider: ({
				getTreeItem: (arg: WorkspaceTreeItem) => {
					return getTreeItemStub(arg);
				}
			}) as vscode.TreeDataProvider<any>
		}) as WorkspaceTreeItem);
		should.strictEqual(getTreeItemStub.calledOnce, true);
	});

	test('test getChildren() for non-root element', async () => {
		const getChildrenStub = sinon.stub().resolves([]);
		const element = {
			treeDataProvider: ({
				getChildren: (arg: any) => {
					return getChildrenStub(arg);
				}
			}) as vscode.TreeDataProvider<any>,
			element: 'obj1'
		};
		const children = await treeProvider.getChildren(element);
		should.strictEqual(children.length, 0, 'children count should be 0');
		should.strictEqual(getChildrenStub.calledWithExactly('obj1'), true, 'getChildren parameter should be obj1')
	});

	test('test getChildren() for root element', async () => {
		const getProjectsInWorkspaceStub = sinon.stub(workspaceService, 'getProjectsInWorkspace').resolves(
			[
				vscode.Uri.file('test/proj1/proj1.sqlproj'),
				vscode.Uri.file('test/proj2/proj2.csproj')
			]
		);
		const treeDataProvider = new MockTreeDataProvider();
		const projectProvider: IProjectProvider = {
			supportedProjectTypes: [{
				projectFileExtension: 'sqlproj',
				icon: '',
				displayName: 'sql project'
			}],
			RemoveProject: (projectFile: vscode.Uri): Promise<void> => {
				return Promise.resolve();
			},
			getProjectTreeDataProvider: (projectFile: vscode.Uri): Promise<vscode.TreeDataProvider<any>> => {
				return Promise.resolve(treeDataProvider);
			}
		};
		const getProjectProviderStub = sinon.stub(workspaceService, 'getProjectProvider');
		getProjectProviderStub.onFirstCall().resolves(undefined);
		getProjectProviderStub.onSecondCall().resolves(projectProvider);
		sinon.stub(treeDataProvider, 'getChildren').resolves(['treeitem1']);
		const showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage');
		const children = await treeProvider.getChildren(undefined);
		should.strictEqual(children.length, 1, 'there should be 1 tree item returned');
		should.strictEqual(children[0].element, 'treeitem1');
		should.strictEqual(getProjectsInWorkspaceStub.calledOnce, true, 'getProjectsInWorkspaceStub should be called');
		should.strictEqual(getProjectProviderStub.calledTwice, true, 'getProjectProvider should be called twice');
		should.strictEqual(showErrorMessageStub.calledOnce, true, 'showErrorMessage should be called once');
	});
});
