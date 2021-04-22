/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { InitialVariableValues, ResourceType } from '../interfaces';
import { IResourceTypeService, OptionValuesFilter } from '../services/resourceTypeService';
import * as loc from './../localizedConstants';
import { DialogBase } from './dialogBase';
import * as constants from '../constants';

const localize = nls.loadMessageBundle();

export class ResourceTypePickerDialog extends DialogBase {
	private _resourceTypes!: ResourceType[];
	private _selectedResourceType: ResourceType;
	private _view!: azdata.ModelView;
	private _resourceTagsListView!: azdata.ListViewComponent;
	private _resourceSearchBox!: azdata.InputBoxComponent;
	private _cardGroup!: azdata.RadioCardGroupComponent;
	// array to store listners that are specific to the selected resource. To be cleared after change in selected resource.
	private _currentResourceTypeDisposables: vscode.Disposable[] = [];
	private _cardsCache: Map<string, azdata.RadioCard> = new Map();

	constructor(
		private resourceTypeService: IResourceTypeService,
		defaultResourceType: ResourceType,
		private _resourceTypeNameFilters?: string[],
		private _optionValuesFilter?: OptionValuesFilter,
		private _initialVariableValues?: InitialVariableValues) {
		super(loc.resourceTypePickerDialogTitle, 'ResourceTypePickerDialog', true);
		this._selectedResourceType = defaultResourceType;
		this._dialogObject.okButton.label = loc.select;
	}

	initialize() {
		let tab = azdata.window.createTab('');
		this._dialogObject.registerCloseValidator(async () => {
			return true;
		});
		tab.registerContent((view: azdata.ModelView) => {
			this._view = view;
			this._resourceTypes = this.resourceTypeService
				.getResourceTypes()
				.filter(rt => !this._resourceTypeNameFilters || this._resourceTypeNameFilters.find(rtn => rt.name === rtn))
				.sort((a: ResourceType, b: ResourceType) => {
					return (a.displayIndex || Number.MAX_VALUE) - (b.displayIndex || Number.MAX_VALUE);
				});
			this._cardGroup = view.modelBuilder.radioCardGroup().withProperties<azdata.RadioCardGroupComponentProperties>({
				cards: this._resourceTypes.map((resourceType) => {
					return this.createOrGetCard(resourceType);
				}),
				iconHeight: '35px',
				iconWidth: '35px',
				cardWidth: '300px',
				cardHeight: '150px',
				ariaLabel: localize('deploymentDialog.deploymentOptions', "Deployment options"),
				width: '1000px',
				height: '550px',
				iconPosition: 'left'
			}).component();
			this._toDispose.push(this._cardGroup.onSelectionChanged(({ cardId }) => {
				this._dialogObject.message = { text: '' };
				this._dialogObject.okButton.label = loc.select;
				const resourceType = this._resourceTypes.find(rt => { return rt.name === cardId; });
				if (resourceType) {
					this.selectResourceType(resourceType);
				}
			}));

			const resourceComponents: azdata.Component[] = [];
			if (this.getAllResourceTags().length !== 0) {
				this._resourceTagsListView = this.createTagsListView();
				resourceComponents.push(this._resourceTagsListView);
			}
			this._resourceSearchBox = view.modelBuilder.inputBox().withProperties({
				placeHolder: loc.resourceTypeSearchBoxDescription,
				ariaLabel: loc.resourceTypeSearchBoxDescription
			}).component();
			this._toDispose.push(this._resourceSearchBox.onTextChanged((value: string) => {
				this.filterResources();
				this._resourceSearchBox.focus();
			}));
			const searchContainer = view.modelBuilder.divContainer().withItems([this._resourceSearchBox]).withProps({
				CSSStyles: {
					'margin-left': '15px',
					'width': '300px'
				},
			}).component();
			const cardsContainer = this._view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'column'
			}).withItems([searchContainer, this._cardGroup]).component();
			resourceComponents.push(cardsContainer);

			const formBuilder = view.modelBuilder.formContainer().withFormItems(
				[
					{
						component: this._view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).withItems(resourceComponents).component(),
						title: ''
					}
				],
				{
					horizontal: false
				}
			);

			const form = formBuilder.withLayout({ width: '100%' }).component();

			return view.initializeModel(form).then(() => {
				this.selectResourceType(this._resourceTypes[0]);
				if (this._selectedResourceType) {
					this._cardGroup.selectedCardId = this._selectedResourceType.name;
				}
				this._resourceTagsListView.focus();
			});
		});
		this._dialogObject.content = [tab];

	}

	private createTagsListView(): azdata.ListViewComponent {

		const tags = this.getAllResourceTags();
		if (!tags.includes('All')) {
			tags.splice(0, 0, 'All');
		}
		const items: azdata.ListViewOption[] = [];
		tags.forEach((t: string, idx: number) => {
			items.push({
				label: loc.getResourceTypeCategoryLocalizedString(t),
				id: t
			});
		});
		const listView = this._view.modelBuilder.listView().withProps({
			title: {
				text: loc.resourceTypeCategoryListViewTitle
			},
			CSSStyles: {
				'width': '140px',
				'margin-top': '35px'
			},
			options: items,
			selectedOptionId: items[0].id
		}).component();
		this._toDispose.push(listView.onDidClick((e) => {
			this._resourceSearchBox.value = '';
			this.filterResources();
			listView.focus();
		}));

		return listView;
	}

	private filterResources(): void {
		const tag = this._resourceTagsListView.selectedOptionId!;
		const search = this._resourceSearchBox.value?.toLowerCase() ?? '';

		// Getting resourceType based on the selected tag
		let filteredResourceTypes = (tag !== 'All') ? this._resourceTypes.filter(element => element.tags?.includes(tag) ?? false) : this._resourceTypes;

		// Filtering resourceTypes based on their names.
		const filteredResourceTypesOnSearch: ResourceType[] = filteredResourceTypes.filter((element) => element.displayName.toLowerCase().includes(search!));
		// Adding resourceTypes with descriptions matching the search text to the result at the end as they might be less relevant.
		filteredResourceTypesOnSearch.push(...filteredResourceTypes.filter((element) => !element.displayName.toLowerCase().includes(search!) && element.description.toLowerCase().includes(search!)));

		const cards = filteredResourceTypesOnSearch.map((resourceType) => this.createOrGetCard(resourceType));

		if (filteredResourceTypesOnSearch.length > 0) {
			this._cardGroup.updateProperties({
				selectedCardId: cards[0].id,
				cards: cards
			});

			this.selectResourceType(filteredResourceTypesOnSearch[0]);
		}
		else {
			this._cardGroup.updateProperties({
				selectedCardId: '',
				cards: []
			});
			this._dialogObject.okButton.enabled = false;
		}
	}

	private selectResourceType(resourceType: ResourceType): void {
		this._currentResourceTypeDisposables.forEach(disposable => disposable.dispose());
		this._selectedResourceType = resourceType;
	}

	protected async onComplete(): Promise<void> {
		this.resourceTypeService.startDeployment(this._selectedResourceType, this._optionValuesFilter, this._initialVariableValues);
	}

	private getAllResourceTags(): string[] {
		const supportedTags = [
			constants.ResourceTypeCategories.All,
			constants.ResourceTypeCategories.OnPrem,
			constants.ResourceTypeCategories.Hybrid,
			constants.ResourceTypeCategories.Cloud,
			constants.ResourceTypeCategories.SqlServer,
			constants.ResourceTypeCategories.PostgreSql
		];

		const tagsWithResourceTypes = supportedTags.filter(tag => {
			return (tag === constants.ResourceTypeCategories.All) || this._resourceTypes.find(resourceType => resourceType.tags?.includes(tag)) !== undefined;
		});

		return tagsWithResourceTypes;
	}

	private createOrGetCard(resourceType: ResourceType): azdata.RadioCard {
		if (this._cardsCache.has(resourceType.name)) {
			return this._cardsCache.get(resourceType.name)!;
		}

		const newCard = <azdata.RadioCard>{
			id: resourceType.name,
			label: resourceType.displayName,
			icon: resourceType.icon,
			descriptions: [
				{
					textValue: resourceType.displayName,
					textStyles: {
						'font-size': '14px',
						'font-weight': 'bold'
					}
				},
				{
					textValue: resourceType.description,
				}
			]
		};

		this._cardsCache.set(resourceType.name, newCard);
		return newCard;
	}

}
