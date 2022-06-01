/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import * as testUtils from '../../test/testContext';
import * as TypeMoq from 'typemoq';

import { PublishOptionsDialog } from '../../dialogs/publishOptionsDialog';
import { PublishDatabaseDialog } from '../../dialogs/publishDatabaseDialog';
import { Project } from '../../models/project';
import { ProjectsController } from '../../controllers/projectController';
import { createContext, mockDacFxOptionsResult, TestContext } from '../testContext';
import { emptySqlDatabaseProjectTypeId } from '../../common/constants';

let testContext: TestContext;

describe('Publish Database Options Dialog', () => {
	before(async function (): Promise<void> {
		testContext = createContext();
	});

	it('Should open dialog successfully ', async function (): Promise<void> {
		const publishDatabaseDialog = new PublishDatabaseDialog(new Project(''));
		const optionsDialog = new PublishOptionsDialog(testUtils.getDeploymentOptions(), publishDatabaseDialog);
		optionsDialog.openDialog();

		// Verify the dialog should exists
		should.notEqual(optionsDialog.dialog, undefined);
	});

	it('Should deployment options gets initialized correctly with sample test project', async function (): Promise<void>{
		// Create new sample test project
		const projController = new ProjectsController(testContext.outputChannel);
		const projFileDir = path.join(os.tmpdir(), `TestProject_${new Date().getTime()}`);
		const projFilePath = await projController.createNewProject({
			newProjName: 'TestProjectName',
			folderUri: vscode.Uri.file(projFileDir),
			projectTypeId: emptySqlDatabaseProjectTypeId,
			projectGuid: 'BA5EBA11-C0DE-5EA7-ACED-BABB1E70A575',
			sdkStyle: false
		});
		const project = new Project(projFilePath);

		const dialog = TypeMoq.Mock.ofType(PublishDatabaseDialog, undefined, undefined, project);
		dialog.setup(x => x.getDeploymentOptions()).returns(() => { return Promise.resolve(mockDacFxOptionsResult.deploymentOptions); });
		const options = dialog.object.getDeploymentOptions();

		const optionsDialog = new PublishOptionsDialog(await options,  new PublishDatabaseDialog(project));

		// Verify the options model should exists
		should.notEqual(optionsDialog.optionsModel, undefined);

		// Verify the deployment options should exists
		should.notEqual(optionsDialog.optionsModel.deploymentOptions, undefined);

		Object.entries(optionsDialog.optionsModel.deploymentOptions).forEach(option =>{
			// Validate the value and description as expected
			should.equal(option[1].value, false);
			should.equal(option[1].description, 'Sample Description text');
		});
	});
});
