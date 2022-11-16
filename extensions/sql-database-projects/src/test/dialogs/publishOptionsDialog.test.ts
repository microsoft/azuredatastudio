/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as testUtils from '../testUtils';
import * as testData from '../testContext';
import * as baselines from '../baselines/baselines';
import * as TypeMoq from 'typemoq';

import { PublishOptionsDialog } from '../../dialogs/publishOptionsDialog';
import { PublishDatabaseDialog } from '../../dialogs/publishDatabaseDialog';
import { Project } from '../../models/project';
import sinon = require('sinon');

describe('Publish Database Options Dialog', () => {
	before(async function (): Promise<void> {
		await baselines.loadBaselines();
	});

	after(async function(): Promise<void> {
		await testUtils.deleteGeneratedTestFolder();
	});

	it('Should open dialog successfully ', async function (): Promise<void> {
		const proj = new Project('');
		sinon.stub(proj, 'getProjectTargetVersion').returns('150');
		const publishDatabaseDialog = new PublishDatabaseDialog(new Project(''));
		const optionsDialog = new PublishOptionsDialog(testData.getDeploymentOptions(), publishDatabaseDialog);
		optionsDialog.openDialog();

		// Verify the dialog should exists
		should.notEqual(optionsDialog.dialog, undefined);
	});

	it('Should deployment options gets initialized correctly with sample test project', async function (): Promise<void> {
		// Create new sample test project
		const project = await testUtils.createTestProject(baselines.openProjectFileBaseline);
		const dialog = TypeMoq.Mock.ofType(PublishDatabaseDialog, undefined, undefined, project);

		dialog.setup(x => x.getDeploymentOptions()).returns(() => { return Promise.resolve(testData.mockDacFxOptionsResult.deploymentOptions); });

		const options = await dialog.object.getDeploymentOptions();
		const optionsDialog = new PublishOptionsDialog(options, new PublishDatabaseDialog(project));

		// Verify the options model should exists
		should.notEqual(optionsDialog.optionsModel, undefined);

		// Verify the deployment options should exists
		should.notEqual(optionsDialog.optionsModel.deploymentOptions, undefined);

		Object.entries(optionsDialog.optionsModel.deploymentOptions.booleanOptionsDictionary).forEach(option => {
			// Validate the value and description as expected
			should.equal(option[1].value, false);
			should.equal(option[1].description, 'Sample Description text');
		});
	});
});
