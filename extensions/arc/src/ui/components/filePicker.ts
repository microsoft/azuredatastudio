/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as path from 'path';
import * as vscode from 'vscode';
import * as loc from '../../localizedConstants';
import { promises as fs } from 'fs';
export interface RadioOptionsInfo {
	values?: string[],
	defaultValue: string
}

export class FilePicker {
	private _flexContainer: azdata.FlexContainer;
	public readonly filePathInputBox: azdata.InputBoxComponent;
	public readonly filePickerButton: azdata.ButtonComponent;
	constructor(
		modelBuilder: azdata.ModelBuilder,
		initialPath: string,
		onNewDisposableCreated: (disposable: vscode.Disposable) => void,
		ariaLabel: string,
		validationErrorMessage: string,
		required: boolean
	) {
		const buttonWidth = 80;
		this.filePathInputBox = modelBuilder.inputBox()
			.withProps({
				value: initialPath,
				ariaLabel: ariaLabel,
				validationErrorMessage: validationErrorMessage,
				required: required,
				width: 350
			}).withValidation(async () => {
				try {
					await fs.stat(this.filePathInputBox.value || '');
				} catch (err) {
					console.log('Error checking config path ', err);
					return false;
				}
				return true;
			}).component();

		this.filePickerButton = modelBuilder.button()
			.withProps({
				label: loc.browse,
				width: buttonWidth,
				secondary: true
			}).component();
		onNewDisposableCreated(this.filePickerButton.onDidClick(async () => {
			const fileUris = await vscode.window.showOpenDialog({
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				defaultUri: this.filePathInputBox.value ? vscode.Uri.file(path.dirname(this.filePathInputBox.value)) : undefined,
				openLabel: loc.select,
				filters: undefined /* file type filters */
			});

			if (!fileUris || fileUris.length === 0) {
				return; // This can happen when a user cancels out. We don't throw and the user just won't be able to move on until they select something.
			}
			const fileUri = fileUris[0]; //we allow the user to select only one file in the dialog
			this.filePathInputBox.value = fileUri.fsPath;
		}));
		this._flexContainer = createFlexContainer(modelBuilder, [this.filePathInputBox, this.filePickerButton]);
	}

	component(): azdata.FlexContainer {
		return this._flexContainer;
	}

	get onTextChanged() {
		return this.filePathInputBox.onTextChanged;
	}

	get value(): string | undefined {
		return this.filePathInputBox?.value;
	}

	get items(): azdata.Component[] {
		return this._flexContainer.items;
	}
}

function createFlexContainer(modelBuilder: azdata.ModelBuilder, items: azdata.Component[], rowLayout: boolean = true, width?: string | number, height?: string | number, alignItems?: azdata.AlignItemsType, cssStyles?: { [key: string]: string }): azdata.FlexContainer {
	const flexFlow = rowLayout ? 'row' : 'column';
	alignItems = alignItems || (rowLayout ? 'center' : undefined);
	const itemsStyle = rowLayout ? { CSSStyles: { 'margin-right': '5px', } } : {};
	const flexLayout: azdata.FlexLayout = { flexFlow: flexFlow, height: height, width: width, alignItems: alignItems };
	return modelBuilder.flexContainer().withItems(items, itemsStyle).withLayout(flexLayout).withProps({ CSSStyles: cssStyles || {} }).component();
}
