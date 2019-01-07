/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as sqlops from 'sqlops';
import * as nls from 'vscode-nls';
import { DacFxDataModel } from '../api/models';
import { DataTierApplicationWizard, Operation } from '../dataTierApplicationWizard';
import { BasePage } from '../api/basePage';

const localize = nls.loadMessageBundle();

export class DacFxSummaryPage extends BasePage {

	protected readonly wizardPage: sqlops.window.modelviewdialog.WizardPage;
	protected readonly instance: DataTierApplicationWizard;
	protected readonly model: DacFxDataModel;
	protected readonly view: sqlops.ModelView;

	private form: sqlops.FormContainer;
	private table: sqlops.TableComponent;
	private loader: sqlops.LoadingComponent;

	public constructor(instance: DataTierApplicationWizard, wizardPage: sqlops.window.modelviewdialog.WizardPage, model: DacFxDataModel, view: sqlops.ModelView) {
		super();
		this.instance = instance;
		this.wizardPage = wizardPage;
		this.model = model;
		this.view = view;
	}

	async start(): Promise<boolean> {
		this.table = this.view.modelBuilder.table().component();
		this.loader = this.view.modelBuilder.loadingComponent().withItem(this.table).component();
		this.form = this.view.modelBuilder.formContainer().withFormItems(
			[
				{
					component: this.table,
					title: ''
				}
			]
		).component();
		await this.view.initializeModel(this.form);
		return true;
	}

	async onPageEnter(): Promise<boolean> {
		this.populateTable();
		this.loader.loading = false;
		return true;
	}

	public setupNavigationValidator() {
		this.instance.registerNavigationValidator(() => {
			if (this.loader.loading) {
				return false;
			}
			return true;
		});
	}

	private populateTable() {
		let data = [];
		let targetServer = localize('dacfx.targetServerName', 'Target Server');
		let targetDatabase = localize('dacfx.targetDatabaseName', 'Target Database');
		let sourceServer = localize('dacfx.sourceServerName', 'Source Server');
		let sourceDatabase = localize('dacfx.sourceDatabaseName', 'Source Database');
		let fileLocation = localize('dacfx.fileLocation', 'File Location');

		switch (this.instance.selectedOperation) {
			case Operation.deploy: {
				data = [
					[targetServer, this.model.serverName],
					[fileLocation, this.model.filePath],
					[targetDatabase, this.model.database]];
				break;
			}
			case Operation.extract: {
				data = [
					[sourceServer, this.model.serverName],
					[sourceDatabase, this.model.database],
					[localize('dacfxExtract.version', 'Version'), this.model.version],
					[fileLocation, this.model.filePath]];
				break;
			}
			case Operation.import: {
				data = [
					[targetServer, this.model.serverName],
					[fileLocation, this.model.filePath],
					[targetDatabase, this.model.database]];
				break;
			}
			case Operation.export: {
				data = [
					[sourceServer, this.model.serverName],
					[sourceDatabase, this.model.database],
					[fileLocation, this.model.filePath]];
				break;
			}
		}

		this.table.updateProperties({
			data: data,
			columns: ['Setting', 'Value'],
			width: 600,
			height: 200
		});
	}
}

