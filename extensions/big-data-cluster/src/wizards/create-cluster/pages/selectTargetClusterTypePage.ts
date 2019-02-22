/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import * as os from 'os';
import { WizardPageBase } from '../../wizardPageBase';
import { CreateClusterModel } from '../createClusterModel';
import { WizardBase } from '../../wizardBase';
import { TargetClusterType, TargetClusterTypeInfo } from '../../../interfaces';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export class SelectTargetClusterTypePage extends WizardPageBase<CreateClusterModel> {
	private cards: sqlops.CardComponent[];

	constructor(model: CreateClusterModel, wizard: WizardBase<CreateClusterModel>) {
		super(localize('bdc-create.selectTargetClusterTypePageTitle', 'Where do you want to deploy this SQL Server big data cluster?'),
			localize('bdc-create.selectTargetClusterTypePageDescription', 'Choose the target environment and then install the required tools.'),
			model, wizard);
	}


	protected initialize(view: sqlops.ModelView): Thenable<void> {
		let self = this;
		return this.model.getTargetClusterTypes().then((clusterTypes) => {
			this.cards = [];

			clusterTypes.forEach(clusterType => {
				let card = self.createCard(view, clusterType);
				this.cards.push(card);
			});
			let cardsContainer = view.modelBuilder.flexContainer().withItems(this.cards, { flex: '0 0 auto' }).withLayout({ flexFlow: 'row', alignItems: 'left' }).component();

			let formBuilder = view.modelBuilder.formContainer().withFormItems(
				[
					{
						component: cardsContainer,
						title: localize('bdc-create.PickTargetEnvironmentText', 'Pick target environment')
					}
				],
				{
					horizontal: false
				}
			).withLayout({ width: '100%', height: '100%' });

			let form = formBuilder.component();
			return view.initializeModel(form);
		});
	}

	private createCard(view: sqlops.ModelView, targetClusterTypeInfo: TargetClusterTypeInfo): sqlops.CardComponent {
		let self = this;
		let card = view.modelBuilder.card().withProperties<sqlops.CardProperties>({
			cardType: sqlops.CardType.VerticalButton,
			iconPath: {
				dark: this.wizard.context.asAbsolutePath(targetClusterTypeInfo.iconPath.dark),
				light: this.wizard.context.asAbsolutePath(targetClusterTypeInfo.iconPath.light)
			},
			label: targetClusterTypeInfo.name
		}).component();
		card.onCardSelectedChanged(() => {
			if (card.selected) {
				self.cards.forEach(c => {
					if (c !== card) {
						c.selected = false;
					}
				});
				self.model.targetClusterType = targetClusterTypeInfo.type;
			}
		});
		return card;
	}
}
