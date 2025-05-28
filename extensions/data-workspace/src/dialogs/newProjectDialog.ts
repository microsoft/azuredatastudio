/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdataType from 'azdata';
import * as vscode from 'vscode';
import * as path from 'path';
import { Deferred, DialogBase } from './dialogBase';
import { IWorkspaceService } from '../common/interfaces';
import * as constants from '../common/constants';
import { IProjectType } from 'dataworkspace';
import { directoryExist } from '../common/utils';
import { IconPathHelper } from '../common/iconHelper';
import { defaultProjectSaveLocation } from '../common/projectLocationHelper';
import { TelemetryActions, TelemetryReporter, TelemetryViews } from '../common/telemetry';
import { WorkspaceService } from '../services/workspaceService';
import { isValidBasename, isValidBasenameErrorMessage } from '../common/pathUtilsHelper';

class NewProjectDialogModel {
	projectTypeId: string = '';
	projectFileExtension: string = '';
	name: string = '';
	location: string = '';
	targetPlatform?: string;
	sdkStyleProject?: boolean;
	configureDefaultBuild: boolean = false;
}

export async function openSpecificProjectNewProjectDialog(projectType: IProjectType, workspaceService: WorkspaceService): Promise<vscode.Uri | undefined> {
	const dialog = new NewProjectDialog(workspaceService, projectType);
	await dialog.open();
	await dialog.newDialogPromise;
	return dialog.projectUri;
}

export class NewProjectDialog extends DialogBase {
	public model: NewProjectDialogModel = new NewProjectDialogModel();
	public formBuilder: azdataType.FormBuilder | undefined;
	public targetPlatformDropdownFormComponent: azdataType.FormComponent | undefined;
	public sdkProjectCheckboxFormComponent: azdataType.FormComponent | undefined;
	public newProjectDialogComplete: Deferred<void> | undefined;
	public newDialogPromise: Promise<void> = new Promise<void>((resolve, reject) => this.newProjectDialogComplete = { resolve, reject });
	public projectUri: vscode.Uri | undefined;

	constructor(private workspaceService: IWorkspaceService, private specificProjectType?: IProjectType) {
		super(constants.NewProjectDialogTitle, 'NewProject', constants.CreateButtonText);

		// dialog launched from Welcome message button (only visible when no current workspace) vs. "add project" button
		TelemetryReporter.createActionEvent(TelemetryViews.NewProjectDialog, TelemetryActions.NewProjectDialogLaunched)
			.withAdditionalProperties({ isWorkspaceOpen: (vscode.workspace.workspaceFile !== undefined).toString() })
			.send();
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

	override onCancelButtonClicked(): void {
		this.newProjectDialogComplete?.resolve();
		this.dispose();
	}

	override async onComplete(): Promise<void> {
		try {

			TelemetryReporter.createActionEvent(TelemetryViews.NewProjectDialog, TelemetryActions.NewProjectDialogCompleted)
				.withAdditionalProperties({ projectFileExtension: this.model.projectFileExtension, projectTemplateId: this.model.projectTypeId })
				.send();

			this.projectUri = await this.workspaceService.createProject(this.model.name, vscode.Uri.file(this.model.location), this.model.projectTypeId, this.model.targetPlatform, this.model.sdkStyleProject, this.model.configureDefaultBuild);
			this.newProjectDialogComplete?.resolve();
		}
		catch (err) {

			TelemetryReporter.createErrorEvent2(TelemetryViews.NewProjectDialog, TelemetryActions.NewProjectDialogCompleted, err)
				.withAdditionalProperties({ projectFileExtension: this.model.projectFileExtension, projectTemplateId: this.model.projectTypeId, error: err?.message ? err.message : err })
				.send();

			void vscode.window.showErrorMessage(err?.message ? err.message : err);
		}
	}

	protected async initialize(view: azdataType.ModelView): Promise<void> {
		let allProjectTypes = await this.workspaceService.getAllProjectTypes();

		// if a specific project type is specified, only show that one
		if (this.specificProjectType && allProjectTypes.find(p => p.id === this.specificProjectType?.id)) {
			allProjectTypes = [this.specificProjectType];
		}

		const projectTypeRadioCardGroup = view.modelBuilder.radioCardGroup().withProps({
			cards: allProjectTypes.map((projectType: IProjectType) => {
				return <azdataType.RadioCard>{
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
			iconHeight: '75px',
			iconWidth: '75px',
			cardWidth: '215px',
			cardHeight: '195px',
			ariaLabel: constants.TypeTitle,
			width: '500px',
			iconPosition: 'top',
			selectedCardId: allProjectTypes.length > 0 ? allProjectTypes[0].id : undefined
		}).component();

		this.register(projectTypeRadioCardGroup.onSelectionChanged(async (e) => {
			this.model.projectTypeId = e.cardId;
			const selectedProject = allProjectTypes.find(p => p.id === e.cardId);

			if (selectedProject?.targetPlatforms) {
				// update the target platforms dropdown for the selected project type
				targetPlatformDropdown.values = selectedProject?.targetPlatforms;
				targetPlatformDropdown.value = this.getDefaultTargetPlatform(selectedProject);

				this.formBuilder?.insertFormItem(this.targetPlatformDropdownFormComponent!, 3);
			} else {
				// remove the target version dropdown if the selected project type didn't provide values for this
				this.formBuilder?.removeFormItem(this.targetPlatformDropdownFormComponent!);
				this.model.targetPlatform = undefined;
			}

			if (selectedProject?.sdkStyleOption) {
				sdkProjectCheckbox.checked = true;
				this.model.sdkStyleProject = true;

				if (selectedProject.sdkStyleLearnMoreUrl) {
					await sdkLearnMore.updateProperty('url', selectedProject.sdkStyleLearnMoreUrl);
					sdkFormComponentGroup.addItem(sdkLearnMore);
				} else {
					// remove learn more link if the project type didn't provide it
					sdkFormComponentGroup.removeItem(sdkLearnMore);
				}

				this.formBuilder?.addFormItem(this.sdkProjectCheckboxFormComponent!);
			} else {
				this.model.sdkStyleProject = false;
				this.formBuilder?.removeFormItem(this.sdkProjectCheckboxFormComponent!);
			}
		}));

		const projectNameTextBox = view.modelBuilder.inputBox().withValidation(
			component => isValidBasename(component.value)
		)
			.withProps({
				ariaLabel: constants.ProjectNameTitle,
				placeHolder: constants.ProjectNamePlaceholder,
				required: true,
				width: constants.DefaultInputWidth
			}).component();

		this.register(projectNameTextBox.onTextChanged(text => {
			const errorMessage = isValidBasenameErrorMessage(text);
			if (errorMessage !== undefined) {
				// Set validation error message if project name is invalid
				return void projectNameTextBox.updateProperty('validationErrorMessage', errorMessage);
			} else {
				this.model.name = projectNameTextBox.value!;
				return projectNameTextBox.updateProperty('title', projectNameTextBox.value);
			}
		}));

		const locationTextBox = view.modelBuilder.inputBox().withProps({
			ariaLabel: constants.ProjectLocationTitle,
			placeHolder: constants.ProjectLocationPlaceholder,
			required: true,
			width: constants.DefaultInputWidth
		}).component();

		// use the default save location if it's there
		// otherwise, if there's an open folder, set the initial location to that. If there are multiple folders in the workspace, default to the first one
		const defaultSaveLocation = defaultProjectSaveLocation();
		locationTextBox.value = defaultSaveLocation?.fsPath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

		this.register(locationTextBox.onTextChanged(() => {
			this.model.location = locationTextBox.value!;
			return locationTextBox.updateProperty('title', locationTextBox.value);
		}));

		const browseFolderButton = view.modelBuilder.button().withProps({
			ariaLabel: constants.BrowseButtonText,
			title: constants.BrowseButtonText,
			iconPath: IconPathHelper.folder,
			height: '16px',
			width: '18px'
		}).component();
		this.register(browseFolderButton.onDidClick(async () => {
			let folderUris = await vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				defaultUri: locationTextBox.value ? vscode.Uri.file(locationTextBox.value) : undefined
			});
			if (!folderUris || folderUris.length === 0) {
				return;
			}
			const selectedFolder = folderUris[0].fsPath;
			locationTextBox.value = selectedFolder;
			this.model.location = selectedFolder;
		}));

		const targetPlatformDropdown = view.modelBuilder.dropDown().withProps({
			values: allProjectTypes[0].targetPlatforms,
			value: this.getDefaultTargetPlatform(allProjectTypes[0]),
			ariaLabel: constants.TargetPlatform,
			required: true,
			width: constants.DefaultInputWidth
		}).component();

		this.register(targetPlatformDropdown.onValueChanged(() => {
			this.model.targetPlatform = targetPlatformDropdown.value! as string;
		}));


		this.targetPlatformDropdownFormComponent = {
			title: constants.TargetPlatform,
			required: true,
			component: targetPlatformDropdown
		};

		const sdkProjectCheckbox = view.modelBuilder.checkBox().withProps({
			checked: true,
			label: constants.SdkStyleProject
		}).component();

		this.register(sdkProjectCheckbox.onChanged(() => {
			this.model.sdkStyleProject = sdkProjectCheckbox.checked;
		}));

		const sdkLearnMore = view.modelBuilder.hyperlink().withProps({
			label: constants.LearnMore,
			url: ''
		}).component();

		const sdkFormComponentGroup = view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'row', alignItems: 'baseline' })
			.withItems([sdkProjectCheckbox], { CSSStyles: { flex: '0 0 auto', 'margin-right': '10px' } })
			.component();

		if (allProjectTypes[0].sdkStyleLearnMoreUrl) {
			await sdkLearnMore.updateProperty('url', allProjectTypes[0].sdkStyleLearnMoreUrl);
			sdkFormComponentGroup.addItem(sdkLearnMore);
		}

		this.sdkProjectCheckboxFormComponent = {
			component: sdkFormComponentGroup,
		};

		this.formBuilder = view.modelBuilder.formContainer().withFormItems([
			{
				title: constants.TypeTitle,
				component: projectTypeRadioCardGroup
			},
			{
				title: constants.ProjectNameTitle,
				required: true,
				component: this.createHorizontalContainer(view, [projectNameTextBox])
			},
			{
				title: constants.ProjectLocationTitle,
				required: true,
				component: this.createHorizontalContainer(view, [locationTextBox, browseFolderButton])
			}
		]);

		// add version dropdown if the first project type has one
		if (allProjectTypes[0].targetPlatforms) {
			this.formBuilder.addFormItem(this.targetPlatformDropdownFormComponent);
		}

		// add sdk style checkbox is the first project has the option
		if (allProjectTypes[0].sdkStyleOption) {
			this.formBuilder.addFormItem(this.sdkProjectCheckboxFormComponent);
		}

		await view.initializeModel(this.formBuilder.component());
		this.initDialogComplete?.resolve();
	}

	/**
	 * Gets the default target platform of the project type if there is one
	 * @param projectType
	 * @returns
	 */
	getDefaultTargetPlatform(projectType: IProjectType): string | undefined {
		// only return the specified default target platform if it's also included in the project type's array of target platforms
		if (projectType.defaultTargetPlatform && projectType.targetPlatforms?.includes(projectType.defaultTargetPlatform)) {
			return projectType.defaultTargetPlatform;
		} else {
			return undefined;
		}
	}
}
