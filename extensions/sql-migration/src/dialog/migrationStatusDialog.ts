/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getMigrationStatus } from '../api/azure';
import * as azdata from 'azdata';
import { MigrationContext } from '../models/migrationLocalStorage';

export class MigrationStatusDialog {

	private _wizardObject: azdata.window.Dialog;

	constructor(private migration: MigrationContext) {
		this._wizardObject = azdata.window.createModelViewDialog('Migration Status', 'migrationStatusDialog', 'wide');
	}

	async initialize() {
		const tab = azdata.window.createTab('');
		const status = await getMigrationStatus(this.migration.azureAccount, this.migration.subscription, this.migration.migrationContext);
		console.log(status.result);
		tab.registerContent((view: azdata.ModelView) => {
			const statusHeader = view.modelBuilder.text().withProps({
				value: status.result.properties.migrationStatus,
				CSSStyles: {
					'font-size': '16px',
					'font-weight': 'bold'
				}
			}).component();
			const statusText = view.modelBuilder.text().withProps({
				value: JSON.stringify(status.result, undefined, 2)
			}).component();

			const loading = view.modelBuilder.loadingComponent().withProps({
				loading: false
			}).component();

			const refreshButton = view.modelBuilder.button().withProps({
				label: 'Refresh',
				width: '100px',
				CSSStyles: {
					'width': '30px'
				}
			}).component();

			refreshButton.onDidClick(async (e) => {
				loading.loading = true;
				const status = await getMigrationStatus(this.migration.azureAccount, this.migration.subscription, this.migration.migrationContext);
				statusHeader.value = status.result.properties.migrationStatus;
				statusText.value = JSON.stringify(status.result, undefined, 2);
				loading.loading = false;
			});

			const formBuilder = view.modelBuilder.formContainer().withFormItems(
				[
					{
						component: refreshButton
					},
					{
						component: loading
					},
					{
						component: statusHeader
					},
					{
						component: statusText
					},
				],
				{
					horizontal: false
				}
			);
			const form = formBuilder.withLayout({ width: '100%' }).component();
			return view.initializeModel(form).then(() => {
			});
		});

		this._wizardObject.content = [tab];

		azdata.window.openDialog(this._wizardObject);
	}
}
