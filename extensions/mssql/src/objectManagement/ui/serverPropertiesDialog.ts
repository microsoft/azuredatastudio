/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { DefaultColumnCheckboxWidth } from '../../ui/dialogBase';
import { IObjectManagementService } from 'mssql';
import * as localizedConstants from '../localizedConstants';
import { ViewGeneralServerPropertiesDocUrl, ViewMemoryServerPropertiesDocUrl, ViewProcessorsServerPropertiesDocUrl } from '../constants';
import { Server, ServerViewInfo, NumaNode, AffinityType } from '../interfaces';

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
	private activeTabId: string;

	constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
		super(objectManagementService, options);
		this.dialogObject.customButtons[1].enabled = false;
	}

	protected override get helpUrl(): string {
		let helpUrl = '';
		switch (this.activeTabId) {
			case this.generalTabId:
				helpUrl = ViewGeneralServerPropertiesDocUrl;
				break;
			case this.memoryTabId:
				helpUrl = ViewMemoryServerPropertiesDocUrl;
			case this.processorsTabId:
				helpUrl = ViewProcessorsServerPropertiesDocUrl;
			default:
				break;
		}
		return helpUrl;
	}

	protected override onFormFieldChange(): void {
		this.dialogObject.customButtons[1].enabled = false;
		this.dialogObject.okButton.enabled = this.isDirty;
	}

	protected async initializeUI(): Promise<void> {
		const serverInfo = await azdata.connection.getServerInfo(this.options.objectExplorerContext.connectionProfile.id);
		this.engineEdition = serverInfo.engineEditionId;
		this.initializeGeneralSection();
		this.initializeMemorySection();
		this.initializeProcessorsSection();
		const serverPropertiesTabGroup = { title: '', tabs: [this.generalTab, this.memoryTab, this.processorsTab] };
		const serverPropertiesTabbedPannel = this.modelView.modelBuilder.tabbedPanel()
			.withTabs([serverPropertiesTabGroup])
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
		this.nameInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.NameText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.name
		});
		const nameContainer = this.createLabelInputContainer(localizedConstants.NameText, this.nameInput);

		this.hardwareGenerationInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.HardwareGenerationText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.hardwareGeneration.toString()
		});
		const hardwareGenerationContainer = this.createLabelInputContainer(localizedConstants.HardwareGenerationText, this.hardwareGenerationInput);

		this.languageDropdown = this.createDropdown(localizedConstants.LanguageText, async () => { }, [this.objectInfo.language], this.objectInfo.language, this.options.isNewObject);
		const languageContainer = this.createLabelInputContainer(localizedConstants.LanguageText, this.languageDropdown);

		this.memoryInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.MemoryText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: localizedConstants.StringValueInMB(this.objectInfo.memoryInMB.toString())
		});
		const memoryContainer = this.createLabelInputContainer(localizedConstants.MemoryText, this.memoryInput);

		this.operatingSystemInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.OperatingSystemText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.operatingSystem
		});
		const operatingSystemContainer = this.createLabelInputContainer(localizedConstants.OperatingSystemText, this.operatingSystemInput);

		this.platformInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.PlatformText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.platform
		});
		const platformContainer = this.createLabelInputContainer(localizedConstants.PlatformText, this.platformInput);

		this.processorsInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.ProcessorsText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.processors
		});
		const processorsContainer = this.createLabelInputContainer(localizedConstants.ProcessorsText, this.processorsInput);

		this.isClusteredInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.IsClusteredText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.isClustered.toString()
		});
		const isClusteredContainer = this.createLabelInputContainer(localizedConstants.IsClusteredText, this.isClusteredInput);

		this.isHadrEnabledInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.IsHadrEnabledText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.isHadrEnabled.toString()
		});
		const isHadrEnabledContainer = this.createLabelInputContainer(localizedConstants.IsHadrEnabledText, this.isHadrEnabledInput);

		this.isPolyBaseInstalledInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.IsPolyBaseInstalledText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.isPolyBaseInstalled.toString()
		});
		const isPolyBaseInstalledContainer = this.createLabelInputContainer(localizedConstants.IsPolyBaseInstalledText, this.isPolyBaseInstalledInput);

		this.isXTPSupportedInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.IsXTPSupportedText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.isXTPSupported.toString()
		});
		const isXTPSupportedContainer = this.createLabelInputContainer(localizedConstants.IsXTPSupportedText, this.isXTPSupportedInput);

		this.productInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.ProductText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.product
		});
		const productContainer = this.createLabelInputContainer(localizedConstants.ProductText, this.productInput);

		this.reservedStorageSizeInMBInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.ReservedStorageSizeInMBText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: localizedConstants.StringValueInMB(this.objectInfo.reservedStorageSizeMB.toString())
		});
		const reservedStorageSizeInMBContainer = this.createLabelInputContainer(localizedConstants.ReservedStorageSizeInMBText, this.reservedStorageSizeInMBInput);

		this.rootDirectoryInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.RootDirectoryText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.rootDirectory
		});
		const rootDirectoryContainer = this.createLabelInputContainer(localizedConstants.RootDirectoryText, this.rootDirectoryInput);

		this.serverCollationInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.ServerCollationText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.serverCollation
		});
		const serverCollationContainer = this.createLabelInputContainer(localizedConstants.ServerCollationText, this.serverCollationInput);

		this.serviceTierInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.ServiceTierText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.serviceTier
		});
		const serviceTierContainer = this.createLabelInputContainer(localizedConstants.ServiceTierText, this.serviceTierInput);

		this.storageSpaceUsageInMBInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.StorageSpaceUsageInMBText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: localizedConstants.StringValueInMB(this.objectInfo.storageSpaceUsageInMB.toString())
		});
		const storageSpaceUsageInMbContainer = this.createLabelInputContainer(localizedConstants.StorageSpaceUsageInMBText, this.storageSpaceUsageInMBInput);

		this.versionInput = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.VersionText,
			inputType: 'text',
			enabled: this.options.isNewObject,
			value: this.objectInfo.version
		});
		const versionContainer = this.createLabelInputContainer(localizedConstants.VersionText, this.versionInput);

		let platformItems = [
			nameContainer,
			languageContainer,
			memoryContainer,
			operatingSystemContainer,
			platformContainer,
			processorsContainer
		];

		let sqlServerItems = [
			isClusteredContainer,
			isHadrEnabledContainer,
			isPolyBaseInstalledContainer,
			isXTPSupportedContainer,
			productContainer,
			rootDirectoryContainer,
			serverCollationContainer,
			versionContainer
		];

		if (this.engineEdition === azdata.DatabaseEngineEdition.SqlManagedInstance) {
			platformItems.unshift(hardwareGenerationContainer);
			sqlServerItems.push(reservedStorageSizeInMBContainer, serviceTierContainer, storageSpaceUsageInMbContainer);
			// remove isXTPSupported
			sqlServerItems.splice(3, 1);
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
			required: true
		};
		this.minServerMemoryInput = this.createInputBox(async (newValue) => {
			this.objectInfo.minServerMemory.value = +newValue;
		}, minServerProps);
		const minMemoryContainer = this.createLabelInputContainer(localizedConstants.minServerMemoryText, this.minServerMemoryInput);

		const maxServerProps: azdata.InputBoxProperties = {
			ariaLabel: localizedConstants.maxServerMemoryText,
			inputType: 'number',
			enabled: isEnabled,
			max: this.objectInfo.maxServerMemory.maximumValue,
			min: this.objectInfo.maxServerMemory.minimumValue,
			required: true
		};
		this.maxServerMemoryInput = this.createInputBox(async (newValue) => {
			this.objectInfo.maxServerMemory.value = +newValue;
		}, maxServerProps);
		const maxMemoryContainer = this.createLabelInputContainer(localizedConstants.maxServerMemoryText, this.maxServerMemoryInput);

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

	private initializeProcessorsSection(): void {
		const isEnabled = this.engineEdition !== azdata.DatabaseEngineEdition.SqlManagedInstance;
		let nodes: NumaNode[] = this.objectInfo.numaNodes;
		let nodeTableList: azdata.TableComponent[] = [];
		let tableGroups: azdata.GroupContainer[] = [];
		for (let node of nodes) {
			let table = this.createProcessorTable(node);
			nodeTableList.push(table);
			tableGroups.push(this.createGroup(localizedConstants.serverNumaNodeLabel(node.numaNodeId), [table], true));
		}
		this.autoSetProcessorAffinityMaskForAllCheckbox = this.createCheckbox(localizedConstants.autoSetProcessorAffinityMaskForAllText, async (newValue) => {
			this.objectInfo.autoProcessorAffinityMaskForAll = newValue;
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
		}, this.objectInfo.autoProcessorAffinityMaskForAll, isEnabled);

		this.autoSetProcessorIOAffinityMaskForAllCheckbox = this.createCheckbox(localizedConstants.autoSetProcessorAffinityIOMaskForAllText, async (newValue) => {
			this.objectInfo.autoProcessorAffinityIOMaskForAll = newValue;
			for (let table of nodeTableList) {
				let newData = table.data;
				for (let i = 0; i < newData.length; i++) {
					if (newValue) {
						// if IO affinity mask for all is checked, then uncheck the individual processors
						newData[i][AffinityType.IOAffinity] = false;
					}
				}
				await this.setTableData(table, newData);
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
					this.onFormFieldChange();
				}
				// uncheck the set all processors checkbox
				if (checkboxState.column === AffinityType.ProcessorAffinity) {
					this.autoSetProcessorAffinityMaskForAllCheckbox.checked = false;
					this.objectInfo.autoProcessorAffinityMaskForAll = false;
					this.objectInfo.numaNodes[+numaNode.numaNodeId].processors[checkboxState.row].affinity = checkboxState.checked;
				} else {
					this.autoSetProcessorIOAffinityMaskForAllCheckbox.checked = false;
					this.objectInfo.autoProcessorAffinityIOMaskForAll = false;
					this.objectInfo.numaNodes[+numaNode.numaNodeId].processors[checkboxState.row].ioAffinity = checkboxState.checked;
				}
			}
		}));
		return processorTable;
	}
}
