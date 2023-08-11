/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { DefaultInputWidth, DialogBase } from '../../ui/dialogBase';
import * as localizedConstants from '../localizedConstants';
import { DatabaseFile, DatabaseViewInfo } from '../interfaces';
import { isUndefinedOrNull } from '../../types';
import { deepClone } from '../../util/objects';

export interface NewDatabaseFileDialogOptions {
	title: string;
	viewInfo: DatabaseViewInfo;
	files: DatabaseFile[];
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
	protected filePathButton: azdata.ButtonComponent;
	protected filePathTextBox: azdata.InputBoxComponent;

	constructor(private readonly options: NewDatabaseFileDialogOptions) {
		super(options.title, 'DatabaseFileDialog');
		this.defaultNewDatabaseFile = {
			id: undefined,
			name: '',
			type: options.viewInfo.fileTypesOptions[0],
			path: options.files[0].path,
			fileGroup: options.viewInfo.rowDataFileGroupsOptions[0],
			fileNameWithExtension: '',
			sizeInMb: defaultFileSizeInMb,
			isAutoGrowthEnabled: true,
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

	/**
	 * Validates the file properties and returns an array of error messages
	 * @returns array of error messages if validation fails or empty array if validation succeeds
	 */
	protected override async validateInput(): Promise<string[]> {
		const errors = await super.validateInput();
		// name should not be duplicate
		if (!!this.options.files.find(file => { return file.name === this.result.name.trim() })) {
			errors.push(localizedConstants.DuplicateLogicalNameError(this.result.name.trim()));
		}
		// when maxsize is limited and size should not be greater than maxSize allowed
		if (this.result.maxSizeLimit !== -1 && this.result.maxSizeLimit < this.result.sizeInMb) {
			errors.push(localizedConstants.FileSizeLimitError);
		}
		// when maxsize is limited and fileGrowth should not be greater than maxSize allowed
		if (this.result.maxSizeLimit !== -1 && this.result.autoFileGrowthType !== localizedConstants.PercentText
			&& this.result.maxSizeLimit < this.result.autoFileGrowth) {
			errors.push(localizedConstants.FilegrowthLimitError);
		}
		return errors;
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
			await this.updateOptionsForSelectedFileType(newValue);
			this.result.type = newValue;
		}, this.options.viewInfo.fileTypesOptions, this.options.viewInfo.fileTypesOptions[0], true, DefaultInputWidth);
		const fileTypeContainer = this.createLabelInputContainer(localizedConstants.FileTypeText, fileType);
		containers.push(fileTypeContainer);

		// Filegroup
		this.fileGroupDropdown = this.createDropdown(localizedConstants.FilegroupText, async (newValue) => {
			this.result.fileGroup = newValue;
		}, this.options.viewInfo.rowDataFileGroupsOptions, this.options.viewInfo.rowDataFileGroupsOptions[0], true, DefaultInputWidth);
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
			this.inPercentAutogrowth.enabled
				= this.inMegabytesAutogrowth.enabled
				= this.autoFilegrowthInput.enabled
				= this.limitedToMbFileSize.enabled
				= this.limitedToMbFileSizeInput.enabled
				= this.unlimitedFileSize.enabled
				= this.result.isAutoGrowthEnabled = checked;
		}, true, true);
		const autogrowthContainer = this.createGroup(localizedConstants.AutogrowthMaxsizeText, [this.enableAutoGrowthCheckbox, this.InitializeAutogrowthSection(), this.InitializeMaxFileSizeSection()], true, false);
		containers.push(autogrowthContainer);

		// Path
		this.filePathTextBox = this.createInputBox(localizedConstants.PathText, async (newValue) => {
			this.result.path = newValue;
		}, this.defaultNewDatabaseFile.path, true, 'text', DefaultInputWidth - 30, true);
		this.filePathButton = this.createButton('...', '...', async () => { await this.createFileBrowser() });
		this.filePathButton.width = 25;
		this.pathContainer = this.createLabelInputContainer(localizedConstants.PathText, this.filePathTextBox);
		this.pathContainer.addItems([this.filePathButton], { flex: '10 0 auto' });
		containers.push(this.pathContainer);

		// File Name
		const fileNameWithExtension = this.createInputBox(localizedConstants.FileNameText, async (newValue) => {
			this.result.fileNameWithExtension = newValue;
		}, '', true, 'text', DefaultInputWidth);
		const fileNameWithExtensionContainer = this.createLabelInputContainer(localizedConstants.FileNameText, fileNameWithExtension);
		containers.push(fileNameWithExtensionContainer);

		return this.createGroup('', containers, false);
	}

	/**
	 * Initialized file growth section
	 * @returns a group container with 'auto file growth' options
	 */
	private InitializeAutogrowthSection(): azdata.GroupContainer {
		const radioGroupName = 'autogrowthRadioGroup';
		this.inPercentAutogrowth = this.createRadioButton(localizedConstants.InPercentAutogrowthText, radioGroupName, false, async (checked) => { await this.handleAutogrowthTypeChange(checked); });
		this.inMegabytesAutogrowth = this.createRadioButton(localizedConstants.InMegabytesAutogrowthText, radioGroupName, true, async (checked) => { await this.handleAutogrowthTypeChange(checked); });
		this.autoFilegrowthInput = this.createInputBox(localizedConstants.FileGrowthText, async (newValue) => {
			if (!isUndefinedOrNull(newValue) && newValue !== '') {
				if (this.inPercentAutogrowth.checked) {
					this.autogrowthInPercentValue = Number(newValue);
				} else {
					this.autogrowthInMegabytesValue = Number(newValue);
				}
				this.result.autoFileGrowth = this.inPercentAutogrowth.checked ? this.autogrowthInPercentValue : this.autogrowthInMegabytesValue;
			}
		}, String(defaultFileGrowthInMb), true, 'number', DefaultInputWidth - 20);
		const autogrowthContainer = this.createLabelInputContainer(localizedConstants.FileGrowthText, this.autoFilegrowthInput);

		this.fileGrowthGroup = this.createGroup('', [autogrowthContainer, this.inPercentAutogrowth, this.inMegabytesAutogrowth], false);
		return this.fileGrowthGroup;
	}

	/**
	 * Initialized max file size section
	 * @returns a group container with 'max file size' options
	 */
	private InitializeMaxFileSizeSection(): azdata.GroupContainer {
		const radioGroupName = 'maxFileSizeRadioGroup';
		this.limitedToMbFileSize = this.createRadioButton(localizedConstants.LimitedToMBFileSizeText, radioGroupName, false, async (checked) => { await this.handleMaxFileSizeTypeChange(checked); });
		this.unlimitedFileSize = this.createRadioButton(localizedConstants.UnlimitedFileSizeText, radioGroupName, true, async (checked) => { await this.handleMaxFileSizeTypeChange(checked); });
		this.limitedToMbFileSizeInput = this.createInputBox(localizedConstants.MaximumFileSizeText, async (newValue) => {
			this.result.maxSizeLimit = Number(newValue);
			if (this.unlimitedFileSize.checked) {
				this.result.maxSizeLimit = -1;
			}
		}, String(defaultMaxFileSizeLimitedToInMb), true, 'number', DefaultInputWidth - 20);
		const fileSizeContainer = this.createLabelInputContainer(localizedConstants.MaximumFileSizeText, this.limitedToMbFileSizeInput);

		this.maxSizeGroup = this.createGroup('', [fileSizeContainer, this.limitedToMbFileSize, this.unlimitedFileSize], false);
		return this.maxSizeGroup;
	}

	private async handleAutogrowthTypeChange(checked: boolean): Promise<void> {
		this.autoFilegrowthInput.value = this.inPercentAutogrowth.checked ? this.autogrowthInPercentValue?.toString() : this.autogrowthInMegabytesValue?.toString();
		this.result.autoFileGrowthType = this.inPercentAutogrowth.checked ? 'Percent' : this.defaultNewDatabaseFile.autoFileGrowthType;
	}

	private async handleMaxFileSizeTypeChange(checked: boolean): Promise<void> {
		if (this.limitedToMbFileSize.checked) {
			this.limitedToMbFileSizeInput.enabled = true;
		} else if (this.unlimitedFileSize.checked) {
			this.limitedToMbFileSizeInput.enabled = false;
			this.result.maxSizeLimit = -1; //Unlimited
		}
	}

	/**
	 * Creates a file browser and sets the path to the filePath
	 */
	private async createFileBrowser(): Promise<void> {
		let fileUris = await vscode.window.showOpenDialog(
			{
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				defaultUri: vscode.Uri.file(this.defaultNewDatabaseFile.path),
				openLabel: 'Select Path',
				filters: {}
			}
		);

		if (!fileUris || fileUris.length === 0) {
			return;
		}

		let fileUri = fileUris[0];
		this.filePathTextBox.value = fileUri.fsPath;
		this.result.path = fileUri.fsPath;
	}

	/**
	 * Toggles fileGroup dropdown options and visibility of the autogrowth file group section based on the selected file type
	 * @param selectedOption the selected option from the fileType dropdown
	 */
	private async updateOptionsForSelectedFileType(selectedOption: string): Promise<void> {
		// Row Data defaults
		let fileGroupDdOptions = this.options.viewInfo.rowDataFileGroupsOptions;
		let fileGroupDdValue = fileGroupDdOptions[0];
		let visibility = 'visible';
		let maxSizeGroupMarginTop = '0px';
		let pathContainerMarginTop = '0px';
		// Log
		if (selectedOption === this.options.viewInfo.fileTypesOptions[1]) {
			fileGroupDdOptions = [localizedConstants.FileGroupForLogTypeText];
			fileGroupDdValue = localizedConstants.FileGroupForLogTypeText;
		}
		// File Stream
		else if (selectedOption === this.options.viewInfo.fileTypesOptions[2]) {
			fileGroupDdOptions = this.options.viewInfo.fileStreamFileGroupsOptions;
			fileGroupDdValue = fileGroupDdOptions[0];
			visibility = 'hidden';
			maxSizeGroupMarginTop = '-130px';
			pathContainerMarginTop = '-40px';
		}

		// Update the propertie
		await this.fileGroupDropdown.updateProperties({
			values: fileGroupDdOptions, value: fileGroupDdValue
		});
		await this.enableAutoGrowthCheckbox.updateCssStyles({ 'visibility': visibility });
		await this.fileGrowthGroup.updateCssStyles({ 'visibility': visibility });
		await this.maxSizeGroup.updateCssStyles({ 'margin-top': maxSizeGroupMarginTop });
		await this.pathContainer.updateCssStyles({ 'margin-top': pathContainerMarginTop });
	}

	public override async onFormFieldChange(): Promise<void> {
		this.dialogObject.okButton.enabled = JSON.stringify(this.result) !== JSON.stringify(this.defaultNewDatabaseFile);
	}

	protected override get dialogResult(): DatabaseFile | undefined {
		return this.result;
	}
}
