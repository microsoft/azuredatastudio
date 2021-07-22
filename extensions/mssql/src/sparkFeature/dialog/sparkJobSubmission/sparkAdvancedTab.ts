/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

/**
 * Configuration values for the advanced tab of the spark job submission dialog.
 * See https://livy.incubator.apache.org/docs/latest/rest-api.html for more information
 * on the specific values
 */
export interface SparkAdvancedConfigModel {
	jarFiles?: string,
	pyFiles?: string,
	otherFiles?: string,
	driverMemory?: string,
	driverCores?: number,
	executorMemory?: string,
	executeCores?: number,
	executorCount?: number,
	queueName?: string,
	configValues?: string
}

const baseFormItemLayout: azdata.FormItemLayout = {
	horizontal: false,
	componentWidth: '400px'
};
export class SparkAdvancedTab {
	private _tab: azdata.window.DialogTab;
	public get tab(): azdata.window.DialogTab { return this._tab; }

	private _referenceFilesInputBox: azdata.InputBoxComponent;
	private _referenceJARFilesInputBox: azdata.InputBoxComponent;
	private _referencePyFilesInputBox: azdata.InputBoxComponent;
	private _driverMemoryInputBox: azdata.InputBoxComponent;
	private _driverCoresInputBox: azdata.InputBoxComponent;
	private _executorMemoryInputBox: azdata.InputBoxComponent;
	private _executorCoresInputBox: azdata.InputBoxComponent;
	private _executorCountInputBox: azdata.InputBoxComponent;
	private _queueInputBox: azdata.InputBoxComponent;
	private _configValuesInputBox: azdata.InputBoxComponent;

	constructor() {
		this._tab = azdata.window.createTab(localize('sparkJobSubmission.AdvancedTabName', "ADVANCED"));

		this._tab.registerContent(async (modelView) => {
			let builder = modelView.modelBuilder;

			let formContainer = builder.formContainer();

			this._referenceJARFilesInputBox = builder.inputBox().component();
			formContainer.addFormItem(
				{
					component: this._referenceJARFilesInputBox,
					title: localize('sparkJobSubmission.ReferenceJarList', "Reference Jars")
				},
				{
					...baseFormItemLayout,
					info: localize('sparkJobSubmission.ReferenceJarListToolTip',
						"Jars to be placed in executor working directory. The Jar path needs to be an HDFS Path. Multiple paths should be split by semicolon (;)")
				});

			this._referencePyFilesInputBox = builder.inputBox().component();
			formContainer.addFormItem({
				component: this._referencePyFilesInputBox,
				title: localize('sparkJobSubmission.ReferencePyList', "Reference py Files")
			},
				{
					...baseFormItemLayout,
					info: localize('sparkJobSubmission.ReferencePyListTooltip',
						"Py Files to be placed in executor working directory. The file path needs to be an HDFS Path. Multiple paths should be split by semicolon(;)")
				});

			this._referenceFilesInputBox = builder.inputBox().component();
			formContainer.addFormItem(
				{
					component: this._referenceFilesInputBox,
					title: localize('sparkJobSubmission.ReferenceFilesList', "Reference Files")
				},
				{
					...baseFormItemLayout,
					info: localize('sparkJobSubmission.ReferenceFilesListTooltip',
						"Files to be placed in executor working directory. The file path needs to be an HDFS Path. Multiple paths should be split by semicolon(;)")
				});

			this._driverMemoryInputBox = builder.inputBox().component();
			formContainer.addFormItem(
				{
					component: this._driverMemoryInputBox,
					title: localize('sparkJobSubmission.driverMemory', "Driver Memory")
				},
				{
					...baseFormItemLayout,
					info: localize('sparkJobSubmission.driverMemoryTooltip', "Amount of memory to allocate to the driver. Specify units as part of value. Example 512M or 2G.")
				});

			this._driverCoresInputBox = builder.inputBox()
				.withProps({ inputType: 'number', min: 1 })
				.component();

			formContainer.addFormItem(
				{
					component: this._driverCoresInputBox,
					title: localize('sparkJobSubmission.driverCores', "Driver Cores")
				},
				{
					...baseFormItemLayout,
					info: localize('sparkJobSubmission.driverCoresTooltip', "Amount of CPU cores to allocate to the driver.")
				});

			this._executorMemoryInputBox = builder.inputBox().component();
			formContainer.addFormItem(
				{
					component: this._executorMemoryInputBox,
					title: localize('sparkJobSubmission.executorMemory', "Executor Memory")
				},
				{
					...baseFormItemLayout,
					info: localize('sparkJobSubmission.executorMemoryTooltip', "Amount of memory to allocate to the executor. Specify units as part of value. Example 512M or 2G.")
				});

			this._executorCoresInputBox = builder.inputBox()
				.withProps({ inputType: 'number', min: 1 })
				.component();
			formContainer.addFormItem(
				{
					component: this._executorCoresInputBox,
					title: localize('sparkJobSubmission.executorCores', "Executor Cores")
				},
				{
					...baseFormItemLayout,
					info: localize('sparkJobSubmission.executorCoresTooltip', "Amount of CPU cores to allocate to the executor.")
				});

			this._executorCountInputBox = builder.inputBox()
				.withProps({ inputType: 'number', min: 1 })
				.component();
			formContainer.addFormItem(
				{
					component: this._executorCountInputBox,
					title: localize('sparkJobSubmission.executorCount', "Executor Count")
				},
				{
					...baseFormItemLayout,
					info: localize('sparkJobSubmission.executorCountTooltip', "Number of instances of the executor to run.")
				});

			this._queueInputBox = builder.inputBox().component();
			formContainer.addFormItem(
				{
					component: this._queueInputBox,
					title: localize('sparkJobSubmission.queueName', "Queue Name")
				},
				{
					...baseFormItemLayout,
					info: localize('sparkJobSubmission.queueNameTooltip', "Name of the Spark queue to execute the session in.")
				});

			this._configValuesInputBox = builder.inputBox().component();
			formContainer.addFormItem(
				{
					component: this._configValuesInputBox,
					title: localize('sparkJobSubmission.configValues', "Configuration Values")
				},
				{
					...baseFormItemLayout,
					info: localize('sparkJobSubmission.configValuesTooltip', "List of name value pairs containing Spark configuration values. Encoded as JSON dictionary. Example: '{\"name\":\"value\", \"name2\":\"value2\"}'.")
				});

			await modelView.initializeModel(formContainer.component());
		});
	}

	public getAdvancedConfigValues(): SparkAdvancedConfigModel {
		return {
			jarFiles: this._referenceJARFilesInputBox.value,
			pyFiles: this._referencePyFilesInputBox.value,
			otherFiles: this._referenceFilesInputBox.value,
			driverMemory: this._driverMemoryInputBox.value,
			driverCores: +this._driverCoresInputBox.value,
			executorMemory: this._executorMemoryInputBox.value,
			executeCores: +this._executorCoresInputBox.value,
			executorCount: +this._executorCountInputBox.value,
			queueName: this._queueInputBox.value,
			configValues: this._configValuesInputBox.value
		};
	}
}
