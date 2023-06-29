/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
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
	parentUrn: string;
	objectUrn?: string;
	objectExplorerContext?: azdata.ObjectExplorerContext;
	objectName?: string;
	serverInfo?: azdata.ServerInfo
}

export abstract class ObjectManagementDialogBase<ObjectInfoType extends ObjectManagement.SqlObject, ViewInfoType extends ObjectManagement.ObjectViewInfo<ObjectInfoType>> extends ScriptableDialogBase<ObjectManagementDialogOptions> {
	private _contextId: string;
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

	protected override async initialize(): Promise<void> {
		await super.initialize();
		const typeDisplayName = localizedConstants.getNodeTypeDisplayName(this.options.objectType);
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
						await this.saveChanges(this._contextId, this.objectInfo);
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
