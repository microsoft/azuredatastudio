/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Dialog, DialogTab } from 'sql/platform/dialog/dialogTypes';
import { Mock, It, Times } from 'typemoq';
import { IBootstrapService } from 'sql/services/bootstrap/bootstrapService';
import { DialogPane } from 'sql/platform/dialog/dialogPane';
import { DialogComponentParams } from 'sql/platform/dialog/dialogContainer.component';

'use strict';

suite('Dialog Pane Tests', () => {
	let dialog: Dialog;
	let mockBootstrapService: Mock<IBootstrapService>;
	let container: HTMLElement;

	setup(() => {
		dialog = new Dialog('test_dialog');
		mockBootstrapService = Mock.ofInstance({
			bootstrap: () => undefined
		} as any);
		mockBootstrapService.setup(x => x.bootstrap(It.isAny(), It.isAny(), It.isAny(), It.isAny(), undefined, It.isAny()));
		container = document.createElement('div');
	});

	test('Creating a pane from content without tabs initializes the model view content correctly', () => {
		// If I fill in a dialog's content with the ID of a specific model view provider and then render the dialog
		let modelViewId = 'test_content';
		dialog.content = modelViewId;
		let dialogPane = new DialogPane(dialog, mockBootstrapService.object);
		dialogPane.createBody(container);

		// Then a single dialog-modelview-container element is added directly to the dialog pane
		mockBootstrapService.verify(x => x.bootstrap(
			It.isAny(),
			It.isAny(),
			It.isAny(),
			It.is((x: DialogComponentParams) => x.modelViewId === modelViewId),
			undefined,
			It.isAny()), Times.once());
	});

	test('Creating a pane from content with a single tab initializes without showing tabs', () => {
		// If I fill in a dialog's content with a single tab and then render the dialog
		let modelViewId = 'test_content';
		dialog.content = [new DialogTab('', modelViewId)];
		let dialogPane = new DialogPane(dialog, mockBootstrapService.object);
		dialogPane.createBody(container);

		// Then a single dialog-modelview-container element is added directly to the dialog pane
		mockBootstrapService.verify(x => x.bootstrap(
			It.isAny(),
			It.isAny(),
			It.isAny(),
			It.is((x: DialogComponentParams) => x.modelViewId === modelViewId),
			undefined,
			It.isAny()), Times.once());
	});

	test('Creating a pane from content with multiple tabs initializes multiple model view tabs', () => {
		// If I fill in a dialog's content with a single tab and then render the dialog
		let modelViewId1 = 'test_content_1';
		let modelViewId2 = 'test_content_2';
		dialog.content = [new DialogTab('tab1', modelViewId1), new DialogTab('tab2', modelViewId2)];
		let dialogPane = new DialogPane(dialog, mockBootstrapService.object);
		dialogPane.createBody(container);

		// Then a dialog-modelview-container element is added for the first tab (subsequent ones get added when the tab is actually clicked)
		mockBootstrapService.verify(x => x.bootstrap(
			It.isAny(),
			It.isAny(),
			It.isAny(),
			It.is((x: DialogComponentParams) => x.modelViewId === modelViewId1),
			undefined,
			It.isAny()), Times.once());
	});
});