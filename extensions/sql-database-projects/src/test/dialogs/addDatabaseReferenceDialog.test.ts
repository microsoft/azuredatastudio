/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
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

		should(dialog.dialog.okButton.enabled).equal(false);
		should(dialog.currentReferenceType).equal(ReferenceType.systemDb);
		dialog.tryEnableAddReferenceButton();
		should(dialog.dialog.okButton.enabled).equal(false);

		// fill in db name and ok button should be enabled
		dialog.databaseNameTextbox!.value = 'dbName';
		dialog.tryEnableAddReferenceButton();
		should(dialog.dialog.okButton.enabled).equal(true, 'Ok button should be enabled after the database name textbox is filled');

		// change to dacpac reference
		dialog.dacpacRadioButtonClick();
		should(dialog.currentReferenceType).equal(ReferenceType.dacpac);
		should(dialog.locationDropdown?.value).equal(constants.differentDbSameServer);
		should(dialog.dialog.okButton.enabled).equal(false, 'Ok button should not be enabled because dacpac input box is not filled');

		// fill in dacpac textbox
		dialog.dacpacTextbox!.value = 'testDb.dacpac';
		dialog.tryEnableAddReferenceButton();
		should(dialog.dialog.okButton.enabled).equal(true, 'Ok button should be enabled after the dacpac textbox is filled');

		// change location to different database, different server
		dialog.locationDropdown!.value = constants.differentDbDifferentServer;
		dialog.tryEnableAddReferenceButton();
		should(dialog.dialog.okButton.enabled).equal(false, 'Ok button should not be enabled because server fields are not filled');

		// fill in server fields
		dialog.serverNameTextbox!.value = 'serverName';
		dialog.serverVariableTextbox!.value = '$(serverName)';
		dialog.tryEnableAddReferenceButton();
		should(dialog.dialog.okButton.enabled).equal(true, 'Ok button should be enabled after server fields are filled');

		// change location to same database
		dialog.locationDropdown!.value = constants.sameDatabase;
		dialog.tryEnableAddReferenceButton();
		should(dialog.dialog.okButton.enabled).equal(true, 'Ok button should be enabled because only dacpac location is needed for a reference located on the same database');
	});

	it('Should enable and disable input boxes depending on the reference type', async function (): Promise<void> {
		const project = await testUtils.createTestProject(baselines.newProjectFileBaseline);
		const dialog = new AddDatabaseReferenceDialog(project);
		await dialog.openDialog();

		// dialog starts with system db
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
	});
});

interface inputBoxExpectedStates {
	databaseNameEnabled: boolean;
	databaseVariableEnabled: boolean;
	serverNameEnabled: boolean;
	serverVariabledEnabled: boolean;
}

function validateInputBoxEnabledStates(dialog: AddDatabaseReferenceDialog, expectedStates: inputBoxExpectedStates): void {
	should(dialog.databaseNameTextbox?.enabled).equal(expectedStates.databaseNameEnabled);
	should(dialog.databaseVariableTextbox?.enabled).equal(expectedStates.databaseVariableEnabled);
	should(dialog.serverNameTextbox?.enabled).equal(expectedStates.serverNameEnabled);
	should(dialog.serverVariableTextbox?.enabled).equal(expectedStates.serverVariabledEnabled);
}
