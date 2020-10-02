/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { DialogBase } from './dialogBase';
import { IWorkspaceService } from '../common/interfaces';
import * as constants from '../common/constants';
import { IProjectType } from 'dataworkspace';

class NewProjectDialogModel {
	projectTypeId: string = '';
	projectFileExtension: string = '';
	name: string = '';
	location: string = '';
}
export class NewProjectDialog extends DialogBase {
	private model: NewProjectDialogModel = new NewProjectDialogModel();
	constructor(private workspaceService: IWorkspaceService) {
		super(constants.NewProjectDialogTitle, 'NewProject');
	}

	protected async initialize(view: azdata.ModelView): Promise<void> {
		const allProjectTypes = await this.workspaceService.getAllProjectTypes();
		const projectTypeRadioCardGroup = view.modelBuilder.radioCardGroup().withProperties<azdata.RadioCardGroupComponentProperties>({
			cards: allProjectTypes.map((projectType: IProjectType) => {
				return <azdata.RadioCard>{
					id: projectType.id,
					label: projectType.displayName,
					icon: projectType.icon,
					descriptions: [
						{
							textValue: projectType.displayName,
							textStyles: {
								'font-size': '14px',
								'font-weight': 'bold'
							}
						}, {
							textValue: projectType.description
						}
					]
				};
			}),
			iconHeight: '25px',
			iconWidth: '25px',
			cardWidth: '250px',
			cardHeight: '150px',
			ariaLabel: constants.ProjectTypeSelectorTitle,
			width: '1100px',
			iconPosition: 'left',
			selectedCardId: allProjectTypes.length > 0 ? allProjectTypes[0].id : undefined
		}).component();

		this.register(projectTypeRadioCardGroup.onSelectionChanged((e) => {
			const selectedProjectType = allProjectTypes.find(pt => pt.id === e.cardId);
			if (selectedProjectType) {
				this.model.projectTypeId = selectedProjectType.id;
				this.model.projectFileExtension = selectedProjectType.projectFileExtension;
			}
		}));

		const projectNameTextBox = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			ariaLabel: constants.ProjectNameTitle,
			required: true,
			width: constants.DefaultInputWidth
		}).component();

		this.register(projectNameTextBox.onTextChanged(() => {
			this.model.name = projectNameTextBox.value!;
		}));

		const locationTextBox = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			ariaLabel: constants.ProjectLocationTitle,
			required: true,
			width: constants.DefaultInputWidth,
			enabled: false
		}).component();

		const browseFolderButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({ label: constants.BrowseButtonText, width: constants.DefaultButtonWidth }).component();
		this.register(browseFolderButton.onDidClick(async () => {
			let folderUris = await vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false
			});
			if (!folderUris || folderUris.length === 0) {
				return;
			}
			const selectedFolder = folderUris[0].fsPath;
			locationTextBox.value = selectedFolder;
			this.model.location = selectedFolder;
		}));

		this.register(projectNameTextBox.onTextChanged(() => {
			this.model.name = projectNameTextBox.value!;
		}));

		const locationContainer = view.modelBuilder.flexContainer().withItems([
			locationTextBox,
			browseFolderButton
		], { CSSStyles: { 'margin-right': '5px', } }).withLayout({ flexFlow: 'row' }).component();

		const form = view.modelBuilder.formContainer().withFormItems([
			{
				title: constants.ProjectTypeSelectorTitle,
				component: projectTypeRadioCardGroup
			},
			{
				title: constants.ProjectNameTitle,
				component: projectNameTextBox
			}, {
				title: constants.ProjectLocationTitle,
				required: true,
				component: locationContainer
			}
		]).component();
		await view.initializeModel(form);
	}
}
