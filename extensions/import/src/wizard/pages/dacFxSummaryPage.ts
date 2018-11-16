/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as sqlops from 'sqlops';
import * as nls from 'vscode-nls';
import { DacFxDataModel } from '../api/models';
import { DataTierApplicationWizard, Operation } from '../dataTierApplicationWizard';
import { DacFxPage } from '../api/dacFxPage';

const localize = nls.loadMessageBundle();

export class DacFxSummaryPage extends DacFxPage {

	protected readonly wizardPage: sqlops.window.modelviewdialog.WizardPage;
	protected readonly instance: DataTierApplicationWizard;
	protected readonly model: DacFxDataModel;
	protected readonly view: sqlops.ModelView;

	private form: sqlops.FormContainer;
	private table: sqlops.TableComponent;
	private loader: sqlops.LoadingComponent;

	public constructor(instance: DataTierApplicationWizard, wizardPage: sqlops.window.modelviewdialog.WizardPage, model: DacFxDataModel, view: sqlops.ModelView) {
		super(instance, wizardPage, model, view);
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
		switch (this.instance.selectedOperation) {
			case Operation.deploy: {
				data = [
					[localize('dacfxDeploy.serverName', 'Server'), this.model.serverName],
					[localize('dacfxDeploy.dacpacLocation', 'Dacpac to deploy'), this.model.filePath],
					[localize('dacfxDeploy.databaseName', 'Database name'), this.model.databaseName]];
				// this.form.items[0] =
				break;
			}
			case Operation.extract: {
				data = [
					[localize('dacfxExtract.serverName', 'Server'), this.model.serverName],
					[localize('dacfxExtract.databaseName', 'Database'), this.model.databaseName],
					[localize('dacfxExtract.version', 'Version'), this.model.version],
					[localize('dacfxExtract.dacpacLocation', 'Dacpac location'), this.model.filePath]];
				break;
			}
			case Operation.import: {
				data = [
					[localize('dacfxImport.serverName', 'Server'), this.model.serverName],
					[localize('dacfxImport.bacpacLocation', 'Bacpac to import'), this.model.filePath],
					[localize('dacfxImport.databaseName', 'Database name'), this.model.databaseName]];
				break;
			}
			case Operation.export: {
				data = [
					[localize('dacfxExport.serverName', 'Server'), this.model.serverName],
					[localize('dacfxExport.databaseName', 'Database'), this.model.databaseName],
					[localize('dacfxExport.bacpacLocation', 'Bacpac location'), this.model.filePath]];
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

