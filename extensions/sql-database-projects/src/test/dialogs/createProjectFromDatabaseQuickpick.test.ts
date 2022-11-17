/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as constants from '../../common/constants';
import * as utils from '../../common/utils'
import { createTestUtils, mockConnectionInfo, TestUtils, MockQuickPick, createQuickPickContext } from './testUtils';
import * as createProjectFromDatabaseQuickpick from '../../dialogs/createProjectFromDatabaseQuickpick';
import { promises as fs } from 'fs';

let testUtils: TestUtils;
const projectFilePath = 'test';

//const projectFilePath: string = path.join(rootFolderPath, 'test.csproj');

describe('Create Project From Database Quickpick', () => {
	beforeEach(function (): void {
		testUtils = createTestUtils();
	});

	afterEach(function (): void {
		sinon.restore();
	});

	it('Should prompt for connection and exit when connection is not selected', async function (): Promise<void> {
		sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);	//set vscode mssql extension api

		//promptForConnection spy to verify test
		const promptForConnectionSpy = sinon.stub(testUtils.vscodeMssqlIExtension.object, 'promptForConnection').withArgs(sinon.match.any).resolves(undefined);

		const model = await createProjectFromDatabaseQuickpick.createNewProjectFromDatabaseWithQuickpick();

		//verify that prompt for connection was called
		should(promptForConnectionSpy.calledOnce).be.true('promptForConnection should have been called');

		//verify quickpick exited with undefined, since promptForConnection was set to cancel (resolves to undefined)
		should.equal(model, undefined);
	});

	it('Should not prompt for connection when connectionInfo is provided and exit when db is not selected', async function (): Promise<void> {
		sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);	//set vscode mssql extension api

		//promptForConnection spy to verify test
		const promptForConnectionSpy = sinon.stub(testUtils.vscodeMssqlIExtension.object, 'promptForConnection').withArgs(sinon.match.any).resolves(undefined);

		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'connect').resolves('testConnectionURI');
		let dbList: string[] = constants.systemDbs;
		dbList.push('OtherDatabase');
		dbList.push('Database');
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
		sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);	//set vscode mssql extension api

		let dbList: string[] = constants.systemDbs;
		dbList.push('OtherDatabase');
		dbList.push('Database');
		dbList.push('OtherDatabase2');

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
		sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);	//set vscode mssql extension api

		let dbList: string[] = constants.systemDbs;
		dbList.push('OtherDatabase');
		dbList.push('Database');
		dbList.push('OtherDatabase2');

		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'connect').resolves('testConnectionURI');
		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'listDatabases').withArgs(sinon.match.any).resolves(dbList);
		let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves('Database' as any);
		sinon.stub(vscode.window, 'showInputBox').resolves('TestProject');
		//user chooses to exit
		quickPickStub.onSecondCall().resolves(undefined);

		const model = await createProjectFromDatabaseQuickpick.createNewProjectFromDatabaseWithQuickpick(mockConnectionInfo);

		//verify showQuickPick exited with undefined, since project location wasn't selected (resolved to undefined)
		should.equal(model, undefined);
	});

	it('Should exit when project location is not selected (test repeatedness for project location)', async function (): Promise<void> {
		sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);	//set vscode mssql extension api

		let dbList: string[] = constants.systemDbs;
		dbList.push('OtherDatabase');
		dbList.push('Database');
		dbList.push('OtherDatabase2');

		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'connect').resolves('testConnectionURI');
		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'listDatabases').withArgs(sinon.match.any).resolves(dbList);
		let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves('Database' as any);
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
		sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);	//set vscode mssql extension api

		let dbList: string[] = constants.systemDbs;
		dbList.push('OtherDatabase');
		dbList.push('Database');
		dbList.push('OtherDatabase2');

		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'connect').resolves('testConnectionURI');
		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'listDatabases').withArgs(sinon.match.any).resolves(dbList);
		let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves('Database' as any);
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
		sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);	//set vscode mssql extension api

		//create folder and project file
		const projectFileName = 'TestProject';
		const testProjectFilePath = 'TestProjectPath'
		await fs.rm(testProjectFilePath, { force: true, recursive: true });	//clean up if it already exists
		await fs.mkdir(testProjectFilePath);
		let filePath = path.join(testProjectFilePath, projectFileName);
		await fs.writeFile(filePath, '');

		let dbList: string[] = constants.systemDbs;
		dbList.push('OtherDatabase');
		dbList.push('Database');
		dbList.push('OtherDatabase2');

		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'connect').resolves('testConnectionURI');
		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'listDatabases').withArgs(sinon.match.any).resolves(dbList);
		let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves('Database' as any);
		sinon.stub(vscode.window, 'showInputBox').resolves(projectFileName);
		// user chooses a folder/file combination that already exists
		quickPickStub.onSecondCall().resolves(testProjectFilePath as any);
		//user chooses another folder when prompted again
		quickPickStub.onThirdCall().resolves(path.join(projectFilePath, 'test') as any);
		//user chooses to exit when prompted for folder structure
		quickPickStub.onCall(3).resolves(undefined);

		const model = await createProjectFromDatabaseQuickpick.createNewProjectFromDatabaseWithQuickpick(mockConnectionInfo);

		await fs.rm(testProjectFilePath, { recursive: true });

		//verify showQuickPick exited with undefined, since folder structure wasn't selected (resolved to undefined)
		should.equal(model, undefined);
	});

	it('Should exit when include permissions is not selected', async function (): Promise<void> {
		sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);	//set vscode mssql extension api

		let dbList: string[] = constants.systemDbs;
		dbList.push('OtherDatabase');
		dbList.push('Database');
		dbList.push('OtherDatabase2');

		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'connect').resolves('testConnectionURI');
		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'listDatabases').withArgs(sinon.match.any).resolves(dbList);
		let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves('Database' as any);
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
		sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);	//set vscode mssql extension api

		let dbList: string[] = [];//
		dbList.push('OtherDatabase');
		dbList.push('Database');
		dbList.push('OtherDatabase2');
		dbList = dbList.concat(constants.systemDbs);
		console.log('dbList', dbList);

		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'connect').resolves('testConnectionURI');
		sinon.stub(testUtils.vscodeMssqlIExtension.object, 'listDatabases').resolves(dbList);
		//sinon.stub(testUtils.vscodeMssqlIExtension.object, 'listDatabases').withArgs(sinon.match.any).resolves(dbList);
		let quickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves('Database' as any);
		sinon.stub(vscode.window, 'showInputBox').resolves('TestProject');
		// user chooses a folder
		quickPickStub.onSecondCall().resolves(projectFilePath as any);
		//user chooses Object type when prompted for folder structure
		quickPickStub.onThirdCall().resolves(constants.objectType as any);
		//user chooses No when prompted for include permissions
		quickPickStub.onCall(3).resolves(constants.noStringDefault as any);
		//user chooses to exit when prompted for sdk style project
		//sinon.stub(vscode.window, 'createQuickPick').resolves(testUtils.quickPick.object);
		//sinon.stub(testUtils.quickPick.object, 'connect').resolves(undefined);
		//testUtils.quickPick.object.onDidHide();
		//const quickPickContext = createQuickPickContext();
		//quickPickContext.onDidHide.fire(undefined);
		//sinon.stub(createNewProjectFromDatabaseWithQuickpick, 'getSDKStyleProjectInfo').resolves(undefined);
		//sinon.stub(createProjectFromDatabaseQuickpick, 'getSDKStyleProjectInfo').resolves(<any>Promise.resolve(undefined));//resolves(undefined);
		sinon.stub(createProjectFromDatabaseQuickpick, 'getSDKStyleProjectInfo').returns(Promise.resolve(undefined));//resolves(undefined);
		//sinon.stub(vscode.window, 'showQuickPick').resolves(Promise.resolve(loc.msgYes) as any);

		const model = await createProjectFromDatabaseQuickpick.createNewProjectFromDatabaseWithQuickpick(mockConnectionInfo);

		//verify showQuickPick exited with undefined, since sdk style project wasn't selected (resolved to undefined)
		should.equal(model, undefined);
	});




	/*it('Should select connection from profile', async function (): Promise<void> {
		sinon.stub(utils, 'getVscodeMssqlApi').resolves(testUtils.vscodeMssqlIExtension.object);
		let connectionInfo: IConnectionInfo = createTestCredentials();// create test connectionInfo

		sinon.stub(azdata.connection, 'getConnections').resolves([]);
		sinon.stub(azdata.connection, 'connect').resolves({ connected: true, connectionId: '0', errorMessage: '', errorCode: 0 });
		sinon.stub(azdata.connection, 'listDatabases').resolves([]);
		const dialog = new CreateProjectFromDatabaseDialog(mockConnectionProfile);
		await dialog.openDialog();
		should.notEqual(dialog.createProjectFromDatabaseTab, undefined);
	});
	it('Should enable ok button correctly with a connection profile', async function (): Promise<void> {
		sinon.stub(azdata.connection, 'getConnections').resolves([]);
		sinon.stub(azdata.connection, 'connect').resolves({ connected: true, connectionId: '0', errorMessage: '', errorCode: 0 });
		sinon.stub(azdata.connection, 'listDatabases').resolves([]);
		const dialog = new CreateProjectFromDatabaseDialog(mockConnectionProfile);
		await dialog.openDialog();		// should set connection details

		should(dialog.dialog.okButton.enabled).equal(false);

		// fill in project name and ok button should not be enabled
		dialog.projectNameTextBox!.value = 'testProject';
		dialog.tryEnableCreateButton();
		should(dialog.dialog.okButton.enabled).equal(false, 'Ok button should not be enabled because project location is not filled');

		// fill in project location and ok button should be enabled
		dialog.projectLocationTextBox!.value = 'testLocation';
		dialog.tryEnableCreateButton();
		should(dialog.dialog.okButton.enabled).equal(true, 'Ok button should be enabled since all the required fields are filled');
	});

	it('Should enable ok button correctly without a connection profile', async function (): Promise<void> {
		const dialog = new CreateProjectFromDatabaseDialog(undefined);
		await dialog.openDialog();

		should(dialog.dialog.okButton.enabled).equal(false, 'Ok button should not be enabled because all the required details are not filled');

		// fill in project name and ok button should not be enabled
		dialog.projectNameTextBox!.value = 'testProject';
		dialog.tryEnableCreateButton();
		should(dialog.dialog.okButton.enabled).equal(false, 'Ok button should not be enabled because source database details and project location are not filled');

		// fill in project location and ok button not should be enabled
		dialog.projectLocationTextBox!.value = 'testLocation';
		dialog.tryEnableCreateButton();
		should(dialog.dialog.okButton.enabled).equal(false, 'Ok button should not be enabled because source database details are not filled');

		// fill in server name and ok button not should be enabled
		dialog.sourceConnectionTextBox!.value = 'testServer';
		dialog.tryEnableCreateButton();
		should(dialog.dialog.okButton.enabled).equal(false, 'Ok button should not be enabled because source database is not filled');

		// fill in database name and ok button should be enabled
		dialog.sourceDatabaseDropDown!.value = 'testDatabase';
		dialog.tryEnableCreateButton();
		should(dialog.dialog.okButton.enabled).equal(true, 'Ok button should be enabled since all the required fields are filled');

		// update folder structure information and ok button should still be enabled
		dialog.folderStructureDropDown!.value = 'Object Type';
		dialog.tryEnableCreateButton();
		should(dialog.dialog.okButton.enabled).equal(true, 'Ok button should be enabled since all the required fields are filled');
	});

	it('Should create default project name correctly when database information is populated', async function (): Promise<void> {
		sinon.stub(azdata.connection, 'getConnections').resolves([]);
		sinon.stub(azdata.connection, 'connect').resolves({ connected: true, connectionId: '0', errorMessage: '', errorCode: 0 });
		sinon.stub(azdata.connection, 'listDatabases').resolves(['My Database']);
		const dialog = new CreateProjectFromDatabaseDialog(mockConnectionProfile);
		await dialog.openDialog();
		dialog.setProjectName();

		should.equal(dialog.projectNameTextBox!.value, 'DatabaseProjectMy Database');
	});

	it('Should include all info in import data model and connect to appropriate call back properties', async function (): Promise<void> {
		const stubUri = 'My URI';
		const dialog = new CreateProjectFromDatabaseDialog(mockConnectionProfile);
		sinon.stub(azdata.connection, 'getConnections').resolves([]);
		sinon.stub(azdata.connection, 'connect').resolves({ connected: true, connectionId: '0', errorMessage: '', errorCode: 0 });
		sinon.stub(azdata.connection, 'listDatabases').resolves(['My Database']);
		sinon.stub(azdata.connection, 'getUriForConnection').resolves(stubUri);
		await dialog.openDialog();

		dialog.projectNameTextBox!.value = 'testProject';
		dialog.projectLocationTextBox!.value = 'testLocation';

		let model: ImportDataModel;

		const expectedImportDataModel: ImportDataModel = {
			connectionUri: stubUri,
			database: 'My Database',
			projName: 'testProject',
			filePath: 'testLocation',
			version: '1.0.0.0',
			extractTarget: mssql.ExtractTarget.schemaObjectType,
			sdkStyle: true,
			includePermissions: undefined
		};

		dialog.createProjectFromDatabaseCallback = (m) => { model = m; };
		await dialog.handleCreateButtonClick();

		should(model!).deepEqual(expectedImportDataModel);
	});*/
});
