/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdataType from 'azdata';
import * as vscode from 'vscode';
import { DialogBase } from './dialogBase';
import * as constants from '../common/constants';
import { IWorkspaceService } from '../common/interfaces';
import { directoryExist, fileExist } from '../common/utils';
import { IconPathHelper } from '../common/iconHelper';
import { TelemetryActions, TelemetryReporter, TelemetryViews } from '../common/telemetry';
import { defaultProjectSaveLocation } from '../common/projectLocationHelper';

export class OpenExistingDialog extends DialogBase {
	public filePathTextBox: azdataType.InputBoxComponent | undefined;
	public filePathAndButtonComponent: azdataType.FormComponent | undefined;
	public gitRepoTextBoxComponent: azdataType.FormComponent | undefined;
	public localClonePathComponent: azdataType.FormComponent | undefined;
	public localClonePathTextBox: azdataType.InputBoxComponent | undefined;
	public localRadioButton: azdataType.RadioButtonComponent | undefined;
	public remoteGitRepoRadioButton: azdataType.RadioButtonComponent | undefined;
	public locationRadioButtonFormComponent: azdataType.FormComponent | undefined;
	public formBuilder: azdataType.FormBuilder | undefined;

	constructor(private workspaceService: IWorkspaceService) {
		super(constants.OpenExistingDialogTitle, 'OpenProject', constants.OpenButtonText);

		// dialog launched from Welcome message button (only visible when no current workspace) vs. "add project" button
		TelemetryReporter.createActionEvent(TelemetryViews.OpenExistingDialog, TelemetryActions.OpenExistingDialogLaunched)
			.withAdditionalProperties({ isWorkspaceOpen: (vscode.workspace.workspaceFile !== undefined).toString() })
			.send();
	}

	async validate(): Promise<boolean> {
		try {
			if (this.localRadioButton?.checked) {
				await this.validateFile(this.filePathTextBox!.value!, constants.Project.toLowerCase());
			} else {
				await this.validateClonePath(<string>this.localClonePathTextBox!.value);
			}

			if (await this.workspaceService.validateWorkspace() === false) {
				return false;
			}
			return true;
		}
		catch (err) {
			this.showErrorMessage(err?.message ? err.message : err);
			return false;
		}
	}

	public async validateFile(file: string, fileType: string): Promise<void> {
		const fileExists = await fileExist(file);
		if (!fileExists) {
			throw new Error(constants.FileNotExistError(fileType, file));
		}
	}

	public async validateClonePath(location: string): Promise<void> {
		// only need to check if parent directory exists
		// if the same repo has been cloned before, the git clone will append the next number to the folder
		const parentDirectoryExists = await directoryExist(location);
		if (!parentDirectoryExists) {
			throw new Error(constants.CloneParentDirectoryNotExistError(location));
		}
	}

	override async onComplete(): Promise<void> {
		try {
			// save datapoint now because it'll get set to new value during validateWorkspace()
			const telemetryProps: any = { hasWorkspaceOpen: (vscode.workspace.workspaceFile !== undefined).toString() };

			let addProjectsPromise: Promise<void>;

			if (this.remoteGitRepoRadioButton!.checked) {
				TelemetryReporter.createActionEvent(TelemetryViews.OpenExistingDialog, TelemetryActions.GitClone)
					.withAdditionalProperties({ selectedTarget: 'project' })
					.send();

				addProjectsPromise = this.workspaceService.gitCloneProject((<azdataType.InputBoxComponent>this.gitRepoTextBoxComponent?.component).value!, this.localClonePathTextBox!.value!);
			} else {
				telemetryProps.cancelled = 'false';
				addProjectsPromise = this.workspaceService.addProjectsToWorkspace([vscode.Uri.file(this.filePathTextBox!.value!)]);
			}

			TelemetryReporter.createActionEvent(TelemetryViews.OpenExistingDialog, TelemetryActions.OpeningProject)
				.withAdditionalProperties(telemetryProps)
				.send();

			await addProjectsPromise;
		}
		catch (err) {
			void vscode.window.showErrorMessage(err?.message ? err.message : err);
		}
	}

	protected async initialize(view: azdataType.ModelView): Promise<void> {
		this.localRadioButton = view.modelBuilder.radioButton().withProps({
			name: 'location',
			label: constants.Local,
			checked: true
		}).component();

		this.register(this.localRadioButton.onDidChangeCheckedState(checked => {
			if (checked) {
				this.formBuilder?.removeFormItem(<azdataType.FormComponent>this.gitRepoTextBoxComponent);
				this.formBuilder?.removeFormItem(<azdataType.FormComponent>this.localClonePathComponent);
				this.formBuilder?.insertFormItem(<azdataType.FormComponent>this.filePathAndButtonComponent, 1);
			}
		}));

		this.remoteGitRepoRadioButton = view.modelBuilder.radioButton().withProps({
			name: 'location',
			label: constants.RemoteGitRepo
		}).component();

		this.locationRadioButtonFormComponent = {
			title: constants.LocationSelectorTitle,
			component: view.modelBuilder.flexContainer()
				.withItems([this.localRadioButton, this.remoteGitRepoRadioButton], { flex: '0 0 auto', CSSStyles: { 'margin-right': '15px' } })
				.withProps({ ariaRole: 'radiogroup' })
				.component()
		};

		this.register(this.remoteGitRepoRadioButton.onDidChangeCheckedState(checked => {
			if (checked) {
				this.formBuilder?.removeFormItem(<azdataType.FormComponent>this.filePathAndButtonComponent);
				this.formBuilder?.insertFormItem(<azdataType.FormComponent>this.gitRepoTextBoxComponent, 1);
				this.formBuilder?.insertFormItem(<azdataType.FormComponent>this.localClonePathComponent, 2);
			}
		}));

		const gitRepoTextBox = view.modelBuilder.inputBox().withProps({
			ariaLabel: constants.GitRepoUrlTitle,
			placeHolder: constants.GitRepoUrlPlaceholder,
			required: true,
			width: constants.DefaultInputWidth
		}).component();

		this.register(gitRepoTextBox.onTextChanged(() => {
			return gitRepoTextBox.updateProperty('title', this.localClonePathTextBox!.value!);
		}));

		this.gitRepoTextBoxComponent = {
			title: constants.GitRepoUrlTitle,
			component: gitRepoTextBox
		};

		this.localClonePathTextBox = view.modelBuilder.inputBox().withProps({
			ariaLabel: constants.LocalClonePathTitle,
			placeHolder: constants.LocalClonePathPlaceholder,
			required: true,
			width: constants.DefaultInputWidth
		}).component();

		this.register(this.localClonePathTextBox.onTextChanged(() => {
			return this.localClonePathTextBox!.updateProperty('title', this.localClonePathTextBox!.value!);
		}));

		const localClonePathBrowseFolderButton = view.modelBuilder.button().withProps({
			ariaLabel: constants.BrowseButtonText,
			title: constants.BrowseButtonText,
			iconPath: IconPathHelper.folder,
			width: '18px',
			height: '16px',
		}).component();

		this.register(localClonePathBrowseFolderButton.onDidClick(async () => {
			const folderUris = await vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				defaultUri: defaultProjectSaveLocation()
			});
			if (!folderUris || folderUris.length === 0) {
				return;
			}

			const selectedFolder = folderUris[0].fsPath;
			this.localClonePathTextBox!.value = selectedFolder;
			void this.localClonePathTextBox!.updateProperty('title', this.localClonePathTextBox!.value);
		}));

		this.localClonePathComponent = {
			title: constants.LocalClonePathTitle,
			component: this.createHorizontalContainer(view, [this.localClonePathTextBox, localClonePathBrowseFolderButton]),
			required: true
		};

		this.filePathTextBox = view.modelBuilder.inputBox().withProps({
			ariaLabel: constants.ProjectFileTitle,
			placeHolder: constants.ProjectFilePlaceholder,
			required: true,
			width: constants.DefaultInputWidth
		}).component();

		this.register(this.filePathTextBox.onTextChanged(() => {
			return this.filePathTextBox!.updateProperty('title', this.filePathTextBox!.value!);
		}));

		const localProjectBrowseFolderButton = view.modelBuilder.button().withProps({
			ariaLabel: constants.BrowseButtonText,
			title: constants.BrowseButtonText,
			iconPath: IconPathHelper.folder,
			width: '18px',
			height: '16px'
		}).component();
		this.register(localProjectBrowseFolderButton.onDidClick(() => this.onBrowseButtonClick()));

		const flexContainer = this.createHorizontalContainer(view, [this.filePathTextBox, localProjectBrowseFolderButton]);
		this.filePathAndButtonComponent = {
			component: flexContainer,
			title: constants.ProjectFileTitle,
			required: true
		};

		this.formBuilder = view.modelBuilder.formContainer().withFormItems([
			this.locationRadioButtonFormComponent,
			this.filePathAndButtonComponent,
		]);
		await view.initializeModel(this.formBuilder?.component());
		this.initDialogComplete?.resolve();
	}

	public async onBrowseButtonClick(): Promise<void> {
		const projectFilePath = await browseForProject(this.workspaceService);
		if (projectFilePath) {
			this.filePathTextBox!.value = projectFilePath.fsPath;
		}
	}
}

export async function browseForProject(workspaceService: IWorkspaceService): Promise<vscode.Uri | undefined> {
	const filters: { [name: string]: string[] } = {};
	const projectTypes = await workspaceService.getAllProjectTypes();
	filters[constants.AllProjectTypes] = [...new Set(projectTypes.map(type => type.projectFileExtension))];
	projectTypes.forEach(type => {
		filters[type.displayName] = [type.projectFileExtension];
	});

	const fileUris = await vscode.window.showOpenDialog({
		canSelectFiles: true,
		canSelectFolders: false,
		canSelectMany: false,
		openLabel: constants.SelectProjectFileActionName,
		filters: filters,
		defaultUri: defaultProjectSaveLocation()
	});

	return fileUris?.[0];
}
