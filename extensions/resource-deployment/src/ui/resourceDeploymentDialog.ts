/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { IResourceTypeService } from '../services/resourceTypeService';
import * as vscode from 'vscode';
import { ResourceType, DeploymentProvider, ToolStatus } from '../interfaces';
import { IToolsService } from '../services/toolsService';
import { INotebookService } from '../services/notebookService';

const localize = nls.loadMessageBundle();

export class ResourceDeploymentDialog {
	private _selectedResourceType: ResourceType;
	private _toDispose: vscode.Disposable[] = [];
	private _dialogObject: azdata.window.Dialog;
	private _resourceTypeCards: azdata.CardComponent[] = [];
	private _view!: azdata.ModelView;
	private _resourceDescriptionLabel!: azdata.TextComponent;
	private _optionsContainer!: azdata.FlexContainer;
	private _toolsTable!: azdata.TableComponent;
	private _toolsTableLoadingComponent!: azdata.LoadingComponent;
	private _installButton!: azdata.ButtonComponent;
	private _refreshButton!: azdata.ButtonComponent;
	private _configureButton!: azdata.ButtonComponent;
	private _cardResourceTypeMap: Map<string, azdata.CardComponent> = new Map();
	private _optionDropDownMap: Map<string, azdata.DropDownComponent> = new Map();

	constructor(private context: vscode.ExtensionContext,
		private notebookService: INotebookService,
		private toolsService: IToolsService,
		private resourceTypeService: IResourceTypeService,
		resourceType: ResourceType) {
		this._selectedResourceType = resourceType;
		this._dialogObject = azdata.window.createModelViewDialog(localize('deploymentDialog.title', 'Select a configuration'), 'resourceDeploymentDialog', true);
		this._dialogObject.cancelButton.onClick(() => this.onCancel());
		this._dialogObject.okButton.label = localize('deploymentDialog.OKButtonText', 'Select');
		this._dialogObject.okButton.onClick(() => this.onComplete());
	}

	private initializeDialog() {
		let tab = azdata.window.createTab('');
		tab.registerContent((view: azdata.ModelView) => {
			const tableWidth = 1126;
			this._view = view;
			this.resourceTypeService.getResourceTypes().forEach(resourceType => this.addCard(resourceType));
			const cardsContainer = view.modelBuilder.flexContainer().withItems(this._resourceTypeCards, { flex: '0 0 auto', CSSStyles: { 'margin-bottom': '10px' } }).withLayout({ flexFlow: 'row', alignItems: 'left' }).component();
			this._resourceDescriptionLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: this._selectedResourceType ? this._selectedResourceType.description : undefined }).component();
			this._optionsContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();

			const toolColumn: azdata.TableColumn = {
				value: localize('deploymentDialog.toolNameColumnHeader', 'Tool'),
				width: 100
			};
			const descriptionColumn: azdata.TableColumn = {
				value: localize('deploymentDialog.toolDescriptionColumnHeader', 'Description'),
				width: 500
			};
			const localVersionColumn: azdata.TableColumn = {
				value: localize('deploymentDialog.toolInstalledVersionColumnHeader', 'Local Version'),
				width: 100
			};
			const requiredVersionColumn: azdata.TableColumn = {
				value: localize('deploymentDialog.toolRequiredVersionColumnHeader', 'Required Version'),
				width: 100
			};
			const statusColumn: azdata.TableColumn = {
				value: localize('deploymentDialog.toolStatusColumnHeader', 'Status'),
				width: 200
			};

			this._toolsTable = view.modelBuilder.table().withProperties<azdata.TableComponentProperties>({
				height: 150,
				data: [],
				columns: [toolColumn, descriptionColumn, localVersionColumn, requiredVersionColumn, statusColumn],
				width: tableWidth
			}).component();

			const toolsTableWrapper = view.modelBuilder.divContainer().withLayout({ width: tableWidth }).component();
			toolsTableWrapper.addItem(this._toolsTable, { CSSStyles: { 'border-left': '1px solid silver' } });

			this._toolsTableLoadingComponent = view.modelBuilder.loadingComponent().withItem(toolsTableWrapper).component();

			this._refreshButton = this.createButton(view, localize('resourceDeployment.refreshButton', 'Refresh Tools'), () => {
				this.updateTools();
			});

			this._configureButton = this.createButton(view, localize('resourceDeployment.configureButton', 'Configure Path'), () => {
				// TODO
			});

			this._installButton = this.createButton(view, localize('resourceDeployment.installButton', 'Install Tools'), () => {
				// TODO
			});

			this._installButton.enabled = false;
			this._configureButton.enabled = false;
			this._refreshButton.enabled = false;

			const buttonContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row', justifyContent: 'flex-end', width: tableWidth }).component();
			buttonContainer.addItems([this._refreshButton, this._configureButton, this._installButton], { flex: '0 0 auto', CSSStyles: { 'margin-left': '5px' } });
			const formBuilder = view.modelBuilder.formContainer().withFormItems(
				[
					{
						component: cardsContainer,
						title: ''
					}, {
						component: this._resourceDescriptionLabel,
						title: ''
					}, {
						component: this._optionsContainer,
						title: localize('deploymentDialog.OptionsTitle', 'Options')
					}, {
						component: this._toolsTableLoadingComponent,
						title: localize('deploymentDialog.RequiredToolsTitle', 'Required tools')
					}, {
						component: buttonContainer,
						title: ''
					}
				],
				{
					horizontal: false
				}
			);

			const form = formBuilder.withLayout({ width: '100%' }).component();

			if (this._selectedResourceType) {
				this.selectResourceType(this._selectedResourceType);
			}

			return view.initializeModel(form);
		});
		this._dialogObject.content = [tab];
	}

	public open(): void {
		this.initializeDialog();
		azdata.window.openDialog(this._dialogObject);
	}

	private addCard(resourceType: ResourceType): void {
		const card = this._view.modelBuilder.card().withProperties<azdata.CardProperties>({
			cardType: azdata.CardType.VerticalButton,
			iconPath: {
				dark: this.context.asAbsolutePath(resourceType.icon.dark),
				light: this.context.asAbsolutePath(resourceType.icon.light)
			},
			label: resourceType.displayName,
			selected: (this._selectedResourceType && this._selectedResourceType.name === resourceType.name)
		}).component();

		this._resourceTypeCards.push(card);
		this._cardResourceTypeMap.set(resourceType.name, card);
		this._toDispose.push(card.onCardSelectedChanged(() => this.selectResourceType(resourceType)));
	}

	private selectResourceType(resourceType: ResourceType): void {
		this._selectedResourceType = resourceType;
		const card = this._cardResourceTypeMap.get(this._selectedResourceType.name)!;
		if (card.selected) {
			// clear the selected state of the previously selected card
			this._resourceTypeCards.forEach(c => {
				if (c !== card) {
					c.selected = false;
				}
			});
		} else {
			// keep the selected state if no other card is selected
			if (this._resourceTypeCards.filter(c => { return c !== card && c.selected; }).length === 0) {
				card.selected = true;
			}
		}

		this._resourceDescriptionLabel.value = resourceType.description;
		this._optionsContainer.clearItems();
		this._optionDropDownMap.clear();
		resourceType.options.forEach(option => {
			const optionLabel = this._view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
				value: option.displayName
			}).component();
			optionLabel.width = '150px';

			const optionSelectBox = this._view.modelBuilder.dropDown().withProperties<azdata.DropDownProperties>({
				values: option.values,
				value: option.values[0],
				width: '300px'
			}).component();

			this._toDispose.push(optionSelectBox.onValueChanged(() => { this.updateTools(); }));
			this._optionDropDownMap.set(option.name, optionSelectBox);
			const row = this._view.modelBuilder.flexContainer().withItems([optionLabel, optionSelectBox], { flex: '0 0 auto', CSSStyles: { 'margin-right': '20px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
			this._optionsContainer.addItem(row);
		});
		this.updateTools();
	}

	private updateTools(): void {
		this._toolsTableLoadingComponent.loading = true;
		this._installButton.enabled = false;
		this._configureButton.enabled = false;
		this._refreshButton.enabled = false;
		this.toolsService.getStatusForTools(this.getCurrentProvider().requiredTools).then(statusList => {
			this._toolsTable.height = 25 * statusList.length + 28; // header row height
			this._toolsTable.data = statusList.map(toolStatus => [toolStatus.name, toolStatus.description, toolStatus.version, toolStatus.versionRequirement, this.getToolStatusText(toolStatus.status)]);
			this._toolsTableLoadingComponent.loading = false;
			this._installButton.enabled = true;
			this._configureButton.enabled = true;
			this._refreshButton.enabled = true;
		});
	}

	private getToolStatusText(status: ToolStatus): string {
		switch (status) {
			case ToolStatus.Installed:
				return '✔️ ' + localize('deploymentDialog.InstalledText', 'Installed');
			case ToolStatus.NotInstalled:
				return '❌ ' + localize('deploymentDialog.NotInstalledText', 'Not Installed');
			case ToolStatus.Installing:
				return '⌛ ' + localize('deploymentDialog.InstallingText', 'Installing…');
			case ToolStatus.FailedToInstall:
				return '❌ ' + localize('deploymentDialog.FailedToInstallText', 'Install Failed');
			default:
				return 'unknown status';
		}
	}

	private getCurrentProvider(): DeploymentProvider {
		const options: { option: string, value: string }[] = [];

		this._optionDropDownMap.forEach((selectBox, option) => {
			let selectedValue: azdata.CategoryValue = selectBox.value as azdata.CategoryValue;
			options.push({ option: option, value: selectedValue.name });
		});

		return this._selectedResourceType.getProvider(options)!;
	}

	private createButton(view: azdata.ModelView, text: string, handler: () => void): azdata.ButtonComponent {
		const button = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: text,
			width: '150px'
		}).component();
		this._toDispose.push(button.onDidClick(() => {
			handler();
		}));
		return button;
	}

	private onCancel(): void {
		this.dispose();
	}

	private onComplete(): void {
		const provider = this.getCurrentProvider();
		this.notebookService.launchNotebook(provider.notebook);
		this.dispose();
	}

	private dispose(): void {
		this._toDispose.forEach(disposable => disposable.dispose());
	}
}
