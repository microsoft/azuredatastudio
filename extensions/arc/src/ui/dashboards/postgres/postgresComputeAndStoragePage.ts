/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as azdataExt from 'azdata-ext';
import * as loc from '../../../localizedConstants';
import { IconPathHelper, cssStyles } from '../../../constants';
import { DashboardPage } from '../../components/dashboardPage';
import { ControllerModel } from '../../../models/controllerModel';
import { PostgresModel } from '../../../models/postgresModel';

export class PostgresComputeAndStoragePage extends DashboardPage {
	private workerContainer?: azdata.DivContainer;
	private coordinatorContainer?: azdata.DivContainer;

	private worker?: azdata.InputBoxComponent;
	private advancedConfiguration?: azdata.CheckBoxComponent;
	private vCoresMax?: azdata.InputBoxComponent;
	private vCoresMin?: azdata.InputBoxComponent;
	private memoryMax?: azdata.InputBoxComponent;
	private memoryMin?: azdata.InputBoxComponent;

	private readonly _azdataApi: azdataExt.IExtension;

	constructor(protected modelView: azdata.ModelView, private _controllerModel: ControllerModel, private _postgresModel: PostgresModel) {
		super(modelView);
		this._azdataApi = vscode.extensions.getExtension(azdataExt.extension.name)?.exports;

		this.disposables.push(this._postgresModel.onConfigUpdated(
			() => this.eventuallyRunOnInitialized(() => this.handleServiceUpdated())));
	}

	protected get title(): string {
		return loc.computeAndStorage;
	}

	protected get id(): string {
		return 'postgres-compute-and-storage';
	}

	protected get icon(): { dark: string; light: string; } {
		return IconPathHelper.computeStorage;
	}

	protected get container(): azdata.Component {
		const root = this.modelView.modelBuilder.divContainer().component();
		const content = this.modelView.modelBuilder.divContainer().component();
		root.addItem(content, { CSSStyles: { 'margin': '20px' } });

		content.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.computeAndStorage,
			CSSStyles: { ...cssStyles.title }
		}).component());

		const infoComputeStorage = this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.computeAndStorageDescription,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const link = this.modelView.modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({
			label: loc.learnAboutComputeStorageSettings,
			url: 'https://docs.microsoft.com/en-us/azure/postgresql/concepts-hyperscale-configuration-options',
		}).component();

		const infoAndLink = this.modelView.modelBuilder.flexContainer().withLayout({ flexWrap: 'wrap' }).component();
		infoAndLink.addItem(infoComputeStorage, { CSSStyles: { 'margin-right': '5px' } });
		infoAndLink.addItem(link);
		content.addItem(infoAndLink, { CSSStyles: { 'margin-bottom': '25px' } });

		content.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.workerNodes,
			CSSStyles: { ...cssStyles.title }
		}).component());

		content.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.workerNodesDescription,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component());

		this.workerContainer = this.modelView.modelBuilder.divContainer().component();
		this.workerContainer.addItems(this.updateWorkerConfiguration(), { CSSStyles: { 'margin-bottom': '5px', 'min-height': '30px', 'max-width': '350px' } });
		content.addItem(this.workerContainer);

		content.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.coordinatorNode,
			CSSStyles: { ...cssStyles.title }
		}).component());

		content.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.coordinatorNodeDescription,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component());

		this.coordinatorContainer = this.modelView.modelBuilder.divContainer().component();
		this.coordinatorContainer.addItems(this.getCordinatorConfiguration(), { CSSStyles: { 'margin-bottom': '5px', 'min-height': '30px', 'max-width': '350px' } });
		content.addItem(this.coordinatorContainer);

		this.initialized = true;

		return root;
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		// Save Edits
		const saveButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.saveText,
			iconPath: IconPathHelper.save
		}).component();

		this.disposables.push(
			saveButton.onDidClick(async () => {
				saveButton.enabled = false;
				try {
					await vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: loc.updatingInstance(this._postgresModel.info.name),
							cancellable: false
						},
						(_progress, _token) => {
							return this._azdataApi.azdata.arc.postgres.server.edit(
								this._postgresModel.info.name,
								{
									workers: this.worker?.value,
									coresLimit: this.vCoresMin?.value,
									coresRequest: this.vCoresMax?.value,
									memoryLimit: this.memoryMin?.value,
									memoryRequest: this.memoryMax?.value
								});
						}
					);
					await this._controllerModel.refreshTreeNode();
					vscode.window.showInformationMessage(loc.instanceUpdated(this._postgresModel.info.name));

				} catch (error) {
					vscode.window.showErrorMessage(loc.instanceUpdateFailed(this._postgresModel.info.name, error));
				} finally {
					saveButton.enabled = true;
				}
			}));

		// Discard
		const discardButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.discardText,
			iconPath: IconPathHelper.discard,
			enabled: true
		}).component();

		this.disposables.push(
			discardButton.onDidClick(async () => {

				discardButton.enabled = false;
				try {
					this.workerContainer?.clearItems();
					this.workerContainer?.addItems(this.updateWorkerConfiguration(), { CSSStyles: { 'margin-bottom': '5px', 'min-height': '30px', 'max-width': '350px' } });
				} catch (error) {
					vscode.window.showErrorMessage(loc.refreshFailed(error));
				}
				finally {
					discardButton.enabled = true;
				}
			}));

		return this.modelView.modelBuilder.toolbarContainer().withToolbarItems([
			{ component: saveButton },
			{ component: discardButton }
		]).component();
	}

	private updateWorkerConfiguration(): azdata.Component[] {
		const endpoint = this._postgresModel.endpoint;
		if (!endpoint) {
			return [];
		}
		else {
			this.worker = this.editWorkerNodeCount();
			this.advancedConfiguration = this.editAdvancedConfiguration();
			this.vCoresMax = this.editMaxVCores();
			this.vCoresMin = this.editMinVCores();
			this.memoryMax = this.editMaxMemory();
			this.memoryMin = this.editMinMemory();

			return [
				this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
					value: loc.workerNodeCount,
					CSSStyles: { ...cssStyles.text, 'font-weight': 'bold', 'margin-block-start': '0px', 'margin-block-end': '0px' }
				}).component(),
				this.worker,
				this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
					value: loc.configurationPerNode,
					CSSStyles: { ...cssStyles.text, 'font-weight': 'bold', 'margin-block-start': '0px', 'margin-block-end': '0px' }
				}).component(),
				this.advancedConfiguration,
				this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
					value: loc.vCoresMax,
					CSSStyles: { ...cssStyles.text, 'font-weight': 'bold', 'margin-block-start': '0px', 'margin-block-end': '0px' }
				}).component(),
				this.vCoresMax,
				this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
					value: loc.vCoresMin,
					CSSStyles: { ...cssStyles.text, 'font-weight': 'bold', 'margin-block-start': '0px', 'margin-block-end': '0px' }
				}).component(),
				this.vCoresMin,
				this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
					value: loc.memoryMax,
					CSSStyles: { ...cssStyles.text, 'font-weight': 'bold', 'margin-block-start': '0px', 'margin-block-end': '0px' }
				}).component(),
				this.memoryMax,
				this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
					value: loc.memoryMin,
					CSSStyles: { ...cssStyles.text, 'font-weight': 'bold', 'margin-block-start': '0px', 'margin-block-end': '0px' }
				}).component(),
				this.memoryMin
			];

		}

	}

	private getCordinatorConfiguration(): azdata.Component[] {
		const endpoint = this._postgresModel.endpoint;
		if (!endpoint) {
			return [];
		}
		else {
			let vCoresMax = this.getVCores(loc.vCoresMax);
			let vCoresMin = this.getVCores(loc.vCoresMin);
			let memoryMax = this.getMemory(loc.memoryMax);
			let memoryMin = this.getMemory(loc.memoryMin);
			let dataStorage = this.getStorage(loc.dataStorage);
			let logStorage = this.getStorage(loc.logsStorage);
			let backlogStorage = this.getStorage(loc.backupsStorage);

			return [
				this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
					value: loc.vCoresMax,
					CSSStyles: { ...cssStyles.text, 'font-weight': 'bold', 'margin-block-start': '0px', 'margin-block-end': '0px' }
				}).component(),
				vCoresMax,
				this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
					value: loc.vCoresMin,
					CSSStyles: { ...cssStyles.text, 'font-weight': 'bold', 'margin-block-start': '0px', 'margin-block-end': '0px' }
				}).component(),
				vCoresMin,
				this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
					value: loc.memoryMax,
					CSSStyles: { ...cssStyles.text, 'font-weight': 'bold', 'margin-block-start': '0px', 'margin-block-end': '0px' }
				}).component(),
				memoryMax,
				this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
					value: loc.memoryMin,
					CSSStyles: { ...cssStyles.text, 'font-weight': 'bold', 'margin-block-start': '0px', 'margin-block-end': '0px' }
				}).component(),
				memoryMin,
				this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
					value: loc.dataStorage,
					CSSStyles: { ...cssStyles.text, 'font-weight': 'bold', 'margin-block-start': '0px', 'margin-block-end': '0px' }
				}).component(),
				dataStorage,
				this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
					value: loc.logsStorage,
					CSSStyles: { ...cssStyles.text, 'font-weight': 'bold', 'margin-block-start': '0px', 'margin-block-end': '0px' }
				}).component(),
				logStorage,
				this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
					value: loc.backupsStorage,
					CSSStyles: { ...cssStyles.text, 'font-weight': 'bold', 'margin-block-start': '0px', 'margin-block-end': '0px' }
				}).component(),
				backlogStorage
			];

		}

	}

	private editWorkerNodeCount(): azdata.InputBoxComponent {
		let currentNodeCount = this._postgresModel.config?.spec.scale.shards;

		if (!currentNodeCount) {
			currentNodeCount = 0;
		}

		return this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			value: currentNodeCount.toString(),
			readOnly: false,
			min: currentNodeCount
		}).component();

	}

	private editAdvancedConfiguration(): azdata.CheckBoxComponent {

		return this.modelView.modelBuilder.checkBox().withProperties<azdata.CheckBoxProperties>({
			checked: false,
			label: loc.enableAdvancedConfiguration
		}).component();

	}

	private editMaxVCores(): azdata.InputBoxComponent {
		let currentCPURequest = this._postgresModel.config?.spec.scheduling?.default?.resources?.requests?.cpu;

		if (!currentCPURequest) {
			currentCPURequest = '0';
		}

		return this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			value: currentCPURequest,
			readOnly: false
		}).component();

	}

	private editMinVCores(): azdata.InputBoxComponent {
		let currentCPULimit = this._postgresModel.config?.spec.scheduling?.default?.resources?.limits?.cpu;

		if (!currentCPULimit) {
			currentCPULimit = '0';
		}

		return this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			value: currentCPULimit,
			readOnly: false,
		}).component();

	}

	private editMaxMemory(): azdata.InputBoxComponent {
		let currentMemRequest = this._postgresModel.config?.spec.scheduling?.default?.resources?.requests?.memory;

		if (!currentMemRequest) {
			currentMemRequest = '0';
		}

		return this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			value: currentMemRequest,
			readOnly: false
		}).component();

	}

	private editMinMemory(): azdata.InputBoxComponent {
		let currentMemLimit = this._postgresModel.config?.spec.scheduling?.default?.resources?.limits?.memory;

		if (!currentMemLimit) {
			currentMemLimit = '0';
		}

		return this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			value: currentMemLimit,
			readOnly: false
		}).component();

	}

	private getVCores(type: string): azdata.InputBoxComponent {
		let coresSize: string | undefined;
		if (type === loc.memoryMin) {
			coresSize = this._postgresModel.config?.spec.scheduling?.default?.resources?.limits?.cpu;
		}
		else if (type === loc.memoryMax) {
			coresSize = this._postgresModel.config?.spec.scheduling?.default?.resources?.requests?.cpu;
		}

		if (!coresSize) {
			coresSize = '0';
		}

		return this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			value: coresSize,
			readOnly: true
		}).component();
	}

	private getMemory(type: string): azdata.InputBoxComponent {
		let memorySize: string | undefined;
		if (type === loc.memoryMin) {
			memorySize = this._postgresModel.config?.spec.scheduling?.default?.resources?.limits?.memory;
		}
		else if (type === loc.memoryMax) {
			memorySize = this._postgresModel.config?.spec.scheduling?.default?.resources?.requests?.memory;
		}

		if (!memorySize) {
			memorySize = '0';
		}

		return this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			value: memorySize,
			readOnly: true
		}).component();
	}

	private getStorage(type: string): azdata.InputBoxComponent {
		let storageSize: string | undefined;
		if (type === loc.dataStorage) {
			storageSize = this._postgresModel.config?.spec.storage.data.size;
		}
		else if (type === loc.logsStorage) {
			storageSize = this._postgresModel.config?.spec.storage.logs.size;
		}
		else if (type === loc.backupsStorage) {
			storageSize = this._postgresModel.config?.spec.storage.backups.size;
		}

		if (!storageSize) {
			storageSize = '0';
		}

		return this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			value: storageSize,
			readOnly: true
		}).component();
	}

	private handleServiceUpdated() {
		this.workerContainer?.addItems(this.updateWorkerConfiguration(), { CSSStyles: { 'margin-bottom': '5px', 'min-height': '30px', 'max-width': '350px' } });
		this.coordinatorContainer?.addItems(this.getCordinatorConfiguration(), { CSSStyles: { 'margin-bottom': '5px', 'min-height': '30px', 'max-width': '350px' } });
	}
}
