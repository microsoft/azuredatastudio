/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RemoteBookDialog } from '../../dialog/remoteBookDialog';
import { RemoteBookDialogModel } from '../../dialog/remoteBookDialogModel';
import { RemoteBookController } from '../../book/remoteBookController';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { MockExtensionContext } from '../common/stubs';
import { AppContext } from '../../common/appContext';
import * as azdata from 'azdata';
import * as should from 'should';

describe('Add Remote Book Dialog', function () {
	let mockExtensionContext: vscode.ExtensionContext = new MockExtensionContext();
	let appContext = new AppContext(mockExtensionContext);
	let model = new RemoteBookDialogModel();
	let controller = new RemoteBookController(model, appContext.outputChannel);
	let dialog = new RemoteBookDialog(controller);

	it('Should open dialog successfully ', async function (): Promise<void> {
		const spy = sinon.spy(azdata.window, 'openDialog');
		await dialog.createDialog();
		should(spy.calledOnce).be.true();
	});
});

