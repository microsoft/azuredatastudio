/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationStateModel } from '../models/stateMachine';
import * as constants from '../constants/strings';
import * as utils from '../api/utils';
import { getSourceConnectionProfile } from '../api/sqlUtils';
import * as styles from '../constants/styles';
import { WIZARD_INPUT_COMPONENT_WIDTH } from './wizardController';
import { MigrationLocalStorage, MigrationServiceContext } from '../models/migrationLocalStorage';


export class SourceSelectionSection {
	private _view!: azdata.ModelView;
	private _disposables: vscode.Disposable[] = [];
	public _sourceInfrastructureTypeDropdown!: azdata.DropDownComponent;
	private _azureAccountsLabel!: azdata.TextComponent;
	public _azureAccountsDropdown!: azdata.DropDownComponent;
	private _serviceContext!: MigrationServiceContext;
	private _azureSubscriptionLabel!: azdata.TextComponent;
	public _azureSubscriptionDropdown!: azdata.DropDownComponent;
	private _azureLocationLabel!: azdata.TextComponent;
	public _azureLocationDropdown!: azdata.DropDownComponent;
	private _azureResourceGroupLabel!: azdata.TextComponent;
	public _azureResourceGroupDropdown!: azdata.DropDownComponent;
	private _azureArcSqlServerLabel!: azdata.TextComponent;
	public _azureArcSqlServerDropdown!: azdata.DropDownComponent;

	constructor(private wizard: azdata.window.Wizard, public migrationStateModel: MigrationStateModel) { }

	public async populateAzureAccountsDropdown(): Promise<void> {
		try {
			this.migrationStateModel._azureAccounts = await utils.getAzureAccounts();

			const accountId =
				this.migrationStateModel._azureAccount?.displayInfo?.userId ??
				this._serviceContext?.azureAccount?.displayInfo?.userId;
			this._azureAccountsDropdown.values = await utils.getAzureAccountsDropdownValues(this.migrationStateModel._azureAccounts);

			utils.selectDefaultDropdownValue(
				this._azureAccountsDropdown,
				accountId,
				false);
			const selectedAccount = this.migrationStateModel._azureAccounts?.find(
				account => account.displayInfo.displayName === (<azdata.CategoryValue>this._azureAccountsDropdown.value)?.displayName
			);
			this.migrationStateModel._azureAccount = (selectedAccount)
				? utils.deepClone(selectedAccount)!
				: undefined!;
		} catch (e) {
			console.log(e);
		}
	}

	public async populateSubscriptionDropdown(): Promise<void> {
		try {
			this.migrationStateModel._subscriptions = await utils.getAzureSubscriptions(this.migrationStateModel._azureAccount);
			const subscriptionId = this.migrationStateModel._arcResourceSubscription?.id;
			this._azureSubscriptionDropdown.values = await utils.getAzureSubscriptionsDropdownValues(this.migrationStateModel._subscriptions);

			utils.selectDefaultDropdownValue(
				this._azureSubscriptionDropdown,
				subscriptionId,
				false);
			const selectedSubscription = this.migrationStateModel._subscriptions?.find(
				subscription => `${subscription.name} - ${subscription.id}` === (<azdata.CategoryValue>this._azureSubscriptionDropdown.value)?.displayName
			);
			this.migrationStateModel._arcResourceSubscription = (selectedSubscription)
				? utils.deepClone(selectedSubscription)!
				: undefined!;
			this.migrationStateModel.refreshDatabaseBackupPage = true;
		} catch (e) {
			console.log(e);
		}
	}

	public async populateLocationDropdown(): Promise<void> {
		try {
			this.migrationStateModel._locations = await utils.getAzureArcLocations(
				this.migrationStateModel._arcResourceAzureAccount,
				this.migrationStateModel._arcResourceSubscription);

			const location = this.migrationStateModel._arcResourceLocation?.displayName;
			this._azureLocationDropdown.values = utils.getAzureLocationsDropdownValues(this.migrationStateModel._locations);
			utils.selectDefaultDropdownValue(
				this._azureLocationDropdown,
				location,
				true
			);
			const selectedLocation = this.migrationStateModel._locations?.find(
				location => location.displayName === (<azdata.CategoryValue>this._azureLocationDropdown.value)?.displayName
			);
			this.migrationStateModel._arcResourceLocation = (selectedLocation)
				? utils.deepClone(selectedLocation)!
				: undefined!;
		} catch (e) {
			console.log(e);
		}
	}

	public async populateResourceGroupDropdown(): Promise<void> {
		try {
			this.migrationStateModel._resourceGroups = await utils.getAllResourceGroups(
				this.migrationStateModel._azureAccount,
				this.migrationStateModel._arcResourceSubscription);

			const resourceGroupId = this.migrationStateModel._arcResourceResourceGroup?.id;

			this._azureResourceGroupDropdown.values = utils.getResourceDropdownValues(
				this.migrationStateModel._resourceGroups,
				constants.RESOURCE_GROUP_NOT_FOUND);

			utils.selectDefaultDropdownValue(
				this._azureResourceGroupDropdown,
				resourceGroupId,
				false
			);

			const selectedResourceGroup = this.migrationStateModel._resourceGroups?.find(
				rg => rg.name === (<azdata.CategoryValue>this._azureResourceGroupDropdown.value)?.displayName
			);
			this.migrationStateModel._arcResourceResourceGroup = (selectedResourceGroup)
				? utils.deepClone(selectedResourceGroup)!
				: undefined!;
		} catch (e) {
			console.log(e);
		}
	}

	private async populateArcSqlServerDropdown(): Promise<void> {
		try {
			const arcSqlServer = this.migrationStateModel._arcSqlServer?.name;

			this.migrationStateModel._sourceArcSqlServers = await utils.getAzureSqlArcServersByLocation(
				this.migrationStateModel._arcResourceAzureAccount,
				this.migrationStateModel._arcResourceSubscription,
				this.migrationStateModel._arcResourceLocation,
				this.migrationStateModel._arcResourceResourceGroup);

			this._azureArcSqlServerDropdown.values = utils.getAzureResourceDropdownValues(
				this.migrationStateModel._sourceArcSqlServers,
				this.migrationStateModel._arcResourceLocation,
				this.migrationStateModel._arcResourceResourceGroup?.name,
				constants.SQL_SERVER_INSTANCE_NOT_FOUND);

			utils.selectDefaultDropdownValue(
				this._azureArcSqlServerDropdown,
				arcSqlServer,
				true);
		} catch (e) {
			console.log(e);
		}
	}

	public async createSourceSelectionContainer(view: azdata.ModelView): Promise<azdata.Component> {
		this._view = view;
		this._serviceContext = await MigrationLocalStorage.getMigrationServiceContext();

		const isSqlServerTrackedInAzureQuestion = this._view.modelBuilder.text()
			.withProps({
				value: constants.IS_SQL_SERVER_TRACKED_IN_AZURE,
				CSSStyles: { ...styles.BODY_CSS, 'margin-right': '20px' }
			}).component();
		const buttonGroup = 'isSqlServerTrackedInAzure';
		const isSqlServerTrackedInAzureButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: buttonGroup,
				label: constants.YES,
				checked: this.migrationStateModel._isSqlServerEnabledByArc,
				CSSStyles: { ...styles.BODY_CSS },
			}).component();

		const isSqlServerNotTrackedInAzureButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: buttonGroup,
				label: constants.NO,
				checked: !this.migrationStateModel._isSqlServerEnabledByArc,
				CSSStyles: { ...styles.BODY_CSS, 'margin-left': '30px' }
			}).component();

		const isSqlServerTrackedInAzureButtonContainer = view.modelBuilder.flexContainer().withItems(
			[isSqlServerTrackedInAzureQuestion, isSqlServerTrackedInAzureButton, isSqlServerNotTrackedInAzureButton],
			{ flex: '0 0 auto' }
		).withLayout({ flexFlow: 'row' }).component();

		const trackMigrationQuestion = this._view.modelBuilder.text()
			.withProps({
				value: constants.TRACK_MIGRATION_PROCESS_IN_AZURE_PORTAL,
				CSSStyles: { ...styles.BODY_CSS, 'margin-right': '20px' }
			}).component();

		const trackingButtonGroup = "trackMigration";
		const trackMigrationButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: trackingButtonGroup,
				label: constants.YES,
				checked: this.migrationStateModel._trackMigration,
				CSSStyles: { ...styles.BODY_CSS },
			}).component();

		const noTrackMigrationButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: trackingButtonGroup,
				label: constants.NO,
				checked: !this.migrationStateModel._trackMigration,
				CSSStyles: { ...styles.BODY_CSS, 'margin-left': '30px' }
			}).component();

		const trackMigrationButtonContainer = view.modelBuilder.flexContainer().withItems(
			[trackMigrationQuestion, trackMigrationButton, noTrackMigrationButton],
			{ flex: '0 0 auto' }
		).withLayout({ flexFlow: 'row' }).component();

		const arcResourceContainer = this._view.modelBuilder.flexContainer()
			.withProps({
				CSSStyles: {
					'flex-direction': 'column',
					'margin-bottom': '20px',
					'margin-top': '10px'
				}
			}).component();

		const nonArcResourceContainer = this._view.modelBuilder.flexContainer()
			.withProps({
				CSSStyles: {
					'flex-direction': 'column',
					'margin-bottom': '20px',
					'margin-top': '10px'
				}
			}).component();
		const sourceInfrastructureTypeContainer = this.createSourceInfrastructureTypeContainer();
		const arcResourceCreationInfoContainer = this.createArcResourceCreationInfoContainer();

		const arcResourceHeading = this._view.modelBuilder.text()
			.withProps({
				value: constants.SQL_SERVER_TARCKED_IN_AZURE_DETAILS,
				CSSStyles: {
					...styles.LABEL_CSS,
					'margin-top': '5px'
				},
			}).component();

		const nonArcResourceHeading = this._view.modelBuilder.text()
			.withProps({
				value: constants.SQL_SERVER_INSTANCE_DETAILS,
				CSSStyles: {
					...styles.LABEL_CSS,
					'margin-top': '5px'
				},
			}).component();

		const accountDropdown = this.createAzureAccountsDropdown();
		const subscriptionDropdown = this.createSubscriptionDropdown();
		const resourceGroupDropdown = this.createResourceGroupDropdown();
		const locationDropdown = this.createLocationDropdown();
		const arcSqlServerDropdown = await this.createArcSqlServerDropdown();

		arcResourceContainer.addItems([
			arcResourceHeading,
			accountDropdown,
			subscriptionDropdown,
			locationDropdown,
			resourceGroupDropdown,
			arcSqlServerDropdown
		]);

		nonArcResourceContainer.addItems([
			sourceInfrastructureTypeContainer,
			arcResourceCreationInfoContainer,
			nonArcResourceHeading,
			accountDropdown,
			subscriptionDropdown,
			locationDropdown,
			resourceGroupDropdown,
		]);

		const flex = view.modelBuilder.flexContainer().withItems(
			[isSqlServerTrackedInAzureButtonContainer, trackMigrationButtonContainer]
		).withLayout({ flexFlow: 'column' }).component();

		this._disposables.push(
			isSqlServerTrackedInAzureButton.onDidChangeCheckedState(async (checked) => {
				if (checked) {
					await this._azureSubscriptionLabel.updateProperties({ description: constants.ARC_RESOURCE_SUBSCRIPTION_INFO });
					await this._azureLocationLabel.updateProperties({ description: constants.ARC_RESOURCE_LOCATION_INFO });
					await this._azureResourceGroupLabel.updateProperties({ description: constants.ARC_RESOURCE_RESOURCE_GROUP_INFO });
					await this._azureArcSqlServerLabel.updateProperties({ description: constants.ARC_RESOURCE_INFO });
					flex.removeItem(nonArcResourceContainer);
					flex.addItem(arcResourceContainer);
					trackMigrationButtonContainer.display = 'none';
					this.migrationStateModel._isSqlServerEnabledByArc = checked;
				}
			})
		);
		this._disposables.push(
			isSqlServerNotTrackedInAzureButton.onDidChangeCheckedState(async (checked) => {
				if (checked) {
					flex.removeItem(arcResourceContainer);
					trackMigrationButtonContainer.display = 'flex';
					this.migrationStateModel._isSqlServerEnabledByArc = !checked;
					if (this.migrationStateModel._trackMigration) {
						await this._azureSubscriptionLabel.updateProperties({ description: constants.NON_ARC_RESOURCE_SUBSCRIPTION_INFO });
						await this._azureLocationLabel.updateProperties({ description: constants.NON_ARC_RESOURCE_LOCATION_INFO });
						await this._azureResourceGroupLabel.updateProperties({ description: constants.NON_ARC_RESOURCE_RESOURCE_GROUP_INFO });
						flex.addItem(nonArcResourceContainer);
					}
				}
			})
		);

		this._disposables.push(
			trackMigrationButton.onDidChangeCheckedState(async (checked) => {
				if (checked) {
					this.migrationStateModel._trackMigration = checked;
					await this._azureSubscriptionLabel.updateProperties({ description: constants.NON_ARC_RESOURCE_SUBSCRIPTION_INFO });
					await this._azureLocationLabel.updateProperties({ description: constants.NON_ARC_RESOURCE_LOCATION_INFO });
					await this._azureResourceGroupLabel.updateProperties({ description: constants.NON_ARC_RESOURCE_RESOURCE_GROUP_INFO });
					flex.addItem(nonArcResourceContainer);
				}
			})
		);
		this._disposables.push(
			noTrackMigrationButton.onDidChangeCheckedState(async (checked) => {
				if (checked) {
					this.migrationStateModel._trackMigration = !checked;
					flex.removeItem(nonArcResourceContainer);
				}
			})
		);
		return flex;
	}

	private createSourceInfrastructureTypeContainer(): azdata.FlexContainer {
		const sourceInfrastructureTypes = Object.values(utils.SourceInfrastructureType).map(
			type => constants.SourceInfrastructureTypeLookup[type]
		).filter((value): value is string => value !== undefined);

		const sourceInfrastructureTypeLabel = this._view.modelBuilder.text().withProps({
			value: constants.SOURCE_INFRASTRUCTURE_TYPE,
			description: constants.SOURCE_INFRASTRUCTURE_TYPE_INFO,
			requiredIndicator: true,
			CSSStyles: {
				...styles.SUBTITLE_LABEL_CSS,
			},
		}).component();

		this._sourceInfrastructureTypeDropdown = this._view.modelBuilder.dropDown().withProps({
			ariaLabel: constants.SOURCE_INFRASTRUCTURE_TYPE,
			placeholder: constants.SOURCE_INFRASTRUCTURE_TYPE,
			values: sourceInfrastructureTypes,
			width: 250,
			editable: true,
			CSSStyles: {
				'margin-top': '5px',
				'margin-left': '10px',
			},
		}).component();
		this._sourceInfrastructureTypeDropdown.value = constants.SourceInfrastructureTypeLookup[this.migrationStateModel._sourceInfrastructureType] ?? undefined;

		this._disposables.push(
			this._sourceInfrastructureTypeDropdown.onValueChanged(async (value) => {
				if (value.selected) {
					value = value.selected;
				}
				const sourceInfrastructureType = this.getSourceInfrastructureTypeBasedOnSelection(value);
				if (sourceInfrastructureType !== undefined) {
					this.migrationStateModel._sourceInfrastructureType = sourceInfrastructureType;
				}
			})
		);
		return this._view.modelBuilder.flexContainer().withItems(
			[
				sourceInfrastructureTypeLabel,
				this._sourceInfrastructureTypeDropdown
			],
			{ flex: '0 0 auto' }
		).withLayout({ flexFlow: 'row' }).component();
	}

	private createArcResourceCreationInfoContainer(): azdata.FlexContainer {
		const arcResourceCreationInfo = this._view.modelBuilder.infoBox()
			.withProps({
				text: constants.ARC_RESOURCE_CREATION_INFO,
				style: 'information',
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				CSSStyles: { ...styles.BODY_CSS }
			}).component();
		return this._view.modelBuilder.flexContainer().withItems(
			[
				arcResourceCreationInfo,
			],
			{ flex: '0 0 auto' }
		).withLayout({ flexFlow: 'row' }).component();
	}

	private createAzureAccountsDropdown(): azdata.FlexContainer {
		this._azureAccountsLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.ACCOUNTS_SELECTION_PAGE_TITLE,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				requiredIndicator: true,
				CSSStyles: { ...styles.LABEL_CSS }
			}).component();
		this._azureAccountsDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				ariaLabel: constants.ACCOUNTS_SELECTION_PAGE_TITLE,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				editable: true,
				placeholder: constants.SELECT_AN_ACCOUNT,
				CSSStyles: { 'margin-top': '-1em' },
			}).component();
		this._disposables.push(
			this._azureAccountsDropdown.onValueChanged(async (value) => {
				if (value && value !== 'undefined') {
					const selectedAccount = this.migrationStateModel._azureAccounts?.find(account => account.displayInfo.displayName === value);
					this.migrationStateModel._arcResourceAzureAccount = (selectedAccount)
						? utils.deepClone(selectedAccount)!
						: undefined!;
				} else {
					this.migrationStateModel._azureAccount = undefined!;
				}
				await utils.clearDropDown(this._azureSubscriptionDropdown);
				await this.populateSubscriptionDropdown();
			}));

		const linkAccountButton = this._view.modelBuilder.hyperlink()
			.withProps({
				label: constants.ACCOUNT_LINK_BUTTON_LABEL,
				url: '',
				CSSStyles: { ...styles.BODY_CSS }
			})
			.component();

		this._disposables.push(
			linkAccountButton.onDidClick(async (event) => {
				await vscode.commands.executeCommand('workbench.actions.modal.linkedAccount');
				await this.populateAzureAccountsDropdown();
				this.wizard.message = { text: '' };
				await this._azureAccountsDropdown.validate();
			}));

		return this._view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([
				this._azureAccountsLabel,
				this._azureAccountsDropdown,
				linkAccountButton])
			.component();
	}

	private createSubscriptionDropdown(): azdata.FlexContainer {
		this._azureSubscriptionLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.SUBSCRIPTION,
				description: constants.NON_ARC_RESOURCE_SUBSCRIPTION_INFO,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				requiredIndicator: true,
				CSSStyles: { ...styles.LABEL_CSS }
			}).component();
		this._azureSubscriptionDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				ariaLabel: constants.SUBSCRIPTION,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				editable: true,
				placeholder: constants.SELECT_A_SUBSCRIPTION,
				CSSStyles: { 'margin-top': '-1em' },
			}).component();
		this._disposables.push(
			this._azureSubscriptionDropdown.onValueChanged(async (value) => {
				if (value && value !== 'undefined' && value !== constants.NO_SUBSCRIPTIONS_FOUND) {
					const selectedSubscription = this.migrationStateModel._subscriptions?.find(
						subscription => `${subscription.name} - ${subscription.id}` === value);
					this.migrationStateModel._arcResourceSubscription = (selectedSubscription)
						? utils.deepClone(selectedSubscription)!
						: undefined!;
				} else {
					this.migrationStateModel._arcResourceSubscription = undefined!;
				}
				this.migrationStateModel._arcSqlServer = undefined!;
				await utils.clearDropDown(this._azureLocationDropdown);
				await this.populateLocationDropdown();
				await utils.clearDropDown(this._azureResourceGroupDropdown);
				await this.populateResourceGroupDropdown();
			}));

		return this._view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([
				this._azureSubscriptionLabel,
				this._azureSubscriptionDropdown,
			]).component();
	}

	private createLocationDropdown(): azdata.FlexContainer {
		this._azureLocationLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.LOCATION,
				description: constants.NON_ARC_RESOURCE_LOCATION_INFO,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				requiredIndicator: true,
				CSSStyles: { ...styles.LABEL_CSS, }
			}).component();
		this._azureLocationDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				ariaLabel: constants.LOCATION,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				editable: true,
				placeholder: constants.SELECT_A_LOCATION,
				CSSStyles: { 'margin-top': '-1em' },
			}).component();
		this._disposables.push(
			this._azureLocationDropdown.onValueChanged(async (value) => {
				if (value && value !== 'undefined' && value !== constants.NO_LOCATION_FOUND) {
					const selectedLocation = this.migrationStateModel._locations?.find(location => location.displayName === value);
					this.migrationStateModel._arcResourceLocation = (selectedLocation)
						? utils.deepClone(selectedLocation)!
						: undefined!;
				} else {
					this.migrationStateModel._arcResourceLocation = undefined!;
				}
				this.migrationStateModel._arcSqlServer = undefined!;
				await utils.clearDropDown(this._azureArcSqlServerDropdown);
				await this.populateArcSqlServerDropdown();
			})
		);

		return this._view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([
				this._azureLocationLabel,
				this._azureLocationDropdown,
			]).component();
	}

	private createResourceGroupDropdown(): azdata.FlexContainer {
		this._azureResourceGroupLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.RESOURCE_GROUP,
				description: constants.NON_ARC_RESOURCE_RESOURCE_GROUP_INFO,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				requiredIndicator: true,
				CSSStyles: { ...styles.LABEL_CSS }
			}).component();
		this._azureResourceGroupDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				ariaLabel: constants.RESOURCE_GROUP,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				editable: true,
				placeholder: constants.SELECT_A_RESOURCE_GROUP,
				CSSStyles: { 'margin-top': '-1em' },
			}).component();
		this._disposables.push(
			this._azureResourceGroupDropdown.onValueChanged(async (value) => {
				if (value && value !== 'undefined' && value !== constants.RESOURCE_GROUP_NOT_FOUND) {
					const selectedResourceGroup = this.migrationStateModel._resourceGroups?.find(rg => rg.name === value);
					this.migrationStateModel._arcResourceResourceGroup = (selectedResourceGroup)
						? utils.deepClone(selectedResourceGroup)!
						: undefined!;
				} else {
					this.migrationStateModel._arcResourceResourceGroup = undefined!;
				}
				this.migrationStateModel._arcSqlServer = undefined!;
				await utils.clearDropDown(this._azureArcSqlServerDropdown);
				await this.populateArcSqlServerDropdown();
			})
		);

		return this._view.modelBuilder.flexContainer()
			.withItems([
				this._azureResourceGroupLabel,
				this._azureResourceGroupDropdown,
			])
			.withLayout({ flexFlow: 'column' })
			.component();
	}

	private async createArcSqlServerDropdown(): Promise<azdata.FlexContainer> {
		this._azureArcSqlServerLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.SQL_SERVER_INSTANCE,
				description: constants.ARC_RESOURCE_INFO,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				requiredIndicator: true,
				CSSStyles: { ...styles.LABEL_CSS }
			}).component();
		this._azureArcSqlServerDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				ariaLabel: constants.SQL_SERVER_INSTANCE,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				editable: true,
				placeholder: constants.SELECT_A_SQL_SERVER_INSTANCE,
				CSSStyles: { 'margin-top': '-1em', 'margin-bottom': '-1em' },
			}).component();
		const serverName = this.migrationStateModel.serverName || (await getSourceConnectionProfile()).serverName;

		const sqlServerHint = this._view.modelBuilder.text()
			.withProps({
				value: constants.ARC_RESOURCE_HINT(serverName),
			}).component();
		this._disposables.push(
			this._azureArcSqlServerDropdown.onValueChanged(async (value) => {
				if (value && value !== 'undefined' && value !== constants.SQL_SERVER_INSTANCE_NOT_FOUND) {
					const selectedArcResource = this.migrationStateModel._sourceArcSqlServers?.find(resource => resource.name === value);
					if (selectedArcResource) {
						const arcSqlServer = utils.deepClone(selectedArcResource)!;
						const getArcSqlServerResponse = await this.migrationStateModel.getArcSqlServerInstance(arcSqlServer.name);
						this.migrationStateModel._arcSqlServer = getArcSqlServerResponse?.status === 200 ? getArcSqlServerResponse.arcSqlServer : undefined!;
					} else {
						this.migrationStateModel._arcSqlServer = undefined!;
					}
				} else {
					this.migrationStateModel._arcSqlServer = undefined!;
				}
			})
		);

		return this._view.modelBuilder.flexContainer()
			.withItems([
				this._azureArcSqlServerLabel,
				this._azureArcSqlServerDropdown,
				sqlServerHint,
			])
			.withLayout({ flexFlow: 'column' })
			.component();
	}

	private getSourceInfrastructureTypeBasedOnSelection(sourceInfrastructureType: string): utils.SourceInfrastructureType | undefined {
		for (const key in constants.SourceInfrastructureTypeLookup) {
			if (constants.SourceInfrastructureTypeLookup[key] === sourceInfrastructureType) {
				return key as utils.SourceInfrastructureType;
			}
		}
		return undefined;
	}
}
