/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as baselines from '../baselines/baselines';
import * as templates from '../../templates/templates';
import * as testUtils from '../testUtils';
import { AddDatabaseReferenceDialog } from '../../dialogs/addDatabaseReferenceDialog';

describe('Add Database Reference Dialog', () => {
	before(async function (): Promise<void> {
		await templates.loadTemplates(path.join(__dirname, '..', '..', '..', 'resources', 'templates'));
		await baselines.loadBaselines();
	});

	it('Should open dialog successfully ', async function (): Promise<void> {
		const project = await testUtils.createTestProject(baselines.newProjectFileBaseline);
		const dialog = new AddDatabaseReferenceDialog(project);
		await dialog.openDialog();
		should.notEqual(dialog.addDatabaseReferenceTab, undefined);
	});

});
