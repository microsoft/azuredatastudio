/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as mssql from 'mssql';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as constants from '../../common/constants';
import * as utils from '../../common/utils'
import * as quickpickHelper from '../../dialogs/quickpickHelper'
import * as createProjectFromDatabaseQuickpick from '../../dialogs/createProjectFromDatabaseQuickpick';
import { createTestUtils, mockConnectionInfo, TestUtils } from './testUtils';
import { promises as fs } from 'fs';
import { ImportDataModel } from '../../models/api/import';
import { createTestFile, deleteGeneratedTestFolder, generateTestFolderPath } from '../testUtils';

let testUtils: TestUtils;
const projectFilePath = 'test';
const dbList: string[] = constants.systemDbs.concat(['OtherDatabase', 'Database', 'OtherDatabase2']);

describe('Create Project From Database Quickpick', () => {
	beforeEach(function (): void {
		testUtils = createTestUtils();
		sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);	//set vscode mssql extension api
	});

	afterEach(async function (): Promise<void> {
		sinon.restore();
		await deleteGeneratedTestFolder();
	});

	it('Should prompt for connection and exit when connection is not selected', async function (): Promise<void> {
		//promptForConnection spy to verify test
		const promptForConnectionSpy = sinon.stub(testUtils.vscodeMssqlIExtension.object, 'promptForConnection').withArgs(sinon.match.any).resolves(undefined);

		const model = await createProjectFromDatabaseQuickpick.createNewProjectFromDatabaseWithQuickpick();

		//verify that prompt for connection was called
		should(promptForConnectionSpy.calledOnce).be.true('promptForConnection should have been called');

		//verify quickpick exited with undefined, since promptForConnection was set to cancel (resolves to undefined)
		should.equal(model, undefined);
	});

	it('Should not prompt for connection when connectionInfo is provided and exit when db is not selected', async function (): Promise<void> {
		//promptForConnection spy to verify test
		const promptForConnectionSpy = sinon.stub(testUtils.vscodeMssqlIExtension.object, 'promptForConnection').withArgs(sinon.match.any).resolves(undefined);

		//user chooses connection
		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'connect').resolves('testConnectionURI');
		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'listDatabases').withArgs(sinon.match.any).resolves(dbList);
		// user chooses to cancel when prompted for database
		sinon.stub(vscode.window, 'showQuickPick').resolves(undefined);

		const model = await createProjectFromDatabaseQuickpick.createNewProjectFromDatabaseWithQuickpick(mockConnectionInfo);

		//verify connection prompt wasn't presented, since connectionInfo was passed during the call
		should(promptForConnectionSpy.notCalled).be.true('promptForConnection should not be called when connectionInfo is provided');

		//verify quickpick exited with undefined, since database wasn't selected (resolved to undefined)
		should.equal(model, undefined);
	});

	it('Should exit when project name is not selected', async function (): Promise<void> {
		//user chooses connection and database
		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'connect').resolves('testConnectionURI');
		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'listDatabases').withArgs(sinon.match.any).resolves(dbList);
		sinon.stub(vscode.window, 'showQuickPick').resolves('Database' as any);
		// user chooses to provide empty project name when prompted
		let inputBoxStub = sinon.stub(vscode.window, 'showInputBox').resolves('');
		// user chooses to cancel when prompted to enter project name
		inputBoxStub.onSecondCall().resolves(undefined);

		const model = await createProjectFromDatabaseQuickpick.createNewProjectFromDatabaseWithQuickpick(mockConnectionInfo);

		//verify showInputBox exited with undefined, since project name wasn't selected (resolved to undefined)
		should.equal(model, undefined);
	});

	it('Should exit when project location is not selected', async function (): Promise<void> {
		//user chooses connection and database
		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'connect').resolves('testConnectionURI');
		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'listDatabases').withArgs(sinon.match.any).resolves(dbList);
		let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves('Database' as any);
		//user chooses project name
		sinon.stub(vscode.window, 'showInputBox').resolves('TestProject');
		//user chooses to exit
		quickPickStub.onSecondCall().resolves(undefined);

		const model = await createProjectFromDatabaseQuickpick.createNewProjectFromDatabaseWithQuickpick(mockConnectionInfo);

		//verify showQuickPick exited with undefined, since project location wasn't selected (resolved to undefined)
		should.equal(model, undefined);
	});

	it('Should exit when project location is not selected (test repeatedness for project location)', async function (): Promise<void> {
		//user chooses connection and database
		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'connect').resolves('testConnectionURI');
		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'listDatabases').withArgs(sinon.match.any).resolves(dbList);
		let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves('Database' as any);
		//user chooses project name
		sinon.stub(vscode.window, 'showInputBox').resolves('TestProject');
		// user chooses to browse for folder
		quickPickStub.onSecondCall().resolves((constants.browseEllipsisWithIcon) as any);
		// user doesn't choose any folder when prompted and exits the showOpenDialog
		let openDialogStub = sinon.stub(vscode.window, 'showOpenDialog').withArgs(sinon.match.any).resolves(undefined);
		// user chooses to browse for folder
		quickPickStub.onThirdCall().resolves((constants.browseEllipsisWithIcon) as any);
		// user doesn't choose any folder when prompted and exits the showOpenDialog
		openDialogStub.onSecondCall().resolves(undefined);
		// user chooses to browse for folder
		quickPickStub.onCall(3).resolves((constants.browseEllipsisWithIcon) as any);
		// user doesn't choose any folder when prompted and exits the showOpenDialog
		openDialogStub.onSecondCall().resolves(undefined);
		//user chooses to exit
		quickPickStub.onCall(4).resolves(undefined);

		const model = await createProjectFromDatabaseQuickpick.createNewProjectFromDatabaseWithQuickpick(mockConnectionInfo);

		//verify showQuickPick exited with undefined, since project location wasn't selected (resolved to undefined)
		should.equal(model, undefined);
	});

	it('Should exit when folder structure is not selected and folder is selected through browsing (test repeatedness for project location)', async function (): Promise<void> {
		//user chooses connection and database
		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'connect').resolves('testConnectionURI');
		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'listDatabases').withArgs(sinon.match.any).resolves(dbList);
		let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves('Database' as any);
		//user chooses project name
		sinon.stub(vscode.window, 'showInputBox').resolves('TestProject');
		// user chooses to browse for folder
		quickPickStub.onSecondCall().resolves((constants.browseEllipsisWithIcon) as any);
		// user doesn't choose any folder when prompted and exits the showOpenDialog
		let openDialogStub = sinon.stub(vscode.window, 'showOpenDialog').withArgs(sinon.match.any).resolves(undefined);
		// user chooses to browse for folder again
		quickPickStub.onThirdCall().resolves((constants.browseEllipsisWithIcon) as any);
		// user chooses folder- stub out folder to be chosen (showOpenDialog)
		openDialogStub.onSecondCall().resolves([vscode.Uri.file(projectFilePath)]);
		//user chooses to exit when prompted for folder structure
		quickPickStub.onCall(3).resolves(undefined);

		const model = await createProjectFromDatabaseQuickpick.createNewProjectFromDatabaseWithQuickpick(mockConnectionInfo);

		//verify showQuickPick exited with undefined, since folder structure wasn't selected (resolved to undefined)
		should.equal(model, undefined);
	});

	it('Should exit when folder structure is not selected and existing folder/file location is selected', async function (): Promise<void> {
		//create folder and project file
		const projectFileName = 'TestProject';
		const testProjectFilePath = await generateTestFolderPath();
		await fs.rm(testProjectFilePath, { force: true, recursive: true });	//clean up if it already exists
		await createTestFile('', `${projectFileName}.sqlproj`, testProjectFilePath);

		//user chooses connection and database
		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'connect').resolves('testConnectionURI');
		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'listDatabases').withArgs(sinon.match.any).resolves(dbList);
		let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves('Database' as any);
		//user chooses project name
		sinon.stub(vscode.window, 'showInputBox').resolves(projectFileName);
		// user chooses a folder/file combination that already exists
		quickPickStub.onSecondCall().resolves(testProjectFilePath as any);
		//user chooses another folder when prompted again
		quickPickStub.onThirdCall().resolves(path.join(projectFilePath, 'test') as any);
		//user chooses to exit when prompted for folder structure
		quickPickStub.onCall(3).resolves(undefined);

		const model = await createProjectFromDatabaseQuickpick.createNewProjectFromDatabaseWithQuickpick(mockConnectionInfo);

		await deleteGeneratedTestFolder();

		//verify showQuickPick exited with undefined, since folder structure wasn't selected (resolved to undefined)
		should.equal(model, undefined);
	});

	it('Should exit when include permissions is not selected', async function (): Promise<void> {
		//user chooses connection and database
		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'connect').resolves('testConnectionURI');
		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'listDatabases').withArgs(sinon.match.any).resolves(dbList);
		let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves('Database' as any);
		//user chooses project name
		sinon.stub(vscode.window, 'showInputBox').resolves('TestProject');
		// user chooses a folder
		quickPickStub.onSecondCall().resolves(projectFilePath as any);
		//user chooses Object type when prompted for folder structure
		quickPickStub.onThirdCall().resolves(constants.objectType as any);
		//user chooses to exit when prompted for include permissions
		quickPickStub.onCall(3).resolves(undefined);

		const model = await createProjectFromDatabaseQuickpick.createNewProjectFromDatabaseWithQuickpick(mockConnectionInfo);

		//verify showQuickPick exited with undefined, since include permissions wasn't selected (resolved to undefined)
		should.equal(model, undefined);
	});

	it('Should exit when sdk style project is not selected', async function (): Promise<void> {
		//user chooses connection and database
		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'connect').resolves('testConnectionURI');
		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'listDatabases').withArgs(sinon.match.any).resolves(dbList);
		let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves('Database' as any);
		//user chooses project name
		sinon.stub(vscode.window, 'showInputBox').resolves('TestProject');
		// user chooses a folder
		quickPickStub.onSecondCall().resolves(projectFilePath as any);
		//user chooses Object type when prompted for folder structure
		quickPickStub.onThirdCall().resolves(constants.objectType as any);
		//user chooses No when prompted for include permissions
		quickPickStub.onCall(3).resolves(constants.noStringDefault as any);
		//user chooses to exit when prompted for sdk style project
		sinon.stub(quickpickHelper, 'getSDKStyleProjectInfo').resolves(undefined);

		const model = await createProjectFromDatabaseQuickpick.createNewProjectFromDatabaseWithQuickpick(mockConnectionInfo);

		//verify showQuickPick exited with undefined, since sdk style project wasn't selected (resolved to undefined)
		should.equal(model, undefined);
	});

	it('Should create correct import data model when all the information is provided', async function (): Promise<void> {
		//user chooses connection and database
		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'connect').resolves('testConnectionURI');
		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'listDatabases').withArgs(sinon.match.any).resolves(dbList);
		let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves('Database' as any);
		//user chooses project name
		sinon.stub(vscode.window, 'showInputBox').resolves('TestProject');
		// user chooses a folder
		quickPickStub.onSecondCall().resolves(projectFilePath as any);
		//user chooses Object type when prompted for folder structure
		quickPickStub.onThirdCall().resolves(constants.objectType as any);
		//user chooses No when prompted for include permissions
		quickPickStub.onCall(3).resolves(constants.noStringDefault as any);
		//user chooses sdk style project to be true
		sinon.stub(quickpickHelper, 'getSDKStyleProjectInfo').resolves(true);

		const model = await createProjectFromDatabaseQuickpick.createNewProjectFromDatabaseWithQuickpick(mockConnectionInfo);

		const expectedImportDataModel: ImportDataModel = {
			connectionUri: 'testConnectionURI',
			database: 'Database',
			projName: 'TestProject',
			filePath: projectFilePath,
			version: '1.0.0.0',
			extractTarget: mssql.ExtractTarget.objectType,
			sdkStyle: true,
			includePermissions: false
		};

		//verify the model is correctly generated
		should(model!).deepEqual(expectedImportDataModel);
	});
});
