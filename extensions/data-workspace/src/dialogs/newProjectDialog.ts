/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as path from 'path';
import { DialogBase } from './dialogBase';
import { IWorkspaceService } from '../common/interfaces';
import * as constants from '../common/constants';
import { IProjectType } from 'dataworkspace';
import { directoryExist } from '../common/utils';
import { IconPathHelper } from '../common/iconHelper';
import { defaultProjectSaveLocation } from '../common/projectLocationHelper';

class NewProjectDialogModel {
	projectTypeId: string = '';
	projectFileExtension: string = '';
	name: string = '';
	location: string = '';
}
export class NewProjectDialog extends DialogBase {
	public model: NewProjectDialogModel = new NewProjectDialogModel();

	constructor(private workspaceService: IWorkspaceService) {
		super(constants.NewProjectDialogTitle, 'NewProject');
	}

	async validate(): Promise<boolean> {
		try {
			// the selected location should be an existing directory
			const parentDirectoryExists = await directoryExist(this.model.location);
			if (!parentDirectoryExists) {
				this.showErrorMessage(constants.ProjectParentDirectoryNotExistError(this.model.location));
				return false;
			}

			// there shouldn't be an existing sub directory with the same name as the project in the selected location
			const projectDirectoryExists = await directoryExist(path.join(this.model.location, this.model.name));
			if (projectDirectoryExists) {
				this.showErrorMessage(constants.ProjectDirectoryAlreadyExistError(this.model.name, this.model.location));
				return false;
			}

			return true;
		}
		catch (err) {
			this.showErrorMessage(err?.message ? err.message : err);
			return false;
		}
	}

	async onComplete(): Promise<void> {
		try {
			const validateWorkspace = await this.workspaceService.validateWorkspace();
			if (validateWorkspace) {
				await this.workspaceService.createProject(this.model.name, vscode.Uri.file(this.model.location), this.model.projectTypeId);
			}
		}
		catch (err) {
			vscode.window.showErrorMessage(err?.message ? err.message : err);
		}
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
								'font-size': '13px',
								'font-weight': 'bold'
							}
						}, {
							textValue: projectType.description
						}
					]
				};
			}),
			iconHeight: '50px',
			iconWidth: '50px',
			cardWidth: '170px',
			cardHeight: '170px',
			ariaLabel: constants.TypeTitle,
			width: '500px',
			iconPosition: 'top',
			selectedCardId: allProjectTypes.length > 0 ? allProjectTypes[0].id : undefined
		}).component();

		this.register(projectTypeRadioCardGroup.onSelectionChanged((e) => {
			this.model.projectTypeId = e.cardId;
		}));

		const projectNameTextBox = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			ariaLabel: constants.ProjectNameTitle,
			placeHolder: constants.ProjectNamePlaceholder,
			required: true,
			width: constants.DefaultInputWidth
		}).component();

		this.register(projectNameTextBox.onTextChanged(() => {
			this.model.name = projectNameTextBox.value!;
			projectNameTextBox.updateProperty('title', projectNameTextBox.value);

			// update hover text if a new workspace will be created for this project
			if (!vscode.workspace.workspaceFile) {
				workspaceTextBox.updateProperty('title', path.join(this.model.location, this.model.name, `${this.model.name}.code-workspace`));
			}
		}));

		const locationTextBox = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			ariaLabel: constants.ProjectLocationTitle,
			placeHolder: constants.ProjectLocationPlaceholder,
			required: true,
			width: constants.DefaultInputWidth
		}).component();

		this.register(locationTextBox.onTextChanged(() => {
			this.model.location = locationTextBox.value!;
			locationTextBox.updateProperty('title', locationTextBox.value);
		}));

		const browseFolderButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			ariaLabel: constants.BrowseButtonText,
			iconPath: IconPathHelper.folder,
			height: '16px',
			width: '16px'
		}).component();
		this.register(browseFolderButton.onDidClick(async () => {
			let folderUris = await vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				defaultUri: defaultProjectSaveLocation()
			});
			if (!folderUris || folderUris.length === 0) {
				return;
			}
			const selectedFolder = folderUris[0].fsPath;
			locationTextBox.value = selectedFolder;
			this.model.location = selectedFolder;

			// update hover text if a new workspace will be created for this project
			if (!vscode.workspace.workspaceFile) {
				workspaceTextBox.updateProperty('title', path.join(this.model.location, `${this.model.name}.code-workspace`));
			}
		}));

		const workspaceDescription = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: vscode.workspace.workspaceFile ? constants.AddProjectToCurrentWorkspace : constants.NewWorkspaceWillBeCreated,
			CSSStyles: { 'margin-top': '3px', 'margin-bottom': '10px' }
		}).component();

		const workspaceTextBox = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			ariaLabel: constants.WorkspaceLocationTitle,
			width: constants.DefaultInputWidth,
			enabled: false,
			value: vscode.workspace.workspaceFile?.fsPath ?? '',
			title: vscode.workspace.workspaceFile?.fsPath ?? '' // hovertext for if file path is too long to be seen in textbox
		}).component();

		const workspaceFlexContainer = view.modelBuilder.flexContainer()
			.withItems([workspaceDescription, workspaceTextBox])
			.withLayout({ flexFlow: 'column' })
			.component();

		const form = view.modelBuilder.formContainer().withFormItems([
			{
				title: constants.TypeTitle,
				required: true,
				component: projectTypeRadioCardGroup
			},
			{
				title: constants.ProjectNameTitle,
				required: true,
				component: this.createHorizontalContainer(view, [projectNameTextBox])
			}, {
				title: constants.ProjectLocationTitle,
				required: true,
				component: this.createHorizontalContainer(view, [locationTextBox, browseFolderButton])
			}, {
				title: constants.Workspace,
				component: workspaceFlexContainer
			}
		]).component();
		await view.initializeModel(form);
		this.initDialogComplete?.resolve();
	}
}
