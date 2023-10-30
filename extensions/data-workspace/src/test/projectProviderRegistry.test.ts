/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDashboardTable, IProjectAction, IProjectProvider, IProjectType } from 'dataworkspace';
import 'mocha';
import * as should from 'should';
import * as vscode from 'vscode';
import { ProjectProviderRegistry } from '../common/projectProviderRegistry';
import { prettyPrintProviders } from './testUtils';

export class MockTreeDataProvider implements vscode.TreeDataProvider<any>{
	onDidChangeTreeData?: vscode.Event<any> | undefined;
	getTreeItem(element: any): vscode.TreeItem | Thenable<vscode.TreeItem> {
		throw new Error('Method not implemented.');
	}
	getChildren(element?: any): vscode.ProviderResult<any[]> {
		throw new Error('Method not implemented.');
	}
}

export function createProjectProvider(projectTypes: IProjectType[], projectActions: IProjectAction[], dashboardComponents: IDashboardTable[]): IProjectProvider {
	const treeDataProvider = new MockTreeDataProvider();
	const projectProvider: IProjectProvider = {
		supportedProjectTypes: projectTypes,
		getProjectTreeDataProvider: (projectFile: vscode.Uri): Promise<vscode.TreeDataProvider<any>> => {
			return Promise.resolve(treeDataProvider);
		},
		createProject: (name: string, location: vscode.Uri, projectTypeId: string): Promise<vscode.Uri> => {
			return Promise.resolve(location);
		},
		projectToolbarActions: projectActions,
		getDashboardComponents: (projectFile: string): IDashboardTable[] => {
			return dashboardComponents;
		}
	};
	return projectProvider;
}

suite('ProjectProviderRegistry Tests', function (): void {
	this.beforeEach(() => {
		ProjectProviderRegistry.clear();
	});

	test('register and unregister project providers', async () => {
		const provider1 = createProjectProvider([
			{
				id: 'tp1',
				projectFileExtension: 'testproj',
				icon: '',
				displayName: 'test project',
				description: ''
			}, {
				id: 'tp2',
				projectFileExtension: 'testproj1',
				icon: '',
				displayName: 'test project 1',
				description: ''
			}
		],
			[{
				id: 'testAction1',
				run: async (): Promise<any> => { return Promise.resolve(); }
			},
			{
				id: 'testAction2',
				run: async (): Promise<any> => { return Promise.resolve(); }
			}],
			[{
				name: 'tableInfo1',
				columns: [{ displayName: 'c1', width: 75, type: 'string' }],
				data: [['d1']]
			},
			{
				name: 'tableInfo2',
				columns: [{ displayName: 'c1', width: 75, type: 'string' }],
				data: [['d1']]
			}]);
		const provider2 = createProjectProvider([
			{
				id: 'sp1',
				projectFileExtension: 'sqlproj',
				icon: '',
				displayName: 'sql project',
				description: ''
			}
		],
			[{
				id: 'Add',
				run: async (): Promise<any> => { return Promise.resolve(); }
			},
			{
				id: 'Schema Compare',
				run: async (): Promise<any> => { return Promise.resolve(); }
			},
			{
				id: 'Build',
				run: async (): Promise<any> => { return Promise.resolve(); }
			},
			{
				id: 'Publish',
				run: async (): Promise<any> => { return Promise.resolve(); }
			},
			{
				id: 'Target Version',
				run: async (): Promise<any> => { return Promise.resolve(); }
			}],
			[{
				name: 'Deployments',
				columns: [{ displayName: 'c1', width: 75, type: 'string' }],
				data: [['d1']]
			},
			{
				name: 'Builds',
				columns: [{ displayName: 'c1', width: 75, type: 'string' }],
				data: [['d1']]
			}]);
		should.strictEqual(ProjectProviderRegistry.providers.length, 0, `there should be no project provider at the beginning of the test, but found ${prettyPrintProviders()}`);
		const disposable1 = ProjectProviderRegistry.registerProvider(provider1, 'test.testProvider');
		let providerResult = ProjectProviderRegistry.getProviderByProjectExtension('testproj');
		should.equal(providerResult, provider1, 'provider1 should be returned for testproj project type');
		// make sure the project type is case-insensitive for getProviderByProjectType method
		providerResult = ProjectProviderRegistry.getProviderByProjectExtension('TeStProJ');
		should.equal(providerResult, provider1, 'provider1 should be returned for testproj project type');
		providerResult = ProjectProviderRegistry.getProviderByProjectExtension('testproj1');
		should.equal(providerResult, provider1, 'provider1 should be returned for testproj1 project type');
		should.strictEqual(ProjectProviderRegistry.providers.length, 1, 'there should be only one project provider at this time');
		const disposable2 = ProjectProviderRegistry.registerProvider(provider2, 'test.testProvider2');
		providerResult = ProjectProviderRegistry.getProviderByProjectExtension('sqlproj');
		should.equal(providerResult, provider2, 'provider2 should be returned for sqlproj project type');
		should.strictEqual(ProjectProviderRegistry.providers.length, 2, 'there should be 2 project providers at this time');

		// unregister provider1
		disposable1.dispose();
		providerResult = ProjectProviderRegistry.getProviderByProjectExtension('testproj');
		should.equal(providerResult, undefined, 'undefined should be returned for testproj project type');
		providerResult = ProjectProviderRegistry.getProviderByProjectExtension('testproj1');
		should.equal(providerResult, undefined, 'undefined should be returned for testproj1 project type');
		providerResult = ProjectProviderRegistry.getProviderByProjectExtension('sqlproj');
		should.equal(providerResult, provider2, 'provider2 should be returned for sqlproj project type after provider1 is disposed');
		should.strictEqual(ProjectProviderRegistry.providers.length, 1, 'there should be only one project provider after unregistering a provider');
		should.strictEqual(ProjectProviderRegistry.providers[0].supportedProjectTypes[0].projectFileExtension, 'sqlproj', 'the remaining project provider should be sqlproj');

		// unregister provider2
		disposable2.dispose();
		providerResult = ProjectProviderRegistry.getProviderByProjectExtension('sqlproj');
		should.equal(providerResult, undefined, 'undefined should be returned for sqlproj project type after provider2 is disposed');
		should.strictEqual(ProjectProviderRegistry.providers.length, 0, `there should be no project provider after unregistering the providers, but found ${prettyPrintProviders()}`);
	});

	test('Clear the project provider registry', async () => {
		const provider = createProjectProvider([
			{
				id: 'tp1',
				projectFileExtension: 'testproj',
				icon: '',
				displayName: 'test project',
				description: ''
			}
		],
			[{
				id: 'testAction1',
				run: async (): Promise<any> => { return Promise.resolve(); }
			}],
			[{
				name: 'tableInfo1',
				columns: [{ displayName: 'c1', width: 75, type: 'string' }],
				data: [['d1']]
			}]);
		should.strictEqual(ProjectProviderRegistry.providers.length, 0, `there should be no project provider at the beginning of the test, but found ${prettyPrintProviders()}`);
		ProjectProviderRegistry.registerProvider(provider, 'test.testProvider');
		should.strictEqual(ProjectProviderRegistry.providers.length, 1, `there should be only one project provider at this time, but found ${prettyPrintProviders()}`);
		ProjectProviderRegistry.clear();
		should.strictEqual(ProjectProviderRegistry.providers.length, 0, `there should be no project provider after clearing the registry, but found ${prettyPrintProviders()}`);
	});
});
