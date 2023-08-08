/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { DefaultInputWidth, DialogBase } from '../../ui/dialogBase';
import * as localizedConstants from '../localizedConstants';
import { DatabaseFile, DatabaseViewInfo } from '../interfaces';

export interface NewDatabaseFileDialogOptions {
	title: string;
	viewInfo: DatabaseViewInfo;
}

const defaultNewFileData: DatabaseFile = {
	name: '',
	type: 'Rows Data',
	fileGroup: 'PRIMARY',
	sizeInMb: 8,
	autoGrowthAndMaxSizeInMb: 'By 64 MB, Unlimited',
	path: '',
	fileNameWithExtension: ''
}

export class DatabaseFileDialog extends DialogBase<DatabaseFile> {
	private result: DatabaseFile;
	private enableAutoGrowthCheckbox: azdata.CheckBoxComponent;
	private inPercentAutogrowth: azdata.RadioButtonComponent;
	private inMegabytesAutogrowth: azdata.RadioButtonComponent;
	private autogrowthInput: azdata.InputBoxComponent;
	private autogrowthInPercentValue: number;
	private autogrowthInMegabytesValue: number;
	private limitedToMbFileSize: azdata.RadioButtonComponent;
	private unlimitedFileSize: azdata.RadioButtonComponent;
	private limitedToMbFileSizeInput: azdata.InputBoxComponent;

	constructor(private readonly options: NewDatabaseFileDialogOptions) {
		super(options.title, 'DatabaseFileDialog');
		this.result = { ...defaultNewFileData };
	}

	protected override async initialize(): Promise<void> {
		let components: azdata.Component[] = [];
		this.dialogObject.okButton.enabled = false;
		components.push(this.InitializeAddDatabaseFileDialog());
		this.formContainer.addItems(components);
	}

	private InitializeAddDatabaseFileDialog(): azdata.GroupContainer {
		let containers: azdata.Component[] = [];
		// Logical Name of the file
		const filename = this.createInputBox(localizedConstants.LogicalNameText, async (newValue) => {
			this.result.name = newValue;
		}, '', true, 'text', DefaultInputWidth, true);
		const filenameContainer = this.createLabelInputContainer(localizedConstants.LogicalNameText, filename);
		containers.push(filenameContainer);

		// File Type
		const fileType = this.createDropdown(localizedConstants.FileTypeText, async (newValue) => {
			this.result.type = newValue;
		}, this.options.viewInfo.fileTypesOptions, this.options.viewInfo.fileTypesOptions[0], true, DefaultInputWidth);
		const fileTypeContainer = this.createLabelInputContainer(localizedConstants.FileTypeText, fileType);
		containers.push(fileTypeContainer);

		// Filegroup
		const fileGroup = this.createDropdown(localizedConstants.FilegroupText, async (newValue) => {
			this.result.fileGroup = newValue;
		}, this.options.viewInfo.fileGroupsOptions, this.options.viewInfo.fileGroupsOptions[0], true, DefaultInputWidth);
		const sizeContainer = this.createLabelInputContainer(localizedConstants.FilegroupText, fileGroup);
		containers.push(sizeContainer);

		// // File Size in MB
		const fileSize = this.createInputBox(localizedConstants.SizeInMbText, async (newValue) => {
			this.result.sizeInMb = Number(newValue);
		}, '', true, 'number', DefaultInputWidth);
		const fileSizeContainer = this.createLabelInputContainer(localizedConstants.SizeInMbText, fileSize);
		containers.push(fileSizeContainer);

		// Auto Growth and Max Size
		this.enableAutoGrowthCheckbox = this.createCheckbox(localizedConstants.EnableAutogrowthText, async (checked) => {
			this.inPercentAutogrowth.enabled = checked;
			this.inMegabytesAutogrowth.enabled = checked;
			this.autogrowthInput.enabled = checked;
			this.limitedToMbFileSize.enabled = checked;
			this.unlimitedFileSize.enabled = checked;
			this.limitedToMbFileSizeInput.enabled = checked;
		}, true, true);
		const autogrowthContainer = this.createGroup(localizedConstants.AutogrowthMaxsizeText, [this.enableAutoGrowthCheckbox, this.InitializeAutogrowthSection(), this.InitializeMaxFileSizeSection()], true, false);
		containers.push(autogrowthContainer);

		// // Path
		// const path = this.createInputBox(localizedConstants.PathText, async (newValue) => {
		// 	this.result.path = newValue;
		// }, '', true, 'text', DefaultInputWidth, true);
		// const pathContainer = this.createLabelInputContainer(localizedConstants.PathText, path);
		// containers.push(pathContainer);

		// // File Name
		// const fileNameWithExtension = this.createInputBox(localizedConstants.FileNameText, async (newValue) => {
		// 	this.result.fileNameWithExtension = newValue;
		// }, '', true, 'text', DefaultInputWidth, true);
		// const fileNameWithExtensionContainer = this.createLabelInputContainer(localizedConstants.FileNameText, fileNameWithExtension);
		// containers.push(fileNameWithExtensionContainer);

		return this.createGroup('', containers, false);
	}

	private InitializeAutogrowthSection(): azdata.GroupContainer {
		const radioGroupName = 'autogrowthRadioGroup';
		this.inPercentAutogrowth = this.createRadioButton(localizedConstants.InPercentAutogrowthText, radioGroupName, true, async (checked) => { await this.handleAutogrowthTypeChange(checked); });
		this.inMegabytesAutogrowth = this.createRadioButton(localizedConstants.InMegabytesAutogrowthText, radioGroupName, false, async (checked) => { await this.handleAutogrowthTypeChange(checked); });
		this.autogrowthInput = this.createInputBox(localizedConstants.FileGrowthText, async (newValue) => {
			if (this.inPercentAutogrowth.checked) {
				this.autogrowthInPercentValue = Number(newValue);
			} else if (this.inMegabytesAutogrowth.checked) {
				this.autogrowthInMegabytesValue = Number(newValue);
			}
		}, '', true, 'number', DefaultInputWidth - 10);
		const autogrowthContainer = this.createLabelInputContainer(localizedConstants.FileGrowthText, this.autogrowthInput);

		return this.createGroup('', [autogrowthContainer, this.inPercentAutogrowth, this.inMegabytesAutogrowth], false);
	}

	private InitializeMaxFileSizeSection(): azdata.GroupContainer {
		const radioGroupName = 'maxFileSizeRadioGroup';
		this.limitedToMbFileSize = this.createRadioButton(localizedConstants.LimitedToMBFileSizeText, radioGroupName, true, async (checked) => { await this.handleMaxFileSizeTypeChange(checked); });
		this.unlimitedFileSize = this.createRadioButton(localizedConstants.UnlimitedFileSizeText, radioGroupName, false, async (checked) => { await this.handleMaxFileSizeTypeChange(checked); });
		this.limitedToMbFileSizeInput = this.createInputBox(localizedConstants.MaximumFileSizeText, async (newValue) => {
			this.limitedToMbFileSizeInput.value = String(newValue);
		}, '', true, 'number', DefaultInputWidth - 10);
		const fileSizeContainer = this.createLabelInputContainer(localizedConstants.MaximumFileSizeText, this.limitedToMbFileSizeInput);

		return this.createGroup('', [fileSizeContainer, this.limitedToMbFileSize, this.unlimitedFileSize], false);
	}

	private async handleAutogrowthTypeChange(checked: boolean): Promise<void> {
		if (this.inPercentAutogrowth.checked) {
			this.autogrowthInput.value = this.autogrowthInPercentValue?.toString();
		} else if (this.inMegabytesAutogrowth.checked) {
			this.autogrowthInput.value = this.autogrowthInMegabytesValue?.toString();
		}
	}

	private async handleMaxFileSizeTypeChange(checked: boolean): Promise<void> {
		if (this.limitedToMbFileSize.checked) {
			this.limitedToMbFileSizeInput.enabled = true;
		} else if (this.unlimitedFileSize.checked) {
			this.limitedToMbFileSizeInput.enabled = false;
		}
	}


	public override async onFormFieldChange(): Promise<void> {
		this.dialogObject.okButton.enabled = JSON.stringify(this.result) !== JSON.stringify(defaultNewFileData);
	}

	protected override get dialogResult(): DatabaseFile | undefined {
		this.result.autoGrowthAndMaxSizeInMb = !this.enableAutoGrowthCheckbox.checked ? localizedConstants.NoneText :
			localizedConstants.AutoGrowthValueStringGenerator(this.autogrowthInput.value, this.inPercentAutogrowth.checked, this.limitedToMbFileSizeInput.value, this.limitedToMbFileSize.checked)

		return this.result;
	}
}
