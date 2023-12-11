/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as should from 'should';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as mssql from 'mssql';
import * as baselines from '../baselines/baselines';
import * as testUtils from '../testUtils';

import { UpdateProjectFromDatabaseDialog } from '../../dialogs/updateProjectFromDatabaseDialog';
import { mockConnectionProfile, mockDatabaseEndpointInfo, mockProjectEndpointInfo, mockURIList } from '../testContext';
import { UpdateProjectDataModel } from '../../models/api/updateProject';

describe('Update Project From Database Dialog', () => {
	before(async function (): Promise<void> {
		await baselines.loadBaselines();
	});

	afterEach(function (): void {
		sinon.restore();
	});

	after(async function (): Promise<void> {
		await testUtils.deleteGeneratedTestFolder();
	});

	it('Should populate endpoints correctly when no context passed', async function (): Promise<void> {
		const dialog = new UpdateProjectFromDatabaseDialog(undefined, undefined, []);
		await dialog.openDialog();

		should.equal(dialog.serverDropdown!.value, undefined, `Server dropdown should not be populated, but instead was "${dialog.serverDropdown!.value}".`);
		should.equal(dialog.databaseDropdown!.value, undefined, `Database dropdown should not be populated, but instead was "${dialog.databaseDropdown!.value}".`);
		should.equal(dialog.projectFileDropdown!.value, '', `Project file dropdown should not be populated, but instead was "${dialog.projectFileDropdown!.value}".`);
		should.equal(dialog.dialog.okButton.enabled, false, 'Okay button should be disabled.');
	});

	it('Should populate endpoints correctly when Project context is passed', async function (): Promise<void> {
		const project = await testUtils.createTestProject(this.test, baselines.openProjectFileBaseline);
		const dialog = new UpdateProjectFromDatabaseDialog(undefined, project, mockURIList);
		await dialog.openDialog();

		should.equal(dialog.serverDropdown!.value, undefined, `Server dropdown should not be populated, but instead was "${dialog.serverDropdown!.value}".`);
		should.equal(dialog.databaseDropdown!.value, undefined, `Database dropdown should not be populated, but instead was "${dialog.databaseDropdown!.value}".`);
		should.equal(dialog.projectFileDropdown!.value, project.projectFilePath, `Project file dropdown should be the sqlproj path (${project.projectFilePath}), but instead was "${dialog.projectFileDropdown!.value}".`);
		should.equal(dialog.dialog.okButton.enabled, false, 'Okay button should be disabled.');
	});

	it('Should populate endpoints correctly when Connection context is passed', async function (): Promise<void> {
		sinon.stub(azdata.connection, 'getConnections').resolves([<azdata.connection.ConnectionProfile><unknown>mockConnectionProfile]);
		sinon.stub(azdata.connection, 'listDatabases').resolves([mockConnectionProfile.databaseName!]);

		const profile = mockConnectionProfile;
		const dialog = new UpdateProjectFromDatabaseDialog(profile, undefined, []);
		await dialog.openDialog();
		await dialog.populatedInputsPromise;

		should.equal((<any>dialog.serverDropdown!.value).displayName, profile.options['connectionName'], `Server dropdown should be "${profile.options['connectionName']}", but instead was "${(<any>dialog.serverDropdown!.value).displayName}".`);
		should.equal(dialog.databaseDropdown!.value, profile.databaseName, `Database dropdown should be "${profile.databaseName}", but instead was "${dialog.databaseDropdown!.value}".`);
		should.equal(dialog.projectFileDropdown!.value, '', `Project file dropdown should not be populated, but instead was "${dialog.projectFileDropdown!.value}".`);
		should.equal(dialog.dialog.okButton.enabled, false, 'Okay button should be disabled.');
	});

	it('Should populate endpoints correctly when context is complete', async function (): Promise<void> {
		const project = await testUtils.createTestProject(this.test, baselines.openProjectFileBaseline);
		sinon.stub(azdata.connection, 'getConnections').resolves([<azdata.connection.ConnectionProfile><unknown>mockConnectionProfile]);
		sinon.stub(azdata.connection, 'listDatabases').resolves([mockConnectionProfile.databaseName!]);

		const profile = mockConnectionProfile;
		const dialog = new UpdateProjectFromDatabaseDialog(profile, project, mockURIList);
		await dialog.openDialog();
		await dialog.populatedInputsPromise;

		let uriList: string[] = [];
		mockURIList.forEach(projectUri => {
			uriList.push(projectUri.fsPath as string);
		});

		should.equal((<any>dialog.serverDropdown!.value).displayName, profile.options['connectionName'], `Server dropdown should be "${profile.options['connectionName']}", but instead was "${(<any>dialog.serverDropdown!.value).displayName}".`);
		should.equal(dialog.databaseDropdown!.value, profile.databaseName, `Database dropdown should as "${profile.databaseName}", but instead was "${dialog.databaseDropdown!.value}".`);
		should.equal(dialog.projectFileDropdown!.value, project.projectFilePath, `Project file dropdown should be the sqlproj path (${project.projectFilePath}), but instead was "${dialog.projectFileDropdown!.value}".`);
		should.deepEqual(dialog.projectFileDropdown!.values, uriList, `Project file dropdown list should be the sqlproj path (${mockURIList}), but instead was "${dialog.projectFileDropdown!.values}".`);
		should.equal(dialog.dialog.okButton.enabled, true, 'Okay button should be enabled when dialog is complete.');
	});

	it('Should populate endpoints correctly when Connection context and workspace with projects is provided', async function (): Promise<void> {
		sinon.stub(azdata.connection, 'getConnections').resolves([<azdata.connection.ConnectionProfile><unknown>mockConnectionProfile]);
		sinon.stub(azdata.connection, 'listDatabases').resolves([mockConnectionProfile.databaseName!]);

		const profile = mockConnectionProfile;
		const dialog = new UpdateProjectFromDatabaseDialog(profile, undefined, mockURIList);
		await dialog.openDialog();
		await dialog.populatedInputsPromise;

		let uriList: string[] = [];
		mockURIList.forEach(projectUri => {
			uriList.push(projectUri.fsPath as string);
		});

		should.equal((<any>dialog.serverDropdown!.value).displayName, profile.options['connectionName'], `Server dropdown should be "${profile.options['connectionName']}", but instead was "${(<any>dialog.serverDropdown!.value).displayName}".`);
		should.equal(dialog.databaseDropdown!.value, profile.databaseName, `Database dropdown should be "${profile.databaseName}", but instead was "${dialog.databaseDropdown!.value}".`);
		should.equal(dialog.projectFileDropdown!.value, uriList[0], `Project file dropdown should be the first project listed in the workspace URI list (${uriList[0]}), but instead was "${dialog.projectFileDropdown!.value}".`);
		should.deepEqual(dialog.projectFileDropdown!.values, uriList, `Project file dropdown list should be the workspace URI list (${mockURIList}), but instead was "${dialog.projectFileDropdown!.values}".`);
		should.equal(dialog.dialog.okButton.enabled, true, 'Okay button should be enabled when dialog is complete.');
	});

	it('Should successfully complete the handleUpdateButtonClick method call and connect to appropriate call back properties when Connection context and workspace with projects is provided', async function (): Promise<void> {
		const project = await testUtils.createTestProject(this.test, baselines.openProjectFileBaseline);
		sinon.stub(azdata.connection, 'getConnections').resolves([<azdata.connection.ConnectionProfile><unknown>mockConnectionProfile]);
		sinon.stub(azdata.connection, 'listDatabases').resolves([mockConnectionProfile.databaseName!]);
		sinon.stub(azdata.connection, 'getUriForConnection').resolves('MockUri');
		sinon.stub(azdata.connection, 'getCredentials').resolves({ ['credentials']: 'credentials' });

		const projectFilePath = project.projectFilePath.toLowerCase();
		const profile = mockConnectionProfile;
		mockURIList.unshift(vscode.Uri.file(projectFilePath));
		const dialog = new UpdateProjectFromDatabaseDialog(profile, undefined, mockURIList);
		await dialog.openDialog();
		await dialog.populatedInputsPromise;

		let uriList: string[] = [];
		mockURIList.forEach(projectUri => {
			uriList.push(projectUri.fsPath as string);
		});

		// verify the handleUpdateButtonClick method goes through successfully
		let model: UpdateProjectDataModel;
		const testProjectEndpointInfo: mssql.SchemaCompareEndpointInfo = { ...mockProjectEndpointInfo };
		testProjectEndpointInfo.projectFilePath = projectFilePath;
		const expectedUpdateProjectDataModel: UpdateProjectDataModel = {
			sourceEndpointInfo: mockDatabaseEndpointInfo,
			targetEndpointInfo: testProjectEndpointInfo,
			action: 0
		};
		dialog.updateProjectFromDatabaseCallback = (m) => { model = m; };
		await dialog.handleUpdateButtonClick();

		should(model!).deepEqual(expectedUpdateProjectDataModel);
	});
});
