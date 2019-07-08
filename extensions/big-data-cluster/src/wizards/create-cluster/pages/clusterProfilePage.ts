/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { WizardPageBase } from '../../wizardPageBase';
import { CreateClusterWizard } from '../createClusterWizard';
import * as nls from 'vscode-nls';
import { ClusterProfile, PoolConfiguration, ClusterPoolType, SQLServerMasterConfiguration, ClusterResourceSummary } from '../../../interfaces';


const localize = nls.loadMessageBundle();
const LabelWidth = '200px';
const InputWidth = '300px';

export class ClusterProfilePage extends WizardPageBase<CreateClusterWizard> {
	private view: azdata.ModelView;
	private clusterProfiles: ClusterProfile[];
	private poolList: azdata.FlexContainer;
	private detailContainer: azdata.FlexContainer;
	private clusterResourceView: azdata.GroupContainer;
	private poolListMap = {};
	private clusterResourceContainer: azdata.FlexContainer;
	private clusterResourceLoadingComponent: azdata.LoadingComponent;
	private clusterResource: ClusterResourceSummary;


	constructor(wizard: CreateClusterWizard) {
		super(localize('bdc-create.clusterProfilePageTitle', 'Select a cluster profile'),
			localize('bdc-create.clusterProfilePageDescription', 'Select your requirement and we will provide you a pre-defined default scaling. You can later go to cluster configuration and customize it.'),
			wizard);
	}

	public onEnter(): void {
		this.updatePoolList();
		this.clusterResourceLoadingComponent.loading = true;
		this.wizard.model.getClusterResource().then((resource) => {
			this.clusterResource = resource;
			this.initializeClusterResourceView();
		});
		this.wizard.wizardObject.registerNavigationValidator(() => {
			return true;
		});
	}

	protected initialize(view: azdata.ModelView): Thenable<void> {
		this.view = view;
		let fetchProfilePromise = this.wizard.model.getProfiles().then(p => { this.clusterProfiles = p; });
		return Promise.all([fetchProfilePromise]).then(() => {
			this.wizard.model.profile = this.clusterProfiles[0];
			this.clusterResourceView = this.view.modelBuilder.groupContainer().withLayout({
				header: localize('bdc-create.TargetClusterOverview', 'Target cluster scale overview'),
				collapsed: true,
				collapsible: true
			}).component();

			this.clusterResourceContainer = this.view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
			this.clusterResourceLoadingComponent = this.view.modelBuilder.loadingComponent().withItem(this.clusterResourceContainer).component();
			this.clusterResourceView.addItem(this.clusterResourceLoadingComponent);

			let profileLabel = view.modelBuilder.text().withProperties({ value: localize('bdc-create.clusterProfileLabel', 'Deployment profile') }).component();
			let profileDropdown = view.modelBuilder.dropDown().withProperties<azdata.DropDownProperties>({
				values: this.clusterProfiles.map(profile => profile.name),
				width: '300px'
			}).component();
			let dropdownRow = this.view.modelBuilder.flexContainer().withItems([profileLabel, profileDropdown], { CSSStyles: { 'margin-right': '30px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
			let poolContainer = this.view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row', width: '100%', height: '100%' }).component();
			this.poolList = this.view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column', width: '300px', height: '100%' }).component();
			poolContainer.addItem(this.poolList, {
				CSSStyles: {
					'border-top-style': 'solid',
					'border-top-width': '2px',
					'border-right-style': 'solid',
					'border-right-width': '2px',
					'border-color': 'lightgray'
				}
			});

			this.detailContainer = this.view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column', width: '760px', height: '100%' }).component();
			poolContainer.addItem(this.detailContainer, {
				CSSStyles: {
					'border-top-style': 'solid',
					'border-top-width': '2px',
					'border-color': 'lightgray'
				}
			});

			this.wizard.registerDisposable(profileDropdown.onValueChanged(() => {
				let profiles = this.clusterProfiles.filter(p => profileDropdown.value === p.name);
				if (profiles && profiles.length === 1) {
					this.wizard.model.profile = profiles[0];
					this.updatePoolList();
					this.clearPoolDetail();
				}
			}));

			this.initializePoolList();

			let pageContainer = this.view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'column',
				height: '800px'
			}).component();
			pageContainer.addItem(this.clusterResourceView, {
				flex: '0 0 auto',
				CSSStyles: {
					'margin-bottom': '20px',
					'padding-bottom': '5px',
					'padding-top': '5px'
				}
			});
			pageContainer.addItem(dropdownRow, {
				flex: '0 0 auto',
				CSSStyles: { 'margin-bottom': '10px' }
			});
			pageContainer.addItem(poolContainer, {
				flex: '1 1 auto',
				CSSStyles: {
					'display': 'flex'
				}
			});
			let formBuilder = view.modelBuilder.formContainer();
			let form = formBuilder.withFormItems([{
				title: '',
				component: pageContainer
			}], {
					horizontal: false,
					componentWidth: '100%'
				}).component();

			return view.initializeModel(form);
		});
	}

	private initializeClusterResourceView(): void {
		this.clusterResourceContainer.clearItems();
		let text = this.view.modelBuilder.text().withProperties({ value: localize('bdc-create.HardwareProfileText', 'Hardware profile') }).component();
		let height = (this.clusterResource.hardwareLabels.length * 25) + 30;
		let labelColumn: azdata.TableColumn = {
			value: localize('bdc-create.HardwareLabelColumnName', 'Label'),
			width: 100
		};
		let totalNodesColumn: azdata.TableColumn = {
			value: localize('bdc-create.TotalNodesColumnName', 'Nodes'),
			width: 50
		};
		let totalCoresColumn: azdata.TableColumn = {
			value: localize('bdc-create.TotalCoresColumnName', 'Cores'),
			width: 50
		};
		let totalMemoryColumn: azdata.TableColumn = {
			value: localize('bdc-create.TotalMemoryColumnName', 'Memory'),
			width: 50
		};
		let totalDisksColumn: azdata.TableColumn = {
			value: localize('bdc-create.TotalDisksColumnName', 'Disks'),
			width: 50
		};

		let table = this.view.modelBuilder.table().withProperties<azdata.TableComponentProperties>({
			height: `${height}px`,
			data: this.clusterResource.hardwareLabels.map(label => [label.name, label.totalNodes, label.totalCores, label.totalMemoryInGB, label.totalDisks]),
			columns: [labelColumn, totalNodesColumn, totalCoresColumn, totalMemoryColumn, totalDisksColumn],
			width: '300px'

		}).component();
		this.clusterResourceContainer.addItems([text, table]);
		this.clusterResourceLoadingComponent.loading = false;
	}

	private initializePoolList(): void {
		let pools = [this.wizard.model.profile.sqlServerMasterConfiguration,
		this.wizard.model.profile.computePoolConfiguration,
		this.wizard.model.profile.dataPoolConfiguration,
		this.wizard.model.profile.sparkPoolConfiguration,
		this.wizard.model.profile.storagePoolConfiguration];
		pools.forEach(pool => {
			let poolSummaryButton = this.view.modelBuilder.divContainer().withProperties<azdata.DivContainerProperties>({ clickable: true }).component();
			let container = this.view.modelBuilder.flexContainer().component();
			this.wizard.registerDisposable(poolSummaryButton.onDidClick(() => {
				this.clearPoolDetail();
				let currentPool: PoolConfiguration;
				switch (pool.type) {
					case ClusterPoolType.SQL:
						currentPool = this.wizard.model.profile.sqlServerMasterConfiguration;
						break;
					case ClusterPoolType.Compute:
						currentPool = this.wizard.model.profile.computePoolConfiguration;
						break;
					case ClusterPoolType.Data:
						currentPool = this.wizard.model.profile.dataPoolConfiguration;
						break;
					case ClusterPoolType.Storage:
						currentPool = this.wizard.model.profile.storagePoolConfiguration;
						break;
					case ClusterPoolType.Spark:
						currentPool = this.wizard.model.profile.sparkPoolConfiguration;
						break;
					default:
						break;
				}
				if (currentPool) {
					this.detailContainer.addItem(this.createPoolConfigurationPart(currentPool), { CSSStyles: { 'margin-left': '10px' } });
				}
			}));

			let text = this.view.modelBuilder.text().component();
			this.poolListMap[pool.type] = text;
			text.width = '250px';
			let chrevron = this.view.modelBuilder.text().withProperties({ value: '>' }).component();
			chrevron.width = '30px';
			container.addItem(text);
			container.addItem(chrevron, {
				CSSStyles: {
					'font-size': '20px',
					'line-height': '0px'
				}
			});
			poolSummaryButton.addItem(container);
			this.poolList.addItem(poolSummaryButton, {
				CSSStyles: {
					'border-bottom-style': 'solid',
					'border-bottom-width': '1px',
					'border-color': 'lightgray',
					'cursor': 'pointer'
				}
			});
		});
	}

	private createPoolConfigurationPart(configuration: PoolConfiguration): azdata.Component {
		let container = this.view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
		switch (configuration.type) {
			case ClusterPoolType.SQL:
				this.createSQLConfigurationPart(container, configuration as SQLServerMasterConfiguration);
				break;
			default:
				this.createDefaultPoolConfigurationPart(container, configuration);
				break;
		}
		return container;
	}

	private createSQLConfigurationPart(container: azdata.FlexContainer, configuration: SQLServerMasterConfiguration): void {
		this.createDefaultPoolConfigurationPart(container, configuration);
		this.addFeatureSetRow(container, configuration);
	}

	private createDefaultPoolConfigurationPart(container: azdata.FlexContainer, configuration: PoolConfiguration): void {
		this.addPoolNameLabel(container, this.getPoolDisplayName(configuration.type));
		this.addPoolDescriptionLabel(container, this.getPoolDescription(configuration.type));
		this.addScaleRow(container, configuration);
		this.addHardwareLabelRow(container, configuration);
	}

	private addPoolNameLabel(container: azdata.FlexContainer, text: string): void {
		let poolNameLabel = this.view.modelBuilder.text().withProperties({ value: text }).component();
		container.addItem(poolNameLabel, {
			flex: '0 0 auto', CSSStyles: {
				'font-size': '13px',
				'font-weight': 'bold'
			}
		});
	}

	private addPoolDescriptionLabel(container: azdata.FlexContainer, text: string): void {
		let label = this.view.modelBuilder.text().withProperties({ value: text }).component();
		container.addItem(label, {
			flex: '0 0 auto',
			CSSStyles: {
				'margin-bottom': '20px'
			}
		});
	}

	private addScaleRow(container: azdata.FlexContainer, configuration: PoolConfiguration): void {
		let label = this.view.modelBuilder.text().withProperties({ value: localize('bdc-create.ScaleLabel', 'Scale') }).component();
		label.width = LabelWidth;
		let input = this.view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			inputType: 'number',
			value: configuration.scale.toString(),
			min: 1,
			max: configuration.maxScale
		}).component();

		this.wizard.registerDisposable(input.onTextChanged(() => {
			configuration.scale = Number(input.value);
			this.updatePoolList();
		}));
		input.width = InputWidth;
		let row = this.createRow([label, input]);
		container.addItem(row);
	}

	private addHardwareLabelRow(container: azdata.FlexContainer, configuration: PoolConfiguration): void {
		let label = this.view.modelBuilder.text().withProperties({ value: localize('bdc-create.HardwareProfileLabel', 'Hardware profile label') }).component();
		label.width = LabelWidth;
		let optionalValues = this.clusterResource.hardwareLabels.map(label => label.name);
		configuration.hardwareLabel = configuration.hardwareLabel ? configuration.hardwareLabel : optionalValues[0];
		let input = this.view.modelBuilder.dropDown().withProperties<azdata.DropDownProperties>({ value: configuration.hardwareLabel, values: optionalValues }).component();
		this.wizard.registerDisposable(input.onValueChanged(() => {
			configuration.hardwareLabel = input.value.toString();
		}));
		input.width = InputWidth;
		let row = this.createRow([label, input]);
		container.addItem(row);
	}

	private addFeatureSetRow(container: azdata.FlexContainer, configuration: SQLServerMasterConfiguration): void {
		const radioGroupName = 'featureset';
		let label = this.view.modelBuilder.text().withProperties({ value: localize('bdc-create.FeatureSetLabel', 'Feature set') }).component();
		label.width = LabelWidth;
		let engineOnlyOption = this.view.modelBuilder.radioButton().withProperties<azdata.RadioButtonProperties>({ label: localize('bdc-create.EngineOnlyText', 'Engine only'), name: radioGroupName, checked: configuration.engineOnly }).component();
		let engineWithFeaturesOption = this.view.modelBuilder.radioButton().withProperties<azdata.RadioButtonProperties>({ label: localize('bdc-create.EngineWithFeaturesText', 'Engine with optional features'), name: radioGroupName, checked: !configuration.engineOnly }).component();
		let optionContainer = this.view.modelBuilder.divContainer().component();
		optionContainer.width = InputWidth;
		optionContainer.addItems([engineOnlyOption, engineWithFeaturesOption]);
		container.addItem(this.createRow([label, optionContainer]));
		this.wizard.registerDisposable(engineOnlyOption.onDidClick(() => {
			configuration.engineOnly = true;
		}));
		this.wizard.registerDisposable(engineWithFeaturesOption.onDidClick(() => {
			configuration.engineOnly = false;
		}));
	}

	private createRow(items: azdata.Component[]): azdata.FlexContainer {
		return this.view.modelBuilder.flexContainer().withItems(items, {
			CSSStyles: {
				'margin-right': '5px'
			}
		}).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
	}

	private getPoolDisplayName(poolType: ClusterPoolType): string {
		switch (poolType) {
			case ClusterPoolType.SQL:
				return localize('bdc-create.SQLServerMasterDisplayName', 'SQL Server master');
			case ClusterPoolType.Compute:
				return localize('bdc-create.ComputePoolDisplayName', 'Compute pool');
			case ClusterPoolType.Data:
				return localize('bdc-create.DataPoolDisplayName', 'Data pool');
			case ClusterPoolType.Storage:
				return localize('bdc-create.StoragePoolDisplayName', 'Storage pool');
			case ClusterPoolType.Spark:
				return localize('bdc-create.SparkPoolDisplayName', 'Spark pool');
			default:
				throw new Error('unknown pool type');
		}
	}

	private getPoolDescription(poolType: ClusterPoolType): string {
		switch (poolType) {
			case ClusterPoolType.SQL:
				return localize('bdc-create.SQLServerMasterDescription', 'The SQL Server instance provides an externally accessible TDS endpoint for the cluster');
			case ClusterPoolType.Compute:
				return localize('bdc-create.ComputePoolDescription', 'TODO: Add description');
			case ClusterPoolType.Data:
				return localize('bdc-create.DataPoolDescription', 'TODO: Add description');
			case ClusterPoolType.Storage:
				return localize('bdc-create.StoragePoolDescription', 'TODO: Add description');
			case ClusterPoolType.Spark:
				return localize('bdc-create.SparkPoolDescription', 'TODO: Add description');
			default:
				throw new Error('unknown pool type');
		}
	}

	private updatePoolList(): void {
		let pools = [this.wizard.model.profile.sqlServerMasterConfiguration,
		this.wizard.model.profile.computePoolConfiguration,
		this.wizard.model.profile.dataPoolConfiguration,
		this.wizard.model.profile.sparkPoolConfiguration,
		this.wizard.model.profile.storagePoolConfiguration];
		pools.forEach(pool => {
			let text = this.poolListMap[pool.type] as azdata.TextComponent;
			if (text) {
				text.value = localize({
					key: 'bdc-create.poolLabelTemplate',
					comment: ['{0} is the pool name, {1} is the scale number']
				}, '{0} ({1})', this.getPoolDisplayName(pool.type), pool.scale);
			}
		});
	}

	private clearPoolDetail(): void {
		this.detailContainer.clearItems();
	}
}
