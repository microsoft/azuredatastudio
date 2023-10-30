/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { onUnexpectedError } from 'vs/base/common/errors';
import { Event } from 'vs/base/common/event';
import { Disposable, DisposableMap } from 'vs/base/common/lifecycle';
import { URI } from 'vs/base/common/uri';
import { generateUuid } from 'vs/base/common/uuid';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { MainThreadWebviews, reviveWebviewContentOptions, reviveWebviewExtension } from 'vs/workbench/api/browser/mainThreadWebviews';
import * as extHostProtocol from 'vs/workbench/api/common/extHost.protocol';
import { DiffEditorInput } from 'vs/workbench/common/editor/diffEditorInput';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { ExtensionKeyedWebviewOriginStore, WebviewOptions } from 'vs/workbench/contrib/webview/browser/webview';
import { WebviewInput } from 'vs/workbench/contrib/webviewPanel/browser/webviewEditorInput';
import { WebviewIcons } from 'vs/workbench/contrib/webviewPanel/browser/webviewIconManager';
import { IWebViewShowOptions, IWebviewWorkbenchService } from 'vs/workbench/contrib/webviewPanel/browser/webviewWorkbenchService';
import { editorGroupToColumn } from 'vs/workbench/services/editor/common/editorGroupColumn';
import { GroupLocation, GroupsOrder, IEditorGroup, IEditorGroupsService, preferredSideBySideGroupDirection } from 'vs/workbench/services/editor/common/editorGroupsService';
import { ACTIVE_GROUP, IEditorService, PreferredGroup, SIDE_GROUP } from 'vs/workbench/services/editor/common/editorService';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IExtHostContext } from 'vs/workbench/services/extensions/common/extHostCustomers';

/**
 * Bi-directional map between webview handles and inputs.
 */
class WebviewInputStore {
	private readonly _handlesToInputs = new Map<string, WebviewInput>();
	private readonly _inputsToHandles = new Map<WebviewInput, string>();

	public add(handle: string, input: WebviewInput): void {
		this._handlesToInputs.set(handle, input);
		this._inputsToHandles.set(input, handle);
	}

	public getHandleForInput(input: WebviewInput): string | undefined {
		return this._inputsToHandles.get(input);
	}

	public getInputForHandle(handle: string): WebviewInput | undefined {
		return this._handlesToInputs.get(handle);
	}

	public delete(handle: string): void {
		const input = this.getInputForHandle(handle);
		this._handlesToInputs.delete(handle);
		if (input) {
			this._inputsToHandles.delete(input);
		}
	}

	public get size(): number {
		return this._handlesToInputs.size;
	}

	[Symbol.iterator](): Iterator<WebviewInput> {
		return this._handlesToInputs.values();
	}
}

class WebviewViewTypeTransformer {
	public constructor(
		public readonly prefix: string,
	) { }

	public fromExternal(viewType: string): string {
		return this.prefix + viewType;
	}

	public toExternal(viewType: string): string | undefined {
		return viewType.startsWith(this.prefix)
			? viewType.substr(this.prefix.length)
			: undefined;
	}
}

export class MainThreadWebviewPanels extends Disposable implements extHostProtocol.MainThreadWebviewPanelsShape {

	private readonly webviewPanelViewType = new WebviewViewTypeTransformer('mainThreadWebview-');

	private readonly _proxy: extHostProtocol.ExtHostWebviewPanelsShape;

	private readonly _webviewInputs = new WebviewInputStore();

	private readonly _revivers = this._register(new DisposableMap<string>());

	private readonly webviewOriginStore: ExtensionKeyedWebviewOriginStore;

	constructor(
		context: IExtHostContext,
		private readonly _mainThreadWebviews: MainThreadWebviews,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IEditorGroupsService private readonly _editorGroupService: IEditorGroupsService,
		@IEditorService private readonly _editorService: IEditorService,
		@IExtensionService extensionService: IExtensionService,
		@IStorageService storageService: IStorageService,
		@ITelemetryService private readonly _telemetryService: ITelemetryService,
		@IWebviewWorkbenchService private readonly _webviewWorkbenchService: IWebviewWorkbenchService,
	) {
		super();

		this.webviewOriginStore = new ExtensionKeyedWebviewOriginStore('mainThreadWebviewPanel.origins', storageService);

		this._proxy = context.getProxy(extHostProtocol.ExtHostContext.ExtHostWebviewPanels);

		this._register(Event.any(
			_editorService.onDidActiveEditorChange,
			_editorService.onDidVisibleEditorsChange,
			_editorGroupService.onDidAddGroup,
			_editorGroupService.onDidRemoveGroup,
			_editorGroupService.onDidMoveGroup,
		)(() => {
			this.updateWebviewViewStates(this._editorService.activeEditor);
		}));

		this._register(_webviewWorkbenchService.onDidChangeActiveWebviewEditor(input => {
			this.updateWebviewViewStates(input);
		}));

		// This reviver's only job is to activate extensions.
		// This should trigger the real reviver to be registered from the extension host side.
		this._register(_webviewWorkbenchService.registerResolver({
			canResolve: (webview: WebviewInput) => {
				const viewType = this.webviewPanelViewType.toExternal(webview.viewType);
				if (typeof viewType === 'string') {
					extensionService.activateByEvent(`onWebviewPanel:${viewType}`);
				}
				return false;
			},
			resolveWebview: () => { throw new Error('not implemented'); }
		}));
	}

	public get webviewInputs(): Iterable<WebviewInput> { return this._webviewInputs; }

	public addWebviewInput(handle: extHostProtocol.WebviewHandle, input: WebviewInput, options: { serializeBuffersForPostMessage: boolean }): void {
		this._webviewInputs.add(handle, input);
		this._mainThreadWebviews.addWebview(handle, input.webview, options);

		input.webview.onDidDispose(() => {
			this._proxy.$onDidDisposeWebviewPanel(handle).finally(() => {
				this._webviewInputs.delete(handle);
			});
		});
	}

	public $createWebviewPanel(
		extensionData: extHostProtocol.WebviewExtensionDescription,
		handle: extHostProtocol.WebviewHandle,
		viewType: string,
		initData: extHostProtocol.IWebviewInitData,
		showOptions: extHostProtocol.WebviewPanelShowOptions,
	): void {
		const targetGroup = this.getTargetGroupFromShowOptions(showOptions);
		const mainThreadShowOptions: IWebViewShowOptions = showOptions ? {
			preserveFocus: !!showOptions.preserveFocus,
			group: targetGroup
		} : {};

		const extension = reviveWebviewExtension(extensionData);
		const origin = this.webviewOriginStore.getOrigin(viewType, extension.id);

		const webview = this._webviewWorkbenchService.openWebview({
			origin,
			providedViewType: viewType,
			title: initData.title,
			options: reviveWebviewOptions(initData.panelOptions),
			contentOptions: reviveWebviewContentOptions(initData.webviewOptions),
			extension
		}, this.webviewPanelViewType.fromExternal(viewType), initData.title, mainThreadShowOptions);

		this.addWebviewInput(handle, webview, { serializeBuffersForPostMessage: initData.serializeBuffersForPostMessage });

		const payload = {
			extensionId: extension.id.value,
			viewType
		} as const;

		type Classification = {
			extensionId: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Id of the extension that created the webview panel' };
			viewType: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Id of the webview' };
			owner: 'mjbvz';
			comment: 'Triggered when a webview is created. Records the type of webview and the extension which created it';
		};

		this._telemetryService.publicLog2<typeof payload, Classification>('webviews:createWebviewPanel', payload);
	}

	public $disposeWebview(handle: extHostProtocol.WebviewHandle): void {
		const webview = this.tryGetWebviewInput(handle);
		if (!webview) {
			return;
		}
		webview.dispose();
	}

	public $setTitle(handle: extHostProtocol.WebviewHandle, value: string): void {
		this.tryGetWebviewInput(handle)?.setName(value);
	}

	public $setIconPath(handle: extHostProtocol.WebviewHandle, value: extHostProtocol.IWebviewIconPath | undefined): void {
		const webview = this.tryGetWebviewInput(handle);
		if (webview) {
			webview.iconPath = reviveWebviewIcon(value);
		}
	}

	public $reveal(handle: extHostProtocol.WebviewHandle, showOptions: extHostProtocol.WebviewPanelShowOptions): void {
		const webview = this.tryGetWebviewInput(handle);
		if (!webview || webview.isDisposed()) {
			return;
		}

		const targetGroup = this.getTargetGroupFromShowOptions(showOptions);
		this._webviewWorkbenchService.revealWebview(webview, targetGroup, !!showOptions.preserveFocus);
	}

	private getTargetGroupFromShowOptions(showOptions: extHostProtocol.WebviewPanelShowOptions): PreferredGroup {
		if (typeof showOptions.viewColumn === 'undefined'
			|| showOptions.viewColumn === ACTIVE_GROUP
			|| (this._editorGroupService.count === 1 && this._editorGroupService.activeGroup.isEmpty)
		) {
			return ACTIVE_GROUP;
		}

		if (showOptions.viewColumn === SIDE_GROUP) {
			return SIDE_GROUP;
		}

		if (showOptions.viewColumn >= 0) {
			// First check to see if an existing group exists
			const groupInColumn = this._editorGroupService.getGroups(GroupsOrder.GRID_APPEARANCE)[showOptions.viewColumn];
			if (groupInColumn) {
				return groupInColumn.id;
			}

			// We are dealing with an unknown group and therefore need a new group.
			// Note that the new group's id may not match the one requested. We only allow
			// creating a single new group, so if someone passes in `showOptions.viewColumn = 99`
			// and there are two editor groups open, we simply create a third editor group instead
			// of creating all the groups up to 99.
			const newGroup = this._editorGroupService.findGroup({ location: GroupLocation.LAST });
			if (newGroup) {
				const direction = preferredSideBySideGroupDirection(this._configurationService);
				return this._editorGroupService.addGroup(newGroup, direction);
			}
		}

		return ACTIVE_GROUP;
	}

	public $registerSerializer(viewType: string, options: { serializeBuffersForPostMessage: boolean }): void {
		if (this._revivers.has(viewType)) {
			throw new Error(`Reviver for ${viewType} already registered`);
		}

		this._revivers.set(viewType, this._webviewWorkbenchService.registerResolver({
			canResolve: (webviewInput) => {
				return webviewInput.viewType === this.webviewPanelViewType.fromExternal(viewType);
			},
			resolveWebview: async (webviewInput): Promise<void> => {
				const viewType = this.webviewPanelViewType.toExternal(webviewInput.viewType);
				if (!viewType) {
					webviewInput.webview.setHtml(this._mainThreadWebviews.getWebviewResolvedFailedContent(webviewInput.viewType));
					return;
				}

				const handle = generateUuid();

				this.addWebviewInput(handle, webviewInput, options);

				let state = undefined;
				if (webviewInput.webview.state) {
					try {
						state = JSON.parse(webviewInput.webview.state);
					} catch (e) {
						console.error('Could not load webview state', e, webviewInput.webview.state);
					}
				}

				try {
					await this._proxy.$deserializeWebviewPanel(handle, viewType, {
						title: webviewInput.getTitle(),
						state,
						panelOptions: webviewInput.webview.options,
						webviewOptions: webviewInput.webview.contentOptions,
						active: webviewInput === this._editorService.activeEditor,
					}, editorGroupToColumn(this._editorGroupService, webviewInput.group || 0));
				} catch (error) {
					onUnexpectedError(error);
					webviewInput.webview.setHtml(this._mainThreadWebviews.getWebviewResolvedFailedContent(viewType));
				}
			}
		}));
	}

	public $unregisterSerializer(viewType: string): void {
		if (!this._revivers.has(viewType)) {
			throw new Error(`No reviver for ${viewType} registered`);
		}

		this._revivers.deleteAndDispose(viewType);
	}

	private updateWebviewViewStates(activeEditorInput: EditorInput | undefined) {
		if (!this._webviewInputs.size) {
			return;
		}

		const viewStates: extHostProtocol.WebviewPanelViewStateData = {};

		const updateViewStatesForInput = (group: IEditorGroup, topLevelInput: EditorInput, editorInput: EditorInput) => {
			if (!(editorInput instanceof WebviewInput)) {
				return;
			}

			editorInput.updateGroup(group.id);

			const handle = this._webviewInputs.getHandleForInput(editorInput);
			if (handle) {
				viewStates[handle] = {
					visible: topLevelInput === group.activeEditor,
					active: editorInput === activeEditorInput,
					position: editorGroupToColumn(this._editorGroupService, group.id),
				};
			}
		};

		for (const group of this._editorGroupService.groups) {
			for (const input of group.editors) {
				if (input instanceof DiffEditorInput) {
					updateViewStatesForInput(group, input, input.primary);
					updateViewStatesForInput(group, input, input.secondary);
				} else {
					updateViewStatesForInput(group, input, input);
				}
			}
		}

		if (Object.keys(viewStates).length) {
			this._proxy.$onDidChangeWebviewPanelViewStates(viewStates);
		}
	}

	private tryGetWebviewInput(handle: extHostProtocol.WebviewHandle): WebviewInput | undefined {
		return this._webviewInputs.getInputForHandle(handle);
	}
}

function reviveWebviewIcon(value: extHostProtocol.IWebviewIconPath | undefined): WebviewIcons | undefined {
	if (!value) {
		return undefined;
	}
	return {
		light: URI.revive(value.light),
		dark: URI.revive(value.dark),
	};
}

function reviveWebviewOptions(panelOptions: extHostProtocol.IWebviewPanelOptions): WebviewOptions {
	return {
		enableFindWidget: panelOptions.enableFindWidget,
		retainContextWhenHidden: panelOptions.retainContextWhenHidden,
	};
}
