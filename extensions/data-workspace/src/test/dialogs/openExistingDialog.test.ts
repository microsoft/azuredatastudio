/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as TypeMoq from 'typemoq';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as os from 'os';
import * as constants from '../../common/constants';
import * as utils from '../../common/utils';
import { WorkspaceService } from '../../services/workspaceService';
import { OpenExistingDialog } from '../../dialogs/openExistingDialog';
import { createProjectFile, generateUniqueProjectFilePath, testProjectType } from '../testUtils';

suite('Open Existing Dialog', function (): void {
	this.afterEach(() => {
		sinon.restore();
	});

	test('Should validate project file exists', async function (): Promise<void> {
		const workspaceServiceMock = TypeMoq.Mock.ofType<WorkspaceService>();
		const dialog = new OpenExistingDialog(workspaceServiceMock.object);
		await dialog.open();

		dialog.filePathTextBox!.value = 'nonExistentProjectFile';

		const validateResult = await dialog.validate();

		const msg = constants.FileNotExistError('project', 'nonExistentProjectFile');
		should.equal(dialog.dialogObject.message?.text, msg);
		should.equal(validateResult, false, 'Validation should fail because project file does not exist, but passed');

		// create a project file
		dialog.filePathTextBox!.value = await createProjectFile('testproj');
		should.equal(await dialog.validate(), true, `Validation should pass because project file exists, but failed with: ${dialog.dialogObject.message?.text}`);
	});


	test('Should validate workspace git clone location', async function (): Promise<void> {
		const workspaceServiceMock = TypeMoq.Mock.ofType<WorkspaceService>();
		const dialog = new OpenExistingDialog(workspaceServiceMock.object);
		await dialog.open();

		dialog.localRadioButton!.checked = false;
		dialog.remoteGitRepoRadioButton!.checked = true;
		dialog.localClonePathTextBox!.value = 'invalidLocation';
		const folderExistStub = sinon.stub(utils, 'directoryExist').resolves(false);

		const validateResult = await dialog.validate();
		const msg = constants.CloneParentDirectoryNotExistError(dialog.localClonePathTextBox!.value);
		should.equal(dialog.dialogObject.message?.text, msg, 'Dialog message should be correct');
		should.equal(validateResult, false, 'Validation should fail because clone directory does not exist, but passed');

		// validation should pass if directory exists
		dialog.localClonePathTextBox!.value = os.tmpdir();
		folderExistStub.resolves(true);
		should.equal(await dialog.validate(), true, `Validation should pass because clone directory exists, but failed with: ${dialog.dialogObject.message?.text}`);
	});

	test('project browse', async function (): Promise<void> {
		const workspaceServiceMock = TypeMoq.Mock.ofType<WorkspaceService>();
		workspaceServiceMock.setup(x => x.getAllProjectTypes()).returns(() => Promise.resolve([testProjectType]));
		const showOpenDialogStub = sinon.stub(vscode.window, 'showOpenDialog').returns(Promise.resolve([]));

		const dialog = new OpenExistingDialog(workspaceServiceMock.object);
		await dialog.open();
		should.equal(dialog.filePathTextBox!.value ?? '', '', 'Project file should initially be empty');
		await dialog.onBrowseButtonClick();
		should.equal(dialog.filePathTextBox!.value ?? '', '', 'Project file should not be set when no file is selected');

		showOpenDialogStub.restore();
		const projectFile = vscode.Uri.file(generateUniqueProjectFilePath('testproj'));
		sinon.stub(vscode.window, 'showOpenDialog').returns(Promise.resolve([projectFile]));
		await dialog.onBrowseButtonClick();
		should.equal(dialog.filePathTextBox!.value, projectFile.fsPath, 'Project file should be set');
	});
});

