/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { ClusterController, MountInfo, MountState } from '../controller/clusterControllerApi';
import { HdfsDialogBase, HdfsDialogModelBase, HdfsDialogProperties } from './hdfsDialogBase';
import * as loc from '../localizedConstants';

/**
 * Converts a comma-delimited set of key value pair credentials to a JSON object.
 * This code is taken from the azdata implementation written in Python
 */
function convertCredsToJson(creds: string): { credentials: {} } {
	if (!creds) {
		return undefined;
	}
	let credObj: { 'credentials': { [key: string]: any } } = { 'credentials': {} };
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
		const formattingErr = loc.badCredentialsFormatting(pair);
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

export interface MountHdfsProperties extends HdfsDialogProperties {
	hdfsPath?: string;
	remoteUri?: string;
	credentials?: string;
}

export class MountHdfsDialogModel extends HdfsDialogModelBase<MountHdfsProperties, void> {
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
				displayName: loc.mountTask(this.props.hdfsPath),
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
			op.updateStatus(azdata.TaskStatus.InProgress, loc.mountTaskSubmitted);

			// Wait until status has changed or some sensible time expired. If it goes over 2 minutes we assume it's "working"
			// as there's no other API that'll give us this for now
			let result = await this.waitOnMountStatusChange(controller);
			let msg = result.state === MountState.Ready ? loc.mountCompleted : loc.mountInProgress;
			op.updateStatus(azdata.TaskStatus.Succeeded, msg);
		} catch (error) {
			const errMsg = loc.mountError(error);
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
						reject(new Error(mountInfo.error ? mountInfo.error : loc.mountErrorUnknown));
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

export class MountHdfsDialog extends HdfsDialogBase<MountHdfsProperties, void> {
	private pathInputBox: azdata.InputBoxComponent;
	private remoteUriInputBox: azdata.InputBoxComponent;
	private credentialsInputBox: azdata.InputBoxComponent;

	constructor(model: MountHdfsDialogModel) {
		super(loc.mountFolder, model);
	}

	protected getMainSectionComponents(): (azdata.FormComponentGroup | azdata.FormComponent)[] {
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

		return [
			{
				components: [
					{
						component: this.pathInputBox,
						title: loc.hdfsPath,
						required: true,
						layout: {
							info: loc.hdfsPathInfo
						}
					}, {
						component: this.remoteUriInputBox,
						title: loc.remoteUri,
						required: true,
						layout: {
							info: loc.remoteUriInfo
						}
					}, {
						component: this.credentialsInputBox,
						title: loc.credentials,
						required: false,
						layout: {
							info: loc.credentialsInfo
						}
					}
				],
				title: loc.mountConfiguration
			}];
	}

	protected async validate(): Promise<{ validated: boolean }> {
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
			return { validated: true };
		} catch (error) {
			await this.reportError(error);
			return { validated: false };
		}
	}
}

export class RefreshMountDialog extends HdfsDialogBase<MountHdfsProperties, void> {
	private pathInputBox: azdata.InputBoxComponent;

	constructor(model: RefreshMountModel) {
		super(loc.refreshMount, model);
	}

	protected getMainSectionComponents(): (azdata.FormComponentGroup | azdata.FormComponent)[] {
		this.pathInputBox = this.uiModelBuilder.inputBox()
			.withProperties<azdata.InputBoxProperties>({
				value: this.model.props.hdfsPath
			}).component();
		return [
			{
				components: [
					{
						component: this.pathInputBox,
						title: loc.hdfsPath,
						required: true
					}
				],
				title: loc.mountConfiguration
			}];
	}

	protected async validate(): Promise<{ validated: boolean }> {
		try {
			await this.model.onComplete({
				url: this.urlInputBox && this.urlInputBox.value,
				auth: this.authValue,
				username: this.usernameInputBox && this.usernameInputBox.value,
				password: this.passwordInputBox && this.passwordInputBox.value,
				hdfsPath: this.pathInputBox && this.pathInputBox.value
			});
			return { validated: true };
		} catch (error) {
			await this.reportError(error);
			return { validated: false };
		}
	}
}

export class RefreshMountModel extends HdfsDialogModelBase<MountHdfsProperties, void> {

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
				displayName: loc.refreshMountTask(this.props.hdfsPath),
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
			op.updateStatus(azdata.TaskStatus.Succeeded, loc.refreshMountTaskSubmitted);
		} catch (error) {
			const errMsg = (error instanceof Error) ? error.message : error;
			vscode.window.showErrorMessage(errMsg);
			op.updateStatus(azdata.TaskStatus.Failed, errMsg);
		}
	}
}

export class DeleteMountDialog extends HdfsDialogBase<MountHdfsProperties, void> {
	private pathInputBox: azdata.InputBoxComponent;

	constructor(model: DeleteMountModel) {
		super(loc.deleteMount, model);
	}

	protected getMainSectionComponents(): (azdata.FormComponentGroup | azdata.FormComponent)[] {
		this.pathInputBox = this.uiModelBuilder.inputBox()
			.withProperties<azdata.InputBoxProperties>({
				value: this.model.props.hdfsPath
			}).component();
		return [
			{
				components: [
					{
						component: this.pathInputBox,
						title: loc.hdfsPath,
						required: true
					}
				],
				title: loc.mountConfiguration
			}];
	}

	protected async validate(): Promise<{ validated: boolean }> {
		try {
			await this.model.onComplete({
				url: this.urlInputBox && this.urlInputBox.value,
				auth: this.authValue,
				username: this.usernameInputBox && this.usernameInputBox.value,
				password: this.passwordInputBox && this.passwordInputBox.value,
				hdfsPath: this.pathInputBox && this.pathInputBox.value
			});
			return { validated: true };
		} catch (error) {
			await this.reportError(error);
			return { validated: false };
		}
	}
}

export class DeleteMountModel extends HdfsDialogModelBase<MountHdfsProperties, void> {

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
				displayName: loc.deleteMountTask(this.props.hdfsPath),
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
			op.updateStatus(azdata.TaskStatus.Succeeded, loc.deleteMountTaskSubmitted);
		} catch (error) {
			const errMsg = (error instanceof Error) ? error.message : error;
			vscode.window.showErrorMessage(errMsg);
			op.updateStatus(azdata.TaskStatus.Failed, errMsg);
		}
	}
}
