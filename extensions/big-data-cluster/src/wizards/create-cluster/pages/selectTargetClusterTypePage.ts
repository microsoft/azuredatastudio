/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import { WizardPageBase } from '../../wizardPageBase';
import { TargetClusterTypeInfo } from '../../../interfaces';
import * as nls from 'vscode-nls';
import { CreateClusterWizard } from '../createClusterWizard';

const localize = nls.loadMessageBundle();

export class SelectTargetClusterTypePage extends WizardPageBase<CreateClusterWizard> {
	private cards: sqlops.CardComponent[];
	private toolsTable: sqlops.TableComponent;
	private toolsContainer: sqlops.FormComponent;
	private formBuilder: sqlops.FormBuilder;
	private form: sqlops.FormContainer;

	constructor(wizard: CreateClusterWizard) {
		super(localize('bdc-create.selectTargetClusterTypePageTitle', 'Where do you want to deploy this SQL Server big data cluster?'),
			localize('bdc-create.selectTargetClusterTypePageDescription', 'Choose the target environment and then install the required tools.'),
			wizard);
	}

	protected initialize(view: sqlops.ModelView): Thenable<void> {
		let self = this;
		return self.wizard.model.getTargetClusterTypeInfo().then((clusterTypes) => {
			self.cards = [];

			clusterTypes.forEach(clusterType => {
				let card = self.createCard(view, clusterType);
				self.cards.push(card);
			});
			let cardsContainer = view.modelBuilder.flexContainer().withItems(self.cards, { flex: '0 0 auto' }).withLayout({ flexFlow: 'row', alignItems: 'left' }).component();

			let toolColumn: sqlops.TableColumn = {
				value: localize('bdc-create.toolNameColumnHeader', 'Tool'),
				width: 100
			};
			let descriptionColumn: sqlops.TableColumn = {
				value: localize('bdc-create.toolDescriptionColumnHeader', 'Description'),
				width: 200
			};
			let statusColumn: sqlops.TableColumn = {
				value: localize('bdc-create.toolStatusColumnHeader', 'Status'),
				width: 100
			};
			self.toolsTable = view.modelBuilder.table().withProperties<sqlops.TableComponentProperties>({
				height: 200,
				data: [],
				columns: [toolColumn, descriptionColumn, statusColumn],
				width: 850
			}).component();

			self.toolsContainer = {
				title: localize('bdc-create.RequiredToolsText', 'Required tools'),
				component: self.toolsTable
			};

			self.formBuilder = view.modelBuilder.formContainer().withFormItems(
				[
					{
						component: cardsContainer,
						title: localize('bdc-create.PickTargetEnvironmentText', 'Pick target environment')
					}
				],
				{
					horizontal: false
				}
			);


			self.form = self.formBuilder.withLayout({ width: '100%' }).component();
			return view.initializeModel(self.form);
		});
	}

	private createCard(view: sqlops.ModelView, targetClusterTypeInfo: TargetClusterTypeInfo): sqlops.CardComponent {
		let self = this;
		let card = view.modelBuilder.card().withProperties<sqlops.CardProperties>({
			cardType: sqlops.CardType.VerticalButton,
			iconPath: {
				dark: self.wizard.context.asAbsolutePath(targetClusterTypeInfo.iconPath.dark),
				light: self.wizard.context.asAbsolutePath(targetClusterTypeInfo.iconPath.light)
			},
			label: targetClusterTypeInfo.name
		}).component();
		card.onCardSelectedChanged(() => {
			if (card.selected) {
				self.wizard.model.targetClusterType = targetClusterTypeInfo.type;
				self.cards.forEach(c => {
					if (c !== card) {
						c.selected = false;
					}
				});

				let tableData = targetClusterTypeInfo.requiredTools.map(tool => {
					return [tool.name, tool.description, tool.isInstalled ? 'Installed' : 'Not Installed']
				});

				self.wizard.installToolsButton.hidden = targetClusterTypeInfo.requiredTools.filter(tool => !tool.isInstalled).length === 0;

				self.toolsTable.data = tableData;
				if (self.form.items.length === 1) {
					self.formBuilder.addFormItem(self.toolsContainer);
				}
			}
		});
		return card;
	}
}
