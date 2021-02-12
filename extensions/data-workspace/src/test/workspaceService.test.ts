/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as should from 'should';
import * as path from 'path';
import { WorkspaceService } from '../services/workspaceService';
import { ProjectProviderRegistry } from '../common/projectProviderRegistry';
import { createProjectProvider } from './projectProviderRegistry.test';

const DefaultWorkspaceFilePath = '/test/folder/ws.code-workspace';

/**
 * Create a stub for vscode.workspace.workspaceFile
 * @param workspaceFilePath The workspace file to return
 */
function stubWorkspaceFile(workspaceFilePath: string | undefined): sinon.SinonStub {
	return sinon.stub(vscode.workspace, 'workspaceFile').value(workspaceFilePath ? vscode.Uri.file(workspaceFilePath) : undefined);
}

/**
 * Create a stub for vscode.workspace.getConfiguration
 * @param returnValue the configuration value to return
 */
function stubGetConfigurationValue(getStub?: sinon.SinonStub, updateStub?: sinon.SinonStub): sinon.SinonStub {
	return sinon.stub(vscode.workspace, 'getConfiguration').returns({
		get: (configurationName: string) => {
			return getStub!(configurationName);
		},
		update: (section: string, value: any, configurationTarget?: vscode.ConfigurationTarget | boolean, overrideInLanguage?: boolean) => {
			updateStub!(section, value, configurationTarget);
		}
	} as vscode.WorkspaceConfiguration);
}

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

suite('WorkspaceService Tests', function (): void {
	const service = new WorkspaceService();

	this.afterEach(() => {
		sinon.restore();
	});

	test('test getProjectsInWorkspace', async () => {
		// No workspace is loaded
		stubWorkspaceFile(undefined);
		let projects = await service.getProjectsInWorkspace();
		should.strictEqual(projects.length, 0, 'no projects should be returned when no workspace is loaded');

		// from this point on, workspace is loaded
		stubWorkspaceFile(DefaultWorkspaceFilePath);

		// No projects are present in the workspace file
		const getConfigurationStub = stubGetConfigurationValue(sinon.stub().returns([]));
		projects = await service.getProjectsInWorkspace();
		should.strictEqual(projects.length, 0, 'no projects should be returned when projects are present in the workspace file');
		getConfigurationStub.restore();

		// Projects are present
		stubGetConfigurationValue(sinon.stub().returns(['abc.sqlproj', 'folder1/abc1.sqlproj', 'folder2/abc2.sqlproj']));
		projects = await service.getProjectsInWorkspace();
		should.strictEqual(projects.length, 3, 'there should be 2 projects');
		const project1 = vscode.Uri.file('/test/folder/abc.sqlproj');
		const project2 = vscode.Uri.file('/test/folder/folder1/abc1.sqlproj');
		const project3 = vscode.Uri.file('/test/folder/folder2/abc2.sqlproj');
		should.strictEqual(projects[0].path, project1.path);
		should.strictEqual(projects[1].path, project2.path);
		should.strictEqual(projects[2].path, project3.path);
	});

	test('test getAllProjectTypes', async () => {
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

	test('test getProjectProvider', async () => {
		const extension1 = createMockExtension('ext1', true, ['csproj']);
		const extension2 = createMockExtension('ext2', false, ['sqlproj']);
		const extension3 = createMockExtension('ext3', false, ['dbproj']);
		stubAllExtensions([extension1, extension2, extension3].map(ext => ext.extension));
		const getProviderByProjectTypeStub = sinon.stub(ProjectProviderRegistry, 'getProviderByProjectType');
		getProviderByProjectTypeStub.onFirstCall().returns(undefined);
		getProviderByProjectTypeStub.onSecondCall().returns(createProjectProvider([
			{
				projectFileExtension: 'sqlproj',
				icon: '',
				displayName: 'test project'
			}
		]));
		let provider = await service.getProjectProvider(vscode.Uri.file('abc.sqlproj'));
		should.notStrictEqual(provider, undefined, 'Provider should be returned for sqlproj');
		should.strictEqual(provider!.supportedProjectTypes[0].projectFileExtension, 'sqlproj');
		should.strictEqual(extension1.activationStub.notCalled, true, 'the ext1.activate() should not have been called for sqlproj');
		should.strictEqual(extension2.activationStub.calledOnce, true, 'the ext2.activate() should have been called once after requesting sqlproj provider');
		should.strictEqual(extension3.activationStub.notCalled, true, 'the ext3.activate() should not have been called for sqlproj');

		getProviderByProjectTypeStub.reset();
		getProviderByProjectTypeStub.returns(createProjectProvider([{
			projectFileExtension: 'csproj',
			icon: '',
			displayName: 'test cs project'
		}]));
		provider = await service.getProjectProvider(vscode.Uri.file('abc.csproj'));
		should.notStrictEqual(provider, undefined, 'Provider should be returned for csproj');
		should.strictEqual(provider!.supportedProjectTypes[0].projectFileExtension, 'csproj');
		should.strictEqual(extension1.activationStub.notCalled, true, 'the ext1.activate() should not have been called for csproj');
		should.strictEqual(extension2.activationStub.calledOnce, true, 'the ext2.activate() should still have been called once');
		should.strictEqual(extension3.activationStub.notCalled, true, 'the ext3.activate() should not have been called for csproj');
	});

	test('test addProjectsToWorkspace', async () => {
		const processPath = (original: string): string => {
			return original.replace(/\//g, path.sep);
		};
		stubWorkspaceFile(DefaultWorkspaceFilePath);
		const updateConfigurationStub = sinon.stub();
		const getConfigurationStub = sinon.stub().returns([processPath('folder1/proj2.sqlproj')]);
		const onWorkspaceProjectsChangedStub = sinon.stub();
		const onWorkspaceProjectsChangedDisposable = service.onDidWorkspaceProjectsChange(() => {
			onWorkspaceProjectsChangedStub();
		});
		stubGetConfigurationValue(getConfigurationStub, updateConfigurationStub);
		const asRelativeStub = sinon.stub(vscode.workspace, 'asRelativePath');
		sinon.stub(vscode.workspace, 'workspaceFolders').value(['.']);
		asRelativeStub.onFirstCall().returns(`proj1.sqlproj`);
		asRelativeStub.onSecondCall().returns(processPath('/test/other/proj3.sqlproj'));
		const updateWorkspaceFoldersStub = sinon.stub(vscode.workspace, 'updateWorkspaceFolders');
		await service.addProjectsToWorkspace([
			vscode.Uri.file('/test/folder/proj1.sqlproj'), // within the workspace folder
			vscode.Uri.file('/test/folder/folder1/proj2.sqlproj'), //already exists
			vscode.Uri.file('/test/other/proj3.sqlproj') // outside of workspace folder
		]);
		should.strictEqual(updateConfigurationStub.calledOnce, true, 'update configuration should have been called once');
		should.strictEqual(updateWorkspaceFoldersStub.calledOnce, true, 'updateWorkspaceFolders should have been called once');
		should.strictEqual(updateConfigurationStub.calledWith('projects', sinon.match.array.deepEquals([
			processPath('folder1/proj2.sqlproj'),
			processPath('proj1.sqlproj'),
			processPath('../other/proj3.sqlproj')
		]), vscode.ConfigurationTarget.Workspace), true, 'updateConfiguration parameters does not match expectation');
		should.strictEqual(updateWorkspaceFoldersStub.calledWith(1, null, sinon.match((arg) => {
			return arg.uri.path === '/test/other';
		})), true, 'updateWorkspaceFolder parameters does not match expectation');
		should.strictEqual(onWorkspaceProjectsChangedStub.calledOnce, true, 'the onDidWorkspaceProjectsChange event should have been fired');
		onWorkspaceProjectsChangedDisposable.dispose();
	});

	test('test removeProject', async () => {
		const processPath = (original: string): string => {
			return original.replace(/\//g, path.sep);
		};
		stubWorkspaceFile(DefaultWorkspaceFilePath);
		const updateConfigurationStub = sinon.stub();
		const getConfigurationStub = sinon.stub().returns([processPath('folder1/proj2.sqlproj'), processPath('folder2/proj3.sqlproj')]);
		const onWorkspaceProjectsChangedStub = sinon.stub();
		const onWorkspaceProjectsChangedDisposable = service.onDidWorkspaceProjectsChange(() => {
			onWorkspaceProjectsChangedStub();
		});
		stubGetConfigurationValue(getConfigurationStub, updateConfigurationStub);
		await service.removeProject(vscode.Uri.file('/test/folder/folder1/proj2.sqlproj'));
		should.strictEqual(updateConfigurationStub.calledWith('projects', sinon.match.array.deepEquals([
			processPath('folder2/proj3.sqlproj')
		]), vscode.ConfigurationTarget.Workspace), true, 'updateConfiguration parameters does not match expectation for remove project');
		should.strictEqual(onWorkspaceProjectsChangedStub.calledOnce, true, 'the onDidWorkspaceProjectsChange event should have been fired');
		onWorkspaceProjectsChangedDisposable.dispose();
	});

});
