/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { Mock, It, Times } from 'typemoq';
import { ExtHostModelViewDialog } from 'sql/workbench/api/node/extHostModelViewDialog';
import { MainThreadModelViewDialogShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';

'use strict';

suite('ExtHostModelViewDialog Tests', () => {
	let extHostModelViewDialog: ExtHostModelViewDialog;
	let mockProxy: Mock<MainThreadModelViewDialogShape>;

	setup(() => {
		mockProxy = Mock.ofInstance(<MainThreadModelViewDialogShape>{
			$open: handle => undefined,
			$close: handle => undefined,
			$setDialogDetails: (handle, details) => undefined,
			$setTabDetails: (handle, details) => undefined,
			$setButtonDetails: (handle, details) => undefined
		});
		let mainContext = <IMainContext>{
			getProxy: proxyType => mockProxy.object
		};
		extHostModelViewDialog = new ExtHostModelViewDialog(mainContext);
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
		mockProxy.setup(x => x.$open(It.isAny()));
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

		// Open the dialog and verify that the correct main thread methods were called
		extHostModelViewDialog.open(dialog);
		mockProxy.verify(x => x.$setButtonDetails(It.isAny(), It.is(details => {
			return details.enabled === false && details.label === button1Label;
		})), Times.once());
		mockProxy.verify(x => x.$setButtonDetails(It.isAny(), It.is(details => {
			return details.enabled === true && details.label === button2Label;
		})), Times.once());
		mockProxy.verify(x => x.$setTabDetails(It.isAny(), It.is(details => {
			return details.title === tab1Title;
		})), Times.once());
		mockProxy.verify(x => x.$setTabDetails(It.isAny(), It.is(details => {
			return details.title === tab2Title;
		})), Times.once());
		mockProxy.verify(x => x.$setDialogDetails(It.isAny(), It.is(details => {
			return details.title === dialogTitle;
		})), Times.once());
		mockProxy.verify(x => x.$open(It.isAny()), Times.once());
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
});