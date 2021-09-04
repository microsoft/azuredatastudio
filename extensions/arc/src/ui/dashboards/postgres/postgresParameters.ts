/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as azdataExt from 'azdata-ext';
import * as loc from '../../../localizedConstants';
import { UserCancelledError } from '../../../common/api';
import { IconPathHelper, cssStyles } from '../../../constants';
import { DashboardPage } from '../../components/dashboardPage';
import { EngineSettingsModel, PostgresModel } from '../../../models/postgresModel';
import { debounce, instanceOfCheckBox } from '../../../common/utils';

export type ParametersModel = {
	parameterName: string,
	originalValue: string,
	valueComponent: azdata.TextComponent | azdata.DropDownComponent | azdata.CheckBoxComponent,
	information?: azdata.ButtonComponent,
	description: string,
	resetButton: azdata.ButtonComponent
};

export abstract class PostgresParametersPage extends DashboardPage {
	private searchBox!: azdata.InputBoxComponent;
	protected _parametersTable!: azdata.DeclarativeTableComponent;
	private parameterContainer!: azdata.DivContainer;
	private parametersTableLoading?: azdata.LoadingComponent;

	private discardButton!: azdata.ButtonComponent;
	private saveButton!: azdata.ButtonComponent;
	private resetAllButton!: azdata.ButtonComponent;
	private connectToServerButton?: azdata.ButtonComponent;

	protected _parameters: ParametersModel[] = [];
	private changedComponentValues: Set<string> = new Set();
	private parameterUpdates: Map<string, string> = new Map();

	protected readonly _azdataApi: azdataExt.IExtension;

	constructor(modelView: azdata.ModelView, dashboard: azdata.window.ModelViewDashboard, protected _postgresModel: PostgresModel) {
		super(modelView, dashboard);

		this._azdataApi = vscode.extensions.getExtension(azdataExt.extension.name)?.exports;

		this.initializeSearchBox();

		this.disposables.push(
			this._postgresModel.onConfigUpdated(() => this.eventuallyRunOnInitialized(() => this.handleServiceUpdated()))
		);
	}

	protected abstract get description(): string;

	protected abstract get engineSettings(): EngineSettingsModel[];

	protected get container(): azdata.Component {
		const root = this.modelView.modelBuilder.divContainer().component();
		const content = this.modelView.modelBuilder.divContainer().component();
		root.addItem(content, { CSSStyles: { 'margin': '20px' } });

		content.addItem(this.modelView.modelBuilder.text().withProps({
			value: this.title,
			CSSStyles: { ...cssStyles.title }
		}).component());

		content.addItem(this.modelView.modelBuilder.text().withProps({
			value: this.description,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component());

		content.addItem(this.modelView.modelBuilder.hyperlink().withProps({
			label: loc.learnAboutNodeParameters,
			url: 'https://docs.microsoft.com/azure/azure-arc/data/configure-server-parameters-postgresql-hyperscale'
		}).component(), { CSSStyles: { 'margin-bottom': '20px' } });

		content.addItem(this.searchBox!, { CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px', 'margin-bottom': '20px' } });

		this._parametersTable = this.modelView.modelBuilder.declarativeTable().withProps({
			width: '100%',
			columns: [
				{
					displayName: loc.parameterName,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '20%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: loc.value,
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: false,
					width: '20%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: loc.description,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '50%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: {
						...cssStyles.tableRow
					}
				},
				{
					displayName: loc.resetToDefault,
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: false,
					width: '10%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				}
			],
			data: []
		}).component();

		this.parameterContainer = this.modelView.modelBuilder.divContainer().component();
		this.selectComponent();
		content.addItem(this.parameterContainer);

		this.initialized = true;

		return root;
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		// Save Edits
		this.saveButton = this.modelView.modelBuilder.button().withProps({
			label: loc.saveText,
			iconPath: IconPathHelper.save,
			enabled: false
		}).component();

		let engineSettings: string[] = [];
		this.disposables.push(
			this.saveButton.onDidClick(async () => {
				this.saveButton.enabled = false;
				try {
					await vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: loc.updatingInstance(this._postgresModel.info.name),
							cancellable: false
						},
						async (_progress, _token): Promise<void> => {
							try {
								this.parameterUpdates.forEach((value, key) => {
									engineSettings.push(`${key}="${value}"`);
								});
								await this.saveParameterEdits(engineSettings.toString());
							} catch (err) {
								// If an error occurs while editing the instance then re-enable the save button since
								// the edit wasn't successfully applied
								this.saveButton.enabled = true;
								throw err;
							}
							try {
								await this.callGetEngineSettings();
							} catch (error) {
								vscode.window.showErrorMessage(loc.fetchEngineSettingsFailed(this._postgresModel.info.name, error));
							}
						}
					);

					vscode.window.showInformationMessage(loc.instanceUpdated(this._postgresModel.info.name));

					engineSettings = [];
					this.changedComponentValues.clear();
					this.parameterUpdates.clear();
					this.discardButton.enabled = false;
					this.resetAllButton.enabled = true;

				} catch (error) {
					vscode.window.showErrorMessage(loc.instanceUpdateFailed(this._postgresModel.info.name, error));
				}
			})
		);

		// Discard
		this.discardButton = this.modelView.modelBuilder.button().withProps({
			label: loc.discardText,
			iconPath: IconPathHelper.discard,
			enabled: false
		}).component();

		this.disposables.push(
			this.discardButton.onDidClick(async () => {
				this.discardButton.enabled = false;
				try {
					this.discardParametersTableChanges();
				} catch (error) {
					this.discardButton!.enabled = true;
					vscode.window.showErrorMessage(loc.pageDiscardFailed(error));
				} finally {
					this.changedComponentValues.clear();
					this.saveButton.enabled = false;
					this.parameterUpdates.clear();
				}
			})
		);

		// Reset all
		this.resetAllButton = this.modelView.modelBuilder.button().withProps({
			label: loc.resetAllToDefault,
			iconPath: IconPathHelper.reset,
			enabled: false
		}).component();

		this.disposables.push(
			this.resetAllButton.onDidClick(async () => {
				this.resetAllButton.enabled = false;
				this.discardButton.enabled = false;
				this.saveButton.enabled = false;
				try {
					await vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: loc.updatingInstance(this._postgresModel.info.name),
							cancellable: false
						},
						async (_progress, _token): Promise<void> => {
							try {
								await this.resetAllParameters();
							} catch (err) {
								// If an error occurs while resetting the instance then re-enable the reset button since
								// the edit wasn't successfully applied
								if (this.parameterUpdates.size > 0) {
									this.discardButton.enabled = true;
									this.saveButton.enabled = true;
								}
								this.resetAllButton.enabled = true;
								throw err;
							}
							this.changedComponentValues.clear();
							try {
								await this.callGetEngineSettings();
							} catch (error) {
								vscode.window.showErrorMessage(loc.fetchEngineSettingsFailed(this._postgresModel.info.name, error));
							}
						}
					);

					vscode.window.showInformationMessage(loc.instanceUpdated(this._postgresModel.info.name));
					this.parameterUpdates.clear();

				} catch (error) {
					vscode.window.showErrorMessage(loc.resetFailed(error));
				}
			})
		);

		return this.modelView.modelBuilder.toolbarContainer().withToolbarItems([
			{ component: this.saveButton },
			{ component: this.discardButton },
			{ component: this.resetAllButton }
		]).component();
	}

	protected initializeConnectButton(): void {
		this.connectToServerButton = this.modelView.modelBuilder.button().withProps({
			label: loc.connectToServer,
			enabled: false,
			CSSStyles: { 'max-width': '125px' }
		}).component();

		this.disposables.push(
			this.connectToServerButton.onDidClick(async () => {
				let scale = this._postgresModel.config?.spec.scale;
				let nodes = (scale?.workers ?? scale?.shards ?? 0);
				if (this.title === loc.workerNodeParameters && nodes === 0) {
					vscode.window.showInformationMessage(loc.noWorkerPods);
					return;
				}

				this.connectToServerButton!.enabled = false;
				if (!vscode.extensions.getExtension(loc.postgresExtension)) {
					const response = await vscode.window.showErrorMessage(loc.missingExtension('PostgreSQL'), loc.yes, loc.no);
					if (response !== loc.yes) {
						this.connectToServerButton!.enabled = true;
						return;
					}

					await vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: loc.installingExtension(loc.postgresExtension),
							cancellable: false
						},
						async (_progress, _token): Promise<void> => {
							try {
								await vscode.commands.executeCommand('workbench.extensions.installExtension', loc.postgresExtension);
							} catch (err) {
								vscode.window.showErrorMessage(loc.extensionInstallationFailed(loc.postgresExtension));
								this.connectToServerButton!.enabled = true;
								throw err;
							}
						}
					);
					vscode.window.showInformationMessage(loc.extensionInstalled(loc.postgresExtension));
				}

				this.parametersTableLoading!.loading = true;
				await this.callGetEngineSettings().finally(() => this.parametersTableLoading!.loading = false);
				this.searchBox.enabled = true;
				this.resetAllButton.enabled = true;
				this.parameterContainer.clearItems();
				this.parameterContainer.addItem(this._parametersTable);
			})
		);
	}

	private selectComponent(): void {
		if (!this._postgresModel.engineSettingsLastUpdated) {
			this.parameterContainer.addItem(this.modelView.modelBuilder.text().withProps({
				value: loc.connectToPostgresDescription,
				CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
			}).component());
			this.initializeConnectButton();
			this.parameterContainer.addItem(this.connectToServerButton!, { CSSStyles: { 'max-width': '125px' } });
			this.parametersTableLoading = this.modelView.modelBuilder.loadingComponent().component();
			this.parameterContainer.addItem(this.parametersTableLoading);
		} else {
			this.searchBox.enabled = true;
			this.resetAllButton.enabled = true;
			this.parameterContainer.addItem(this._parametersTable!);
			this.refreshParametersTableValues();
		}
	}

	private async callGetEngineSettings(): Promise<void> {
		try {
			await this._postgresModel.getEngineSettings().then(() => {
				if (this._parametersTable.data?.length !== 0) {
					this.refreshParametersTableValues();
				} else {
					this.populateParametersTable();
				}
			});
		} catch (error) {
			if (error instanceof UserCancelledError) {
				vscode.window.showWarningMessage(loc.pgConnectionRequired);
			} else {
				vscode.window.showErrorMessage(loc.fetchEngineSettingsFailed(this._postgresModel.info.name, error));
			}
			this.connectToServerButton!.enabled = true;
			throw error;
		}
	}

	protected initializeSearchBox(): void {
		this.searchBox = this.modelView.modelBuilder.inputBox().withProps({
			readOnly: false,
			enabled: false,
			placeHolder: loc.searchToFilter
		}).component();

		this.disposables.push(
			this.searchBox.onTextChanged(() => {
				this.onSearchFilter();
			})
		);
	}

	@debounce(500)
	private onSearchFilter(): void {
		if (!this.searchBox.value) {
			this._parametersTable.setFilter(undefined);
		} else {
			this.filterParameters(this.searchBox.value);
		}
	}

	private filterParameters(search: string): void {
		const filteredRowIndexes: number[] = [];
		this._parametersTable.data?.forEach((row, index) => {
			if (row[0].toUpperCase()?.search(search.toUpperCase()) !== -1 || row[2].toUpperCase()?.search(search.toUpperCase()) !== -1) {
				filteredRowIndexes.push(index);
			}
		});
		this._parametersTable.setFilter(filteredRowIndexes);
	}

	private handleOnTextChanged(component: azdata.InputBoxComponent, name: string, currentValue: string | undefined): boolean {
		if (!component.valid) {
			// If invalid value return false and enable discard button
			this.discardButton.enabled = true;
			this.collectChangedComponents(name);
			return false;
		} else if (component.value === currentValue) {
			this.removeFromChangedComponents(name);
			return false;
		} else {
			/* If a valid value has been entered into the input box, enable save and discard buttons
			so that user could choose to either edit instance or clear all inputs
			return true */
			this.saveButton.enabled = true;
			this.discardButton.enabled = true;
			this.collectChangedComponents(name);
			return true;
		}
	}

	protected createParameterComponents(engineSetting: EngineSettingsModel): ParametersModel {

		// Can reset individual parameter
		const resetParameterButton = this.modelView.modelBuilder.button().withProps({
			iconPath: IconPathHelper.reset,
			title: loc.resetToDefault,
			width: '20px',
			height: '20px',
			enabled: true
		}).component();

		this.disposables.push(
			resetParameterButton.onDidClick(async () => {
				try {
					await vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: loc.updatingInstance(this._postgresModel.info.name),
							cancellable: false
						},
						async (_progress, _token): Promise<void> => {
							await this.resetParameter(engineSetting.parameterName!);
							try {
								await this.callGetEngineSettings();
							} catch (error) {
								vscode.window.showErrorMessage(loc.fetchEngineSettingsFailed(this._postgresModel.info.name, error));
							}
						}
					);
					this.removeFromChangedComponents(engineSetting.parameterName!);
					vscode.window.showInformationMessage(loc.instanceUpdated(this._postgresModel.info.name));
				} catch (error) {
					vscode.window.showErrorMessage(loc.instanceUpdateFailed(this._postgresModel.info.name, error));
				}
			})
		);

		let valueComponent: azdata.Component;
		if (engineSetting.type === 'enum') {
			// If type is enum, component should be drop down menu
			let values: string[] = [];
			if (typeof engineSetting.options === 'string') {
				let options = engineSetting.options?.slice(1, -1).split(',');
				values = options.map(option => option.slice(option.indexOf('"') + 1, -1));
			} else if (engineSetting.options) {
				values = engineSetting.options;
			}

			let valueBox = this.modelView.modelBuilder.dropDown().withProps({
				values: values,
				value: engineSetting.value,
				width: '150px'
			}).component();
			valueComponent = valueBox;

			this.disposables.push(
				valueBox.onValueChanged(() => {
					if (engineSetting.value !== String(valueBox.value)) {
						this.parameterUpdates.set(engineSetting.parameterName!, String(valueBox.value));
						this.collectChangedComponents(engineSetting.parameterName!);
						this.saveButton.enabled = true;
						this.discardButton.enabled = true;
					} else if (this.parameterUpdates.has(engineSetting.parameterName!)) {
						this.parameterUpdates.delete(engineSetting.parameterName!);
						this.removeFromChangedComponents(engineSetting.parameterName!);
					}
				})
			);
		} else if (engineSetting.type === 'bool') {
			// If type is bool, component should be checkbox to turn on or off
			let valueBox = this.modelView.modelBuilder.checkBox().withProps({
				label: loc.on,
				CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
			}).component();
			valueComponent = valueBox;

			if (engineSetting.value === 'on') {
				valueBox.checked = true;
			} else {
				valueBox.checked = false;
			}

			this.disposables.push(
				valueBox.onChanged(() => {
					if (valueBox.checked && engineSetting.value === 'off') {
						this.parameterUpdates.set(engineSetting.parameterName!, loc.on);
						this.collectChangedComponents(engineSetting.parameterName!);
						this.saveButton.enabled = true;
						this.discardButton.enabled = true;
					} else if (!valueBox.checked && engineSetting.value === 'on') {
						this.parameterUpdates.set(engineSetting.parameterName!, loc.off);
						this.collectChangedComponents(engineSetting.parameterName!);
						this.saveButton.enabled = true;
						this.discardButton.enabled = true;
					} else if (this.parameterUpdates.has(engineSetting.parameterName!)) {
						this.parameterUpdates.delete(engineSetting.parameterName!);
						this.removeFromChangedComponents(engineSetting.parameterName!);
					}
				})
			);
		} else if (engineSetting.type === 'string') {
			// If type is string, component should be text inputbox
			let valueBox = this.modelView.modelBuilder.inputBox().withProps({
				required: true,
				readOnly: false,
				value: engineSetting.value,
				width: '150px'
			}).component();
			valueComponent = valueBox;

			this.disposables.push(
				valueBox.onTextChanged(() => {
					if ((this.handleOnTextChanged(valueBox, engineSetting.parameterName!, engineSetting.value))) {
						this.parameterUpdates.set(engineSetting.parameterName!, `"${valueBox.value!}"`);
					} else if (this.parameterUpdates.has(engineSetting.parameterName!)) {
						this.parameterUpdates.delete(engineSetting.parameterName!);
					}
				})
			);
		} else {
			// If type is real or interger, component should be inputbox set to inputType of number. Max and min values also set.
			let valueBox = this.modelView.modelBuilder.inputBox().withProps({
				required: true,
				readOnly: false,
				min: parseInt(engineSetting.min!),
				max: parseInt(engineSetting.max!),
				inputType: 'number',
				value: engineSetting.value,
				width: '150px'
			}).component();
			valueComponent = valueBox;

			this.disposables.push(
				valueBox.onTextChanged(() => {
					if ((this.handleOnTextChanged(valueBox, engineSetting.parameterName!, engineSetting.value))) {
						this.parameterUpdates.set(engineSetting.parameterName!, valueBox.value!);
					} else if (this.parameterUpdates.has(engineSetting.parameterName!)) {
						this.parameterUpdates.delete(engineSetting.parameterName!);
					}
				})
			);

			// Information bubble title to show allowed values
			let information = this.modelView.modelBuilder.button().withProps({
				iconPath: IconPathHelper.information,
				width: '15px',
				height: '15px',
				description: loc.rangeSetting(engineSetting.min!, engineSetting.max!)
			}).component();

			return {
				parameterName: engineSetting.parameterName!,
				originalValue: engineSetting.value!,
				valueComponent: valueComponent,
				information: information,
				description: engineSetting.description!,
				resetButton: resetParameterButton
			};
		}

		return {
			parameterName: engineSetting.parameterName!,
			originalValue: engineSetting.value!,
			valueComponent: valueComponent,
			description: engineSetting.description!,
			resetButton: resetParameterButton
		};
	}

	private collectChangedComponents(name: string): void {
		if (!this.changedComponentValues.has(name)) {
			this.changedComponentValues.add(name);
		}
	}

	private removeFromChangedComponents(name: string): void {
		if (this.changedComponentValues.has(name)) {
			this.changedComponentValues.delete(name);
		}
	}

	private discardParametersTableChanges(): void {
		this.changedComponentValues.forEach(v => {
			let param = this._parameters.find(p => p.parameterName === v);
			if (instanceOfCheckBox(param!.valueComponent)) {
				if (param!.originalValue === 'on') {
					param!.valueComponent.checked = true;
				} else {
					param!.valueComponent.checked = false;
				}
			} else {
				param!.valueComponent.value = param!.originalValue;
			}
		});
	}

	private populateParametersTable(): void {
		this._parameters = this.engineSettings.map(parameter => this.createParameterComponents(parameter));

		this._parametersTable.data = this._parameters.map(p => {
			if (p.information) {
				// Container to hold input component and information bubble
				const valueContainer = this.modelView.modelBuilder.flexContainer().withLayout({ alignItems: 'center' }).component();
				valueContainer.addItem(p.valueComponent, { CSSStyles: { 'margin-right': '0px' } });
				valueContainer.addItem(p.information, { CSSStyles: { 'margin-left': '5px' } });
				return [p.parameterName, valueContainer, p.description, p.resetButton];
			} else {
				return [p.parameterName, p.valueComponent, p.description, p.resetButton];
			}
		});
	}

	/**
	 * Checks if exisiting parameter values needs to be updated.
	 * Only updates exisiting parameters, will not add/remove parameters from the table.
	 */
	private refreshParametersTableValues(): void {
		this.engineSettings.map(parameter => {
			let param = this._parameters.find(p => p.parameterName === parameter.parameterName);
			if (param) {
				if (parameter.value !== param.originalValue) {
					param.originalValue = parameter.value!;

					if (instanceOfCheckBox(param.valueComponent)) {
						if (param.originalValue === 'on') {
							param.valueComponent.checked = true;
						} else {
							param.valueComponent.checked = false;
						}
					} else {
						param.valueComponent.value = parameter.value;
					}
				}
			}
		});
	}

	private async handleServiceUpdated(): Promise<void> {
		if (this._postgresModel.configLastUpdated && !this._postgresModel.engineSettingsLastUpdated) {
			this.connectToServerButton!.enabled = true;
			this.parametersTableLoading!.loading = false;
		} else if (this._postgresModel.engineSettingsLastUpdated) {
			await this.callGetEngineSettings();
		}
	}

	protected abstract saveParameterEdits(engineSettings: string): Promise<void>;

	protected abstract resetAllParameters(): Promise<void>;

	protected abstract resetParameter(parameterName: string): Promise<void>;
}
