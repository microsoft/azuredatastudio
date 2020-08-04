/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as mssql from '../../../mssql';
import * as should from 'should';
import { SchemaCompareMainWindow } from '../schemaCompareMainWindow';
import { ApiWrapper } from '../common/apiWrapper';

export interface ButtonState {
	compareButtonState: boolean;
	optionsButtonState: boolean;
	switchButtonState: boolean;
	openScmpButtonState: boolean;
	saveScmpButtonState: boolean;
	cancelCompareButtonState: boolean;
	selectSourceButtonState: boolean;
	selectTargetButtonState: boolean;
	generateScriptButtonState: boolean;
	applyButtonState: boolean;
}
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

	public verifyButtonsState(buttonState: ButtonState): void {
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

		should(result).equal(true, `CompareButton: (Actual) ${this.compareButton.enabled} (Expected) ${buttonState.compareButtonState}
		OptionsButton: (Actual) ${this.optionsButton.enabled} (Expected) ${buttonState.optionsButtonState}
		SwitchButton: (Actual) ${this.switchButton.enabled} (Expected) ${buttonState.switchButtonState}
		OpenScmpButton: (Actual) ${this.openScmpButton.enabled} (Expected) ${buttonState.openScmpButtonState}
		SaveScmpButton: (Actual) ${this.saveScmpButton.enabled} (Expected) ${buttonState.saveScmpButtonState}
		CancelCompareButton: (Actual) ${this.cancelCompareButton.enabled} (Expected) ${buttonState.cancelCompareButtonState}
		SelectSourceButton: (Actual) ${this.selectSourceButton.enabled} (Expected) ${buttonState.selectSourceButtonState}
		SelectTargetButton: (Actual) ${this.selectTargetButton.enabled} (Expected) ${buttonState.selectTargetButtonState}
		GenerateScriptButton: (Actual) ${this.generateScriptButton.enabled} (Expected) ${buttonState.generateScriptButtonState}
		ApplyButton: (Actual) ${this.applyButton.enabled} (Expected) ${buttonState.applyButtonState}`);
	}
}
