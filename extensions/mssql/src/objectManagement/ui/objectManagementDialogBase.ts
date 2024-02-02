/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import { generateUuid } from 'vscode-languageclient/lib/utils/uuid';
import * as localizedConstants from '../localizedConstants';
import { refreshNode, refreshParentNode } from '../utils';
import { ObjectManagementViewName, TelemetryActions } from '../constants';
import { TelemetryReporter } from '../../telemetry';
import { getErrorMessage } from '../../utils';
import { deepClone, equals } from '../../util/objects';
import { ScriptableDialogBase, ScriptableDialogOptions } from '../../ui/scriptableDialogBase';


function getDialogName(type: ObjectManagement.NodeType, isNewObject: boolean): string {
	return isNewObject ? `New${type}` : `${type}Properties`
}

export interface ObjectManagementDialogOptions extends ScriptableDialogOptions {
	connectionUri: string;
	database?: string;
	objectType: ObjectManagement.NodeType;
	isNewObject: boolean;
	parentUrn?: string;
	objectUrn?: string;
	objectName?: string;
}

export abstract class ObjectManagementDialogBase<ObjectInfoType extends ObjectManagement.SqlObject, ViewInfoType extends ObjectManagement.ObjectViewInfo<ObjectInfoType>> extends ScriptableDialogBase<ObjectManagementDialogOptions> {
	private readonly _contextId: string;
	private _viewInfo: ViewInfoType;
	private _originalObjectInfo: ObjectInfoType;

	constructor(protected readonly objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions, dialogTitle?: string, dialogName?: string) {
		if (!dialogTitle) {
			dialogTitle = options.isNewObject
				? localizedConstants.NewObjectDialogTitle(localizedConstants.getNodeTypeDisplayName(options.objectType, true))
				: localizedConstants.ObjectPropertiesDialogTitle(localizedConstants.getNodeTypeDisplayName(options.objectType, true), options.objectName);
		}
		if (!dialogName) {
			dialogName = getDialogName(options.objectType, options.isNewObject);
		}
		super(dialogTitle, dialogName, options);
		this._contextId = generateUuid();
		this.dialogObject.okButton.label = options.isNewObject ? localizedConstants.CreateObjectLabel : localizedConstants.ApplyUpdatesLabel;
	}

	protected postInitializeData(): void { }

	protected override async validateInput(): Promise<string[]> {
		const errors: string[] = [];
		if (!this.objectInfo.name) {
			errors.push(localizedConstants.NameCannotBeEmptyError);
		}
		return errors;
	}

	protected async saveChanges(contextId: string, object: ObjectManagement.SqlObject): Promise<void> {
		await this.objectManagementService.save(this._contextId, this.objectInfo);
	}

	protected get saveChangesTaskLabel(): string {
		const typeDisplayName = localizedConstants.getNodeTypeDisplayName(this.options.objectType);
		return this.options.isNewObject ? localizedConstants.CreateObjectOperationDisplayName(typeDisplayName)
			: localizedConstants.UpdateObjectOperationDisplayName(typeDisplayName, this.options.objectName);
	}

	protected get actionName(): string {
		return this.options.isNewObject ? TelemetryActions.CreateObject : TelemetryActions.UpdateObject;
	}

	/**
	 * Whether to start a background task after clicking OK in the dialog. Some operations, like Backup & Restore,
	 * start their own background tasks, and so don't need one started directly from the dialog.
	 */
	protected get startTaskOnApply(): boolean {
		return true;
	}

	private async saveChangesAndRefresh(operation?: azdata.BackgroundOperation): Promise<void> {
		try {
			if (this.isDirty) {
				const startTime = Date.now();
				await this.saveChanges(this._contextId, this.objectInfo);
				if (this.options.objectExplorerContext) {
					if (this.options.isNewObject) {
						await refreshNode(this.options.objectExplorerContext);
					} else {
						// For edit mode, the node context is the object itself, we need to refresh the parent node to reflect the changes.
						await refreshParentNode(this.options.objectExplorerContext);
					}
				}

				TelemetryReporter.sendTelemetryEvent(this.actionName, {
					objectType: this.options.objectType
				}, {
					elapsedTimeMs: Date.now() - startTime
				});
				if (operation) {
					operation.updateStatus(azdata.TaskStatus.Succeeded);
				}
			}
		}
		catch (err) {
			if (operation) {
				operation.updateStatus(azdata.TaskStatus.Failed, getErrorMessage(err));
			}
			TelemetryReporter.createErrorEvent2(ObjectManagementViewName, this.actionName, err).withAdditionalProperties({
				objectType: this.options.objectType
			}).send();
		} finally {
			await this.disposeView();
		}
	}

	protected override async handleDialogClosed(reason: azdata.window.CloseReason): Promise<any> {
		if (reason === 'ok') {
			if (this.startTaskOnApply) {
				azdata.tasks.startBackgroundOperation({
					displayName: this.saveChangesTaskLabel,
					description: '',
					isCancelable: false,
					operation: async (operation: azdata.BackgroundOperation): Promise<void> => {
						await this.saveChangesAndRefresh(operation);
					}
				});
			} else {
				await this.saveChangesAndRefresh();
			}
		}
		let result = await super.handleDialogClosed(reason);
		return result;
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

	protected override async initializeData(): Promise<void> {
		const viewInfo = await this.objectManagementService.initializeView(this._contextId, this.options.objectType, this.options.connectionUri, this.options.database, this.options.isNewObject, this.options.parentUrn, this.options.objectUrn);
		this._viewInfo = viewInfo as ViewInfoType;
		this.postInitializeData();
		this._originalObjectInfo = deepClone(this.objectInfo);
	}

	protected override async generateScript(): Promise<string> {
		return await this.objectManagementService.script(this._contextId, this.objectInfo);
	}

	protected get isDirty(): boolean {
		return !equals(this.objectInfo, this._originalObjectInfo, false);
	}
}
