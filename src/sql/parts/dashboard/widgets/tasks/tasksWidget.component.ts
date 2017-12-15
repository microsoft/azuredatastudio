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
import { ITaskRegistry, Extensions, TaskAction } from 'sql/platform/tasks/taskRegistry';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { BaseActionContext } from 'sql/workbench/common/actions';

/* VS imports */
import * as themeColors from 'vs/workbench/common/theme';
import * as colors from 'vs/platform/theme/common/colorRegistry';
import { registerThemingParticipant, ICssStyleCollector, ITheme } from 'vs/platform/theme/common/themeService';
import { Registry } from 'vs/platform/registry/common/platform';
import { Action } from 'vs/base/common/actions';
import Severity from 'vs/base/common/severity';
import * as nls from 'vs/nls';
import * as types from 'vs/base/common/types';
import { ScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { $, Builder } from 'vs/base/browser/builder';
import * as DOM from 'vs/base/browser/dom';

interface IConfig {
	tasks: Array<Object>;
}

@Component({
	selector: 'tasks-widget',
	templateUrl: decodeURI(require.toUrl('sql/parts/dashboard/widgets/tasks/tasksWidget.component.html'))
})
export class TasksWidget extends DashboardWidget implements IDashboardWidget, OnInit {
	private _size: number = 98;
	private _tasks: Array<TaskAction> = [];
	private _profile: IConnectionProfile;
	private _scrollableElement: ScrollableElement;
	private $container: Builder;

	@ViewChild('container', { read: ElementRef }) private _container: ElementRef;

	constructor(
		@Inject(forwardRef(() => DashboardServiceInterface)) private _bootstrap: DashboardServiceInterface,
		@Inject(forwardRef(() => DomSanitizer)) private _sanitizer: DomSanitizer,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeref: ChangeDetectorRef,
		@Inject(WIDGET_CONFIG) protected _config: WidgetConfig
	) {
		super();
		this._profile = this._bootstrap.connectionManagementService.connectionInfo.connectionProfile;
		let registry = Registry.as<ITaskRegistry>(Extensions.TaskContribution);
		let tasksConfig = <IConfig>Object.values(this._config.widget)[0];
		let taskIds: Array<string>;

		if (tasksConfig.tasks) {
			taskIds = Object.keys(tasksConfig.tasks);
		} else {
			taskIds = registry.ids;
		}

		let ctorMap = registry.idToCtorMap;
		this._tasks = taskIds.map(id => {
			let ctor = ctorMap[id];
			if (ctor) {
				let action = this._bootstrap.instantiationService.createInstance(ctor, ctor.ID, ctor.LABEL, ctor.ICON);
				if (this._bootstrap.capabilitiesService.isFeatureAvailable(action, this._bootstrap.connectionManagementService.connectionInfo)) {
					return action;
				}
			} else {
				this._bootstrap.messageService.show(Severity.Warning, nls.localize('missingTask', 'Could not find task {0}; are you missing an extension?', id));
			}

			return undefined;
		}).filter(a => !types.isUndefinedOrNull(a));
	}

	ngOnInit() {
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

	private _createTile(action: TaskAction): HTMLElement {
		let label = $('div').safeInnerHtml(action.label);
		let icon = $('span.icon').addClass(action.icon);
		let innerTile = $('div').append(icon).append(label);
		let tile = $('div.task-tile').style('height', this._size + 'px').style('width', this._size + 'px');
		tile.append(innerTile);
		tile.on(DOM.EventType.CLICK, () => this.runTask(action));
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

	public runTask(task: Action) {
		let context: BaseActionContext = {
			profile: this._profile
		};
		task.run(context);
	}

	public layout(): void {
		this._computeContainer();
		// Update scrollbar
		this._scrollableElement.setScrollDimensions({
			width: DOM.getContentWidth(this._container.nativeElement),
			scrollWidth: DOM.getContentWidth(this.$container.getHTMLElement()) + 18 // right padding
		});
	}
}
