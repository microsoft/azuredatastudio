/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as should from 'should';
import 'mocha';
import { TestDialog } from '../../stubs/testDialog';
import { ConnectToControllerDialog } from '../../../ui/dialogs/connectControllerDialog';

describe('ConnectControllerDialog', function (): void {

	const originalCreateModelViewDialog = azdata.window.createModelViewDialog;
	const originalOpenDialog = azdata.window.openDialog;

	before(function (): void {
		const modelViewDialog = new TestDialog();
		azdata.window.createModelViewDialog = () => {
			return modelViewDialog;
		};
		azdata.window.openDialog = (_dialog) => { };
	});

	after(function (): void {
		azdata.window.createModelViewDialog = originalCreateModelViewDialog;
		azdata.window.openDialog = originalOpenDialog;
	});

	it('Validate returns false when input is empty', async function (): Promise<void> {
		const connectControllerDialog = new ConnectToControllerDialog(undefined!);
		const dialog = connectControllerDialog.showDialog(undefined, undefined) as TestDialog;
		await dialog.show();
		const validateResult = await dialog.close();
		should(validateResult).be.false();
	});

	it('Validate returns false when input is empty', async function (): Promise<void> {
		const connectControllerDialog = new ConnectToControllerDialog(undefined!);
		const dialog = connectControllerDialog.showDialog(undefined, undefined) as TestDialog;
		await dialog.show();
		connectControllerDialog['urlInputBox'].value = '127.0.0.1';
		connectControllerDialog['usernameInputBox'].value = 'sa';
		connectControllerDialog['passwordInputBox'].value = '12345';
		const validateResult = await dialog.close();
		should(validateResult).be.true();
	});
});
