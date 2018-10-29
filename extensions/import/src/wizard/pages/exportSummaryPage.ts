/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as sqlops from 'sqlops';
import * as nls from 'vscode-nls';
import { DacFxDataModel } from '../api/models';
import { DacFxExportWizard } from '../dacFxExportWizard';
import { ExportConfigPage } from './exportConfigPage';
import { DacFxExportPage } from '../api/dacFxExportPage';

const localize = nls.loadMessageBundle();

export class ExportSummaryPage extends DacFxExportPage {

	protected readonly wizardPage: sqlops.window.modelviewdialog.WizardPage;
	protected readonly instance: DacFxExportWizard;
	protected readonly model: DacFxDataModel;
	protected readonly view: sqlops.ModelView;
	protected readonly exportConfigPage: ExportConfigPage;

	private form: sqlops.FormContainer;
	private table: sqlops.TableComponent;
	private loader: sqlops.LoadingComponent;

	public constructor(instance: DacFxExportWizard, wizardPage: sqlops.window.modelviewdialog.WizardPage, model: DacFxDataModel, view: sqlops.ModelView, exportConfigPage: ExportConfigPage) {
		super(instance, wizardPage, model, view);
	}

	async start(): Promise<boolean> {
		this.table = this.view.modelBuilder.table().component();
		this.loader = this.view.modelBuilder.loadingComponent().withItem(this.table).component();
		this.form = this.view.modelBuilder.formContainer().withFormItems(
			[
				{
					component: this.table,
					title: localize('dacfxExport.exportInformation', 'Export bacpac information')
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

	async onPageLeave(): Promise<boolean> {
		return true;
	}

	public async cleanup(): Promise<boolean> {
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
		this.table.updateProperties({
			data: [
				[localize('dacfxExport.serverName', 'Server'), this.model.serverName],
				[localize('dacfxExport.databaseName', 'Database'), this.model.databaseName],
				[localize('dacfxExport.bacpacLocation', 'Bacpac location'), this.model.filePath]],
			columns: ['Object type', 'Value'],
			width: 600,
			height: 200
		});
	}
}

