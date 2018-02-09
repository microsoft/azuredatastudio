/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/connectionDialog';

import { Button } from 'sql/base/browser/ui/button/button';
import { attachModalDialogStyler, attachButtonStyler } from 'sql/common/theme/styler';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { Modal } from 'sql/base/browser/ui/modal/modal';
import { IConnectionManagementService, INewConnectionParams } from 'sql/parts/connection/common/connectionManagement';
import * as DialogHelper from 'sql/base/browser/ui/modal/dialogHelper';
import { TreeCreationUtils } from 'sql/parts/registeredServer/viewlet/treeCreationUtils';
import { TreeUpdateUtils } from 'sql/parts/registeredServer/viewlet/treeUpdateUtils';
import { ConnectionProfile } from 'sql/parts/connection/common/connectionProfile';
import { TabbedPanel, PanelTabIdentifier } from 'sql/base/browser/ui/panel/panel';
import { RecentConnectionTreeController, RecentConnectionActionsProvider } from 'sql/parts/connection/connectionDialog/recentConnectionTreeController';
import { SavedConnectionTreeController } from 'sql/parts/connection/connectionDialog/savedConnectionTreeController';
import * as TelemetryKeys from 'sql/common/telemetryKeys';

import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IWorkbenchThemeService, IColorTheme } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { contrastBorder } from 'vs/platform/theme/common/colorRegistry';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import Event, { Emitter } from 'vs/base/common/event';
import { Builder, $ } from 'vs/base/browser/builder';
import { ICancelableEvent } from 'vs/base/parts/tree/browser/treeDefaults';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { localize } from 'vs/nls';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IMessageService, IConfirmation } from 'vs/platform/message/common/message';
import * as styler from 'vs/platform/theme/common/styler';
import { TPromise } from 'vs/base/common/winjs.base';
import * as DOM from 'vs/base/browser/dom';

export interface OnShowUIResponse {
	selectedProviderType: string;
	container: HTMLElement;
}

export class ConnectionDialogWidget extends Modal {
	private _bodyBuilder: Builder;
	private _recentConnectionBuilder: Builder;
	private _noRecentConnectionBuilder: Builder;
	private _savedConnectionBuilder: Builder;
	private _noSavedConnectionBuilder: Builder;
	private _dividerBuilder: Builder;
	private _connectButton: Button;
	private _closeButton: Button;
	private _providerTypeSelectBox: SelectBox;
	private _newConnectionParams: INewConnectionParams;
	private _recentConnectionTree: ITree;
	private _savedConnectionTree: ITree;
	private $connectionUIContainer: Builder;
	private _databaseDropdownExpanded: boolean;

	private _panel: TabbedPanel;
	private _recentConnectionTabId: PanelTabIdentifier;

	private _onInitDialog = new Emitter<void>();
	public onInitDialog: Event<void> = this._onInitDialog.event;

	private _onCancel = new Emitter<void>();
	public onCancel: Event<void> = this._onCancel.event;

	private _onConnect = new Emitter<IConnectionProfile>();
	public onConnect: Event<IConnectionProfile> = this._onConnect.event;

	private _onShowUiComponent = new Emitter<OnShowUIResponse>();
	public onShowUiComponent: Event<OnShowUIResponse> = this._onShowUiComponent.event;

	private _onFillinConnectionInputs = new Emitter<IConnectionProfile>();
	public onFillinConnectionInputs: Event<IConnectionProfile> = this._onFillinConnectionInputs.event;

	private _onResetConnection = new Emitter<void>();
	public onResetConnection: Event<void> = this._onResetConnection.event;

	constructor(
		private providerTypeOptions: string[],
		private selectedProviderType: string,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IWorkbenchThemeService private _themeService: IWorkbenchThemeService,
		@IPartService _partService: IPartService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IContextMenuService private _contextMenuService: IContextMenuService,
		@IMessageService private _messageService: IMessageService
	) {
		super(localize('connection', 'Connection'), TelemetryKeys.Connection, _partService, telemetryService, contextKeyService, { hasSpinner: true, hasErrors: true });
	}

	protected renderBody(container: HTMLElement): void {
		let connectionContainer = $('.connection-dialog');
		container.appendChild(connectionContainer.getHTMLElement());

		this._bodyBuilder = new Builder(connectionContainer.getHTMLElement());
		this._providerTypeSelectBox = new SelectBox(this.providerTypeOptions, this.selectedProviderType);

		// Recent connection tab
		let recentConnectionTab = $('.connection-recent-tab');
		recentConnectionTab.div({ class: 'connection-recent', id: 'recentConnection' }, (builder) => {
			this._recentConnectionBuilder = new Builder(builder.getHTMLElement());
			this._noRecentConnectionBuilder = new Builder(builder.getHTMLElement());
			this.createRecentConnections();
			this._recentConnectionBuilder.hide();
		});

		// Saved connection tab
		let savedConnectionTab = $('.connection-saved-tab');
		savedConnectionTab.div({ class: 'connection-saved' }, (builder) => {
			this._savedConnectionBuilder = new Builder(builder.getHTMLElement());
			this._noSavedConnectionBuilder = new Builder(builder.getHTMLElement());
			this.createSavedConnections();
			this._savedConnectionBuilder.hide();
		});

		this._panel = new TabbedPanel(connectionContainer.getHTMLElement());
		this._recentConnectionTabId = this._panel.pushTab({
			identifier: 'recent_connection',
			title: localize('recentConnectionTitle', 'Recent connections'),
			view: {
				render: c => {
					recentConnectionTab.appendTo(c);
				},
				layout: () => { }
			}
		});

		let savedConnectionTabId = this._panel.pushTab({
			identifier: 'saved_connection',
			title: localize('savedConnectionTitle', 'Saved connections'),
			view: {
				layout: () => { },
				render: c => {
					savedConnectionTab.appendTo(c);
				}
			}
		});

		this._panel.onTabChange(c => {
			if (c === savedConnectionTabId && this._savedConnectionTree.getContentHeight() === 0) {
				// Update saved connection tree
				TreeUpdateUtils.structuralTreeUpdate(this._savedConnectionTree, 'saved', this._connectionManagementService);

				if (this._savedConnectionTree.getContentHeight() > 0) {
					this._noSavedConnectionBuilder.hide();
					this._savedConnectionBuilder.show();
				} else {
					this._noSavedConnectionBuilder.show();
					this._savedConnectionBuilder.hide();
				}
				this._savedConnectionTree.layout(DOM.getTotalHeight(this._savedConnectionTree.getHTMLElement()));
			}
		});

		this._bodyBuilder.div({ class: 'Connection-divider' }, (dividerContainer) => {
			this._dividerBuilder = dividerContainer;
		});

		this._bodyBuilder.div({ class: 'connection-type' }, (modelTableContent) => {
			let connectTypeLabel = localize('connectType', 'Connection type');
			modelTableContent.element('table', { class: 'connection-table-content' }, (tableContainer) => {
				DialogHelper.appendInputSelectBox(
					DialogHelper.appendRow(tableContainer, connectTypeLabel, 'connection-label', 'connection-input'), this._providerTypeSelectBox);
			});
		});

		this.$connectionUIContainer = $('.connection-provider-info#connectionProviderInfo');
		this.$connectionUIContainer.appendTo(this._bodyBuilder);

		let self = this;
		this._register(self._themeService.onDidColorThemeChange(e => self.updateTheme(e)));
		self.updateTheme(self._themeService.getColorTheme());
	}

	/**
	 * Render the connection flyout
	 */
	public render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);
		let connectLabel = localize('connect', 'Connect');
		let cancelLabel = localize('cancel', 'Cancel');
		this._connectButton = this.addFooterButton(connectLabel, () => this.connect());
		this._connectButton.enabled = false;
		this._closeButton = this.addFooterButton(cancelLabel, () => this.cancel());
		this.registerListeners();
		this.onProviderTypeSelected(this._providerTypeSelectBox.value);
	}

	// Update theming that is specific to connection flyout body
	private updateTheme(theme: IColorTheme): void {
		let borderColor = theme.getColor(contrastBorder);
		let border = borderColor ? borderColor.toString() : null;
		if (this._dividerBuilder) {
			this._dividerBuilder.style('border-top-width', border ? '1px' : null);
			this._dividerBuilder.style('border-top-style', border ? 'solid' : null);
			this._dividerBuilder.style('border-top-color', border);
		}
	}

	private registerListeners(): void {
		// Theme styler
		this._register(styler.attachSelectBoxStyler(this._providerTypeSelectBox, this._themeService));
		this._register(attachButtonStyler(this._connectButton, this._themeService));
		this._register(attachButtonStyler(this._closeButton, this._themeService));

		this._register(this._providerTypeSelectBox.onDidSelect(selectedProviderType => {
			this.onProviderTypeSelected(selectedProviderType.selected);
		}));
	}

	private onProviderTypeSelected(selectedProviderType: string) {
		// Show connection form based on server type
		this.$connectionUIContainer.empty();
		this._onShowUiComponent.fire({ selectedProviderType: selectedProviderType, container: this.$connectionUIContainer.getHTMLElement() });
		this.initDialog();
	}

	private connect(element?: IConnectionProfile): void {
		if (this._connectButton.enabled) {
			this._connectButton.enabled = false;
			this._providerTypeSelectBox.disable();
			this.showSpinner();
			this._onConnect.fire(element);
		}
	}

	/* Overwrite espace key behavior */
	protected onClose(e: StandardKeyboardEvent) {
		this.cancel();
	}

	/* Overwrite enter key behavior */
	protected onAccept(e: StandardKeyboardEvent) {
		if (!e.target.classList.contains('monaco-tree')) {
			this.connect();
		}
	}

	private cancel() {
		this._onCancel.fire();
		if (!this._databaseDropdownExpanded) {
			this.close();
		}
	}

	public close() {
		this.resetConnection();
		this.hide();
	}

	private clearRecentConnectionList(): TPromise<boolean> {

		let confirm: IConfirmation = {
			message: localize('clearRecentConnectionMessage', 'Are you sure you want to delete all the connections from the list?'),
			primaryButton: localize('yes', 'Yes'),
			secondaryButton: localize('no', 'No'),
			type: 'question'
		};

		// @SQLTODO
		return new TPromise<boolean>((resolve, reject) => {
			let confirmed: boolean = this._messageService.confirm(confirm);
			if (confirmed) {
				this._connectionManagementService.clearRecentConnectionsList();
				this.open(false);
			}
			resolve(confirmed);
		});

			//this._messageService.confirm(confirm).then(confirmation => {
		// 	if (!confirmation.confirmed) {
		// 		return TPromise.as(false);
		// 	} else {
		// 		this._connectionManagementService.clearRecentConnectionsList();
		// 		this.open(false);
		// 		return TPromise.as(true);
		// 	}
		// });

		// return this._messageService.confirm(confirm).then(confirmation => {
		// 	if (!confirmation.confirmed) {
		// 		return TPromise.as(false);
		// 	} else {
		// 		this._connectionManagementService.clearRecentConnectionsList();
		// 		this.open(false);
		// 		return TPromise.as(true);
		// 	}
		// });
	}

	private createRecentConnectionList(): void {
		this._recentConnectionBuilder.div({ class: 'connection-recent-content' }, (recentConnectionContainer) => {
			let recentHistoryLabel = localize('recentHistory', 'Recent history');
			recentConnectionContainer.div({ class: 'recent-titles-container' }, (container) => {
				container.div({ class: 'connection-history-label' }, (recentTitle) => {
					recentTitle.innerHtml(recentHistoryLabel);
				});
				container.div({ class: 'search-action clear-search-results' }, (clearSearchIcon) => {
					clearSearchIcon.on('click', () => this.clearRecentConnectionList());
				});
			});
			recentConnectionContainer.div({ class: 'server-explorer-viewlet' }, (divContainer: Builder) => {
				divContainer.div({ class: 'explorer-servers' }, (treeContainer: Builder) => {
					let leftClick = (element: any, eventish: ICancelableEvent, origin: string) => {
						// element will be a server group if the tree is clicked rather than a item
						if (element instanceof ConnectionProfile) {
							this.onConnectionClick({ payload: { origin: origin, originalEvent: eventish } }, element);
						}
					};
					let actionProvider = this._instantiationService.createInstance(RecentConnectionActionsProvider);
					let controller = new RecentConnectionTreeController(leftClick, actionProvider, this._connectionManagementService, this._contextMenuService);
					actionProvider.onRecentConnectionRemoved(() => {
						this.open(this._connectionManagementService.getRecentConnections().length > 0);
					});
					controller.onRecentConnectionRemoved(() => {
						this.open(this._connectionManagementService.getRecentConnections().length > 0);
					});
					this._recentConnectionTree = TreeCreationUtils.createConnectionTree(treeContainer.getHTMLElement(), this._instantiationService, controller);

					// Theme styler
					this._register(styler.attachListStyler(this._recentConnectionTree, this._themeService));
					divContainer.append(this._recentConnectionTree.getHTMLElement());
				});
			});
		});
	}

	private createRecentConnections() {
		this.createRecentConnectionList();
		this._noRecentConnectionBuilder.div({ class: 'connection-recent-content' }, (noRecentConnectionContainer) => {
			let noRecentHistoryLabel = localize('noRecentConnections', 'No recent connection');
			noRecentConnectionContainer.div({ class: 'no-recent-connections' }, (noRecentTitle) => {
				noRecentTitle.innerHtml(noRecentHistoryLabel);
			});
		});
	}

	private createSavedConnectionList(): void {
		this._savedConnectionBuilder.div({ class: 'connection-saved-content' }, (savedConnectioncontainer) => {
			savedConnectioncontainer.div({ class: 'server-explorer-viewlet' }, (divContainer: Builder) => {
				divContainer.div({ class: 'explorer-servers' }, (treeContainer: Builder) => {
					let leftClick = (element: any, eventish: ICancelableEvent, origin: string) => {
						// element will be a server group if the tree is clicked rather than a item
						if (element instanceof ConnectionProfile) {
							this.onConnectionClick({ payload: { origin: origin, originalEvent: eventish } }, element);
						}
					};

					let controller = new SavedConnectionTreeController(leftClick);
					this._savedConnectionTree = TreeCreationUtils.createConnectionTree(treeContainer.getHTMLElement(), this._instantiationService, controller);

					// Theme styler
					this._register(styler.attachListStyler(this._savedConnectionTree, this._themeService));
					divContainer.append(this._savedConnectionTree.getHTMLElement());
				});
			});
		});
	}

	private createSavedConnections() {
		this.createSavedConnectionList();
		this._noSavedConnectionBuilder.div({ class: 'connection-saved-content' }, (noSavedConnectionContainer) => {
			let noSavedConnectionLabel = localize('noSavedConnections', 'No saved connection');
			noSavedConnectionContainer.div({ class: 'no-saved-connections' }, (titleContainer) => {
				titleContainer.innerHtml(noSavedConnectionLabel);
			});
		});
	}

	private onConnectionClick(event: any, element: IConnectionProfile) {
		let isMouseOrigin = event.payload && (event.payload.origin === 'mouse');
		let isDoubleClick = isMouseOrigin && event.payload.originalEvent && event.payload.originalEvent.detail === 2;
		if (isDoubleClick) {
			this.connect(element);
		} else {
			if (element) {
				this._onFillinConnectionInputs.fire(element);
			}
		}
	}

	/**
	 * Open the flyout dialog
	 * @param recentConnections Are there recent connections that should be shown
	 */
	public open(recentConnections: boolean) {
		this._panel.showTab(this._recentConnectionTabId);
		this.show();
		if (recentConnections) {
			this._noRecentConnectionBuilder.hide();
			this._recentConnectionBuilder.show();
		} else {
			this._recentConnectionBuilder.hide();
			this._noRecentConnectionBuilder.show();
		}
		TreeUpdateUtils.structuralTreeUpdate(this._recentConnectionTree, 'recent', this._connectionManagementService);

		// reset saved connection tree
		this._savedConnectionTree.setInput([]);

		// call layout with view height
		this.layout();
		this.initDialog();
	}

	protected layout(height?: number): void {
		// Height is the overall height. Since we're laying out a specific component, always get its actual height
		this._recentConnectionTree.layout(DOM.getTotalHeight(this._recentConnectionTree.getHTMLElement()));
	}

	/**
	 * Set the state of the connect button
	 * @param enabled The state to set the the button
	 */
	public set connectButtonState(enabled: boolean) {
		this._connectButton.enabled = enabled;
	}

	/**
	 * Get the connect button state
	 */
	public get connectButtonState(): boolean {
		return this._connectButton.enabled;
	}

	private initDialog(): void {
		super.setError('');
		this.hideSpinner();
		this._onInitDialog.fire();
	}

	public resetConnection(): void {
		this.hideSpinner();
		this._connectButton.enabled = true;
		this._providerTypeSelectBox.enable();
		this._onResetConnection.fire();
	}

	public get newConnectionParams(): INewConnectionParams {
		return this._newConnectionParams;
	}

	public set newConnectionParams(params: INewConnectionParams) {
		this._newConnectionParams = params;
	}

	public updateProvider(displayName: string) {
		this._providerTypeSelectBox.selectWithOptionName(displayName);
		this.onProviderTypeSelected(displayName);
	}

	public set databaseDropdownExpanded(val: boolean) {
		this._databaseDropdownExpanded = val;
	}

	public get databaseDropdownExpanded(): boolean {
		return this._databaseDropdownExpanded;
	}
}
