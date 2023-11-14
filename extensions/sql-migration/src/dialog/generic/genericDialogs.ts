/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../../constants/strings';

export function ShowStatusMessageDialog(
	title: string,
	statusMessage: string,
	errorMessage: string,
): void {
	const tab = azdata.window.createTab(title);
	tab.registerContent(async (view) => {
		const flex = view.modelBuilder.flexContainer()
			.withItems([
				view.modelBuilder.text()
					.withProps({ value: statusMessage })
					.component(),
			])
			.withLayout({
				flexFlow: 'column',
				width: 420,
			})
			.withProps({ CSSStyles: { 'margin': '0 15px' } })
			.component();

		if (errorMessage.length > 0) {
			flex.addItem(
				view.modelBuilder.inputBox()
					.withProps({
						value: errorMessage,
						readOnly: true,
						multiline: true,
						inputType: 'text',
						height: 100,
						CSSStyles: { 'overflow': 'hidden auto' },
					})
					.component()
			);
		}

		await view.initializeModel(flex);
	});

	const dialog = azdata.window.createModelViewDialog(
		title,
		'messageDialog',
		450,
		'normal');
	dialog.content = [tab];
	dialog.okButton.hidden = true;
	dialog.cancelButton.focused = true;
	dialog.cancelButton.label = constants.CLOSE;
	dialog.cancelButton.position = 'left';

	azdata.window.openDialog(dialog);
}
