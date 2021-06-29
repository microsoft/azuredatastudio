/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdataType from 'azdata';
import * as vscode from 'vscode';
import * as path from 'path';
import * as constants from '../common/constants';
import { IconPathHelper } from '../common/iconHelper';
import { directoryExist, fileExist, getAzdataApi, isCurrentWorkspaceUntitled } from '../common/utils';

interface Deferred<T> {
	resolve: (result: T | Promise<T>) => void;
	reject: (reason: any) => void;
}

export abstract class DialogBase {
	protected _toDispose: vscode.Disposable[] = [];
	public dialogObject: azdataType.window.Dialog;
	protected initDialogComplete: Deferred<void> | undefined;
	protected initDialogPromise: Promise<void> = new Promise<void>((resolve, reject) => this.initDialogComplete = { resolve, reject });
	protected workspaceDescriptionFormComponent: azdataType.FormComponent | undefined;
	public workspaceInputBox: azdataType.InputBoxComponent | undefined;
	protected workspaceInputFormComponent: azdataType.FormComponent | undefined;

	constructor(dialogTitle: string, dialogName: string, okButtonText: string, dialogWidth: azdataType.window.DialogWidth = 600) {
		this.dialogObject = getAzdataApi()!.window.createModelViewDialog(dialogTitle, dialogName, dialogWidth);
		this.dialogObject.okButton.label = okButtonText;
		this.register(this.dialogObject.cancelButton.onClick(() => this.onCancelButtonClicked()));
		this.register(this.dialogObject.okButton.onClick(() => this.onOkButtonClicked()));
		this.dialogObject.registerCloseValidator(async () => {
			return this.validate();
		});
	}

	protected abstract initialize(view: azdataType.ModelView): Promise<void>;

	abstract validate(): Promise<boolean>;

	public async open(): Promise<void> {
		const tab = getAzdataApi()!.window.createTab('');
		tab.registerContent(async (view: azdataType.ModelView) => {
			return this.initialize(view);
		});
		this.dialogObject.content = [tab];
		getAzdataApi()!.window.openDialog(this.dialogObject);
		await this.initDialogPromise;
	}

	private onCancelButtonClicked(): void {
		this.dispose();
	}

	private async onOkButtonClicked(): Promise<void> {
		await this.onComplete();
		this.dispose();
	}

	protected async onComplete(): Promise<void> {
	}

	protected dispose(): void {
		this._toDispose.forEach(disposable => disposable.dispose());
	}

	protected register(disposable: vscode.Disposable): void {
		this._toDispose.push(disposable);
	}

	protected showErrorMessage(message: string): void {
		this.dialogObject.message = {
			text: message,
			level: getAzdataApi()!.window.MessageLevel.Error
		};
	}

	public getErrorMessage(): azdataType.window.DialogMessage {
		return this.dialogObject.message;
	}

	protected createHorizontalContainer(view: azdataType.ModelView, items: azdataType.Component[]): azdataType.FlexContainer {
		return view.modelBuilder.flexContainer().withItems(items, { CSSStyles: { 'margin-right': '5px', 'margin-bottom': '10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
	}

	/**
	 * Creates container with information on which workspace the project will be added to and where the workspace will be
	 * created if no workspace is currently open
	 * @param view
	 */
	protected createWorkspaceContainer(view: azdataType.ModelView): void {
		const workspaceDescription = view.modelBuilder.text().withProperties<azdataType.TextComponentProperties>({
			value: vscode.workspace.workspaceFile ? constants.AddProjectToCurrentWorkspace : constants.NewWorkspaceWillBeCreated,
			CSSStyles: { 'margin-top': '3px', 'margin-bottom': '0px' }
		}).component();

		const initialWorkspaceInputBoxValue = !!vscode.workspace.workspaceFile && !isCurrentWorkspaceUntitled() ? vscode.workspace.workspaceFile.fsPath : '';

		this.workspaceInputBox = view.modelBuilder.inputBox().withProperties<azdataType.InputBoxProperties>({
			ariaLabel: constants.WorkspaceLocationTitle,
			width: constants.DefaultInputWidth,
			enabled: !vscode.workspace.workspaceFile || isCurrentWorkspaceUntitled(), // want it editable if no saved workspace is open
			value: initialWorkspaceInputBoxValue,
			title: initialWorkspaceInputBoxValue // hovertext for if file path is too long to be seen in textbox
		}).component();

		const browseFolderButton = view.modelBuilder.button().withProperties<azdataType.ButtonProperties>({
			ariaLabel: constants.BrowseButtonText,
			iconPath: IconPathHelper.folder,
			height: '16px',
			width: '18px'
		}).component();

		this.register(browseFolderButton.onDidClick(async () => {
			const currentFileName = path.parse(this.workspaceInputBox!.value!).base;

			// let user select folder for workspace file to be created in
			const folderUris = await vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				defaultUri: vscode.Uri.file(path.parse(this.workspaceInputBox!.value!).dir)
			});
			if (!folderUris || folderUris.length === 0) {
				return;
			}
			const selectedFolder = folderUris[0].fsPath;

			const selectedFile = path.join(selectedFolder, currentFileName);
			this.workspaceInputBox!.value = selectedFile;
			this.workspaceInputBox!.title = selectedFile;
		}));

		if (vscode.workspace.workspaceFile && !isCurrentWorkspaceUntitled()) {
			this.workspaceInputFormComponent = {
				component: this.workspaceInputBox
			};
		} else {
			// have browse button to help select where the workspace file should be created
			const horizontalContainer = this.createHorizontalContainer(view, [this.workspaceInputBox, browseFolderButton]);
			this.workspaceInputFormComponent = {
				component: horizontalContainer
			};
		}

		this.workspaceDescriptionFormComponent = {
			title: constants.Workspace,
			component: workspaceDescription,
			required: true
		};
	}

	/**
	 * Update the workspace inputbox based on the passed in location and name if there isn't a workspace currently open
	 * @param location
	 * @param name
	 */
	protected updateWorkspaceInputbox(location: string, name: string): void {
		if (!vscode.workspace.workspaceFile || isCurrentWorkspaceUntitled()) {
			const fileLocation = location && name ? path.join(location, `${name}.code-workspace`) : '';
			this.workspaceInputBox!.value = fileLocation;
			this.workspaceInputBox!.title = fileLocation;
		}
	}

	public async validateNewWorkspace(sameFolderAsNewProject: boolean): Promise<void> {
		// workspace file should end in .code-workspace
		const workspaceValid = this.workspaceInputBox!.value!.endsWith(constants.WorkspaceFileExtension);
		if (!workspaceValid) {
			throw new Error(constants.WorkspaceFileInvalidError(this.workspaceInputBox!.value!));
		}

		// if the workspace file is not going to be in the same folder as the newly created project, then check that it's a valid folder
		if (!sameFolderAsNewProject) {
			const workspaceParentDirectoryExists = await directoryExist(path.dirname(this.workspaceInputBox!.value!));
			if (!workspaceParentDirectoryExists) {
				throw new Error(constants.WorkspaceParentDirectoryNotExistError(path.dirname(this.workspaceInputBox!.value!)));
			}
		}

		// workspace file should not be an existing workspace file
		const workspaceFileExists = await fileExist(this.workspaceInputBox!.value!);
		if (workspaceFileExists) {
			throw new Error(constants.WorkspaceFileAlreadyExistsError(this.workspaceInputBox!.value!));
		}
	}
}
