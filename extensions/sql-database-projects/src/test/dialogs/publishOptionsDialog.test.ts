/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as testUtils from '../../test/testContext';

import { PublishOptionsDialog } from '../../dialogs/publishOptionsDialog';
import { PublishDatabaseDialog } from '../../dialogs/publishDatabaseDialog';
import { Project } from '../../models/project';

describe('Publish Database Options Dialog', () => {
	it('Should open dialog successfully ', async function (): Promise<void> {
		const publishDatabaseDialog = new PublishDatabaseDialog(new Project(''));
		const optionsDialog = new PublishOptionsDialog(testUtils.getDeploymentOptions(), publishDatabaseDialog);
		optionsDialog.openDialog();
		should.notEqual(optionsDialog.dialog, undefined);
	});
});


