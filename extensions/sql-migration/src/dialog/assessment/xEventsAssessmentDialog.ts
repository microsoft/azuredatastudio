/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationStateModel } from '../../models/stateMachine';
import * as constants from '../../constants/strings';
import * as styles from '../../constants/styles';
import * as utils from '../../api/utils';

export class XEventsAssessmentDialog {
	private dialog: azdata.window.Dialog | undefined;
	private _isOpen: boolean = false;
	private _disposables: vscode.Disposable[] = [];

	private _clearButton!: azdata.window.Button;
	private _folderPickerContainer!: azdata.FlexContainer;
	private _folderPickerInput!: azdata.InputBoxComponent;

	private _xEventsFilesFolderPath!: string;

	constructor(public wizard: azdata.window.Wizard, public migrationStateModel: MigrationStateModel) { }

	private async initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			dialog.registerContent(async (view) => {
				try {
					const flex = this.createContainer(view);

					this._disposables.push(view.onClosed(e => {
						this._disposables.forEach(
							d => { try { d.dispose(); } catch { } });
					}));

					await view.initializeModel(flex);
					resolve();
				} catch (ex) {
					reject(ex);
				}
			});
		});
	}

	private createContainer(_view: azdata.ModelView): azdata.FlexContainer {
		const container = _view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'margin': '8px 16px',
				'flex-direction': 'column',
			}
		}).component();
		const description1 = _view.modelBuilder.text().withProps({
			value: constants.XEVENTS_ASSESSMENT_DESCRIPTION,
			CSSStyles: {
				...styles.BODY_CSS,
			}
		}).component();

		const moreInfo = _view.modelBuilder.hyperlink().withProps({
			label: constants.XEVENTS_ASSESSMENT_HELPLINK,
			url: 'aka.ms/sql-migration-xe-assess',
			CSSStyles: { ...styles.BODY_CSS },
			ariaLabel: constants.MORE_INFO,
			showLinkIcon: true
		}).component();


		this._folderPickerContainer = this.createFolderPickerContainer(_view);
		container.addItems([
			description1,
			// description2,
			moreInfo,
			this._folderPickerContainer,
		]);
		return container;
	}

	private createFolderPickerContainer(_view: azdata.ModelView): azdata.FlexContainer {
		const container = _view.modelBuilder.flexContainer()
			.withProps(
				{ CSSStyles: { 'flex-direction': 'column', } })
			.component();

		const instructions = _view.modelBuilder.text()
			.withProps({
				value: constants.XEVENTS_ASSESSMENT_OPEN_FOLDER,
				CSSStyles: { ...styles.LABEL_CSS, 'margin': '16px 0 8px 0' }
			}).component();

		const selectFolderContainer = _view.modelBuilder.flexContainer()
			.withProps(
				{ CSSStyles: { 'flex-direction': 'row', 'align-items': 'center' } })
			.component();

		this._folderPickerInput = _view.modelBuilder.inputBox().withProps({
			placeHolder: constants.FOLDER_NAME,
			readOnly: true,
			width: 320,
			CSSStyles: { 'margin-right': '12px' },
			ariaLabel: constants.XEVENTS_ASSESSMENT_OPEN_FOLDER
		}).component();
		this._disposables.push(
			this._folderPickerInput.onTextChanged(async (value) => {
				if (value) {
					this._xEventsFilesFolderPath = value.trim();
					this.dialog!.okButton.enabled = true;
				}
			}));

		const openButton = _view.modelBuilder.button()
			.withProps({
				label: constants.OPEN,
				width: 100,
				CSSStyles: { 'margin': '0' }
			}).component();
		this._disposables.push(
			openButton.onDidClick(
				async () => this._folderPickerInput.value = await utils.promptUserForFolder()));

		selectFolderContainer.addItems([
			this._folderPickerInput,
			openButton]);
		container.addItems([
			instructions,
			selectFolderContainer]);
		return container;
	}

	public async openDialog() {
		if (!this._isOpen) {
			this._isOpen = true;
			this.dialog = azdata.window.createModelViewDialog(
				constants.XEVENTS_ASSESSMENT_TITLE,
				'XEventsAssessmentDialog',
				'narrow');

			this.dialog.okButton.label = constants.SELECT;
			this.dialog.okButton.position = 'left';
			this.dialog.cancelButton.position = 'left';

			this._disposables.push(
				this.dialog.okButton.onClick(
					async () => await this.execute()));

			this._disposables.push(
				this.dialog.cancelButton.onClick(
					() => this._isOpen = false));

			this._clearButton = azdata.window.createButton(
				constants.ERROR_DIALOG_CLEAR_BUTTON_LABEL,
				'right');
			this._clearButton.enabled = this._xEventsFilesFolderPath ? true : false;
			this._disposables.push(
				this._clearButton.onClick(async () => {
					this._xEventsFilesFolderPath = '';
					await this.execute();
					azdata.window.closeDialog(this.dialog!);
				}));
			this.dialog.customButtons = [this._clearButton];

			const promise = this.initializeDialog(this.dialog);
			azdata.window.openDialog(this.dialog);
			await promise;

			this._xEventsFilesFolderPath = this.migrationStateModel._xEventsFilesFolderPath;
			this._folderPickerInput.value = this._xEventsFilesFolderPath;

			if (!this._folderPickerInput.value) {
				this.dialog.okButton.enabled = false;
			}
		}
	}

	protected async execute() {
		this._isOpen = false;
		this.migrationStateModel._xEventsFilesFolderPath = this._xEventsFilesFolderPath;
	}

	public get isOpen(): boolean {
		return this._isOpen;
	}
}
