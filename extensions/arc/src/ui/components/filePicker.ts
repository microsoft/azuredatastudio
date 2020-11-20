/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as path from 'path';
import * as vscode from 'vscode';
import * as loc from '../../localizedConstants';
import { IReadOnly } from '../dialogs/connectControllerDialog';

export interface RadioOptionsInfo {
	values?: string[],
	defaultValue: string
}

export class FilePicker implements IReadOnly {
	private _flexContainer: azdata.FlexContainer;
	private _filePathInputBox: azdata.InputBoxComponent;
	private _filePickerButton: azdata.ButtonComponent;
	constructor(
		modelBuilder: azdata.ModelBuilder,
		initialPath: string, onNewDisposableCreated: (disposable: vscode.Disposable) => void
	) {
		const buttonWidth = 100;
		this._filePathInputBox = modelBuilder.inputBox()
			.withProperties<azdata.InputBoxProperties>({
				value: initialPath,
				readOnly: false
			}).component();
		this._filePathInputBox.readOnly = true; //user entry is not allowed in this input box. as it is filled in by the filePickerButton
		this._filePickerButton = modelBuilder.button()
			.withProperties<azdata.ButtonProperties>({
				label: loc.browse,
				width: buttonWidth
			}).component();
		onNewDisposableCreated(this._filePickerButton.onDidClick(async () => {
			const fileUris = await vscode.window.showOpenDialog({
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				defaultUri: this._filePathInputBox.value ? vscode.Uri.file(path.dirname(this._filePathInputBox.value)) : undefined,
				openLabel: loc.select,
				filters: undefined /* file type filters */
			});

			if (!fileUris || fileUris.length === 0) {
				return; // TODO: Should we throw here?
			}
			const fileUri = fileUris[0];
			this._filePathInputBox.value = fileUri.fsPath;
		}));
		this._flexContainer = createFlexContainer(modelBuilder, [this._filePathInputBox, this._filePickerButton]);
		modelBuilder.divContainer()
			.withItems([this._filePathInputBox, this._filePickerButton])
			.withProperties<azdata.DivContainerProperties>({
				clickable: false
			}).component();
	}

	component(): azdata.Component {
		return this._flexContainer;
	}

	get onTextChanged() {
		return this._filePathInputBox.onTextChanged;
	}

	get value(): string | undefined {
		return this._filePathInputBox?.value;
	}

	get readOnly(): boolean | undefined {
		return this.enabled;
	}

	set readOnly(value: boolean | undefined) {
		this.enabled = value;
	}

	get enabled(): boolean | undefined {
		return this._filePickerButton.enabled && this._flexContainer.enabled;
	}

	set enabled(value: boolean | undefined) {
		this._filePickerButton.enabled = value;
		this._flexContainer.enabled = value;
	}
}

export function createFlexContainer(modelBuilder: azdata.ModelBuilder, items: azdata.Component[], rowLayout: boolean = true, width?: string | number, height?: string | number, alignItems?: azdata.AlignItemsType, cssStyles?: { [key: string]: string }): azdata.FlexContainer {
	const flexFlow = rowLayout ? 'row' : 'column';
	alignItems = alignItems || (rowLayout ? 'center' : undefined);
	const itemsStyle = rowLayout ? { CSSStyles: { 'margin-right': '5px', } } : {};
	const flexLayout: azdata.FlexLayout = { flexFlow: flexFlow };
	if (height) {
		flexLayout.height = height;
	}
	if (width) {
		flexLayout.width = width;
	}
	if (alignItems) {
		flexLayout.alignItems = alignItems;
	}
	return modelBuilder.flexContainer().withItems(items, itemsStyle).withLayout(flexLayout).withProperties<azdata.ComponentProperties>({ CSSStyles: cssStyles || {} }).component();
}
