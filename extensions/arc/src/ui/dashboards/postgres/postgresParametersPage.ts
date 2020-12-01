/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as azdataExt from 'azdata-ext';
import * as loc from '../../../localizedConstants';
import { UserCancelledError } from '../../../common/utils';
import { IconPathHelper, cssStyles } from '../../../constants';
import { DashboardPage } from '../../components/dashboardPage';
import { PostgresModel } from '../../../models/postgresModel';

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
	private engineSettingUpdates?: Map<string, string>;

	private readonly _azdataApi: azdataExt.IExtension;

	constructor(protected modelView: azdata.ModelView, private _postgresModel: PostgresModel) {
		super(modelView);
		this._azdataApi = vscode.extensions.getExtension(azdataExt.extension.name)?.exports;

		this.initializeConnectButton();
		this.initializeSearchBox();

		this.engineSettingUpdates = new Map();

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

		content.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.nodeParameters,
			CSSStyles: { ...cssStyles.title }
		}).component());

		const info = this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.nodeParametersDescription,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const link = this.modelView.modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({
			label: loc.learnAboutNodeParameters,
			url: 'https://docs.microsoft.com/azure/azure-arc/data/configure-server-parameters-postgresql-hyperscale',
		}).component();

		const infoAndLink = this.modelView.modelBuilder.flexContainer().withLayout({ flexWrap: 'wrap' }).component();
		infoAndLink.addItem(info, { CSSStyles: { 'margin-right': '5px' } });
		infoAndLink.addItem(link);
		content.addItem(infoAndLink, { CSSStyles: { 'margin-bottom': '20px' } });

		content.addItem(this.searchBox!, { CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px', 'margin-bottom': '20px' } });

		this.parametersTable = this.modelView.modelBuilder.declarativeTable().withProperties<azdata.DeclarativeTableProperties>({
			width: '100%',
			columns: [
				{
					displayName: 'Parameter Name',
					valueType: azdata.DeclarativeDataType.component,
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
					rowCssStyles: {
						...cssStyles.tableRow,
						'overflow': 'hidden',
						'text-overflow': 'ellipsis',
						'white-space': 'nowrap',
						'max-width': '0'
					}
				},
				{
					displayName: 'Description',
					valueType: azdata.DeclarativeDataType.component,
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
			data: [
				this.parameterComponents('TEST NAME', 'string'),
				this.parameterComponents('TEST NAME 2', 'real')]
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
		this.saveButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
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
		this.discardButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.discardText,
			iconPath: IconPathHelper.discard,
			enabled: true //TODO
		}).component();

		this.disposables.push(
			this.discardButton.onDidClick(async () => {
				this.discardButton!.enabled = false;
				try {
					// TODO
					this.parametersTable.data = [
						this.parameterComponents('TEST NAME', 'string')];
					this.engineSettingUpdates!.clear();
				} catch (error) {
					vscode.window.showErrorMessage(loc.pageDiscardFailed(error));
				} finally {
					this.saveButton!.enabled = false;
				}
			}));

		// Reset
		this.resetButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
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
							//all
							// azdata arc postgres server edit -n <server group name> -e '' -re
							try {
								await this._azdataApi.azdata.arc.postgres.server.edit(
									this._postgresModel.info.name, { engineSettings: `'' -re` });
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
		this.connectToServerButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.connectToServer,
			enabled: false,
			CSSStyles: { 'max-width': '125px' }
		}).component();

		this.disposables.push(
			this.connectToServerButton!.onDidClick(async () => {
				this.connectToServerButton!.enabled = false;
				try {
					if (!vscode.extensions.getExtension('microsoft.azuredatastudio-postgresql')) {
						vscode.window.showErrorMessage('Need PostgreSQL extension for Azure Data Studio. Please Install from extensions gallery.');
						this.connectToServerButton!.enabled = true;
					} else {
						await this._postgresModel.getEngineSettings().catch(err => {
							// If an error occurs show a message so the user knows something failed but still
							// fire the event so callers can know to update (e.g. so dashboards don't show the
							// loading icon forever)
							if (err instanceof UserCancelledError) {
								vscode.window.showWarningMessage(loc.pgConnectionRequired);
							}
							this._postgresModel.engineSettingsLastUpdated = new Date();
							this._postgresModel._onEngineSettingsUpdated.fire(this._postgresModel._engineSettings);
							this.connectToServerButton!.enabled = true;
							throw err;
						});

						this.connectToServerButton!.updateCssStyles({ display: 'none' });
						this.parameterContainer!.addItem(this.parametersTable);
					}




				} catch (error) {
					vscode.window.showErrorMessage(loc.fetchEngineSettingsFailed(this._postgresModel.info.name, error));
				}




			}));
	}

	private initializeSearchBox() {
		this.searchBox = this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			readOnly: false,
			placeHolder: loc.searchToFilter
		}).component();

		this.disposables.push(
			this.searchBox.onTextChanged(() => {
				this.filterParameters();
			})
		);
	}

	private filterParameters() {
		//TODO
	}

	private createParametersTable() {
		// Define server settings that shouldn't be modified. we block archive_*, restore_*, and synchronous_commit to prevent the user
		// from messing up our backups. (we rely on synchronous_commit to ensure WAL changes are written immediately.)
		// we block log_* to protect our logging. we block wal_level because Citus needs a particular wal_Level to rebalance shards
		// TODO: Review list of blacklisted parameters. wal_level should only be blacklisted if sharding is enabled
		/* To not be modified
			"archive_command", "archive_timeout", "log_directory", "log_file_mode", "log_filename", "restore_command",
			"shared_preload_libraries", "synchronous_commit", "ssl", "unix_socket_permissions", "wal_level" */

	}

	private parameterComponents(name: string, type: string): any[] {
		let data = [];

		// Set parameter name
		const parameterName = this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: name,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();
		data.push(parameterName);

		// Container to hold input component and information bubble
		const valueContainer = this.modelView.modelBuilder.flexContainer().withLayout({ alignItems: 'center' }).component();

		// Information bubble title to be set depening on type of input
		let information = this.modelView.modelBuilder.button().withProperties<azdata.ComponentWithIconProperties>({
			iconPath: IconPathHelper.information,
			width: '12px',
			height: '12px',
			enabled: false
		}).component();

		if (type === 'enum') {
			// If type is enum, component should be drop down menu
			let valueBox = this.modelView.modelBuilder.dropDown().withProperties<azdata.DropDownProperties>({
				values: [], //TODO,
				value: '', //TODO
				CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
			}).component();
			valueContainer.addItem(valueBox, { CSSStyles: { 'margin-right': '0px', 'margin-bottom': '15px' } });

			this.disposables.push(
				valueBox.onValueChanged(() => {
					this.engineSettingUpdates!.set(name, String(valueBox.value));

				})
			);

			information.updateProperty('title', loc.optionsSetting('enums'));	//TODO
		} else if (type === 'bool') {
			// If type is bool, component should be checkbox to turn on or off
			let valueBox = this.modelView.modelBuilder.checkBox().withProperties<azdata.CheckBoxProperties>({
				label: loc.on,
				checked: true, //TODO
				CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
			}).component();
			valueContainer.addItem(valueBox, { CSSStyles: { 'margin-right': '0px', 'margin-bottom': '15px' } });

			this.disposables.push(
				valueBox.onChanged(() => {
					if (valueBox.checked) {
						this.engineSettingUpdates!.set(name, 'on');
					} else {
						this.engineSettingUpdates!.set(name, 'off');
					}
				})
			);

			information.updateProperty('title', loc.optionsSetting('on,off'));	//TODO
		} else if (type === 'string') {
			// If type is string, component should be text inputbox
			// How to add validation: .withValidation(component => component.value?.search('[0-9]') == -1)
			let valueBox = this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
				readOnly: false,
				value: '', //TODO
				CSSStyles: { 'margin-bottom': '15px', 'min-width': '50px', 'max-width': '200px' }
			}).component();
			valueContainer.addItem(valueBox, { CSSStyles: { 'margin-right': '0px', 'margin-bottom': '15px' } });

			this.disposables.push(
				valueBox.onTextChanged(() => {
					this.engineSettingUpdates!.set(name, valueBox.value!);
				})
			);

			information.updateProperty('title', loc.optionsSetting(loc.optionsSetting('[A-Za-z._]+')));	//TODO
		} else {
			// If type is real or interger, component should be inputbox set to inputType of number. Max and min values also set.
			let valueBox = this.modelView.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
				readOnly: false,
				min: 0, //TODO
				max: 10000,
				validationErrorMessage: loc.outOfRange('min', 'max'), //TODO
				inputType: 'number',
				value: '0', //TODO
				CSSStyles: { 'margin-bottom': '15px', 'min-width': '50px', 'max-width': '200px' }
			}).component();
			valueContainer.addItem(valueBox, { CSSStyles: { 'margin-right': '0px', 'margin-bottom': '15px' } });

			this.disposables.push(
				valueBox.onTextChanged(() => {
					this.engineSettingUpdates!.set(name, valueBox.value!);
				})
			);

			information.updateProperty('title', loc.optionsSetting(loc.rangeSetting('min', 'max')));	//TODO
		}

		valueContainer.addItem(information, { CSSStyles: { 'margin-left': '5px', 'margin-bottom': '15px' } });
		data.push(valueContainer);

		const parameterDescription = this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: 'TEST DESCRIPTION HERE ...............................ytgbyugvtyvctyrcvytjv ycrtctyv tyfty ftyuvuyvuy', // TODO
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();
		data.push(parameterDescription);

		// Can reset individual component
		const resetParameter = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			iconPath: IconPathHelper.ellipse,
			title: loc.resetToDefault,
			width: '20px',
			height: '20px',
			enabled: true
		}).component();
		data.push(resetParameter);

		// azdata arc postgres server edit -n postgres01 -e shared_buffers=
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
							return this._azdataApi.azdata.arc.postgres.server.edit(
								this._postgresModel.info.name, { engineSettings: name + '=' });
						}
					);

					vscode.window.showInformationMessage(loc.instanceUpdated(this._postgresModel.info.name));

				} catch (error) {
					vscode.window.showErrorMessage(loc.instanceUpdateFailed(this._postgresModel.info.name, error));
				}
			}));

		return data;
	}

	// Maybe place in postgres model
	private getPGSettings(): any {

		return {
			parameterName: 'name',
			value: 'settings',
			description: 'short_desc',
			default: 'reset_val',
			min: 'min_val',
			max: 'max_val',
			options: 'enumvals',
			type: 'vartype',
			row: 'data[]'
		};
	}

	private selectComponent() {
		if (!this._postgresModel.engineSettingsLastUpdated) {
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
