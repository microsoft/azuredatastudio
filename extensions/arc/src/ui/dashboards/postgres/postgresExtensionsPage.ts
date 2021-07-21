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
	private droppedExtensions: string[] = [];
	private extensionsTable!: azdata.DeclarativeTableComponent;
	private extensionsLoading!: azdata.LoadingComponent;
	private addExtensionsButton!: azdata.ButtonComponent;
	private dropExtensionsButton!: azdata.ButtonComponent;
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
					displayName: '',
					valueType: azdata.DeclarativeDataType.component,
					width: '20px',
					isReadOnly: true,
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: loc.extensionName,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '100%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				}
			],
			dataValues: []
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
			label: loc.loadExtensions,
			ariaLabel: loc.loadExtensions,
			iconPath: IconPathHelper.add
		}).component();

		this.disposables.push(
			this.addExtensionsButton.onDidClick(async () => {
				const addExtDialog = new AddPGExtensionsDialog(this._postgresModel);
				addExtDialog.showDialog(loc.loadExtensions);

				let extArg = await addExtDialog.waitForClose();
				if (extArg) {
					try {
						this.addExtensionsButton.enabled = false;
						this.dropExtensionsButton.enabled = false;
						let extensionList = this.extensionNames.length ? this.extensionNames.join() + ',' + extArg : extArg;
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

						vscode.window.showInformationMessage(loc.extensionsAdded(extArg));

					} catch (error) {
						vscode.window.showErrorMessage(loc.updateExtensionsFailed(error));
					} finally {
						this.addExtensionsButton.enabled = true;
					}
				}
			}));

		// Drop extensions
		this.dropExtensionsButton = this.modelView.modelBuilder.button().withProps({
			label: loc.unloadExtensions,
			ariaLabel: loc.unloadExtensions,
			iconPath: IconPathHelper.delete,
			enabled: false
		}).component();

		this.disposables.push(
			this.dropExtensionsButton.onDidClick(async () => {
				try {
					this.addExtensionsButton.enabled = false;
					this.dropExtensionsButton.enabled = false;
					await this.dropExtension();

					try {
						await this._postgresModel.refresh();
					} catch (error) {
						vscode.window.showErrorMessage(loc.refreshFailed(error));
					}

					vscode.window.showInformationMessage(loc.extensionsDropped(this.droppedExtensions.join()));
					this.droppedExtensions = [];

				} catch (error) {
					vscode.window.showErrorMessage(loc.updateExtensionsFailed(error));
				} finally {
					this.addExtensionsButton.enabled = true;
				}
			}));

		return this.modelView.modelBuilder.toolbarContainer().withToolbarItems([
			{ component: this.addExtensionsButton },
			{ component: this.dropExtensionsButton }
		]).component();
	}

	private refreshExtensionsTable(): void {
		let extensions = this._postgresModel.config!.spec.engine.extensions;
		let extenesionFinalData: azdata.DeclarativeTableCellValue[][] = [];
		let extensionBasicData: (string | azdata.CheckBoxComponent | azdata.ImageComponent)[][] = [];

		if (extensions) {
			extensionBasicData = extensions.map(e => {
				this.extensionNames.push(e.name);
				return [this.createDropCheckBox(e.name), e.name];
			});
		} else {
			extensionBasicData = [[this.modelView.modelBuilder.image().component(), loc.noExtensions]];
		}

		extenesionFinalData = extensionBasicData.map(e => {
			return e.map((value): azdata.DeclarativeTableCellValue => {
				return { value: value };
			});
		});

		this.extensionsTable.setDataValues(extenesionFinalData);
	}

	/**
	 * Creates checkboxes to select which extensions to drop.
	 * Allows user to drop multiple extension.
	 * @param name name of postgres extension the checkbox will be tied to.
	 */
	public createDropCheckBox(name: string): azdata.CheckBoxComponent {
		// Can select extensions to drop
		let checkBox = this.modelView.modelBuilder.checkBox().withProps({
			ariaLabel: loc.unloadExtensions,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		this.disposables.push(
			checkBox.onChanged(() => {
				if (checkBox.checked) {
					this.droppedExtensions.push(name);
					this.dropExtensionsButton.focus();
				} else {
					let index = this.droppedExtensions.indexOf(name, 0);
					this.droppedExtensions.splice(index, 1);
				}
				this.dropExtensionsButton.enabled = this.droppedExtensions.length ? true : false;
			})
		);

		return checkBox;
	}

	/**
	 * Calls edit on postgres extensions with an updated extensions list.
	 */
	public async dropExtension(): Promise<void> {
		this.droppedExtensions.forEach(d => {
			let index = this.droppedExtensions.indexOf(d, 0);
			this.extensionNames.splice(index, 1);
		});

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
						extensions: this.extensionNames.join()
					},
					this._postgresModel.controllerModel.azdataAdditionalEnvVars
				);
			}
		);
	}

	private handleConfigUpdated(): void {
		if (this._postgresModel.config) {
			this.extensionsLoading.loading = false;
			this.extensionsLink.url = `https://www.postgresql.org/docs/${this._postgresModel.engineVersion}/external-extensions.html`;
			this.extensionNames = [];
			this.refreshExtensionsTable();
			this.addExtensionsButton.focus();
		}
	}
}
