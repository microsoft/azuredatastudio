/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as assert from 'assert';
import { Mock, It, Times } from 'typemoq';
import { MainThreadModelViewDialog } from 'sql/workbench/api/node/mainThreadModelViewDialog';
import { IExtHostContext } from 'vs/workbench/api/node/extHost.protocol';
import { IModelViewButtonDetails, IModelViewTabDetails, IModelViewDialogDetails, IModelViewWizardPageDetails, IModelViewWizardDetails, DialogMessage, MessageLevel } from 'sql/workbench/api/common/sqlExtHostTypes';
import { CustomDialogService } from 'sql/platform/dialog/customDialogService';
import { Dialog, DialogTab, Wizard } from 'sql/platform/dialog/dialogTypes';
import { ExtHostModelViewDialogShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { Emitter } from 'vs/base/common/event';


suite('MainThreadModelViewDialog Tests', () => {
	let mainThreadModelViewDialog: MainThreadModelViewDialog;
	let mockExtHostModelViewDialog: Mock<ExtHostModelViewDialogShape>;
	let mockDialogService: Mock<CustomDialogService>;
	let openedDialog: Dialog;
	let openedWizard: Wizard;

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

	// Wizard details
	let nextButtonDetails: IModelViewButtonDetails;
	let backButtonDetails: IModelViewButtonDetails;
	let generateScriptButtonDetails: IModelViewButtonDetails;
	let page1Details: IModelViewWizardPageDetails;
	let page2Details: IModelViewWizardPageDetails;
	let page3Details: IModelViewWizardPageDetails;
	let wizardDetails: IModelViewWizardDetails;
	let nextButtonHandle = 8;
	let backButtonHandle = 9;
	let generateScriptButtonHandle = 10;
	let page1Handle = 11;
	let page2Handle = 12;
	let wizardHandle = 13;
	let page3Handle = 14;

	setup(() => {
		mockExtHostModelViewDialog = Mock.ofInstance(<ExtHostModelViewDialogShape>{
			$onButtonClick: handle => undefined,
			$onPanelValidityChanged: (handle, valid) => undefined,
			$onWizardPageChanged: (handle, info) => undefined,
			$updateWizardPageInfo: (wizardHandle, pageHandles, currentPageIndex) => undefined,
			$validateNavigation: (handle, info) => undefined,
			$validateDialogClose: handle => undefined
		});
		let extHostContext = <IExtHostContext>{
			getProxy: proxyType => mockExtHostModelViewDialog.object
		};
		mainThreadModelViewDialog = new MainThreadModelViewDialog(extHostContext, undefined, undefined, undefined);

		// Set up the mock dialog service
		mockDialogService = Mock.ofType(CustomDialogService, undefined, undefined);
		openedDialog = undefined;
		mockDialogService.setup(x => x.showDialog(It.isAny())).callback(dialog => openedDialog = dialog);
		mockDialogService.setup(x => x.showWizard(It.isAny())).callback(wizard => {
			openedWizard = wizard;
			// The actual service will set the page to 0 when it opens the wizard
			openedWizard.setCurrentPage(0);
		});
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
			customButtons: [button1Handle, button2Handle],
			message: undefined
		};

		// Set up the wizard details
		nextButtonDetails = {
			label: 'next_label',
			enabled: true,
			hidden: false
		};
		backButtonDetails = {
			label: 'back_label',
			enabled: true,
			hidden: false
		};
		generateScriptButtonDetails = {
			label: 'generate_script_label',
			enabled: true,
			hidden: false
		};
		page1Details = {
			title: 'page1',
			content: 'content1',
			enabled: true,
			customButtons: [],
			description: 'description1'
		};
		page2Details = {
			title: 'page2',
			content: 'content2',
			enabled: true,
			customButtons: [button1Handle, button2Handle],
			description: 'description2'
		};
		wizardDetails = {
			backButton: backButtonHandle,
			nextButton: nextButtonHandle,
			generateScriptButton: generateScriptButtonHandle,
			cancelButton: cancelButtonHandle,
			doneButton: okButtonHandle,
			currentPage: undefined,
			title: 'wizard_title',
			customButtons: [],
			pages: [page1Handle, page2Handle],
			message: undefined,
			displayPageTitles: false
		};

		// Register the buttons, tabs, and dialog
		mainThreadModelViewDialog.$setButtonDetails(button1Handle, button1Details);
		mainThreadModelViewDialog.$setButtonDetails(button2Handle, button2Details);
		mainThreadModelViewDialog.$setButtonDetails(okButtonHandle, okButtonDetails);
		mainThreadModelViewDialog.$setButtonDetails(cancelButtonHandle, cancelButtonDetails);
		mainThreadModelViewDialog.$setTabDetails(tab1Handle, tab1Details);
		mainThreadModelViewDialog.$setTabDetails(tab2Handle, tab2Details);
		mainThreadModelViewDialog.$setDialogDetails(dialogHandle, dialogDetails);

		// Register the wizard and its pages and buttons
		mainThreadModelViewDialog.$setButtonDetails(nextButtonHandle, nextButtonDetails);
		mainThreadModelViewDialog.$setButtonDetails(backButtonHandle, backButtonDetails);
		mainThreadModelViewDialog.$setButtonDetails(generateScriptButtonHandle, generateScriptButtonDetails);
		mainThreadModelViewDialog.$setWizardPageDetails(page1Handle, page1Details);
		mainThreadModelViewDialog.$setWizardPageDetails(page2Handle, page2Details);
		mainThreadModelViewDialog.$setWizardDetails(wizardHandle, wizardDetails);
	});

	test('Creating a dialog and calling open on it causes a dialog with correct content and buttons to open', () => {
		// If I open the dialog
		mainThreadModelViewDialog.$openDialog(dialogHandle);

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
		mainThreadModelViewDialog.$openDialog(dialogHandle);

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

	test('Creating a wizard and calling open on it causes a wizard with correct pages and buttons to open', () => {
		// If I open the wizard
		mainThreadModelViewDialog.$openWizard(wizardHandle);

		// Then the opened wizard's content and buttons match what was set
		mockDialogService.verify(x => x.showWizard(It.isAny()), Times.once());
		assert.notEqual(openedWizard, undefined);
		assert.equal(openedWizard.title, wizardDetails.title);
		assert.equal(openedWizard.doneButton.label, okButtonDetails.label);
		assert.equal(openedWizard.doneButton.enabled, okButtonDetails.enabled);
		assert.equal(openedWizard.cancelButton.label, cancelButtonDetails.label);
		assert.equal(openedWizard.cancelButton.enabled, cancelButtonDetails.enabled);
		assert.equal(openedWizard.customButtons.length, 0);
		assert.equal(openedWizard.pages.length, 2);
		assert.equal(openedWizard.currentPage, 0);
		assert.equal(openedWizard.displayPageTitles, wizardDetails.displayPageTitles);
		let page1 = openedWizard.pages[0];
		assert.equal(page1.title, page1Details.title);
		assert.equal(page1.content, page1Details.content);
		assert.equal(page1.enabled, page1Details.enabled);
		assert.equal(page1.valid, true);
		assert.equal(page1.customButtons.length, 0);
		assert.equal(page1.description, page1Details.description);
		let page2 = openedWizard.pages[1];
		assert.equal(page2.title, page2Details.title);
		assert.equal(page2.content, page2Details.content);
		assert.equal(page2.enabled, page2Details.enabled);
		assert.equal(page2.valid, true);
		assert.equal(page2.customButtons.length, 2);
		assert.equal(page2.description, page2Details.description);
	});

	test('The extension host gets notified when wizard page change events occur', () => {
		mockExtHostModelViewDialog.setup(x => x.$onWizardPageChanged(It.isAny(), It.isAny()));

		// If I open the wizard and change the page to index 1
		mainThreadModelViewDialog.$openWizard(wizardHandle);
		openedWizard.setCurrentPage(1);

		// Then a page changed event gets sent to the extension host
		mockExtHostModelViewDialog.verify(x => x.$onWizardPageChanged(It.is(handle => handle === wizardHandle),
			It.is(pageChangeInfo => pageChangeInfo.lastPage === 0 && pageChangeInfo.newPage === 1)), Times.once());
	});

	test('Validity changed events are forwarded to the extension host', () => {
		mockExtHostModelViewDialog.setup(x => x.$onPanelValidityChanged(It.isAny(), It.isAny()));

		// If I open the dialog and set its validity and its 2nd tab's validity to false
		mainThreadModelViewDialog.$openDialog(dialogHandle);
		(openedDialog.content[1] as DialogTab).notifyValidityChanged(false);
		openedDialog.notifyValidityChanged(false);

		// Then a validity changed event gets sent to the extension host for the tab and the dialog
		mockExtHostModelViewDialog.verify(x => x.$onPanelValidityChanged(It.is(handle => handle === dialogHandle), It.is(valid => valid === false)), Times.once());
		mockExtHostModelViewDialog.verify(x => x.$onPanelValidityChanged(It.is(handle => handle === tab2Handle), It.is(valid => valid === false)), Times.once());
	});

	test('addWizardPage method inserts pages at the correct spot and notifies the extension host', () => {
		mockExtHostModelViewDialog.setup(x => x.$updateWizardPageInfo(It.isAny(), It.isAny(), It.isAny()));
		page3Details = {
			title: 'page_3',
			content: 'content_3',
			customButtons: [],
			enabled: true,
			description: undefined
		};

		// If I open the wizard and then add a page
		mainThreadModelViewDialog.$openWizard(wizardHandle);
		mainThreadModelViewDialog.$setWizardPageDetails(page3Handle, page3Details);
		mainThreadModelViewDialog.$addWizardPage(wizardHandle, page3Handle, 0);

		// Then the updated page info gets sent to the extension host
		mockExtHostModelViewDialog.verify(x => x.$updateWizardPageInfo(
			It.is(handle => handle === wizardHandle),
			It.is(pageHandles => pageHandles.length === 3 && pageHandles[0] === page3Handle),
			It.is(currentPage => currentPage === 1)), Times.once());
	});

	test('removeWizardPage method removes pages at the correct spot and notifies the extension host', () => {
		mockExtHostModelViewDialog.setup(x => x.$updateWizardPageInfo(It.isAny(), It.isAny(), It.isAny()));

		// If I open the wizard and then remove a page
		mainThreadModelViewDialog.$openWizard(wizardHandle);
		mainThreadModelViewDialog.$removeWizardPage(wizardHandle, 0);

		// Then the updated page info gets sent to the extension host
		mockExtHostModelViewDialog.verify(x => x.$updateWizardPageInfo(
			It.is(handle => handle === wizardHandle),
			It.is(pageHandles => pageHandles.length === 1 && pageHandles[0] === page2Handle),
			It.is(currentPage => currentPage === 0)), Times.once());
	});

	test('Creating a wizard adds a navigation validation that calls the extension host', () => {
		mockExtHostModelViewDialog.setup(x => x.$validateNavigation(It.isAny(), It.isAny()));

		// If I call validateNavigation on the wizard that gets created
		mainThreadModelViewDialog.$openWizard(wizardHandle);
		openedWizard.validateNavigation(1);

		// Then the call gets forwarded to the extension host
		mockExtHostModelViewDialog.verify(x => x.$validateNavigation(It.is(handle => handle === wizardHandle), It.is(info => info.newPage === 1)), Times.once());
	});

	test('Adding a message to a wizard fires events on the created wizard', () => {
		mainThreadModelViewDialog.$openWizard(wizardHandle);
		let newMessage: DialogMessage;
		openedWizard.onMessageChange(message => newMessage = message);

		// If I change the wizard's message
		wizardDetails.message = {
			level: MessageLevel.Error,
			text: 'test message'
		};
		mainThreadModelViewDialog.$setWizardDetails(wizardHandle, wizardDetails);

		// Then the message gets changed on the wizard
		assert.equal(newMessage, wizardDetails.message, 'New message was not included in the fired event');
		assert.equal(openedWizard.message, wizardDetails.message, 'New message was not set on the wizard');
	});

	test('Creating a dialog adds a close validation that calls the extension host', () => {
		mockExtHostModelViewDialog.setup(x => x.$validateDialogClose(It.isAny()));

		// If I call validateClose on the dialog that gets created
		mainThreadModelViewDialog.$openDialog(dialogHandle);
		openedDialog.validateClose();

		// Then the call gets forwarded to the extension host
		mockExtHostModelViewDialog.verify(x => x.$validateDialogClose(It.is(handle => handle === dialogHandle)), Times.once());
	});
});