/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';
import * as dataworkspace from 'dataworkspace';
import * as baselines from '../baselines/baselines';
import * as templates from '../../templates/templates';
import * as testUtils from '../testUtils';
import * as constants from '../../common/constants';
import { AddDatabaseReferenceDialog, ReferenceType } from '../../dialogs/addDatabaseReferenceDialog';

describe('Add Database Reference Dialog', () => {
	before(async function (): Promise<void> {
		await templates.loadTemplates(path.join(__dirname, '..', '..', '..', 'resources', 'templates'));
		await baselines.loadBaselines();
	});

	beforeEach(function (): void {
		const dataWorkspaceMock = TypeMoq.Mock.ofType<dataworkspace.IExtension>();
		dataWorkspaceMock.setup(x => x.getProjectsInWorkspace(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve([]));
		sinon.stub(vscode.extensions, 'getExtension').returns(<any>{ exports: dataWorkspaceMock.object });
	});

	afterEach(function (): void {
		sinon.restore();
	});

	it('Should open dialog successfully', async function (): Promise<void> {
		const project = await testUtils.createTestProject(baselines.newProjectFileBaseline);
		const dialog = new AddDatabaseReferenceDialog(project);
		await dialog.openDialog();
		should.notEqual(dialog.addDatabaseReferenceTab, undefined);
	});

	it('Should enable ok button correctly', async function (): Promise<void> {
		const project = await testUtils.createTestProject(baselines.newProjectFileBaseline);
		const dialog = new AddDatabaseReferenceDialog(project);
		await dialog.openDialog();

		should(dialog.dialog.okButton.enabled).equal(true, 'Ok button should be enabled since initial type of systemDb has default values filled');
		should(dialog.currentReferenceType).equal(ReferenceType.systemDb);

		// empty db name textbox
		dialog.databaseNameTextbox!.value = '';
		dialog.tryEnableAddReferenceButton();
		should(dialog.dialog.okButton.enabled).equal(false, 'Ok button should be disabled after clearing the database name textbox');

		// fill in db name and ok button should be enabled
		dialog.databaseNameTextbox!.value = 'master';
		dialog.tryEnableAddReferenceButton();
		should(dialog.dialog.okButton.enabled).equal(true, 'Ok button should be enabled after the database name textbox is filled');

		// change to dacpac reference
		dialog.dacpacRadioButtonClick();
		should(dialog.currentReferenceType).equal(ReferenceType.dacpac);
		should(dialog.locationDropdown?.value).equal(constants.differentDbSameServer);
		should(dialog.databaseNameTextbox!.value).equal('', 'database name text box should be empty because no dacpac has been selected');
		should(dialog.dialog.okButton.enabled).equal(false, 'Ok button should not be enabled because dacpac input box is not filled');

		// fill in dacpac textbox and database name text box
		dialog.dacpacTextbox!.value = 'testDb.dacpac';
		dialog.databaseNameTextbox!.value = 'testDb';
		dialog.tryEnableAddReferenceButton();
		should(dialog.dialog.okButton.enabled).equal(true, 'Ok button should be enabled after the dacpac textbox is filled');

		// change location to different database, different server
		dialog.locationDropdown!.value = constants.differentDbDifferentServer;
		dialog.updateEnabledInputBoxes();
		dialog.tryEnableAddReferenceButton();
		should(dialog.dialog.okButton.enabled).equal(true, 'Ok button should be enabled because server fields are filled');

		// change location to same database
		dialog.locationDropdown!.value = constants.sameDatabase;
		dialog.updateEnabledInputBoxes();
		dialog.tryEnableAddReferenceButton();
		should(dialog.dialog.okButton.enabled).equal(true, 'Ok button should be enabled because only dacpac location is needed for a reference located on the same database');

		// switch to project
		dialog.projectRadioButtonClick();
		should(dialog.dialog.okButton.enabled).equal(false, 'Ok button should not be enabled because there are no projects in the dropdown');

		// change reference type back to system db
		dialog.systemDbRadioButtonClick();
		should(dialog.locationDropdown?.value).equal(constants.differentDbSameServer);
		should(dialog.databaseNameTextbox?.value).equal('master', `Database name textbox should be set to master. Actual:${dialog.databaseNameTextbox?.value}`);
		should(dialog.dialog.okButton.enabled).equal(true, 'Ok button should be enabled because database name is filled');
	});

	it('Should enable and disable input boxes depending on the reference type', async function (): Promise<void> {
		const project = await testUtils.createTestProject(baselines.newProjectFileBaseline);
		const dialog = new AddDatabaseReferenceDialog(project);
		await dialog.openDialog();

		// dialog starts with system db because there aren't any other projects in the workspace
		should(dialog.currentReferenceType).equal(ReferenceType.systemDb);
		validateInputBoxEnabledStates(dialog, { databaseNameEnabled: true, databaseVariableEnabled: false, serverNameEnabled: false, serverVariabledEnabled: false});

		// change to dacpac reference
		dialog.dacpacRadioButtonClick();
		should(dialog.currentReferenceType).equal(ReferenceType.dacpac);
		should(dialog.locationDropdown!.value).equal(constants.differentDbSameServer);
		validateInputBoxEnabledStates(dialog, { databaseNameEnabled: true, databaseVariableEnabled: true, serverNameEnabled: false, serverVariabledEnabled: false});

		// change location to different db, different server
		dialog.locationDropdown!.value = constants.differentDbDifferentServer;
		dialog.updateEnabledInputBoxes();
		validateInputBoxEnabledStates(dialog, { databaseNameEnabled: true, databaseVariableEnabled: true, serverNameEnabled: true, serverVariabledEnabled: true});

		// change location to same db
		dialog.locationDropdown!.value = constants.sameDatabase;
		dialog.updateEnabledInputBoxes();
		validateInputBoxEnabledStates(dialog, { databaseNameEnabled: false, databaseVariableEnabled: false, serverNameEnabled: false, serverVariabledEnabled: false});

		// change to project reference
		dialog.projectRadioButtonClick();
		should(dialog.currentReferenceType).equal(ReferenceType.project);
		should(dialog.locationDropdown!.value).equal(constants.sameDatabase);
		validateInputBoxEnabledStates(dialog, { databaseNameEnabled: false, databaseVariableEnabled: false, serverNameEnabled: false, serverVariabledEnabled: false});
	});
});

interface inputBoxExpectedStates {
	databaseNameEnabled: boolean;
	databaseVariableEnabled: boolean;
	serverNameEnabled: boolean;
	serverVariabledEnabled: boolean;
}

function validateInputBoxEnabledStates(dialog: AddDatabaseReferenceDialog, expectedStates: inputBoxExpectedStates): void {
	should(dialog.databaseNameTextbox?.enabled).equal(expectedStates.databaseNameEnabled, `Database name text box should be ${expectedStates.databaseNameEnabled}. Actual: ${dialog.databaseNameTextbox?.enabled}`);
	should(dialog.databaseVariableTextbox?.enabled).equal(expectedStates.databaseVariableEnabled, `Database variable text box should be ${expectedStates.databaseVariableEnabled}. Actual: ${dialog.databaseVariableTextbox?.enabled}`);
	should(dialog.serverNameTextbox?.enabled).equal(expectedStates.serverNameEnabled,  `Server name text box should be ${expectedStates.serverNameEnabled}. Actual: ${dialog.serverNameTextbox?.enabled}`);
	should(dialog.serverVariableTextbox?.enabled).equal(expectedStates.serverVariabledEnabled, `Server variable text box should be ${expectedStates.serverVariabledEnabled}. Actual: ${dialog.serverVariableTextbox?.enabled}`);
}
