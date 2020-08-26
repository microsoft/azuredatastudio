/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as should from 'should';
import * as newProjectTool from '../tools/newProjectTool';
import * as constants from '../common/constants';
import { generateTestFolderPath, createTestFile } from './testUtils';

describe.skip('NewProjectTool: New project tool tests', function (): void {

	it('Should generate correct default project names', async function (): Promise<void> {
		// save original setting
		const previousSetting = await vscode.workspace.getConfiguration(constants.dbProjectConfigurationKey)[constants.projectSaveLocationKey];
		const testFolderPath = await generateTestFolderPath();

		try {
			await vscode.workspace.getConfiguration(constants.dbProjectConfigurationKey).update(constants.projectSaveLocationKey, testFolderPath, true);
			should(newProjectTool.defaultProjectNameNewProj()).equal('DatabaseProject1');
			should(newProjectTool.defaultProjectNameFromDb('master')).equal('DatabaseProjectmaster');
		}
		finally {
			// reset configuration
			await vscode.workspace.getConfiguration(constants.dbProjectConfigurationKey).update(constants.projectSaveLocationKey, previousSetting, true);
		}
	});

	it('Should auto-increment default project names for new projects', async function (): Promise<void> {
		// save original setting
		const previousSetting = await vscode.workspace.getConfiguration(constants.dbProjectConfigurationKey)[constants.projectSaveLocationKey];
		const testFolderPath = await generateTestFolderPath();

		try {
			await vscode.workspace.getConfiguration(constants.dbProjectConfigurationKey).update(constants.projectSaveLocationKey, testFolderPath, true);
			should(newProjectTool.defaultProjectNameNewProj()).equal('DatabaseProject1');

			await createTestFile('', 'DatabaseProject1', testFolderPath);
			should(newProjectTool.defaultProjectNameNewProj()).equal('DatabaseProject2');

			await createTestFile('', 'DatabaseProject2', testFolderPath);
			should(newProjectTool.defaultProjectNameNewProj()).equal('DatabaseProject3');
		}
		finally {
			// reset configuration
			await vscode.workspace.getConfiguration(constants.dbProjectConfigurationKey).update(constants.projectSaveLocationKey, previousSetting, true);
		}
	});

	it('Should auto-increment default project names for import projects', async function (): Promise<void> {
		// save original setting
		const previousSetting = await vscode.workspace.getConfiguration(constants.dbProjectConfigurationKey)[constants.projectSaveLocationKey];
		const testFolderPath = await generateTestFolderPath();

		try {
			await vscode.workspace.getConfiguration(constants.dbProjectConfigurationKey).update(constants.projectSaveLocationKey, testFolderPath, true);
			should(newProjectTool.defaultProjectNameFromDb("master")).equal('DatabaseProjectmaster');

			await createTestFile('', 'DatabaseProjectmaster', testFolderPath);
			should(newProjectTool.defaultProjectNameFromDb("master")).equal('DatabaseProjectmaster2');

			await createTestFile('', 'DatabaseProjectmaster2', testFolderPath);
			should(newProjectTool.defaultProjectNameFromDb("master")).equal('DatabaseProjectmaster3');
		}
		finally {
			// reset configuration
			await vscode.workspace.getConfiguration(constants.dbProjectConfigurationKey).update(constants.projectSaveLocationKey, previousSetting, true);
		}
	});
});
