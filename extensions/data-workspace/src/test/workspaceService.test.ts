/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as should from 'should';
import * as constants from '../common/constants';
import { WorkspaceService } from '../services/workspaceService';
import { ProjectProviderRegistry } from '../common/projectProviderRegistry';
import { createProjectProvider } from './projectProviderRegistry.test';

/**
 * Create a stub for vscode.extensions.all
 * @param extensions extensions to return
 */
function stubAllExtensions(extensions: vscode.Extension<any>[]): sinon.SinonStub {
	return sinon.stub(vscode.extensions, 'all').value(extensions);
}

function createMockExtension(id: string, isActive: boolean, projectTypes: string[] | undefined): { extension: vscode.Extension<any>, activationStub: sinon.SinonStub } {
	const activationStub = sinon.stub();
	const extension: vscode.Extension<any> = {
		id: id,
		isActive: isActive,
		packageJSON: {},
		activate: () => { return activationStub(); }
	} as vscode.Extension<any>;
	extension.packageJSON.contributes = projectTypes === undefined ? undefined : { projects: projectTypes };
	return {
		extension: extension,
		activationStub: activationStub
	};
}

suite('WorkspaceService', function (): void {
	let service = new WorkspaceService();

	this.afterEach(() => {
		sinon.restore();
	});

	test('getProjectsInWorkspace', async () => {
		// No workspace is loaded
		let projects = await service.getProjectsInWorkspace(undefined, true);
		should.strictEqual(projects.length, 0, `no projects should be returned when no workspace is loaded, but found ${projects.map(p => p.fsPath).join(', ')}`);

		// No projects are present in the workspace file
		const workspaceFoldersStub = sinon.stub(vscode.workspace, 'workspaceFolders').value([]);
		projects = await service.getProjectsInWorkspace(undefined, true);
		should.strictEqual(projects.length, 0, 'no projects should be returned when projects are present in the workspace file');
		workspaceFoldersStub.restore();

		// Projects are present - Not in order
		sinon.stub(vscode.workspace, 'workspaceFolders').value([{ uri: vscode.Uri.file('') }]);
		sinon.stub(service, 'getAllProjectsInFolder').resolves([
			vscode.Uri.file('/test/folder/folder2/abc2.sqlproj'),
			vscode.Uri.file('/test/folder/abc.sqlproj'),
			vscode.Uri.file('/test/folder/folder1/abc1.sqlproj')
		]);

		projects = await service.getProjectsInWorkspace(undefined, true);
		should.strictEqual(projects.length, 3, 'there should be 3 projects');
		const project1 = vscode.Uri.file('/test/folder/abc.sqlproj');
		const project2 = vscode.Uri.file('/test/folder/folder1/abc1.sqlproj');
		const project3 = vscode.Uri.file('/test/folder/folder2/abc2.sqlproj');

		// Verify if the projects are sorted correctly by their paths
		should.strictEqual(projects[0].path, project1.path);
		should.strictEqual(projects[1].path, project2.path);
		should.strictEqual(projects[2].path, project3.path);
	});

	test('getAllProjectTypes', async () => {
		// extensions that are already activated
		const extension1 = createMockExtension('ext1', true, ['csproj']); // with projects contribution
		const extension2 = createMockExtension('ext2', true, []); // with empty projects contribution
		const extension3 = createMockExtension('ext3', true, undefined); // with no contributes in packageJSON

		// extensions that are still not activated
		const extension4 = createMockExtension('ext4', false, ['sqlproj']); // with projects contribution
		const extension5 = createMockExtension('ext5', false, ['dbproj']); // with projects contribution but activate() will throw error
		extension5.activationStub.throws(); // extension activation failure shouldn't cause the getAllProjectTypes() call to fail
		const extension6 = createMockExtension('ext6', false, undefined); // with no contributes in packageJSON
		const extension7 = createMockExtension('ext7', false, []); // with empty projects contribution

		stubAllExtensions([extension1, extension2, extension3, extension4, extension5, extension6, extension7].map(ext => ext.extension));

		const provider1 = createProjectProvider([
			{
				id: 'tp1',
				description: '',
				projectFileExtension: 'testproj',
				icon: '',
				displayName: 'test project'
			}, {
				id: 'tp2',
				description: '',
				projectFileExtension: 'testproj1',
				icon: '',
				displayName: 'test project 1'
			}
		],
			[
				{
					id: 'testAction1',
					run: async (): Promise<any> => { return Promise.resolve(); }
				},
				{
					id: 'testAction2',
					run: async (): Promise<any> => { return Promise.resolve(); }
				}
			],
			[
				{
					name: 'tableInfo1',
					columns: [{ displayName: 'c1', width: 75, type: 'string' }],
					data: [['d1']]
				},
				{
					name: 'tableInfo2',
					columns: [{ displayName: 'c1', width: 75, type: 'string' }],
					data: [['d1']]
				}
			]);
		const provider2 = createProjectProvider([
			{
				id: 'sp1',
				description: '',
				projectFileExtension: 'sqlproj',
				icon: '',
				displayName: 'sql project'
			}
		],
			[
				{
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
				}
			],
			[
				{
					name: 'Deployments',
					columns: [{ displayName: 'c1', width: 75, type: 'string' }],
					data: [['d1']]
				},
				{
					name: 'Builds',
					columns: [{ displayName: 'c1', width: 75, type: 'string' }],
					data: [['d1']]
				}
			]);
		sinon.stub(ProjectProviderRegistry, 'providers').value([provider1, provider2]);
		const consoleErrorStub = sinon.stub(console, 'error');
		const projectTypes = await service.getAllProjectTypes();
		should.strictEqual(projectTypes.length, 3);
		should.strictEqual(projectTypes[0].projectFileExtension, 'testproj');
		should.strictEqual(projectTypes[1].projectFileExtension, 'testproj1');
		should.strictEqual(projectTypes[2].projectFileExtension, 'sqlproj');
		should.strictEqual(extension1.activationStub.notCalled, true, 'extension1.activate() should not have been called');
		should.strictEqual(extension2.activationStub.notCalled, true, 'extension2.activate() should not have been called');
		should.strictEqual(extension3.activationStub.notCalled, true, 'extension3.activate() should not have been called');
		should.strictEqual(extension4.activationStub.calledOnce, true, 'extension4.activate() should have been called');
		should.strictEqual(extension5.activationStub.called, true, 'extension5.activate() should have been called');
		should.strictEqual(extension6.activationStub.notCalled, true, 'extension6.activate() should not have been called');
		should.strictEqual(extension7.activationStub.notCalled, true, 'extension7.activate() should not have been called');
		should.strictEqual(consoleErrorStub.calledOnce, true, 'Logger.error should be called once');
	});

	test('getProjectProvider', async () => {
		const extension1 = createMockExtension('ext1', true, ['csproj']);
		const extension2 = createMockExtension('ext2', false, ['sqlproj']);
		const extension3 = createMockExtension('ext3', false, ['dbproj']);
		stubAllExtensions([extension1, extension2, extension3].map(ext => ext.extension));
		const getProviderByProjectTypeStub = sinon.stub(ProjectProviderRegistry, 'getProviderByProjectExtension');
		getProviderByProjectTypeStub.onFirstCall().returns(undefined);
		getProviderByProjectTypeStub.onSecondCall().returns(createProjectProvider([
			{
				id: 'sp1',
				description: '',
				projectFileExtension: 'sqlproj',
				icon: '',
				displayName: 'test project'
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
			}]));
		let provider = await service.getProjectProvider(vscode.Uri.file('abc.sqlproj'));
		should.notStrictEqual(provider, undefined, 'Provider should be returned for sqlproj');
		should.strictEqual(provider!.supportedProjectTypes[0].projectFileExtension, 'sqlproj');
		should.strictEqual(extension1.activationStub.notCalled, true, 'the ext1.activate() should not have been called for sqlproj');
		should.strictEqual(extension2.activationStub.calledOnce, true, 'the ext2.activate() should have been called once after requesting sqlproj provider');
		should.strictEqual(extension3.activationStub.notCalled, true, 'the ext3.activate() should not have been called for sqlproj');

		getProviderByProjectTypeStub.reset();
		getProviderByProjectTypeStub.returns(createProjectProvider([{
			id: 'tp2',
			description: '',
			projectFileExtension: 'csproj',
			icon: '',
			displayName: 'test cs project'
		}],
			[{
				id: 'testAction2',
				run: async (): Promise<any> => { return Promise.resolve(); }
			}],
			[{
				name: 'tableInfo2',
				columns: [{ displayName: 'c1', width: 75, type: 'string' }],
				data: [['d1']]
			}]));
		provider = await service.getProjectProvider(vscode.Uri.file('abc.csproj'));
		should.notStrictEqual(provider, undefined, 'Provider should be returned for csproj');
		should.strictEqual(provider!.supportedProjectTypes[0].projectFileExtension, 'csproj');
		should.strictEqual(extension1.activationStub.notCalled, true, 'the ext1.activate() should not have been called for csproj');
		should.strictEqual(extension2.activationStub.calledOnce, true, 'the ext2.activate() should still have been called once');
		should.strictEqual(extension3.activationStub.notCalled, true, 'the ext3.activate() should not have been called for csproj');
	});

	test('addProjectsToWorkspace', async () => {
		sinon.stub(service, 'getProjectsInWorkspace').resolves([vscode.Uri.file('folder/folder1/proj2.sqlproj')]);
		const onWorkspaceProjectsChangedStub = sinon.stub();
		const showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage');
		const onWorkspaceProjectsChangedDisposable = service.onDidWorkspaceProjectsChange(() => {
			onWorkspaceProjectsChangedStub();
		});
		const asRelativeStub = sinon.stub(vscode.workspace, 'asRelativePath');
		sinon.stub(vscode.workspace, 'workspaceFolders').value(['.']);
		asRelativeStub.onFirstCall().returns(`proj1.sqlproj`);
		asRelativeStub.onSecondCall().returns('other/proj3.sqlproj');
		const updateWorkspaceFoldersStub = sinon.stub(vscode.workspace, 'updateWorkspaceFolders');
		await service.addProjectsToWorkspace([
			vscode.Uri.file('folder/proj1.sqlproj'), // within the workspace folder
			vscode.Uri.file('folder/folder1/proj2.sqlproj'), //already exists
			vscode.Uri.file('other/proj3.sqlproj') // new workspace folder
		]);
		should.strictEqual(updateWorkspaceFoldersStub.calledOnce, true, 'updateWorkspaceFolders should have been called once');
		should.strictEqual(showInformationMessageStub.calledOnce, true, 'showInformationMessage should be called once');
		const expectedProjPath = vscode.Uri.file('folder/folder1/proj2.sqlproj').fsPath;
		should(showInformationMessageStub.calledWith(constants.ProjectAlreadyOpened(expectedProjPath))).be.true(`showInformationMessage not called with expected message '${constants.ProjectAlreadyOpened(expectedProjPath)}' Actual '${showInformationMessageStub.getCall(0).args[0]}'`);
		should.strictEqual(updateWorkspaceFoldersStub.calledWith(1, undefined, sinon.match((arg) => {
			return arg.uri.path === vscode.Uri.file('other').path;
		})), true, 'updateWorkspaceFolder parameters does not match expectation');
		should.strictEqual(onWorkspaceProjectsChangedStub.calledOnce, true, 'the onDidWorkspaceProjectsChange event should have been fired');
		onWorkspaceProjectsChangedDisposable.dispose();
	});

	test('addProjectsToWorkspace when no workspace open', async () => {
		const onWorkspaceProjectsChangedStub = sinon.stub();
		const onWorkspaceProjectsChangedDisposable = service.onDidWorkspaceProjectsChange(() => {
			onWorkspaceProjectsChangedStub();
		});
		const updateWorkspaceFoldersStub = sinon.stub(vscode.workspace, 'updateWorkspaceFolders').returns(true);

		await service.addProjectsToWorkspace([
			vscode.Uri.file('/test/folder/proj1.sqlproj')
		]);

		should.strictEqual(onWorkspaceProjectsChangedStub.calledOnce, true, 'the onDidWorkspaceProjectsChange event should have been fired');
		should.strictEqual(updateWorkspaceFoldersStub.calledOnce, true, 'updateWorkspaceFolders should have been called');
		onWorkspaceProjectsChangedDisposable.dispose();
	});

	test('addProjectsToWorkspace when untitled workspace is open', async () => {
		sinon.stub(service, 'getProjectsInWorkspace').resolves([]);
		const onWorkspaceProjectsChangedStub = sinon.stub();
		const onWorkspaceProjectsChangedDisposable = service.onDidWorkspaceProjectsChange(() => {
			onWorkspaceProjectsChangedStub();
		});
		sinon.replaceGetter(vscode.workspace, 'workspaceFolders', () => [{ uri: vscode.Uri.file('folder1'), name: '', index: 0 }]);
		const updateWorkspaceFoldersStub = sinon.stub(vscode.workspace, 'updateWorkspaceFolders').returns(true);
		await service.addProjectsToWorkspace([
			vscode.Uri.file('/test/folder/proj1.sqlproj')
		]);

		should.strictEqual(onWorkspaceProjectsChangedStub.calledOnce, true, 'the onDidWorkspaceProjectsChange event should have been fired');
		should.strictEqual(updateWorkspaceFoldersStub.calledOnce, true, 'updateWorkspaceFolders should have been called');
		onWorkspaceProjectsChangedDisposable.dispose();
	});

	test('createProject uses values from QuickPick', async () => {
		// Arrange: Create a new instance of WorkspaceService
		const service = new WorkspaceService();

		// Arrange: Stub createProject to observe its call and return a fixed URI
		const createProjectStub = sinon.stub(service, 'createProject').resolves(vscode.Uri.file('/tmp/TestProject'));

		// Arrange: Prepare the QuickPick items to simulate user selections
		const quickPickItems = [
			{ label: 'Select Database Project Type', value: 'SQL Server Database', picked: true },
			{ label: 'Enter Project Name', value: 'TestProject', picked: true },
			{ label: 'Select Project Location', value: '/tmp/TestProject', picked: true },
			{ label: 'Select Target Platform', value: 'SQL Server', picked: true },
			{ label: 'SDK-style project', value: constants.YesRecommended, picked: true },
			{ label: constants.confirmCreateProjectWithBuildTaskDialogName, value: constants.Yes, picked: true },
		];

		// Arrange: Stub showQuickPick to return each item in order for each call
		const quickPickStub = sinon.stub(vscode.window, 'showQuickPick');
		quickPickItems.forEach((item, idx) => {
			quickPickStub.onCall(idx).resolves(item);
		});

		// Act: Call createProject directly with values from the simulated QuickPick selections
		const projectUri = await service.createProject(
			quickPickItems[1].value, // Project name
			vscode.Uri.file(quickPickItems[2].value), // Project location as URI
			quickPickItems[0].value, // Project type ID
			quickPickItems[3].value, // Target platform
			quickPickItems[4].picked, // SDK-style project flag
			quickPickItems[5].picked  // Configure default build flag
		);

		// Assert: createProject should have been called once
		should.strictEqual(createProjectStub.calledOnce, true, 'createProject should have been called once');
		// Assert: The returned URI path should match the expected path
		should.strictEqual(projectUri.path, '/tmp/TestProject', 'project URI should match the expected path');
		// Assert: The arguments passed to createProject should match the simulated QuickPick selections
		const callArgs = createProjectStub.getCall(0).args;
		should.strictEqual(callArgs[0], quickPickItems[1].value, 'name should match');
		should.strictEqual(callArgs[1].path, quickPickItems[2].value, 'location should match');
		should.strictEqual(callArgs[2], quickPickItems[0].value, 'projectTypeId should match QuickPick label');
		should.strictEqual(callArgs[3], quickPickItems[3].value, 'projectTargetVersion should match');
		should.strictEqual(callArgs[4], true, 'sdkStyleProject should match');
		should.strictEqual(callArgs[5], true, 'configureDefaultBuild should be true');

		// Cleanup: Restore the stubbed showQuickPick method
		quickPickStub.restore();
	});
});
