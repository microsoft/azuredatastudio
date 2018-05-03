/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { Mock, It, Times } from 'typemoq';
import { MainThreadModelViewDialog } from 'sql/workbench/api/node/mainThreadModelViewDialog';
import { IExtHostContext } from 'vs/workbench/api/node/extHost.protocol';
import { IModelViewButtonDetails, IModelViewTabDetails, IModelViewDialogDetails } from 'sql/workbench/api/common/sqlExtHostTypes';
import { CustomDialogService } from 'sql/platform/dialog/customDialogService';
import { Dialog, DialogTab } from 'sql/platform/dialog/dialogTypes';
import { ExtHostModelViewDialogShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { Emitter } from 'vs/base/common/event';

'use strict';

suite('MainThreadModelViewDialog Tests', () => {
	let mainThreadModelViewDialog: MainThreadModelViewDialog;
	let mockExtHostModelViewDialog: Mock<ExtHostModelViewDialogShape>;
	let mockDialogService: Mock<CustomDialogService>;
	let openedDialog: Dialog;

	// Dialog details
	let button1Details: IModelViewButtonDetails;
	let button2Details: IModelViewButtonDetails;
	let okButtonDetails: IModelViewButtonDetails;
	let cancelButtonDetails: IModelViewButtonDetails;
	let tab1Details: IModelViewTabDetails;
	let tab2Details: IModelViewTabDetails;
	let dialogDetails: IModelViewDialogDetails;
	let button1Handle = 1;
	let button2Handle = 2;
	let okButtonHandle = 3;
	let cancelButtonHandle = 4;
	let tab1Handle = 5;
	let tab2Handle = 6;
	let dialogHandle = 7;

	setup(() => {
		mockExtHostModelViewDialog = Mock.ofInstance(<ExtHostModelViewDialogShape>{
			$onButtonClick: handle => undefined
		});
		let extHostContext = <IExtHostContext>{
			getProxy: proxyType => mockExtHostModelViewDialog.object
		};
		mainThreadModelViewDialog = new MainThreadModelViewDialog(extHostContext, undefined);

		// Set up the mock dialog service
		mockDialogService = Mock.ofType(CustomDialogService, undefined, undefined);
		openedDialog = undefined;
		mockDialogService.setup(x => x.showDialog(It.isAny())).callback(dialog => openedDialog = dialog);
		(mainThreadModelViewDialog as any)._dialogService = mockDialogService.object;

		// Set up the dialog details
		button1Details = {
			label: 'button1',
			enabled: false,
			hidden: false
		};
		button2Details = {
			label: 'button2',
			enabled: true,
			hidden: false
		};
		okButtonDetails = {
			label: 'ok_label',
			enabled: true,
			hidden: false
		};
		cancelButtonDetails = {
			label: 'cancel_label',
			enabled: true,
			hidden: false
		};
		tab1Details = {
			title: 'tab1',
			content: 'content1'
		};
		tab2Details = {
			title: 'tab2',
			content: 'content2'
		};
		dialogDetails = {
			title: 'dialog1',
			content: [tab1Handle, tab2Handle],
			okButton: okButtonHandle,
			cancelButton: cancelButtonHandle,
			customButtons: [button1Handle, button2Handle]
		};

		// Register the buttons, tabs, and dialog
		mainThreadModelViewDialog.$setButtonDetails(button1Handle, button1Details);
		mainThreadModelViewDialog.$setButtonDetails(button2Handle, button2Details);
		mainThreadModelViewDialog.$setButtonDetails(okButtonHandle, okButtonDetails);
		mainThreadModelViewDialog.$setButtonDetails(cancelButtonHandle, cancelButtonDetails);
		mainThreadModelViewDialog.$setTabDetails(tab1Handle, tab1Details);
		mainThreadModelViewDialog.$setTabDetails(tab2Handle, tab2Details);
		mainThreadModelViewDialog.$setDialogDetails(dialogHandle, dialogDetails);
	});

	test('Creating a dialog and calling open on it causes a dialog with correct content and buttons to open', () => {
		// If I open the dialog
		mainThreadModelViewDialog.$open(dialogHandle);

		// Then the opened dialog's content and buttons match what was set
		mockDialogService.verify(x => x.showDialog(It.isAny()), Times.once());
		assert.notEqual(openedDialog, undefined);
		assert.equal(openedDialog.title, dialogDetails.title);
		assert.equal(openedDialog.okButton.label, okButtonDetails.label);
		assert.equal(openedDialog.okButton.enabled, okButtonDetails.enabled);
		assert.equal(openedDialog.cancelButton.label, cancelButtonDetails.label);
		assert.equal(openedDialog.cancelButton.enabled, cancelButtonDetails.enabled);
		assert.equal(openedDialog.customButtons.length, 2);
		assert.equal(openedDialog.customButtons[0].label, button1Details.label);
		assert.equal(openedDialog.customButtons[0].enabled, button1Details.enabled);
		assert.equal(openedDialog.customButtons[1].label, button2Details.label);
		assert.equal(openedDialog.customButtons[1].enabled, button2Details.enabled);
		assert.equal(openedDialog.content.length, 2);
		assert.equal((openedDialog.content[0] as DialogTab).content, tab1Details.content);
		assert.equal((openedDialog.content[0] as DialogTab).title, tab1Details.title);
		assert.equal((openedDialog.content[1] as DialogTab).content, tab2Details.content);
		assert.equal((openedDialog.content[1] as DialogTab).title, tab2Details.title);
	});

	test('Button presses are forwarded to the extension host', () => {
		// Set up the mock proxy to capture button presses
		let pressedHandles = [];
		mockExtHostModelViewDialog.setup(x => x.$onButtonClick(It.isAny())).callback(handle => pressedHandles.push(handle));

		// Open the dialog so that its buttons can be accessed
		mainThreadModelViewDialog.$open(dialogHandle);

		// Set up click emitters for each button
		let okEmitter = new Emitter<void>();
		let cancelEmitter = new Emitter<void>();
		let button1Emitter = new Emitter<void>();
		let button2Emitter = new Emitter<void>();
		openedDialog.okButton.registerClickEvent(okEmitter.event);
		openedDialog.cancelButton.registerClickEvent(cancelEmitter.event);
		openedDialog.customButtons[0].registerClickEvent(button1Emitter.event);
		openedDialog.customButtons[1].registerClickEvent(button2Emitter.event);

		// Click the buttons
		button1Emitter.fire();
		button2Emitter.fire();
		okEmitter.fire();
		cancelEmitter.fire();
		button2Emitter.fire();
		cancelEmitter.fire();
		button1Emitter.fire();
		okEmitter.fire();

		// Verify that the correct button click notifications were sent to the proxy
		assert.deepEqual(pressedHandles, [button1Handle, button2Handle, okButtonHandle, cancelButtonHandle, button2Handle, cancelButtonHandle, button1Handle, okButtonHandle]);
	});
});