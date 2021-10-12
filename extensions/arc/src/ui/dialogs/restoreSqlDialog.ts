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
import { MiaaModel, PITRModel, DatabaseModel } from '../../models/miaaModel';
import * as azurecore from 'azurecore';
import { ControllerModel } from '../../models/controllerModel';

export class RestoreSqlDialog extends InitializingComponent {
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
	};

	private earliestRestorePointInputBox!: azdata.InputBoxComponent;
	private latestRestorePointInputBox!: azdata.InputBoxComponent;
	private subscriptionInputBox!: azdata.InputBoxComponent;
	private resourceGroupInputBox!: azdata.InputBoxComponent;
	private sourceDbInputBox!: azdata.InputBoxComponent;
	private restorePointInputBox!: azdata.InputBoxComponent;
	private databaseNameInputBox!: azdata.InputBoxComponent;
	private instanceInputBox!: azdata.InputBoxComponent;
	protected _completionPromise = new Deferred<PITRModel | undefined>();
	private _azurecoreApi: azurecore.IExtension;
	constructor(protected _miaaModel: MiaaModel, protected _controllerModel: ControllerModel, protected _database: DatabaseModel) {
		super();
		this._azurecoreApi = vscode.extensions.getExtension(azurecore.extension.name)?.exports;

	}

	public showDialog(dialogTitle: string): azdata.window.Dialog {
		const dialog = azdata.window.createModelViewDialog(dialogTitle, dialogTitle, 'normal');
		dialog.cancelButton.onClick(() => this.handleCancel());
		dialog.registerContent(async view => {
			this.modelBuilder = view.modelBuilder;
			this.refreshPitrSettings();
			const pitrTitle = this.modelBuilder.text().withProps({
				value: loc.pitr,
				CSSStyles: { ...cssStyles.title }
			}).component();
			const projectDetailsTitle = this.modelBuilder.text().withProps({
				value: loc.projectDetails,
				CSSStyles: { ...cssStyles.title }
			}).component();
			const projectDetailsTextLabel = this.modelBuilder.text().withProps({
				value: loc.projectDetailsText,
			}).component();
			this.subscriptionInputBox = this.modelBuilder.inputBox()
				.withProps({
					enabled: false,
					ariaLabel: loc.subscription,
					value: this.pitrSettings.subscriptionId
				}).component();
			this.resourceGroupInputBox = this.modelBuilder.inputBox()
				.withProps({
					enabled: false,
					ariaLabel: loc.resourceGroup,
					value: this.pitrSettings.resourceGroupName
				}).component();

			const sourceDetailsTitle = this.modelBuilder.text().withProps({
				value: loc.sourceDetails,
				CSSStyles: { ...cssStyles.title }
			}).component();
			const sourceDetailsTextLabel = this.modelBuilder.text().withProps({
				value: loc.sourceDetailsText,
			}).component();
			this.sourceDbInputBox = this.modelBuilder.inputBox()
				.withProps({
					enabled: false,
					ariaLabel: loc.sourceDatabase,
					value: this._database.name
				}).component();

			this.earliestRestorePointInputBox = this.modelBuilder.inputBox()
				.withProps({
					enabled: false,
					ariaLabel: loc.earliestPitrRestorePoint,
					value: ''
				}).component();

			this.latestRestorePointInputBox = this.modelBuilder.inputBox()
				.withProps({
					enabled: false,
					ariaLabel: loc.latestpitrRestorePoint,
					value: this._database.lastBackup
				}).component();

			this.restorePointInputBox = this.modelBuilder.inputBox()
				.withProps({
					readOnly: false,
					ariaLabel: loc.restorePoint,
					value: ''
				}).component();
			const databaseDetailsTitle = this.modelBuilder.text().withProps({
				value: loc.databaseDetails,
				CSSStyles: { ...cssStyles.title }
			}).component();
			const databaseDetailsTextLabel = this.modelBuilder.text().withProps({
				value: loc.databaseDetailsText,
			}).component();
			this.databaseNameInputBox = this.modelBuilder.inputBox()
				.withProps({
					readOnly: false,
					ariaLabel: loc.databaseName,
					value: ''
				}).component();

			this.instanceInputBox = this.modelBuilder.inputBox()
				.withProps({
					enabled: false,
					ariaLabel: loc.instance,
					value: this.pitrSettings.instanceName
				}).component();
			const info = this.modelBuilder.text().withProps({
				value: loc.restoreInfo,
				CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
			}).component();

			const link = this.modelBuilder.hyperlink().withProps({
				label: loc.learnMore,
				url: 'https://docs.microsoft.com/azure/azure-arc/data/point-in-time-restore',
			}).component();

			const infoAndLink = this.modelBuilder.flexContainer().withLayout({ flexWrap: 'wrap' }).component();

			infoAndLink.addItem(info, { CSSStyles: { 'margin-right': '5px' } });
			infoAndLink.addItem(link);

			let formModel = this.modelBuilder.formContainer()
				.withFormItems([{
					components: [
						{
							component: pitrTitle
						},
						{
							component: infoAndLink
						},
						{
							component: projectDetailsTitle,
						},
						{
							component: projectDetailsTextLabel,
						},
						{
							component: this.subscriptionInputBox,
							title: loc.subscription,

						},
						{
							component: this.resourceGroupInputBox,
							title: loc.resourceGroup,

						},
						{
							component: sourceDetailsTitle,
						},
						{
							component: sourceDetailsTextLabel,
						},
						{
							component: this.sourceDbInputBox,
							title: loc.sourceDatabase,

						},
						{
							component: this.earliestRestorePointInputBox,
							title: loc.earliestPitrRestorePoint,

						},
						{
							component: this.latestRestorePointInputBox,
							title: loc.latestpitrRestorePoint,

						},
						{
							component: this.restorePointInputBox,
							title: loc.restorePoint,
							required: true
						},
						{
							component: databaseDetailsTitle,
						},
						{
							component: databaseDetailsTextLabel,
						},
						{
							component: this.databaseNameInputBox,
							title: loc.databaseName,
							required: true
						},
						{
							component: this.instanceInputBox,
							title: loc.instance,

						},
					],
					title: ''
				}]).withLayout({ width: '100%' }).component();
			await view.initializeModel(formModel);
			this.subscriptionInputBox.focus();
			this.resourceGroupInputBox.focus();
			this.sourceDbInputBox.focus();
			this.earliestRestorePointInputBox.focus();
			this.latestRestorePointInputBox.focus();
			this.restorePointInputBox.focus();
			this.databaseNameInputBox.focus();
			this.instanceInputBox.focus();
			this.initialized = true;
		});

		dialog.okButton.label = loc.restore;
		dialog.cancelButton.label = loc.cancel;
		dialog.registerCloseValidator(async () => await this.validate());
		dialog.okButton.onClick(() => { this._completionPromise.resolve(this.pitrSettings); });
		azdata.window.openDialog(dialog);
		return dialog;
	}

	public async validate(): Promise<boolean> {
		if (!this.subscriptionInputBox.value || !this.resourceGroupInputBox.value
			|| !this.sourceDbInputBox.value
			|| !this.restorePointInputBox.value || !this.databaseNameInputBox.value
			|| !this.instanceInputBox.value || !this.latestRestorePointInputBox.value) {
			return false;
		}
		else {
			this.pitrSettings.subscriptionId = this.subscriptionInputBox.value;
			this.pitrSettings.instanceName = this.instanceInputBox.value;
			this.pitrSettings.resourceGroupName = this.resourceGroupInputBox.value;
			this.pitrSettings.dbName = this.databaseNameInputBox.value;
			this.pitrSettings.earliestPitr = this.earliestRestorePointInputBox.value ? this.earliestRestorePointInputBox.value : '';
			this.pitrSettings.latestPitr = this.latestRestorePointInputBox.value;
			this.pitrSettings.restorePoint = this.restorePointInputBox.value;
			return true;
		}
	}

	private handleCancel(): void {
		this._completionPromise.resolve(undefined);
	}

	public waitForClose(): Promise<PITRModel | undefined> {
		return this._completionPromise.promise;
	}

	public refreshPitrSettings(): void {
		this.pitrSettings.instanceName = this._miaaModel?.config?.metadata.name || this.pitrSettings.instanceName;
		this.pitrSettings.resourceGroupName = this._controllerModel?.controllerConfig?.spec.settings.azure.resourceGroup || this.pitrSettings.resourceGroupName;
		this.pitrSettings.location = this._azurecoreApi.getRegionDisplayName(this._controllerModel?.controllerConfig?.spec.settings.azure.location) || this.pitrSettings.location;
		this.pitrSettings.subscriptionId = this._controllerModel?.controllerConfig?.spec.settings.azure.subscription || this.pitrSettings.subscriptionId;
		this.pitrSettings.dbName = this._database.name;
		this.pitrSettings.restorePoint = this._database.lastBackup;
		this.pitrSettings.earliestPitr = '';
	}
}
