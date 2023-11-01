/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import * as localizedConstants from '../../localizedConstants';
const localize = nls.loadMessageBundle();

import { IWizardPageWrapper } from '../wizardPageWrapper';
import { VirtualizeDataModel } from './virtualizeDataModel';
import { VirtualizeDataInput } from '../../services/contracts';
import { getDropdownValue } from '../../utils';
import { AppContext } from '../../appContext';
import { VDIManager } from './virtualizeDataInputManager';
import { VirtualizeDataWizard } from './virtualizeDataWizard';
import { CreateMasterKeyPage } from './createMasterKeyPage';

export class SelectDataSourcePage implements IWizardPageWrapper {
	private readonly SqlServerType = localizedConstants.SqlServerName;
	private readonly DefaultType = localize('defaultSourceType', 'Default');
	private readonly IconsConfig: {} = {};

	private _dataModel: VirtualizeDataModel;
	private _vdiManager: VDIManager;
	private _appContext: AppContext;

	private _page: azdata.window.WizardPage;

	private _modelBuilder: azdata.ModelBuilder;
	private _formContainer: azdata.FormBuilder;

	private _loadingSpinner: azdata.LoadingComponent;
	private _destDBDropDown: azdata.DropDownComponent;
	private _selectedSourceType: string;

	private _componentsAreSetup: boolean;
	private _modelInitialized: boolean;

	constructor(private _virtualizeDataWizard: VirtualizeDataWizard) {
		if (this._virtualizeDataWizard) {
			this._dataModel = _virtualizeDataWizard.dataModel;
			this._vdiManager = _virtualizeDataWizard.vdiManager;
			this._appContext = _virtualizeDataWizard.appContext;
		}

		this._componentsAreSetup = false;
		this._modelInitialized = false;

		this.IconsConfig[this.SqlServerType] = {
			light: 'resources/light/server.svg',
			dark: 'resources/dark/server_inverse.svg'
		};
		this.IconsConfig[this.DefaultType] = {
			light: 'resources/light/database.svg',
			dark: 'resources/dark/database_inverse.svg'
		};

		this._page = azdata.window.createWizardPage(localize('selectDataSrcTitle', 'Select a Data Source'));

		this._page.registerContent(async (modelView) => {
			this._modelBuilder = modelView.modelBuilder;
			this._formContainer = this._modelBuilder.formContainer();

			let parentLayout: azdata.FormItemLayout = {
				horizontal: false
			};

			this._destDBDropDown = this._modelBuilder.dropDown().withProps({
				values: [],
				value: '',
				height: undefined,
				width: undefined
			}).component();

			this._loadingSpinner = this._modelBuilder.loadingComponent()
				.withItem(this._destDBDropDown)
				.withProps({ loading: true })
				.component();

			this._formContainer.addFormItem({
				component: this._loadingSpinner,
				title: localize('destDBLabel', 'Select the destination database for your external table')
			},
				Object.assign({ info: localize('destDBHelpText', 'The database in which to create your External Data Source.') },
					parentLayout)
			);

			await modelView.initializeModel(this._formContainer.component());

			this._modelInitialized = true;
			await this.setupPageComponents();
		});
	}

	public async setupPageComponents(): Promise<void> {
		if (!this._componentsAreSetup && this._modelInitialized && this._dataModel.configInfoResponse) {
			this._componentsAreSetup = true;

			let parentLayout: azdata.FormItemLayout = {
				horizontal: false
			};

			// Destination DB
			let databaseList: string[] = this._dataModel.destDatabaseList.map(db => db.name).sort((a, b) => a.localeCompare(b));
			let connectedDatabase = this._dataModel.connection.databaseName;
			let selectedDatabase: string;
			if (connectedDatabase && databaseList.some(name => name === connectedDatabase)) {
				selectedDatabase = connectedDatabase;
			} else {
				selectedDatabase = databaseList.length > 0 ? databaseList[0] : '';
			}

			await this._destDBDropDown.updateProperties({
				values: databaseList,
				value: selectedDatabase
			});
			await this.toggleCreateMasterKeyPage(getDropdownValue(this._destDBDropDown.value));
			this._destDBDropDown.onValueChanged(async (selection) => {
				await this.toggleCreateMasterKeyPage(selection.selected);
			});

			await this._loadingSpinner.updateProperties({
				loading: false
			});

			// Source Type
			let components: azdata.FormComponent[] = [];
			let info = this._dataModel.configInfoResponse;
			const cards: azdata.RadioCard[] = [];
			info.supportedSourceTypes.forEach(sourceType => {
				let typeName = sourceType.typeName;
				let iconTypeName: string;
				if (this.IconsConfig[typeName]) {
					iconTypeName = typeName;
				} else {
					iconTypeName = this.DefaultType;
				}

				let iconPath = this._appContext ?
					{
						light: this._appContext.extensionContext.asAbsolutePath(this.IconsConfig[iconTypeName].light),
						dark: this._appContext.extensionContext.asAbsolutePath(this.IconsConfig[iconTypeName].dark)
					} : undefined;

				cards.push({
					id: typeName,
					descriptions: [{ textValue: typeName }],
					icon: iconPath
				});
			});

			const cardGroup = this._modelBuilder.radioCardGroup().withProps({
				cards: cards,
				cardWidth: '150px',
				cardHeight: '160px',
				iconWidth: '50px',
				iconHeight: '50px'
			}).component();

			cardGroup.onSelectionChanged((e: azdata.RadioCardSelectionChangedEvent) => {
				this._selectedSourceType = e.cardId;
			});

			if (cards.length > 0) {
				cardGroup.selectedCardId = cards[0].id;
			}

			components.push({
				component: cardGroup,
				title: localize('sourceCardsLabel', 'Select your data source type')
			});
			this._formContainer.addFormItems(components, parentLayout);

			this._dataModel.wizard.nextButton.enabled = true;
		}
	}

	public async validate(): Promise<boolean> {
		let inputValues = this._vdiManager.getVirtualizeDataInput(this);
		if (!inputValues.sourceServerType) {
			this._dataModel.showWizardError(localize('noServerTypeError', 'A data source type must be selected.'));
			return false;
		}
		if (!inputValues.destDatabaseName) {
			this._dataModel.showWizardError(localize('noDestDatabaseError', 'A destination database must be selected.'));
			return false;
		}

		return await this._dataModel.validateInput(inputValues);
	}

	private async toggleCreateMasterKeyPage(dbSelected: string): Promise<void> {
		if (!dbSelected || !this._virtualizeDataWizard || !this._virtualizeDataWizard.wizard
			|| !this._virtualizeDataWizard.wizard.pages) { return; }
		let databaseListWithMasterKey: string[] = this._dataModel.destDatabaseList.filter(db => db.hasMasterKey).map(db => db.name) || [];
		let currentPages = this._virtualizeDataWizard.wizard.pages;
		let currentWrappers = currentPages.map(p => p['owner']);
		if (databaseListWithMasterKey.find(e => e === dbSelected)) {
			let indexToRemove = currentWrappers.findIndex(w => w instanceof CreateMasterKeyPage);
			if (indexToRemove >= 0) {
				await this._virtualizeDataWizard.wizard.removePage(indexToRemove);
			}
		} else if (!currentWrappers.find(w => w instanceof CreateMasterKeyPage)) {
			let thisWrapperIndex = currentWrappers.findIndex(w => Object.is(w, this));
			let createMasterKeyPageWrapper = this._virtualizeDataWizard.wizardPageWrappers.find(w => w instanceof CreateMasterKeyPage);
			await this._virtualizeDataWizard.wizard.addPage(createMasterKeyPageWrapper.getPage(), thisWrapperIndex + 1);
		}
	}

	public getPage(): azdata.window.WizardPage {
		return this._page;
	}

	public async updatePage(): Promise<void> {
		return;
	}

	public getInputValues(existingInput: VirtualizeDataInput): void {
		existingInput.destDatabaseName = (this._destDBDropDown && this._destDBDropDown.value) ?
			getDropdownValue(this._destDBDropDown.value) : undefined;
		existingInput.sourceServerType = this._selectedSourceType;
	}
}
