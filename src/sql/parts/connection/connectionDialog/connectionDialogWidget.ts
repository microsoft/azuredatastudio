/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/connectionDialog';

import { attachModalDialogStyler } from 'sql/common/theme/styler';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { Modal } from 'sql/base/browser/ui/modal/modal';
import { IConnectionManagementService, INewConnectionParams } from 'sql/parts/connection/common/connectionManagement';
import * as DialogHelper from 'sql/base/browser/ui/modal/dialogHelper';
import { TreeCreationUtils } from 'sql/parts/registeredServer/viewlet/treeCreationUtils';
import { TreeUpdateUtils } from 'sql/parts/registeredServer/viewlet/treeUpdateUtils';
import { ConnectionProfile } from 'sql/parts/connection/common/connectionProfile';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IWorkbenchThemeService, IColorTheme } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { contrastBorder } from 'vs/platform/theme/common/colorRegistry';
import * as styler from 'vs/platform/theme/common/styler';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import Event, { Emitter } from 'vs/base/common/event';
import { Builder, $ } from 'vs/base/browser/builder';
import { Button } from 'vs/base/browser/ui/button/button';
import { DefaultController, ICancelableEvent } from 'vs/base/parts/tree/browser/treeDefaults';
import { IKeyboardEvent, StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import * as TelemetryKeys from 'sql/common/telemetryKeys';
import { localize } from 'vs/nls';
import * as DOM from 'vs/base/browser/dom';

export interface OnShowUIResponse {
	selectedProviderType: string;
	container: HTMLElement;
}

class TreeController extends DefaultController {
	constructor(private clickcb: (element: any, eventish: ICancelableEvent, origin: string) => void) {
		super();
	}

	protected onLeftClick(tree: ITree, element: any, eventish: ICancelableEvent, origin: string = 'mouse'): boolean {
		this.clickcb(element, eventish, origin);
		return super.onLeftClick(tree, element, eventish, origin);
	}

	protected onEnter(tree: ITree, event: IKeyboardEvent): boolean {
		super.onEnter(tree, event);
		this.clickcb(tree.getSelection()[0], event, 'keyboard');
		return true;
	}
}

export class ConnectionDialogWidget extends Modal {
	private _bodyBuilder: Builder;
	private _recentConnectionBuilder: Builder;
	private _dividerBuilder: Builder;
	private _connectButton: Button;
	private _closeButton: Button;
	private _newConnectionParams: INewConnectionParams;
	private _recentConnectionTree: ITree;
	private $connectionUIContainer: Builder;

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
		@IContextKeyService contextKeyService: IContextKeyService
	) {
		super(localize('connection', 'Connection'), TelemetryKeys.Connection, _partService, telemetryService, contextKeyService, { hasSpinner: true, hasErrors: true });
	}

	protected renderBody(container: HTMLElement): void {
		this._bodyBuilder = new Builder(container);

		this._bodyBuilder.div({ class: 'connection-recent', id: 'recentConnection' }, (builder) => {
			this._recentConnectionBuilder = new Builder(builder.getHTMLElement());
			this.createRecentConnections();
			this._recentConnectionBuilder.hide();
		});

		this._bodyBuilder.div({ class: 'Connection-divider' }, (dividerContainer) => {
			this._dividerBuilder = dividerContainer;
		});

		this._bodyBuilder.div({ class: 'connection-type' }, (modelTableContent) => {
			// add SQL Server label to Connection Dialog until we support multiple connection providers
			let sqlServerName = localize('microsoftSqlServer', "Microsoft SQL Server");
			modelTableContent.div({ class: 'server-name-label' }, (nameLabel) => {
				nameLabel.innerHtml(sqlServerName);
			});

			//let connectTypeLabel = localize('connectType', 'Connection type');
			modelTableContent.element('table', { class: 'connection-table-content' }, (tableContainer) => {
				// DialogHelper.appendInputSelectBox(
				// 	DialogHelper.appendRow(tableContainer, connectTypeLabel, 'connection-label', 'connection-input'), this._providerTypeSelectBox);
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
		this.onProviderTypeSelected('MSSQL');
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
		this._register(styler.attachButtonStyler(this._connectButton, this._themeService));
		this._register(styler.attachButtonStyler(this._closeButton, this._themeService));

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
		this.close();
	}

	public close() {
		this.resetConnection();
		this.hide();
	}

	private createRecentConnections() {
		this._recentConnectionBuilder.div({ class: 'connection-recent-content' }, (recentConnectionContainer) => {
			let recentHistoryLabel = localize('recentHistory', 'Recent history');
			recentConnectionContainer.div({ class: 'connection-history-label' }, (recentTitle) => {
				recentTitle.innerHtml(recentHistoryLabel);
			});

			recentConnectionContainer.div({ class: 'server-explorer-viewlet' }, (divContainer: Builder) => {
				divContainer.div({ class: 'explorer-servers' }, (treeContainer: Builder) => {
					let leftClick = (element: any, eventish: ICancelableEvent, origin: string) => {
						// element will be a server group if the tree is clicked rather than a item
						if (element instanceof ConnectionProfile) {
							this.onRecentConnectionClick({ payload: { origin: origin, originalEvent: eventish } }, element);
						}

					};
					let controller = new TreeController(leftClick);
					this._recentConnectionTree = TreeCreationUtils.createConnectionTree(treeContainer.getHTMLElement(), this._instantiationService, controller);

					// Theme styler
					this._register(styler.attachListStyler(this._recentConnectionTree, this._themeService));
					divContainer.append(this._recentConnectionTree.getHTMLElement());
				});
			});
		});
	}

	private onRecentConnectionClick(event: any, element: IConnectionProfile) {
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
		this.show();
		if (recentConnections) {
			this._recentConnectionBuilder.show();
			TreeUpdateUtils.structuralTreeUpdate(this._recentConnectionTree, 'recent', this._connectionManagementService);
			// call layout with view height
			this.layout();
		} else {
			this._recentConnectionBuilder.hide();
		}

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
		this._onResetConnection.fire();
	}

	public get newConnectionParams(): INewConnectionParams {
		return this._newConnectionParams;
	}

	public set newConnectionParams(params: INewConnectionParams) {
		this._newConnectionParams = params;
	}

	public updateProvider(displayName: string) {
		this.onProviderTypeSelected('MSSQL');
	}
}
