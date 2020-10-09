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
		RemoveProject: (projectFile: vscode.Uri): Promise<void> => {
			return Promise.resolve();
		},
		getProjectTreeDataProvider: (projectFile: vscode.Uri): Promise<vscode.TreeDataProvider<any>> => {
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
			}, {
				projectFileExtension: 'testproj1',
				icon: '',
				displayName: 'test project 1'
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
		let providerResult = ProjectProviderRegistry.getProviderByProjectType('testproj');
		should.equal(providerResult, provider1, 'provider1 should be returned for testproj project type');
		// make sure the project type is case-insensitive for getProviderByProjectType method
		providerResult = ProjectProviderRegistry.getProviderByProjectType('TeStProJ');
		should.equal(providerResult, provider1, 'provider1 should be returned for testproj project type');
		providerResult = ProjectProviderRegistry.getProviderByProjectType('testproj1');
		should.equal(providerResult, provider1, 'provider1 should be returned for testproj1 project type');
		should.strictEqual(ProjectProviderRegistry.providers.length, 1, 'there should be only one project provider at this time');
		const disposable2 = ProjectProviderRegistry.registerProvider(provider2);
		providerResult = ProjectProviderRegistry.getProviderByProjectType('sqlproj');
		should.equal(providerResult, provider2, 'provider2 should be returned for sqlproj project type');
		should.strictEqual(ProjectProviderRegistry.providers.length, 2, 'there should be 2 project providers at this time');

		// unregister provider1
		disposable1.dispose();
		providerResult = ProjectProviderRegistry.getProviderByProjectType('testproj');
		should.equal(providerResult, undefined, 'undefined should be returned for testproj project type');
		providerResult = ProjectProviderRegistry.getProviderByProjectType('testproj1');
		should.equal(providerResult, undefined, 'undefined should be returned for testproj1 project type');
		providerResult = ProjectProviderRegistry.getProviderByProjectType('sqlproj');
		should.equal(providerResult, provider2, 'provider2 should be returned for sqlproj project type after provider1 is disposed');
		should.strictEqual(ProjectProviderRegistry.providers.length, 1, 'there should be only one project provider after unregistering a provider');
		should.strictEqual(ProjectProviderRegistry.providers[0].supportedProjectTypes[0].projectFileExtension, 'sqlproj', 'the remaining project provider should be sqlproj');

		// unregister provider2
		disposable2.dispose();
		providerResult = ProjectProviderRegistry.getProviderByProjectType('sqlproj');
		should.equal(providerResult, undefined, 'undefined should be returned for sqlproj project type after provider2 is disposed');
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
