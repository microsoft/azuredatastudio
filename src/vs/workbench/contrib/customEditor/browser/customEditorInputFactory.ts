/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import { Schemas } from 'vs/base/common/network';
import { isEqual } from 'vs/base/common/resources';
import { URI, UriComponents } from 'vs/base/common/uri';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { CustomEditorInput } from 'vs/workbench/contrib/customEditor/browser/customEditorInput';
import { ICustomEditorService } from 'vs/workbench/contrib/customEditor/common/customEditor';
import { NotebookEditorInput } from 'vs/workbench/contrib/notebook/common/notebookEditorInput';
import { IWebviewService, WebviewContentOptions, WebviewContentPurpose, WebviewExtensionDescription, WebviewOptions } from 'vs/workbench/contrib/webview/browser/webview';
import { DeserializedWebview, restoreWebviewContentOptions, restoreWebviewOptions, reviveWebviewExtensionDescription, SerializedWebview, SerializedWebviewOptions, WebviewEditorInputSerializer } from 'vs/workbench/contrib/webviewPanel/browser/webviewEditorInputSerializer';
import { IWebviewWorkbenchService } from 'vs/workbench/contrib/webviewPanel/browser/webviewWorkbenchService';
import { IEditorResolverService } from 'vs/workbench/services/editor/common/editorResolverService';
import { IWorkingCopyBackupMeta } from 'vs/workbench/services/workingCopy/common/workingCopy';
import { IWorkingCopyBackupService } from 'vs/workbench/services/workingCopy/common/workingCopyBackup';
import { IWorkingCopyEditorService } from 'vs/workbench/services/workingCopy/common/workingCopyEditorService';

export interface CustomDocumentBackupData extends IWorkingCopyBackupMeta {
	readonly viewType: string;
	readonly editorResource: UriComponents;
	backupId: string;

	readonly extension: undefined | {
		readonly location: UriComponents;
		readonly id: string;
	};

	readonly webview: {
		readonly id: string;
		readonly options: SerializedWebviewOptions;
		readonly state: any;
	};
}

interface SerializedCustomEditor extends SerializedWebview {
	readonly editorResource: UriComponents;
	readonly dirty: boolean;
	readonly backupId?: string;
}

interface DeserializedCustomEditor extends DeserializedWebview {
	readonly editorResource: URI;
	readonly dirty: boolean;
	readonly backupId?: string;
}

export class CustomEditorInputSerializer extends WebviewEditorInputSerializer {

	public static override readonly ID = CustomEditorInput.typeId;

	public constructor(
		@IWebviewWorkbenchService webviewWorkbenchService: IWebviewWorkbenchService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IWebviewService private readonly _webviewService: IWebviewService,
		@IEditorResolverService private readonly _editorResolverService: IEditorResolverService
	) {
		super(webviewWorkbenchService);
	}

	public override serialize(input: CustomEditorInput): string | undefined {
		const dirty = input.isDirty();
		const data: SerializedCustomEditor = {
			...this.toJson(input),
			editorResource: input.resource.toJSON(),
			dirty,
			backupId: dirty ? input.backupId : undefined,
		};

		try {
			return JSON.stringify(data);
		} catch {
			return undefined;
		}
	}

	protected override fromJson(data: SerializedCustomEditor): DeserializedCustomEditor {
		return {
			...super.fromJson(data),
			editorResource: URI.from(data.editorResource),
			dirty: data.dirty,
		};
	}

	public override deserialize(
		_instantiationService: IInstantiationService,
		serializedEditorInput: string
	): CustomEditorInput {
		const data = this.fromJson(JSON.parse(serializedEditorInput));
		if (data.viewType === 'jupyter.notebook.ipynb') {
			const editorAssociation = this._editorResolverService.getAssociationsForResource(data.editorResource);
			if (!editorAssociation.find(association => association.viewType === 'jupyter.notebook.ipynb')) {
				return NotebookEditorInput.create(this._instantiationService, data.editorResource, 'jupyter-notebook', { _backupId: data.backupId, startDirty: data.dirty }) as any;
			}
		}

		const webview = reviveWebview(this._webviewService, data);
		const customInput = this._instantiationService.createInstance(CustomEditorInput, data.editorResource, data.viewType, data.id, webview, { startsDirty: data.dirty, backupId: data.backupId });
		if (typeof data.group === 'number') {
			customInput.updateGroup(data.group);
		}
		return customInput;
	}
}

function reviveWebview(webviewService: IWebviewService, data: { id: string, state: any, webviewOptions: WebviewOptions, contentOptions: WebviewContentOptions, extension?: WebviewExtensionDescription, }) {
	const webview = webviewService.createWebviewOverlay(data.id, {
		purpose: WebviewContentPurpose.CustomEditor,
		enableFindWidget: data.webviewOptions.enableFindWidget,
		retainContextWhenHidden: data.webviewOptions.retainContextWhenHidden
	}, data.contentOptions, data.extension);
	webview.state = data.state;
	return webview;
}

export class ComplexCustomWorkingCopyEditorHandler extends Disposable implements IWorkbenchContribution {

	constructor(
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IWorkingCopyEditorService private readonly _workingCopyEditorService: IWorkingCopyEditorService,
		@IWorkingCopyBackupService private readonly _workingCopyBackupService: IWorkingCopyBackupService,
		@IEditorResolverService private readonly _editorResolverService: IEditorResolverService,
		@IWebviewService private readonly _webviewService: IWebviewService,
		@ICustomEditorService _customEditorService: ICustomEditorService // DO NOT REMOVE (needed on startup to register overrides properly)
	) {
		super();

		this._installHandler();
	}

	private _installHandler(): void {
		this._register(this._workingCopyEditorService.registerHandler({
			handles: workingCopy => workingCopy.resource.scheme === Schemas.vscodeCustomEditor,
			isOpen: (workingCopy, editor) => {
				if (workingCopy.resource.authority === 'jupyter-notebook-ipynb' && editor instanceof NotebookEditorInput) {
					try {
						const data = JSON.parse(workingCopy.resource.query);
						const workingCopyResource = URI.from(data);
						return isEqual(workingCopyResource, editor.resource);
					} catch {
						return false;
					}
				}
				if (!(editor instanceof CustomEditorInput)) {
					return false;
				}

				if (workingCopy.resource.authority !== editor.viewType.replace(/[^a-z0-9\-_]/gi, '-').toLowerCase()) {
					return false;
				}

				// The working copy stores the uri of the original resource as its query param
				try {
					const data = JSON.parse(workingCopy.resource.query);
					const workingCopyResource = URI.from(data);
					return isEqual(workingCopyResource, editor.resource);
				} catch {
					return false;
				}
			},
			createEditor: async workingCopy => {
				const backup = await this._workingCopyBackupService.resolve<CustomDocumentBackupData>(workingCopy);
				if (!backup?.meta) {
					throw new Error(`No backup found for custom editor: ${workingCopy.resource}`);
				}

				const backupData = backup.meta;
				if (backupData.viewType === 'jupyter.notebook.ipynb') {
					const editorAssociation = this._editorResolverService.getAssociationsForResource(URI.revive(backupData.editorResource));
					if (!editorAssociation.find(association => association.viewType === 'jupyter.notebook.ipynb')) {
						return NotebookEditorInput.create(this._instantiationService, URI.revive(backupData.editorResource), 'jupyter-notebook', { startDirty: !!backupData.backupId, _backupId: backupData.backupId, _workingCopy: workingCopy }) as any;
					}
				}

				const id = backupData.webview.id;
				const extension = reviveWebviewExtensionDescription(backupData.extension?.id, backupData.extension?.location);
				const webview = reviveWebview(this._webviewService, {
					id,
					webviewOptions: restoreWebviewOptions(backupData.webview.options),
					contentOptions: restoreWebviewContentOptions(backupData.webview.options),
					state: backupData.webview.state,
					extension,
				});

				const editor = this._instantiationService.createInstance(CustomEditorInput, URI.revive(backupData.editorResource), backupData.viewType, id, webview, { backupId: backupData.backupId });
				editor.updateGroup(0);
				return editor;
			}
		}));
	}
}

