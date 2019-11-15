/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { ClusterController, ControllerError, IEndPointsResponse } from '../controller/clusterControllerApi';
import { AuthType } from '../constants';
import { Deferred } from '../../common/promise';

const localize = nls.loadMessageBundle();

const basicAuthDisplay = localize('basicAuthName', "Basic");
const integratedAuthDisplay = localize('integratedAuthName', "Windows Authentication");

function getAuthCategory(name: AuthType): azdata.CategoryValue {
	if (name === 'basic') {
		return { name: name, displayName: basicAuthDisplay };
	}
	return { name: name, displayName: integratedAuthDisplay };
}

export interface HdfsDialogProperties {
	url?: string;
	auth?: AuthType;
	username?: string;
	password?: string;
}

export class HdfsDialogCancelledError extends Error {
	constructor(message: string = 'Dialog cancelled') {
		super(message);
	}
}

export abstract class HdfsDialogModelBase<T extends HdfsDialogProperties, R> {
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

	public async onComplete(props: T): Promise<R | undefined> {
		try {
			this.props = props;
			return await this.handleCompleted();
		} catch (error) {
			// Ignore the error if we cancelled the request since we can't stop the actual request from completing
			if (!this._canceled) {
				throw error;
			}
			return undefined;
		}
	}

	protected abstract handleCompleted(): Promise<R>;

	public async onError(error: ControllerError): Promise<void> {
		// implement
	}

	public async onCancel(): Promise<void> {
		this._canceled = true;
	}

	protected createController(): ClusterController {
		return new ClusterController(this.props.url, this.props.auth, this.props.username, this.props.password);
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
			throw new Error(localize('mount.hdfs.loginerror2', "Login to controller failed: {0}", err.statusMessage || err.message));
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

export abstract class HdfsDialogBase<T extends HdfsDialogProperties, R> {

	protected dialog: azdata.window.Dialog;
	protected uiModelBuilder!: azdata.ModelBuilder;

	protected urlInputBox!: azdata.InputBoxComponent;
	protected authDropdown!: azdata.DropDownComponent;
	protected usernameInputBox!: azdata.InputBoxComponent;
	protected passwordInputBox!: azdata.InputBoxComponent;

	private returnPromise: Deferred<R>;

	constructor(private title: string, protected model: HdfsDialogModelBase<T, R>) {
	}

	public async showDialog(): Promise<R> {
		this.returnPromise = new Deferred<R>();
		this.createDialog();
		azdata.window.openDialog(this.dialog);
		return this.returnPromise.promise;
	}

	private createDialog(): void {
		this.dialog = azdata.window.createModelViewDialog(this.title);
		this.dialog.registerContent(async view => {
			this.uiModelBuilder = view.modelBuilder;

			this.urlInputBox = this.uiModelBuilder.inputBox()
				.withProperties<azdata.InputBoxProperties>({
					placeHolder: localize('textUrlLower', "url"),
					value: this.model.props.url,
					enabled: false
				}).component();

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
						title: localize('textUrlCapital', "Cluster Management URL"),
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
				.withFormItems(
					this.getMainSectionComponents().concat(
						connectionSection)
				).withLayout({ width: '100%' }).component();

			await view.initializeModel(formModel);
			this.onAuthChanged();
		});

		this.dialog.registerCloseValidator(async () => {
			const result = await this.validate();
			if (result.validated) {
				this.returnPromise.resolve(result.value);
				this.returnPromise = undefined;
			}
			return result.validated;
		});
		this.dialog.cancelButton.onClick(async () => await this.cancel());
		this.dialog.okButton.label = localize('hdfs.dialog.ok', "OK");
		this.dialog.cancelButton.label = localize('hdfs.dialog.cancel', "Cancel");
	}

	protected abstract getMainSectionComponents(): (azdata.FormComponentGroup | azdata.FormComponent)[];

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

	protected abstract validate(): Promise<{ validated: boolean, value?: R }>;

	private async cancel(): Promise<void> {
		if (this.model && this.model.onCancel) {
			await this.model.onCancel();
		}
		this.returnPromise.reject(new HdfsDialogCancelledError());
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
