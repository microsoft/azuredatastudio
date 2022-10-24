/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as should from 'should';
import * as TypeMoq from 'typemoq';
import * as sinon from 'sinon';
import * as dataworkspace from 'dataworkspace';
import * as newProjectTool from '../tools/newProjectTool';
import { generateTestFolderPath, createTestFile, deleteGeneratedTestFolder } from './testUtils';

let previousSetting : string;
let testFolderPath : string;

describe('NewProjectTool: New project tool tests', function (): void {
	const projectConfigurationKey = 'projects';
	const projectSaveLocationKey= 'defaultProjectSaveLocation';

	beforeEach(async function () {
		previousSetting = await vscode.workspace.getConfiguration(projectConfigurationKey)[projectSaveLocationKey];
		testFolderPath = await generateTestFolderPath();
		// set the default project folder path to the test folder
		await vscode.workspace.getConfiguration(projectConfigurationKey).update(projectSaveLocationKey, testFolderPath, true);

		const dataWorkspaceMock = TypeMoq.Mock.ofType<dataworkspace.IExtension>();
		dataWorkspaceMock.setup(x => x.defaultProjectSaveLocation).returns(() => vscode.Uri.file(testFolderPath));
		sinon.stub(vscode.extensions, 'getExtension').returns(<any>{ exports: dataWorkspaceMock.object});
	});

	after(async function(): Promise<void> {
		await deleteGeneratedTestFolder();
	});

	afterEach(async function () {
		// reset the default project folder path to the previous setting
		await vscode.workspace.getConfiguration(projectConfigurationKey).update(projectSaveLocationKey, previousSetting, true);
		sinon.restore();
	});

	it('Should generate correct default project names', async function (): Promise<void> {
		should(newProjectTool.defaultProjectNameNewProj()).equal('DatabaseProject1');
		should(newProjectTool.defaultProjectNameFromDb('master')).equal('DatabaseProjectmaster');
	});

	it('Should auto-increment default project names for new projects', async function (): Promise<void> {
		should(newProjectTool.defaultProjectNameNewProj()).equal('DatabaseProject1');

		await createTestFile('', 'DatabaseProject1', testFolderPath);
		should(newProjectTool.defaultProjectNameNewProj()).equal('DatabaseProject2');

		await createTestFile('', 'DatabaseProject2', testFolderPath);
		should(newProjectTool.defaultProjectNameNewProj()).equal('DatabaseProject3');
	});

	it('Should auto-increment default project names for create project for database', async function (): Promise<void> {
		should(newProjectTool.defaultProjectNameFromDb('master')).equal('DatabaseProjectmaster');

		await createTestFile('', 'DatabaseProjectmaster', testFolderPath);
		should(newProjectTool.defaultProjectNameFromDb('master')).equal('DatabaseProjectmaster2');

		await createTestFile('', 'DatabaseProjectmaster2', testFolderPath);
		should(newProjectTool.defaultProjectNameFromDb('master')).equal('DatabaseProjectmaster3');
	});

	it('Should not return a project name if undefined is passed in ', async function (): Promise<void> {
		should(newProjectTool.defaultProjectNameFromDb(undefined)).equal('');
		should(newProjectTool.defaultProjectNameFromDb('')).equal('');
		should(newProjectTool.defaultProjectNameFromDb('test')).equal('DatabaseProjecttest');
	});
});
