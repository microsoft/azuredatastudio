/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as path from 'path';
import { DialogBase } from './dialogBase';
import * as constants from '../common/constants';
import { IWorkspaceService } from '../common/interfaces';
import { directoryExist, fileExist } from '../common/utils';
import { IconPathHelper } from '../common/iconHelper';
import { calculateRelativity, TelemetryActions, TelemetryReporter, TelemetryViews } from '../common/telemetry';
import { defaultProjectSaveLocation } from '../common/projectLocationHelper';

export class OpenExistingDialog extends DialogBase {
	public targetTypeRadioCardGroup: azdata.RadioCardGroupComponent | undefined;
	public filePathTextBox: azdata.InputBoxComponent | undefined;
	public filePathAndButtonComponent: azdata.FormComponent | undefined;
	public gitRepoTextBoxComponent: azdata.FormComponent | undefined;
	public localClonePathComponent: azdata.FormComponent | undefined;
	public localClonePathTextBox: azdata.InputBoxComponent | undefined;
	public localRadioButton: azdata.RadioButtonComponent | undefined;
	public remoteGitRepoRadioButton: azdata.RadioButtonComponent | undefined;
	public locationRadioButtonFormComponent: azdata.FormComponent | undefined;
	public formBuilder: azdata.FormBuilder | undefined;

	private _targetTypes = [
		{
			name: constants.Project,
			icon: this.extensionContext.asAbsolutePath('images/Open_existing_Project.svg')
		}, {
			name: constants.Workspace,
			icon: this.extensionContext.asAbsolutePath('images/Open_existing_Workspace.svg')
		}
	];

	constructor(private workspaceService: IWorkspaceService, private extensionContext: vscode.ExtensionContext) {
		super(constants.OpenExistingDialogTitle, 'OpenProject');

		// dialog launched from Welcome message button (only visible when no current workspace) vs. "add project" button
		TelemetryReporter.createActionEvent(TelemetryViews.OpenExistingDialog, TelemetryActions.OpenExistingDialogLaunched)
			.withAdditionalProperties({ isWorkspaceOpen: (vscode.workspace.workspaceFile !== undefined).toString() })
			.send();
	}

	async validate(): Promise<boolean> {
		try {
			// the selected location should be an existing directory
			if (this.targetTypeRadioCardGroup?.selectedCardId === constants.Project) {
				await this.validateFile(this.filePathTextBox!.value!, constants.Project.toLowerCase());

				if (this.workspaceInputBox!.enabled) {
					await this.validateNewWorkspace(false);
				}
			} else if (this.targetTypeRadioCardGroup?.selectedCardId === constants.Workspace) {
				if (this.localRadioButton?.checked) {
					await this.validateFile(this.filePathTextBox!.value!, constants.Workspace.toLowerCase());
				} else {
					// validate clone location
					// check if parent folder exists
					await this.validateClonePath(<string>this.localClonePathTextBox!.value);
				}
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

	async onComplete(): Promise<void> {
		try {
			if (this.targetTypeRadioCardGroup?.selectedCardId === constants.Workspace) {
				// capture that workspace was selected, also if there's already an open workspace that's being replaced
				TelemetryReporter.createActionEvent(TelemetryViews.OpenExistingDialog, TelemetryActions.OpeningWorkspace)
					.withAdditionalProperties({ hasWorkspaceOpen: (vscode.workspace.workspaceFile !== undefined).toString() })
					.send();

				if (this.remoteGitRepoRadioButton!.checked) {
					TelemetryReporter.createActionEvent(TelemetryViews.OpenExistingDialog, TelemetryActions.GitClone)
						.withAdditionalProperties({ selectedTarget: 'workspace' })
						.send();

					// after this executes, the git extension will show a popup asking if you want to enter the workspace
					await vscode.commands.executeCommand('git.clone', (<azdata.InputBoxComponent>this.gitRepoTextBoxComponent?.component).value, this.localClonePathTextBox!.value);
				} else {
					await this.workspaceService.enterWorkspace(vscode.Uri.file(this.filePathTextBox!.value!));
				}
			} else {
				// save datapoint now because it'll get set to new value during validateWorkspace()
				const telemetryProps: any = { hasWorkspaceOpen: (vscode.workspace.workspaceFile !== undefined).toString() };

				const validateWorkspace = await this.workspaceService.validateWorkspace();
				let addProjectsPromise: Promise<void>;

				if (validateWorkspace) {
					telemetryProps.workspaceProjectRelativity = calculateRelativity(this.filePathTextBox!.value!, this.workspaceInputBox!.value!);
					telemetryProps.cancelled = 'false';
					addProjectsPromise = this.workspaceService.addProjectsToWorkspace([vscode.Uri.file(this.filePathTextBox!.value!)], vscode.Uri.file(this.workspaceInputBox!.value!));
				} else {
					telemetryProps.workspaceProjectRelativity = 'none';
					telemetryProps.cancelled = 'true';
					addProjectsPromise = this.workspaceService.addProjectsToWorkspace([vscode.Uri.file(this.filePathTextBox!.value!)], vscode.Uri.file(this.workspaceInputBox!.value!));
				}

				TelemetryReporter.createActionEvent(TelemetryViews.OpenExistingDialog, TelemetryActions.OpeningProject)
					.withAdditionalProperties(telemetryProps)
					.send();

				await addProjectsPromise;
			}
		}
		catch (err) {
			vscode.window.showErrorMessage(err?.message ? err.message : err);
		}
	}

	protected async initialize(view: azdata.ModelView): Promise<void> {
		this.targetTypeRadioCardGroup = view.modelBuilder.radioCardGroup().withProperties<azdata.RadioCardGroupComponentProperties>({
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
			iconHeight: '100px',
			iconWidth: '100px',
			cardWidth: '170px',
			cardHeight: '170px',
			ariaLabel: constants.TypeTitle,
			width: '500px',
			iconPosition: 'top',
			selectedCardId: constants.Project
		}).component();

		this.localRadioButton = view.modelBuilder.radioButton().withProperties<azdata.RadioButtonProperties>({
			name: 'location',
			label: constants.Local,
			checked: true
		}).component();

		this.register(this.localRadioButton.onDidChangeCheckedState(checked => {
			if (checked) {
				this.formBuilder?.removeFormItem(<azdata.FormComponent>this.gitRepoTextBoxComponent);
				this.formBuilder?.removeFormItem(<azdata.FormComponent>this.localClonePathComponent);
				this.formBuilder?.insertFormItem(<azdata.FormComponent>this.filePathAndButtonComponent, 2);
			}
		}));

		this.remoteGitRepoRadioButton = view.modelBuilder.radioButton().withProperties<azdata.RadioButtonProperties>({
			name: 'location',
			label: constants.RemoteGitRepo
		}).component();

		this.locationRadioButtonFormComponent = {
			title: constants.LocationSelectorTitle,
			required: true,
			component: view.modelBuilder.flexContainer()
				.withItems([this.localRadioButton, this.remoteGitRepoRadioButton], { flex: '0 0 auto', CSSStyles: { 'margin-right': '15px' } })
				.withProperties({ ariaRole: 'radiogroup' })
				.component()
		};

		this.register(this.remoteGitRepoRadioButton.onDidChangeCheckedState(checked => {
			if (checked) {
				this.formBuilder?.removeFormItem(<azdata.FormComponent>this.filePathAndButtonComponent);
				this.formBuilder?.insertFormItem(<azdata.FormComponent>this.gitRepoTextBoxComponent, 2);
				this.formBuilder?.insertFormItem(<azdata.FormComponent>this.localClonePathComponent, 3);
			}
		}));

		this.gitRepoTextBoxComponent = {
			title: constants.GitRepoUrlTitle,
			component: view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
				ariaLabel: constants.GitRepoUrlTitle,
				placeHolder: constants.GitRepoUrlPlaceholder,
				required: true,
				width: constants.DefaultInputWidth
			}).component()
		};

		this.localClonePathTextBox = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			ariaLabel: constants.LocalClonePathTitle,
			placeHolder: constants.LocalClonePathPlaceholder,
			required: true,
			width: constants.DefaultInputWidth
		}).component();

		const localClonePathBrowseFolderButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			ariaLabel: constants.BrowseButtonText,
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
		}));

		this.localClonePathComponent = {
			title: constants.LocalClonePathTitle,
			component: this.createHorizontalContainer(view, [this.localClonePathTextBox, localClonePathBrowseFolderButton]),
			required: true
		};

		this.filePathTextBox = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			ariaLabel: constants.LocationSelectorTitle,
			placeHolder: constants.ProjectFilePlaceholder,
			required: true,
			width: constants.DefaultInputWidth
		}).component();

		this.register(this.filePathTextBox.onTextChanged(() => {
			this.filePathTextBox!.updateProperty('title', this.filePathTextBox!.value!);
			this.updateWorkspaceInputbox(path.dirname(this.filePathTextBox!.value!), path.basename(this.filePathTextBox!.value!, path.extname(this.filePathTextBox!.value!)));
		}));

		const localProjectBrowseFolderButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			ariaLabel: constants.BrowseButtonText,
			iconPath: IconPathHelper.folder,
			width: '18px',
			height: '16px'
		}).component();
		this.register(localProjectBrowseFolderButton.onDidClick(async () => {
			if (this.targetTypeRadioCardGroup?.selectedCardId === constants.Project) {
				await this.projectBrowse();
			} else if (this.targetTypeRadioCardGroup?.selectedCardId === constants.Workspace) {
				await this.workspaceBrowse();
			}
		}));

		const flexContainer = this.createHorizontalContainer(view, [this.filePathTextBox, localProjectBrowseFolderButton]);
		flexContainer.updateCssStyles({ 'margin-top': '-10px' });
		this.filePathAndButtonComponent = {
			component: flexContainer
		};

		this.register(this.targetTypeRadioCardGroup.onSelectionChanged(({ cardId }) => {
			if (cardId === constants.Project) {
				this.filePathTextBox!.placeHolder = constants.ProjectFilePlaceholder;
				// hide these two radio buttons for now since git clone is just for workspaces
				this.localRadioButton?.updateCssStyles({ 'display': 'none' });
				this.remoteGitRepoRadioButton?.updateCssStyles({ 'display': 'none' });
				this.formBuilder?.removeFormItem(<azdata.FormComponent>this.gitRepoTextBoxComponent);
				this.formBuilder?.removeFormItem(<azdata.FormComponent>this.localClonePathComponent);

				this.formBuilder?.addFormItem(this.filePathAndButtonComponent!);
				this.formBuilder?.addFormItem(this.workspaceDescriptionFormComponent!);
				this.formBuilder?.addFormItem(this.workspaceInputFormComponent!);
			} else if (cardId === constants.Workspace) {
				this.filePathTextBox!.placeHolder = constants.WorkspacePlaceholder;
				this.localRadioButton?.updateCssStyles({ 'display': 'block' });
				this.remoteGitRepoRadioButton?.updateCssStyles({ 'display': 'block' });

				this.formBuilder?.removeFormItem(this.workspaceDescriptionFormComponent!);
				this.formBuilder?.removeFormItem(this.workspaceInputFormComponent!);

				if (this.remoteGitRepoRadioButton!.checked) {
					this.formBuilder?.removeFormItem(<azdata.FormComponent>this.filePathAndButtonComponent);
					this.formBuilder?.insertFormItem(<azdata.FormComponent>this.gitRepoTextBoxComponent, 2);
					this.formBuilder?.insertFormItem(<azdata.FormComponent>this.localClonePathComponent, 3);
				}
			}

			// clear selected file textbox
			this.filePathTextBox!.value = '';
		}));

		this.createWorkspaceContainer(view);

		this.formBuilder = view.modelBuilder.formContainer().withFormItems([
			{
				title: constants.TypeTitle,
				required: true,
				component: this.targetTypeRadioCardGroup,
			},
			this.locationRadioButtonFormComponent,
			this.filePathAndButtonComponent,
			this.workspaceDescriptionFormComponent!,
			this.workspaceInputFormComponent!
		]);
		await view.initializeModel(this.formBuilder?.component());
		this.initDialogComplete?.resolve();
	}

	public async workspaceBrowse(): Promise<void> {
		const filters: { [name: string]: string[] } = { [constants.Workspace]: [constants.WorkspaceFileExtension.substring(1)] }; // filter already adds a period before the extension
		const fileUris = await vscode.window.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			openLabel: constants.SelectProjectFileActionName,
			filters: filters
		});

		if (!fileUris || fileUris.length === 0) {
			return;
		}

		const workspaceFilePath = fileUris[0].fsPath;
		this.filePathTextBox!.value = workspaceFilePath;
	}

	public async projectBrowse(): Promise<void> {
		const filters: { [name: string]: string[] } = {};
		const projectTypes = await this.workspaceService.getAllProjectTypes();
		filters[constants.AllProjectTypes] = projectTypes.map(type => type.projectFileExtension);
		projectTypes.forEach(type => {
			filters[type.displayName] = [type.projectFileExtension];
		});

		const fileUris = await vscode.window.showOpenDialog({
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
		this.filePathTextBox!.value = projectFilePath;
	}
}
