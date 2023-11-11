/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as constants from '../../constants/strings';
import { IconPathHelper } from '../../constants/iconPathHelper';

export const supportResourcesLink: string = 'https://aka.ms/dms-overview';
export const supportRequestLink: string = `https://portal.azure.com/#blade/Microsoft_Azure_Support/HelpAndSupportBlade/newsupportrequest`;
export const communitySupportLink: string = `https://aka.ms/DMSqna`;

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
		this.dialog = azdata.window.createModelViewDialog(constants.HELP_SUPPORT_TITLE, constants.HELP_SUPPORT_TITLE, '585px');
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
			title: constants.SUPPORT_RESOURCES_TITLE,
			description: constants.SUPPORT_RESOURCES_DESCRIPTION,
			link: '',
			iconPath: IconPathHelper.info,
		},
		{
			title: constants.COMMUNITY_SUPPORT_TITLE,
			description: constants.COMMUNITY_SUPPORT_DESCRIPTION,
			link: '',
			iconPath: IconPathHelper.newSupportRequest,
		},
		{
			title: constants.SUPPORT_REQUEST_TITLE,
			description: constants.SUPPORT_REQUEST_DESCRIPTION,
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
			value: constants.SUPPORT_REQUEST_NOTE,
			CSSStyles: {
				'margin-block-end': '-1px'
			},
		}).component();

		const communitySupportNote = view.modelBuilder.text().withProps({
			value: constants.COMMUNITY_SUPPORT_NOTE,
			CSSStyles: {
				'margin-block-end': '-1px'
			},
		}).component();

		linksContainer.addItems([linkComponent]);
		labelsContainer.addItems([linksContainer]);

		if (linkMetaData.title === constants.SUPPORT_REQUEST_TITLE) {
			linkComponent.onDidClick(async () => await this.launchNewSupportRequest());
			labelsContainer.addItem(note);
		}
		else if (linkMetaData.title === constants.COMMUNITY_SUPPORT_TITLE) {
			linkComponent.onDidClick(async () => await this.launchCommunityRequest());
			labelsContainer.addItem(communitySupportNote);
		}
		else
			linkComponent.url = supportResourcesLink;

		return labelsContainer;

	}

	async launchNewSupportRequest(): Promise<void> {
		await vscode.env.openExternal(vscode.Uri.parse(
			supportRequestLink));
	}

	async launchCommunityRequest(): Promise<void> {
		await vscode.env.openExternal(vscode.Uri.parse(
			communitySupportLink));
	}
}
