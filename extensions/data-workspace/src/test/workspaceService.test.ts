/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as sinon from 'sinon';
import * as should from 'should';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import * as constants from '../common/constants';
import * as utils from '../common/utils';
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

interface ExtensionGlobalMemento extends vscode.Memento {
	setKeysForSync(keys: string[]): void;
}

suite('WorkspaceService Tests', function (): void {
	const mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
	const mockGlobalState = TypeMoq.Mock.ofType<ExtensionGlobalMemento>();
	mockGlobalState.setup(x => x.update(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve());
	mockExtensionContext.setup(x => x.globalState).returns(() => mockGlobalState.object);

	const service = new WorkspaceService(mockExtensionContext.object);

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
		[{
			id: 'ta1',
			run: async (): Promise<any> => { return Promise.resolve(); }
		},
		{
			id: 'ta2',
			run: async (): Promise<any> => { return Promise.resolve(); }
		}],
		[{
			tableName: 'ti1',
			columnInfo: [{ displayName: 'c1', width: 75, valueType: azdata.DeclarativeDataType.string }],
			columnData: [[{ value: 'd1' }]]
		},
		{
			tableName: 'ti2',
			columnInfo: [{ displayName: 'c1', width: 75, valueType: azdata.DeclarativeDataType.string }],
			columnData: [[{ value: 'd1' }]]
		}]);
		const provider2 = createProjectProvider([
			{
				id: 'sp1',
				description: '',
				projectFileExtension: 'sqlproj',
				icon: '',
				displayName: 'sql project'
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
			tableName: 'Deployments',
			columnInfo: [{ displayName: 'c1', width: 75, valueType: azdata.DeclarativeDataType.string }],
			columnData: [[{ value: 'd1' }]]
		},
		{
			tableName: 'Builds',
			columnInfo: [{ displayName: 'c1', width: 75, valueType: azdata.DeclarativeDataType.string }],
			columnData: [[{ value: 'd1' }]]
		}]);
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
			tableName: 'Deployments',
			columnInfo: [{ displayName: 'c1', width: 75, valueType: azdata.DeclarativeDataType.string }],
			columnData: [[{ value: 'd1' }]]
		},
		{
			tableName: 'Builds',
			columnInfo: [{ displayName: 'c1', width: 75, valueType: azdata.DeclarativeDataType.string }],
			columnData: [[{ value: 'd1' }]]
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
			id: 'ta2',
			run: async (): Promise<any> => { return Promise.resolve(); }
		}],
		[{
			tableName: 'ti2',
			columnInfo: [{ displayName: 'c1', width: 75, valueType: azdata.DeclarativeDataType.string }],
			columnData: [[{ value: 'd1' }]]
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
		const showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage');
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
		should.strictEqual(showInformationMessageStub.calledOnce, true, 'showInformationMessage should be called once');
		should(showInformationMessageStub.calledWith(constants.ProjectAlreadyOpened(processPath('/test/folder/folder1/proj2.sqlproj')))).be.true(`showInformationMessage not called with expected message '${constants.ProjectAlreadyOpened(processPath('/test/folder/folder1/proj2.sqlproj'))}' Actual '${showInformationMessageStub.getCall(0).args[0]}'`);
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

	test('test addProjectsToWorkspace when no workspace open', async () => {
		stubWorkspaceFile(undefined);
		const onWorkspaceProjectsChangedStub = sinon.stub();
		const onWorkspaceProjectsChangedDisposable = service.onDidWorkspaceProjectsChange(() => {
			onWorkspaceProjectsChangedStub();
		});
		const createWorkspaceStub = sinon.stub(azdata.workspace, 'createAndEnterWorkspace').resolves(undefined);

		await service.addProjectsToWorkspace([
			vscode.Uri.file('/test/folder/proj1.sqlproj')
		]);

		should.strictEqual(createWorkspaceStub.calledOnce, true, 'createAndEnterWorkspace should have been called once');
		should.strictEqual(onWorkspaceProjectsChangedStub.notCalled, true, 'the onDidWorkspaceProjectsChange event should not have been fired');
		onWorkspaceProjectsChangedDisposable.dispose();
	});

	test('test addProjectsToWorkspace when untitled workspace is open', async () => {
		stubWorkspaceFile(undefined);
		const onWorkspaceProjectsChangedStub = sinon.stub();
		const onWorkspaceProjectsChangedDisposable = service.onDidWorkspaceProjectsChange(() => {
			onWorkspaceProjectsChangedStub();
		});
		const saveWorkspaceStub = sinon.stub(azdata.workspace, 'saveAndEnterWorkspace').resolves(undefined);
		sinon.stub(utils, 'isCurrentWorkspaceUntitled').returns(true);
		sinon.stub(vscode.workspace, 'workspaceFolders').value(['folder1']);

		await service.addProjectsToWorkspace([
			vscode.Uri.file('/test/folder/proj1.sqlproj')
		]);

		should.strictEqual(saveWorkspaceStub.calledOnce, true, 'saveAndEnterWorkspace should have been called once');
		should.strictEqual(onWorkspaceProjectsChangedStub.notCalled, true, 'the onDidWorkspaceProjectsChange event should not have been fired');
		onWorkspaceProjectsChangedDisposable.dispose();
	});

	test('test loadTempProjects', async () => {
		const processPath = (original: string): string => {
			return original.replace(/\//g, path.sep);
		};
		stubWorkspaceFile('/test/folder/proj1.code-workspace');
		const updateConfigurationStub = sinon.stub();
		const getConfigurationStub = sinon.stub().returns([processPath('folder1/proj2.sqlproj')]);
		const onWorkspaceProjectsChangedStub = sinon.stub();
		const onWorkspaceProjectsChangedDisposable = service.onDidWorkspaceProjectsChange(() => {
			onWorkspaceProjectsChangedStub();
		});
		stubGetConfigurationValue(getConfigurationStub, updateConfigurationStub);
		sinon.stub(azdata.workspace, 'createAndEnterWorkspace').resolves(undefined);
		sinon.stub(vscode.workspace, 'workspaceFolders').value(['folder1']);
		mockGlobalState.setup(x => x.get(TypeMoq.It.isAny())).returns(() => [processPath('folder1/proj2.sqlproj')]);

		await service.loadTempProjects();

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

	test('test checkForProjectsNotAddedToWorkspace', async () => {
		const previousSetting = await vscode.workspace.getConfiguration(constants.projectsConfigurationKey)[constants.showNotAddedProjectsMessageKey];
		await vscode.workspace.getConfiguration(constants.projectsConfigurationKey).update(constants.showNotAddedProjectsMessageKey, true, true);

		sinon.stub(service, 'getProjectsInWorkspace').returns([vscode.Uri.file('abc.sqlproj'), vscode.Uri.file('folder1/abc1.sqlproj')]);
		sinon.stub(vscode.workspace, 'workspaceFolders').value([{uri: vscode.Uri.file('.')}]);
		sinon.stub(service, 'getAllProjectTypes').resolves([{
			projectFileExtension: 'sqlproj',
			id: 'sql project',
			displayName: 'sql project',
			description: '',
			icon: ''
		}]);
		const infoMessageStub = sinon.stub(vscode.window, 'showInformationMessage').resolves(<any>constants.DoNotShowAgain);
		const getProjectsInwWorkspaceFolderStub = sinon.stub(service, 'getAllProjectsInWorkspaceFolder').resolves([vscode.Uri.file('abc.sqlproj').fsPath, vscode.Uri.file('folder1/abc1.sqlproj').fsPath]);

		await service.checkForProjectsNotAddedToWorkspace();
		should(infoMessageStub.notCalled).be.true('Should not have found projects not added to workspace');

		// add a project to the workspace folder not added to the workspace yet
		getProjectsInwWorkspaceFolderStub.resolves([vscode.Uri.file('abc.sqlproj').fsPath, vscode.Uri.file('folder1/abc1.sqlproj').fsPath, vscode.Uri.file('folder2/abc2.sqlproj').fsPath]);
		await service.checkForProjectsNotAddedToWorkspace();
		should(infoMessageStub.calledOnce).be.true('Should have found a project that was not added to the workspace');

		await vscode.workspace.getConfiguration(constants.projectsConfigurationKey).update(constants.showNotAddedProjectsMessageKey, previousSetting, true);
	});
});
