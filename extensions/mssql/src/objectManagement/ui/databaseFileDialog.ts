/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as path from 'path';
import { DefaultInputWidth, DialogBase } from '../../ui/dialogBase';
import * as localizedConstants from '../localizedConstants';
import { DatabaseFile, DatabaseViewInfo, FileGrowthType } from '../interfaces';
import { isUndefinedOrNull } from '../../types';
import { deepClone } from '../../util/objects';
import { IObjectManagementService } from 'mssql';

export interface NewDatabaseFileDialogOptions {
	title: string;
	viewInfo: DatabaseViewInfo;
	files: DatabaseFile[];
	rowFilegroups: string[];
	filestreamFilegroups: string[];
	isNewFile: boolean;
	isEditingNewFile: boolean;
	databaseFile: DatabaseFile;
	defaultFileConstants: {
		defaultFileSizeInMb: number,
		defaultFileGrowthInPercent: number,
		defaultFileGrowthInMb: number,
		defaultMaxFileSizeLimitedToInMb: number
	};
	connectionUri: string;
}

const fileSizeInputMaxValueInMbForDataType = 16776192; // Row type supports up to 16 TB (SSMS allows =~ 15.99TB)
const fileSizeInputMaxValueInMbForLogType = 2 * 1024 * 1024; // Row type supports up to 2 TB
const fileSizeInputMaxValueInPercent = 100; // SSMS allows more than 100, but we are limiting to 100 in ADS

export class DatabaseFileDialog extends DialogBase<DatabaseFile> {
	private result: DatabaseFile;
	private fileSizeInput: azdata.InputBoxComponent;
	private fileNameWithExtension: azdata.InputBoxComponent;
	private fileGroupDropdown: azdata.DropDownComponent;
	private AutogrowthGroup: azdata.GroupContainer;
	private fileGrowthGroup: azdata.GroupContainer;
	private maxSizeGroup: azdata.GroupContainer;
	private pathContainer: azdata.FlexContainer;
	private enableAutoGrowthCheckbox: azdata.CheckBoxComponent;
	private inPercentAutogrowth: azdata.RadioButtonComponent;
	private inMegabytesAutogrowth: azdata.RadioButtonComponent;
	private autoFilegrowthInput: azdata.InputBoxComponent;
	private autogrowthInPercentValue: number;
	private autogrowthInMegabytesValue: number;
	private limitedToMbFileSize: azdata.RadioButtonComponent;
	private unlimitedFileSize: azdata.RadioButtonComponent;
	private limitedToMbFileSizeInput: azdata.InputBoxComponent;
	private fileSizeValue: number;
	protected filePathButton: azdata.ButtonComponent;
	protected filePathTextBox: azdata.InputBoxComponent;
	private originalName: string;
	private originalFileName: string;
	private isEditingFile: boolean;

	constructor(private readonly options: NewDatabaseFileDialogOptions, private readonly objectManagementService: IObjectManagementService) {
		super(options.title, 'DatabaseFileDialog');
	}

	protected override async initialize(): Promise<void> {
		this.dialogObject.okButton.enabled = false;
		this.autogrowthInPercentValue = this.options.defaultFileConstants.defaultFileGrowthInPercent;
		this.autogrowthInMegabytesValue = this.options.defaultFileConstants.defaultFileGrowthInMb;
		this.result = deepClone(this.options.databaseFile);
		this.originalName = this.options.databaseFile.name;
		this.originalFileName = this.options.databaseFile.fileNameWithExtension;
		this.isEditingFile = this.options.isNewFile || this.options.isEditingNewFile;
		await this.initializeAddDatabaseFileDialog();
	}

	/**
	 * Validates the file properties and returns an array of error messages
	 * @returns array of error messages if validation fails or empty array if validation succeeds
	 */
	protected override async validateInput(): Promise<string[]> {
		const errors = await super.validateInput();
		// Name validations
		if (this.result.name !== this.originalName) {
			// If adding a new file, can check if no exisiting file should have the same name
			// If editing a new file, modified name should not be matched in the collection, if length != 0 means some other file has the name already
			if ((this.options.isNewFile && !!this.options.files.find(file => { return file.name === this.result.name.trim() })) ||
				(this.options.isEditingNewFile && this.options.files.filter(file => { return file.name === this.result.name.trim() }).length !== 0)) {
				errors.push(localizedConstants.DuplicateLogicalNameError(this.result.name.trim()));
			}
			// If editing existing file, current name should not be same as any other existing file
			if (!this.options.isNewFile && !this.options.isEditingNewFile && !!this.options.files.find(file => { return this.result.id !== file.id && file.name === this.result.name.trim() })) {
				errors.push(localizedConstants.FileNameExistsError(this.result.name.trim()));
			}
			// If new file, verify if the file name with extension already exists
			if (this.options.isNewFile && !!this.options.files.find(file => {
				return (this.result.name === file.name &&
					path.join(file.path, file.fileNameWithExtension) === path.join(this.result.path, this.result.fileNameWithExtension))
			})) {
				errors.push(localizedConstants.FileAlreadyExistsError(path.join(this.result.path, this.result.fileNameWithExtension)));
			}
		}

		// If editing a new file and the file name with extension is modified, verify if the file name with extension already exists
		if (this.options.isEditingNewFile && this.result.fileNameWithExtension !== this.originalFileName) {
			if (this.options.files.filter(file => { return (path.join(file.path, file.fileNameWithExtension)) === (path.join(this.result.path, this.result.fileNameWithExtension)) }).length !== 0) {
				errors.push(localizedConstants.FileAlreadyExistsError(path.join(this.result.path, this.result.fileNameWithExtension)));
			}
		}

		// When maxsize is limited and size should not be greater than maxSize allowed
		if (this.result.maxSizeLimitInMb !== -1 && this.result.maxSizeLimitInMb < this.result.sizeInMb) {
			errors.push(localizedConstants.FileSizeLimitError);
		}
		// When maxsize is limited and fileGrowth should not be greater than maxSize allowed
		if (this.result.maxSizeLimitInMb !== -1 && this.result.autoFileGrowthType !== FileGrowthType.Percent
			&& this.result.maxSizeLimitInMb < this.result.autoFileGrowth) {
			errors.push(localizedConstants.FilegrowthLimitError);
		}
		return errors;
	}

	private async initializeAddDatabaseFileDialog(): Promise<void> {
		let containers: azdata.Component[] = [];
		// Logical Name of the file
		const logicalname = this.createInputBox(async (newValue) => {
			if (newValue.trim() !== '') {
				this.result.name = newValue.trim();
				this.fileNameWithExtension.value = this.generateFileNameWithExtension();
			}
		}, {
			ariaLabel: localizedConstants.LogicalNameText,
			inputType: 'text',
			enabled: true,
			value: this.options.databaseFile.name,
			required: true
		});
		const filenameContainer = this.createLabelInputContainer(localizedConstants.LogicalNameText, logicalname);
		containers.push(filenameContainer);

		// File Type
		const fileType = this.createDropdown(localizedConstants.FileTypeText, async (newValue) => {
			await this.updateOptionsForSelectedFileType(newValue);
			this.result.type = newValue;
			this.fileNameWithExtension.value = this.generateFileNameWithExtension();
		}, this.options.viewInfo.fileTypesOptions, this.result.type, this.isEditingFile, DefaultInputWidth);
		const fileTypeContainer = this.createLabelInputContainer(localizedConstants.FileTypeText, fileType);
		containers.push(fileTypeContainer);

		// Filegroup
		this.fileGroupDropdown = this.createDropdown(localizedConstants.FilegroupText, async (newValue) => {
			this.result.fileGroup = newValue;
		}, this.options.rowFilegroups, this.options.databaseFile.fileGroup, this.isEditingFile, DefaultInputWidth);
		const sizeContainer = this.createLabelInputContainer(localizedConstants.FilegroupText, this.fileGroupDropdown);
		containers.push(sizeContainer);

		// File Size in MB
		this.fileSizeInput = this.createInputBox(async (newValue) => {
			this.result.sizeInMb = Number(newValue);
		}, {
			ariaLabel: localizedConstants.SizeInMbText,
			inputType: 'number',
			enabled: this.options.databaseFile.type !== localizedConstants.FilestreamFileType,
			value: String(this.options.databaseFile.sizeInMb),
			min: 1
		});
		const fileSizeContainer = this.createLabelInputContainer(localizedConstants.SizeInMbText, this.fileSizeInput);
		containers.push(fileSizeContainer);

		// Auto Growth and Max Size
		containers.push(await this.initializeAutogrowthSection());

		// Path
		this.filePathTextBox = this.createInputBox(async (newValue) => {
			this.result.path = newValue;
		}, {
			ariaLabel: localizedConstants.PathText,
			inputType: 'text',
			enabled: this.isEditingFile,
			value: this.options.databaseFile.path,
			width: DefaultInputWidth - 30
		});
		this.filePathButton = this.createButton('...', localizedConstants.BrowseFilesLabel, async () => { await this.createFileBrowser() }, this.options.isNewFile);
		this.filePathButton.width = 25;
		this.pathContainer = this.createLabelInputContainer(localizedConstants.PathText, this.filePathTextBox);
		this.pathContainer.addItems([this.filePathButton], { flex: '10 0 auto' });
		containers.push(this.pathContainer);

		// File Name
		let fileNameEnabled = this.isEditingFile;
		if (fileNameEnabled) {
			fileNameEnabled = !(this.result.type === localizedConstants.FilestreamFileType);
		}
		this.fileNameWithExtension = this.createInputBox(async (newValue) => {
			this.result.fileNameWithExtension = newValue;
		}, {
			ariaLabel: localizedConstants.FileNameText,
			inputType: 'text',
			enabled: fileNameEnabled, // false for edit old file and for filestream type
			value: this.options.databaseFile.fileNameWithExtension,
			width: DefaultInputWidth
		});
		const fileNameWithExtensionContainer = this.createLabelInputContainer(localizedConstants.FileNameText, this.fileNameWithExtension);
		containers.push(fileNameWithExtensionContainer);

		this.formContainer.addItems(containers);
	}

	/**
	 * Initialized file growth and max file size sections
	 * @returns a group container with 'auto file growth' options
	 */
	private async initializeAutogrowthSection(): Promise<azdata.GroupContainer> {
		// Autogrowth checkbox
		this.enableAutoGrowthCheckbox = this.createCheckbox(localizedConstants.EnableAutogrowthText, async (checked) => {
			this.inPercentAutogrowth.enabled
				= this.inMegabytesAutogrowth.enabled
				= this.autoFilegrowthInput.enabled
				= this.limitedToMbFileSize.enabled
				= this.unlimitedFileSize.enabled
				= this.result.isAutoGrowthEnabled = checked;
			this.limitedToMbFileSizeInput.enabled = checked && this.limitedToMbFileSize.checked;
		}, true, true);

		// Autogrowth radio button and input section
		let radioGroupName = 'autogrowthRadioGroup';
		const isFileAutoGrowthInKB = this.options.databaseFile.autoFileGrowthType === FileGrowthType.KB;
		this.inPercentAutogrowth = this.createRadioButton(localizedConstants.InPercentAutogrowthText, radioGroupName, !isFileAutoGrowthInKB, async (checked) => { await this.handleAutogrowthTypeChange(checked); });
		this.inMegabytesAutogrowth = this.createRadioButton(localizedConstants.InMegabytesAutogrowthText, radioGroupName, isFileAutoGrowthInKB, async (checked) => { await this.handleAutogrowthTypeChange(checked); });
		this.autoFilegrowthInput = this.createInputBox(async (newValue) => {
			if (!isUndefinedOrNull(newValue) && newValue !== '') {
				if (this.inPercentAutogrowth.checked) {
					this.autogrowthInPercentValue = Number(newValue);
				} else {
					this.autogrowthInMegabytesValue = Number(newValue);
				}
				this.result.autoFileGrowth = this.inPercentAutogrowth.checked ? this.autogrowthInPercentValue : this.autogrowthInMegabytesValue;
			}
		}, {
			ariaLabel: localizedConstants.FileGrowthText,
			inputType: 'number',
			enabled: true,
			value: String(this.options.databaseFile.autoFileGrowth),
			width: DefaultInputWidth - 10,
			min: 1
		});
		const autogrowthContainer = this.createLabelInputContainer(localizedConstants.FileGrowthText, this.autoFilegrowthInput);
		this.fileGrowthGroup = this.createGroup('', [this.enableAutoGrowthCheckbox
			, autogrowthContainer, this.inPercentAutogrowth, this.inMegabytesAutogrowth], true);
		await this.fileGrowthGroup.updateCssStyles({ 'margin': '10px 0px -10px -10px' });

		// Autogrowth radio button and input section
		radioGroupName = 'maxFileSizeRadioGroup';
		const isFileSizeLimited = this.options.isNewFile ? false : this.options.databaseFile.maxSizeLimitInMb !== -1;
		this.limitedToMbFileSize = this.createRadioButton(localizedConstants.LimitedToMBFileSizeText, radioGroupName, isFileSizeLimited, async (checked) => { await this.handleMaxFileSizeTypeChange(checked); });
		this.unlimitedFileSize = this.createRadioButton(localizedConstants.UnlimitedFileSizeText, radioGroupName, !isFileSizeLimited, async (checked) => { await this.handleMaxFileSizeTypeChange(checked); });
		this.limitedToMbFileSizeInput = this.createInputBox(async (newValue) => {
			this.fileSizeValue = Number(newValue);
			this.result.maxSizeLimitInMb = this.fileSizeValue;
			if (this.unlimitedFileSize.checked) {
				this.result.maxSizeLimitInMb = -1;
			}
		}, {
			ariaLabel: localizedConstants.MaximumFileSizeText,
			inputType: 'number',
			enabled: true,
			value: this.options.databaseFile.maxSizeLimitInMb === -1 ? String(this.options.defaultFileConstants.defaultMaxFileSizeLimitedToInMb) : String(this.options.databaseFile.maxSizeLimitInMb),
			width: DefaultInputWidth - 10,
			min: 1,
			max: this.options.databaseFile.type === localizedConstants.LogFiletype ? fileSizeInputMaxValueInMbForLogType : fileSizeInputMaxValueInMbForDataType
		});
		const fileSizeContainer = this.createLabelInputContainer(localizedConstants.MaximumFileSizeText, this.limitedToMbFileSizeInput);
		this.maxSizeGroup = this.createGroup('', [fileSizeContainer, this.limitedToMbFileSize, this.unlimitedFileSize], true);
		await this.maxSizeGroup.updateCssStyles({ 'margin': '10px 0px -10px -10px' });

		this.AutogrowthGroup = this.createGroup(localizedConstants.AutogrowthMaxsizeText, [this.fileGrowthGroup, this.maxSizeGroup], false);
		return this.AutogrowthGroup;
	}

	private async handleAutogrowthTypeChange(checked: boolean): Promise<void> {
		this.autoFilegrowthInput.value = this.options.isNewFile ? (this.inPercentAutogrowth.checked ? this.autogrowthInPercentValue?.toString() : this.autogrowthInMegabytesValue?.toString()) : this.options.databaseFile.autoFileGrowth?.toString();
		this.autoFilegrowthInput.max = this.inPercentAutogrowth.checked ? fileSizeInputMaxValueInPercent : (this.result.type === localizedConstants.LogFiletype ? fileSizeInputMaxValueInMbForLogType / 2 : fileSizeInputMaxValueInMbForDataType / 2);
		this.result.autoFileGrowthType = this.inPercentAutogrowth.checked ? FileGrowthType.Percent : FileGrowthType.KB;
	}

	private async handleMaxFileSizeTypeChange(checked: boolean): Promise<void> {
		if (this.limitedToMbFileSize.checked) {
			this.limitedToMbFileSizeInput.enabled = true;
			this.result.maxSizeLimitInMb = this.fileSizeValue;
		} else if (this.unlimitedFileSize.checked) {
			this.limitedToMbFileSizeInput.enabled = false;
			this.result.maxSizeLimitInMb = -1; //Unlimited
		}
	}

	/**
	 * Creates a file browser and sets the path to the filePath
	 */
	private async createFileBrowser(): Promise<void> {
		let dataFolder = await this.objectManagementService.getDataFolder(this.options.connectionUri);
		let filePath = await azdata.window.openServerFileBrowserDialog(this.options.connectionUri, dataFolder, [{ label: localizedConstants.allFiles, filters: ['*'] }], true);
		if (filePath?.length > 0) {
			this.filePathTextBox.value = filePath;
			this.result.path = filePath;
		}
	}

	/**
	 * Toggles fileGroup dropdown options and visibility of the autogrowth file group section based on the selected file type
	 * @param selectedOption the selected option from the fileType dropdown
	 */
	private async updateOptionsForSelectedFileType(selectedOption: string): Promise<void> {
		// Row Data defaults
		let fileGroupDdOptions = this.options.rowFilegroups;
		let fileGroupDdValue = this.result.fileGroup;
		let visibility = 'visible';
		let maxSizeGroupMarginTop = '0px';
		let pathContainerMarginTop = '0px';
		let enableInputs = true;
		let fileSizeInputMaxValue = fileSizeInputMaxValueInMbForDataType;
		// Log
		if (selectedOption === localizedConstants.LogFiletype) {
			fileGroupDdOptions = [localizedConstants.FileGroupForLogTypeText];
			fileGroupDdValue = localizedConstants.FileGroupForLogTypeText;
			fileSizeInputMaxValue = fileSizeInputMaxValueInMbForLogType;
		}
		// File Stream
		else if (selectedOption === localizedConstants.FilestreamFileType) {
			fileGroupDdOptions = this.options.filestreamFilegroups.length > 0 ? this.options.filestreamFilegroups : [localizedConstants.FileGroupForFilestreamTypeText];
			fileGroupDdValue = this.result.fileGroup;
			visibility = 'hidden';
			maxSizeGroupMarginTop = '-130px';
			pathContainerMarginTop = '-35px';
			enableInputs = false;
			this.fileNameWithExtension.value = '';
		}

		// Update the propertie
		await this.fileGroupDropdown.updateProperties({
			values: fileGroupDdOptions, value: fileGroupDdValue
		});
		await this.fileGrowthGroup.updateCssStyles({ 'visibility': visibility });
		await this.maxSizeGroup.updateCssStyles({ 'margin-top': maxSizeGroupMarginTop });
		await this.pathContainer.updateCssStyles({ 'margin-top': pathContainerMarginTop });
		this.fileNameWithExtension.enabled = this.fileSizeInput.enabled = this.isEditingFile && enableInputs;
		this.autoFilegrowthInput.max = this.inPercentAutogrowth.checked ? fileSizeInputMaxValueInPercent : fileSizeInputMaxValue / 2;
		this.fileSizeInput.max = fileSizeInputMaxValue;
	}

	/**
	 * Generates the file name with extension on logical name update
	 */
	private generateFileNameWithExtension(): string {
		let fileNameWithExtenstion = this.result.fileNameWithExtension;
		// if new file, then update the generate the fileNameWithExtenison
		if (this.result.name !== '' && this.options.isNewFile) {
			switch (this.result.type) {
				case localizedConstants.RowsDataFileType:
					fileNameWithExtenstion = this.result.name + '.ndf';
					break;
				case localizedConstants.LogFiletype:
					fileNameWithExtenstion = this.result.name + '.ldf';
					break;
				case localizedConstants.FilestreamFileType:
					fileNameWithExtenstion = '';
					break;
			}
		}
		return fileNameWithExtenstion;
	}


	public override async onFormFieldChange(): Promise<void> {
		this.dialogObject.okButton.enabled = JSON.stringify(this.result) !== JSON.stringify(this.options.databaseFile);
	}

	protected override get dialogResult(): DatabaseFile | undefined {
		return this.result;
	}
}
