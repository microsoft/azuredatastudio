/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { ClusterController, ControllerError, MountInfo, MountState, IEndPointsResponse } from '../controller/clusterControllerApi';
import { AuthType } from '../constants';

const localize = nls.loadMessageBundle();

const basicAuthDisplay = localize('basicAuthName', "Basic");
const integratedAuthDisplay = localize('integratedAuthName', "Windows Authentication");
const mountConfigutationTitle = localize('mount.main.section', "Mount Configuration");
const hdfsPathTitle = localize('mount.hdfsPath', "HDFS Path");

function getAuthCategory(name: AuthType): azdata.CategoryValue {
	if (name === 'basic') {
		return { name: name, displayName: basicAuthDisplay };
	}
	return { name: name, displayName: integratedAuthDisplay };
}

/**
 * Converts a comma-delimited set of key value pair credentials to a JSON object.
 * This code is taken from the azdata implementation written in Python
 */
function convertCredsToJson(creds: string): { credentials: {} } {
	if (!creds) {
		return undefined;
	}
	let credObj = { 'credentials': {} };
	let pairs = creds.split(',');
	let validPairs: string[] = [];
	for (let i = 0; i < pairs.length; i++) {
		// handle escaped commas in a browser-agnostic way using regex:
		// this matches a string ending in a single escape character \, but not \\.
		// In this case we split on ',` when we should've ignored it as it was a \, instead.
		// Restore the escaped comma by combining the 2 split strings
		if (i < (pairs.length - 1) && pairs[i].match(/(?!\\).*\\$/)) {
			pairs[i + 1] = `${pairs[i]},${pairs[i + 1]}`;
		} else {
			validPairs.push(pairs[i]);
		}
	}

	validPairs.forEach(pair => {
		const formattingErr = localize('mount.err.formatting', "Bad formatting of credentials at {0}", pair);
		try {
			// # remove escaped characters for ,
			pair = pair.replace('\\,', ',').trim();
			let firstEquals = pair.indexOf('=');
			if (firstEquals <= 0 || firstEquals >= pair.length) {
				throw new Error(formattingErr);
			}
			let key = pair.substring(0, firstEquals);
			let value = pair.substring(firstEquals + 1);
			credObj.credentials[key] = value;
		} catch (err) {
			throw new Error(formattingErr);
		}
	});
	return credObj;
}

export interface DialogProperties {
	url?: string;
	auth?: AuthType;
	username?: string;
	password?: string;
}

export interface MountHdfsProperties extends DialogProperties {
	hdfsPath?: string;
	remoteUri?: string;
	credentials?: string;
}

abstract class HdfsDialogModelBase<T extends DialogProperties> {
	protected _canceled = false;
	private _authTypes: azdata.CategoryValue[];
	constructor(
		public props: T
	) {
		if (!props.auth) {
			this.props.auth = 'basic';
		}
	}

	public get authCategories(): azdata.CategoryValue[] {
		if (!this._authTypes) {
			this._authTypes = [getAuthCategory('basic'), getAuthCategory('integrated')];
		}
		return this._authTypes;
	}

	public get authCategory(): azdata.CategoryValue {
		return getAuthCategory(this.props.auth);
	}

	public async onComplete(props: T): Promise<void> {
		try {
			this.props = props;
			await this.handleCompleted();

		} catch (error) {
			// Ignore the error if we cancelled the request since we can't stop the actual request from completing
			if (!this._canceled) {
				throw error;
			}
		}
	}

	protected abstract handleCompleted(): Promise<void>;

	public async onError(error: ControllerError): Promise<void> {
		// implement
	}

	public async onCancel(): Promise<void> {
		this._canceled = true;
	}

	protected createController(): ClusterController {
		return new ClusterController(this.props.url, this.props.auth, this.props.username, this.props.password, true);
	}

	protected async createAndVerifyControllerConnection(): Promise<ClusterController> {
		// We pre-fetch the endpoints here to verify that the information entered is correct (the user is able to connect)
		let controller = this.createController();
		let response: IEndPointsResponse;
		try {
			response = await controller.getEndPoints();
			if (!response || !response.endPoints) {
				throw new Error(localize('mount.hdfs.loginerror1', "Login to controller failed"));
			}
		} catch (err) {
			throw new Error(localize('mount.hdfs.loginerror2', "Login to controller failed: {0}", err.message));
		}
		return controller;
	}

	protected throwIfMissingUsernamePassword(): void {
		if (this.props.auth === 'basic') {
			// Verify username and password as we can't make them required in the UI
			if (!this.props.username) {
				throw new Error(localize('err.controller.username.required', "Username is required"));
			} else if (!this.props.password) {
				throw new Error(localize('err.controller.password.required', "Password is required"));
			}
		}
	}
}

export class MountHdfsDialogModel extends HdfsDialogModelBase<MountHdfsProperties> {
	private credentials: {};

	constructor(props: MountHdfsProperties) {
		super(props);
	}

	protected async handleCompleted(): Promise<void> {
		this.throwIfMissingUsernamePassword();
		// Validate credentials
		this.credentials = convertCredsToJson(this.props.credentials);

		// We pre-fetch the endpoints here to verify that the information entered is correct (the user is able to connect)
		let controller = await this.createAndVerifyControllerConnection();
		if (this._canceled) {
			return;
		}
		azdata.tasks.startBackgroundOperation(
			{
				connection: undefined,
				displayName: localize('mount.task.name', "Mounting HDFS folder on path {0}", this.props.hdfsPath),
				description: '',
				isCancelable: false,
				operation: op => {
					this.onSubmit(controller, op);
				}
			}
		);
	}

	private async onSubmit(controller: ClusterController, op: azdata.BackgroundOperation): Promise<void> {
		try {
			await controller.mountHdfs(this.props.hdfsPath, this.props.remoteUri, this.credentials);
			op.updateStatus(azdata.TaskStatus.InProgress, localize('mount.task.submitted', "Mount creation has started"));

			// Wait until status has changed or some sensible time expired. If it goes over 2 minutes we assume it's "working"
			// as there's no other API that'll give us this for now
			let result = await this.waitOnMountStatusChange(controller);
			let msg = result.state === MountState.Ready ? localize('mount.task.complete', "Mounting HDFS folder is complete")
				: localize('mount.task.inprogress', "Mounting is likely to complete, check back later to verify");
			op.updateStatus(azdata.TaskStatus.Succeeded, msg);
		} catch (error) {
			const errMsg = localize('mount.task.error', "Error mounting folder: {0}", (error instanceof Error ? error.message : error));
			vscode.window.showErrorMessage(errMsg);
			op.updateStatus(azdata.TaskStatus.Failed, errMsg);
		}
	}

	private waitOnMountStatusChange(controller: ClusterController): Promise<MountInfo> {
		return new Promise<MountInfo>((resolve, reject) => {
			const waitTime = 5 * 1000; // 5 seconds
			const maxRetries = 30;	// 5 x 30 = 150 seconds. After this time, can assume things are "working" as 2 min timeout passed
			let waitOnChange = async (retries: number) => {
				try {
					let mountInfo = await this.getMountStatus(controller, this.props.hdfsPath);
					if (mountInfo && mountInfo.error || mountInfo.state === MountState.Error) {
						reject(new Error(mountInfo.error ? mountInfo.error : localize('mount.error.unknown', "Unknown error occurred during the mount process")));
					} else if (mountInfo.state === MountState.Ready || retries <= 0) {
						resolve(mountInfo);
					} else {
						setTimeout(() => {
							waitOnChange(retries - 1).catch(e => reject(e));
						}, waitTime);
					}
				} catch (err) {
					reject(err);
				}
			};
			waitOnChange(maxRetries);
		});
	}

	private async getMountStatus(controller: ClusterController, path: string): Promise<MountInfo> {
		let statusResponse = await controller.getMountStatus(path);
		if (statusResponse.mount) {
			return Array.isArray(statusResponse.mount) ? statusResponse.mount[0] : statusResponse.mount;
		}
		return undefined;
	}
}

abstract class HdfsDialogBase<T extends DialogProperties> {

	protected dialog: azdata.window.Dialog;
	protected uiModelBuilder!: azdata.ModelBuilder;

	protected urlInputBox!: azdata.InputBoxComponent;
	protected authDropdown!: azdata.DropDownComponent;
	protected usernameInputBox!: azdata.InputBoxComponent;
	protected passwordInputBox!: azdata.InputBoxComponent;

	constructor(private title: string, protected model: HdfsDialogModelBase<T>) {
	}

	public showDialog(): void {
		this.createDialog();
		azdata.window.openDialog(this.dialog);
	}

	private createDialog(): void {
		this.dialog = azdata.window.createModelViewDialog(this.title);
		this.dialog.registerContent(async view => {
			this.uiModelBuilder = view.modelBuilder;

			this.urlInputBox = this.uiModelBuilder.inputBox()
				.withProperties<azdata.InputBoxProperties>({
					placeHolder: localize('textUrlLower', "url"),
					value: this.model.props.url,
				}).component();
			this.urlInputBox.enabled = false;

			this.authDropdown = this.uiModelBuilder.dropDown().withProperties({
				values: this.model.authCategories,
				value: this.model.authCategory,
				editable: false,
			}).component();
			this.authDropdown.onValueChanged(e => this.onAuthChanged());
			this.usernameInputBox = this.uiModelBuilder.inputBox()
				.withProperties<azdata.InputBoxProperties>({
					placeHolder: localize('textUsernameLower', "username"),
					value: this.model.props.username
				}).component();
			this.passwordInputBox = this.uiModelBuilder.inputBox()
				.withProperties<azdata.InputBoxProperties>({
					placeHolder: localize('textPasswordLower', "password"),
					inputType: 'password',
					value: this.model.props.password
				})
				.component();

			let connectionSection: azdata.FormComponentGroup = {
				components: [
					{
						component: this.urlInputBox,
						title: localize('textUrlCapital', "URL"),
						required: true
					}, {
						component: this.authDropdown,
						title: localize('textAuthCapital', "Authentication type"),
						required: true
					}, {
						component: this.usernameInputBox,
						title: localize('textUsernameCapital', "Username"),
						required: false
					}, {
						component: this.passwordInputBox,
						title: localize('textPasswordCapital', "Password"),
						required: false
					}
				],
				title: localize('hdsf.dialog.connection.section', "Cluster Connection")
			};
			let formModel = this.uiModelBuilder.formContainer()
				.withFormItems([
					this.getMainSection(),
					connectionSection
				]).withLayout({ width: '100%' }).component();

			await view.initializeModel(formModel);
			this.onAuthChanged();
		});

		this.dialog.registerCloseValidator(async () => await this.validate());
		this.dialog.cancelButton.onClick(async () => await this.cancel());
		this.dialog.okButton.label = localize('hdfs.dialog.ok', "OK");
		this.dialog.cancelButton.label = localize('hdfs.dialog.cancel', "Cancel");
	}

	protected abstract getMainSection(): azdata.FormComponentGroup;

	protected get authValue(): AuthType {
		return (<azdata.CategoryValue>this.authDropdown.value).name as AuthType;
	}

	private onAuthChanged(): void {
		let isBasic = this.authValue === 'basic';
		this.usernameInputBox.enabled = isBasic;
		this.passwordInputBox.enabled = isBasic;
		if (!isBasic) {
			this.usernameInputBox.value = '';
			this.passwordInputBox.value = '';
		}
	}

	protected abstract validate(): Promise<boolean>;

	private async cancel(): Promise<void> {
		if (this.model && this.model.onCancel) {
			await this.model.onCancel();
		}
	}

	protected async reportError(error: any): Promise<void> {
		this.dialog.message = {
			text: (typeof error === 'string') ? error : error.message,
			level: azdata.window.MessageLevel.Error
		};
		if (this.model && this.model.onError) {
			await this.model.onError(error as ControllerError);
		}
	}
}
export class MountHdfsDialog extends HdfsDialogBase<MountHdfsProperties> {
	private pathInputBox: azdata.InputBoxComponent;
	private remoteUriInputBox: azdata.InputBoxComponent;
	private credentialsInputBox: azdata.InputBoxComponent;

	constructor(model: MountHdfsDialogModel) {
		super(localize('mount.dialog.title', "Mount HDFS Folder"), model);
	}

	protected getMainSection(): azdata.FormComponentGroup {
		const newMountName = '/mymount';
		let pathVal = this.model.props.hdfsPath;
		pathVal = (!pathVal || pathVal === '/') ? newMountName : (pathVal + newMountName);
		this.pathInputBox = this.uiModelBuilder.inputBox()
			.withProperties<azdata.InputBoxProperties>({
				value: pathVal
			}).component();
		this.remoteUriInputBox = this.uiModelBuilder.inputBox()
			.withProperties<azdata.InputBoxProperties>({
				value: this.model.props.remoteUri
			})
			.component();
		this.credentialsInputBox = this.uiModelBuilder.inputBox()
			.withProperties<azdata.InputBoxProperties>({
				inputType: 'password',
				value: this.model.props.credentials
			})
			.component();

		return {
			components: [
				{
					component: this.pathInputBox,
					title: hdfsPathTitle,
					required: true
				}, {
					component: this.remoteUriInputBox,
					title: localize('mount.remoteUri', "Remote URI"),
					required: true
				}, {
					component: this.credentialsInputBox,
					title: localize('mount.credentials', "Credentials"),
					required: false
				}
			],
			title: mountConfigutationTitle
		};
	}

	protected async validate(): Promise<boolean> {
		try {
			await this.model.onComplete({
				url: this.urlInputBox && this.urlInputBox.value,
				auth: this.authValue,
				username: this.usernameInputBox && this.usernameInputBox.value,
				password: this.passwordInputBox && this.passwordInputBox.value,
				hdfsPath: this.pathInputBox && this.pathInputBox.value,
				remoteUri: this.remoteUriInputBox && this.remoteUriInputBox.value,
				credentials: this.credentialsInputBox && this.credentialsInputBox.value
			});
			return true;
		} catch (error) {
			await this.reportError(error);
			return false;
		}
	}
}

export class RefreshMountDialog extends HdfsDialogBase<MountHdfsProperties> {
	private pathInputBox: azdata.InputBoxComponent;

	constructor(model: RefreshMountModel) {
		super(localize('refreshmount.dialog.title', "Refresh Mount"), model);
	}

	protected getMainSection(): azdata.FormComponentGroup {
		this.pathInputBox = this.uiModelBuilder.inputBox()
			.withProperties<azdata.InputBoxProperties>({
				value: this.model.props.hdfsPath
			}).component();
		return {
			components: [
				{
					component: this.pathInputBox,
					title: hdfsPathTitle,
					required: true
				}
			],
			title: mountConfigutationTitle
		};
	}

	protected async validate(): Promise<boolean> {
		try {
			await this.model.onComplete({
				url: this.urlInputBox && this.urlInputBox.value,
				auth: this.authValue,
				username: this.usernameInputBox && this.usernameInputBox.value,
				password: this.passwordInputBox && this.passwordInputBox.value,
				hdfsPath: this.pathInputBox && this.pathInputBox.value
			});
			return true;
		} catch (error) {
			await this.reportError(error);
			return false;
		}
	}
}

export class RefreshMountModel extends HdfsDialogModelBase<MountHdfsProperties> {

	constructor(props: MountHdfsProperties) {
		super(props);
	}

	protected async handleCompleted(): Promise<void> {
		this.throwIfMissingUsernamePassword();

		// We pre-fetch the endpoints here to verify that the information entered is correct (the user is able to connect)
		let controller = await this.createAndVerifyControllerConnection();
		if (this._canceled) {
			return;
		}
		azdata.tasks.startBackgroundOperation(
			{
				connection: undefined,
				displayName: localize('refreshmount.task.name', "Refreshing HDFS Mount on path {0}", this.props.hdfsPath),
				description: '',
				isCancelable: false,
				operation: op => {
					this.onSubmit(controller, op);
				}
			}
		);
	}

	private async onSubmit(controller: ClusterController, op: azdata.BackgroundOperation): Promise<void> {
		try {
			await controller.refreshMount(this.props.hdfsPath);
			op.updateStatus(azdata.TaskStatus.Succeeded, localize('refreshmount.task.submitted', "Refresh mount request submitted"));
		} catch (error) {
			const errMsg = (error instanceof Error) ? error.message : error;
			vscode.window.showErrorMessage(errMsg);
			op.updateStatus(azdata.TaskStatus.Failed, errMsg);
		}
	}
}

export class DeleteMountDialog extends HdfsDialogBase<MountHdfsProperties> {
	private pathInputBox: azdata.InputBoxComponent;

	constructor(model: DeleteMountModel) {
		super(localize('deleteMount.dialog.title', "Delete Mount"), model);
	}

	protected getMainSection(): azdata.FormComponentGroup {
		this.pathInputBox = this.uiModelBuilder.inputBox()
			.withProperties<azdata.InputBoxProperties>({
				value: this.model.props.hdfsPath
			}).component();
		return {
			components: [
				{
					component: this.pathInputBox,
					title: hdfsPathTitle,
					required: true
				}
			],
			title: mountConfigutationTitle
		};
	}

	protected async validate(): Promise<boolean> {
		try {
			await this.model.onComplete({
				url: this.urlInputBox && this.urlInputBox.value,
				auth: this.authValue,
				username: this.usernameInputBox && this.usernameInputBox.value,
				password: this.passwordInputBox && this.passwordInputBox.value,
				hdfsPath: this.pathInputBox && this.pathInputBox.value
			});
			return true;
		} catch (error) {
			await this.reportError(error);
			return false;
		}
	}
}

export class DeleteMountModel extends HdfsDialogModelBase<MountHdfsProperties> {

	constructor(props: MountHdfsProperties) {
		super(props);
	}

	protected async handleCompleted(): Promise<void> {
		this.throwIfMissingUsernamePassword();

		// We pre-fetch the endpoints here to verify that the information entered is correct (the user is able to connect)
		let controller = await this.createAndVerifyControllerConnection();
		if (this._canceled) {
			return;
		}
		azdata.tasks.startBackgroundOperation(
			{
				connection: undefined,
				displayName: localize('deletemount.task.name', "Deleting HDFS Mount on path {0}", this.props.hdfsPath),
				description: '',
				isCancelable: false,
				operation: op => {
					this.onSubmit(controller, op);
				}
			}
		);
	}

	private async onSubmit(controller: ClusterController, op: azdata.BackgroundOperation): Promise<void> {
		try {
			await controller.deleteMount(this.props.hdfsPath);
			op.updateStatus(azdata.TaskStatus.Succeeded, localize('deletemount.task.submitted', "Delete mount request submitted"));
		} catch (error) {
			const errMsg = (error instanceof Error) ? error.message : error;
			vscode.window.showErrorMessage(errMsg);
			op.updateStatus(azdata.TaskStatus.Failed, errMsg);
		}
	}
}
