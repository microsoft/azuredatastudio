/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ControllerInfo, ResourceInfo } from 'arc';
import * as azdata from 'azdata';
import * as azdataExt from 'azdata-ext';
import { v4 as uuid } from 'uuid';
import * as vscode from 'vscode';
import { Deferred } from '../../common/promise';
import * as loc from '../../localizedConstants';
import { ControllerModel } from '../../models/controllerModel';
import { InitializingComponent } from '../components/initializingComponent';
import { AzureArcTreeDataProvider } from '../tree/azureArcTreeDataProvider';
import { getErrorMessage } from '../../common/utils';
import { RadioOptionsGroup } from '../components/radioOptionsGroup';
import { getCurrentClusterContext, getDefaultKubeConfigPath, getKubeConfigClusterContexts, KubeClusterContext } from '../../common/kubeUtils';
import { FilePicker } from '../components/filePicker';

export type ConnectToControllerDialogModel = { controllerModel: ControllerModel, password: string };

abstract class ControllerDialogBase extends InitializingComponent {
	protected _toDispose: vscode.Disposable[] = [];
	protected modelBuilder!: azdata.ModelBuilder;
	protected dialog: azdata.window.Dialog;

	protected namespaceInputBox!: azdata.InputBoxComponent;
	protected kubeConfigInputBox!: FilePicker;
	protected clusterContextRadioGroup!: RadioOptionsGroup;
	protected nameInputBox!: azdata.InputBoxComponent;
	protected usernameInputBox!: azdata.InputBoxComponent;
	protected passwordInputBox!: azdata.InputBoxComponent;
	protected urlInputBox!: azdata.InputBoxComponent;

	private _kubeClusters: KubeClusterContext[] = [];

	protected dispose(): void {
		this._toDispose.forEach(disposable => disposable.dispose());
		this._toDispose.length = 0;
	}

	protected getComponents(): (azdata.FormComponent<azdata.Component> & { layout?: azdata.FormItemLayout | undefined; })[] {
		return [
			{
				component: this.namespaceInputBox,
				title: loc.namespace,
				required: true
			},
			{
				component: this.urlInputBox,
				title: loc.controllerUrl,
				layout: {
					info: loc.controllerUrlDescription
				}
			}, {
				component: this.kubeConfigInputBox.component(),
				title: loc.controllerKubeConfig,
				required: true
			}, {
				component: this.clusterContextRadioGroup.component(),
				title: loc.controllerClusterContext,
				required: true
			}, {
				component: this.nameInputBox,
				title: loc.controllerName,
				required: false,
				layout: {
					info: loc.controllerNameDescription
				}
			}, {
				component: this.usernameInputBox,
				title: loc.controllerUsername,
				required: true
			}, {
				component: this.passwordInputBox,
				title: loc.controllerPassword,
				required: true
			}
		];
	}

	protected abstract fieldToFocusOn(): azdata.Component;
	protected readonlyFields(): azdata.Component[] { return []; }

	protected initializeFields(controllerInfo: ControllerInfo | undefined, password: string | undefined) {
		this.namespaceInputBox = this.modelBuilder.inputBox()
			.withProps({
				value: controllerInfo?.namespace,
			}).component();
		this.urlInputBox = this.modelBuilder.inputBox()
			.withProps({
				value: controllerInfo?.endpoint,
				placeHolder: loc.controllerUrlPlaceholder,
			}).component();
		this.kubeConfigInputBox = new FilePicker(
			this.modelBuilder,
			controllerInfo?.kubeConfigFilePath || getDefaultKubeConfigPath(),
			(disposable) => this._toDispose.push(disposable),
			loc.controllerKubeConfig,
			loc.invalidConfigPath,
			true
		);
		this.modelBuilder.inputBox()
			.withProps({
				value: controllerInfo?.kubeConfigFilePath || getDefaultKubeConfigPath()
			}).component();
		this.clusterContextRadioGroup = new RadioOptionsGroup(this.modelBuilder, (disposable) => this._toDispose.push(disposable), undefined, loc.loadingClusterContextCompleted, loc.loadingClusterContextsError);
		this.loadRadioGroup(controllerInfo?.kubeClusterContext);
		this._toDispose.push(this.clusterContextRadioGroup.onRadioOptionChanged(newContext => this.updateNamespace(newContext)));
		this._toDispose.push(this.kubeConfigInputBox.onTextChanged(() => this.loadRadioGroup(controllerInfo?.kubeClusterContext)));
		this.nameInputBox = this.modelBuilder.inputBox()
			.withProps({
				value: controllerInfo?.name
			}).component();
		this.usernameInputBox = this.modelBuilder.inputBox()
			.withProps({
				value: controllerInfo?.username
			}).component();
		this.passwordInputBox = this.modelBuilder.inputBox()
			.withProps({
				inputType: 'password',
				value: password
			}).component();
	}

	protected completionPromise = new Deferred<ConnectToControllerDialogModel | undefined>();
	protected id!: string;
	protected resources: ResourceInfo[] = [];

	constructor(protected treeDataProvider: AzureArcTreeDataProvider, title: string) {
		super();
		this.dialog = azdata.window.createModelViewDialog(title);
	}

	private loadRadioGroup(previousClusterContext?: string): void {
		this.clusterContextRadioGroup.load(() => {
			this._kubeClusters = getKubeConfigClusterContexts(this.kubeConfigInputBox.value!);
			const currentClusterContext = getCurrentClusterContext(this._kubeClusters, previousClusterContext, false);
			this.namespaceInputBox.value = currentClusterContext.namespace || this.namespaceInputBox.value;
			return {
				values: this._kubeClusters.map(c => c.name),
				defaultValue: currentClusterContext.name
			};
		});
	}

	private updateNamespace(currentContextName: string | undefined): void {
		const currentContext = this._kubeClusters.find(cluster => cluster.name === currentContextName);
		this.namespaceInputBox.value = currentContext?.namespace;
	}

	public showDialog(controllerInfo?: ControllerInfo, password: string | undefined = undefined): azdata.window.Dialog {
		this.id = controllerInfo?.id ?? uuid();
		this.resources = controllerInfo?.resources ?? [];
		this._toDispose.push(this.dialog.cancelButton.onClick(() => this.handleCancel()));
		this.dialog.registerContent(async (view) => {
			this.modelBuilder = view.modelBuilder;
			this.initializeFields(controllerInfo, password);

			let formModel = this.modelBuilder.formContainer()
				.withFormItems([{
					components: this.getComponents(),
					title: ''
				}]).withLayout({ width: '100%' }).component();
			await view.initializeModel(formModel);
			await this.fieldToFocusOn().focus();
			this.readonlyFields().forEach(f => f.enabled = false);
			this.initialized = true;
		});

		this.dialog.registerCloseValidator(async () => {
			const isValidated = await this.validate();
			if (isValidated) {
				this.dispose();
			}
			return isValidated;
		});
		this.dialog.okButton.label = loc.connect;
		this.dialog.cancelButton.label = loc.cancel;
		azdata.window.openDialog(this.dialog);
		return this.dialog;
	}

	public abstract validate(): Promise<boolean>;

	private handleCancel(): void {
		this.completionPromise.resolve(undefined);
	}

	public waitForClose(): Promise<ConnectToControllerDialogModel | undefined> {
		return this.completionPromise.promise;
	}

	protected getControllerInfo(url: string, rememberPassword: boolean = false): ControllerInfo {
		return {
			id: this.id,
			endpoint: url || undefined,
			namespace: this.namespaceInputBox.value!.trim(),
			kubeConfigFilePath: this.kubeConfigInputBox.value!,
			kubeClusterContext: this.clusterContextRadioGroup.value!,
			name: this.nameInputBox.value ?? '',
			username: this.usernameInputBox.value!,
			rememberPassword: rememberPassword,
			resources: this.resources
		};
	}
}

export class ConnectToControllerDialog extends ControllerDialogBase {
	protected rememberPwCheckBox!: azdata.CheckBoxComponent;

	protected fieldToFocusOn() {
		return this.namespaceInputBox;
	}

	protected override getComponents() {
		return [
			...super.getComponents(),
			{
				component: this.rememberPwCheckBox,
				title: ''
			}];
	}

	protected override initializeFields(controllerInfo: ControllerInfo | undefined, password: string | undefined) {
		super.initializeFields(controllerInfo, password);
		this.rememberPwCheckBox = this.modelBuilder.checkBox()
			.withProps({
				label: loc.rememberPassword,
				checked: controllerInfo?.rememberPassword
			}).component();
	}

	constructor(treeDataProvider: AzureArcTreeDataProvider) {
		super(treeDataProvider, loc.connectToController);
	}

	public async validate(): Promise<boolean> {
		if (!this.namespaceInputBox.value || !this.usernameInputBox.value || !this.passwordInputBox.value) {
			return false;
		}
		let url = this.urlInputBox.value?.trim() || '';
		if (url) {
			// Only support https connections
			if (url.toLowerCase().startsWith('http://')) {
				url = url.replace('http', 'https');
			}
			// Append https if they didn't type it in
			if (!url.toLowerCase().startsWith('https://')) {
				url = `https://${url}`;
			}
			// Append default port if one wasn't specified
			if (!/.*:\d*$/.test(url)) {
				url = `${url}:30080`;
			}
		}

		const controllerInfo: ControllerInfo = this.getControllerInfo(url, !!this.rememberPwCheckBox.checked);
		const controllerModel = new ControllerModel(this.treeDataProvider, controllerInfo, this.passwordInputBox.value);
		try {
			// Validate that we can connect to the controller, this also populates the controllerRegistration from the connection response.
			await controllerModel.refresh(false);
			// default info.name to the name of the controller instance if the user did not specify their own and to a pre-canned default if for some weird reason controller endpoint returned instanceName is also not a valid value
			controllerModel.info.name = controllerModel.info.name || controllerModel.controllerConfig?.metadata.name || loc.defaultControllerName;
		} catch (err) {
			this.dialog.message = {
				text: loc.connectToControllerFailed(this.namespaceInputBox.value, err),
				level: azdata.window.MessageLevel.Error
			};
			return false;
		}
		this.completionPromise.resolve({ controllerModel: controllerModel, password: this.passwordInputBox.value });
		return true;
	}
}
export class PasswordToControllerDialog extends ControllerDialogBase {

	constructor(treeDataProvider: AzureArcTreeDataProvider) {
		super(treeDataProvider, loc.passwordToController);
	}

	protected fieldToFocusOn() {
		return this.passwordInputBox;
	}

	protected override readonlyFields(): azdata.Component[] {
		return [
			this.urlInputBox,
			...this.kubeConfigInputBox.items,
			...this.clusterContextRadioGroup.items,
			this.nameInputBox,
			this.usernameInputBox
		];
	}

	public async validate(): Promise<boolean> {
		if (!this.passwordInputBox.value) {
			return false;
		}
		const controllerInfo: ControllerInfo = this.getControllerInfo(this.urlInputBox.value!, false);
		const controllerModel = new ControllerModel(this.treeDataProvider, controllerInfo, this.passwordInputBox.value);
		const azdataApi = <azdataExt.IExtension>vscode.extensions.getExtension(azdataExt.extension.name)?.exports;
		try {
			await azdataApi.azdata.login(
				{
					endpoint: controllerInfo.endpoint,
					namespace: controllerInfo.namespace
				},
				controllerInfo.username,
				this.passwordInputBox.value,
				{
					'KUBECONFIG': this.kubeConfigInputBox.value!,
					'KUBECTL_CONTEXT': this.clusterContextRadioGroup.value!
				}
			);
		} catch (e) {
			if (getErrorMessage(e).match(/Wrong username or password/i)) {
				this.dialog.message = {
					text: loc.loginFailed,
					level: azdata.window.MessageLevel.Error
				};
				return false;
			} else {
				this.dialog.message = {
					text: loc.errorVerifyingPassword(e),
					level: azdata.window.MessageLevel.Error
				};
				return false;
			}
		}
		this.completionPromise.resolve({ controllerModel: controllerModel, password: this.passwordInputBox.value });
		return true;
	}

	public override showDialog(controllerInfo?: ControllerInfo): azdata.window.Dialog {
		const dialog = super.showDialog(controllerInfo);
		dialog.okButton.label = loc.ok;
		return dialog;
	}
}


