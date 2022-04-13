/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { Deferred } from '../../common/promise';
import * as loc from '../../localizedConstants';
import * as vscode from 'vscode';
import { cssStyles } from '../../constants';
import { InitializingComponent } from '../components/initializingComponent';
import { PITRModel } from '../../models/miaaModel';
import * as azurecore from 'azurecore';
import { ControllerModel } from '../../models/controllerModel';

export class UpgradeController extends InitializingComponent {
	protected modelBuilder!: azdata.ModelBuilder;
	private pitrSettings: PITRModel = {
		instanceName: '-',
		resourceGroupName: '-',
		location: '-',
		subscriptionId: '-',
		dbName: '-',
		restorePoint: '-',
		earliestPitr: '-',
		latestPitr: '-',
		destDbName: '-',
	};

	protected _completionPromise = new Deferred<PITRModel | undefined>();
	private _azurecoreApi: azurecore.IExtension;
	protected disposables: vscode.Disposable[] = [];
	constructor(protected _controllerModel: ControllerModel) {
		super();
		this._azurecoreApi = vscode.extensions.getExtension(azurecore.extension.name)?.exports;
		this.refreshPitrSettings();
	}

	public showDialog(dialogTitle: string): azdata.window.Dialog {
		const dialog = azdata.window.createModelViewDialog(dialogTitle, dialogTitle, 'narrow', 'flyout');
		dialog.cancelButton.onClick(() => this.handleCancel());
		dialog.registerContent(async view => {
			this.modelBuilder = view.modelBuilder;
			this.refreshPitrSettings();
			const areYouSure = this.modelBuilder.text().withProps({
				value: loc.areYouSure,
				CSSStyles: { ...cssStyles.title, 'margin-block-start': '0px', 'margin-block-end': '0px', 'max-width': 'auto' },
			}).component();
			const areYouSureInfo = this.modelBuilder.text().withProps({
				value: loc.upgradeDialog,
				CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'max-width': 'auto' }
			}).component();
			const upgradeDialog = this.modelBuilder.flexContainer().withLayout({ flexWrap: 'wrap' }).component();

			upgradeDialog.addItem(areYouSureInfo, { CSSStyles: { 'margin-right': '5px' } });

			const monitorUpgradeInfo = this.modelBuilder.text().withProps({
				value: loc.monitorUpgrade,
				CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'max-width': 'auto' }
			}).component();

			upgradeDialog.addItem(monitorUpgradeInfo, { CSSStyles: { 'margin-right': '5px' } });

			const monitorUpgradeCommandInfo = this.modelBuilder.text().withProps({
				value: loc.monitorUpgradeCommand,
				CSSStyles: { ...cssStyles.code, 'margin-block-start': '0px', 'max-width': 'auto' }
			}).component();

			upgradeDialog.addItem(monitorUpgradeCommandInfo, { CSSStyles: { 'margin-right': '5px' } });

			let formModel = this.modelBuilder.formContainer()
				.withFormItems([{
					components: [
						{
							component: areYouSure
						},
						{
							component: upgradeDialog
						}
					],
					title: ''
				}]).withLayout({ width: '100%' }).component();
			await view.initializeModel(formModel);
			this.initialized = true;
		});

		dialog.okButton.label = loc.upgrade;
		dialog.cancelButton.label = loc.cancel;
		dialog.registerCloseValidator(async () => await this.validate());
		dialog.okButton.onClick(() => {
			this._completionPromise.resolve(this.pitrSettings);
		});
		azdata.window.openDialog(dialog);
		return dialog;
	}

	public async validate(): Promise<boolean> {
		return true;
	}

	private handleCancel(): void {
		this._completionPromise.resolve(undefined);
	}

	public waitForClose(): Promise<PITRModel | undefined> {
		return this._completionPromise.promise;
	}

	public refreshPitrSettings(): void {
		this.pitrSettings.resourceGroupName = this._controllerModel?.controllerConfig?.spec.settings.azure.resourceGroup || this.pitrSettings.resourceGroupName;
		this.pitrSettings.location = this._azurecoreApi.getRegionDisplayName(this._controllerModel?.controllerConfig?.spec.settings.azure.location) || this.pitrSettings.location;
		this.pitrSettings.subscriptionId = this._controllerModel?.controllerConfig?.spec.settings.azure.subscription || this.pitrSettings.subscriptionId;
		this.pitrSettings.dbName = 'this._database.name';
		this.pitrSettings.restorePoint = 'this._database.lastBackup';
		this.pitrSettings.earliestPitr = '';
	}
}
