/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';

import { ModelViewBase } from './modelViewBase';
import { ApiWrapper } from '../../common/apiWrapper';
import * as constants from '../../common/constants';
import { IDataComponent } from '../interfaces';

/**
 * View to pick local models file
 */
export class LocalModelsComponent extends ModelViewBase implements IDataComponent<string[]> {

	private _form: azdata.FormContainer | undefined;
	private _flex: azdata.FlexContainer | undefined;
	private _localPath: azdata.InputBoxComponent | undefined;
	private _localBrowse: azdata.ButtonComponent | undefined;

	/**
	 * Creates new view
	 */
	constructor(apiWrapper: ApiWrapper, parent: ModelViewBase, private _multiSelect: boolean = true) {
		super(apiWrapper, parent.root, parent);
	}

	/**
	 *
	 * @param modelBuilder Register the components
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {
		this._localPath = modelBuilder.inputBox().withProperties({
			value: '',
			width: this.componentMaxLength - this.browseButtonMaxLength - this.spaceBetweenComponentsLength
		}).component();
		this._localBrowse = modelBuilder.button().withProperties({
			label: constants.browseModels,
			width: this.browseButtonMaxLength
		}).component();
		this._localBrowse.onDidClick(async () => {

			let options: vscode.OpenDialogOptions = {
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: this._multiSelect,
				filters: { 'ONNX File': ['onnx'] }
			};

			const filePaths = await this.getLocalPaths(options);
			if (this._localPath && filePaths && filePaths.length > 0) {
				this._localPath.value = this._multiSelect ? filePaths.join(';') : filePaths[0];
			} else if (this._localPath) {
				this._localPath.value = '';
			}
		});

		this._flex = modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'row',
				justifyContent: 'space-between',
				width: this.componentMaxLength
			}).withItems([
				this._localPath, this._localBrowse], {
				CSSStyles: {
					'padding-right': '5px'
				}
			}
			).component();

		this._form = modelBuilder.formContainer().withFormItems([{
			title: '',
			component: this._flex
		}]).component();
		return this._form;
	}

	public addComponents(formBuilder: azdata.FormBuilder) {
		if (this._flex) {
			formBuilder.addFormItem({
				title: constants.modelLocalSourceTitle,
				component: this._flex
			}, { info: constants.modelLocalSourceTooltip });
		}
	}

	public removeComponents(formBuilder: azdata.FormBuilder) {
		if (this._flex) {
			formBuilder.removeFormItem({
				title: '',
				component: this._flex
			});
		}
	}

	/**
	 * Returns selected data
	 */
	public get data(): string[] {
		if (this._localPath?.value) {
			return this._localPath?.value.split(';');
		} else {
			return [];
		}
	}

	/**
	 * Returns the component
	 */
	public get component(): azdata.Component | undefined {
		return this._form;
	}

	/**
	 * Refreshes the view
	 */
	public async refresh(): Promise<void> {
	}

	/**
	 * Returns the page title
	 */
	public get title(): string {
		return constants.localModelsTitle;
	}
}
