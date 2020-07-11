/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { EOL } from 'os';
import * as nls from 'vscode-nls';
import { AgreementInfo, DeploymentProvider, ITool, ResourceType, ToolStatus } from '../interfaces';
import { IResourceTypeService } from '../services/resourceTypeService';
import { IToolsService } from '../services/toolsService';
import { getErrorMessage } from '../utils';
import { DialogBase } from './dialogBase';
import { createFlexContainer } from './modelViewUtils';

const localize = nls.loadMessageBundle();

export class ResourceTypePickerDialog extends DialogBase {
	private toolRefreshTimestamp: number = 0;
	private _selectedResourceType: ResourceType;
	private _view!: azdata.ModelView;
	private _resourceDescriptionLabel!: azdata.TextComponent;
	private _optionsContainer!: azdata.FlexContainer;
	private _toolsTable!: azdata.TableComponent;
	private _cardGroup!: azdata.RadioCardGroupComponent;
	private _optionDropDownMap: Map<string, azdata.DropDownComponent> = new Map();
	private _toolsLoadingComponent!: azdata.LoadingComponent;
	private _agreementContainer!: azdata.DivContainer;
	private _agreementCheckboxChecked: boolean = false;
	private _installToolButton: azdata.window.Button;
	private _installationInProgress: boolean = false;
	private _tools: ITool[] = [];

	constructor(
		private toolsService: IToolsService,
		private resourceTypeService: IResourceTypeService,
		defaultResourceType: ResourceType,
		private _resourceTypeNameFilters?: string[]) {
		super(localize('resourceTypePickerDialog.title', "Select the deployment options"), 'ResourceTypePickerDialog', true);
		this._selectedResourceType = defaultResourceType;
		this._installToolButton = azdata.window.createButton(localize('deploymentDialog.InstallToolsButton', "Install tools"));
		this._toDispose.push(this._installToolButton.onClick(() => {
			this.installTools().catch(error => console.log(error));
		}));
		this._dialogObject.customButtons = [this._installToolButton];
		this._installToolButton.hidden = true;
		this._dialogObject.okButton.label = localize('deploymentDialog.OKButtonText', "Select");
		this._dialogObject.okButton.enabled = false; // this is enabled after all tools are discovered.
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
			const resourceTypes = this.resourceTypeService
				.getResourceTypes()
				.filter(rt => !this._resourceTypeNameFilters || this._resourceTypeNameFilters.find(rtn => rt.name === rtn))
				.sort((a: ResourceType, b: ResourceType) => {
					return (a.displayIndex || Number.MAX_VALUE) - (b.displayIndex || Number.MAX_VALUE);
				});
			this._cardGroup = view.modelBuilder.radioCardGroup().withProperties<azdata.RadioCardGroupComponentProperties>({
				cards: resourceTypes.map((resourceType) => {
					return <azdata.RadioCard>{
						id: resourceType.name,
						label: resourceType.displayName,
						icon: resourceType.icon
					};
				}),
				iconHeight: '50px',
				iconWidth: '50px',
				cardWidth: '220px',
				cardHeight: '180px',
				ariaLabel: localize('deploymentDialog.deploymentOptions', "Deployment options"),
				width: '1100px'
			}).component();
			this._toDispose.push(this._cardGroup.onSelectionChanged((cardId: string) => {
				const resourceType = resourceTypes.find(rt => { return rt.name === cardId; });
				if (resourceType) {
					this.selectResourceType(resourceType);
				}
			}));
			this._resourceDescriptionLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: this._selectedResourceType ? this._selectedResourceType.description : undefined }).component();
			this._optionsContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
			this._agreementContainer = view.modelBuilder.divContainer().component();
			const toolColumn: azdata.TableColumn = {
				value: localize('deploymentDialog.toolNameColumnHeader', "Tool"),
				width: 55
			};
			const descriptionColumn: azdata.TableColumn = {
				value: localize('deploymentDialog.toolDescriptionColumnHeader', "Description"),
				width: 270
			};
			const installStatusColumn: azdata.TableColumn = {
				value: localize('deploymentDialog.toolStatusColumnHeader', "Status"),
				width: 70
			};
			const versionColumn: azdata.TableColumn = {
				value: localize('deploymentDialog.toolVersionColumnHeader', "Version"),
				width: 75
			};
			const minVersionColumn: azdata.TableColumn = {
				value: localize('deploymentDialog.toolMinimumVersionColumnHeader', "Required Version"),
				width: 95
			};
			const installedPathColumn: azdata.TableColumn = {
				value: localize('deploymentDialog.toolDiscoveredPathColumnHeader', "Discovered Path or Additional Information"),
				width: 580
			};
			this._toolsTable = view.modelBuilder.table().withProperties<azdata.TableComponentProperties>({
				data: [],
				columns: [toolColumn, descriptionColumn, installStatusColumn, versionColumn, minVersionColumn, installedPathColumn],
				width: tableWidth,
				ariaLabel: localize('deploymentDialog.RequiredToolsTitle', "Required tools")
			}).component();

			const toolsTableWrapper = view.modelBuilder.divContainer().withLayout({ width: tableWidth }).component();
			toolsTableWrapper.addItem(this._toolsTable, { CSSStyles: { 'border-left': '1px solid silver', 'border-top': '1px solid silver' } });
			this._toolsLoadingComponent = view.modelBuilder.loadingComponent().withItem(toolsTableWrapper).withProperties<azdata.LoadingComponentProperties>({
				loadingCompletedText: localize('deploymentDialog.loadingRequiredToolsCompleted', "Loading required tools information completed"),
				loadingText: localize('deploymentDialog.loadingRequiredTools', "Loading required tools information"),
				showText: true
			}).component();
			const formBuilder = view.modelBuilder.formContainer().withFormItems(
				[
					{
						component: this._cardGroup,
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
					this._cardGroup.selectedCardId = this._selectedResourceType.name;
				}
			});
		});
		this._dialogObject.content = [tab];
	}

	private selectResourceType(resourceType: ResourceType): void {
		this._selectedResourceType = resourceType;
		this._resourceDescriptionLabel.value = resourceType.description;
		this._agreementCheckboxChecked = false;
		this._agreementContainer.clearItems();
		if (resourceType.agreement) {
			this._agreementContainer.addItem(this.createAgreementCheckbox(resourceType.agreement));
		}

		this._optionsContainer.clearItems();
		this._optionDropDownMap.clear();
		if (resourceType.options) {
			resourceType.options.forEach(option => {
				const optionLabel = this._view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
					value: option.displayName
				}).component();
				optionLabel.width = '150px';

				const optionSelectBox = this._view.modelBuilder.dropDown().withProperties<azdata.DropDownProperties>({
					values: option.values,
					value: option.values[0],
					width: '300px',
					ariaLabel: option.displayName
				}).component();

				this._toDispose.push(optionSelectBox.onValueChanged(() => { this.updateToolsDisplayTable(); }));
				this._optionDropDownMap.set(option.name, optionSelectBox);
				const row = this._view.modelBuilder.flexContainer().withItems([optionLabel, optionSelectBox], { flex: '0 0 auto', CSSStyles: { 'margin-right': '20px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
				this._optionsContainer.addItem(row);
			});
		}
		this.updateToolsDisplayTable();
	}

	private updateToolsDisplayTable(): void {
		this.toolRefreshTimestamp = new Date().getTime();
		const currentRefreshTimestamp = this.toolRefreshTimestamp;
		const headerRowHeight = 28;
		this._toolsTable.height = 25 * Math.max(this.toolRequirements.length, 1) + headerRowHeight;
		if (!this._installationInProgress) { // Wipe the informational message clean unless installation is already in progress.
			this._dialogObject.message = {
				text: ''
			};
		}
		this._installToolButton.hidden = true;
		if (this.toolRequirements.length === 0) {
			this._toolsLoadingComponent.loading = false;
			this._dialogObject.okButton.enabled = true;
			this._toolsTable.data = [[localize('deploymentDialog.NoRequiredTool', "No tools required"), '']];
			this._tools = [];
		} else {
			this._tools = this.toolRequirements.map(toolReq => this.toolsService.getToolByName(toolReq.name)!);
			this._toolsLoadingComponent.loading = true;
			this._dialogObject.okButton.enabled = false;
			let toolsLoadingErrors: string[] = [];
			Promise.all(
				this._tools.map(
					tool => tool.finishInitialization().catch(() => toolsLoadingErrors.push(`${tool.displayName}:${tool.statusDescription!}`))
				)
			)
				.then(() => this.executeToolsTableWorkflow(currentRefreshTimestamp, toolsLoadingErrors))
				.catch(error => console.log(error));
		}
	}

	private executeToolsTableWorkflow(currentRefreshTimestamp: number, toolsLoadingErrors: string[]): void {
		// If the local timestamp does not match the class level timestamp, it means user has changed options, ignore the results
		if (this.toolRefreshTimestamp !== currentRefreshTimestamp) {
			return;
		}
		let minVersionCheckFailed = false;
		const toolsToAutoInstall: ITool[] = [];
		let messages: string[] = toolsLoadingErrors!;
		let erroredOrFailedTool: boolean = false;
		this._toolsTable.data = this.toolRequirements.map(toolRequirement => {
			const tool = this.toolsService.getToolByName(toolRequirement.name)!;
			// subscribe to onUpdateData event of the tool.
			this._toDispose.push(tool.onDidUpdateData((t: ITool) => {
				this.updateToolsDisplayTableData(t);
			}));

			erroredOrFailedTool = erroredOrFailedTool || (tool.status === ToolStatus.Error || tool.status === ToolStatus.Failed);
			if (tool.status === ToolStatus.NotInstalled) {
				if (tool.autoInstallSupported) {
					toolsToAutoInstall.push(tool);
				}
				else {
					messages.push(localize('deploymentDialog.ToolInformation', "'{0}' was not discovered and automated installation is not currently supported. Install '{0}' manually or ensure it is started and discoverable. Once done please restart Azure Data Studio. See [{1}] .", tool.displayName, tool.homePage));
				}
			}
			else if (tool.status === ToolStatus.Installed && toolRequirement.version && !tool.isSameOrNewerThan(toolRequirement.version)) {
				minVersionCheckFailed = true;
				messages.push(localize('deploymentDialog.ToolDoesNotMeetVersionRequirement', "'{0}' [ {1} ] does not meet the minimum version requirement, please uninstall it and restart Azure Data Studio.", tool.displayName, tool.homePage));
			}
			return [tool.displayName, tool.description, tool.displayStatus, tool.fullVersion || '', toolRequirement.version || '', tool.installationPathOrAdditionalInformation || ''];
		});
		this._installToolButton.hidden = erroredOrFailedTool || minVersionCheckFailed || (toolsToAutoInstall.length === 0);
		this._dialogObject.okButton.enabled = !erroredOrFailedTool && messages.length === 0 && !minVersionCheckFailed && (toolsToAutoInstall.length === 0);
		if (messages.length !== 0) {
			if (messages.length > 1) {
				messages = messages.map(message => `•	${message}`);
			}
			messages.push(localize('deploymentDialog.VersionInformationDebugHint', "You will need to restart Azure Data Studio if the tools are installed manually after Azure Data Studio is launched to pick up the updated PATH environment variable. You may find additional details in 'Deployments' output channel"));
			this._dialogObject.message = {
				level: azdata.window.MessageLevel.Error,
				text: messages.join(EOL)
			};
		}
		else if ((toolsToAutoInstall.length !== 0) && !this._installationInProgress) {
			const installationNeededHeader = toolsToAutoInstall.length === 1
				? localize('deploymentDialog.InstallToolsHintOne', "Tool: {0} is not installed, you can click the \"{1}\" button to install it.", toolsToAutoInstall[0].displayName, this._installToolButton.label)
				: localize('deploymentDialog.InstallToolsHintMany', "Tools: {0} are not installed, you can click the \"{1}\" button to install them.", toolsToAutoInstall.map(t => t.displayName).join(', '), this._installToolButton.label);
			let infoText: string[] = [installationNeededHeader];
			const informationalMessagesArray = this._tools.reduce<string[]>((returnArray, currentTool) => {
				if (currentTool.autoInstallNeeded) {
					returnArray.push(...currentTool.dependencyMessages);
				}
				return returnArray;
			}, /* initial Value of return array*/[]);
			const informationalMessagesSet: Set<string> = new Set<string>(informationalMessagesArray);
			if (informationalMessagesSet.size > 0) {
				infoText.push(...informationalMessagesSet.values());
			}
			// we don't have scenarios that have mixed type of tools - either we don't support auto install: docker, or we support auto install for all required tools
			this._dialogObject.message = {
				level: azdata.window.MessageLevel.Warning,
				text: infoText.join(EOL)
			};
		}
		this._toolsLoadingComponent.loading = false;
	}

	private get toolRequirements() {
		return this.getCurrentProvider().requiredTools;
	}

	private createAgreementCheckbox(agreementInfo: AgreementInfo): azdata.FlexContainer {
		const checkbox = this._view.modelBuilder.checkBox().withProperties<azdata.CheckBoxProperties>({
			ariaLabel: this.getAgreementDisplayText(agreementInfo),
			required: true
		}).component();
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

	private getAgreementDisplayText(agreementInfo: AgreementInfo): string {
		// the agreement template will have {index} as placeholder for hyperlinks
		// this method will get the display text after replacing the placeholders
		let text = agreementInfo.template;
		for (let i: number = 0; i < agreementInfo.links.length; i++) {
			text = text.replace(`{${i}}`, agreementInfo.links[i].text);
		}
		return text;
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
		this.toolsService.toolsForCurrentProvider = this._tools;
		this.resourceTypeService.startDeployment(this.getCurrentProvider());
	}

	protected updateToolsDisplayTableData(tool: ITool) {
		this._toolsTable.data = this._toolsTable.data.map(rowData => {
			if (rowData[0] === tool.displayName) {
				return [tool.displayName, tool.description, tool.displayStatus, tool.fullVersion || '', rowData[4]/* required version*/, tool.installationPathOrAdditionalInformation || ''];
			} else {
				return rowData;
			}
		});
		this.setUiControlsEnabled(tool.status !== ToolStatus.Installing); // if installing then disable ui controls else enable them
	}

	/**
	 *
	 * @param enable - if true the UiControls are set to be enabled, if not they are set to be disabled.
	 */
	private setUiControlsEnabled(enable: boolean): void {
		this._cardGroup.enabled = enable;
		this._agreementContainer.enabled = enable;
		this._optionsContainer.enabled = enable;
		this._dialogObject.cancelButton.enabled = enable;
		// select and install tools buttons are controlled separately
	}

	private async installTools(): Promise<void> {
		this._installToolButton.enabled = false;
		this._installationInProgress = true;
		let tool: ITool;
		try {
			const toolRequirements = this.toolRequirements;
			let toolsNotInstalled: ITool[] = [];
			for (let i: number = 0; i < toolRequirements.length; i++) {
				const toolReq = toolRequirements[i];
				tool = this.toolsService.getToolByName(toolReq.name)!;
				if (tool.autoInstallNeeded) {
					// Update the informational message
					this._dialogObject.message = {
						level: azdata.window.MessageLevel.Information,
						text: localize('deploymentDialog.InstallingTool', "Required tool '{0}' [ {1} ] is being installed now.", tool.displayName, tool.homePage)
					};
					await this._tools[i].install();
					if (tool.status === ToolStatus.Installed && toolReq.version && !tool.isSameOrNewerThan(toolReq.version)) {
						throw new Error(
							localize('deploymentDialog.ToolDoesNotMeetVersionRequirement', "'{0}' [ {1} ] does not meet the minimum version requirement, please uninstall it and restart Azure Data Studio.",
								tool.displayName, tool.homePage
							)
						);
					}
				} else {
					toolsNotInstalled.push(tool);
				}
			}
			// Update the informational message
			if (toolsNotInstalled.length === 0) {
				this._dialogObject.message = {
					level: azdata.window.MessageLevel.Information,
					text: localize('deploymentDialog.InstalledTools', "All required tools are installed now.")
				};
				this._dialogObject.okButton.enabled = true;
			} else {
				this._dialogObject.message = {
					level: azdata.window.MessageLevel.Information,
					text: localize('deploymentDialog.PendingInstallation', "Following tools: {0} were still not discovered. Please make sure that they are installed, running and discoverable", toolsNotInstalled.map(t => t.displayName).join(','))
				};
			}
		} catch (error) {
			const errorMessage = tool!.statusDescription || getErrorMessage(error);
			if (errorMessage) {
				// Let the tooltip status show the errorMessage just shown so that last status is visible even after showError dialogue has been dismissed.
				this._dialogObject.message = {
					level: azdata.window.MessageLevel.Error,
					text: errorMessage
				};
			}
			tool!.showOutputChannel(/*preserveFocus*/false);
		} finally {
			this._installationInProgress = false;
		}
	}
}
