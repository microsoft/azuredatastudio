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
import { PostgresModel } from '../../../models/postgresModel';
import { AddPGExtensionsDialog } from '../../dialogs/addPGExtensionsDialog';

export class PostgresExtensionsPage extends DashboardPage {

	private extensionNames: string[] = [];
	private extensionsTable!: azdata.DeclarativeTableComponent;
	private extensionsLoading!: azdata.LoadingComponent;

	private readonly _azdataApi: azdataExt.IExtension;

	constructor(modelView: azdata.ModelView, dashboard: azdata.window.ModelViewDashboard, private _postgresModel: PostgresModel) {
		super(modelView, dashboard);
		this._azdataApi = vscode.extensions.getExtension(azdataExt.extension.name)?.exports;

		this.disposables.push(
			this._postgresModel.onConfigUpdated(() => this.eventuallyRunOnInitialized(() => this.handleConfigUpdated())));
	}

	protected get title(): string {
		return loc.preLoadedExtensions;
	}

	protected get id(): string {
		return 'postgres-extensions';
	}

	protected get icon(): { dark: string; light: string; } {
		return IconPathHelper.extensions;
	}

	protected get container(): azdata.Component {
		const root = this.modelView.modelBuilder.divContainer().component();
		const content = this.modelView.modelBuilder.divContainer().component();
		root.addItem(content, { CSSStyles: { 'margin': '10px 20px 0px 20px' } });

		content.addItem(this.modelView.modelBuilder.text().withProps({
			value: this.title,
			CSSStyles: { ...cssStyles.title }
		}).component());

		content.addItem(this.modelView.modelBuilder.text().withProps({
			value: loc.extensionsDescription,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component());

		const info = this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.extensionsFunction,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const link = this.modelView.modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({
			label: loc.learnMore,
			url: 'https://www.postgresql.org/docs/12/external-extensions.html',
		}).component();

		const infoAndLink = this.modelView.modelBuilder.flexContainer().withLayout({ flexWrap: 'wrap' }).component();
		infoAndLink.addItem(info, { CSSStyles: { 'margin-right': '5px' } });
		infoAndLink.addItem(link);
		content.addItem(infoAndLink, { CSSStyles: { 'margin-bottom': '15px', 'margin-top': '25px' } });

		this.extensionsTable = this.modelView.modelBuilder.declarativeTable().withProperties<azdata.DeclarativeTableProperties>({
			ariaLabel: loc.extensionsTableLabel,
			width: '100%',
			columns: [
				{
					displayName: loc.extensionName,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '95%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: loc.dropText,
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: false,
					width: '10%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				}
			],
			data: []
		}).component();

		this.extensionsLoading = this.modelView.modelBuilder.loadingComponent()
			.withItem(this.extensionsTable)
			.withProperties<azdata.LoadingComponentProperties>({
				loading: !this._postgresModel.configLastUpdated,
				loadingText: loc.extensionsTableLoading,
				loadingCompletedText: loc.extensionsTableLoadingComplete
			}).component();

		content.addItem(this.extensionsLoading, { CSSStyles: cssStyles.text });

		this.initialized = true;
		return root;
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		// Add extensions
		const addExtensionsButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.addExtensions,
			iconPath: IconPathHelper.add
		}).component();

		this.disposables.push(
			addExtensionsButton.onDidClick(async () => {
				const addExtDialog = new AddPGExtensionsDialog(this._postgresModel);
				addExtDialog.showDialog(loc.addExtensions);

				let extArg = await addExtDialog.waitForClose();
				if (extArg) {
					try {

						await vscode.window.withProgress(
							{
								location: vscode.ProgressLocation.Notification,
								title: loc.updatingInstance(this._postgresModel.info.name),
								cancellable: false
							},
							async (_progress, _token): Promise<void> => {


								await this._azdataApi.azdata.arc.postgres.server.edit(
									this._postgresModel.info.name,
									{
										extensions: this.extensionNames.join() + extArg
									},
									this._postgresModel.controllerModel.azdataAdditionalEnvVars);

								try {
									await this._postgresModel.refresh();
								} catch (error) {
									vscode.window.showErrorMessage(loc.refreshFailed(error));
								}
							}
						);

						vscode.window.showInformationMessage(loc.instanceUpdated(this._postgresModel.info.name));

					} catch (error) {
						vscode.window.showErrorMessage(loc.instanceUpdateFailed(this._postgresModel.info.name, error));
					}
				}
			}));

		return this.modelView.modelBuilder.toolbarContainer().withToolbarItems([
			{ component: addExtensionsButton }
		]).component();
	}

	private refreshExtensionsTable(): void {

		if (this._postgresModel.config) {
			let extensions = this._postgresModel.config?.spec.engine.extensions;
			this.extensionsTable.data = extensions.map(e => {
				this.extensionNames.push(e.name);

				// Can drop individual extensions
				let dropExtensionsButton = this.modelView.modelBuilder.button().withProps({
					iconPath: IconPathHelper.delete,
					title: loc.dropExtension,
					width: '20px',
					height: '20px',
					enabled: true
				}).component();

				this.disposables.push(
					dropExtensionsButton.onDidClick(async () => {
						try {
							await vscode.window.withProgress(
								{
									location: vscode.ProgressLocation.Notification,
									title: loc.updatingInstance(this._postgresModel.info.name),
									cancellable: false
								},
								async (_progress, _token): Promise<void> => {
									let index = this.extensionNames.indexOf(e.name, 0);
									let extArg = this.extensionNames.splice(index, 1);

									await this._azdataApi.azdata.arc.postgres.server.edit(
										this._postgresModel.info.name,
										{
											extensions: extArg.join()
										},
										this._postgresModel.controllerModel.azdataAdditionalEnvVars);

									try {
										await this._postgresModel.refresh();
									} catch (error) {
										vscode.window.showErrorMessage(loc.refreshFailed(error));
									}
								}
							);

							vscode.window.showInformationMessage(loc.instanceUpdated(this._postgresModel.info.name));

						} catch (error) {
							vscode.window.showErrorMessage(loc.instanceUpdateFailed(this._postgresModel.info.name, error));
						}
					})
				);

				return [e.name, dropExtensionsButton];
			});
		}
	}

	private handleConfigUpdated(): void {
		this.extensionsLoading.loading = false;
		this.refreshExtensionsTable();
	}
}
