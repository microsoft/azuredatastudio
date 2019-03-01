/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { SparkJobSubmissionModel } from './sparkJobSubmissionModel';
import { AppContext } from '../../../appContext';
import { ApiWrapper } from '../../../apiWrapper';

export class SparkAdvancedTab {
	private _tab: sqlops.window.DialogTab;
	public get tab(): sqlops.window.DialogTab { return this._tab; }

	private _referenceFilesInputBox: sqlops.InputBoxComponent;
	private _referenceJARFilesInputBox: sqlops.InputBoxComponent;
	private _referencePyFilesInputBox: sqlops.InputBoxComponent;

	private get apiWrapper(): ApiWrapper {
		return this.appContext.apiWrapper;
	}

	constructor(private appContext: AppContext) {
		this._tab = this.apiWrapper.createTab(localize('sparkJobSubmission_AdvancedTabName', 'ADVANCED'));

		this._tab.registerContent(async (modelView) => {
			let builder = modelView.modelBuilder;
			let parentLayout: sqlops.FormItemLayout = {
				horizontal: false,
				componentWidth: '400px'
			};

			let formContainer = builder.formContainer();

			this._referenceJARFilesInputBox = builder.inputBox().component();
			formContainer.addFormItem({
				component: this._referenceJARFilesInputBox,
				title: localize('sparkJobSubmission_ReferenceJarList', 'Reference Jars')
			},
				Object.assign(
					{
						info: localize('sparkJobSubmission_ReferenceJarListToolTip',
							'Jars to be placed in executor working directory. The Jar path needs to be an HDFS Path. Multiple paths should be split by semicolon (;)')
					},
					parentLayout));

			this._referencePyFilesInputBox = builder.inputBox().component();
			formContainer.addFormItem({
				component: this._referencePyFilesInputBox,
				title: localize('sparkJobSubmission_ReferencePyList', 'Reference py Files')
			},
				Object.assign(
					{
						info: localize('sparkJobSubmission_ReferencePyListTooltip',
							'Py Files to be placed in executor working directory. The file path needs to be an HDFS Path. Multiple paths should be split by semicolon(;)')
					},
					parentLayout));

			this._referenceFilesInputBox = builder.inputBox().component();
			formContainer.addFormItem({
				component: this._referenceFilesInputBox,
				title: localize('sparkJobSubmission_ReferenceFilesList', 'Reference Files')
			},
				Object.assign({
					info: localize('sparkJobSubmission_ReferenceFilesListTooltip',
						'Files to be placed in executor working directory. The file path needs to be an HDFS Path. Multiple paths should be split by semicolon(;)')
				}, parentLayout));

			await modelView.initializeModel(formContainer.component());
		});
	}

	public getInputValues(): string[] {
		return [this._referenceJARFilesInputBox.value, this._referencePyFilesInputBox.value, this._referenceFilesInputBox.value];
	}
}
