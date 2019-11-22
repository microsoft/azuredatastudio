/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { EOL } from 'os';
import * as nls from 'vscode-nls';
import { AgreementInfo, DeploymentProvider, ITool, ResourceType } from '../interfaces';
import { IResourceTypeService } from '../services/resourceTypeService';
import { IToolsService } from '../services/toolsService';
import { getErrorMessage, setEnvironmentVariablesForInstallPaths } from '../utils';
import { DialogBase } from './dialogBase';
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
	private _installToolButton: azdata.window.Button;
	private _tools: ITool[] = [];
	private _cardsContainer!: azdata.FlexContainer;

	constructor(
		private toolsService: IToolsService,
		private resourceTypeService: IResourceTypeService,
		resourceType: ResourceType) {
		super(localize('resourceTypePickerDialog.title', "Select the deployment options (preview)"), 'ResourceTypePickerDialog', true);
		this._selectedResourceType = resourceType;
		this._installToolButton = azdata.window.createButton(localize('deploymentDialog.InstallToolsButton', "Install tools"));
		this._toDispose.push(this._installToolButton.onClick(() => {
			this.installTools();
		}));
		this._dialogObject.customButtons = [this._installToolButton];
		this._installToolButton.hidden = true;
		this._dialogObject.okButton.label = localize('deploymentDialog.OKButtonText', "Select");
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
			this.resourceTypeService.getResourceTypes().sort((a: ResourceType, b: ResourceType) => {
				return (a.displayIndex || Number.MAX_VALUE) - (b.displayIndex || Number.MAX_VALUE);
			}).forEach(resourceType => this.addCard(resourceType));
			this._cardsContainer = view.modelBuilder.flexContainer().withItems(this._resourceTypeCards, { flex: '0 0 auto', CSSStyles: { 'margin-bottom': '10px' } }).withLayout({ flexFlow: 'row' }).component();
			this._resourceDescriptionLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: this._selectedResourceType ? this._selectedResourceType.description : undefined }).component();
			this._optionsContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
			this._agreementContainer = view.modelBuilder.divContainer().component();
			const toolColumn: azdata.TableColumn = {
				value: localize('deploymentDialog.toolNameColumnHeader', "Tool"),
				width: 70
			};
			const descriptionColumn: azdata.TableColumn = {
				value: localize('deploymentDialog.toolDescriptionColumnHeader', "Description"),
				width: 650
			};
			const installStatusColumn: azdata.TableColumn = {
				value: localize('deploymentDialog.toolStatusColumnHeader', "Status"),
				width: 70
			};
			const versionColumn: azdata.TableColumn = {
				value: localize('deploymentDialog.toolVersionColumnHeader', "Installed Version"),
				width: 90
			};
			const minVersionColumn: azdata.TableColumn = {
				value: localize('deploymentDialog.toolMinimumVersionColumnHeader', "Required Version"),
				width: 90
			};

			this._toolsTable = view.modelBuilder.table().withProperties<azdata.TableComponentProperties>({
				data: [],
				columns: [toolColumn, descriptionColumn, installStatusColumn, versionColumn, minVersionColumn],
				width: tableWidth
			}).component();

			const toolsTableWrapper = view.modelBuilder.divContainer().withLayout({ width: tableWidth }).component();
			toolsTableWrapper.addItem(this._toolsTable, { CSSStyles: { 'border-left': '1px solid silver', 'border-top': '1px solid silver' } });
			this._toolsLoadingComponent = view.modelBuilder.loadingComponent().withItem(toolsTableWrapper).component();
			const formBuilder = view.modelBuilder.formContainer().withFormItems(
				[
					{
						component: this._cardsContainer,
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
						title: localize('deploymentDialog.OptionsTitle', "Options")
					}, {
						component: this._toolsLoadingComponent,
						title: localize('deploymentDialog.RequiredToolsTitle', "Required tools")
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

			this._toDispose.push(optionSelectBox.onValueChanged(() => { this.updateToolsDisplayTable(); }));
			this._optionDropDownMap.set(option.name, optionSelectBox);
			const row = this._view.modelBuilder.flexContainer().withItems([optionLabel, optionSelectBox], { flex: '0 0 auto', CSSStyles: { 'margin-right': '20px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
			this._optionsContainer.addItem(row);
		});
		this.updateToolsDisplayTable();
	}

	private updateToolsDisplayTable(): void {
		this.toolRefreshTimestamp = new Date().getTime();
		const currentRefreshTimestamp = this.toolRefreshTimestamp;
		const toolRequirements = this.getCurrentProvider().requiredTools;
		const headerRowHeight = 28;
		this._toolsTable.height = 25 * Math.max(toolRequirements.length, 1) + headerRowHeight;
		this._dialogObject.message = {
			text: ''
		};
		this._installToolButton.hidden = true;
		if (toolRequirements.length === 0) {
			this._dialogObject.okButton.enabled = true;
			this._toolsTable.data = [[localize('deploymentDialog.NoRequiredTool', "No tools required"), '']];
			this._tools = [];
		} else {
			this._tools = toolRequirements.map(toolReq => {
				return this.toolsService.getToolByName(toolReq.name)!;
			});
			this._toolsLoadingComponent.loading = true;
			this._dialogObject.okButton.enabled = false;
			Promise.all(
				this._tools.map(tool => tool.loadInformation())
			).then(async () => {
				// If the local timestamp does not match the class level timestamp, it means user has changed options, ignore the results
				if (this.toolRefreshTimestamp !== currentRefreshTimestamp) {
					return;
				}
				let installationRequired = false;
				let minVersionCheckFailed = false;
				const messages: string[] = [];
				this._toolsTable.data = toolRequirements.map(toolReq => {
					const tool = this.toolsService.getToolByName(toolReq.name)!;
					// subscribe to onUpdateData event of the tool.
					this._toDispose.push(tool.onDidUpdateData((t: ITool) => {
						this.updateToolsDisplayTableData(t);
					}));
					if (tool.isNotInstalled && !tool.autoInstallSupported) {
						messages.push(localize('deploymentDialog.ToolInformation', "'{0}' [ {1} ]", tool.displayName, tool.homePage));
						if (tool.statusDescription !== undefined) {
							console.warn(localize('deploymentDialog.DetailToolStatusDescription', "Additional status information for tool: '{0}' [ {1} ]. {2}", tool.name, tool.homePage, tool.statusDescription));
						}
					} else if (tool.isInstalled && toolReq.version && !tool.isSameOrNewerThan(toolReq.version)) {
						minVersionCheckFailed = true;
						messages.push(localize('deploymentDialog.ToolDoesNotMeetVersionRequirement', "'{0}' [ {1} ] does not meet the minimum version requirement, please uninstall it and restart Azure Data Studio.", tool.displayName, tool.homePage));
					}
					installationRequired = installationRequired || tool.autoInstallRequired;
					return [tool.displayName, tool.description, tool.displayStatus, tool.fullVersion || '', toolReq.version || ''];
				});

				this._installToolButton.hidden = minVersionCheckFailed || !installationRequired;
				this._dialogObject.okButton.enabled = messages.length === 0 && !minVersionCheckFailed && !installationRequired;
				if (messages.length !== 0) {
					if (!minVersionCheckFailed) {
						messages.push(localize('deploymentDialog.VersionInformationDebugHint', "You will need to restart Azure Data Studio if the tools are installed by yourself after Azure Data Studio is launched to pick up the updated PATH environment variable. You may find additional details in the debug console by running the 'Toggle Developer Tools' command in the Azure Data Studio Command Palette."));
					}
					this._dialogObject.message = {
						level: azdata.window.MessageLevel.Error,
						text: [
							localize('deploymentDialog.ToolCheckFailed', "Some required tools are not installed or do not meet the minimum version requirement."),
							...messages
						].join(EOL)
					};
				} else if (installationRequired) {
					let infoText: string[] = [localize('deploymentDialog.InstallToolsHint', "Some required tools are not installed, you can click the \"{0}\" button to install them.", this._installToolButton.label)];
					const informationalMessagesArray = this._tools.reduce<string[]>((returnArray, currentTool) => {
						if (currentTool.needsInstallation) {
							returnArray.push(...currentTool.dependencyMessages);
						}
						return returnArray;
					}, /* initial Value of return array*/[]);
					const informationalMessagesSet: Set<string> = new Set<string>(informationalMessagesArray);
					if (informationalMessagesSet.size > 0) {
						infoText.push(...informationalMessagesSet.values());
					}
					// we don't have scenarios that have mixed type of tools
					// either we don't support auto install: docker, or we support auto install for all required tools
					this._dialogObject.message = {
						level: azdata.window.MessageLevel.Warning,
						text: infoText.join(EOL)
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
		setEnvironmentVariablesForInstallPaths(this._tools);
		this.resourceTypeService.startDeployment(this.getCurrentProvider());
	}

	protected updateToolsDisplayTableData(tool: ITool) {
		this._toolsTable.data = this._toolsTable.data.map(rowData => {
			if (rowData[0] === tool.displayName) {
				return [tool.displayName, tool.description, tool.displayStatus, tool.fullVersion || '', rowData[4]];
			} else {
				return rowData;
			}
		});
		this.enableUiControlsWhenNotInstalling(!tool.isInstalling); // if installing the disableContainers else enable them
	}

	private enableUiControlsWhenNotInstalling(enabled: boolean): void {
		this._cardsContainer.enabled = enabled;
		this._agreementContainer.enabled = enabled;
		this._optionsContainer.enabled = enabled;
		this._dialogObject.cancelButton.enabled = enabled;
		// select and install tools button are controlled separately
	}

	private async installTools(): Promise<void> {
		this._installToolButton.enabled = false;
		let tool: ITool;
		try {
			const toolRequirements = this.getCurrentProvider().requiredTools;
			for (let i: number = 0; i < toolRequirements.length; i++) {
				const toolReq = toolRequirements[i];
				tool = this.toolsService.getToolByName(toolReq.name)!;
				if (tool.needsInstallation) {
					// Update the informational message
					this._dialogObject.message = {
						level: azdata.window.MessageLevel.Information,
						text: localize('deploymentDialog.InstallingTool', "Required tool '{0}' [ {1} ] is being installed now.", tool.displayName, tool.homePage)
					};
					await this._tools[i].install();
					if (tool.isInstalled && toolReq.version && !tool.isSameOrNewerThan(toolReq.version)) {
						throw new Error(
							localize('deploymentDialog.ToolDoesNotMeetVersionRequirement', "'{0}' [ {1} ] does not meet the minimum version requirement, please uninstall it and restart Azure Data Studio.",
								tool.displayName, tool.homePage
							)
						);
					}
				}
			}
			// Update the informational message
			this._dialogObject.message = {
				level: azdata.window.MessageLevel.Information,
				text: localize('deploymentDialog.InstalledTools', "All required tools are installed now.")
			};
			this._dialogObject.okButton.enabled = true;
		} catch (error) {
			const errorMessage = tool!.statusDescription || getErrorMessage(error);
			if (errorMessage) {
				// Let the tooltip status show the errorMessage just shown so that last status is visible even after showError dialogue has been dismissed.
				this._dialogObject.message = {
					level: azdata.window.MessageLevel.Error,
					text: errorMessage
				};
			}
			tool!.showOutputChannel(/*preserverFocus*/false);
		}
	}
}
