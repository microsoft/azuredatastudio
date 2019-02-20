/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import * as nls from 'vscode-nls';
import * as os from 'os';
import * as path from 'path';
import { DataTierApplicationWizard } from '../dataTierApplicationWizard';
import { DacFxDataModel } from './models';
import { BasePage } from './basePage';

const localize = nls.loadMessageBundle();

export abstract class DacFxConfigPage extends BasePage {

	protected readonly wizardPage: sqlops.window.WizardPage;
	protected readonly instance: DataTierApplicationWizard;
	protected readonly model: DacFxDataModel;
	protected readonly view: sqlops.ModelView;
	protected serverDropdown: sqlops.DropDownComponent;
	protected databaseTextBox: sqlops.InputBoxComponent;
	protected databaseDropdown: sqlops.DropDownComponent;
	protected databaseLoader: sqlops.LoadingComponent;
	protected fileTextBox: sqlops.InputBoxComponent;
	protected fileButton: sqlops.ButtonComponent;
	protected fileExtension: string;

	protected constructor(instance: DataTierApplicationWizard, wizardPage: sqlops.window.WizardPage, model: DacFxDataModel, view: sqlops.ModelView) {
		super();
		this.instance = instance;
		this.wizardPage = wizardPage;
		this.model = model;
		this.view = view;
	}

	public setupNavigationValidator() {
		this.instance.registerNavigationValidator(() => {
			return true;
		});
	}

	protected async createServerDropdown(isTargetServer: boolean): Promise<sqlops.FormComponent> {
		this.serverDropdown = this.view.modelBuilder.dropDown().withProperties({
			required: true
		}).component();

		// Handle server changes
		this.serverDropdown.onValueChanged(async () => {
			this.model.server = (this.serverDropdown.value as ConnectionDropdownValue).connection;
			this.model.serverName = (this.serverDropdown.value as ConnectionDropdownValue).displayName;
			await this.populateDatabaseDropdown();
		});

		let targetServerTitle = localize('dacFx.targetServerDropdownTitle', 'Target Server');
		let sourceServerTitle = localize('dacFx.sourceServerDropdownTitle', 'Source Server');

		return {
			component: this.serverDropdown,
			title: isTargetServer ? targetServerTitle : sourceServerTitle
		};
	}

	protected async populateServerDropdown(): Promise<boolean> {
		let values = await this.getServerValues();
		if (values === undefined) {
			return false;
		}

		this.model.server = values[0].connection;
		this.model.serverName = values[0].displayName;

		this.serverDropdown.updateProperties({
			values: values
		});
		return true;
	}

	protected async createDatabaseTextBox(): Promise<sqlops.FormComponent> {
		this.databaseTextBox = this.view.modelBuilder.inputBox().withProperties({
			required: true
		}).component();

		this.databaseTextBox.onTextChanged(async () => {
			this.model.database = this.databaseTextBox.value;
		});

		return {
			component: this.databaseTextBox,
			title: localize('dacFx.databaseNameTextBox', 'Target Database')
		};
	}

	protected async createDatabaseDropdown(): Promise<sqlops.FormComponent> {
		this.databaseDropdown = this.view.modelBuilder.dropDown().withProperties({
			required: true
		}).component();

		// Handle database changes
		this.databaseDropdown.onValueChanged(async () => {
			this.model.database = (<sqlops.CategoryValue>this.databaseDropdown.value).name;
			this.fileTextBox.value = this.generateFilePath();
			this.model.filePath = this.fileTextBox.value;
		});

		this.databaseLoader = this.view.modelBuilder.loadingComponent().withItem(this.databaseDropdown).component();

		return {
			component: this.databaseLoader,
			title: localize('dacFx.sourceDatabaseDropdownTitle', 'Source Database')
		};
	}

	protected async populateDatabaseDropdown(): Promise<boolean> {
		this.databaseLoader.loading = true;
		this.databaseDropdown.updateProperties({ values: [] });

		if (!this.model.server) {
			this.databaseLoader.loading = false;
			return false;
		}

		let values = await this.getDatabaseValues();
		this.model.database = values[0].name;
		this.model.filePath = this.generateFilePath();
		this.fileTextBox.value = this.model.filePath;

		this.databaseDropdown.updateProperties({
			values: values
		});
		this.databaseLoader.loading = false;

		return true;
	}

	protected async createFileBrowserParts() {
		this.fileTextBox = this.view.modelBuilder.inputBox().withProperties({
			required: true
		}).component();

		this.fileButton = this.view.modelBuilder.button().withProperties({
			label: '•••',
		}).component();
	}

	protected generateFilePath(): string {
		let now = new Date();
		let datetime = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate() + '-' + now.getHours() + '-' + now.getMinutes();
		return path.join(os.homedir(), this.model.database + '-' + datetime + this.fileExtension);
	}
}

interface ConnectionDropdownValue extends sqlops.CategoryValue {
	connection: sqlops.connection.Connection;
}

