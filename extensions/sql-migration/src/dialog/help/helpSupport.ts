/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as constants from '../../constants/strings';
import { IconPathHelper } from '../../constants/iconPathHelper';

interface IActionMetadata {
	title: string,
	description: string,
	link: string,
	iconPath?: azdata.ThemedIconPath,
	command?: string;
}

export class HelpAndSupportDialog {

	private dialog: azdata.window.Dialog | undefined;

	private async initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		dialog.registerContent(async (view: azdata.ModelView) => {
			const rootContainer = this.initializePageContent(view);
			return view.initializeModel(rootContainer);
		});
		dialog.cancelButton.hidden = true;
		dialog.okButton.label = constants.CLOSE;
		dialog.okButton.position = 'left';
	}

	public async openDialog(): Promise<void> {
		this.dialog = azdata.window.createModelViewDialog('Help + Support', 'Help + Support', '585px');
		const dialogSetupPromises: Thenable<void>[] = [];
		dialogSetupPromises.push(this.initializeDialog(this.dialog));
		azdata.window.openDialog(this.dialog);
		await Promise.all(dialogSetupPromises);
	}

	private initializePageContent(view: azdata.ModelView): azdata.Component {

		const linksContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: '474px',
			justifyContent: 'flex-start',
		}).withProps({
			CSSStyles: {
				padding: '15px'
			}
		}).component();

		const support = [{
			title: 'Support Resources',
			description: 'Explore Documentation',
			link: '',
			iconPath: IconPathHelper.info,
		},
		{
			title: 'Support Request',
			description: 'Create a Support Request',
			link: '',
			iconPath: IconPathHelper.newSupportRequest,
		},
		{
			title: 'Community Support',
			description: 'Connect with Microsoft Community',
			link: '',
			iconPath: IconPathHelper.newSupportRequest,
		}];

		linksContainer.addItems(support.map(l => this.createSupportContainer(view, l)));

		return linksContainer;
	}

	private createSupportContainer(view: azdata.ModelView, linkMetaData: IActionMetadata): azdata.Component {
		const maxWidth = 474;
		const labelsContainer = view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'flex-direction': 'column',
				'width': `${maxWidth}px`,
				'justify-content': 'flex-start',
				'margin-bottom': '12px'
			}
		}).component();

		const titleComponent = view.modelBuilder.text().withProps({
			value: linkMetaData.title,
			CSSStyles: {
				'font-size': '14px',
				'line-height': '20px',
				'font-weight': '600',
				'margin-bottom': '5px',
			}
		}).component();

		labelsContainer.addItems([titleComponent]);

		const linksContainer = view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'flex-direction': 'row',
				'width': `${maxWidth + 10}px`,
				'justify-content': 'flex-start',
			}
		}).component();

		const linkImageComponent = view.modelBuilder.image().withProps({
			iconPath: linkMetaData.iconPath,
			iconHeight: '16px',
			iconWidth: '16px',
			width: '16px',
			height: '16px',

		}).component();
		linksContainer.addItems([linkImageComponent]);

		const linkComponent = view.modelBuilder.hyperlink().withProps({
			label: linkMetaData.description,
			url: linkMetaData.link,
			showLinkIcon: true,
			CSSStyles: {
				'font-size': '13px',
				'line-height': '18px',
				'margin-left': '-225px',
				'text-decoration': 'none'
			}
		}).component();

		const note = view.modelBuilder.text().withProps({
			value: 'To receive assistance from Microsoft customer support, please log a service request on Service Hub at aka.ms/servicehub.',
			CSSStyles: {
				'margin-block-end': '-1px'
			},
		}).component();

		const communitySupportNote = view.modelBuilder.text().withProps({
			value: 'You can post your question with the Microsoft community support through the Q&A channel.',
			CSSStyles: {
				'margin-block-end': '-1px'
			},
		}).component();

		linksContainer.addItems([linkComponent]);
		labelsContainer.addItems([linksContainer]);

		if (linkMetaData.title === 'Support request') {
			linkComponent.onDidClick(async () => await this.launchNewSupportRequest());
			labelsContainer.addItem(note);
		}
		else if (linkMetaData.title === 'Community support') {
			linkComponent.onDidClick(async () => await this.launchCommunityRequest());
			labelsContainer.addItem(communitySupportNote);
		}
		else
			linkComponent.url = 'https://github.com/microsoft/azuredatastudio'

		return labelsContainer;

	}

	async launchNewSupportRequest(): Promise<void> {
		await vscode.env.openExternal(vscode.Uri.parse(
			`https://github.com/microsoft/azuredatastudio`));
	}

	async launchCommunityRequest(): Promise<void> {
		await vscode.env.openExternal(vscode.Uri.parse(
			`https://github.com/microsoft/azuredatastudio`));
	}
}
