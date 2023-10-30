/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../../constants/strings';

export function openRetryMigrationDialog(
	errorMessage: string,
	onAcceptCallback: () => Promise<void>): void {

	const disposables: vscode.Disposable[] = [];
	const tab = azdata.window.createTab('');

	tab.registerContent(async (view) => {
		disposables.push(
			view.onClosed(e =>
				disposables.forEach(
					d => { try { d.dispose(); } catch { } })));

		const flex = view.modelBuilder.flexContainer()
			.withItems([
				view.modelBuilder.text()
					.withProps({
						value: constants.RETRY_MIGRATION_TITLE,
						title: constants.RETRY_MIGRATION_TITLE,
						CSSStyles: { 'font-weight': '600', 'margin': '10px 0px 5px 0px' },
					})
					.component(),
				view.modelBuilder.inputBox()
					.withProps({
						value: errorMessage,
						title: errorMessage,
						readOnly: true,
						multiline: true,
						inputType: 'text',
						rows: 10,
						CSSStyles: { 'overflow': 'hidden auto', 'margin': '0px 0px 10px 0px' },
					})
					.component(),
				view.modelBuilder.text()
					.withProps({
						value: constants.RETRY_MIGRATION_SUMMARY,
						title: constants.RETRY_MIGRATION_SUMMARY,
						CSSStyles: { 'margin': '0px 0px 10px 0px' },
					})
					.component(),
				view.modelBuilder.text()
					.withProps({
						value: constants.RETRY_MIGRATION_PROMPT,
						title: constants.RETRY_MIGRATION_PROMPT,
						CSSStyles: { 'margin': '0px 0px 5px 0px' },
					})
					.component(),
			])
			.withLayout({ flexFlow: 'column', })
			.withProps({ CSSStyles: { 'margin': '0 15px 0 15px' } })
			.component();

		await view.initializeModel(flex);
	});

	const dialog = azdata.window.createModelViewDialog(
		'',
		'retryMigrationDialog',
		500,
		'normal',
		undefined,
		false);
	dialog.content = [tab];
	dialog.okButton.label = constants.YES;
	dialog.okButton.position = 'left';
	dialog.cancelButton.label = constants.NO;
	dialog.cancelButton.position = 'left';
	dialog.cancelButton.focused = true;



	disposables.push(
		dialog.okButton.onClick(
			async e => await onAcceptCallback()));

	azdata.window.openDialog(dialog);
}
