/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { DefaultColumnCheckboxWidth } from '../../ui/dialogBase';
import { IObjectManagementService } from 'mssql';
import * as localizedConstants from '../localizedConstants';
import * as constants from '../constants';
import { Server, ServerViewInfo, NumaNode, AffinityType, ServerLoginMode, AuditLevel } from '../interfaces';
import { isUndefinedOrNull } from '../../types';

export class ServerPropertiesDialog extends ObjectManagementDialogBase<Server, ServerViewInfo> {
	private generalTab: azdata.Tab;
	private readonly generalTabId: string = 'generalId';
	private platformSection: azdata.GroupContainer;
	private sqlServerSection: azdata.GroupContainer;
	private nameInput: azdata.InputBoxComponent;
	private hardwareGenerationInput: azdata.InputBoxComponent;
	private languageDropdown: azdata.DropDownComponent;
	private memoryInput: azdata.InputBoxComponent;
	private operatingSystemInput: azdata.InputBoxComponent;
	private platformInput: azdata.InputBoxComponent;
	private processorsInput: azdata.InputBoxComponent;
	private isClusteredInput: azdata.InputBoxComponent;
	private isHadrEnabledInput: azdata.InputBoxComponent;
	private isPolyBaseInstalledInput: azdata.InputBoxComponent;
	private isXTPSupportedInput: azdata.InputBoxComponent;
	private productInput: azdata.InputBoxComponent;
	private reservedStorageSizeInMBInput: azdata.InputBoxComponent;
	private rootDirectoryInput: azdata.InputBoxComponent;
	private serverCollationInput: azdata.InputBoxComponent;
	private serviceTierInput: azdata.InputBoxComponent;
	private storageSpaceUsageInMBInput: azdata.InputBoxComponent;
	private versionInput: azdata.InputBoxComponent;

	private memoryTab: azdata.Tab;
	private readonly memoryTabId: string = 'memoryId';
	private memorySection: azdata.GroupContainer;
	private minServerMemoryInput: azdata.InputBoxComponent;
	private maxServerMemoryInput: azdata.InputBoxComponent;
	private engineEdition: azdata.DatabaseEngineEdition;

	private processorsTab: azdata.Tab;
	private readonly processorsTabId: string = 'processorsId';
	private processorsSection: azdata.GroupContainer;
	private autoSetProcessorAffinityMaskForAllCheckbox: azdata.CheckBoxComponent;
	private autoSetProcessorIOAffinityMaskForAllCheckbox: azdata.CheckBoxComponent;

	private securityTab: azdata.Tab;
	private readonly securityTabId: string = 'securityId';
	private securitySection: azdata.GroupContainer;
	// Server authentication radio buttons
	private onlyWindowsAuthRadioButton: azdata.RadioButtonComponent;
	private sqlServerAndWindowsAuthRadioButton: azdata.RadioButtonComponent;
	// Login auditing radio buttons
	private noneRadioButton: azdata.RadioButtonComponent;
	private failedLoginsOnlyRadioButton: azdata.RadioButtonComponent;
	private successfulLoginsOnlyRadioButton: azdata.RadioButtonComponent;
	private bothFailedAndSuccessfulLoginsRadioButton: azdata.RadioButtonComponent;

	private databaseSettingsTab: azdata.Tab;
	private readonly databaseSettingsTabId: string = 'databaseSettingsId';
	private databaseSettingsSection: azdata.GroupContainer;
	private compressBackupCheckbox: azdata.CheckBoxComponent;
	private backupChecksumCheckbox: azdata.CheckBoxComponent;
	private dataLocationInput: azdata.InputBoxComponent;
	private logLocationInput: azdata.InputBoxComponent;
	private backupLocationInput: azdata.InputBoxComponent;

	private advancedTab: azdata.Tab;
	private readonly advancedTabId: string = 'advancedId';
	private allowTriggerToFireOthersDropdown: azdata.DropDownComponent;
	private blockedProcThresholdInput: azdata.InputBoxComponent;
	private cursorThresholdInput: azdata.InputBoxComponent;
	private defaultFullTextLanguageInput: azdata.InputBoxComponent;
	private defaultLanguageDropdown: azdata.DropDownComponent;
	private fullTextUpgradeOptionDropdown: azdata.DropDownComponent;
	private maxTextReplicationSizeInput: azdata.InputBoxComponent;
	private optimizeAdHocWorkloadsDropdown: azdata.DropDownComponent;
	private scanStartupProcsDropdown: azdata.DropDownComponent;
	private twoDigitYearCutoffInput: azdata.InputBoxComponent;
	private costThresholdParallelismInput: azdata.InputBoxComponent;
	private locksInput: azdata.InputBoxComponent;
	private maxDegreeParallelismInput: azdata.InputBoxComponent;
	private queryWaitInput: azdata.InputBoxComponent;

	private activeTabId: string;
	private shouldRestartServer: boolean = false;

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options);
	}

	protected override async handleDialogClosed(reason: azdata.window.CloseReason): Promise<any> {
		if (reason === 'ok') {
			// only show message if user apply changes
			await this.notifyServerRestart();
		}
		let result = await super.handleDialogClosed(reason);
		return result;
	}

	protected override get helpUrl(): string {
		let helpUrl = '';
		switch (this.activeTabId) {
			case this.generalTabId:
				helpUrl = constants.ViewGeneralServerPropertiesDocUrl;
				break;
			case this.memoryTabId:
				helpUrl = constants.ViewMemoryServerPropertiesDocUrl;
				break;
			case this.processorsTabId:
				helpUrl = constants.ViewProcessorsServerPropertiesDocUrl;
				break;
			case this.securityTabId:
				helpUrl = constants.ViewSecurityServerPropertiesDocUrl;
				break;
			case this.databaseSettingsTabId:
				helpUrl = constants.ViewDatabaseSettingsPropertiesDocUrl;
				break;
			case this.advancedTabId:
				helpUrl = constants.ViewAdvancedServerPropertiesDocUrl;
				break;
			default:
				break;
		}
		return helpUrl;
	}

	protected async initializeUI(): Promise<void> {
		const serverInfo = await azdata.connection.getServerInfo(this.options.objectExplorerContext.connectionProfile.id);
		this.engineEdition = serverInfo.engineEditionId;
		this.initializeGeneralSection();
		this.initializeMemorySection();
		this.initializeProcessorsSection();
		this.initializeSecuritySection();
		this.initializeDatabaseSettingsSection();
		this.initializeAdvancedSection();
		const serverPropertiesTabGroup = { title: '', tabs: [this.generalTab, this.memoryTab, this.processorsTab, this.securityTab, this.databaseSettingsTab, this.advancedTab] };
		const serverPropertiesTabbedPannel = this.modelView.modelBuilder.tabbedPanel()
			.withTabs([serverPropertiesTabGroup])
			.withLayout({
				orientation: azdata.TabOrientation.Vertical
			})
			.withProps({
				CSSStyles: {
					'margin': '-10px 0px 0px -10px'
				}
			}).component();
		this.disposables.push(
			serverPropertiesTabbedPannel.onTabChanged(async tabId => {
				this.activeTabId = tabId;
			}));
		this.formContainer.addItem(serverPropertiesTabbedPannel);
	}

	private initializeGeneralSection(): void {
		// Information about the platform that the SQL instance is running on
		let platformItems: azdata.Component[] = [];
		if (this.objectInfo.hardwareGeneration) {
			this.hardwareGenerationInput = this.createInputBox(async () => { }, {
				ariaLabel: localizedConstants.HardwareGenerationText,
				inputType: 'text',
				enabled: this.options.isNewObject,
				value: this.objectInfo.hardwareGeneration.toString()
			});
			const hardwareGenerationContainer = this.createLabelInputContainer(localizedConstants.HardwareGenerationText, this.hardwareGenerationInput);
			platformItems.push(hardwareGenerationContainer);
		}

		this.nameInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.NameText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.name
		});
		const nameContainer = this.createLabelInputContainer(localizedConstants.NameText, this.nameInput);
		platformItems.push(nameContainer);

		this.languageDropdown = this.createDropdown(localizedConstants.LanguageText, async () => { }, [this.objectInfo.language], this.objectInfo.language, this.options.isNewObject);
		const languageContainer = this.createLabelInputContainer(localizedConstants.LanguageText, this.languageDropdown);
		platformItems.push(languageContainer);

		this.memoryInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.MemoryText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: localizedConstants.StringValueInMB(this.objectInfo.memoryInMB.toString())
		});
		const memoryContainer = this.createLabelInputContainer(localizedConstants.MemoryText, this.memoryInput);
		platformItems.push(memoryContainer);

		this.operatingSystemInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.OperatingSystemText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.operatingSystem
		});
		const operatingSystemContainer = this.createLabelInputContainer(localizedConstants.OperatingSystemText, this.operatingSystemInput);
		platformItems.push(operatingSystemContainer);

		this.platformInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.PlatformText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.platform
		});
		const platformContainer = this.createLabelInputContainer(localizedConstants.PlatformText, this.platformInput);
		platformItems.push(platformContainer);

		this.processorsInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.ProcessorsText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.processors
		});
		const processorsContainer = this.createLabelInputContainer(localizedConstants.ProcessorsText, this.processorsInput);
		platformItems.push(processorsContainer);

		// Information about the SQL instance itself
		let sqlServerItems: azdata.Component[] = [];
		this.isClusteredInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.IsClusteredText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.isClustered.toString()
		});
		const isClusteredContainer = this.createLabelInputContainer(localizedConstants.IsClusteredText, this.isClusteredInput);
		sqlServerItems.push(isClusteredContainer);

		this.isHadrEnabledInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.IsHadrEnabledText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.isHadrEnabled.toString()
		});
		const isHadrEnabledContainer = this.createLabelInputContainer(localizedConstants.IsHadrEnabledText, this.isHadrEnabledInput);
		sqlServerItems.push(isHadrEnabledContainer);

		if (!isUndefinedOrNull(this.objectInfo.isPolyBaseInstalled)) {
			this.isPolyBaseInstalledInput = this.createInputBox(async () => { }, {
				ariaLabel: localizedConstants.IsPolyBaseInstalledText,
				inputType: 'text',
				enabled: this.options.isNewObject,
				value: this.objectInfo.isPolyBaseInstalled.toString()
			});
			const isPolyBaseInstalledContainer = this.createLabelInputContainer(localizedConstants.IsPolyBaseInstalledText, this.isPolyBaseInstalledInput);
			sqlServerItems.push(isPolyBaseInstalledContainer);
		}

		if (!isUndefinedOrNull(this.objectInfo.isXTPSupported)) {
			this.isXTPSupportedInput = this.createInputBox(async () => { }, {
				ariaLabel: localizedConstants.IsXTPSupportedText,
				inputType: 'text',
				enabled: this.options.isNewObject,
				value: this.objectInfo.isXTPSupported.toString()
			});
			const isXTPSupportedContainer = this.createLabelInputContainer(localizedConstants.IsXTPSupportedText, this.isXTPSupportedInput);
			sqlServerItems.push(isXTPSupportedContainer);
		}

		this.productInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.ProductText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.product
		});
		const productContainer = this.createLabelInputContainer(localizedConstants.ProductText, this.productInput);
		sqlServerItems.push(productContainer);

		this.rootDirectoryInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.RootDirectoryText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.rootDirectory
		});
		const rootDirectoryContainer = this.createLabelInputContainer(localizedConstants.RootDirectoryText, this.rootDirectoryInput);
		sqlServerItems.push(rootDirectoryContainer);

		this.serverCollationInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.ServerCollationText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.serverCollation
		});
		const serverCollationContainer = this.createLabelInputContainer(localizedConstants.ServerCollationText, this.serverCollationInput);
		sqlServerItems.push(serverCollationContainer);

		this.versionInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.VersionText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.version
		});
		const versionContainer = this.createLabelInputContainer(localizedConstants.VersionText, this.versionInput);
		sqlServerItems.push(versionContainer);

		if (!isUndefinedOrNull(this.objectInfo.reservedStorageSizeMB)) {
			this.reservedStorageSizeInMBInput = this.createInputBox(async () => { }, {
				ariaLabel: localizedConstants.ReservedStorageSizeInMBText,
				inputType: 'text',
				enabled: this.options.isNewObject,
				value: localizedConstants.StringValueInMB(this.objectInfo.reservedStorageSizeMB.toString())
			});
			const reservedStorageSizeInMBContainer = this.createLabelInputContainer(localizedConstants.ReservedStorageSizeInMBText, this.reservedStorageSizeInMBInput);
			sqlServerItems.push(reservedStorageSizeInMBContainer);
		}

		if (this.objectInfo.serviceTier) {
			this.serviceTierInput = this.createInputBox(async () => { }, {
				ariaLabel: localizedConstants.ServiceTierText,
				inputType: 'text',
				enabled: this.options.isNewObject,
				value: this.objectInfo.serviceTier
			});
			const serviceTierContainer = this.createLabelInputContainer(localizedConstants.ServiceTierText, this.serviceTierInput);
			sqlServerItems.push(serviceTierContainer);
		}

		if (!isUndefinedOrNull(this.objectInfo.storageSpaceUsageInMB)) {
			this.storageSpaceUsageInMBInput = this.createInputBox(async () => { }, {
				ariaLabel: localizedConstants.StorageSpaceUsageInMBText,
				inputType: 'text',
				enabled: this.options.isNewObject,
				value: localizedConstants.StringValueInMB(this.objectInfo.storageSpaceUsageInMB.toString())
			});
			const storageSpaceUsageInMbContainer = this.createLabelInputContainer(localizedConstants.StorageSpaceUsageInMBText, this.storageSpaceUsageInMBInput);
			sqlServerItems.push(storageSpaceUsageInMbContainer);
		}

		this.platformSection = this.createGroup('Platform', platformItems, true);
		this.sqlServerSection = this.createGroup('SQL Server', sqlServerItems, true);

		const generalContainer = this.createGroup('', [this.platformSection, this.sqlServerSection])

		this.generalTab = this.createTab(this.generalTabId, localizedConstants.GeneralSectionHeader, generalContainer);
	}

	private initializeMemorySection(): void {
		const isEnabled = this.engineEdition !== azdata.DatabaseEngineEdition.SqlManagedInstance;
		const minServerProps: azdata.InputBoxProperties = {
			ariaLabel: localizedConstants.minServerMemoryText,
			inputType: 'number',
			enabled: isEnabled,
			max: this.objectInfo.minServerMemory.maximumValue,
			min: this.objectInfo.minServerMemory.minimumValue,
			value: this.objectInfo.minServerMemory.value.toString(),
			required: true
		};
		this.minServerMemoryInput = this.createInputBox(async (newValue) => {
			this.objectInfo.minServerMemory.value = +newValue;
		}, minServerProps);
		const minMemoryContainer = this.createLabelInputContainer(localizedConstants.minServerMemoryText, this.minServerMemoryInput, true);

		const maxServerProps: azdata.InputBoxProperties = {
			ariaLabel: localizedConstants.maxServerMemoryText,
			inputType: 'number',
			enabled: isEnabled,
			max: this.objectInfo.maxServerMemory.maximumValue,
			min: this.objectInfo.maxServerMemory.minimumValue,
			value: this.objectInfo.maxServerMemory.value.toString(),
			required: true
		};
		this.maxServerMemoryInput = this.createInputBox(async (newValue) => {
			this.objectInfo.maxServerMemory.value = +newValue;
		}, maxServerProps);
		const maxMemoryContainer = this.createLabelInputContainer(localizedConstants.maxServerMemoryText, this.maxServerMemoryInput, true);

		this.memorySection = this.createGroup('', [
			minMemoryContainer,
			maxMemoryContainer
		], false);

		this.memoryTab = this.createTab(this.memoryTabId, localizedConstants.MemoryText, this.memorySection);
	}

	protected override async validateInput(): Promise<string[]> {
		const errors = await super.validateInput();
		if (this.objectInfo.maxServerMemory.value < this.objectInfo.minServerMemory.value) {
			errors.push(localizedConstants.serverMemoryMaxLowerThanMinInputError);
		}
		return errors;
	}

	private async notifyServerRestart(): Promise<void> {
		if (this.shouldRestartServer) {
			await vscode.window.showInformationMessage(localizedConstants.needToRestartServer, { modal: true });
			this.shouldRestartServer = false;
		}
	}

	private initializeProcessorsSection(): void {
		const isEnabled = this.engineEdition !== azdata.DatabaseEngineEdition.SqlManagedInstance;
		let nodes: NumaNode[] = this.objectInfo.numaNodes;
		let nodeTableList: azdata.TableComponent[] = [];
		let tableGroups: azdata.GroupContainer[] = [];

		if (isEnabled) {
			for (let node of nodes) {
				let table = this.createProcessorTable(node);
				nodeTableList.push(table);
				tableGroups.push(this.createGroup(localizedConstants.serverNumaNodeLabel(node.numaNodeId), [table], true));
			}
		}

		this.autoSetProcessorAffinityMaskForAllCheckbox = this.createCheckbox(localizedConstants.autoSetProcessorAffinityMaskForAllText, async (newValue) => {
			this.objectInfo.autoProcessorAffinityMaskForAll = newValue;
			if (isEnabled) {
				for (let table of nodeTableList) {
					let newData = table.data;
					for (let i = 0; i < newData.length; i++) {
						if (newValue) {
							// if affinity mask for all is checked, then uncheck the individual processors
							newData[i][AffinityType.ProcessorAffinity] = false;
						}
					}
					await this.setTableData(table, newData);
				}
			}

		}, this.objectInfo.autoProcessorAffinityMaskForAll, isEnabled);

		this.autoSetProcessorIOAffinityMaskForAllCheckbox = this.createCheckbox(localizedConstants.autoSetProcessorAffinityIOMaskForAllText, async (newValue) => {
			this.objectInfo.autoProcessorAffinityIOMaskForAll = newValue;
			if (isEnabled) {
				for (let table of nodeTableList) {
					let newData = table.data;
					for (let i = 0; i < newData.length; i++) {
						if (newValue) {
							// if IO affinity mask for all is checked, then uncheck the individual processors
							newData[i][AffinityType.IOAffinity] = false;
						}
					}
					await this.setTableData(table, newData);
					this.resetNumaNodes();
				}
			}
		}, this.objectInfo.autoProcessorAffinityIOMaskForAll, isEnabled);

		this.processorsSection = this.createGroup('', [
			this.autoSetProcessorAffinityMaskForAllCheckbox,
			this.autoSetProcessorIOAffinityMaskForAllCheckbox,
		], false);

		this.processorsSection.addItems(tableGroups);
		this.processorsTab = this.createTab(this.processorsTabId, localizedConstants.ProcessorsText, this.processorsSection);
	}

	private createProcessorTable(numaNode: NumaNode): azdata.TableComponent {
		const cssClass = 'no-borders';
		let tableData = numaNode.processors.map(row => [localizedConstants.serverCPULabel(row.processorId), row.affinity, row.ioAffinity]);
		let processorTable = this.createTable(localizedConstants.processorLabel,
			[
				<azdata.TableColumn>{
					name: localizedConstants.processorColumnText,
					value: localizedConstants.processorColumnText,
					type: azdata.ColumnType.text,
					cssClass: cssClass,
					headerCssClass: cssClass,
				},
				<azdata.TableColumn>{
					name: localizedConstants.processorAffinityColumnText,
					value: localizedConstants.processorAffinityColumnText,
					type: azdata.ColumnType.checkBox,
					width: DefaultColumnCheckboxWidth,
					action: azdata.ActionOnCellCheckboxCheck.customAction,
					cssClass: cssClass,
					headerCssClass: cssClass,
				},
				<azdata.TableColumn>{
					name: localizedConstants.processorIOAffinityColumnText,
					value: localizedConstants.processorIOAffinityColumnText,
					type: azdata.ColumnType.checkBox,
					width: DefaultColumnCheckboxWidth,
					action: azdata.ActionOnCellCheckboxCheck.customAction,
					cssClass: cssClass,
					headerCssClass: cssClass,
				}
			], tableData);

		this.disposables.push(processorTable.onCellAction(async (row) => {
			if (processorTable.selectedRows.length > 0) {
				const result = processorTable.data;
				let checkboxState = <azdata.ICheckboxCellActionEventArgs>row;
				let columnToAdjust = checkboxState.column === AffinityType.ProcessorAffinity ? AffinityType.IOAffinity : AffinityType.ProcessorAffinity;
				if (result[checkboxState.row][columnToAdjust]) {
					result[checkboxState.row][columnToAdjust] = !checkboxState.checked;
					processorTable.updateCells = result[checkboxState.row];
				}
				// uncheck the set all processors checkbox
				if (checkboxState.column === AffinityType.ProcessorAffinity) {
					this.autoSetProcessorAffinityMaskForAllCheckbox.checked = false;
					this.objectInfo.autoProcessorAffinityMaskForAll = false;
					this.objectInfo.numaNodes[+numaNode.numaNodeId].processors[checkboxState.row].affinity = checkboxState.checked;
					this.objectInfo.numaNodes[+numaNode.numaNodeId].processors[checkboxState.row].ioAffinity = false;
				}
				if (checkboxState.column === AffinityType.IOAffinity) {
					this.autoSetProcessorIOAffinityMaskForAllCheckbox.checked = false;
					this.objectInfo.autoProcessorAffinityIOMaskForAll = false;
					this.objectInfo.numaNodes[+numaNode.numaNodeId].processors[checkboxState.row].ioAffinity = checkboxState.checked;
					this.objectInfo.numaNodes[+numaNode.numaNodeId].processors[checkboxState.row].affinity = false;
				}
				this.onFormFieldChange();
			}
		}));
		return processorTable;
	}

	private resetNumaNodes(): void {
		for (let node of this.objectInfo.numaNodes) {
			for (let cpu of node.processors) {
				cpu.ioAffinity = false;
			}
		}
	}

	private initializeSecuritySection(): void {
		const isWindows = this.objectInfo.platform === constants.Windows;
		// cannot change auth mode in sql managed instance or non windows instances
		const isEnabled = this.engineEdition !== azdata.DatabaseEngineEdition.SqlManagedInstance && isWindows;
		const radioServerGroupName = 'serverAuthenticationRadioGroup';
		this.onlyWindowsAuthRadioButton = this.createRadioButton(localizedConstants.onlyWindowsAuthModeText, radioServerGroupName, this.objectInfo.authenticationMode === ServerLoginMode.Integrated, async () => { await this.handleAuthModeChange(); });
		this.sqlServerAndWindowsAuthRadioButton = this.createRadioButton(localizedConstants.sqlServerAndWindowsAuthText, radioServerGroupName, this.objectInfo.authenticationMode === ServerLoginMode.Mixed, async () => { await this.handleAuthModeChange(); });
		this.onlyWindowsAuthRadioButton.enabled = isEnabled;
		this.sqlServerAndWindowsAuthRadioButton.enabled = isEnabled;
		const serverAuthSection = this.createGroup(localizedConstants.serverAuthenticationText, [
			this.onlyWindowsAuthRadioButton,
			this.sqlServerAndWindowsAuthRadioButton
		], true);

		const radioLoginsGroupName = 'serverLoginsRadioGroup';
		this.noneRadioButton = this.createRadioButton(localizedConstants.noLoginAuditingText, radioLoginsGroupName, this.objectInfo.loginAuditing === AuditLevel.None, async () => { await this.handleAuditLevelChange(); });
		this.failedLoginsOnlyRadioButton = this.createRadioButton(localizedConstants.failedLoginsOnlyText, radioLoginsGroupName, this.objectInfo.loginAuditing === AuditLevel.Failure, async () => { await this.handleAuditLevelChange(); });
		this.successfulLoginsOnlyRadioButton = this.createRadioButton(localizedConstants.successfulLoginsOnlyText, radioLoginsGroupName, this.objectInfo.loginAuditing === AuditLevel.Success, async () => { await this.handleAuditLevelChange(); });
		this.bothFailedAndSuccessfulLoginsRadioButton = this.createRadioButton(localizedConstants.bothFailedAndSuccessfulLoginsText, radioLoginsGroupName, this.objectInfo.loginAuditing === AuditLevel.All, async () => { await this.handleAuditLevelChange(); });
		// cannot change values in serverLogin section on Linux
		this.noneRadioButton.enabled = isWindows;
		this.failedLoginsOnlyRadioButton.enabled = isWindows;
		this.successfulLoginsOnlyRadioButton.enabled = isWindows;
		this.bothFailedAndSuccessfulLoginsRadioButton.enabled = isWindows;
		const serverLoginSection = this.createGroup(localizedConstants.loginAuditingText, [
			this.noneRadioButton,
			this.failedLoginsOnlyRadioButton,
			this.successfulLoginsOnlyRadioButton,
			this.bothFailedAndSuccessfulLoginsRadioButton
		], true);
		this.securitySection = this.createGroup('', [
			serverAuthSection,
			serverLoginSection
		], true);

		this.securityTab = this.createTab(this.securityTabId, localizedConstants.securityText, this.securitySection);
	}

	private async handleAuthModeChange(): Promise<void> {
		if (this.onlyWindowsAuthRadioButton.checked) {
			this.objectInfo.authenticationMode = ServerLoginMode.Integrated;
		}
		if (this.sqlServerAndWindowsAuthRadioButton.checked) {
			this.objectInfo.authenticationMode = ServerLoginMode.Mixed;
		}
		if (this.objectInfo.authenticationMode !== this.originalObjectInfo.authenticationMode) {
			this.shouldRestartServer = true;
		}
	}

	private async handleAuditLevelChange(): Promise<void> {
		if (this.noneRadioButton.checked) {
			this.objectInfo.loginAuditing = AuditLevel.None;
		}
		if (this.failedLoginsOnlyRadioButton.checked) {
			this.objectInfo.loginAuditing = AuditLevel.Failure;
		}
		if (this.successfulLoginsOnlyRadioButton.checked) {
			this.objectInfo.loginAuditing = AuditLevel.Success;
		}
		if (this.bothFailedAndSuccessfulLoginsRadioButton.checked) {
			this.objectInfo.loginAuditing = AuditLevel.All;
		}
	}

	private initializeDatabaseSettingsSection(): void {
		const isEnabled = this.engineEdition !== azdata.DatabaseEngineEdition.SqlManagedInstance;
		const dataLocationInputboxProps: azdata.InputBoxProperties = {
			ariaLabel: localizedConstants.dataLocationText,
			enabled: isEnabled,
			value: this.objectInfo.dataLocation,
			required: true
		};
		const logLocationInputboxProps: azdata.InputBoxProperties = {
			ariaLabel: localizedConstants.logLocationText,
			enabled: isEnabled,
			value: this.objectInfo.logLocation,
			required: true
		};
		const backupLocationInputboxProps: azdata.InputBoxProperties = {
			ariaLabel: localizedConstants.backupLocationText,
			enabled: isEnabled,
			value: this.objectInfo.backupLocation,
			required: true
		};
		this.compressBackupCheckbox = this.createCheckbox(localizedConstants.compressBackupText, async (newValue) => {
			this.objectInfo.checkCompressBackup = newValue;
		}, this.objectInfo.checkCompressBackup);

		this.backupChecksumCheckbox = this.createCheckbox(localizedConstants.backupChecksumText, async (newValue) => {
			this.objectInfo.checkBackupChecksum = newValue;
		}, this.objectInfo.checkBackupChecksum);

		const checkBoxContainer = this.createGroup(localizedConstants.backupAndRestoreText, [this.compressBackupCheckbox, this.backupChecksumCheckbox], false);

		this.dataLocationInput = this.createInputBox(async (newValue) => {
			this.objectInfo.dataLocation = newValue;
			if (this.objectInfo.dataLocation !== this.originalObjectInfo.dataLocation) {
				this.shouldRestartServer = true;
			}
		}, dataLocationInputboxProps);
		const dataLocationButton = this.createBrowseButton(async () => {
			const newPath = await this.selectFolder(this.objectInfo.dataLocation);
			if (newPath) {
				this.dataLocationInput.value = newPath;
				this.objectInfo.dataLocation = newPath;
			}
			if (this.objectInfo.dataLocation !== this.originalObjectInfo.dataLocation) {
				this.shouldRestartServer = true;
			}
		}, isEnabled);
		const dataLocationInputContainer = this.createLabelInputContainer(localizedConstants.dataLocationText, [this.dataLocationInput, dataLocationButton], true)

		this.logLocationInput = this.createInputBox(async (newValue) => {
			this.objectInfo.logLocation = newValue;
			if (this.objectInfo.logLocation !== this.originalObjectInfo.logLocation) {
				this.shouldRestartServer = true;
			}
		}, logLocationInputboxProps);
		const logLocationButton = this.createBrowseButton(async () => {
			const newPath = await this.selectFolder(this.objectInfo.logLocation);
			if (newPath) {
				this.logLocationInput.value = newPath;
				this.objectInfo.logLocation = newPath;
			}
			if (this.objectInfo.logLocation !== this.originalObjectInfo.logLocation) {
				this.shouldRestartServer = true;
			}
		}, isEnabled);
		const logLocationInputContainer = this.createLabelInputContainer(localizedConstants.logLocationText, [this.logLocationInput, logLocationButton], true)

		this.backupLocationInput = this.createInputBox(async (newValue) => {
			this.objectInfo.backupLocation = newValue;
		}, backupLocationInputboxProps);
		const backupLocationButton = this.createBrowseButton(async () => {
			const newPath = await this.selectFolder(this.objectInfo.backupLocation);
			if (newPath) {
				this.backupLocationInput.value = newPath;
				this.objectInfo.backupLocation = newPath;
			}
		}, isEnabled);
		const backupLocationInputContainer = this.createLabelInputContainer(localizedConstants.backupLocationText, [this.backupLocationInput, backupLocationButton], true)

		const defaultLocationsContainer = this.createGroup(localizedConstants.defaultLocationsLabel, [
			dataLocationInputContainer,
			logLocationInputContainer,
			backupLocationInputContainer
		], false);

		this.databaseSettingsSection = this.createGroup('', [
			checkBoxContainer,
			defaultLocationsContainer
		], false);

		this.databaseSettingsTab = this.createTab(this.databaseSettingsTabId, localizedConstants.databaseSettingsText, this.databaseSettingsSection);
	}

	public async selectFolder(location: string): Promise<string | undefined> {
		let dataFolder = await this.objectManagementService.getDataFolder(this.options.connectionUri);
		return await azdata.window.openServerFileBrowserDialog(this.options.connectionUri, dataFolder, [{ label: localizedConstants.allFiles, filters: ['*'] }], true);
	}

	private initializeAdvancedSection(): void {
		const isEnabled = this.engineEdition !== azdata.DatabaseEngineEdition.SqlManagedInstance;
		this.allowTriggerToFireOthersDropdown = this.createDropdown(localizedConstants.allowTriggerToFireOthersLabel, async (newValue) => {
			this.objectInfo.allowTriggerToFireOthers = newValue === 'True';
		}, ['True', 'False'], this.objectInfo.allowTriggerToFireOthers ? 'True' : 'False');
		const allowTriggerToFireOthersContainer = this.createLabelInputContainer(localizedConstants.allowTriggerToFireOthersLabel, this.allowTriggerToFireOthersDropdown);

		this.blockedProcThresholdInput = this.createInputBox(async (newValue) => {
			this.objectInfo.blockedProcThreshold.value = +newValue;
		}, {
			ariaLabel: localizedConstants.blockedProcThresholdLabel,
			inputType: 'number',
			min: this.objectInfo.blockedProcThreshold.minimumValue,
			max: this.objectInfo.blockedProcThreshold.maximumValue,
			value: this.objectInfo.blockedProcThreshold.value.toString()
		});
		const blockedProcThresholdContainer = this.createLabelInputContainer(localizedConstants.blockedProcThresholdLabel, this.blockedProcThresholdInput);

		this.cursorThresholdInput = this.createInputBox(async (newValue) => {
			this.objectInfo.cursorThreshold.value = +newValue;
		}, {
			ariaLabel: localizedConstants.cursorThresholdLabel,
			inputType: 'number',
			min: this.objectInfo.cursorThreshold.minimumValue,
			max: this.objectInfo.cursorThreshold.maximumValue,
			value: this.objectInfo.cursorThreshold.value.toString()
		});
		const cursorThresholdContainer = this.createLabelInputContainer(localizedConstants.cursorThresholdLabel, this.cursorThresholdInput);

		this.defaultFullTextLanguageInput = this.createInputBox(async (newValue) => {
			this.objectInfo.defaultFullTextLanguage = newValue;
		}, {
			ariaLabel: localizedConstants.defaultFullTextLanguageLabel,
			value: this.objectInfo.defaultFullTextLanguage
		});
		const defaultFullTextLanguageContainer = this.createLabelInputContainer(localizedConstants.defaultFullTextLanguageLabel, this.defaultFullTextLanguageInput);

		this.defaultLanguageDropdown = this.createDropdown(localizedConstants.defaultLanguageLabel, async (newValue) => {
			this.objectInfo.defaultLanguage = newValue;
		}, this.viewInfo.languageOptions, this.objectInfo.defaultLanguage);
		const defaultLanguageContainer = this.createLabelInputContainer(localizedConstants.defaultLanguageLabel, this.defaultLanguageDropdown);

		this.fullTextUpgradeOptionDropdown = this.createDropdown(localizedConstants.fullTextUpgradeOptionLabel, async (newValue) => {
			this.objectInfo.fullTextUpgradeOption = newValue;
		}, this.viewInfo.fullTextUpgradeOptions, this.objectInfo.fullTextUpgradeOption, !!this.objectInfo.fullTextUpgradeOption);
		const fullTextUpgradeOptionContainer = this.createLabelInputContainer(localizedConstants.fullTextUpgradeOptionLabel, this.fullTextUpgradeOptionDropdown);

		this.maxTextReplicationSizeInput = this.createInputBox(async (newValue) => {
			this.objectInfo.maxTextReplicationSize.value = +newValue;
		}, {
			ariaLabel: localizedConstants.maxTextReplicationSizeLabel,
			inputType: 'number',
			min: this.objectInfo.maxTextReplicationSize.minimumValue,
			max: this.objectInfo.maxTextReplicationSize.maximumValue,
			value: this.objectInfo.maxTextReplicationSize.value.toString()
		});
		const maxTextReplicationSizeContainer = this.createLabelInputContainer(localizedConstants.maxTextReplicationSizeLabel, this.maxTextReplicationSizeInput);

		this.optimizeAdHocWorkloadsDropdown = this.createDropdown(localizedConstants.optimizeAdHocWorkloadsLabel, async (newValue) => {
			this.objectInfo.optimizeAdHocWorkloads = newValue === 'True';
		}, ['True', 'False'], this.objectInfo.optimizeAdHocWorkloads ? 'True' : 'False');
		const optimizeAdHocWorkloadsContainer = this.createLabelInputContainer(localizedConstants.optimizeAdHocWorkloadsLabel, this.optimizeAdHocWorkloadsDropdown);

		this.scanStartupProcsDropdown = this.createDropdown(localizedConstants.scanStartupProcsLabel, async (newValue) => {
			this.objectInfo.scanStartupProcs = newValue === 'True';
		}, ['True', 'False'], this.objectInfo.scanStartupProcs ? 'True' : 'False', isEnabled);
		const scanStartupProcsContainer = this.createLabelInputContainer(localizedConstants.scanStartupProcsLabel, this.scanStartupProcsDropdown);

		this.twoDigitYearCutoffInput = this.createInputBox(async (newValue) => {
			this.objectInfo.twoDigitYearCutoff = +newValue;
		}, {
			ariaLabel: localizedConstants.twoDigitYearCutoffLabel,
			inputType: 'number',
			value: this.objectInfo.twoDigitYearCutoff.toString()
		});
		const twoDigitYearCutoffContainer = this.createLabelInputContainer(localizedConstants.twoDigitYearCutoffLabel, this.twoDigitYearCutoffInput);

		this.costThresholdParallelismInput = this.createInputBox(async (newValue) => {
			this.objectInfo.costThresholdParallelism.value = +newValue;
		}, {
			ariaLabel: localizedConstants.costThresholdParallelismLabel,
			inputType: 'number',
			min: this.objectInfo.costThresholdParallelism.minimumValue,
			max: this.objectInfo.costThresholdParallelism.maximumValue,
			value: this.objectInfo.costThresholdParallelism.value.toString()
		});
		const costThresholdParallelismContainer = this.createLabelInputContainer(localizedConstants.costThresholdParallelismLabel, this.costThresholdParallelismInput);

		this.locksInput = this.createInputBox(async (newValue) => {
			this.objectInfo.locks.value = +newValue;
		}, {
			ariaLabel: localizedConstants.locksLabel,
			inputType: 'number',
			enabled: isEnabled,
			max: this.objectInfo.locks.maximumValue,
			min: 0,
			value: this.objectInfo.locks.value.toString(),
			validationErrorMessage: localizedConstants.locksValidation(this.objectInfo.locks.minimumValue)
		}, async () => {
			return !(+this.locksInput.value < this.objectInfo.locks.minimumValue && +this.locksInput.value !== 0);
		});
		const locksContainer = this.createLabelInputContainer(localizedConstants.locksLabel, this.locksInput);

		this.maxDegreeParallelismInput = this.createInputBox(async (newValue) => {
			this.objectInfo.maxDegreeParallelism.value = +newValue;
		}, {
			ariaLabel: localizedConstants.maxDegreeParallelismLabel,
			inputType: 'number',
			min: this.objectInfo.maxDegreeParallelism.minimumValue,
			max: this.objectInfo.maxDegreeParallelism.maximumValue,
			value: this.objectInfo.maxDegreeParallelism.value.toString()
		});
		const maxDegreeParallelismContainer = this.createLabelInputContainer(localizedConstants.maxDegreeParallelismLabel, this.maxDegreeParallelismInput);

		this.queryWaitInput = this.createInputBox(async (newValue) => {
			this.objectInfo.queryWait.value = +newValue;
		}, {
			ariaLabel: localizedConstants.queryWaitLabel,
			inputType: 'number',
			min: this.objectInfo.queryWait.minimumValue,
			max: this.objectInfo.queryWait.maximumValue,
			value: this.objectInfo.queryWait.value.toString()
		});
		const queryWaitContainer = this.createLabelInputContainer(localizedConstants.queryWaitLabel, this.queryWaitInput);

		const miscellaneousSection = this.createGroup('Miscellaneous', [
			allowTriggerToFireOthersContainer,
			blockedProcThresholdContainer,
			cursorThresholdContainer,
			defaultFullTextLanguageContainer,
			defaultLanguageContainer,
			fullTextUpgradeOptionContainer,
			maxTextReplicationSizeContainer,
			optimizeAdHocWorkloadsContainer,
			scanStartupProcsContainer,
			twoDigitYearCutoffContainer
		], true);
		const parallelismSection = this.createGroup('Parallelism', [
			costThresholdParallelismContainer,
			locksContainer,
			maxDegreeParallelismContainer,
			queryWaitContainer
		], true);

		const advancedTabContainer = this.createGroup('', [miscellaneousSection, parallelismSection])

		this.advancedTab = this.createTab(this.advancedTabId, localizedConstants.AdvancedSectionHeader, advancedTabContainer);
	}
}
