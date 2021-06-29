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
import { Deferred } from '../../../common/promise';

export class PostgresExtensionsPage extends DashboardPage {

	private extensionNames: string[] = [];
	private extensionsTable!: azdata.DeclarativeTableComponent;
	private extensionsLoading!: azdata.LoadingComponent;
	private addExtensionsButton!: azdata.ButtonComponent;
	private _dropExtPromise?: Deferred<void>;
	private extensionsLink!: azdata.HyperlinkComponent;

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

		const info = this.modelView.modelBuilder.text().withProps({
			value: loc.extensionsFunction,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		this.extensionsLink = this.modelView.modelBuilder.hyperlink().withProps({
			label: loc.learnMore,
			url: 'https://www.postgresql.org/docs/12/external-extensions.html',
		}).component();

		const infoAndLink = this.modelView.modelBuilder.flexContainer().withLayout({ flexWrap: 'wrap' }).component();
		infoAndLink.addItem(info, { CSSStyles: { 'margin-right': '5px' } });
		infoAndLink.addItem(this.extensionsLink);
		content.addItem(infoAndLink, { CSSStyles: { 'margin-bottom': '15px', 'margin-top': '25px' } });

		this.extensionsTable = this.modelView.modelBuilder.declarativeTable().withProps({
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
			.withItem(this.extensionsTable).withProps({
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
		this.addExtensionsButton = this.modelView.modelBuilder.button().withProps({
			label: loc.addExtensions,
			ariaLabel: loc.addExtensions,
			iconPath: IconPathHelper.add
		}).component();

		this.disposables.push(
			this.addExtensionsButton.onDidClick(async () => {
				const addExtDialog = new AddPGExtensionsDialog(this._postgresModel);
				addExtDialog.showDialog(loc.addExtensions);

				let extArg = await addExtDialog.waitForClose();
				if (extArg) {
					try {
						this.addExtensionsButton.enabled = false;
						let extensionList = this.extensionNames.join() + ',' + extArg;
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
										extensions: extensionList
									},
									this._postgresModel.controllerModel.azdataAdditionalEnvVars);

								try {
									await this._postgresModel.refresh();
								} catch (error) {
									vscode.window.showErrorMessage(loc.refreshFailed(error));
								}
							}
						);

						vscode.window.showInformationMessage(loc.extensionsAdded(extensionList));

					} catch (error) {
						vscode.window.showErrorMessage(loc.updateExtensionsFailed(error));
					} finally {
						this.addExtensionsButton.enabled = true;
					}
				}
			}));

		return this.modelView.modelBuilder.toolbarContainer().withToolbarItems([
			{ component: this.addExtensionsButton }
		]).component();
	}

	private refreshExtensionsTable(): void {
		let extensions = this._postgresModel.config!.spec.engine.extensions;
		this.extensionsTable.data = extensions.map(e => {

			this.extensionNames.push(e.name);

			return [e.name, this.createDropButton(e.name)];
		});
	}

	/**
	 * Creates drop button to add to each row of extensions table.
	 * Allows user to drop individual extension.
	 * @param name name of postgres extension the drop button will be tied to.
	 */
	public createDropButton(name: string): azdata.ButtonComponent {
		// Can drop individual extensions
		let button = this.modelView.modelBuilder.button().withProps({
			iconPath: IconPathHelper.delete,
			ariaLabel: loc.dropExtension,
			title: loc.dropExtension,
			width: '20px',
			height: '20px',
			enabled: true
		}).component();

		this.disposables.push(
			button.onDidClick(async () => {
				try {
					this.addExtensionsButton.enabled = false;
					button.enabled = false;
					await this.dropExtension(name);

					try {
						await this._postgresModel.refresh();
					} catch (error) {
						vscode.window.showErrorMessage(loc.refreshFailed(error));
					}

					vscode.window.showInformationMessage(loc.extensionDropped(name));

				} catch (error) {
					vscode.window.showErrorMessage(loc.updateExtensionsFailed(error));
				} finally {
					this.addExtensionsButton.enabled = true;
				}
			})
		);

		// Dropping the citus extension is not supported.
		if (name === 'citus') {
			button.enabled = false;
		}

		return button;
	}

	/**
	 * Calls edit on postgres extensions with an updated extensions list.
	 * @param name name of postgres extension to not inlcude when editing list of extensions
	 */
	public async dropExtension(name: string): Promise<void> {
		// Only allow one drop to be happening at a time
		if (this._dropExtPromise) {
			vscode.window.showErrorMessage(loc.dropMultipleExtensions);
			return this._dropExtPromise.promise;
		}

		this._dropExtPromise = new Deferred();
		try {
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: loc.updatingInstance(this._postgresModel.info.name),
					cancellable: false
				},
				async (_progress, _token): Promise<void> => {
					let index = this.extensionNames.indexOf(name, 0);
					this.extensionNames.splice(index, 1);

					await this._azdataApi.azdata.arc.postgres.server.edit(
						this._postgresModel.info.name,
						{
							extensions: this.extensionNames.join()
						},
						this._postgresModel.controllerModel.azdataAdditionalEnvVars
					);
				}
			);
			this._dropExtPromise.resolve();
		} catch (err) {
			this._dropExtPromise.reject(err);
			throw err;
		} finally {
			this._dropExtPromise = undefined;
		}
	}

	private handleConfigUpdated(): void {
		if (this._postgresModel.config) {
			this.extensionsLoading.loading = false;
			this.extensionsLink.url = `https://www.postgresql.org/docs/${this._postgresModel.engineVersion}/external-extensions.html`;
			this.extensionNames = [];
			this.refreshExtensionsTable();
		}
	}
}
