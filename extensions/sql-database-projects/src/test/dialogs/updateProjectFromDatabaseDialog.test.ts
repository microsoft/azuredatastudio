/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as should from 'should';
import * as sinon from 'sinon';
import * as baselines from '../baselines/baselines';
import * as testUtils from '../testUtils';

import { UpdateProjectFromDatabaseDialog } from '../../dialogs/updateProjectFromDatabaseDialog';
import { mockConnectionProfile } from '../testContext';

describe('Update Project From Database Dialog', () => {
	before(async function (): Promise<void> {
		await baselines.loadBaselines();
	});

	afterEach(function (): void {
		sinon.restore();
	});

	after(async function(): Promise<void> {
		await testUtils.deleteGeneratedTestFolder();
	});

	it('Should populate endpoints correctly when no context passed', async function (): Promise<void> {
		const dialog = new UpdateProjectFromDatabaseDialog(undefined, undefined);
		await dialog.openDialog();

		should.equal(dialog.serverDropdown!.value, undefined, `Server dropdown should not be populated, but instead was "${dialog.serverDropdown!.value}".`);
		should.equal(dialog.databaseDropdown!.value, undefined, `Database dropdown should not be populated, but instead was "${dialog.databaseDropdown!.value}".`);
		should.equal(dialog.projectFileTextBox!.value, '', `Project file textbox should not be populated, but instead was "${dialog.projectFileTextBox!.value}".`);
		should.equal(dialog.dialog.okButton.enabled, false, 'Okay button should be disabled.');
	});

	it('Should populate endpoints correctly when Project context is passed', async function (): Promise<void> {
		const project = await testUtils.createTestProject(baselines.openProjectFileBaseline);
		const dialog = new UpdateProjectFromDatabaseDialog(undefined, project);
		await dialog.openDialog();

		should.equal(dialog.serverDropdown!.value, undefined, `Server dropdown should not be populated, but instead was "${dialog.serverDropdown!.value}".`);
		should.equal(dialog.databaseDropdown!.value, undefined, `Database dropdown should not be populated, but instead was "${dialog.databaseDropdown!.value}".`);
		should.equal(dialog.projectFileTextBox!.value, project.projectFilePath, `Project file textbox should be the sqlproj path (${project.projectFilePath}), but instead was "${dialog.projectFileTextBox!.value}".`);
		should.equal(dialog.dialog.okButton.enabled, false, 'Okay button should be disabled.');
	});

	it('Should populate endpoints correctly when Connection context is passed', async function (): Promise<void> {
		sinon.stub(azdata.connection, 'getConnections').resolves([<azdata.connection.ConnectionProfile><unknown>mockConnectionProfile]);
		sinon.stub(azdata.connection, 'listDatabases').resolves([mockConnectionProfile.databaseName!]);

		const profile = mockConnectionProfile;
		const dialog = new UpdateProjectFromDatabaseDialog(profile, undefined);
		await dialog.openDialog();
		await dialog.populatedInputsPromise;

		should.equal((<any>dialog.serverDropdown!.value).displayName, profile.options['connectionName'], `Server dropdown should be "${profile.options['connectionName']}", but instead was "${(<any>dialog.serverDropdown!.value).displayName}".`);
		should.equal(dialog.databaseDropdown!.value, profile.databaseName, `Database dropdown should be "${profile.databaseName}", but instead was "${dialog.databaseDropdown!.value}".`);
		should.equal(dialog.projectFileTextBox!.value, '', `Project file textbox should not be populated, but instead was "${dialog.projectFileTextBox!.value}".`);
		should.equal(dialog.dialog.okButton.enabled, false, 'Okay button should be disabled.');
	});

	it('Should populate endpoints correctly when context is complete', async function (): Promise<void> {
		const project = await testUtils.createTestProject(baselines.openProjectFileBaseline);
		sinon.stub(azdata.connection, 'getConnections').resolves([<azdata.connection.ConnectionProfile><unknown>mockConnectionProfile]);
		sinon.stub(azdata.connection, 'listDatabases').resolves([mockConnectionProfile.databaseName!]);

		const profile = mockConnectionProfile;
		const dialog = new UpdateProjectFromDatabaseDialog(profile, project);
		await dialog.openDialog();
		await dialog.populatedInputsPromise;

		should.equal((<any>dialog.serverDropdown!.value).displayName, profile.options['connectionName'], `Server dropdown should be "${profile.options['connectionName']}", but instead was "${(<any>dialog.serverDropdown!.value).displayName}".`);
		should.equal(dialog.databaseDropdown!.value, profile.databaseName, `Database dropdown should as "${profile.databaseName}", but instead was "${dialog.databaseDropdown!.value}".`);
		should.equal(dialog.projectFileTextBox!.value, project.projectFilePath, `Project file textbox should be the sqlproj path (${project.projectFilePath}), but instead was "${dialog.projectFileTextBox!.value}".`);
		should.equal(dialog.dialog.okButton.enabled, true, 'Okay button should be enabled when dialog is complete.');
	});
});
