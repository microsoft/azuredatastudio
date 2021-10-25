/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as azExt from 'az-ext';
import { Deferred } from '../../common/promise';
import * as loc from '../../localizedConstants';
import * as vscode from 'vscode';
import { cssStyles } from '../../constants';
import { InitializingComponent } from '../components/initializingComponent';
import { MiaaModel, PITRModel, DatabaseModel } from '../../models/miaaModel';
import * as azurecore from 'azurecore';
import { ControllerModel } from '../../models/controllerModel';
import { UserCancelledError } from '../../common/api';

export class RestoreSqlDialog extends InitializingComponent {
	protected modelBuilder!: azdata.ModelBuilder;
	protected disposables: vscode.Disposable[] = [];
	private _restoreResult: azExt.SqlMiDbRestoreResult | undefined;
	private readonly _azApi: azExt.IExtension;
	private _pitrSettings: PITRModel = {
		instanceName: '',
		resourceGroupName: '',
		location: '',
		subscriptionId: '',
		dbName: '',
		restorePoint: '',
		earliestPitr: '',
		latestPitr: '',
		destDbName: '',
	};

	private _pitrArgs = {
		destName: '',
		managedInstance: '',
		time: '',
		noWait: false,
		dryRun: true
	};
	private earliestRestorePointInputBox!: azdata.InputBoxComponent;
	private latestRestorePointInputBox!: azdata.InputBoxComponent;
	private subscriptionInputBox!: azdata.InputBoxComponent;
	private resourceGroupInputBox!: azdata.InputBoxComponent;
	private sourceDbInputBox!: azdata.InputBoxComponent;
	private restorePointInputBox!: azdata.InputBoxComponent;
	private databaseNameInputBox!: azdata.InputBoxComponent;
	private instanceInputBox!: azdata.InputBoxComponent;
	private validateButton!: azdata.ButtonComponent;
	private restorePointContainer!: azdata.DivContainer;
	protected _completionPromise = new Deferred<PITRModel | undefined>();
	private _azurecoreApi: azurecore.IExtension;
	constructor(protected _miaaModel: MiaaModel, protected _controllerModel: ControllerModel, protected _database: DatabaseModel) {
		super();
		this._azurecoreApi = vscode.extensions.getExtension(azurecore.extension.name)?.exports;
		this.refreshPitrSettings();
		this._azApi = vscode.extensions.getExtension(azExt.extension.name)?.exports;
	}

	protected dispose(): void {
		this.disposables.forEach(d => d.dispose());
		this.disposables.length = 0;
	}

	public get restoreResult(): azExt.SqlMiDbRestoreResult | undefined {
		return this._restoreResult;
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
					value: this._pitrSettings.subscriptionId
				}).component();
			this.resourceGroupInputBox = this.modelBuilder.inputBox()
				.withProps({
					enabled: false,
					ariaLabel: loc.resourceGroup,
					value: this._pitrSettings.resourceGroupName
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
					value: this._pitrSettings.restorePoint,
				}).component();
			this.disposables.push(
				this.restorePointInputBox.onTextChanged(() => {
					this._pitrSettings.restorePoint = this.restorePointInputBox.value ?? '';
					this.validateButton.enabled = true;
				}));
			this.restorePointContainer = this.modelBuilder.divContainer().component();
			const pitrDetailsTitle = this.modelBuilder.text().withProps({
				value: loc.restorePointDetails,
				CSSStyles: { ...cssStyles.title }
			}).component();
			const validateDetailsTextLabel = this.modelBuilder.text().withProps({
				value: loc.validateDescription,
			}).component();
			this.validateButton = this.modelBuilder.button()
				.withProps({
					label: loc.validate,
					enabled: false,
					description: loc.validateDescription,
					CSSStyles: { 'max-width': '125px', 'margin-left': '40%' }
				}).component();
			this.restorePointContainer.addItem(this.restorePointInputBox, { CSSStyles: { 'align-self': 'start', 'text-align': 'center' } });
			this.restorePointContainer.addItem(validateDetailsTextLabel, { CSSStyles: { 'margin-top': '40px' } });
			this.restorePointContainer.addItem(this.validateButton, { CSSStyles: { 'align-self': 'end', 'text-align': 'right' } });
			this.disposables.push(
				this.validateButton!.onDidClick(async () => {
					this.validateButton!.enabled = false;
					try {
						await vscode.window.withProgress(
							{
								location: vscode.ProgressLocation.Window,
								title: loc.updatingInstance(loc.restore),
								cancellable: false
							},

							async (_progress, _token): Promise<void> => {
								this._pitrArgs.destName = this._pitrSettings.destDbName;
								this._pitrArgs.managedInstance = this._pitrSettings.instanceName;
								this._pitrArgs.time = this._pitrSettings.restorePoint;
								this._pitrArgs.noWait = false;
								this._pitrArgs.dryRun = true;
								const res = await this._azApi.az.sql.midbarc.restore(
									this._pitrSettings.dbName, this._pitrArgs, this._miaaModel.controllerModel.info.namespace, this._miaaModel.controllerModel.azAdditionalEnvVars);
								try {
									await this._miaaModel.refresh();

									this._restoreResult = res.stdout;
									if (this._pitrArgs.dryRun) {
										await this.updatePitrTimeWindow(this._restoreResult.earliestRestoreTime, this._restoreResult.latestRestoreTime);
									}
									if (this._restoreResult.state === 'Completed') {
										vscode.window.showInformationMessage(loc.restoreMessage(this._restoreResult.message));
									}
									else if (this._restoreResult.state === 'Failed') {
										vscode.window.showErrorMessage(loc.restoreMessage(this._restoreResult.message));
									}
									console.log(this._restoreResult);
								} catch (error) {
									vscode.window.showErrorMessage(loc.refreshFailed(error));
								}
							}
						);
					} catch (err) {
						if (!(err instanceof UserCancelledError)) {
							vscode.window.showErrorMessage(loc.restoreMessage(err));
						}
						this.validateButton!.enabled = true;
					}
				}));
			const destinationDetailsTitle = this.modelBuilder.text().withProps({
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
			this.disposables.push(
				this.databaseNameInputBox.onTextChanged(() => {
					this._pitrSettings.destDbName = this.databaseNameInputBox.value ?? '';
					if (this.restorePointInputBox?.value) {
						this.validateButton.enabled = true;
					}

				}));
			this.instanceInputBox = this.modelBuilder.inputBox()
				.withProps({
					enabled: false,
					ariaLabel: loc.instance,
					value: this._pitrSettings.instanceName
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
							component: destinationDetailsTitle,
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
						{
							component: pitrDetailsTitle
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
							component: this.restorePointContainer,
							title: loc.restorePoint,
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
		dialog.registerCloseValidator(async () => {
			const isValidated = await this.validate();
			if (isValidated) {
				this.dispose();
			}
			return isValidated;
		});
		dialog.okButton.onClick(() => {
			this._pitrSettings.subscriptionId = this.subscriptionInputBox.value ?? '';
			this._pitrSettings.instanceName = this.instanceInputBox.value ?? '';
			this._pitrSettings.resourceGroupName = this.resourceGroupInputBox.value ?? '';
			this._pitrSettings.dbName = this.databaseNameInputBox.value ?? '';
			this._pitrSettings.earliestPitr = this.earliestRestorePointInputBox.value ?? '';
			this._pitrSettings.latestPitr = this.latestRestorePointInputBox.value ?? '';
			this._pitrSettings.restorePoint = this.restorePointInputBox.value ?? '';
			this._completionPromise.resolve(this._pitrSettings);
		});
		azdata.window.openDialog(dialog);
		return dialog;
	}

	public async validate(): Promise<boolean> {
		if (!this.subscriptionInputBox.value || !this.resourceGroupInputBox.value
			|| !this.sourceDbInputBox.value || !this.latestRestorePointInputBox.value
			|| !this.restorePointInputBox.value || !this.databaseNameInputBox.value
			|| !this.instanceInputBox.value) {
			return false;
		}
		else {
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
		this._pitrSettings.instanceName = this._miaaModel?.config?.metadata.name || this._pitrSettings.instanceName;
		this._pitrSettings.resourceGroupName = this._controllerModel?.controllerConfig?.spec.settings.azure.resourceGroup || this._pitrSettings.resourceGroupName;
		this._pitrSettings.location = this._azurecoreApi.getRegionDisplayName(this._controllerModel?.controllerConfig?.spec.settings.azure.location) || this._pitrSettings.location;
		this._pitrSettings.subscriptionId = this._controllerModel?.controllerConfig?.spec.settings.azure.subscription || this._pitrSettings.subscriptionId;
		this._pitrSettings.dbName = this._database.name || this._pitrSettings.dbName;
		this._pitrSettings.restorePoint = this._restoreResult?.restorePoint?.toString() || this._pitrSettings.restorePoint || '';
		this._pitrSettings.latestPitr = this._restoreResult?.latestRestoreTime?.toString() || this._database.lastBackup || this._pitrSettings.latestPitr;
		this._pitrSettings.earliestPitr = this._restoreResult?.earliestRestoreTime?.toString() || this._pitrSettings.earliestPitr || '';
		this._pitrSettings.destDbName = this._pitrSettings.destDbName;
	}

	public updatePitrTimeWindow(earliestPitr: string, latestPitr: string): void {
		this.earliestRestorePointInputBox.value = earliestPitr;
		this.latestRestorePointInputBox.value = latestPitr;
	}
}
