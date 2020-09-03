/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as vscode from 'vscode';
import * as should from 'should';
import { ProjectProviderRegistry } from '../common/projectProviderRegistry';
import { IProjectProvider, IProjectType } from 'dataworkspace';

export class MockTreeDataProvider implements vscode.TreeDataProvider<any>{
	onDidChangeTreeData?: vscode.Event<any> | undefined;
	getTreeItem(element: any): vscode.TreeItem | Thenable<vscode.TreeItem> {
		throw new Error('Method not implemented.');
	}
	getChildren(element?: any): vscode.ProviderResult<any[]> {
		throw new Error('Method not implemented.');
	}
}

export function createProjectProvider(projectTypes: IProjectType[]): IProjectProvider {
	const treeDataProvider = new MockTreeDataProvider();
	const projectProvider: IProjectProvider = {
		supportedProjectTypes: projectTypes,
		getProjectTreeDataProvider: (projectFile: string): Promise<vscode.TreeDataProvider<any>> => {
			return Promise.resolve(treeDataProvider);
		}
	};
	return projectProvider;
}

suite('ProjectProviderRegistry Tests', function (): void {
	test('register and unregister project providers', async () => {
		const provider1 = createProjectProvider([
			{
				projectFileExtension: 'testproj',
				icon: '',
				displayName: 'test project'
			}
		]);
		const provider2 = createProjectProvider([
			{
				projectFileExtension: 'sqlproj',
				icon: '',
				displayName: 'sql project'
			}
		]);
		should.strictEqual(ProjectProviderRegistry.providers.length, 0, 'there should be no project provider at the beginning of the test');
		const disposable1 = ProjectProviderRegistry.registerProvider(provider1);
		should.strictEqual(ProjectProviderRegistry.providers.length, 1, 'there should be only one project provider at this time');
		const disposable2 = ProjectProviderRegistry.registerProvider(provider2);
		should.strictEqual(ProjectProviderRegistry.providers.length, 2, 'there should be 2 project providers at this time');
		disposable1.dispose();
		should.strictEqual(ProjectProviderRegistry.providers.length, 1, 'there should be only one project provider after unregistering a provider');
		should.strictEqual(ProjectProviderRegistry.providers[0].supportedProjectTypes[0].projectFileExtension, 'sqlproj', 'the remaining project provider should be sqlproj');
		disposable2.dispose();
		should.strictEqual(ProjectProviderRegistry.providers.length, 0, 'there should be no project provider after unregistering the providers');
	});

	test('Clear the project provider registry', async () => {
		const provider = createProjectProvider([
			{
				projectFileExtension: 'testproj',
				icon: '',
				displayName: 'test project'
			}
		]);
		should.strictEqual(ProjectProviderRegistry.providers.length, 0, 'there should be no project provider at the beginning of the test');
		ProjectProviderRegistry.registerProvider(provider);
		should.strictEqual(ProjectProviderRegistry.providers.length, 1, 'there should be only one project provider at this time');
		ProjectProviderRegistry.clear();
		should.strictEqual(ProjectProviderRegistry.providers.length, 0, 'there should be no project provider after clearing the registry');
	});
});
