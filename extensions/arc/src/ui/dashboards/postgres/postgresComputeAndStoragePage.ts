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

	private discardButton?: azdata.ButtonComponent;
	private saveButton?: azdata.ButtonComponent;

	private readonly _azdataApi: azdataExt.IExtension;

	constructor(protected modelView: azdata.ModelView, private _controllerModel: ControllerModel, private _postgresModel: PostgresModel) {
		super(modelView);
		this._azdataApi = vscode.extensions.getExtension(azdataExt.extension.name)?.exports;

		this.initializeConfiguration();

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
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px', 'margin-bottom': '25px' }
		}).component());

		this.workerContainer = this.modelView.modelBuilder.divContainer().component();
		this.workerContainer.addItems(this.updateWorkerConfiguration());
		content.addItem(this.workerContainer);

		content.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.coordinatorNode,
			CSSStyles: { ...cssStyles.title }
		}).component());

		content.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.coordinatorNodeDescription,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px', 'margin-bottom': '25px' }
		}).component());

		this.coordinatorContainer = this.modelView.modelBuilder.divContainer().component();
		this.coordinatorContainer.addItems(this.getCordinatorConfiguration());
		content.addItem(this.coordinatorContainer);

		this.initialized = true;

		return root;
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		// Save Edits
		this.saveButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.saveText,
			iconPath: IconPathHelper.save,
			enabled: false
		}).component();

		this.disposables.push(
			this.saveButton.onDidClick(async () => {
				this.saveButton!.enabled = false;
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
									workers: this.worker!.value,
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
					this.discardButton!.enabled = false;
				}
			}));

		// Discard
		this.discardButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.discardText,
			iconPath: IconPathHelper.discard,
			enabled: false
		}).component();

		this.disposables.push(
			this.discardButton.onDidClick(async () => {
				this.discardButton!.enabled = false;
				try {
					this.workerContainer?.clearItems();
					this.workerContainer?.addItems(this.updateWorkerConfiguration());
				} catch (error) {
					vscode.window.showErrorMessage(loc.refreshFailed(error));
				} finally {
					this.saveButton!.enabled = false;
				}
			}));

		return this.modelView.modelBuilder.toolbarContainer().withToolbarItems([
			{ component: this.saveButton },
			{ component: this.discardButton }
		]).component();
	}

	private initializeConfiguration() {
		this.worker = this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			readOnly: false
		}).component();

		this.advancedConfiguration = this.modelView.modelBuilder.checkBox().withProperties<azdata.CheckBoxProperties>({
			checked: false,
			label: loc.enableAdvancedConfiguration
		}).component();

		this.vCoresMax = this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			readOnly: false
		}).component();

		this.vCoresMin = this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			readOnly: false
		}).component();

		this.memoryMax = this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			readOnly: false
		}).component();

		this.memoryMin = this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			readOnly: false
		}).component();

	}

	private updateWorkerConfiguration(): azdata.Component[] {
		const endpoint = this._postgresModel.endpoint;
		if (!endpoint) {
			return [];
		}
		else {

			this.editWorkerNodeCount();
			this.editVCores(loc.vCoresMax);
			this.editVCores(loc.vCoresMin);
			this.editMemory(loc.memoryMax);
			this.editMemory(loc.memoryMin);

			return [
				this.keyInputContainer(loc.workerNodeCount, this.worker!),
				this.keyInputContainer(loc.configurationPerNode, this.advancedConfiguration!),
				this.keyInputContainer(loc.vCoresMax, this.vCoresMax!),
				this.keyInputContainer(loc.vCoresMin, this.vCoresMin!),
				this.keyInputContainer(loc.memoryMax, this.memoryMax!),
				this.keyInputContainer(loc.memoryMin, this.memoryMin!)
			];

		}

	}

	private getCordinatorConfiguration(): azdata.Component[] {
		const endpoint = this._postgresModel.endpoint;
		if (!endpoint) {
			return [];
		}
		else {

			return [
				this.keyInputContainer(loc.vCoresMax, this.getVCores(loc.vCoresMax)),
				this.keyInputContainer(loc.vCoresMin, this.getVCores(loc.vCoresMin)!),
				this.keyInputContainer(loc.memoryMax, this.getMemory(loc.memoryMax)!),
				this.keyInputContainer(loc.memoryMin, this.getMemory(loc.memoryMin)),
				this.keyInputContainer(loc.dataStorage, this.getStorage(loc.dataStorage)),
				this.keyInputContainer(loc.logsStorage, this.getStorage(loc.logsStorage)),
				this.keyInputContainer(loc.backupsStorage, this.getStorage(loc.backupsStorage))
			];

		}

	}

	private keyInputContainer(key: string, input: azdata.Component): azdata.FlexContainer {
		let valueFlex = { flex: '1 1 250px' };
		let keyFlex = { flex: `0 0 200px` };

		let flexContainer = this.modelView.modelBuilder.flexContainer().withLayout({
			flexWrap: 'wrap',
			alignItems: 'center'
		}).component();

		const keyComponent = this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: key,
			CSSStyles: { ...cssStyles.text, 'font-weight': 'bold', 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		flexContainer!.addItem(keyComponent, keyFlex);

		let inputContainer = this.modelView.modelBuilder.flexContainer().withLayout({ alignItems: 'center' }).component();
		inputContainer.addItem(input, { CSSStyles: { 'min-height': '30px', 'max-width': '350px' } });


		flexContainer!.addItem(inputContainer, valueFlex);

		return flexContainer;
	}

	private editWorkerNodeCount() {
		let currentNodeCount = this._postgresModel.config?.spec.scale.shards;

		if (!currentNodeCount) {
			currentNodeCount = 0;
		}

		this.worker!.value = currentNodeCount.toString();
		this.worker!.min = currentNodeCount;

		this.disposables.push(
			this.worker!.onTextChanged(() => {
				if (this.worker!.value !== currentNodeCount) {
					this.discardButton!.enabled = true;
					this.saveButton!.enabled = true;
				}
			})
		);

	}

	/* private editAdvancedConfiguration(): azdata.CheckBoxComponent {

		return this.modelView.modelBuilder.checkBox().withProperties<azdata.CheckBoxProperties>({
			checked: false,
			label: loc.enableAdvancedConfiguration
		}).component();

	} */

	private editVCores(type: string) {
		let currentCPUSize: string | undefined;
		if (type === loc.vCoresMin) {
			currentCPUSize = this._postgresModel.config?.spec.scheduling?.default?.resources?.limits?.cpu;
			if (!currentCPUSize) {
				currentCPUSize = '0';
			}

			this.vCoresMin!.value = currentCPUSize;
			this.disposables.push(
				this.vCoresMin!.onTextChanged(() => {
					if (this.vCoresMin!.value !== currentCPUSize) {
						this.discardButton!.enabled = true;
						this.saveButton!.enabled = true;
					}
				})
			);

		}
		else if (type === loc.vCoresMax) {
			currentCPUSize = this._postgresModel.config?.spec.scheduling?.default?.resources?.requests?.cpu;
			if (!currentCPUSize) {
				currentCPUSize = '0';
			}

			this.vCoresMax!.value = currentCPUSize;
			this.disposables.push(
				this.vCoresMax!.onTextChanged(() => {
					if (this.vCoresMax!.value !== currentCPUSize) {
						this.discardButton!.enabled = true;
						this.saveButton!.enabled = true;
					}
				})
			);

		}

	}

	private editMemory(type: string) {
		let currentMemorySize: string | undefined;
		if (type === loc.memoryMin) {
			currentMemorySize = this._postgresModel.config?.spec.scheduling?.default?.resources?.limits?.memory;
			if (!currentMemorySize) {
				currentMemorySize = '0';
			}

			this.memoryMin!.value = currentMemorySize;
			this.disposables.push(
				this.memoryMin!.onTextChanged(() => {
					if (this.memoryMin!.value !== currentMemorySize) {
						this.discardButton!.enabled = true;
						this.saveButton!.enabled = true;
					}
				})
			);
		}
		else if (type === loc.memoryMax) {
			currentMemorySize = this._postgresModel.config?.spec.scheduling?.default?.resources?.requests?.memory;
			if (!currentMemorySize) {
				currentMemorySize = '0';
			}

			this.memoryMax!.value = currentMemorySize;
			this.disposables.push(
				this.memoryMax!.onTextChanged(() => {
					if (this.memoryMax!.value !== currentMemorySize) {
						this.discardButton!.enabled = true;
						this.saveButton!.enabled = true;
					}
				})
			);
		}

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
		this.workerContainer?.addItems(this.updateWorkerConfiguration());
		this.coordinatorContainer?.addItems(this.getCordinatorConfiguration());
	}
}
