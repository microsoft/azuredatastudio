/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as azdata from 'azdata';
import * as mssql from '../../../../mssql';
import * as sinon from 'sinon';
import { CreateProjectFromDatabaseDialog } from '../../dialogs/createProjectFromDatabaseDialog';
import { mockConnectionProfile } from '../testContext';
import { ImportDataModel } from '../../models/api/import';

describe('Create Project From Database Dialog', () => {
	afterEach(function (): void {
		sinon.restore();
	});

	it('Should open dialog successfully', async function (): Promise<void> {
		sinon.stub(azdata.connection, 'listDatabases').resolves([]);
		const dialog = new CreateProjectFromDatabaseDialog(mockConnectionProfile);
		await dialog.openDialog();
		should.notEqual(dialog.createProjectFromDatabaseTab, undefined);
	});

	it('Should enable ok button correctly with a connection profile', async function (): Promise<void> {
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
		sinon.stub(azdata.connection, 'listDatabases').resolves(['My Database']);
		const dialog = new CreateProjectFromDatabaseDialog(mockConnectionProfile);
		await dialog.openDialog();
		dialog.setProjectName();

		should.equal(dialog.projectNameTextBox!.value, 'DatabaseProjectMy Database');
	});

	it('Should include all info in import data model and connect to appropriate call back properties', async function (): Promise<void> {
		const stubUri = 'My URI';
		const dialog = new CreateProjectFromDatabaseDialog(mockConnectionProfile);
		sinon.stub(azdata.connection, 'listDatabases').resolves(['My Database']);
		sinon.stub(azdata.connection, 'getUriForConnection').resolves(stubUri);
		await dialog.openDialog();

		dialog.projectNameTextBox!.value = 'testProject';
		dialog.projectLocationTextBox!.value = 'testLocation';

		let model: ImportDataModel;

		const expectedImportDataModel: ImportDataModel  = {
			connectionUri: stubUri,
			database: 'My Database',
			projName: 'testProject',
			filePath: 'testLocation',
			version: '1.0.0.0',
			extractTarget: mssql.ExtractTarget.schemaObjectType
		};

		dialog.createProjectFromDatabaseCallback = (m) => { model = m; };
		await dialog.handleCreateButtonClick();

		should(model!).deepEqual(expectedImportDataModel);
	});
});
