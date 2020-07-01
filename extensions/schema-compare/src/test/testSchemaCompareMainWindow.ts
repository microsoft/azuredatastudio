/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as mssql from '../../../mssql';
import { SchemaCompareMainWindow } from '../schemaCompareMainWindow';
import { ApiWrapper } from '../common/apiWrapper';
import { ButtonState } from '../utils';

export class SchemaCompareMainWindowTest extends SchemaCompareMainWindow {

	constructor(
		apiWrapper: ApiWrapper,
		schemaCompareService: mssql.ISchemaCompareService,
		extensionContext: vscode.ExtensionContext) {
		super(apiWrapper, schemaCompareService, extensionContext);
	}

	// only for test
	public getComparisonResult(): mssql.SchemaCompareResult {
		return this.comparisonResult;
	}

	// only for test
	public getButtonsState(): ButtonState {

		let buttonObject: ButtonState = {
			compareButtonState: this.compareButton.enabled,
			optionsButtonState: this.optionsButton.enabled,
			switchButtonState: this.switchButton.enabled,
			openScmpButtonState: this.openScmpButton.enabled,
			saveScmpButtonState: this.saveScmpButton.enabled,
			cancelCompareButtonState: this.cancelCompareButton.enabled,
			selectSourceButtonState: this.selectSourceButton.enabled,
			selectTargetButtonState: this.selectTargetButton.enabled,
			generateScriptButtonState: this.generateScriptButton.enabled,
			applyButtonState: this.applyButton.enabled
		};

		return buttonObject;
	}

	public verifyButtonsState(buttonState: ButtonState): boolean {
		let result: boolean = false;

		if (this.compareButton.enabled === buttonState.compareButtonState &&
			this.optionsButton.enabled === buttonState.optionsButtonState &&
			this.switchButton.enabled === buttonState.switchButtonState &&
			this.openScmpButton.enabled === buttonState.openScmpButtonState &&
			this.saveScmpButton.enabled === buttonState.saveScmpButtonState &&
			this.cancelCompareButton.enabled === buttonState.cancelCompareButtonState &&
			this.selectSourceButton.enabled === buttonState.selectSourceButtonState &&
			this.selectTargetButton.enabled === buttonState.selectTargetButtonState &&
			this.generateScriptButton.enabled === buttonState.generateScriptButtonState &&
			this.applyButton.enabled === buttonState.applyButtonState) {
			result = true;
		}

		return result;
	}

}
