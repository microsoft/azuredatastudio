/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as mssql from '../../../mssql';
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
		extensionContext: vscode.ExtensionContext,
		view: azdata.ModelView) {
		super(apiWrapper, schemaCompareService, extensionContext, view);
	}

	// only for test
	public getComparisonResult(): mssql.SchemaCompareResult {
		return this.comparisonResult;
	}

	public verifyButtonsState(buttonState: ButtonState): boolean {
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
			return true;
		}

		console.log('CompareButton: (actual) ', this.compareButton.enabled, ', (expected)', buttonState.compareButtonState);
		console.log('OptionsButton: (actual) ', this.optionsButton.enabled, ', (expected)', buttonState.optionsButtonState);
		console.log('SwitchButton: (actual) ', this.switchButton.enabled, ', (expected)', buttonState.switchButtonState);
		console.log('OpenScmpButton: (actual) ', this.openScmpButton.enabled, ', (expected)', buttonState.openScmpButtonState);
		console.log('SaveScmpButton: (actual) ', this.saveScmpButton.enabled, ', (expected)', buttonState.saveScmpButtonState);
		console.log('CancelCompareButton: (actual) ', this.cancelCompareButton.enabled, ', (expected)', buttonState.cancelCompareButtonState);
		console.log('SelectSourceButton: (actual) ', this.selectSourceButton.enabled, ', (expected)', buttonState.selectSourceButtonState);
		console.log('SelectTargetButton: (actual) ', this.selectTargetButton.enabled, ', (expected)', buttonState.selectTargetButtonState);
		console.log('GenerateScriptButton: (actual) ', this.generateScriptButton.enabled, ', (expected)', buttonState.generateScriptButtonState);
		console.log('ApplyButton: (actual) ', this.applyButton.enabled, ', (expected)', buttonState.applyButtonState);

		return false;
	}
}
