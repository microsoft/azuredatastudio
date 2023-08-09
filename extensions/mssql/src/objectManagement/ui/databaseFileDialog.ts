/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { DefaultInputWidth, DialogBase } from '../../ui/dialogBase';
import * as localizedConstants from '../localizedConstants';
import { DatabaseFile, DatabaseViewInfo } from '../interfaces';
import { isUndefinedOrNull } from '../../types';
import { deepClone } from '../../util/objects';

export interface NewDatabaseFileDialogOptions {
	title: string;
	viewInfo: DatabaseViewInfo;
}

const defaultFileSizeInMb: number = 8
const defaultFileGrowthInMb: number = 64
const defaultFileGrowthInPercent: number = 10;
const defaultMaxFileSizeLimitedToInMb: number = 100;

export class DatabaseFileDialog extends DialogBase<DatabaseFile> {
	private result: DatabaseFile;
	private defaultNewDatabaseFile: DatabaseFile;
	private fileGroupDropdown: azdata.DropDownComponent;
	private fileGrowthGroup: azdata.GroupContainer;
	private enableAutoGrowthCheckbox: azdata.CheckBoxComponent;
	private inPercentAutogrowth: azdata.RadioButtonComponent;
	private inMegabytesAutogrowth: azdata.RadioButtonComponent;
	private autoFilegrowthInput: azdata.InputBoxComponent;
	private autogrowthInPercentValue: number;
	private autogrowthInMegabytesValue: number;
	private limitedToMbFileSize: azdata.RadioButtonComponent;
	private unlimitedFileSize: azdata.RadioButtonComponent;
	private limitedToMbFileSizeInput: azdata.InputBoxComponent;

	constructor(private readonly options: NewDatabaseFileDialogOptions) {
		super(options.title, 'DatabaseFileDialog');
		this.defaultNewDatabaseFile = {
			name: '',
			type: options.viewInfo.fileTypesOptions[0],
			path: '',
			fileGroup: options.viewInfo.fileGroupsOptions[0],
			fileNameWithExtension: '',
			sizeInMb: defaultFileSizeInMb,
			autoFileGrowth: defaultFileGrowthInMb,
			autoFileGrowthType: 'KB',
			maxSizeLimit: defaultMaxFileSizeLimitedToInMb
		}
	}

	protected override async initialize(): Promise<void> {
		let components: azdata.Component[] = [];
		this.dialogObject.okButton.enabled = false;
		this.autogrowthInPercentValue = defaultFileGrowthInPercent;
		this.autogrowthInMegabytesValue = defaultFileGrowthInMb;
		this.result = deepClone(this.defaultNewDatabaseFile);
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
			await this.UpdateOptionsForSelectedFileType(newValue);
			this.result.type = newValue;
		}, this.options.viewInfo.fileTypesOptions, this.options.viewInfo.fileTypesOptions[0], true, DefaultInputWidth);
		const fileTypeContainer = this.createLabelInputContainer(localizedConstants.FileTypeText, fileType);
		containers.push(fileTypeContainer);

		// Filegroup
		this.fileGroupDropdown = this.createDropdown(localizedConstants.FilegroupText, async (newValue) => {
			this.result.fileGroup = newValue;
		}, this.options.viewInfo.fileGroupsOptions, this.options.viewInfo.fileGroupsOptions[0], true, DefaultInputWidth);
		const sizeContainer = this.createLabelInputContainer(localizedConstants.FilegroupText, this.fileGroupDropdown);
		containers.push(sizeContainer);

		// File Size in MB
		const fileSize = this.createInputBox(localizedConstants.SizeInMbText, async (newValue) => {
			this.result.sizeInMb = Number(newValue);
		}, String(defaultFileSizeInMb), true, 'number', DefaultInputWidth);
		const fileSizeContainer = this.createLabelInputContainer(localizedConstants.SizeInMbText, fileSize);
		containers.push(fileSizeContainer);

		// Auto Growth and Max Size
		this.enableAutoGrowthCheckbox = this.createCheckbox(localizedConstants.EnableAutogrowthText, async (checked) => {
			this.inPercentAutogrowth.enabled = checked;
			this.inMegabytesAutogrowth.enabled = checked;
			this.autoFilegrowthInput.enabled = checked;
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

	private async UpdateOptionsForSelectedFileType(selectedOption: string): Promise<void> {
		// Row Data defaults
		let fileGroupDdOptions = this.options.viewInfo.fileGroupsOptions;
		let fileGroupDdValue = this.options.viewInfo.fileGroupsOptions[0];
		let visibility = 'visible';
		// Log
		if (selectedOption === this.options.viewInfo.fileTypesOptions[1]) {
			fileGroupDdOptions = [localizedConstants.FileGroupForLogTypeText];
			fileGroupDdValue = localizedConstants.FileGroupForLogTypeText;
		}
		// File Stream
		else if (selectedOption === this.options.viewInfo.fileTypesOptions[2]) {
			fileGroupDdOptions = [localizedConstants.FileGroupForFilestreamTypeText];
			fileGroupDdValue = localizedConstants.FileGroupForFilestreamTypeText;
			visibility = 'hidden';
		}

		// Update the propertie
		await this.fileGroupDropdown.updateProperties({
			values: fileGroupDdOptions, value: fileGroupDdValue
		});
		await this.enableAutoGrowthCheckbox.updateProperties({ 'visibility': visibility });
		await this.fileGrowthGroup.updateCssStyles({ 'visibility': visibility });
	}

	private InitializeAutogrowthSection(): azdata.GroupContainer {
		const radioGroupName = 'autogrowthRadioGroup';
		this.inPercentAutogrowth = this.createRadioButton(localizedConstants.InPercentAutogrowthText, radioGroupName, false, async (checked) => { await this.handleAutogrowthTypeChange(checked); });
		this.inMegabytesAutogrowth = this.createRadioButton(localizedConstants.InMegabytesAutogrowthText, radioGroupName, true, async (checked) => { await this.handleAutogrowthTypeChange(checked); });
		this.autoFilegrowthInput = this.createInputBox(localizedConstants.FileGrowthText, async (newValue) => {
			if (!isUndefinedOrNull(newValue) && newValue !== '') {
				if (this.inPercentAutogrowth.checked) {
					this.autogrowthInPercentValue = Number(newValue);
				} else if (this.inMegabytesAutogrowth.checked) {
					this.autogrowthInMegabytesValue = Number(newValue);
				}
			}
		}, String(defaultFileGrowthInMb), true, 'number', DefaultInputWidth - 10);
		const autogrowthContainer = this.createLabelInputContainer(localizedConstants.FileGrowthText, this.autoFilegrowthInput);

		this.fileGrowthGroup = this.createGroup('', [autogrowthContainer, this.inPercentAutogrowth, this.inMegabytesAutogrowth], false);
		return this.fileGrowthGroup;
	}

	private InitializeMaxFileSizeSection(): azdata.GroupContainer {
		const radioGroupName = 'maxFileSizeRadioGroup';
		this.limitedToMbFileSize = this.createRadioButton(localizedConstants.LimitedToMBFileSizeText, radioGroupName, false, async (checked) => { await this.handleMaxFileSizeTypeChange(checked); });
		this.unlimitedFileSize = this.createRadioButton(localizedConstants.UnlimitedFileSizeText, radioGroupName, true, async (checked) => { await this.handleMaxFileSizeTypeChange(checked); });
		this.limitedToMbFileSizeInput = this.createInputBox(localizedConstants.MaximumFileSizeText, async (newValue) => {
			this.result.maxSizeLimit = Number(newValue);
			if (this.unlimitedFileSize.checked) {
				this.result.maxSizeLimit = -1;
			}
		}, String(defaultMaxFileSizeLimitedToInMb), true, 'number', DefaultInputWidth - 10);
		const fileSizeContainer = this.createLabelInputContainer(localizedConstants.MaximumFileSizeText, this.limitedToMbFileSizeInput);

		return this.createGroup('', [fileSizeContainer, this.limitedToMbFileSize, this.unlimitedFileSize], false);
	}

	private async handleAutogrowthTypeChange(checked: boolean): Promise<void> {
		if (this.inPercentAutogrowth.checked) {
			this.autoFilegrowthInput.value = this.autogrowthInPercentValue?.toString();
		} else if (this.inMegabytesAutogrowth.checked) {
			this.autoFilegrowthInput.value = this.autogrowthInMegabytesValue?.toString();
		}
	}

	private async handleMaxFileSizeTypeChange(checked: boolean): Promise<void> {
		if (this.limitedToMbFileSize.checked) {
			this.limitedToMbFileSizeInput.enabled = true;
		} else if (this.unlimitedFileSize.checked) {
			this.limitedToMbFileSizeInput.enabled = false;
			this.result.maxSizeLimit = -1; //Unlimited
		}
	}

	public override async onFormFieldChange(): Promise<void> {
		this.dialogObject.okButton.enabled = JSON.stringify(this.result) !== JSON.stringify(this.defaultNewDatabaseFile);
	}

	protected override get dialogResult(): DatabaseFile | undefined {
		return this.result;
	}
}
