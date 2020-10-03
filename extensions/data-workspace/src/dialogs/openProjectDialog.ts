/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { DialogBase } from './dialogBase';
import * as constants from '../common/constants';
import { IWorkspaceService } from '../common/interfaces';
import { createHorizontalContainer, fileExist } from './Utils';
import { IconHelper, IconPath } from '../common/iconHelper';

export class OpenProjectDialog extends DialogBase {
	private _projectFile: string = '';
	private _targetTypes: { name: string, icon: IconPath }[] = [
		{
			name: constants.LocalFileSystem,
			icon: IconHelper.localFileSystem
		}
	];

	constructor(private workspaceService: IWorkspaceService) {
		super(constants.OpenProjectDialogTitle, 'OpenProject');
	}

	async validate(): Promise<boolean> {
		try {
			// the selected location should be an existing directory
			const projectFileExist = await fileExist(this._projectFile);
			if (!projectFileExist) {
				this.showErrorMessage(constants.ProjectFileNotExistError(this._projectFile));
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
			await this.workspaceService.addProjectsToWorkspace([vscode.Uri.file(this._projectFile)]);
		}
		catch (err) {
			vscode.window.showErrorMessage(err?.message ? err.message : err);
		}
	}

	protected async initialize(view: azdata.ModelView): Promise<void> {
		const targetTypeRadioCardGroup = view.modelBuilder.radioCardGroup().withProperties<azdata.RadioCardGroupComponentProperties>({
			cards: this._targetTypes.map((targetType) => {
				return <azdata.RadioCard>{
					id: targetType.name,
					label: targetType.name,
					icon: targetType.icon,
					descriptions: [
						{
							textValue: targetType.name,
							textStyles: {
								'font-size': '13px'
							}
						}
					]
				};
			}),
			iconHeight: '25px',
			iconWidth: '25px',
			cardWidth: '140px',
			cardHeight: '80px',
			ariaLabel: constants.ProjectTypeSelectorTitle,
			width: '500px',
			iconPosition: 'top',
			selectedCardId: constants.LocalFileSystem
		}).component();

		const projectFilePathTextBox = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			ariaLabel: constants.ProjectFileTitle,
			required: true,
			width: constants.DefaultInputWidth
		}).component();
		this.register(projectFilePathTextBox.onTextChanged(() => {
			this._projectFile = projectFilePathTextBox.value!;
		}));

		const browseFolderButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({ label: constants.BrowseButtonText, width: constants.DefaultButtonWidth }).component();
		this.register(browseFolderButton.onDidClick(async () => {
			const filters: { [name: string]: string[] } = {};
			const projectTypes = await this.workspaceService.getAllProjectTypes();
			filters[constants.AllProjectTypes] = projectTypes.map(type => type.projectFileExtension);
			projectTypes.forEach(type => {
				filters[type.displayName] = [type.projectFileExtension];
			});
			let fileUris = await vscode.window.showOpenDialog({
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				openLabel: constants.SelectProjectFileActionName,
				filters: filters
			});
			if (!fileUris || fileUris.length === 0) {
				return;
			}
			const projectFilePath = fileUris[0].fsPath;
			projectFilePathTextBox.value = projectFilePath;
			this._projectFile = projectFilePath;
		}));

		const form = view.modelBuilder.formContainer().withFormItems([
			{
				title: constants.TargetTypeSelectorTitle,
				required: true,
				component: targetTypeRadioCardGroup
			}, {
				title: constants.ProjectFileTitle,
				required: true,
				component: createHorizontalContainer(view, [projectFilePathTextBox, browseFolderButton])
			}
		]).component();
		await view.initializeModel(form);
	}
}
