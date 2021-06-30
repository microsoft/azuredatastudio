/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
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
});

