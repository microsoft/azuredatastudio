/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as mssql from 'mssql';
import { DefaultInputWidth, DialogBase } from '../../ui/dialogBase';
import * as localizedConstants from '../localizedConstants';
import { DatabaseFile } from '../interfaces';

export interface NewDatabaseFileDialogOptions {
	objectTypes: DatabaseFile[];
	contextId: string;
	title: string;
}

export interface DatabaseFileDialogResult {
	newDatabaseFile: DatabaseFile[];
}

export class DatabaseFileDialog extends DialogBase<DatabaseFileDialogResult> {
	private result: DatabaseFileDialogResult;
	private newDatabaseFile: DatabaseFile;
	private newEnableAutogrowthCheckbox: boolean;
	private inPercentAutogrowth: azdata.RadioButtonComponent;
	private inMegabytesAutogrowth: azdata.RadioButtonComponent;
	private autogrowthInput: azdata.InputBoxComponent;
	private limitedToMbFileSize: azdata.RadioButtonComponent;
	private unlimitedFileSize: azdata.RadioButtonComponent;
	private limitedToMbFileSizeInput: azdata.InputBoxComponent;

	constructor(private readonly objectManagementService: mssql.IObjectManagementService, private readonly options: NewDatabaseFileDialogOptions) {
		super(options.title, 'DatabaseFileDialog');
		this.result = {
			newDatabaseFile: []
		};
	}

	protected override async initialize(): Promise<void> {
		let components: azdata.Component[] = [];
		components.push(this.InitializeAddDatabaseFileDialog());
		this.formContainer.addItems(components);
	}

	private InitializeAddDatabaseFileDialog(): azdata.GroupContainer {
		let containers: azdata.Component[] = [];
		// Logical Name of the file
		const filename = this.createInputBox(localizedConstants.LogicalNameText, async (newValue) => {
			this.newDatabaseFile.name = newValue;
		}, '', true, 'text', DefaultInputWidth, true, 0);
		const filenameContainer = this.createLabelInputContainer(localizedConstants.LogicalNameText, filename);
		containers.push(filenameContainer);

		// File Type
		const fileType = this.createDropdown(localizedConstants.FileTypeText, async (newValue) => {
			this.newDatabaseFile.type = newValue;
		}, [], '', true, DefaultInputWidth);
		const fileTypeContainer = this.createLabelInputContainer(localizedConstants.FileTypeText, fileType);
		containers.push(fileTypeContainer);

		// Filegroup
		const size = this.createDropdown(localizedConstants.FilegroupText, async (newValue) => {
			this.newDatabaseFile.fileGroup = newValue;
		}, [], '', true, DefaultInputWidth);
		const sizeContainer = this.createLabelInputContainer(localizedConstants.FilegroupText, size);
		containers.push(sizeContainer);

		// File Size in MB
		const fileSize = this.createInputBox(localizedConstants.SizeInMbText, async (newValue) => {
			this.newDatabaseFile.sizeInMb = Number(newValue);
		}, '', true, 'number', DefaultInputWidth);
		const fileSizeContainer = this.createLabelInputContainer(localizedConstants.SizeInMbText, fileSize);
		containers.push(fileSizeContainer);

		// Auto Growth and Max Size
		const enableAutoGrowthCheckbox = this.createCheckbox(localizedConstants.EnableAutogrowthText, async (checked) => {
			this.newEnableAutogrowthCheckbox = checked;
		}, true, true);
		const autogrowthContainer = this.createGroup(localizedConstants.AutogrowthMaxsizeText, [enableAutoGrowthCheckbox, this.InitializeAutogrowthSection(), this.InitializeMaxFileSizeSection()], true, false);
		containers.push(autogrowthContainer);

		// Path
		const path = this.createInputBox(localizedConstants.PathText, async (newValue) => {
			this.newDatabaseFile.path = newValue;
		}, '', true, 'text', DefaultInputWidth, true, 0);
		const pathContainer = this.createLabelInputContainer(localizedConstants.PathText, path);
		containers.push(pathContainer);

		// File Name
		const fileNameWithExtension = this.createInputBox(localizedConstants.FileNameText, async (newValue) => {
			this.newDatabaseFile.name = newValue;
		}, '', true, 'text', DefaultInputWidth, true, 0);
		const fileNameWithExtensionContainer = this.createLabelInputContainer(localizedConstants.FileNameText, fileNameWithExtension);
		containers.push(fileNameWithExtensionContainer);

		return this.createGroup('', containers, false);
	}

	private InitializeAutogrowthSection(): azdata.GroupContainer {
		const radioGroupName = 'autogrowthRadioGroup';
		this.inPercentAutogrowth = this.createRadioButton(localizedConstants.InPercentAutogrowthText, radioGroupName, true, async (checked) => { await this.handleAutogrowthTypeChange(checked); });
		this.inMegabytesAutogrowth = this.createRadioButton(localizedConstants.InMegabytesAutogrowthText, radioGroupName, false, async (checked) => { await this.handleAutogrowthTypeChange(checked); });
		this.autogrowthInput = this.createInputBox(localizedConstants.FileGrowthText, async (newValue) => {
			// this.newDatabaseFile.sizeInMb = Number(newValue);
		}, '', true, 'number', DefaultInputWidth);
		const autogrowthContainer = this.createLabelInputContainer(localizedConstants.FileGrowthText, this.autogrowthInput);

		return this.createGroup('', [autogrowthContainer, this.inPercentAutogrowth, this.inMegabytesAutogrowth], false);
	}

	private InitializeMaxFileSizeSection(): azdata.GroupContainer {
		const radioGroupName = 'maxFileSizeRadioGroup';
		this.limitedToMbFileSize = this.createRadioButton(localizedConstants.LimitedToMBFileSizeText, radioGroupName, true, async (checked) => { await this.handleMaxFileSizeTypeChange(checked); });
		this.unlimitedFileSize = this.createRadioButton(localizedConstants.UnlimitedFileSizeText, radioGroupName, false, async (checked) => { await this.handleMaxFileSizeTypeChange(checked); });
		this.limitedToMbFileSizeInput = this.createInputBox(localizedConstants.MaximumFileSizeText, async (newValue) => {
			//  this.newDatabaseFile.sizeInMb = Number(newValue);
		}, '', true, 'number', DefaultInputWidth);
		const fileSizeContainer = this.createLabelInputContainer(localizedConstants.MaximumFileSizeText, this.limitedToMbFileSizeInput);

		return this.createGroup('', [fileSizeContainer, this.limitedToMbFileSize, this.unlimitedFileSize], false);
	}

	private async handleAutogrowthTypeChange(checked: boolean): Promise<void> {
		// if (this.inPercentAutogrowth.checked) {
		// 	method = ObjectSelectionMethod.AllObjectsOfTypes;
		// 	showSchema = false;
		// 	showObjectTypes = true;
		// } else if (this.inMegabytesAutogrowth.checked) {
		// 	method = ObjectSelectionMethod.AllObjectsOfSchema;
		// 	showSchema = true;
		// 	showObjectTypes = false;
		// }
		// this.result.method = method;
	}

	private async handleMaxFileSizeTypeChange(checked: boolean): Promise<void> {
		// let showSchema = false;
		// let showObjectTypes = false;
		// await this.setComponentsVisibility(showObjectTypes, showSchema);
		// if (this.inPercentAutogrowth.checked) {
		// 	method = ObjectSelectionMethod.AllObjectsOfTypes;
		// 	showSchema = false;
		// 	showObjectTypes = true;
		// } else if (this.inMegabytesAutogrowth.checked) {
		// 	method = ObjectSelectionMethod.AllObjectsOfSchema;
		// 	showSchema = true;
		// 	showObjectTypes = false;
		// }
		// this.result.method = method;
		// await this.setComponentsVisibility(showObjectTypes, showSchema);
	}
}
