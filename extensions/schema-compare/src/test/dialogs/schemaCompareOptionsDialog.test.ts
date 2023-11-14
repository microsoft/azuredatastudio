/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as testUtils from '../testUtils';
import { SchemaCompareOptionsDialog } from '../../dialogs/schemaCompareOptionsDialog';

describe('Schema Compare Options Dialog', () => {
	it('Should open dialog successfully ', async function (): Promise<void> {
		const optionsDialog = new SchemaCompareOptionsDialog(testUtils.getDeploymentOptions(), undefined);
		optionsDialog.openDialog();
		should.notEqual(optionsDialog.dialog, undefined);
	});
});
