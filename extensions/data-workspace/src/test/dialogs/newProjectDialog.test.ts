/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as TypeMoq from 'typemoq';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import { promises as fs } from 'fs';
import { NewProjectDialog } from '../../dialogs/newProjectDialog';
import { WorkspaceService } from '../../services/workspaceService';
import { testProjectType } from '../testUtils';
import { IProjectType } from 'dataworkspace';

suite('New Project Dialog', function (): void {
	this.afterEach(() => {
		sinon.restore();
	});

	test('Should validate project location', async function (): Promise<void> {
		const workspaceServiceMock = TypeMoq.Mock.ofType<WorkspaceService>();
		workspaceServiceMock.setup(x => x.getAllProjectTypes()).returns(() => Promise.resolve([testProjectType]));

		const dialog = new NewProjectDialog(workspaceServiceMock.object);
		await dialog.open();

		dialog.model.name = 'TestProject';
		dialog.model.location = '';
		should.equal(await dialog.validate(), false, 'Validation should fail because the parent directory does not exist');

		// create a folder with the same name
		const folderPath = path.join(os.tmpdir(), dialog.model.name);
		await fs.mkdir(folderPath, { recursive: true });
		dialog.model.location = os.tmpdir();
		should.equal(await dialog.validate(), false, 'Validation should fail because a folder with the same name exists');

		// change project name to be unique
		dialog.model.name = `TestProject_${new Date().getTime()}`;
		should.equal(await dialog.validate(), true, 'Validation should pass because name is unique and parent directory exists');
	});

	test('Should select correct target platform if provided default', async function (): Promise<void> {
		const projectTypeWithTargetPlatforms: IProjectType = {
			id: 'tp2',
			description: '',
			projectFileExtension: 'testproj2',
			icon: '',
			displayName: 'test project 2',
			targetPlatforms: ['platform1', 'platform2', 'platform3'],
			defaultTargetPlatform: 'platform2'
		};

		const workspaceServiceMock = TypeMoq.Mock.ofType<WorkspaceService>();
		workspaceServiceMock.setup(x => x.getAllProjectTypes()).returns(() => Promise.resolve([projectTypeWithTargetPlatforms]));

		const dialog = new NewProjectDialog(workspaceServiceMock.object);
		await dialog.open();
		should.equal(dialog.model.targetPlatform, 'platform2', 'Target platform should be platform2');

	});

	test('Should handle invalid default target platform', async function (): Promise<void> {
		const projectTypeWithTargetPlatforms: IProjectType = {
			id: 'tp2',
			description: '',
			projectFileExtension: 'testproj2',
			icon: '',
			displayName: 'test project 2',
			targetPlatforms: ['platform1', 'platform2', 'platform3'],
			defaultTargetPlatform: 'invalid'
		};

		const workspaceServiceMock = TypeMoq.Mock.ofType<WorkspaceService>();
		workspaceServiceMock.setup(x => x.getAllProjectTypes()).returns(() => Promise.resolve([projectTypeWithTargetPlatforms]));

		const dialog = new NewProjectDialog(workspaceServiceMock.object);
		await dialog.open();
		should.equal(dialog.model.targetPlatform, 'platform1', 'Target platform should be platform1 (the first value in target platforms)');

	});

	test('Should handle no target platforms provided by project type', async function (): Promise<void> {
		const workspaceServiceMock = TypeMoq.Mock.ofType<WorkspaceService>();
		workspaceServiceMock.setup(x => x.getAllProjectTypes()).returns(() => Promise.resolve([testProjectType]));

		const dialog = new NewProjectDialog(workspaceServiceMock.object);
		await dialog.open();
		should.equal(dialog.model.targetPlatform, undefined, 'Target platform should be undefined');
	});
});

