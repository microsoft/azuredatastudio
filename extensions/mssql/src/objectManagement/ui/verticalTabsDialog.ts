/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';

import { DialogBase } from './dialogBase';


export class VerticalTabsDialog extends DialogBase {
	private _view!: azdata.ModelView;
	private _resourceTagsListView!: azdata.ListViewComponent;
	private _resourceSearchBox!: azdata.InputBoxComponent;
	// array to store listners that are specific to the selected resource. To be cleared after change in selected resource.

	constructor() {
		super('Server Properties', 'Server Properties', true);

		this._dialogObject.okButton.label = 'Select';
	}

	initialize() {
		let tab = azdata.window.createTab('');
		this._dialogObject.registerCloseValidator(async () => {
			return true;
		});
		tab.registerContent((view: azdata.ModelView) => {
			this._view = view;

			const resourceComponents: azdata.Component[] = [];
			if (this.getAllResourceTags().length !== 0) {
				this._resourceTagsListView = this.createTagsListView();
				resourceComponents.push(this._resourceTagsListView);
			}
			const generalSection = this.createGeneralSection();
			const generalSectionContainer = this._view.modelBuilder.groupContainer().withLayout({ header: 'Platform', collapsible: true }).withItems(generalSection).component();
			resourceComponents.push(generalSectionContainer);
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

			return view.initializeModel(formBuilder.component()).then(() => {
				this._resourceTagsListView.focus();
			});
		});
		this._dialogObject.content = [tab];
		this._dialogObject.width = '650px'

	}

	private createTagsListView(): azdata.ListViewComponent {

		const tags = this.getAllResourceTags();
		const items: azdata.ListViewOption[] = [];
		tags.forEach((t: string, idx: number) => {
			items.push({
				label: t,
				id: t
			});
		});
		const listView = this._view.modelBuilder.listView().withProps({
			title: {
				text: ''
			},
			CSSStyles: {
				'margin-top': '35px',
				'width': '140px'
			},
			options: items,
			selectedOptionId: items[0].id,
			ariaLabel: 'Sections'
		}).component();
		this._toDispose.push(listView.onDidClick((e) => {
			this._resourceSearchBox.value = '';
			listView.focus();
		}));

		return listView;
	}

	private createGeneralSection(): azdata.Component[] {
		const language = this._view.modelBuilder.inputBox().withProps({ width: '400px' }).component();
		const labelLanguageComponent = this._view.modelBuilder.text().withProps({ value: 'Language', requiredIndicator: language.required }).component();
		const memory = this._view.modelBuilder.inputBox().withProps({ width: '400px' }).component();
		const labelMemoryComponent = this._view.modelBuilder.text().withProps({ value: 'Memory', requiredIndicator: memory.required }).component();
		const operatingSystem = this._view.modelBuilder.inputBox().withProps({ width: '400px' }).component();
		const labelOSComponent = this._view.modelBuilder.text().withProps({ value: 'OS', requiredIndicator: operatingSystem.required }).component();
		const platform = this._view.modelBuilder.inputBox().withProps({ width: '400px' }).component();
		const labelPlatformComponent = this._view.modelBuilder.text().withProps({ value: 'Platform', requiredIndicator: platform.required }).component();


		// return [
		// 	{title: 'Language', component: language},
		// 	{title: 'Memory', component: memory},
		// 	{title: 'Operating System', component: operatingSystem},
		// 	{title: 'Platform', component: platform}];
		return [labelLanguageComponent, language, labelMemoryComponent, memory, labelOSComponent, operatingSystem, labelPlatformComponent, platform];
	}

	protected override async onComplete(): Promise<void> {
	}

	private getAllResourceTags(): string[] {
		return [
			'General',
			'Memory',
			'Processors',
			'Security',
			'Database Settings',
			'Advanced Settings'
		];
	}

}

