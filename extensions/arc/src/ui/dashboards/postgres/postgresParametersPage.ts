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

export class PostgresParametersPage extends DashboardPage {
	private searchBox?: azdata.InputBoxComponent;
	private parametersTable!: azdata.DeclarativeTableComponent;
	private parameterContainer?: azdata.DivContainer;
	private _parametersTableLoading!: azdata.LoadingComponent;

	private discardButton?: azdata.ButtonComponent;
	private saveButton?: azdata.ButtonComponent;
	private resetButton?: azdata.ButtonComponent;
	private connectToServerButton?: azdata.ButtonComponent;

	private engineSettings = `'`;
	private engineSettingUpdates: Map<string, string> = new Map();

	private readonly _azdataApi: azdataExt.IExtension;

	constructor(protected modelView: azdata.ModelView, private _postgresModel: PostgresModel) {
		super(modelView);
		this._azdataApi = vscode.extensions.getExtension(azdataExt.extension.name)?.exports;

		this.initializeConnectButton();
		this.initializeSearchBox();

		this.disposables.push(
			this._postgresModel.onConfigUpdated(() => this.eventuallyRunOnInitialized(() => this.handleServiceUpdated())),
			this._postgresModel.onEngineSettingsUpdated(() => this.eventuallyRunOnInitialized(() => this.handleEngineSettingsUpdated())));
	}

	protected get title(): string {
		return loc.nodeParameters;
	}

	protected get id(): string {
		return 'postgres-node-parameters';
	}

	protected get icon(): { dark: string; light: string; } {
		return IconPathHelper.nodeParameters;
	}

	protected get container(): azdata.Component {
		const root = this.modelView.modelBuilder.divContainer().component();
		const content = this.modelView.modelBuilder.divContainer().component();
		root.addItem(content, { CSSStyles: { 'margin': '20px' } });

		content.addItem(this.modelView.modelBuilder.text().withProps({
			value: loc.nodeParameters,
			CSSStyles: { ...cssStyles.title }
		}).component());

		const info = this.modelView.modelBuilder.text().withProps({
			value: loc.nodeParametersDescription,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const link = this.modelView.modelBuilder.hyperlink().withProps({
			label: loc.learnAboutNodeParameters,
			url: 'https://docs.microsoft.com/azure/azure-arc/data/configure-server-parameters-postgresql-hyperscale',
		}).component();

		const infoAndLink = this.modelView.modelBuilder.flexContainer().withLayout({ flexWrap: 'wrap' }).component();
		infoAndLink.addItem(info, { CSSStyles: { 'margin-right': '5px' } });
		infoAndLink.addItem(link);
		content.addItem(infoAndLink, { CSSStyles: { 'margin-bottom': '20px' } });

		content.addItem(this.searchBox!, { CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px', 'margin-bottom': '20px' } });

		this.parametersTable = this.modelView.modelBuilder.declarativeTable().withProps({
			width: '100%',
			columns: [
				{
					displayName: 'Parameter Name',
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '20%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: 'Value',
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: false,
					width: '20%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: 'Description',
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '50%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: {
						...cssStyles.tableRow,
						'overflow': 'hidden',
						'text-overflow': 'ellipsis',
						'white-space': 'nowrap',
						'max-width': '0'
					}
				},
				{
					displayName: 'Reset To Default',
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: false,
					width: '10%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				}
			],
			data: []
		}).component();

		this._parametersTableLoading = this.modelView.modelBuilder.loadingComponent().component();

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

		this.disposables.push(
			this.saveButton.onDidClick(async () => {
				try {
					await vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: loc.updatingInstance(this._postgresModel.info.name),
							cancellable: false
						},
						async (_progress, _token): Promise<void> => {
							//Edit multiple
							// azdata arc postgres server edit -n <server group name> -e '<parameter name>=<parameter value>, <parameter name>=<parameter value>,...'
							try {
								this.engineSettingUpdates!.forEach((value: string) => {
									this.engineSettings += value + ', ';
								});
								await this._azdataApi.azdata.arc.postgres.server.edit(
									this._postgresModel.info.name, { engineSettings: this.engineSettings + `'` });
							} catch (err) {
								// If an error occurs while editing the instance then re-enable the save button since
								// the edit wasn't successfully applied
								this.saveButton!.enabled = true;
								throw err;
							}
							await this._postgresModel.refresh();
						}
					);

					vscode.window.showInformationMessage(loc.instanceUpdated(this._postgresModel.info.name));

					this.engineSettings = `'`;
					this.engineSettingUpdates!.clear();
					this.discardButton!.enabled = false;

				} catch (error) {
					vscode.window.showErrorMessage(loc.instanceUpdateFailed(this._postgresModel.info.name, error));
				}
			}));

		// Discard
		this.discardButton = this.modelView.modelBuilder.button().withProps({
			label: loc.discardText,
			iconPath: IconPathHelper.discard,
			enabled: false
		}).component();

		this.disposables.push(
			this.discardButton.onDidClick(async () => {
				this.discardButton!.enabled = false;
				try {
					// TODO
					// this.parametersTable.data = [];

					this.engineSettingUpdates!.clear();
				} catch (error) {
					vscode.window.showErrorMessage(loc.pageDiscardFailed(error));
				} finally {
					this.saveButton!.enabled = false;
				}
			}));

		// Reset
		this.resetButton = this.modelView.modelBuilder.button().withProps({
			label: loc.resetAllToDefault,
			iconPath: IconPathHelper.reset,
			enabled: true
		}).component();

		this.disposables.push(
			this.resetButton.onDidClick(async () => {
				this.resetButton!.enabled = false;
				this.discardButton!.enabled = false;
				try {
					await vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: loc.updatingInstance(this._postgresModel.info.name),
							cancellable: false
						},
						async (_progress, _token): Promise<void> => {
							try {
								await this._azdataApi.azdata.arc.postgres.server.edit(
									this._postgresModel.info.name,
									{ engineSettings: '', replaceEngineSettings: true },
									this._postgresModel.engineVersion);
							} catch (err) {
								// If an error occurs while resetting the instance then re-enable the reset button since
								// the edit wasn't successfully applied
								this.resetButton!.enabled = true;
								throw err;
							}
							await this._postgresModel.refresh();
						}

					);
				} catch (error) {
					vscode.window.showErrorMessage(loc.refreshFailed(error));
				}
			}));

		return this.modelView.modelBuilder.toolbarContainer().withToolbarItems([
			{ component: this.saveButton },
			{ component: this.discardButton },
			{ component: this.resetButton }
		]).component();
	}

	private initializeConnectButton() {

		this.connectToServerButton = this.modelView.modelBuilder.button().withProps({
			label: loc.connectToServer,
			enabled: false,
			CSSStyles: { 'max-width': '125px' }
		}).component();

		this.disposables.push(
			this.connectToServerButton!.onDidClick(async () => {
				this.connectToServerButton!.enabled = false;
				if (!vscode.extensions.getExtension('microsoft.azuredatastudio-postgresql')) {
					const response = await vscode.window.showErrorMessage(loc.missingExtension('PostgreSQL'), loc.yes, loc.no);
					if (response !== loc.yes) {
						this.connectToServerButton!.enabled = true;
						return;
					}

					await vscode.commands.executeCommand('workbench.extensions.installExtension', 'microsoft.azuredatastudio-postgresql');
				}

				await this._postgresModel.getEngineSettings().catch(err => {
					// If an error occurs show a message so the user knows something failed but still
					// fire the event so callers can know to update (e.g. so dashboards don't show the
					// loading icon forever)
					if (err instanceof UserCancelledError) {
						vscode.window.showWarningMessage(loc.pgConnectionRequired);
					} else {
						vscode.window.showErrorMessage(loc.fetchEngineSettingsFailed(this._postgresModel.info.name, err));
					}
					this._postgresModel.engineSettingsLastUpdated = new Date();
					this._postgresModel._onEngineSettingsUpdated.fire(this._postgresModel._engineSettings);
					this.connectToServerButton!.enabled = true;
					throw err;
				});

				this.searchBox!.enabled = true;
				this.parameterContainer!.clearItems();
				this.createParameterComponents();
				this._postgresModel._engineSettings.forEach(param => {
					this.parametersTable.data?.push(param.components!);
				});
				this.parameterContainer!.addItem(this.parametersTable);

			}));
	}

	private initializeSearchBox() {
		this.searchBox = this.modelView.modelBuilder.inputBox().withProps({
			readOnly: false,
			enabled: false,
			placeHolder: loc.searchToFilter
		}).component();

		this.disposables.push(
			this.searchBox.onTextChanged(() => {
				this.parameterContainer!.clearItems();
				this.parametersTable.data = [];
				if (!this.searchBox!.value) {
					this._postgresModel._engineSettings.forEach(param => {
						this.parametersTable.data?.push(param.components!);
					});
				} else {
					this.filterParameters(this.searchBox!.value);
				}
				this.parameterContainer!.addItem(this.parametersTable);
			})
		);
	}

	private filterParameters(search: string) {

		/* for (let i = 0; i < 20; i++) {
			if (this._postgresModel._engineSettings[i].parameterName?.search(search) !== -1
				|| this._postgresModel._engineSettings[i].description?.search(search) !== -1) {
				this.parametersTable.data?.push(this._postgresModel._engineSettings[i].row!);
			}
		} */

		this._postgresModel._engineSettings.forEach(param => {
			if (param.parameterName?.search(search) !== -1 || param.description?.search(search) !== -1) {
				this.parametersTable.data?.push(param.components!);
			}
		});

	}

	private createParameterComponents() {

		this._postgresModel._engineSettings.forEach(parameter => {
			this.parameterComponents(parameter);
		});


		/* for (let i = 0; i < 20; i++) {
			let paramDetail: ParamDetailsModel = {
				parameterName: this._postgresModel._engineSettings[i].parameterName,
				description:this._postgresModel._engineSettings[i].description,
				row: this.parameterComponents(this._postgresModel._engineSettings[i])
			};

			parameterData.push(paramDetail.row);
			this._paramDetails.push(paramDetail);
		} */

		// Crashes once more than 20
		/* for (let i = 0; i < 20; i++) {
			this.parameterComponents(this._postgresModel._engineSettings[i])
		} */
	}

	private parameterComponents(parameter: EngineSettingsModel) {
		let data = [];

		// Set parameter name
		data.push(parameter.parameterName);

		// Container to hold input component and information bubble
		const valueContainer = this.modelView.modelBuilder.flexContainer().withLayout({ alignItems: 'center' }).component();

		// Information bubble title to be set depening on type of input
		let information = this.modelView.modelBuilder.button().withProps({
			iconPath: IconPathHelper.information,
			width: '12px',
			height: '12px',
			enabled: false
		}).component();

		if (parameter.type === 'enum') {
			// If type is enum, component should be drop down menu
			let values = parameter.options?.split(',');
			let valueBox = this.modelView.modelBuilder.dropDown().withProps({
				values: values,
				value: parameter.value,
				CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
			}).component();
			valueContainer.addItem(valueBox, { CSSStyles: { 'margin-right': '0px' } });

			this.disposables.push(
				valueBox.onValueChanged(() => {
					this.engineSettingUpdates!.set(parameter.parameterName!, String(valueBox.value));

				})
			);

			information.updateProperty('title', loc.allowedValues(parameter.options!));
		} else if (parameter.type === 'bool') {
			// If type is bool, component should be checkbox to turn on or off
			let valueBox = this.modelView.modelBuilder.checkBox().withProps({
				label: loc.on,
				CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
			}).component();
			valueContainer.addItem(valueBox, { CSSStyles: { 'margin-right': '0px' } });
			if (parameter.value === 'on') {
				valueBox.checked = true;
			} else {
				valueBox.checked = false;
			}

			this.disposables.push(
				valueBox.onChanged(() => {
					if (valueBox.checked) {
						this.engineSettingUpdates!.set(parameter.parameterName!, loc.on);
					} else {
						this.engineSettingUpdates!.set(parameter.parameterName!, loc.off);
					}
				})
			);

			information.updateProperty('title', loc.allowedValues(`${loc.on},${loc.off}`));
		} else if (parameter.type === 'string') {
			// If type is string, component should be text inputbox
			let valueBox = this.modelView.modelBuilder.inputBox().withProps({
				readOnly: false,
				value: parameter.value,
				CSSStyles: { 'min-width': '50px', 'max-width': '200px' }
			}).component();
			valueContainer.addItem(valueBox, { CSSStyles: { 'margin-right': '0px' } });

			this.disposables.push(
				valueBox.onTextChanged(() => {
					this.engineSettingUpdates!.set(parameter.parameterName!, valueBox.value!);
				})
			);

			information.updateProperty('title', loc.allowedValues(loc.allowedValues('[A-Za-z._]+')));	//TODO
		} else {
			// If type is real or interger, component should be inputbox set to inputType of number. Max and min values also set.
			let valueBox = this.modelView.modelBuilder.inputBox().withProps({
				readOnly: false,
				min: parseInt(parameter.min!),
				max: parseInt(parameter.max!),
				validationErrorMessage: loc.outOfRange(parameter.min!, parameter.max!),
				inputType: 'number',
				value: parameter.value,
				CSSStyles: { 'min-width': '50px', 'max-width': '200px' }
			}).component();
			valueContainer.addItem(valueBox, { CSSStyles: { 'margin-right': '0px' } });

			this.disposables.push(
				valueBox.onTextChanged(() => {
					this.engineSettingUpdates!.set(parameter.parameterName!, valueBox.value!);
				})
			);

			information.updateProperty('title', loc.allowedValues(loc.rangeSetting(parameter.min!, parameter.max!)));
		}

		valueContainer.addItem(information, { CSSStyles: { 'margin-left': '5px' } });
		data.push(valueContainer);

		// Look into hoovering
		data.push(parameter.description);

		// Can reset individual component
		const resetParameter = this.modelView.modelBuilder.button().withProps({
			iconPath: IconPathHelper.reset,
			title: loc.resetToDefault,
			width: '20px',
			height: '20px',
			enabled: true
		}).component();
		data.push(resetParameter);

		this.disposables.push(
			resetParameter.onDidClick(async () => {
				try {
					await vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: loc.updatingInstance(this._postgresModel.info.name),
							cancellable: false
						},
						(_progress, _token) => {
							// azdata arc postgres server edit -n postgres01 -e shared_buffers=
							return this._azdataApi.azdata.arc.postgres.server.edit(
								this._postgresModel.info.name, { engineSettings: parameter.parameterName + '=' });
						}
					);

					vscode.window.showInformationMessage(loc.instanceUpdated(this._postgresModel.info.name));
				} catch (error) {
					vscode.window.showErrorMessage(loc.instanceUpdateFailed(this._postgresModel.info.name, error));
				}
			})
		);

		parameter.components = data;
	}

	private selectComponent() {
		if (!this._postgresModel.engineSettingsLastUpdated) {
			this.parameterContainer!.addItem(this.modelView.modelBuilder.text().withProps({
				value: loc.connectToPostgresDescription,
				CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
			}).component());
			this.parameterContainer!.addItem(this.connectToServerButton!, { CSSStyles: { 'max-width': '125px' } });
			this.parameterContainer!.addItem(this._parametersTableLoading!);
		} else {
			this.parameterContainer!.addItem(this.parametersTable!);
		}
	}

	private handleEngineSettingsUpdated(): void {
		//TODO
	}

	private handleServiceUpdated() {
		// TODO
		if (this._postgresModel.configLastUpdated) {
			this.connectToServerButton!.enabled = true;
			this._parametersTableLoading!.loading = false;
		}
	}
}
