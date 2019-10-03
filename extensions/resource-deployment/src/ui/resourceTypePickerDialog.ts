/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { DialogBase } from './dialogBase';
import { ResourceType, AgreementInfo, DeploymentProvider } from '../interfaces';
import { IResourceTypeService } from '../services/resourceTypeService';
import { IToolsService } from '../services/toolsService';
import { EOL } from 'os';
import { createFlexContainer } from './modelViewUtils';

const localize = nls.loadMessageBundle();

export class ResourceTypePickerDialog extends DialogBase {
	private toolRefreshTimestamp: number = 0;
	private _selectedResourceType: ResourceType;
	private _resourceTypeCards: azdata.CardComponent[] = [];
	private _view!: azdata.ModelView;
	private _resourceDescriptionLabel!: azdata.TextComponent;
	private _optionsContainer!: azdata.FlexContainer;
	private _toolsTable!: azdata.TableComponent;
	private _cardResourceTypeMap: Map<string, azdata.CardComponent> = new Map();
	private _optionDropDownMap: Map<string, azdata.DropDownComponent> = new Map();
	private _toolsLoadingComponent!: azdata.LoadingComponent;
	private _agreementContainer!: azdata.DivContainer;
	private _agreementCheckboxChecked: boolean = false;

	constructor(
		private toolsService: IToolsService,
		private resourceTypeService: IResourceTypeService,
		resourceType: ResourceType) {
		super(localize('resourceTypePickerDialog.title', "Select the deployment options"), 'ResourceTypePickerDialog', true);
		this._selectedResourceType = resourceType;
		this._dialogObject.okButton.label = localize('deploymentDialog.OKButtonText', 'Select');
	}

	initialize() {
		let tab = azdata.window.createTab('');
		this._dialogObject.registerCloseValidator(() => {
			const isValid = this._selectedResourceType && (this._selectedResourceType.agreement === undefined || this._agreementCheckboxChecked);
			if (!isValid) {
				this._dialogObject.message = {
					text: localize('deploymentDialog.AcceptAgreements', "You must agree to the license agreements in order to proceed."),
					level: azdata.window.MessageLevel.Error
				};
			}
			return isValid;
		});
		tab.registerContent((view: azdata.ModelView) => {
			const tableWidth = 1126;
			this._view = view;
			this.resourceTypeService.getResourceTypes().forEach(resourceType => this.addCard(resourceType));
			const cardsContainer = view.modelBuilder.flexContainer().withItems(this._resourceTypeCards, { flex: '0 0 auto', CSSStyles: { 'margin-bottom': '10px' } }).withLayout({ flexFlow: 'row' }).component();
			this._resourceDescriptionLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: this._selectedResourceType ? this._selectedResourceType.description : undefined }).component();
			this._optionsContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
			this._agreementContainer = view.modelBuilder.divContainer().component();
			const toolColumn: azdata.TableColumn = {
				value: localize('deploymentDialog.toolNameColumnHeader', 'Tool'),
				width: 150
			};
			const descriptionColumn: azdata.TableColumn = {
				value: localize('deploymentDialog.toolDescriptionColumnHeader', 'Description'),
				width: 650
			};
			const installStatusColumn: azdata.TableColumn = {
				value: localize('deploymentDialog.toolStatusColumnHeader', 'Installed'),
				width: 100
			};
			const versionColumn: azdata.TableColumn = {
				value: localize('deploymentDialog.toolVersionColumnHeader', 'Version'),
				width: 100
			};

			this._toolsTable = view.modelBuilder.table().withProperties<azdata.TableComponentProperties>({
				data: [],
				columns: [toolColumn, descriptionColumn, installStatusColumn, versionColumn],
				width: tableWidth
			}).component();

			const toolsTableWrapper = view.modelBuilder.divContainer().withLayout({ width: tableWidth }).component();
			toolsTableWrapper.addItem(this._toolsTable, { CSSStyles: { 'border-left': '1px solid silver', 'border-top': '1px solid silver' } });
			this._toolsLoadingComponent = view.modelBuilder.loadingComponent().withItem(toolsTableWrapper).component();
			const formBuilder = view.modelBuilder.formContainer().withFormItems(
				[
					{
						component: cardsContainer,
						title: ''
					}, {
						component: this._resourceDescriptionLabel,
						title: ''
					}, {
						component: this._agreementContainer,
						title: ''
					},
					{
						component: this._optionsContainer,
						title: localize('deploymentDialog.OptionsTitle', 'Options')
					}, {
						component: this._toolsLoadingComponent,
						title: localize('deploymentDialog.RequiredToolsTitle', 'Required tools')
					}
				],
				{
					horizontal: false
				}
			);

			const form = formBuilder.withLayout({ width: '100%' }).component();

			return view.initializeModel(form).then(() => {
				if (this._selectedResourceType) {
					this.selectResourceType(this._selectedResourceType);
				}
			});
		});
		this._dialogObject.content = [tab];
	}

	private addCard(resourceType: ResourceType): void {
		const card = this._view.modelBuilder.card().withProperties<azdata.CardProperties>({
			cardType: azdata.CardType.VerticalButton,
			iconPath: {
				dark: resourceType.icon.dark,
				light: resourceType.icon.light
			},
			label: resourceType.displayName,
			selected: (this._selectedResourceType && this._selectedResourceType.name === resourceType.name),
			width: '220px',
			height: '180px',
			iconWidth: '50px',
			iconHeight: '50px'
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
		this._agreementCheckboxChecked = false;
		this._agreementContainer.clearItems();
		if (resourceType.agreement) {
			this._agreementContainer.addItem(this.createAgreementCheckbox(resourceType.agreement));
		}

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
		this.toolRefreshTimestamp = new Date().getTime();
		const currentRefreshTimestamp = this.toolRefreshTimestamp;
		const toolRequirements = this.getCurrentProvider().requiredTools;
		const headerRowHeight = 28;
		this._toolsTable.height = 25 * Math.max(toolRequirements.length, 1) + headerRowHeight;
		this._dialogObject.message = {
			text: ''
		};
		if (toolRequirements.length === 0) {
			this._dialogObject.okButton.enabled = true;
			this._toolsTable.data = [[localize('deploymentDialog.NoRequiredTool', "No tools required"), '']];
		} else {
			const tools = toolRequirements.map(toolReq => {
				return this.toolsService.getToolByName(toolReq.name)!;
			});
			this._toolsLoadingComponent.loading = true;
			this._dialogObject.okButton.enabled = false;

			Promise.all(tools.map(tool => tool.loadInformation())).then(() => {
				// If the local timestamp does not match the class level timestamp, it means user has changed options, ignore the results
				if (this.toolRefreshTimestamp !== currentRefreshTimestamp) {
					return;
				}
				const messages: string[] = [];
				this._toolsTable.data = toolRequirements.map(toolRef => {
					const tool = this.toolsService.getToolByName(toolRef.name)!;
					if (!tool.isInstalled) {
						messages.push(localize('deploymentDialog.ToolInformation', "{0}: {1}", tool.displayName, tool.homePage));
						if (tool.statusDescription !== undefined) {
							console.warn(localize('deploymentDialog.DetailToolStatusDescription', "Additional status information for tool: {0}. {1}", tool.name, tool.statusDescription));
						}
					}
					return [tool.displayName, tool.description, tool.isInstalled ? localize('deploymentDialog.YesText', "Yes") : localize('deploymentDialog.NoText', "No"), tool.version ? tool.version.version : ''];
				});
				this._dialogObject.okButton.enabled = messages.length === 0;
				if (messages.length !== 0) {
					messages.push(localize('deploymentDialog.VersionInformationDebugHint', "You will need to restart Azure Data Studio if the tools are installed after Azure Data Studio is launched to pick up the updated PATH environment variable. You may find additional details in the debug console."));
					this._dialogObject.message = {
						level: azdata.window.MessageLevel.Error,
						text: localize('deploymentDialog.ToolCheckFailed', "Some required tools are not installed or do not meet the minimum version requirement."),
						description: messages.join(EOL)
					};
				}
				this._toolsLoadingComponent.loading = false;
			});
		}
	}

	private createAgreementCheckbox(agreementInfo: AgreementInfo): azdata.FlexContainer {
		const checkbox = this._view.modelBuilder.checkBox().component();
		checkbox.checked = false;
		this._toDispose.push(checkbox.onChanged(() => {
			this._agreementCheckboxChecked = !!checkbox.checked;
		}));
		const text = this._view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: agreementInfo.template,
			links: agreementInfo.links,
			requiredIndicator: true
		}).component();
		return createFlexContainer(this._view, [checkbox, text]);
	}

	private getCurrentProvider(): DeploymentProvider {
		const options: { option: string, value: string }[] = [];

		this._optionDropDownMap.forEach((selectBox, option) => {
			let selectedValue: azdata.CategoryValue = selectBox.value as azdata.CategoryValue;
			options.push({ option: option, value: selectedValue.name });
		});

		return this._selectedResourceType.getProvider(options)!;
	}

	protected onComplete(): void {
		this.resourceTypeService.startDeployment(this.getCurrentProvider());
	}
}
