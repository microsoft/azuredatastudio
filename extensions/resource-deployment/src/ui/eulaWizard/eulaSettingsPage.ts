/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { EulaWizard } from './eulaWizard';
import { AgreementInfo, DeploymentProvider, ITool, ResourceType, ResourceTypeOptionValue, ToolRequirementInfo, ToolStatus } from '../../interfaces';
import { EulaWizardPage } from './eulaWizardPage';
import { createFlexContainer } from '../modelViewUtils';
import { getErrorMessage } from '../../utils';
import { EOL } from 'os';
import * as loc from '../../localizedConstants';

const localize = nls.loadMessageBundle();
export class EulaSettingsPage extends EulaWizardPage {
	private _resourceType: ResourceType;
	private _view!: azdata.ModelView;
	private _agreementContainer!: azdata.DivContainer;
	private _agreementCheckboxChecked: boolean = false;
	private toolRefreshTimestamp: number = 0;
	private _toolsTable!: azdata.TableComponent;
	private _toolsLoadingComponent!: azdata.LoadingComponent;
	private _installToolButton!: azdata.ButtonComponent;
	private _recheckEulaButton!: azdata.ButtonComponent;
	private _installationInProgress: boolean = false;
	private _tools: ITool[] = [];
	private _optionDropDownMap: Map<string, azdata.DropDownComponent> = new Map();
	private _optionsContainer!: azdata.FlexContainer;
	private _optionsDropdown: azdata.DropDownComponent[] = [];
	private _eulaValidationSucceeded: boolean = false;
	private form: any;

	constructor(wizard: EulaWizard, private _presets?: EulaInformation) {
		super(wizard, 0, loc.eulaSettingsPageTitle, '');
		this._resourceType = wizard.resourceType;
	}

	public initialize(): void {
		this.pageObject.registerContent((view: azdata.ModelView) => {
			this._view = view;

			this.wizard.wizardObject.nextButton.enabled = false; // this is enabled after all tools are discovered.

			this._agreementContainer = view.modelBuilder.divContainer().component();
			if (this._resourceType.agreement) {
				this._agreementCheckboxChecked = false;
				this._agreementContainer.addItem(this.createAgreementCheckbox(this._resourceType.agreement));
			}

			this._installToolButton = view.modelBuilder.button().withProps({
				label: loc.installToolsButtonLabel,
				CSSStyles: {
					display: 'none'
				}
			}).component();
			this._installToolButton.onDidClick((e: any) => {
				this.installTools().catch((error: any) => console.log(error));
			});

			this._recheckEulaButton = view.modelBuilder.button().withProps({
				label: loc.validateEulaButtonLabel,
				CSSStyles: {
					display: 'none'
				}
			}).component();
			this._recheckEulaButton.display = 'none';
			this._recheckEulaButton.onDidClick((e: any) => {
				this.wizard.wizardObject.message = { text: '' }; // clear any previous message.
			});

			const toolsTableContainer = this.createToolsTable();
			this._optionsContainer = this.createOptionsDropdown();
			const formBuilder = view.modelBuilder.formContainer().withFormItems(
				[
					{
						component: this._optionsContainer
					},
					{
						component: this._agreementContainer,
						title: ''
					},
					{
						component: toolsTableContainer,
						title: ''
					},
					{
						component: createFlexContainer(this._view, [this._installToolButton, this._recheckEulaButton])
					}
				],
				{
					horizontal: false
				}
			);
			this.form = formBuilder.withLayout({ width: '100%' }).component();
			return view.initializeModel(this.form);
		});

	}

	public async onEnter(): Promise<void> {
		this.wizard.wizardObject.registerNavigationValidator(async (pcInfo) => {
			const isAgreementChecked = (this._resourceType.agreement === undefined || this._agreementCheckboxChecked);
			if (!isAgreementChecked) {
				this.wizard.wizardObject.message = {
					text: loc.eulaSettingsAgreementNotCheckedError,
					level: azdata.window.MessageLevel.Error
				};
				return false;
			}
			if (!this._eulaValidationSucceeded && !(await this.acquireEulaAndProceed())) {
				return false; // we return false so that the workflow does not proceed and user gets to either click acceptEulaAndSelect again or cancel
			}
			return true;
		});
		this.updateToolsDisplayTable();
	}

	public async onLeave(): Promise<void> {
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			return true;
		});
	}

	private createAgreementCheckbox(agreementInfo: AgreementInfo): azdata.FlexContainer {
		const title = this._view.modelBuilder.text().withProps({
			value: loc.eulaSettingsagreementCheckboxLabel,
			CSSStyles: {
				'font-weight': '300',
				'font-size': '14px'
			}
		}).component();
		const checkbox = this._view.modelBuilder.checkBox().withProperties<azdata.CheckBoxProperties>({
			ariaLabel: this.getAgreementDisplayText(agreementInfo),
			required: true
		}).component();
		checkbox.checked = false;
		checkbox.onChanged(() => {
			this._agreementCheckboxChecked = !!checkbox.checked;
		});
		const text = this._view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: agreementInfo.template,
			links: agreementInfo.links,
			requiredIndicator: true
		}).component();
		return createFlexContainer(this._view, [title, createFlexContainer(this._view, [checkbox, text])], false);
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


	private createOptionsDropdown(): azdata.FlexContainer {
		const container = this._view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
		const labels: string[] = [];
		if (this._resourceType.options) {
			this._resourceType.options.forEach((option, i) => {
				const optionLabel = this._view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
					value: option.displayName
				}).component();
				optionLabel.width = '150px';
				labels.push(option.displayName);
				let selectedValue = option.values[0];
				if (this._presets) {
					selectedValue = this._presets.dropdownValues![i];
				}

				const optionSelectBox = this._view.modelBuilder.dropDown().withProperties<azdata.DropDownProperties>({
					values: option.values,
					value: selectedValue,
					width: '300px',
					ariaLabel: option.displayName
				}).component();

				this._optionsDropdown.push(optionSelectBox);
				optionSelectBox.onValueChanged(async () => {
					let presetFields = new EulaInformation();
					presetFields.dropdownValues = [];
					this._optionsDropdown.forEach(element => {
						presetFields?.dropdownValues?.push(element.value as azdata.CategoryValue);
					});
					this.wizard.changeProvider(this.getCurrentProvider(), presetFields);
				});

				this._optionDropDownMap.set(option.name, optionSelectBox);

				const row = this._view.modelBuilder.flexContainer().withItems([optionLabel, optionSelectBox], { flex: '0 0 auto', CSSStyles: { 'margin-right': '20px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
				container.addItem(row);
			});
		}

		let containerLabelTest = 'Select ';
		if (labels.length === 1) {
			containerLabelTest += labels[0];
		} else {
			containerLabelTest += labels.slice(0, -1).join(',') + ' and ' + labels.slice(-1);
		}
		const containerLabel = this._view.modelBuilder.text().withProps({
			value: containerLabelTest,
			CSSStyles: {
				'font-weight': '300',
				'font-size': '14px'
			}
		}).component();

		container.insertItem(containerLabel, 0);

		return container;
	}

	private createToolsTable(): azdata.FlexContainer {
		const tableWidth = 1126;

		const toolColumn: azdata.TableColumn = {
			value: loc.toolNameColumnHeader,
			width: 80
		};
		const descriptionColumn: azdata.TableColumn = {
			value: loc.toolDescriptionColumnHeader,
			width: 270
		};
		const installStatusColumn: azdata.TableColumn = {
			value: loc.toolStatusColumnHeader,
			width: 70
		};
		const versionColumn: azdata.TableColumn = {
			value: loc.toolVersionColumnHeader,
			width: 75
		};
		const minVersionColumn: azdata.TableColumn = {
			value: loc.toolMinimumVersionColumnHeader,
			width: 95
		};
		const installedPathColumn: azdata.TableColumn = {
			value: loc.toolDiscoveredPathColumnHeader,
			width: 580
		};
		this._toolsTable = this._view.modelBuilder.table().withProperties<azdata.TableComponentProperties>({
			data: [],
			columns: [toolColumn, descriptionColumn, installStatusColumn, versionColumn, minVersionColumn, installedPathColumn],
			width: tableWidth,
			ariaLabel: loc.RequiredToolsTitle
		}).component();


		const toolsTableWrapper = this._view.modelBuilder.divContainer().withLayout({ width: tableWidth }).component();
		toolsTableWrapper.addItem(this._toolsTable, { CSSStyles: { 'border-left': '1px solid silver', 'border-top': '1px solid silver' } });

		this._toolsLoadingComponent = this._view.modelBuilder.loadingComponent().withItem(toolsTableWrapper).withProperties<azdata.LoadingComponentProperties>({
			loadingCompletedText: loc.loadingRequiredToolsCompleted,
			loadingText: loc.loadingRequiredTools,
			showText: true,
			loading: false
		}).component();

		const toolsTableTitle = this._view.modelBuilder.text().withProps({
			value: loc.RequiredToolsTitle,
			CSSStyles: {
				'font-weight': '300',
				'font-size': '14px'
			}
		}).component();

		return createFlexContainer(this._view, [toolsTableTitle, this._toolsLoadingComponent], false);
	}


	private getCurrentProvider(): DeploymentProvider {
		const options: { option: string, value: string }[] = [];

		this._optionDropDownMap.forEach((selectBox, option) => {
			let selectedValue: azdata.CategoryValue = selectBox.value as azdata.CategoryValue;
			options.push({ option: option, value: selectedValue.name });
		});

		return this._resourceType.getProvider(options)!;
	}


	private get toolRequirements() {
		return this.getCurrentProvider().requiredTools;
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
				tool = this.wizard.toolsService.getToolByName(toolReq.name)!;
				if (tool.autoInstallNeeded) {
					// Update the informational message
					this.wizard.wizardObject.message = {
						level: azdata.window.MessageLevel.Information,
						text: localize('eulaSettingsPage.InstallingTool', "Required tool '{0}' [ {1} ] is being installed now.", tool.displayName, tool.homePage)
					};
					await this._tools[i].install();
					if (tool.status === ToolStatus.Installed && toolReq.version && !tool.isSameOrNewerThan(toolReq.version)) {
						throw new Error(
							localize('eulaSettingsPage.ToolDoesNotMeetVersionRequirement', "'{0}' [ {1} ] does not meet the minimum version requirement, please uninstall it and restart Azure Data Studio.",
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
				this.wizard.wizardObject.message = {
					level: azdata.window.MessageLevel.Information,
					text: loc.installedTools
				};
				this.wizard.wizardObject.nextButton.enabled = true;
			} else {
				this.wizard.wizardObject.message = {
					level: azdata.window.MessageLevel.Information,
					text: localize('eulaSettingsPage.PendingInstallation', "Following tools: {0} were still not discovered. Please make sure that they are installed, running and discoverable", toolsNotInstalled.map(t => t.displayName).join(','))
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
		this._installToolButton.display = 'none';
		if (this.toolRequirements.length === 0) {
			this._toolsLoadingComponent.loading = false;
			this.wizard.wizardObject.nextButton.enabled = true;
			this._toolsTable.data = [[loc.noRequiredTool, '']];
			this._tools = [];
		} else {
			this._tools = this.toolRequirements.map((toolReq: ToolRequirementInfo) => this.wizard.toolsService.getToolByName(toolReq.name)!);
			this._toolsLoadingComponent.loading = true;
			this.wizard.wizardObject.nextButton.enabled = false;
			let toolsLoadingErrors: string[] = [];
			Promise.all(
				this._tools.map(
					tool => tool.finishInitialization().catch(() => {
						toolsLoadingErrors.push(`${tool.displayName}:${tool.statusDescription!}`);
					})
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
		this._toolsTable.data = this.toolRequirements.map((toolRequirement: ToolRequirementInfo) => {
			const tool = this.wizard.toolsService.getToolByName(toolRequirement.name)!;
			// subscribe to onUpdateData event of the tool.


			tool.onDidUpdateData((t: ITool) => {
				this.updateToolsDisplayTableData(t);
			});


			erroredOrFailedTool = erroredOrFailedTool || (tool.status === ToolStatus.Error || tool.status === ToolStatus.Failed);
			if (tool.status === ToolStatus.NotInstalled) {
				if (tool.autoInstallSupported) {
					toolsToAutoInstall.push(tool);
				}
				else {
					messages.push(localize('eulaSettingsPage.ToolInformation', "'{0}' was not discovered and automated installation is not currently supported. Install '{0}' manually or ensure it is started and discoverable. Once done please restart Azure Data Studio. See [{1}] .", tool.displayName, tool.homePage));
				}
			}
			else if (tool.status === ToolStatus.Installed && toolRequirement.version && !tool.isSameOrNewerThan(toolRequirement.version)) {
				minVersionCheckFailed = true;
				messages.push(localize('eulaSettingsPage.ToolDoesNotMeetVersionRequirement', "'{0}' [ {1} ] does not meet the minimum version requirement, please uninstall it and restart Azure Data Studio.", tool.displayName, tool.homePage));
			}
			return [tool.displayName, tool.description, tool.displayStatus, tool.fullVersion || '', toolRequirement.version || '', tool.installationPathOrAdditionalInformation || ''];
		});
		this._installToolButton.display = (erroredOrFailedTool || minVersionCheckFailed || (toolsToAutoInstall.length === 0)) ? 'none' : 'inline';

		this.wizard.wizardObject.nextButton.enabled = !erroredOrFailedTool && messages.length === 0 && !minVersionCheckFailed && (toolsToAutoInstall.length === 0);
		if (messages.length !== 0) {
			if (messages.length > 1) {
				messages = messages.map(message => `•	${message}`);
			}
			messages.push(localize('eulaSettingsPage.VersionInformationDebugHint', "You will need to restart Azure Data Studio if the tools are installed manually to pick up the change. You may find additional details in 'Deployments' and 'azdata' output channels"));
			this.wizard.wizardObject.message = {
				level: azdata.window.MessageLevel.Error,
				text: messages.join(EOL)
			};
		}
		else if ((toolsToAutoInstall.length !== 0) && !this._installationInProgress) {
			const installationNeededHeader = toolsToAutoInstall.length === 1
				? localize('eulaSettingsPage.InstallToolsHintOne', "Tool: {0} is not installed, you can click the \"{1}\" button to install it.", toolsToAutoInstall[0].displayName, this._installToolButton.label)
				: localize('eulaSettingsPage.InstallToolsHintMany', "Tools: {0} are not installed, you can click the \"{1}\" button to install them.", toolsToAutoInstall.map(t => t.displayName).join(', '), this._installToolButton.label);
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
		}
		this._toolsLoadingComponent.loading = false;
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
		this.wizard.wizardObject.cancelButton.enabled = enable;
		// select and install tools buttons are controlled separately
	}

	public setPresets(_preset: EulaInformation) {
		this._optionsDropdown.forEach((element, i) => {
			element.value = _preset.dropdownValues![i] as azdata.CategoryValue;
		});
	}
}

export class EulaInformation {
	dropdownValues?: ResourceTypeOptionValue[];
}
