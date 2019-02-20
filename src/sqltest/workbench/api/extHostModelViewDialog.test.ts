/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as assert from 'assert';
import { Mock, It, Times } from 'typemoq';
import { ExtHostModelViewDialog } from 'sql/workbench/api/node/extHostModelViewDialog';
import { MainThreadModelViewDialogShape, ExtHostModelViewShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import { MessageLevel } from 'sql/workbench/api/common/sqlExtHostTypes';


suite('ExtHostModelViewDialog Tests', () => {
	let extHostModelViewDialog: ExtHostModelViewDialog;
	let mockProxy: Mock<MainThreadModelViewDialogShape>;
	let extHostModelView: Mock<ExtHostModelViewShape>;

	setup(() => {
		mockProxy = Mock.ofInstance(<MainThreadModelViewDialogShape>{
			$openDialog: handle => undefined,
			$closeDialog: handle => undefined,
			$setDialogDetails: (handle, details) => undefined,
			$setTabDetails: (handle, details) => undefined,
			$setButtonDetails: (handle, details) => undefined,
			$openWizard: handle => undefined,
			$closeWizard: handle => undefined,
			$setWizardPageDetails: (handle, details) => undefined,
			$setWizardDetails: (handle, details) => undefined
		});
		let mainContext = <IMainContext>{
			getProxy: proxyType => mockProxy.object
		};

		extHostModelView = Mock.ofInstance(<ExtHostModelViewShape>{
			$registerProvider: (widget, handler, extensionLocation) => undefined
		});
		extHostModelViewDialog = new ExtHostModelViewDialog(mainContext, extHostModelView.object, undefined);
	});

	test('Creating a dialog returns a dialog with initialized ok and cancel buttons and the given title', () => {
		let title = 'dialog_title';
		let dialog = extHostModelViewDialog.createDialog(title);

		assert.equal(dialog.title, title);
		assert.equal(dialog.okButton.enabled, true);
		assert.equal(dialog.cancelButton.enabled, true);
	});

	test('Creating a tab returns a tab with the given title', () => {
		let title = 'tab_title';
		let tab = extHostModelViewDialog.createTab(title);

		assert.equal(tab.title, title);
	});

	test('Creating a button returns an enabled button with the given label', () => {
		let label = 'button_label';
		let button = extHostModelViewDialog.createButton(label);

		assert.equal(button.label, label);
		assert.equal(button.enabled, true);
	});

	test('Opening a dialog updates its tabs and buttons on the main thread', () => {
		mockProxy.setup(x => x.$openDialog(It.isAny()));
		mockProxy.setup(x => x.$setDialogDetails(It.isAny(), It.isAny()));
		mockProxy.setup(x => x.$setTabDetails(It.isAny(), It.isAny()));
		mockProxy.setup(x => x.$setButtonDetails(It.isAny(), It.isAny()));

		// Create a dialog with 2 tabs and 2 custom buttons
		let dialogTitle = 'dialog_title';
		let dialog = extHostModelViewDialog.createDialog(dialogTitle);
		let tab1Title = 'tab_1';
		let tab1 = extHostModelViewDialog.createTab(tab1Title);
		let tab2Title = 'tab_2';
		let tab2 = extHostModelViewDialog.createTab(tab2Title);
		dialog.content = [tab1, tab2];
		let button1Label = 'button_1';
		let button1 = extHostModelViewDialog.createButton(button1Label);
		button1.enabled = false;
		let button2Label = 'button_2';
		let button2 = extHostModelViewDialog.createButton(button2Label);
		dialog.customButtons = [button1, button2];

		// Open the dialog and verify that the correct main thread methods were called
		extHostModelViewDialog.openDialog(dialog);
		mockProxy.verify(x => x.$setButtonDetails(It.isAny(), It.is(details => {
			return details.enabled === false && details.label === button1Label;
		})), Times.atLeastOnce());
		mockProxy.verify(x => x.$setButtonDetails(It.isAny(), It.is(details => {
			return details.enabled === true && details.label === button2Label;
		})), Times.atLeastOnce());
		mockProxy.verify(x => x.$setTabDetails(It.isAny(), It.is(details => {
			return details.title === tab1Title;
		})), Times.atLeastOnce());
		mockProxy.verify(x => x.$setTabDetails(It.isAny(), It.is(details => {
			return details.title === tab2Title;
		})), Times.atLeastOnce());
		mockProxy.verify(x => x.$setDialogDetails(It.isAny(), It.is(details => {
			return details.title === dialogTitle && details.content.length === 2 && details.customButtons.length === 2;
		})), Times.atLeastOnce());
		mockProxy.verify(x => x.$openDialog(It.isAny()), Times.once());
	});

	test('Button clicks are forwarded to the correct button', () => {
		// Set up the proxy to record button handles
		let handles = [];
		mockProxy.setup(x => x.$setButtonDetails(It.isAny(), It.isAny())).callback((handle, details) => handles.push(handle));

		// Set up the buttons to record click events
		let label1 = 'button_1';
		let label2 = 'button_2';
		let button1 = extHostModelViewDialog.createButton(label1);
		let button2 = extHostModelViewDialog.createButton(label2);
		let clickEvents = [];
		button1.onClick(() => clickEvents.push(1));
		button2.onClick(() => clickEvents.push(2));
		extHostModelViewDialog.updateButton(button1);
		extHostModelViewDialog.updateButton(button2);

		// If the main thread sends some notifications that the buttons have been clicked
		extHostModelViewDialog.$onButtonClick(handles[0]);
		extHostModelViewDialog.$onButtonClick(handles[1]);
		extHostModelViewDialog.$onButtonClick(handles[1]);
		extHostModelViewDialog.$onButtonClick(handles[0]);

		// Then the clicks should have been handled by the expected handlers
		assert.deepEqual(clickEvents, [1, 2, 2, 1]);
	});

	test('Creating a wizard returns a wizard with initialized buttons and the given title', () => {
		let title = 'wizard_title';
		let wizard = extHostModelViewDialog.createWizard(title);

		assert.equal(wizard.title, title);
		assert.equal(wizard.doneButton.enabled, true);
		assert.equal(wizard.cancelButton.enabled, true);
		assert.equal(wizard.nextButton.enabled, true);
		assert.equal(wizard.backButton.enabled, true);
		assert.deepEqual(wizard.pages, []);
	});

	test('Opening a wizard updates its pages and buttons on the main thread', () => {
		mockProxy.setup(x => x.$openWizard(It.isAny()));
		mockProxy.setup(x => x.$setWizardDetails(It.isAny(), It.isAny()));
		mockProxy.setup(x => x.$setWizardPageDetails(It.isAny(), It.isAny()));
		mockProxy.setup(x => x.$setButtonDetails(It.isAny(), It.isAny()));

		// Create a wizard with 2 pages and 2 custom buttons
		let wizardTitle = 'wizard_title';
		let wizard = extHostModelViewDialog.createWizard(wizardTitle);
		let page1Title = 'page_1';
		let page1 = extHostModelViewDialog.createWizardPage(page1Title);
		let page2Title = 'page_2';
		let page2 = extHostModelViewDialog.createWizardPage(page2Title);
		wizard.pages = [page1, page2];
		let button1Label = 'button_1';
		let button1 = extHostModelViewDialog.createButton(button1Label);
		button1.enabled = false;
		let button2Label = 'button_2';
		let button2 = extHostModelViewDialog.createButton(button2Label);
		wizard.customButtons = [button1, button2];

		// Open the wizard and verify that the correct main thread methods were called
		extHostModelViewDialog.openWizard(wizard);
		mockProxy.verify(x => x.$setButtonDetails(It.isAny(), It.is(details => {
			return details.enabled === false && details.label === button1Label;
		})), Times.atLeastOnce());
		mockProxy.verify(x => x.$setButtonDetails(It.isAny(), It.is(details => {
			return details.enabled === true && details.label === button2Label;
		})), Times.atLeastOnce());
		mockProxy.verify(x => x.$setWizardPageDetails(It.isAny(), It.is(details => {
			return details.title === page1Title;
		})), Times.atLeastOnce());
		mockProxy.verify(x => x.$setWizardPageDetails(It.isAny(), It.is(details => {
			return details.title === page2Title;
		})), Times.atLeastOnce());
		mockProxy.verify(x => x.$setWizardDetails(It.isAny(), It.is(details => {
			return details.title === wizardTitle && details.pages.length === 2 && details.customButtons.length === 2 &&
				details.displayPageTitles === true;
		})), Times.atLeastOnce());
		mockProxy.verify(x => x.$openWizard(It.isAny()), Times.once());
	});

	test('Wizard page changed events are handled correctly', () => {
		// Set up the main thread mock to record the handle assigned to the wizard
		let wizardHandle: number;
		mockProxy.setup(x => x.$setWizardDetails(It.isAny(), It.isAny())).callback((handle, details) => wizardHandle = handle);

		// Set up the wizard with 2 pages
		let wizard = extHostModelViewDialog.createWizard('test_wizard');
		let page1 = extHostModelViewDialog.createWizardPage('page_1');
		let page2 = extHostModelViewDialog.createWizardPage('page_2');
		wizard.pages = [page1, page2];
		extHostModelViewDialog.updateWizard(wizard);

		// Record page changed events
		let actualPageChangeInfo = [];
		wizard.onPageChanged(pageChangeInfo => {
			actualPageChangeInfo.push(pageChangeInfo);
		});

		// Call the page changed event and verify that it was handled
		let expectedPageChangeInfo = {
			lastPage: 0,
			newPage: 1
		};
		extHostModelViewDialog.$onWizardPageChanged(wizardHandle, expectedPageChangeInfo);
		assert.equal(actualPageChangeInfo.length, 1);
		assert.equal(actualPageChangeInfo[0], expectedPageChangeInfo);
		assert.equal(wizard.currentPage, expectedPageChangeInfo.newPage);
	});

	test('Validity changed events are handled correctly', () => {
		// Set up the main thread mock to record handles assigned to tabs
		let tabHandles = [];
		mockProxy.setup(x => x.$setTabDetails(It.isAny(), It.isAny())).callback((handle, details) => tabHandles.push(handle));

		// Set up the dialog with 2 tabs
		let dialog = extHostModelViewDialog.createDialog('test_dialog');
		let tab1 = extHostModelViewDialog.createTab('tab_1');
		let tab2 = extHostModelViewDialog.createTab('tab_2');
		dialog.content = [tab1, tab2];
		extHostModelViewDialog.updateDialogContent(dialog);

		// Record tab validity changed events
		let tab1ValidityChangedEvents = [];
		let tab2ValidityChangedEvents = [];
		tab1.onValidityChanged(valid => tab1ValidityChangedEvents.push(valid));
		tab2.onValidityChanged(valid => tab2ValidityChangedEvents.push(valid));

		// Call the validity changed event on tab 2 and verify that it was handled but tab 1 is still not valid
		extHostModelViewDialog.$onPanelValidityChanged(tabHandles[1], false);
		assert.equal(tab1ValidityChangedEvents.length, 0);
		assert.equal(tab1.valid, true);
		assert.equal(tab2ValidityChangedEvents.length, 1);
		assert.equal(tab2ValidityChangedEvents[0], false);
		assert.equal(tab2.valid, false);
	});

	test('Verify validity changed events update validity for all panel types', () => {
		// Set up the main thread mock to record handles for the tab, dialog, and page
		let tabHandle: number;
		let dialogHandle: number;
		let pageHandle: number;
		mockProxy.setup(x => x.$setTabDetails(It.isAny(), It.isAny())).callback((handle, details) => tabHandle = handle);
		mockProxy.setup(x => x.$setDialogDetails(It.isAny(), It.isAny())).callback((handle, details) => dialogHandle = handle);
		mockProxy.setup(x => x.$setWizardPageDetails(It.isAny(), It.isAny())).callback((handle, details) => pageHandle = handle);

		// Initialize a tab, dialog, and page
		let tab = extHostModelViewDialog.createTab('tab_1');
		extHostModelViewDialog.updateTabContent(tab);
		let dialog = extHostModelViewDialog.createDialog('dialog_1');
		extHostModelViewDialog.updateDialogContent(dialog);
		let page = extHostModelViewDialog.createWizardPage('page_1');
		extHostModelViewDialog.updateWizardPage(page);

		// Call the validity changed event on each object and verify that the object's validity was updated
		extHostModelViewDialog.$onPanelValidityChanged(tabHandle, false);
		assert.equal(tab.valid, false);
		extHostModelViewDialog.$onPanelValidityChanged(dialogHandle, false);
		assert.equal(dialog.valid, false);
		extHostModelViewDialog.$onPanelValidityChanged(pageHandle, false);
		assert.equal(page.valid, false);
	});

	test('Main thread can execute wizard navigation validation', () => {
		// Set up the main thread mock to record the wizard handle
		let wizardHandle: number;
		mockProxy.setup(x => x.$setWizardDetails(It.isAny(), It.isAny())).callback((handle, details) => wizardHandle = handle);

		// Create the wizard and add a validation that records that it has been called
		let wizard = extHostModelViewDialog.createWizard('wizard_1');
		extHostModelViewDialog.updateWizard(wizard);
		let validationInfo: sqlops.window.WizardPageChangeInfo;
		wizard.registerNavigationValidator(info => {
			validationInfo = info;
			return true;
		});

		// If I call the validation from the main thread then it should run and record the correct page change info
		let lastPage = 0;
		let newPage = 1;
		extHostModelViewDialog.$validateNavigation(wizardHandle, {
			lastPage: lastPage,
			newPage: newPage
		});
		assert.notEqual(validationInfo, undefined);
		assert.equal(validationInfo.lastPage, lastPage);
		assert.equal(validationInfo.newPage, newPage);
	});

	test('Changing the wizard message sends the new message to the main thread', () => {
		// Set up the main thread mock to record the call
		mockProxy.setup(x => x.$setWizardDetails(It.isAny(), It.isAny()));
		let wizard = extHostModelViewDialog.createWizard('wizard_1');

		// If I update the wizard's message
		let newMessage = {
			level: MessageLevel.Error,
			text: 'test message'
		};
		wizard.message = newMessage;

		// Then the main thread gets notified of the new details
		mockProxy.verify(x => x.$setWizardDetails(It.isAny(), It.is(x => x.message === newMessage)), Times.once());
	});

	test('Main thread can execute dialog close validation', () => {
		// Set up the main thread mock to record the dialog handle
		let dialogHandle: number;
		mockProxy.setup(x => x.$setDialogDetails(It.isAny(), It.isAny())).callback((handle, details) => dialogHandle = handle);

		// Create the dialog and add a validation that records that it has been called
		let dialog = extHostModelViewDialog.createDialog('dialog_1');
		extHostModelViewDialog.updateDialogContent(dialog);
		let callCount = 0;
		dialog.registerCloseValidator(() => {
			callCount++;
			return true;
		});

		// If I call the validation from the main thread then it should run
		extHostModelViewDialog.$validateDialogClose(dialogHandle);
		assert.equal(callCount, 1);
	});
});