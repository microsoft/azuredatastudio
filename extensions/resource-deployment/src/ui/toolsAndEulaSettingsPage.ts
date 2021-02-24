/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { EOL } from 'os';
import * as nls from 'vscode-nls';
import { AgreementInfo, DeploymentProvider, HelpText, ITool, ResourceType, ResourceTypeOptionValue, ToolRequirementInfo, ToolStatus } from '../interfaces';
import { createFlexContainer } from './modelViewUtils';
import * as loc from '../localizedConstants';
import { IToolsService } from '../services/toolsService';
import { getErrorMessage } from '../common/utils';
import { ResourceTypePage } from './resourceTypePage';
import { ResourceTypeWizard } from './resourceTypeWizard';
import { OptionValuesFilter as OptionValuesFilter } from '../services/resourceTypeService';
import { TelemetryAction, TelemetryReporter, TelemetryView } from '../services/telemetryService';

const localize = nls.loadMessageBundle();

export class ToolsAndEulaPage extends ResourceTypePage {
	private form!: azdata.FormBuilder;
	private view!: azdata.ModelView;
	private toolRefreshTimestamp: number = 0;
	private _optionsContainer!: azdata.FlexContainer;
	private _toolsTable!: azdata.TableComponent;
	private _optionDropDownMap: Map<string, azdata.DropDownComponent> = new Map();
	private _toolsLoadingComponent!: azdata.LoadingComponent;
	private _agreementContainer!: azdata.DivContainer;
	private _helpTextContainer!: azdata.DivContainer;
	private _agreementCheckBox!: azdata.CheckBoxComponent;
	private _installToolButton!: azdata.ButtonComponent;
	private _installationInProgress: boolean = false;
	private _tools: ITool[] = [];
	private _eulaValidationSucceeded: boolean = false;
	private _isInitialized = false;
	private _resourceType: ResourceType;

	public get toolsService(): IToolsService {
		return this.wizard.toolsService;
	}

	constructor(wizard: ResourceTypeWizard, private optionValuesFilter?: OptionValuesFilter) {
		super(localize('notebookWizard.toolsAndEulaPageTitle', "Deployment pre-requisites"), '', wizard);
		this._resourceType = wizard.resourceType;
	}

	public async onEnter(): Promise<void> {
		this.wizard.wizardObject.generateScriptButton.hidden = true;
		this.wizard.wizardObject.registerNavigationValidator(async (pcInfo) => {
			if (!this._eulaValidationSucceeded && !(await this.acquireEulaAndProceed())) {
				this.wizard.wizardObject.message = {
					text: localize('deploymentDialog.FailedEulaValidation', "To proceed, you must accept the terms of the End User License Agreement(EULA)"),
					level: azdata.window.MessageLevel.Error
				};
				return false; // we return false so that the workflow does not proceed and user gets to either click acceptEulaAndSelect again or cancel
			}

			for (let i = 0; i < this._tools.length; i++) {
				switch (this._tools[i].status) {
					case ToolStatus.Installing:
						this.wizard.wizardObject.message = {
							text: loc.getToolInstallingMessage(this._tools[i]),
							level: azdata.window.MessageLevel.Information
						};
						return false;
					case ToolStatus.Installed:
						continue;
					default:
						this.wizard.wizardObject.message = {
							text: localize('deploymentDialog.FailedToolsInstallation', "Some tools were still not discovered. Please make sure that they are installed, running and discoverable"),
							level: azdata.window.MessageLevel.Error
						};
						return false;
				}
			}

			this.wizard.wizardObject.message = {
				text: ''
			};
			TelemetryReporter.createActionEvent(TelemetryView.ResourceTypeWizard, TelemetryAction.SelectedDeploymentType)
				.withAdditionalProperties({
					'resourceType': this._resourceType.name,
					'provider': this.getCurrentProvider().name
				}).send();
			return true;
		});
	}

	public initialize(): void {
		if (this._isInitialized) {
			return;
		}

		this.pageObject.registerContent((view: azdata.ModelView) => {
			this.view = view;
			const tableWidth = 1060;
			this._optionsContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
			this._agreementContainer = view.modelBuilder.divContainer().component();
			this._helpTextContainer = view.modelBuilder.divContainer().component();
			const toolColumn: azdata.TableColumn = {
				value: loc.toolText,
				width: 105
			};
			const descriptionColumn: azdata.TableColumn = {
				value: loc.descriptionText,
				width: 270
			};
			const installStatusColumn: azdata.TableColumn = {
				value: loc.statusText,
				width: 70
			};
			const versionColumn: azdata.TableColumn = {
				value: loc.versionText,
				width: 75
			};
			const minVersionColumn: azdata.TableColumn = {
				value: loc.requiredVersionText,
				width: 105
			};
			const installedPathColumn: azdata.TableColumn = {
				value: loc.discoverPathOrAdditionalInformationText,
				width: 435
			};
			this._toolsTable = view.modelBuilder.table().withProperties<azdata.TableComponentProperties>({
				data: [],
				columns: [toolColumn, descriptionColumn, installStatusColumn, versionColumn, minVersionColumn, installedPathColumn],
				width: tableWidth,
				ariaLabel: loc.requiredToolsText
			}).component();

			const toolsTableWrapper = view.modelBuilder.divContainer().withLayout({ width: tableWidth }).component();
			toolsTableWrapper.addItem(this._toolsTable, { CSSStyles: { 'border-left': '1px solid silver', 'border-top': '1px solid silver' } });
			this._toolsLoadingComponent = view.modelBuilder.loadingComponent().withItem(toolsTableWrapper).withProperties<azdata.LoadingComponentProperties>({
				loadingCompletedText: localize('deploymentDialog.loadingRequiredToolsCompleted', "Loading required tools information completed"),
				loadingText: localize('deploymentDialog.loadingRequiredTools', "Loading required tools information"),
				showText: true
			}).component();


			this._installToolButton = view.modelBuilder.button().withProps({
				label: loc.installToolsText,
				CSSStyles: {
					'display': 'none',
				},
				width: '100px',
				secondary: true
			}).component();

			this.wizard.registerDisposable(this._installToolButton.onDidClick(() => {
				this.installTools().catch(error => console.log(error));
			}));

			this.form = view.modelBuilder.formContainer().withFormItems(
				[
					{
						component: this._helpTextContainer,
					}, {
						component: this._optionsContainer,
					}, {
						component: this._agreementContainer,
					}, {
						component: this._toolsLoadingComponent,
						title: loc.requiredToolsText
					}, {
						component: this._installToolButton
					}
				],
				{
					horizontal: false
				}
			);
			return view.initializeModel(this.form!.withLayout({ width: '100%' }).component()).then(() => {
				this._agreementContainer.clearItems();
				if (this._resourceType.agreements) {
					const agreementTitle = this.view.modelBuilder.text().withProps({
						value: localize('resourceDeployment.AgreementTitle', "Accept terms of use"),
						CSSStyles: {
							'font-size': '14px',
							'padding': '0'
						}
					}).component();
					this._agreementContainer.addItem(agreementTitle);
				} else {
					this.form.removeFormItem({
						component: this._agreementContainer
					});
				}

				this._optionsContainer.clearItems();
				this._optionDropDownMap.clear();
				if (this._resourceType.options) {
					let resourceTypeOptions: ResourceTypeOptionValue[] = [];
					const optionsTitle = this.view.modelBuilder.text().withProps({
						value: loc.optionsText,
						CSSStyles: {
							'font-size': '14px',
							'padding': '0'
						}
					}).component();
					this._optionsContainer.addItem(optionsTitle);
					this._resourceType.options.forEach((option, index) => {
						let optionValues = option.values;
						const optionValueFilter = this.optionValuesFilter?.[this._resourceType.name]?.[option.name];
						if (optionValueFilter) {
							optionValues = optionValues.filter(optionValue => optionValueFilter.includes(optionValue.name));
						}
						const optionLabel = this.view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
							value: option.displayName,
						}).component();
						optionLabel.width = '150px';

						const optionSelectedValue = (this.wizard.toolsEulaPagePresets) ? this.wizard.toolsEulaPagePresets[index] : optionValues[0];
						const optionSelectBox = this.view.modelBuilder.dropDown().withProperties<azdata.DropDownProperties>({
							values: optionValues,
							value: optionSelectedValue,
							width: '300px',
							ariaLabel: option.displayName
						}).component();


						resourceTypeOptions.push(optionSelectedValue);

						this.wizard.registerDisposable(optionSelectBox.onValueChanged(async () => {
							if (resourceTypeOptions[index].name !== (<ResourceTypeOptionValue>optionSelectBox.value).name) {
								resourceTypeOptions[index] = <ResourceTypeOptionValue>optionSelectBox.value;
								this.wizard.provider = this.getCurrentProvider();
								await this.wizard.open();
							}
						}));

						this._optionDropDownMap.set(option.name, optionSelectBox);
						this.wizard.provider = this.getCurrentProvider();
						const row = this.view.modelBuilder.flexContainer().withItems([optionLabel, optionSelectBox], { flex: '0 0 auto', CSSStyles: { 'margin-right': '20px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
						this._optionsContainer.addItem(row);
					});
					this.wizard.toolsEulaPagePresets = resourceTypeOptions;
				} else {
					this.form.removeFormItem({
						component: this._optionsContainer
					});
				}

				const agreementInfo = this._resourceType.getAgreementInfo(this.getSelectedOptions());
				if (agreementInfo) {
					this._agreementContainer.addItem(this.createAgreementCheckbox(agreementInfo));
				}

				const helpText = this._resourceType.getHelpText(this.getSelectedOptions());
				if (helpText) {
					this._helpTextContainer.addItem(this.createHelpText(helpText));
				}

				this.updateOkButtonText();
				this.updateToolsDisplayTable();
			});
		});
		this._isInitialized = true;
	}


	private createAgreementCheckbox(agreementInfo: AgreementInfo): azdata.FlexContainer {
		this._agreementCheckBox = this.view.modelBuilder.checkBox().withProperties<azdata.CheckBoxProperties>({
			ariaLabel: this.getAgreementDisplayText(agreementInfo),
			required: true
		}).component();
		const text = this.view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: agreementInfo.template,
			links: agreementInfo.links,
			requiredIndicator: true
		}).component();
		return createFlexContainer(this.view, [this._agreementCheckBox, text]);
	}

	private createHelpText(helpText: HelpText): azdata.FlexContainer {
		const helpTextComponent = this.view.modelBuilder.text().withProps({
			value: helpText.template,
			links: helpText.links,
		}).component();
		return createFlexContainer(this.view, [helpTextComponent]);
	}

	private getAgreementDisplayText(agreementInfo: AgreementInfo): string {
		// the agreement template will have {index} as placeholder for hyperlinks
		// this method will get the display text after replacing the placeholders
		let text = agreementInfo.template;
		for (let i: number = 0; i < agreementInfo.links!.length; i++) {
			text = text.replace(`{${i}}`, agreementInfo.links![i].text);
		}
		return text;
	}

	private async acquireEulaAndProceed(): Promise<boolean> {
		this.wizard.wizardObject.message = { text: '' };
		let eulaAccepted = true;
		for (const tool of this._tools) {
			eulaAccepted = tool.isEulaAccepted() || await tool.promptForEula();
			if (!eulaAccepted) {
				this.wizard.wizardObject.message = {
					level: azdata.window.MessageLevel.Error,
					text: [tool.statusDescription!, this.wizard.wizardObject.message.text].join(EOL)
				};
				break;
			}
		}
		return eulaAccepted;
	}

	private getCurrentProvider(): DeploymentProvider {

		const options = this.getSelectedOptions();

		return this._resourceType.getProvider(options)!;
	}

	private getCurrentOkText(): string {
		return this._resourceType.getOkButtonText(this.getSelectedOptions())!;
	}

	private getSelectedOptions(): { option: string, value: string }[] {
		const options: { option: string, value: string }[] = [];
		this._optionDropDownMap.forEach((selectBox, option) => {
			let selectedValue: azdata.CategoryValue = selectBox.value as azdata.CategoryValue;
			options.push({ option: option, value: selectedValue.name });
		});
		return options;
	}

	private updateOkButtonText(): void {
		//handle special case when resource type has different OK button.
		let text = this.getCurrentOkText();
		this.wizard.wizardObject.doneButton.label = text || loc.select;
	}


	private async installTools(): Promise<void> {
		this._installToolButton.enabled = false;
		this._installationInProgress = true;
		let tool: ITool;
		try {
			this.enableDoneButton(false);
			const toolRequirements = this.toolRequirements;
			let toolsNotInstalled: ITool[] = [];
			for (let i: number = 0; i < toolRequirements.length; i++) {
				const toolReq = toolRequirements[i];
				tool = this.toolsService.getToolByName(toolReq.name)!;
				if (tool.autoInstallNeeded) {
					// Update the informational message
					this.wizard.wizardObject.message = {
						level: azdata.window.MessageLevel.Information,
						text: loc.getToolInstallingMessage(tool)
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
					if (this._tools[i].status !== ToolStatus.Installed) {
						toolsNotInstalled.push(tool);
					}
				}
			}
			// Update the informational message
			if (toolsNotInstalled.length === 0) {
				this.wizard.wizardObject.message = {
					level: azdata.window.MessageLevel.Information,
					text: localize('deploymentDialog.InstalledTools', "All required tools are installed now.")
				};
				this.enableDoneButton(true);
			} else {
				this.wizard.wizardObject.message = {
					level: azdata.window.MessageLevel.Information,
					text: localize('deploymentDialog.PendingInstallation', "Following tools: {0} were still not discovered. Please make sure that they are installed, running and discoverable", toolsNotInstalled.map(t => t.displayName).join(','))
				};
			}
		} catch (error) {
			const errorMessage = tool!.statusDescription || getErrorMessage(error);
			if (errorMessage) {
				// Let the tooltip status show the errorMessage just shown so that last status is visible even after showError dialogue has been dismissed.
				this.wizard.wizardObject.message = {
					level: azdata.window.MessageLevel.Error,
					text: errorMessage
				};
			}
			tool!.showOutputChannel(/*preserveFocus*/false);
		} finally {
			this._installationInProgress = false;
		}
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
		this._agreementContainer.enabled = enable;
		this._optionsContainer.enabled = enable;
		this.wizard.wizardObject.cancelButton.enabled = enable;
	}

	public async onLeave(): Promise<void> {
		this.toolsService.toolsForCurrentProvider = this._tools;
	}

	private areToolsEulaAccepted(): boolean {
		// we run 'map' on each tool before doing 'every' so that we collect eula messages for all tools (instead of bailing out after 1st failure)
		this._eulaValidationSucceeded = this._tools.map(tool => {
			const eulaAccepted = tool.isEulaAccepted();
			if (!eulaAccepted) {
				this.wizard.wizardObject.message = {
					level: azdata.window.MessageLevel.Error,
					text: [tool.statusDescription!, this.wizard.wizardObject.message.text].join(EOL)
				};
			}
			return eulaAccepted;
		}).every(isEulaAccepted => isEulaAccepted);
		return this._eulaValidationSucceeded;
	}

	private get toolRequirements(): ToolRequirementInfo[] {
		return this.wizard.provider.requiredTools;
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
			this.wizard.registerDisposable(tool.onDidUpdateData((t: ITool) => {
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
		this._installToolButton.updateProperties({
			CSSStyles: {
				'display': erroredOrFailedTool || minVersionCheckFailed || (toolsToAutoInstall.length === 0) ? 'none' : 'inline'
			}
		});
		this.enableDoneButton(!erroredOrFailedTool && messages.length === 0 && !minVersionCheckFailed && (toolsToAutoInstall.length === 0));
		if (messages.length !== 0) {
			if (messages.length > 1) {
				messages = messages.map(message => `•	${message}`);
			}
			messages.push(localize('deploymentDialog.VersionInformationDebugHint', "You will need to restart Azure Data Studio if the tools are installed manually to pick up the change. You may find additional details in 'Deployments' and 'Azure Data CLI' output channels"));
			this.wizard.wizardObject.message = {
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
			this.wizard.wizardObject.message = {
				level: azdata.window.MessageLevel.Warning,
				text: infoText.join(EOL)
			};
		}
		if (!this.areToolsEulaAccepted()) {
			this.wizard.wizardObject.doneButton.label = loc.acceptEulaAndSelect;
			this.wizard.wizardObject.nextButton.label = loc.acceptEulaAndSelect;
		}
		this._toolsLoadingComponent.loading = false;
	}

	private updateToolsDisplayTable(): void {
		this.toolRefreshTimestamp = new Date().getTime();
		const currentRefreshTimestamp = this.toolRefreshTimestamp;
		const headerRowHeight = 28;
		this._toolsTable.height = 25 * Math.max(this.toolRequirements.length, 1) + headerRowHeight;
		if (!this._installationInProgress) { // Wipe the informational message clean unless installation is already in progress.
			this.wizard.wizardObject.message = {
				text: ''
			};
		}
		this._installToolButton.updateProperties({
			CSSStyles: {
				'display': 'none'
			}
		});
		if (this.toolRequirements.length === 0) {
			this._toolsLoadingComponent.loading = false;
			this.enableDoneButton(true);
			this._toolsTable.data = [[localize('deploymentDialog.NoRequiredTool', "No tools required"), '']];
			this._tools = [];
		} else {
			this._tools = this.toolRequirements.map(toolReq => this.toolsService.getToolByName(toolReq.name)!);
			this._toolsLoadingComponent.loading = true;
			this.enableDoneButton(false);
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

	private enableDoneButton(enable: boolean) {
		this.wizard.wizardObject.doneButton.enabled = enable;
		this.wizard.wizardObject.nextButton.enabled = enable;
	}
}
