/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as path from 'path';
import { IconPathHelper } from '../common/iconHelper';
import { IWorkspaceService } from '../common/interfaces';
import { SelectProjectFileActionName, UnknownProjectsErrorMessage } from '../common/constants';
import { IProjectType } from 'dataworkspace';

const localize = nls.loadMessageBundle();

export class OpenProjectDialog {
	public dialog: azdata.window.Dialog;
	private createNewTab: azdata.window.DialogTab;
	private openExistingTab: azdata.window.DialogTab;
	private projectNameTextBox: azdata.InputBoxComponent | undefined;
	private locationTextBox: azdata.InputBoxComponent | undefined;
	private openLocationTextBox: azdata.InputBoxComponent | undefined;
	//private openProjectNameTextBox: azdata.InputBoxComponent | undefined;
	//private projectTypeTextBox: azdata.InputBoxComponent | undefined;
	private projectTypeCardGroup: azdata.RadioCardGroupComponent | undefined;
	private formBuilder: azdata.FormBuilder | undefined;
	private projectType: IProjectType;
	private location: vscode.Uri;
	private openLocation: vscode.Uri[];

	constructor() {
		this.dialog = azdata.window.createModelViewDialog(localize('addProjectDialogName', "Add project"), undefined, 'wide');
		this.createNewTab = azdata.window.createTab(localize('createNewTabName', "Create new"));
		this.openExistingTab = azdata.window.createTab(localize('openExistingTabName', "Open existing"));
		this.projectType = {} as IProjectType;
		this.openLocation = [];
		this.location = {} as vscode.Uri;
	}

	public openProjectFromFile(workspaceService: IWorkspaceService) {
		this.initializeDialog(workspaceService);

		this.dialog.okButton.label = 'Add';
		this.dialog.okButton.enabled = false;
		this.dialog.okButton.onClick(async () => await this.execute(workspaceService));

		this.dialog.cancelButton.label = 'Cancel';
		this.dialog.cancelButton.onClick(async () => await this.cancel());

		azdata.window.openDialog(this.dialog);
	}

	private initializeDialog(workspaceService: IWorkspaceService): void {
		this.initializeCreateNewTab(workspaceService);
		this.initializeOpenExistingTab(workspaceService);
		this.dialog.content = [this.createNewTab, this.openExistingTab];
	}

	private initializeCreateNewTab(workspaceService: IWorkspaceService): void {
		this.createNewTab.registerContent(async view => {

			const projectNameColumn = this.createProjectNameColumn(view);
			const locationColumn = this.createLocationColumn(view);
			const projectTypeColumn = await this.createProjectTypeColumn(view, workspaceService);

			const verticalFormSection = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
			verticalFormSection.addItems([projectNameColumn, locationColumn, projectTypeColumn]);


			this.formBuilder = <azdata.FormBuilder>view.modelBuilder.formContainer()
				.withFormItems([
					{
						title: '',
						components: [
							{
								component: verticalFormSection,
								title: ''
							},
						]
					}
				], {
					horizontal: false
				})
				.withLayout({
					width: '100%'
				});

			let formModel = this.formBuilder.component();
			await view.initializeModel(formModel);
		});
	}

	private initializeOpenExistingTab(workspaceService: IWorkspaceService): void {
		this.openExistingTab.registerContent(async view => {

			const locationTypeColumn = this.createLocationTypeColumn(view, workspaceService);
			//const projectInfoRow = this.createProjectInfoRow(view);

			//const verticalFormSection = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
			//verticalFormSection.addItems([locationTypeColumn, projectInfoRow]);

			this.formBuilder = <azdata.FormBuilder>view.modelBuilder.formContainer()
				.withFormItems([
					{
						title: '',
						components: [
							{
								component: locationTypeColumn,
								title: ''
							},
						]
					}
				], {
					horizontal: false
				})
				.withLayout({
					width: '100%'
				});

			let formModel = this.formBuilder.component();
			await view.initializeModel(formModel);
		});
	}

	private createProjectNameColumn(view: azdata.ModelView): azdata.FlexContainer {
		this.projectNameTextBox = view.modelBuilder.inputBox().withProperties({
			placeHolder: 'Enter project name',
			ariaLabel: 'Enter project name',
			width: '200px',
			height: '25px'
		}).component();

		const projectNameLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'Name' }).component();

		const nameColumn = view.modelBuilder.flexContainer().withItems([projectNameLabel, this.projectNameTextBox], { flex: '0 0 auto', CSSStyles: { 'margin-right': '1000px' } }).withLayout({ flexFlow: 'column', alignItems: 'normal' }).component();

		this.projectNameTextBox.onTextChanged(async (e) => {
			this.dialog.okButton.enabled = await this.shouldEnableAddButton();
		});

		return nameColumn;
	}

	private createLocationColumn(view: azdata.ModelView): azdata.FlexContainer {
		const locationButton = this.createLocationButton(view);
		this.locationTextBox = view.modelBuilder.inputBox().withProperties({
			placeHolder: '/default/location',
			ariaLabel: 'location',
			width: '200px',
			height: '25px'
		}).component();

		const locationLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: 'Location'
		}).component();

		const locationRow = view.modelBuilder.flexContainer().withItems([this.locationTextBox, locationButton], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px' } }).withLayout({ flexFlow: 'row', alignItems: 'normal' }).component();

		const locationColumn = view.modelBuilder.flexContainer().withItems([locationLabel, locationRow], { flex: '0 0 auto', CSSStyles: { 'margin-right': '100px' } }).withLayout({ flexFlow: 'column', alignItems: 'normal' }).component();

		this.locationTextBox.onTextChanged(async (e) => {
			this.dialog.okButton.enabled = await this.shouldEnableAddButton();
		});

		return locationColumn;
	}

	private createLocationButton(view: azdata.ModelView): azdata.ButtonComponent {
		let locationButton: azdata.ButtonComponent = view.modelBuilder.button().withProperties({
			ariaLabel: 'Location...',
			iconPath: IconPathHelper.folder_blue,
			height: '25px',
			width: '25px'
		}).component();

		locationButton.onDidClick(async () => {
			const fileUris = await vscode.window.showOpenDialog(
				{
					canSelectFiles: false,
					canSelectFolders: true,
					canSelectMany: false,
					openLabel: 'Select'
				}
			);

			if (!fileUris || fileUris.length === 0) {
				return;
			}

			// show file path in text box and hover text
			this.locationTextBox!.value = fileUris[0].fsPath;
			this.locationTextBox!.placeHolder = fileUris[0].fsPath;

			this.location = fileUris[0];
		});

		return locationButton;
	}

	private async createProjectTypeColumn(view: azdata.ModelView, workspaceService: IWorkspaceService): Promise<azdata.FlexContainer> {
		const projectTypes = await workspaceService.getAllProjectTypes();

		this.projectTypeCardGroup = view.modelBuilder.radioCardGroup().withProperties<azdata.RadioCardGroupComponentProperties>({
			cards: projectTypes.map((projectType) => {
				return <azdata.RadioCard>{
					id: projectType.displayName,
					label: projectType.displayName,
					icon: projectType.icon,
					descriptions: [
						{
							textValue: projectType.displayName,
							textStyles: {
								'font-size': '14px',
								'font-weight': 'bold'
							}
						},
						{
							textValue: projectType.displayName,
						}
					]
				};
			}),
			iconHeight: '100px',
			iconWidth: '300px',
			cardWidth: '300px',
			cardHeight: '150px',
			ariaLabel: localize('projectTypes', "Project Types"),
			width: '1100px',
			iconPosition: 'left'
		}).component();

		const projectTypeLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: 'Type',
		}).component();

		const typeColumn = view.modelBuilder.flexContainer().withItems([projectTypeLabel, this.projectTypeCardGroup], { flex: '0 0 auto', CSSStyles: { 'margin-right': '100px' } }).withLayout({ flexFlow: 'column', alignItems: 'normal' }).component();

		this.projectTypeCardGroup.onSelectionChanged(async (cardId) => {
			const projectType = projectTypes.find(pt => { return pt.displayName === cardId.card.id; });
			if (projectType) {
				this.projectType = projectType;
			}

			this.dialog.okButton.enabled = await this.shouldEnableAddButton();
		});

		return typeColumn;
	}

	private async shouldEnableAddButton(): Promise<boolean> {
		const projectNameFilled = !isNullOrUndefined(this.projectNameTextBox?.value);
		const locationFilled = !isNullOrUndefined(this.locationTextBox?.value);
		const projectTypeSelected = !isNullOrUndefined(this.projectType?.displayName);

		return (projectNameFilled && locationFilled && projectTypeSelected);
	}

	private async cancel(): Promise<void> {
	}

	public async execute(workspaceService: IWorkspaceService): Promise<void> {
		if (!isNullOrUndefined(this.openLocationTextBox?.value)) {
			await workspaceService.addProjectsToWorkspace(this.openLocation);
		} else {
			const projectProvider = await workspaceService.getProjectProvider(this.location);
			if (projectProvider === undefined) {
				vscode.window.showErrorMessage(UnknownProjectsErrorMessage([this.location.path]));
			} else {
				await projectProvider.CreateProject(this.projectNameTextBox?.value!, this.location);
				await workspaceService.addProjectsToWorkspace([this.location]);
			}
		}
	}

	private createLocationTypeColumn(view: azdata.ModelView, workspaceService: IWorkspaceService): azdata.FlexContainer {
		const locationButton = this.createOpenLocationButton(view, workspaceService);
		this.openLocationTextBox = view.modelBuilder.inputBox().withProperties({
			placeHolder: 'Select folder',
			ariaLabel: 'Select folder',
			width: '200px',
			height: '25px'
		}).component();

		const locationLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: 'Select project file'
		}).component();

		const locationRow = view.modelBuilder.flexContainer().withItems([this.openLocationTextBox, locationButton], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px' } }).withLayout({ flexFlow: 'row', alignItems: 'normal' }).component();

		const locationColumn = view.modelBuilder.flexContainer().withItems([locationLabel, locationRow], { flex: '0 0 auto', CSSStyles: { 'margin-right': '100px' } }).withLayout({ flexFlow: 'column', alignItems: 'normal' }).component();

		this.openLocationTextBox.onTextChanged(async (e) => {
			this.dialog.okButton.enabled = true;
			//this.populateProjectInfo(this.locationTextBox?.value!);
		});

		return locationColumn;
	}

	private createOpenLocationButton(view: azdata.ModelView, workspaceService: IWorkspaceService): azdata.ButtonComponent {
		let locationButton: azdata.ButtonComponent = view.modelBuilder.button().withProperties({
			ariaLabel: 'Update location...',
			iconPath: IconPathHelper.folder_blue,
			height: '25px',
			width: '25px'
		}).component();

		locationButton.onDidClick(async () => {
			if (vscode.workspace.workspaceFile) {
				const filter: { [name: string]: string[] } = {};
				const projectTypes = await workspaceService.getAllProjectTypes();
				projectTypes.forEach(type => {
					filter[type.displayName] = projectTypes.map(projectType => projectType.projectFileExtension);
				});

				let fileUris = await vscode.window.showOpenDialog({
					canSelectFiles: true,
					canSelectFolders: false,
					canSelectMany: false,
					defaultUri: vscode.Uri.file(path.dirname(vscode.workspace.workspaceFile.path)),
					openLabel: SelectProjectFileActionName,
					filters: filter
				});

				if (!fileUris || fileUris.length === 0) {
					return;
				}

				// show file path in text box and hover text
				this.openLocationTextBox!.value = fileUris[0].fsPath;
				this.openLocationTextBox!.placeHolder = fileUris[0].fsPath;

				this.openLocation = fileUris;

				//this.openProjectNameTextBox!.value = fileUris[0].fsPath.split('/').pop();
				//this.projectTypeTextBox!.value = await workspaceService.getProjectProvider(fileUris[0]).to;
			}
		});

		return locationButton;
	}

	/*private createProjectInfoRow(view: azdata.ModelView): azdata.FlexContainer {
		this.openProjectNameTextBox = view.modelBuilder.inputBox().withProperties({
			placeHolder: '',
			ariaLabel: 'project',
			enabled: false,
			width:'250px',
			height: '25px'
		}).component();

		const projectNameLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: 'Project name',
			height: '25px'
		}).component();

		this.projectTypeTextBox = view.modelBuilder.inputBox().withProperties({
			placeHolder: '',
			ariaLabel: 'project',
			enabled: false,
			width:'250px',
			height: '25px'
		}).component();

		const projectTypeLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: 'Project type',
			height: '25px'
		}).component();

		const nameColumn = view.modelBuilder.flexContainer().withItems([projectNameLabel, this.openProjectNameTextBox], { flex: '0 0 auto', CSSStyles: { 'margin-right': '100px' } }).withLayout({ flexFlow: 'column', alignItems: 'normal' }).component();
		const typeColumn = view.modelBuilder.flexContainer().withItems([projectTypeLabel, this.projectTypeTextBox], { flex: '0 0 auto', CSSStyles: { 'margin-right': '100px' } }).withLayout({ flexFlow: 'column', alignItems: 'normal' }).component();

		const projectInfoRow = view.modelBuilder.flexContainer().withItems([nameColumn, typeColumn], { flex: '0 0 auto', CSSStyles: { 'margin-right': '100px' } }).withLayout({ flexFlow: 'row', alignItems: 'normal' }).component();

		return projectInfoRow;
	}

	private populateProjectInfo(projectUri: string): void {
		const name = this.openLocationTextBox;
		if(name) {
			name.value = projectUri.slice(projectUri.lastIndexOf('/'));
		}

		const type = this.projectTypeTextBox;
		if(type) {
			type.value = 'Sql Database';
		}
	}*/

}

function isNullOrUndefined(val: any): boolean {
	return val === null || val === undefined;
}
