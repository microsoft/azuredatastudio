/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import * as fspath from 'path';
import * as vscode from 'vscode';
import * as utils from '../../../utils';
import * as LocalizedConstants from '../../../localizedConstants';
import * as constants from '../../../constants';

import { SparkJobSubmissionModel } from './sparkJobSubmissionModel';
import { SparkFileSource } from './sparkJobSubmissionService';

const localize = nls.loadMessageBundle();

/**
 * Configuration values for the general tab of the spark job submission dialog.
 * See https://livy.incubator.apache.org/docs/latest/rest-api.html for more information
 * on the specific values
 */
export interface SparkConfigModel {
	jobName: string,
	mainClass: string,
	arguments: string
}

const baseFormItemLayout: azdata.FormItemLayout = {
	horizontal: false,
	componentWidth: '400px'
};

export class SparkConfigurationTab {
	private _tab: azdata.window.DialogTab;
	public get tab(): azdata.window.DialogTab { return this._tab; }

	private _jobNameInputBox: azdata.InputBoxComponent;
	private _sparkContextLabel: azdata.TextComponent;
	private _fileSourceDropDown: azdata.DropDownComponent;
	private _sparkSourceFileInputBox: azdata.InputBoxComponent;
	private _filePickerButton: azdata.ButtonComponent;
	private _sourceFlexContainer: azdata.FlexContainer;
	private _sourceFlexContainerWithHint: azdata.FlexContainer;
	private _localUploadDestinationLabel: azdata.TextComponent;
	private _mainClassInputBox: azdata.InputBoxComponent;
	private _argumentsInputBox: azdata.InputBoxComponent;

	// If path is specified, means the default source setting for this tab is HDFS file, otherwise, it would be local file.
	constructor(private _dataModel: SparkJobSubmissionModel, private _path?: string) {
		this._tab = azdata.window.createTab(localize('sparkJobSubmission.GeneralTabName', "GENERAL"));

		this._tab.registerContent(async (modelView) => {
			let builder = modelView.modelBuilder;

			let formContainer = builder.formContainer();

			this._jobNameInputBox = builder.inputBox().withProps({
				placeHolder: localize('sparkJobSubmission.JobNamePlaceHolder', "Enter a name ..."),
				value: (this._path) ? fspath.basename(this._path) : ''
			}).component();

			formContainer.addFormItem({
				component: this._jobNameInputBox,
				title: localize('sparkJobSubmission.JobName', "Job Name"),
				required: true
			}, baseFormItemLayout);

			this._sparkContextLabel = builder.text().withProps({
				value: this._dataModel.getSparkClusterUrl()
			}).component();
			formContainer.addFormItem({
				component: this._sparkContextLabel,
				title: localize('sparkJobSubmission.SparkCluster', "Spark Cluster")
			}, baseFormItemLayout);

			this._fileSourceDropDown = builder.dropDown().withProps({
				values: [SparkFileSource.Local.toString(), SparkFileSource.HDFS.toString()],
				value: (this._path) ? SparkFileSource.HDFS.toString() : SparkFileSource.Local.toString()
			}).component();

			this._fileSourceDropDown.onValueChanged(async selection => {
				let isLocal = selection.selected === SparkFileSource.Local.toString();
				// Disable browser button for cloud source.
				if (this._filePickerButton) {
					await this._filePickerButton.updateProperties({
						enabled: isLocal,
						required: isLocal
					});
				}

				// Clear the path When switching source.
				if (this._sparkSourceFileInputBox) {
					this._sparkSourceFileInputBox.value = '';
				}

				if (this._localUploadDestinationLabel) {
					if (isLocal) {
						this._localUploadDestinationLabel.value = LocalizedConstants.sparkLocalFileDestinationHint;
					} else {
						this._localUploadDestinationLabel.value = '';
					}
				}
			});

			this._sparkSourceFileInputBox = builder.inputBox().withProps({
				required: true,
				placeHolder: localize('sparkJobSubmission.FilePathPlaceHolder', "Path to a .jar or .py file"),
				value: (this._path) ? this._path : ''
			}).component();
			this._sparkSourceFileInputBox.onTextChanged(async text => {
				if (this._fileSourceDropDown.value === SparkFileSource.Local.toString()) {
					this._dataModel.updateModelByLocalPath(text);
					if (this._localUploadDestinationLabel) {
						if (text) {
							this._localUploadDestinationLabel.value = localize('sparkJobSubmission.LocalFileDestinationHintWithPath',
								"The selected local file will be uploaded to HDFS: {0}", this._dataModel.hdfsSubmitFilePath);
						} else {
							this._localUploadDestinationLabel.value = LocalizedConstants.sparkLocalFileDestinationHint;
						}
					}
				} else {
					this._dataModel.hdfsSubmitFilePath = text;
				}

				// main class disable/enable is according to whether it's jar file.
				let isJarFile = this._dataModel.isJarFile();
				await this._mainClassInputBox.updateProperties({ enabled: isJarFile, required: isJarFile });
				if (!isJarFile) {
					// Clear main class for py file.
					this._mainClassInputBox.value = '';
				}
			});

			this._filePickerButton = builder.button().withProps({
				enabled: (this._path) ? false : true,
				label: '•••',
				width: constants.mssqlClusterSparkJobFileSelectorButtonWidth,
				height: constants.mssqlClusterSparkJobFileSelectorButtonHeight,
				secondary: true
			}).component();
			this._filePickerButton.onDidClick(() => this.onSelectFile());

			this._sourceFlexContainer = builder.flexContainer().component();
			this._sourceFlexContainer.addItem(this._fileSourceDropDown, { flex: '0 0 auto', CSSStyles: { 'minWidth': '75px', 'marginBottom': '5px', 'paddingRight': '3px' } });
			this._sourceFlexContainer.addItem(this._sparkSourceFileInputBox, { flex: '1 1 auto', CSSStyles: { 'marginBottom': '5px', 'paddingRight': '3px' } });
			// Do not add margin for file picker button as the label forces it to have 5px margin
			this._sourceFlexContainer.addItem(this._filePickerButton, { flex: '0 0 auto' });
			this._sourceFlexContainer.setLayout({
				flexFlow: 'row',
				height: '100%',
				justifyContent: 'center',
				alignItems: 'center',
				alignContent: 'stretch'
			});

			this._localUploadDestinationLabel = builder.text().withProps({
				value: (this._path) ? '' : LocalizedConstants.sparkLocalFileDestinationHint
			}).component();
			this._sourceFlexContainerWithHint = builder.flexContainer().component();
			this._sourceFlexContainerWithHint.addItem(this._sourceFlexContainer, { flex: '0 0 auto' });
			this._sourceFlexContainerWithHint.addItem(this._localUploadDestinationLabel, { flex: '1 1 auto' });
			this._sourceFlexContainerWithHint.setLayout({
				flexFlow: 'column',
				width: '100%',
				justifyContent: 'center',
				alignItems: 'stretch',
				alignContent: 'stretch'
			});

			formContainer.addFormItem({
				component: this._sourceFlexContainerWithHint,
				title: localize('sparkJobSubmission.MainFilePath', "JAR/py File"),
				required: true
			}, baseFormItemLayout);

			this._mainClassInputBox = builder.inputBox().component();
			formContainer.addFormItem({
				component: this._mainClassInputBox,
				title: localize('sparkJobSubmission.MainClass', "Main Class"),
				required: true
			}, baseFormItemLayout);

			this._argumentsInputBox = builder.inputBox().component();
			formContainer.addFormItem({
				component: this._argumentsInputBox,
				title: localize('sparkJobSubmission.Arguments', "Arguments")
			},
				{
					...baseFormItemLayout,
					info: localize('sparkJobSubmission.ArgumentsTooltip', "Command line arguments used in your main class, multiple arguments should be split by space.")
				});

			await modelView.initializeModel(formContainer.component());
		});
	}

	public async validate(): Promise<boolean> {
		if (!this._jobNameInputBox.value) {
			this._dataModel.showDialogError(localize('sparkJobSubmission.NotSpecifyJobName', "Property Job Name is not specified."));
			return false;
		}

		if (this._fileSourceDropDown.value === SparkFileSource.Local.toString()) {
			if (this._sparkSourceFileInputBox.value) {
				this._dataModel.isMainSourceFromLocal = true;
				this._dataModel.updateModelByLocalPath(this._sparkSourceFileInputBox.value);
			} else {
				this._dataModel.showDialogError(localize('sparkJobSubmission.NotSpecifyJARPYPath', "Property JAR/py File is not specified."));
				return false;
			}
		} else {
			if (this._sparkSourceFileInputBox.value) {
				this._dataModel.isMainSourceFromLocal = false;
				this._dataModel.hdfsSubmitFilePath = this._sparkSourceFileInputBox.value;
			} else {
				this._dataModel.showDialogError(localize('sparkJobSubmission.NotSpecifyJARPYPath', "Property JAR/py File is not specified."));
				return false;
			}
		}

		if (this._dataModel.isJarFile() && !this._mainClassInputBox.value) {
			this._dataModel.showDialogError(localize('sparkJobSubmission.NotSpecifyMainClass', "Property Main Class is not specified."));
			return false;
		}

		// 1. For local file Source check whether they existed.
		if (this._dataModel.isMainSourceFromLocal) {
			if (!(await utils.exists(this._dataModel.localFileSourcePath))) {
				this._dataModel.showDialogError(LocalizedConstants.sparkJobSubmissionLocalFileNotExisted(this._dataModel.localFileSourcePath));
				return false;
			}
		} else {
			// 2. Check HDFS file existed for HDFS source.
			try {
				let isFileExisted = await this._dataModel.isClusterFileExisted(this._dataModel.hdfsSubmitFilePath);
				if (!isFileExisted) {
					this._dataModel.showDialogError(localize('sparkJobSubmission.HDFSFileNotExistedWithPath', "{0} does not exist in Cluster or exception thrown. ", this._dataModel.hdfsSubmitFilePath));
					return false;
				}
			} catch (error) {
				this._dataModel.showDialogError(localize('sparkJobSubmission.HDFSFileNotExisted', "The specified HDFS file does not exist. "));
				return false;
			}
		}

		return true;
	}

	private async onSelectFile(): Promise<void> {
		let filePath = await this.pickFile();
		if (filePath) {
			this._sparkSourceFileInputBox.value = filePath;
		}
	}

	public getSparkConfigValues(): SparkConfigModel {
		return {
			jobName: this._jobNameInputBox.value ?? '',
			mainClass: this._mainClassInputBox.value ?? '',
			arguments: this._argumentsInputBox.value ?? ''
		};
	}

	public async pickFile(): Promise<string> {
		try {
			let filter = { 'JAR/py files': ['jar', 'py'] };
			let options: vscode.OpenDialogOptions = {
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				openLabel: localize('sparkSelectLocalFile', "Select"),
				filters: filter
			};

			let fileUris: vscode.Uri[] = await vscode.window.showOpenDialog(options);
			if (fileUris && fileUris[0]) {
				return fileUris[0].fsPath;
			}

			return undefined;
		} catch (err) {
			void vscode.window.showErrorMessage(localize('sparkJobSubmission.SelectFileError', "Error in locating the file due to Error: {0}", utils.getErrorMessage(err)));
			return undefined;
		}
	}
}
