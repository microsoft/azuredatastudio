/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!sql/media/icons/common-icons';
import 'vs/css!./media/taskWidget';

/* Node Modules */
import { Component, Inject, forwardRef, ViewChild, OnInit, ElementRef } from '@angular/core';

/* SQL imports */
import { DashboardWidget, IDashboardWidget, WidgetConfig, WIDGET_CONFIG } from 'sql/workbench/contrib/dashboard/browser/core/dashboardWidget';
import { CommonServiceInterface } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';

/* VS imports */
import * as themeColors from 'vs/workbench/common/theme';
import * as colors from 'vs/platform/theme/common/colorRegistry';
import { registerThemingParticipant, ICssStyleCollector, IColorTheme } from 'vs/platform/theme/common/themeService';
import * as types from 'vs/base/common/types';
import { ScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import * as DOM from 'vs/base/browser/dom';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { MenuRegistry, ICommandAction } from 'vs/platform/actions/common/actions';
import { ContextKeyExpr, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { TaskRegistry } from 'sql/workbench/services/tasks/browser/tasksRegistry';

interface ITask {
	name: string;
	when: string;
}

const selector = 'tasks-widget';

@Component({
	selector,
	templateUrl: decodeURI(require.toUrl('./tasksWidget.component.html'))
})
export class TasksWidget extends DashboardWidget implements IDashboardWidget, OnInit {
	private _size: number = 98;
	private _tasks: Array<ICommandAction> = [];
	private _profile: IConnectionProfile;
	private _scrollableElement: ScrollableElement;
	private _tileContainer: HTMLElement;
	static readonly ICON_PATH_TO_CSS_RULES: Map<string /* path*/, string /* CSS rule */> = new Map<string, string>();

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
		let tasks = TaskRegistry.getTasks();

		if (types.isArray(tasksConfig) && tasksConfig.length > 0) {
			tasks = tasksConfig.map(i => {
				if (types.isString(i)) {
					if (tasks.some(x => x === i)) {
						return i;
					}
				} else {
					if (tasks.some(x => x === i.name) && contextKeyService.contextMatchesRules(ContextKeyExpr.deserialize(i.when))) {
						return i.name;
					}
				}
				return undefined;
			}).filter(i => !!i);
		}

		this._tasks = tasks.map(i => MenuRegistry.getCommand(i)).filter(v => !!v);
	}

	ngOnInit() {
		this._inited = true;
		this._register(registerThemingParticipant(this.registerThemeing));
		this._computeContainer();

		this._tasks.map(a => {
			this._tileContainer.append(this._createTile(a));
		});

		this._scrollableElement = this._register(new ScrollableElement(this._tileContainer, {
			horizontal: ScrollbarVisibility.Auto,
			vertical: ScrollbarVisibility.Hidden,
			scrollYToX: true,
			useShadows: false
		}));

		this._scrollableElement.onScroll(e => {
			this._tileContainer.style.right = e.scrollLeft + 'px';
		});

		(this._container.nativeElement as HTMLElement).appendChild(this._scrollableElement.getDomNode());

		// Update scrollbar
		this._scrollableElement.setScrollDimensions({
			width: DOM.getContentWidth(this._container.nativeElement),
			scrollWidth: DOM.getContentWidth(this._tileContainer) + 18 // right padding
		});
	}

	private _computeContainer(): void {
		const height = DOM.getContentHeight(this._container.nativeElement);
		const tilesHeight = Math.floor(height / (this._size + 10));
		const width = (this._size + 18) * Math.ceil(this._tasks.length / tilesHeight);
		if (!this._tileContainer) {
			this._tileContainer = DOM.$('.tile-container');
		}
		this._tileContainer.style.height = height + 'px';
		this._tileContainer.style.width = width + 'px';
	}

	private _createTile(action: ICommandAction): HTMLElement {
		const label = DOM.$('div');
		label.innerText = types.isString(action.title) ? action.title : action.title.value;
		const tile = DOM.$('.task-tile');
		tile.style.height = this._size + 'px';
		tile.style.width = this._size + 'px';
		const innerTile = DOM.$('div');

		const iconClassName = TaskRegistry.getOrCreateTaskIconClassName(action);
		if (iconClassName) {
			const icon = DOM.$('span.codicon');
			DOM.addClass(icon, iconClassName);
			innerTile.append(icon);
		}
		innerTile.append(label);
		tile.append(innerTile);
		tile.setAttribute('tabindex', '0');
		this._register(DOM.addDisposableListener(tile, DOM.EventType.CLICK, () => this.runTask(action)));
		this._register(DOM.addDisposableListener(tile, DOM.EventType.KEY_DOWN, (e: KeyboardEvent) => {
			const event = new StandardKeyboardEvent(e);
			if (event.equals(KeyCode.Enter)) {
				this.runTask(action);
				e.stopImmediatePropagation();
			}
		}));
		return tile;
	}

	private registerThemeing(theme: IColorTheme, collector: ICssStyleCollector) {
		const contrastBorder = theme.getColor(colors.contrastBorder);
		const sideBarColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND);
		if (contrastBorder) {
			const contrastBorderString = contrastBorder.toString();
			collector.addRule(`tasks-widget .task-tile { border: 1px solid ${contrastBorderString} }`);
		} else {
			const sideBarColorString = sideBarColor.toString();
			collector.addRule(`tasks-widget .task-tile { background-color: ${sideBarColorString} }`);
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
				scrollWidth: DOM.getContentWidth(this._tileContainer) + 18 // right padding
			});
		}
	}
}
