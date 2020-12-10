/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as TypeMoq from 'typemoq';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as constants from '../../common/constants';
import { promises as fs } from 'fs';
import { WorkspaceService } from '../../services/workspaceService';
import { OpenExistingDialog } from '../../dialogs/openExistingDialog';
import { createProjectFile, generateUniqueProjectFilePath, generateUniqueWorkspaceFilePath, testProjectType } from '../testUtils';

suite('Open Existing Dialog', function (): void {
	const mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();

	this.afterEach(() => {
		sinon.restore();
	});

	test('Should validate project file exists', async function (): Promise<void> {
		const workspaceServiceMock = TypeMoq.Mock.ofType<WorkspaceService>();
		const dialog = new OpenExistingDialog(workspaceServiceMock.object, mockExtensionContext.object);
		await dialog.open();

		dialog._targetTypeRadioCardGroup?.updateProperty( 'selectedCardId', constants.Project);
		dialog._projectFile = '';
		dialog.workspaceInputBox!.value = 'test.code-workspace';

		should.equal(await dialog.validate(), false, 'Validation fail because project file does not exist');

		// create a project file
		dialog._projectFile = await createProjectFile('testproj');
		should.equal(await dialog.validate(), true, 'Validation pass because project file exists');
	});

	test('Should validate workspace file exists', async function (): Promise<void> {
		const workspaceServiceMock = TypeMoq.Mock.ofType<WorkspaceService>();
		const dialog = new OpenExistingDialog(workspaceServiceMock.object, mockExtensionContext.object);
		await dialog.open();

		dialog._targetTypeRadioCardGroup?.updateProperty( 'selectedCardId', constants.Workspace);
		dialog._workspaceFile = '';
		should.equal(await dialog.validate(), false, 'Validation fail because workspace file does not exist');

		// create a workspace file
		dialog._workspaceFile = generateUniqueWorkspaceFilePath();
		await fs.writeFile(dialog._workspaceFile, '');
		should.equal(await dialog.validate(), true, 'Validation pass because workspace file exists');
	});

	test('Should validate new workspace location', async function (): Promise<void> {
		const workspaceServiceMock = TypeMoq.Mock.ofType<WorkspaceService>();
		workspaceServiceMock.setup(x => x.getAllProjectTypes()).returns(() => Promise.resolve([testProjectType]));

		const dialog = new OpenExistingDialog(workspaceServiceMock.object, mockExtensionContext.object);
		await dialog.open();

		dialog._projectFile = await createProjectFile('testproj');
		dialog.workspaceInputBox!.value = 'test';
		should.equal(await dialog.validate(), false, 'Validation should fail because workspace does not end in code-workspace');

		// use invalid folder
		dialog.workspaceInputBox!.value = 'invalidLocation/test.code-workspace';
		should.equal(await dialog.validate(), false, 'Validation should fail because the folder is invalid');

		// use already existing workspace
		const existingWorkspaceFilePath = path.join(os.tmpdir(), `test.code-workspace`);
		await fs.writeFile(existingWorkspaceFilePath, '');
		dialog.workspaceInputBox!.value = existingWorkspaceFilePath;
		should.equal(await dialog.validate(), false, 'Validation should fail because the selected workspace file already exists');

		// change workspace name to something that should pass
		dialog.workspaceInputBox!.value = path.join(os.tmpdir(), `TestWorkspace_${new Date().getTime()}.code-workspace`);
		should.equal(await dialog.validate(), true, 'Validation should pass because the parent directory exists, workspace filepath is unique, and the file extension is correct');
	});

	test('Should validate workspace in onComplete when opening project', async function (): Promise<void> {
		const workspaceServiceMock = TypeMoq.Mock.ofType<WorkspaceService>();
		workspaceServiceMock.setup(x => x.validateWorkspace()).returns(() => Promise.resolve(true));
		workspaceServiceMock.setup(x => x.addProjectsToWorkspace(TypeMoq.It.isAny())).returns(() => Promise.resolve());

		const dialog = new OpenExistingDialog(workspaceServiceMock.object, mockExtensionContext.object);
		await dialog.open();

		dialog._projectFile = generateUniqueProjectFilePath('testproj');
		should.doesNotThrow(async () => await dialog.onComplete());

		workspaceServiceMock.setup(x => x.validateWorkspace()).throws(new Error('test error'));
		const spy = sinon.spy(vscode.window, 'showErrorMessage');
		should.doesNotThrow(async () => await dialog.onComplete(), 'Error should be caught');
		should(spy.calledOnce).be.true();
	});

	test('workspace browse', async function (): Promise<void> {
		const workspaceServiceMock = TypeMoq.Mock.ofType<WorkspaceService>();
		sinon.stub(vscode.window, 'showOpenDialog').returns(Promise.resolve([]));

		const dialog = new OpenExistingDialog(workspaceServiceMock.object, mockExtensionContext.object);
		await dialog.open();
		should.equal(dialog._workspaceFile, '');
		await dialog.workspaceBrowse();
		should.equal(dialog._workspaceFile, '', 'Workspace file should not be set when no file is selected');

		sinon.restore();
		const workspaceFile = vscode.Uri.file(generateUniqueWorkspaceFilePath());
		sinon.stub(vscode.window, 'showOpenDialog').returns(Promise.resolve([workspaceFile]));
		await dialog.workspaceBrowse();
		should.equal(dialog._workspaceFile, workspaceFile.fsPath, 'Workspace file should get set');
		should.equal(dialog._filePathTextBox?.value, workspaceFile.fsPath);
	});

	test('project browse', async function (): Promise<void> {
		const workspaceServiceMock = TypeMoq.Mock.ofType<WorkspaceService>();
		workspaceServiceMock.setup(x => x.getAllProjectTypes()).returns(() => Promise.resolve([testProjectType]));
		sinon.stub(vscode.window, 'showOpenDialog').returns(Promise.resolve([]));

		const dialog = new OpenExistingDialog(workspaceServiceMock.object, mockExtensionContext.object);
		await dialog.open();
		should.equal(dialog._projectFile, '');
		await dialog.projectBrowse();
		should.equal(dialog._projectFile, '', 'Project file should not be set when no file is selected');

		sinon.restore();
		const projectFile = vscode.Uri.file(generateUniqueProjectFilePath('testproj'));
		sinon.stub(vscode.window, 'showOpenDialog').returns(Promise.resolve([projectFile]));
		await dialog.projectBrowse();
		should.equal(dialog._projectFile, projectFile.fsPath, 'Project file should be set');
		should.equal(dialog._filePathTextBox?.value, projectFile.fsPath);
	});
});

