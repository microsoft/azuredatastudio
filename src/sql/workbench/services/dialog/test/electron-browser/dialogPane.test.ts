/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { Dialog, DialogTab } from 'sql/workbench/services/dialog/common/dialogTypes';
import { DialogPane } from 'sql/workbench/services/dialog/browser/dialogPane';
import { DialogComponentParams } from 'sql/workbench/services/dialog/browser/dialogContainer.component';
import { bootstrapAngular } from 'sql/workbench/services/bootstrap/browser/bootstrapService';
import { TestThemeService } from 'vs/platform/theme/test/common/testThemeService';
import { workbenchInstantiationService } from 'vs/workbench/test/electron-browser/workbenchTestServices';


interface BootstrapAngular {
	(collection, moduleType, container, selectorString, params: DialogComponentParams, input, callbackSetModule): void;
}

suite('Dialog Pane Tests', () => {
	let dialog: Dialog;
	let container: HTMLElement;

	let bootstrapSave: BootstrapAngular;

	function setupBootstrap(fn: BootstrapAngular): void {
		(<any>bootstrapAngular) = fn;
	}

	setup(() => {
		dialog = new Dialog('test_dialog');
		container = document.createElement('div');
		bootstrapSave = bootstrapAngular;
	});

	test('Creating a pane from content without tabs initializes the model view content correctly', () => {
		// If I fill in a dialog's content with the ID of a specific model view provider and then render the dialog
		let modelViewId = 'test_content';
		let bootstrapCalls = 0;
		setupBootstrap((collection, moduleType, container, selectorString, params: DialogComponentParams, input, callbackSetModule) => {
			assert.equal(params.modelViewId, modelViewId);
			bootstrapCalls++;
		});
		dialog.content = modelViewId;
		const themeService = new TestThemeService();
		let dialogPane = new DialogPane(dialog.title, dialog.content, () => undefined, workbenchInstantiationService(), themeService, undefined);
		dialogPane.createBody(container);
		assert.equal(bootstrapCalls, 1);
	});

	test('Creating a pane from content with a single tab initializes without showing tabs', () => {
		// If I fill in a dialog's content with a single tab and then render the dialog
		let modelViewId = 'test_content';
		let bootstrapCalls = 0;
		setupBootstrap((collection, moduleType, container, selectorString, params: DialogComponentParams, input, callbackSetModule) => {
			assert.equal(params.modelViewId, modelViewId);
			bootstrapCalls++;
		});
		dialog.content = [new DialogTab('', modelViewId)];
		const themeService = new TestThemeService();
		let dialogPane = new DialogPane(dialog.title, dialog.content, () => undefined, workbenchInstantiationService(), themeService, false);
		dialogPane.createBody(container);
		assert.equal(bootstrapCalls, 1);
	});

	test('Dialog validation gets set based on the validity of the model view content', () => {
		// Set up the mock bootstrap service to intercept validation callbacks
		let validationCallbacks: ((valid: boolean) => void)[] = [];

		setupBootstrap((collection, moduleType, container, selectorString, params: DialogComponentParams, input, callbackSetModule) => {
			validationCallbacks.push(params.validityChangedCallback);
		});

		let modelViewId1 = 'test_content_1';
		let modelViewId2 = 'test_content_2';
		dialog.content = [new DialogTab('tab1', modelViewId1), new DialogTab('tab2', modelViewId2)];
		const themeService = new TestThemeService();
		let dialogPane = new DialogPane(dialog.title, dialog.content, valid => dialog.notifyValidityChanged(valid), workbenchInstantiationService(), themeService, false);
		dialogPane.createBody(container);

		let validityChanges: boolean[] = [];

		dialog.onValidityChanged(valid => validityChanges.push(valid));
		// If I set tab 2's validation to false
		validationCallbacks[1](false);
		// Then the whole dialog's validation is false
		assert.equal(dialog.valid, false);
		assert.equal(validityChanges.length, 1);
		assert.equal(validityChanges[0], false);
		// If I then set it back to true
		validationCallbacks[1](true);
		// Then the whole dialog's validation is true
		assert.equal(dialog.valid, true);
		assert.equal(validityChanges.length, 2);
		assert.equal(validityChanges[1], true);
		// If I set tab 1's validation to false
		validationCallbacks[0](false);
		// Then the whole dialog's validation is false
		assert.equal(dialog.valid, false);
		assert.equal(validityChanges.length, 3);
		assert.equal(validityChanges[2], false);
	});

	teardown(() => {
		(<any>bootstrapAngular) = bootstrapSave;
	});
});
