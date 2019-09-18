/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { DataTierApplicationWizard, Operation } from '../dataTierApplicationWizard';
import { DacFxDataModel } from './models';
import { BasePage } from './basePage';
import { sanitizeStringForFilename, isValidBasename } from './utils';

const localize = nls.loadMessageBundle();

export abstract class DacFxConfigPage extends BasePage {

	protected readonly wizardPage: azdata.window.WizardPage;
	protected readonly instance: DataTierApplicationWizard;
	protected readonly model: DacFxDataModel;
	protected readonly view: azdata.ModelView;
	protected serverDropdown: azdata.DropDownComponent;
	protected databaseTextBox: azdata.InputBoxComponent;
	protected databaseDropdown: azdata.DropDownComponent;
	protected databaseLoader: azdata.LoadingComponent;
	protected fileTextBox: azdata.InputBoxComponent;
	protected fileButton: azdata.ButtonComponent;
	protected fileExtension: string;

	protected constructor(instance: DataTierApplicationWizard, wizardPage: azdata.window.WizardPage, model: DacFxDataModel, view: azdata.ModelView) {
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

	protected async createServerDropdown(isTargetServer: boolean): Promise<azdata.FormComponent> {
		const serverDropDownTitle = isTargetServer ? localize('dacFx.targetServerDropdownTitle', "Target Server") : localize('dacFx.sourceServerDropdownTitle', "Source Server");
		this.serverDropdown = this.view.modelBuilder.dropDown().withProperties({
			required: true,
			ariaLabel: serverDropDownTitle
		}).component();

		// Handle server changes
		this.serverDropdown.onValueChanged(async () => {
			this.model.server = (this.serverDropdown.value as ConnectionDropdownValue).connection;
			this.model.serverName = (this.serverDropdown.value as ConnectionDropdownValue).displayName;
			await this.populateDatabaseDropdown();
		});

		return {
			component: this.serverDropdown,
			title: serverDropDownTitle
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

	protected async createDatabaseTextBox(): Promise<azdata.FormComponent> {
		this.databaseTextBox = this.view.modelBuilder.inputBox().withProperties({
			required: true
		}).component();

		this.databaseTextBox.ariaLabel = localize('dacfx.databaseAriaLabel', "Database");
		this.databaseTextBox.onTextChanged(async () => {
			this.model.database = this.databaseTextBox.value;
		});

		return {
			component: this.databaseTextBox,
			title: localize('dacFx.databaseNameTextBox', 'Target Database')
		};
	}

	protected async createDatabaseDropdown(): Promise<azdata.FormComponent> {
		const databaseDropdownTitle = localize('dacFx.sourceDatabaseDropdownTitle', "Source Database");
		this.databaseDropdown = this.view.modelBuilder.dropDown().withProperties({
			ariaLabel: databaseDropdownTitle
		}).component();

		// Handle database changes
		this.databaseDropdown.onValueChanged(async () => {
			this.model.database = (<azdata.CategoryValue>this.databaseDropdown.value).name;
			this.fileTextBox.value = this.generateFilePathFromDatabaseAndTimestamp();
			this.model.filePath = this.fileTextBox.value;
		});

		this.databaseLoader = this.view.modelBuilder.loadingComponent().withItem(this.databaseDropdown).withProperties({
			required: true
		}).component();


		return {
			component: this.databaseLoader,
			title: databaseDropdownTitle
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

		// only update values and regenerate filepath if this is the first time and database isn't set yet
		if (this.model.database !== values[0].name) {
			// db should only get set to the dropdown value if it isn't deploy with create database
			if (!(this.instance.selectedOperation === Operation.deploy && !this.model.upgradeExisting)) {
				this.model.database = values[0].name;
			}
			// filename shouldn't change for deploy because the file exists and isn't being generated as for extract and export
			if (this.instance.selectedOperation !== Operation.deploy) {
				this.model.filePath = this.generateFilePathFromDatabaseAndTimestamp();
				this.fileTextBox.value = this.model.filePath;
			}
		}

		this.databaseDropdown.updateProperties({
			values: values
		});
		this.databaseLoader.loading = false;

		return true;
	}

	protected async createFileBrowserParts() {
		this.fileTextBox = this.view.modelBuilder.inputBox().withValidation(
			component => isValidBasename(component.value)
		)
			.withProperties({
				required: true,
				ariaLive: 'polite'
			}).component();

		this.fileTextBox.ariaLabel = localize('dacfx.fileLocationAriaLabel', "File Location");
		this.fileButton = this.view.modelBuilder.button().withProperties({
			label: '•••',
			title: localize('dacfx.selectFile', "Select file"),
			ariaLabel: localize('dacfx.selectFile', "Select file")
		}).component();
	}

	protected generateFilePathFromDatabaseAndTimestamp(): string {
		return this.model.database ? path.join(this.getRootPath(), sanitizeStringForFilename(this.model.database) + '-' + this.getDateTime() + this.fileExtension) : '';
	}

	protected getDateTime(): string {
		let now = new Date();
		return now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate() + '-' + now.getHours() + '-' + now.getMinutes();
	}

	protected getRootPath(): string {
		// use previous file location if there was one
		if (this.fileTextBox.value && path.dirname(this.fileTextBox.value)) {
			return path.dirname(this.fileTextBox.value);
		} else { // otherwise use the folder open in the Explorer or the home directory
			return vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].name : os.homedir();
		}
	}

	protected appendFileExtensionIfNeeded() {
		// make sure filepath ends in proper file extension if it's a valid name
		if (!this.model.filePath.endsWith(this.fileExtension) && isValidBasename(this.model.filePath)) {
			this.model.filePath += this.fileExtension;
			this.fileTextBox.value = this.model.filePath;
		}
	}
}

interface ConnectionDropdownValue extends azdata.CategoryValue {
	connection: azdata.connection.ConnectionProfile;
}

