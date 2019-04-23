/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!sql/media/icons/common-icons';
import 'vs/css!./media/gridWidget';

/* Node Modules */
import { Component, Inject, forwardRef, ViewChild, OnInit, ElementRef } from '@angular/core';

/* SQL imports */
import { DashboardWidget, IDashboardWidget, WidgetConfig, WIDGET_CONFIG } from 'sql/workbench/parts/dashboard/common/dashboardWidget';
import { CommonServiceInterface } from 'sql/platform/bootstrap/node/commonServiceInterface.service';
import { TaskRegistry } from 'sql/platform/tasks/common/tasks';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';

/* VS imports */
import * as themeColors from 'vs/workbench/common/theme';
import * as colors from 'vs/platform/theme/common/colorRegistry';
import { registerThemingParticipant, ICssStyleCollector, ITheme } from 'vs/platform/theme/common/themeService';
import * as types from 'vs/base/common/types';
import { ScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import * as DOM from 'vs/base/browser/dom';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { MenuRegistry, ICommandAction } from 'vs/platform/actions/common/actions';
import { ContextKeyExpr, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { IEndpoint } from 'sql/workbench/parts/notebook/notebookUtils';

import * as azdata from 'azdata';

interface ITask {
	name: string;
	when: string;
}

const selector = 'grid-widget';

@Component({
	selector,
	templateUrl: decodeURI(require.toUrl('sql/workbench/parts/dashboard/widgets/gridview/gridWidget.component.html'))
})
export class GridWidget extends DashboardWidget implements IDashboardWidget, OnInit {
	private _size: number = 98;
	private _endpoints: IEndpoint[] = [];
	private _profile: IConnectionProfile;
	private _scrollableElement: ScrollableElement;
	private _rowContainer: HTMLElement;
	static readonly ICON_PATH_TO_CSS_RULES: Map<string /* path*/, string /* CSS rule */> = new Map<string, string>();
	private clusterEndpointsProperty = 'clusterEndpoints';
	private _inited = false;

	@ViewChild('container', { read: ElementRef }) private _container: ElementRef;

	constructor(
		@Inject(WIDGET_CONFIG) protected _config: WidgetConfig,
		@Inject(forwardRef(() => CommonServiceInterface)) private readonly _bootstrap: CommonServiceInterface,
		@Inject(ICommandService) private readonly commandService: ICommandService,
		@Inject(IContextKeyService) readonly contextKeyService: IContextKeyService
	) {
		super();
		this._profile = this._bootstrap.connectionManagementService.connectionInfo.connectionProfile;
		const tasksConfig = this._config.widget[selector] as Array<string | ITask>;
		//TaskRegistry.getTasks();
	}

	async ngOnInit() {
		this._inited = true;
		this._endpoints = await this.getClusterEndpointsInfo(this._profile);
		this._register(registerThemingParticipant(this.registerThemeing));
		this._computeContainer();

		this._endpoints.map(a => {
			this._rowContainer.append(this._createRow(a));
		});

		this._scrollableElement = this._register(new ScrollableElement(this._rowContainer, {
			horizontal: ScrollbarVisibility.Auto,
			vertical: ScrollbarVisibility.Hidden,
			scrollYToX: true,
			useShadows: false
		}));

		this._scrollableElement.onScroll(e => {
			this._rowContainer.style.right = e.scrollLeft + 'px';
		});

		(this._container.nativeElement as HTMLElement).appendChild(this._scrollableElement.getDomNode());

		// Update scrollbar
		this._scrollableElement.setScrollDimensions({
			width: DOM.getContentWidth(this._container.nativeElement),
			scrollWidth: DOM.getContentWidth(this._rowContainer) + 18 // right padding
		});
	}

	private async getClusterEndpointsInfo(sqlConnInfo: azdata.IConnectionProfile | azdata.connection.Connection): Promise<IEndpoint[]> {
		let connectionId: string = 'id' in sqlConnInfo ? sqlConnInfo.id : sqlConnInfo.connectionId;
		if (!connectionId) { return undefined; }

		let serverInfo = await azdata.connection.getServerInfo(connectionId);
		if (!serverInfo || !serverInfo.options) { return undefined; }

		let endpoints: IEndpoint[] = serverInfo.options[this.clusterEndpointsProperty];

		return endpoints;
	}

	private _computeContainer(): void {
		const height = DOM.getContentHeight(this._container.nativeElement);
		const tilesHeight = Math.floor(height / (this._size + 10));
		const width = (this._size + 18) * Math.ceil(this._endpoints.length / tilesHeight);
		if (!this._rowContainer) {
			this._rowContainer = DOM.$('.tile-container');
		}
		this._rowContainer.style.height = height + 'px';
		this._rowContainer.style.width = width + 'px';
	}

	private _createRow(link: IEndpoint): HTMLElement {
		const row = DOM.$('div');

		const iconClassName = this.getOrCreateIconClassName(link.serviceName);
		if (iconClassName) {
			const icon = DOM.$('span.icon');
			DOM.addClass(icon, iconClassName);
			row.append(icon);
		}

		const label = DOM.$('div');
		label.innerText = link.serviceName;
		row.append(label);

		const hyperlink = DOM.$('a');
		hyperlink.attributes['href'] = 'http://'+ link.ipAddress + ':' + link.port;
		hyperlink.attributes['target'] = '_blank';
		hyperlink.attributes['text'] = 'http://'+ link.ipAddress + ':' + link.port;
		row.append(hyperlink);

		row.setAttribute('tabindex', '0');
		row.style.height = this._size + 'px';
		row.style.width = this._size + 'px';

		return row;
	}

	private registerThemeing(theme: ITheme, collector: ICssStyleCollector) {
		const contrastBorder = theme.getColor(colors.contrastBorder);
		const sideBarColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND);
		if (contrastBorder) {
			const contrastBorderString = contrastBorder.toString();
			collector.addRule(`grid-widget .task-tile { border: 1px solid ${contrastBorderString} }`);
		} else {
			const sideBarColorString = sideBarColor.toString();
			collector.addRule(`grid-widget .task-tile { background-color: ${sideBarColorString} }`);
		}
	}

	public runTask(task: ICommandAction) {
		this.commandService.executeCommand(task.id, this._profile);
	}

	public layout(): void {
		if (this._inited) {
			this._computeContainer();
			// Update scrollbar
			this._scrollableElement.setScrollDimensions({
				width: DOM.getContentWidth(this._container.nativeElement),
				scrollWidth: DOM.getContentWidth(this._rowContainer) + 18 // right padding
			});
		}
	}

	private getOrCreateIconClassName(serviceName: string): string{
		if(serviceName === 'gateway'){
			return '';
		}
		return '';
	}
}
