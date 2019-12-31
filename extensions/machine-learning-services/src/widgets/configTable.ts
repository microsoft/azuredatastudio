/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ApiWrapper } from '../common/apiWrapper';
import { ServerConfigManager } from '../controllers/serverConfigManager';
import * as constants from '../common/constants';

export class ConfigTable {
	private _statusTable: azdata.DeclarativeTableComponent;

	/**
	 *
	 */
	constructor(private _apiWrapper: ApiWrapper, private _serverConfigManager: ServerConfigManager, private _modelBuilder: azdata.ModelBuilder, private _loadingComponent: azdata.LoadingComponent) {
		this._statusTable = this._modelBuilder.declarativeTable()
			.withProperties<azdata.DeclarativeTableProperties>(
				{
					columns: [
						{ // Config
							displayName: constants.mlsConfigTitle,
							valueType: azdata.DeclarativeDataType.component,
							isReadOnly: true,
							width: 175,
							headerCssStyles: {
								'border': 'none',
								'background-color': '#FFFFFF',
								...constants.cssStyles.tableHeader
							},
							rowCssStyles: {
								'border-top': 'solid 1px #ccc',
								'border-bottom': 'solid 1px #ccc',
								'border-left': 'none',
								'border-right': 'none'
							},
						},
						{ // Status icon
							displayName: constants.mlsConfigStatus,
							ariaLabel: constants.mlsConfigStatus,
							valueType: azdata.DeclarativeDataType.component,
							isReadOnly: true,
							width: 25,
							headerCssStyles: {
								'border': 'none',
								'background-color': '#FFFFFF'
							},
							rowCssStyles: {
								'border-top': 'solid 1px #ccc',
								'border-bottom': 'solid 1px #ccc',
								'border-left': 'none',
								'border-right': 'none'
							},
						},
						{ // Action
							displayName: '',
							valueType: azdata.DeclarativeDataType.component,
							isReadOnly: true,
							width: 150,
							headerCssStyles: {
								'border': 'none',
								'background-color': '#FFFFFF',
								...constants.cssStyles.tableHeader
							},
							rowCssStyles: {
								'border-top': 'solid 1px #ccc',
								'border-bottom': 'solid 1px #ccc',
								'border-left': 'none',
								'border-right': 'none'
							},
						}
					],
					data: [],
					ariaLabel: constants.mlsConfigTitle
				})
			.component();
	}

	public get component(): azdata.DeclarativeTableComponent {
		return this._statusTable;
	}

	public async refresh(): Promise<void> {
		this._loadingComponent.updateProperties({ loading: true });
		let connection = await this.getCurrentConnection();
		const speesConfig = await this.addTableRow(constants.mlsExternalExecuteScriptTitle,
			async () => {
				return await this._serverConfigManager.isMachineLearningServiceEnabled(connection);
			}, async (enable) => {
				await this._serverConfigManager.updateExternalScriptConfig(connection, enable);
				this.refresh();
			}
		);

		const pythonConfig = await this.addTableRow(constants.mlsPythonLanguageTitle,
			async () => {
				return await this._serverConfigManager.isPythonInstalled(connection);
			}, async () => {
				await this._serverConfigManager.openInstallDocuments();
			}
		);
		const rConfig = await this.addTableRow(constants.mlsRLanguageTitle,
			async () => {
				return await this._serverConfigManager.isRInstalled(connection);
			}, async () => {
				await this._serverConfigManager.openInstallDocuments();
			}
		);
		this._statusTable.data = [speesConfig, pythonConfig, rConfig];
		this._loadingComponent.updateProperties({ loading: false });
	}

	private async getCurrentConnection(): Promise<azdata.connection.ConnectionProfile> {
		return await this._apiWrapper.getCurrentConnection();
	}

	private async addTableRow(configName: string, checkEnabledFunction: () => Promise<boolean>, updateFunction: (enable: boolean) => Promise<void>): Promise<azdata.Component[]> {
		const isEnabled = await checkEnabledFunction();

		const nameCell = this._modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({
				value: configName,
				CSSStyles: { 'user-select': 'none', ...constants.cssStyles.text }
			}).component();
		const statusIconCell = this._modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({
				value: this.getConfigStatusIcon(isEnabled),
				ariaRole: 'img',
				title: this.getConfigStatusTest(isEnabled),
				CSSStyles: { 'user-select': 'none', ...constants.cssStyles.text }
			}).component();

		const button = this._modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: '',
			title: ''
		}).component();

		button.label = this.getLabel(isEnabled);
		button.onDidClick(async () => {
			await updateFunction(!isEnabled);
			const isEnabledNewValue = await checkEnabledFunction();
			button.label = this.getLabel(isEnabledNewValue);
		});
		return [
			nameCell,
			statusIconCell,
			button
		];
	}

	private getConfigStatusIcon(enabled: boolean): string {
		if (enabled) {
			return '✔️';
		} else {
			return '❌';
		}
	}

	private getConfigStatusTest(enabled: boolean): string {
		if (enabled) {
			return constants.mlsEnableButtonTitle;
		} else {
			return constants.mlsDisableButtonTitle;
		}
	}

	getLabel(isEnabled: boolean): string {
		let enable = constants.mlsEnableButtonTitle;
		let disable = constants.mlsDisableButtonTitle;
		let title = enable;
		if (!isEnabled) {
			title = enable;

		} else {
			title = disable;
		}
		return title;
	}

}
