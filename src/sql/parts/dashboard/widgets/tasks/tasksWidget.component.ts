/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!sql/media/icons/common-icons';
import 'vs/css!./media/taskWidget';

/* Node Modules */
import { Component, Inject, forwardRef, ChangeDetectorRef, ViewChild, OnInit, ElementRef } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

/* SQL imports */
import { DashboardWidget, IDashboardWidget, WidgetConfig, WIDGET_CONFIG } from 'sql/parts/dashboard/common/dashboardWidget';
import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { TaskRegistry } from 'sql/platform/tasks/common/tasks';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { BaseActionContext } from 'sql/workbench/common/actions';

/* VS imports */
import * as themeColors from 'vs/workbench/common/theme';
import * as colors from 'vs/platform/theme/common/colorRegistry';
import { registerThemingParticipant, ICssStyleCollector, ITheme } from 'vs/platform/theme/common/themeService';
import { Action } from 'vs/base/common/actions';
import Severity from 'vs/base/common/severity';
import * as nls from 'vs/nls';
import * as types from 'vs/base/common/types';
import { ScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { $, Builder } from 'sql/base/browser/builder';
import * as DOM from 'vs/base/browser/dom';
import { CommandsRegistry, ICommand, ICommandService } from 'vs/platform/commands/common/commands';
import { MenuRegistry, ICommandAction } from 'vs/platform/actions/common/actions';
import { ContextKeyExpr, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';

interface ITask {
	name: string;
	when: string;
}

const selector = 'tasks-widget';

@Component({
	selector,
	templateUrl: decodeURI(require.toUrl('sql/parts/dashboard/widgets/tasks/tasksWidget.component.html'))
})
export class TasksWidget extends DashboardWidget implements IDashboardWidget, OnInit {
	private _size: number = 98;
	private _tasks: Array<ICommandAction> = [];
	private _profile: IConnectionProfile;
	private _scrollableElement: ScrollableElement;
	private $container: Builder;
	static readonly ICON_PATH_TO_CSS_RULES: Map<string /* path*/, string /* CSS rule */> = new Map<string, string>();

	private _inited = false;

	@ViewChild('container', { read: ElementRef }) private _container: ElementRef;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _bootstrap: CommonServiceInterface,
		@Inject(forwardRef(() => DomSanitizer)) private _sanitizer: DomSanitizer,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeref: ChangeDetectorRef,
		@Inject(ICommandService) private commandService: ICommandService,
		@Inject(WIDGET_CONFIG) protected _config: WidgetConfig,
		@Inject(IContextKeyService) contextKeyService: IContextKeyService
	) {
		super();
		this._profile = this._bootstrap.connectionManagementService.connectionInfo.connectionProfile;
		let tasksConfig = this._config.widget[selector] as Array<string | ITask>;
		let tasks = TaskRegistry.getTasks();

		if (types.isArray(tasksConfig) && tasksConfig.length > 0) {
			tasks = tasksConfig.map(i => {
				if (types.isString(i)) {
					if (tasks.includes(i)) {
						return i;
					}
				} else {
					if (tasks.includes(i.name) && contextKeyService.contextMatchesRules(ContextKeyExpr.deserialize(i.when))) {
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
			this.$container.append(this._createTile(a));
		});

		this._scrollableElement = this._register(new ScrollableElement(this.$container.getHTMLElement(), {
			horizontal: ScrollbarVisibility.Auto,
			vertical: ScrollbarVisibility.Hidden,
			scrollYToX: true,
			useShadows: false
		}));

		this._scrollableElement.onScroll(e => {
			this.$container.getHTMLElement().style.right = e.scrollLeft + 'px';
		});

		(this._container.nativeElement as HTMLElement).appendChild(this._scrollableElement.getDomNode());

		// Update scrollbar
		this._scrollableElement.setScrollDimensions({
			width: DOM.getContentWidth(this._container.nativeElement),
			scrollWidth: DOM.getContentWidth(this.$container.getHTMLElement()) + 18 // right padding
		});
	}

	private _computeContainer(): void {
		let height = DOM.getContentHeight(this._container.nativeElement);
		let tilesHeight = Math.floor(height / (this._size + 10));
		let width = (this._size + 18) * Math.ceil(this._tasks.length / tilesHeight);
		if (!this.$container) {
			this.$container = $('.tile-container');
			this._register(this.$container);
		}
		this.$container.style('height', height + 'px').style('width', width + 'px');
	}

	private _createTile(action: ICommandAction): HTMLElement {
		let label = $('div').safeInnerHtml(types.isString(action.title) ? action.title : action.title.value);
		let tile = $('div.task-tile').style('height', this._size + 'px').style('width', this._size + 'px');
		let innerTile = $('div');

		let iconClassName = TaskRegistry.getOrCreateTaskIconClassName(action);
		if (iconClassName) {
			let icon = $('span.icon').addClass(iconClassName);
			innerTile.append(icon);
		}
		innerTile.append(label);
		tile.append(innerTile);
		tile.attr('tabindex', '0');
		tile.on(DOM.EventType.CLICK, () => this.runTask(action));
		tile.on(DOM.EventType.KEY_DOWN, (e: KeyboardEvent) => {
			let event = new StandardKeyboardEvent(e);
			if (event.equals(KeyCode.Enter)) {
				this.runTask(action);
				e.stopImmediatePropagation();
			}
		});
		return tile.getHTMLElement();
	}

	private registerThemeing(theme: ITheme, collector: ICssStyleCollector) {
		let contrastBorder = theme.getColor(colors.contrastBorder);
		let sideBarColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND);
		if (contrastBorder) {
			let contrastBorderString = contrastBorder.toString();
			collector.addRule(`tasks-widget .task-tile { border: 1px solid ${contrastBorderString} }`);
		} else {
			let sideBarColorString = sideBarColor.toString();
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
				scrollWidth: DOM.getContentWidth(this.$container.getHTMLElement()) + 18 // right padding
			});
		}
	}
}
