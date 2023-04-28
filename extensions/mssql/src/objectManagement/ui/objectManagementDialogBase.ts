/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import * as vscode from 'vscode';
import { generateUuid } from 'vscode-languageclient/lib/utils/uuid';
import * as localizedConstants from '../localizedConstants';
import { deepClone, getNodeTypeDisplayName, refreshNode, refreshParentNode } from '../utils';
import { DialogBase } from './dialogBase';
import { ObjectManagementViewName, TelemetryActions } from '../constants';
import { TelemetryReporter } from '../../telemetry';
import { getErrorMessage } from '../../utils';
import { providerId } from '../../constants';
import { equals } from '../../util/objects';


function getDialogName(type: ObjectManagement.NodeType, isNewObject: boolean): string {
	return isNewObject ? `New${type}` : `${type}Properties`
}

export interface ObjectManagementDialogOptions {
	connectionUri: string;
	database?: string;
	objectType: ObjectManagement.NodeType;
	isNewObject: boolean;
	parentUrn: string;
	objectUrn?: string;
	objectExplorerContext?: azdata.ObjectExplorerContext;
	width?: azdata.window.DialogWidth;
	objectName?: string;
}

export abstract class ObjectManagementDialogBase<ObjectInfoType extends ObjectManagement.SqlObject, ViewInfoType extends ObjectManagement.ObjectViewInfo<ObjectInfoType>> extends DialogBase<void> {
	private _contextId: string;
	private _viewInfo: ViewInfoType;
	private _originalObjectInfo: ObjectInfoType;
	private _helpButton: azdata.window.Button;
	private _scriptButton: azdata.window.Button;

	constructor(protected readonly objectManagementService: IObjectManagementService, protected readonly options: ObjectManagementDialogOptions) {
		super(options.isNewObject ? localizedConstants.NewObjectDialogTitle(getNodeTypeDisplayName(options.objectType, true)) :
			localizedConstants.ObjectPropertiesDialogTitle(getNodeTypeDisplayName(options.objectType, true), options.objectName),
			getDialogName(options.objectType, options.isNewObject),
			options.width || 'narrow', 'flyout'
		);
		this._helpButton = azdata.window.createButton(localizedConstants.HelpText, 'left');
		this.disposables.push(this._helpButton.onClick(async () => {
			await vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(this.docUrl));
		}));
		this._scriptButton = azdata.window.createButton(localizedConstants.ScriptText, 'left');
		this.disposables.push(this._scriptButton.onClick(async () => { await this.onScriptButtonClick(); }));
		this.dialogObject.customButtons = [this._helpButton, this._scriptButton];
		this._contextId = generateUuid();
	}

	protected abstract initializeUI(): Promise<void>;

	protected abstract get docUrl(): string;

	protected postInitializeData(): void { }

	protected override onFormFieldChange(): void {
		this._scriptButton.enabled = this.isDirty;
		this.dialogObject.okButton.enabled = this.isDirty;
	}

	protected override async validateInput(): Promise<string[]> {
		const errors: string[] = [];
		if (!this.objectInfo.name) {
			errors.push(localizedConstants.NameCannotBeEmptyError);
		}
		return errors;
	}

	protected override async initialize(): Promise<void> {
		await this.initializeData();
		await this.initializeUI();
		const typeDisplayName = getNodeTypeDisplayName(this.options.objectType);
		this.dialogObject.registerOperation({
			displayName: this.options.isNewObject ? localizedConstants.CreateObjectOperationDisplayName(typeDisplayName)
				: localizedConstants.UpdateObjectOperationDisplayName(typeDisplayName, this.options.objectName),
			description: '',
			isCancelable: false,
			operation: async (operation: azdata.BackgroundOperation): Promise<void> => {
				const actionName = this.options.isNewObject ? TelemetryActions.CreateObject : TelemetryActions.UpdateObject;
				try {
					if (this.isDirty) {
						const startTime = Date.now();
						await this.objectManagementService.save(this._contextId, this.objectInfo);
						if (this.options.objectExplorerContext) {
							if (this.options.isNewObject) {
								await refreshNode(this.options.objectExplorerContext);
							} else {
								// For edit mode, the node context is the object itself, we need to refresh the parent node to reflect the changes.
								await refreshParentNode(this.options.objectExplorerContext);
							}
						}

						TelemetryReporter.sendTelemetryEvent(actionName, {
							objectType: this.options.objectType
						}, {
							elapsedTimeMs: Date.now() - startTime
						});
						operation.updateStatus(azdata.TaskStatus.Succeeded);
					}
				}
				catch (err) {
					operation.updateStatus(azdata.TaskStatus.Failed, getErrorMessage(err));
					TelemetryReporter.createErrorEvent2(ObjectManagementViewName, actionName, err).withAdditionalProperties({
						objectType: this.options.objectType
					}).send();
				} finally {
					await this.disposeView();
				}
			}
		});
	}

	protected get viewInfo(): ViewInfoType {
		return this._viewInfo;
	}

	protected get objectInfo(): ObjectInfoType {
		return this._viewInfo.objectInfo;
	}

	protected get originalObjectInfo(): ObjectInfoType {
		return this._originalObjectInfo;
	}

	protected get contextId(): string {
		return this._contextId;
	}

	protected override async dispose(reason: azdata.window.CloseReason): Promise<void> {
		await super.dispose(reason);
		if (reason !== 'ok') {
			await this.disposeView();
		}
	}

	private async disposeView(): Promise<void> {
		await this.objectManagementService.disposeView(this._contextId);
	}

	private async initializeData(): Promise<void> {
		const viewInfo = await this.objectManagementService.initializeView(this._contextId, this.options.objectType, this.options.connectionUri, this.options.database, this.options.isNewObject, this.options.parentUrn, this.options.objectUrn);
		this._viewInfo = viewInfo as ViewInfoType;
		this.postInitializeData();
		this._originalObjectInfo = deepClone(this.objectInfo);
	}

	protected override onLoadingStatusChanged(isLoading: boolean): void {
		super.onLoadingStatusChanged(isLoading);
		this._helpButton.enabled = !isLoading;
		this.dialogObject.okButton.enabled = this._scriptButton.enabled = isLoading ? false : this.isDirty;
	}

	private async onScriptButtonClick(): Promise<void> {
		this.onLoadingStatusChanged(true);
		try {
			const isValid = await this.runValidation();
			if (!isValid) {
				return;
			}
			let message: string;
			const script = await this.objectManagementService.script(this._contextId, this.objectInfo);
			if (script) {
				message = localizedConstants.ScriptGeneratedText;
				await azdata.queryeditor.openQueryDocument({ content: script }, providerId);
			} else {
				message = localizedConstants.NoActionScriptedMessage;
			}
			this.dialogObject.message = {
				text: message,
				level: azdata.window.MessageLevel.Information
			};
		} catch (err) {
			this.dialogObject.message = {
				text: localizedConstants.ScriptError(getErrorMessage(err)),
				level: azdata.window.MessageLevel.Error
			};
		} finally {
			this.onLoadingStatusChanged(false);
		}
	}

	private get isDirty(): boolean {
		return !equals(this.objectInfo, this._originalObjectInfo, false);
	}
}
