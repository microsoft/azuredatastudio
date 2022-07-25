/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as DOM from 'vs/base/browser/dom';
import { ActionBar } from 'sql/base/browser/ui/taskbar/actionbar';
import { ExecutionPlanPropertiesView } from 'sql/workbench/contrib/executionPlan/browser/executionPlanPropertiesView';
import { ExecutionPlanWidgetController } from 'sql/workbench/contrib/executionPlan/browser/executionPlanWidgetController';
import { ExecutionPlanViewHeader } from 'sql/workbench/contrib/executionPlan/browser/executionPlanViewHeader';
import { ISashEvent, ISashLayoutProvider, Orientation, Sash } from 'vs/base/browser/ui/sash/sash';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IFileDialogService } from 'vs/platform/dialogs/common/dialogs';
import { IFileService } from 'vs/platform/files/common/files';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IUntitledTextEditorService } from 'vs/workbench/services/untitled/common/untitledTextEditorService';
import { EDITOR_FONT_DEFAULTS } from 'vs/editor/common/config/editorOptions';
import { ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { openNewQuery } from 'sql/workbench/contrib/query/browser/queryActions';
import { RunQueryOnConnectionMode } from 'sql/platform/connection/common/connectionManagement';
import { formatDocumentWithSelectedProvider, FormattingMode } from 'vs/editor/contrib/format/format';
import { Progress } from 'vs/platform/progress/common/progress';
import { CancellationToken } from 'vs/base/common/cancellation';
import { Action, Separator } from 'vs/base/common/actions';
import { localize } from 'vs/nls';
import { customZoomIconClassNames, disableTooltipIconClassName, enableTooltipIconClassName, executionPlanCompareIconClassName, executionPlanTopOperations, openPlanFileIconClassNames, openPropertiesIconClassNames, openQueryIconClassNames, savePlanIconClassNames, searchIconClassNames, zoomInIconClassNames, zoomOutIconClassNames, zoomToFitIconClassNames } from 'sql/workbench/contrib/executionPlan/browser/constants';
import { URI } from 'vs/base/common/uri';
import { VSBuffer } from 'vs/base/common/buffer';
import { CustomZoomWidget } from 'sql/workbench/contrib/executionPlan/browser/widgets/customZoomWidget';
import { NodeSearchWidget } from 'sql/workbench/contrib/executionPlan/browser/widgets/nodeSearchWidget';
import { AzdataGraphView } from 'sql/workbench/contrib/executionPlan/browser/azdataGraphView';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { ExecutionPlanComparisonInput } from 'sql/workbench/contrib/executionPlan/browser/compareExecutionPlanInput';
import { ExecutionPlanFileView } from 'sql/workbench/contrib/executionPlan/browser/executionPlanFileView';
import { QueryResultsView } from 'sql/workbench/contrib/query/browser/queryResultsView';

export class ExecutionPlanView implements ISashLayoutProvider {

	// Underlying execution plan displayed in the view
	private _model?: azdata.executionPlan.ExecutionPlanGraph;

	// container for the view
	public container: HTMLElement;

	// action bar for the view
	private _actionBarContainer: HTMLElement;
	private _actionBar: ActionBar;

	// plan header section
	public planHeader: ExecutionPlanViewHeader;
	private _planContainer: HTMLElement;
	private _planHeaderContainer: HTMLElement;

	// properties view
	public propertiesView: ExecutionPlanPropertiesView;
	private _propContainer: HTMLElement;

	// plan widgets
	private _widgetContainer: HTMLElement;
	public widgetController: ExecutionPlanWidgetController;

	// plan diagram
	public executionPlanDiagram: AzdataGraphView;

	public actionBarToggleTopTip: Action;
	public contextMenuToggleTooltipAction: Action;
	constructor(
		private _parent: HTMLElement,
		private _graphIndex: number,
		private _executionPlanFileView: ExecutionPlanFileView,
		private _queryResultsView: QueryResultsView,
		@IInstantiationService public readonly _instantiationService: IInstantiationService,
		@IThemeService private readonly _themeService: IThemeService,
		@IContextViewService public readonly contextViewService: IContextViewService,
		@IUntitledTextEditorService private readonly _untitledEditorService: IUntitledTextEditorService,
		@IEditorService private readonly editorService: IEditorService,
		@IContextMenuService private _contextMenuService: IContextMenuService,
		@IFileDialogService public fileDialogService: IFileDialogService,
		@IFileService public fileService: IFileService,
		@IWorkspaceContextService public workspaceContextService: IWorkspaceContextService,
		@IEditorService private _editorService: IEditorService
	) {
		// parent container for query plan.
		this.container = DOM.$('.execution-plan');
		this._parent.appendChild(this.container);
		const sashContainer = DOM.$('.execution-plan-sash');
		this._parent.appendChild(sashContainer);

		// resizing sash for the query plan.
		const sash = new Sash(sashContainer, this, { orientation: Orientation.HORIZONTAL, size: 3 });
		let originalHeight = this.container.offsetHeight;
		let originalTableHeight = 0;
		let change = 0;
		sash.onDidStart((e: ISashEvent) => {
			originalHeight = this.container.offsetHeight;
			originalTableHeight = this.propertiesView.tableHeight;
		});

		/**
		 * Using onDidChange for the smooth resizing of the graph diagram
		 */
		sash.onDidChange((evt: ISashEvent) => {
			change = evt.startY - evt.currentY;
			const newHeight = originalHeight - change;
			if (newHeight < 200) {
				return;
			}
			/**
			 * Since the parent container is flex, we will have
			 * to change the flex-basis property to change the height.
			 */
			this.container.style.minHeight = '200px';
			this.container.style.flex = `0 0 ${newHeight}px`;
		});

		/**
		 * Resizing properties window table only once at the end as it is a heavy operation and worsens the smooth resizing experience
		 */
		sash.onDidEnd(() => {
			this.propertiesView.tableHeight = originalTableHeight - change;
		});

		this._planContainer = DOM.$('.plan');
		this.container.appendChild(this._planContainer);

		// container that holds plan header info
		this._planHeaderContainer = DOM.$('.header');

		// Styling header text like the query editor
		this._planHeaderContainer.style.fontFamily = EDITOR_FONT_DEFAULTS.fontFamily;
		this._planHeaderContainer.style.fontSize = EDITOR_FONT_DEFAULTS.fontSize.toString();
		this._planHeaderContainer.style.fontWeight = EDITOR_FONT_DEFAULTS.fontWeight;

		this._planContainer.appendChild(this._planHeaderContainer);
		this.planHeader = this._instantiationService.createInstance(ExecutionPlanViewHeader, this._planHeaderContainer, {
			planIndex: this._graphIndex,
		});

		// container properties
		this._propContainer = DOM.$('.properties');
		this.container.appendChild(this._propContainer);
		this.propertiesView = new ExecutionPlanPropertiesView(this._propContainer, this._themeService);

		this._widgetContainer = DOM.$('.plan-action-container');
		this._planContainer.appendChild(this._widgetContainer);
		this.widgetController = new ExecutionPlanWidgetController(this._widgetContainer);

		// container that holds action bar icons
		this._actionBarContainer = DOM.$('.action-bar-container');
		this.container.appendChild(this._actionBarContainer);
		this._actionBar = new ActionBar(this._actionBarContainer, {
			orientation: ActionsOrientation.VERTICAL, context: this
		});

		this.actionBarToggleTopTip = new ActionBarToggleTooltip();
		const actionBarActions = [
			new SavePlanFile(),
			new OpenPlanFile(),
			this._instantiationService.createInstance(OpenQueryAction, 'ActionBar'),
			this._instantiationService.createInstance(ZoomInAction, 'ActionBar'),
			this._instantiationService.createInstance(ZoomOutAction, 'ActionBar'),
			this._instantiationService.createInstance(ZoomToFitAction, 'ActionBar'),
			this._instantiationService.createInstance(CustomZoomAction, 'ActionBar'),
			this._instantiationService.createInstance(SearchNodeAction, 'ActionBar'),
			this._instantiationService.createInstance(PropertiesAction, 'ActionBar'),
			this._instantiationService.createInstance(CompareExecutionPlanAction, 'ActionBar'),
			this.actionBarToggleTopTip
		];
		// Setting up context menu
		this.contextMenuToggleTooltipAction = new ContextMenuTooltipToggle();
		const contextMenuAction = [
			new SavePlanFile(),
			new OpenPlanFile(),
			this._instantiationService.createInstance(OpenQueryAction, 'ContextMenu'),
			new Separator(),
			this._instantiationService.createInstance(ZoomInAction, 'ContextMenu'),
			this._instantiationService.createInstance(ZoomOutAction, 'ContextMenu'),
			this._instantiationService.createInstance(ZoomToFitAction, 'ContextMenu'),
			this._instantiationService.createInstance(CustomZoomAction, 'ContextMenu'),
			new Separator(),
			this._instantiationService.createInstance(SearchNodeAction, 'ContextMenu'),
			this._instantiationService.createInstance(PropertiesAction, 'ContextMenu'),
			this._instantiationService.createInstance(CompareExecutionPlanAction, 'ContextMenu'),
			this.contextMenuToggleTooltipAction
		];

		if (this._queryResultsView) {
			actionBarActions.push(this._instantiationService.createInstance(TopOperationsAction));
			contextMenuAction.push(this._instantiationService.createInstance(TopOperationsAction));
		}

		this._actionBar.pushAction(actionBarActions, { icon: true, label: false });

		const self = this;
		this.container.oncontextmenu = (e: MouseEvent) => {
			if (contextMenuAction) {
				this._contextMenuService.showContextMenu({
					getAnchor: () => {
						return {
							x: e.x,
							y: e.y
						};
					},
					getActions: () => contextMenuAction,
					getActionsContext: () => (self)
				});
			}
		};

		this.container.onkeydown = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
				let searchNodeAction = self._instantiationService.createInstance(SearchNodeAction, 'HotKey');
				searchNodeAction.run(self);

				e.stopPropagation();
			}
		};
	}

	getHorizontalSashTop(sash: Sash): number {
		return 0;
	}
	getHorizontalSashLeft?(sash: Sash): number {
		return 0;
	}
	getHorizontalSashWidth?(sash: Sash): number {
		return this.container.clientWidth;
	}

	private createPlanDiagram(container: HTMLElement) {
		this.executionPlanDiagram = this._instantiationService.createInstance(AzdataGraphView, container, this._model);
		this.executionPlanDiagram.onElementSelected(e => {
			container.focus();
			this.propertiesView.graphElement = e;
		});
	}


	public set model(graph: azdata.executionPlan.ExecutionPlanGraph | undefined) {
		this._model = graph;
		if (this._model) {
			this.planHeader.graphIndex = this._graphIndex;
			this.planHeader.query = graph.query;
			if (graph.recommendations) {
				this.planHeader.recommendations = graph.recommendations;
			}
			let diagramContainer = DOM.$('.diagram');
			this.createPlanDiagram(diagramContainer);

			/**
			 * We do not want to scroll the diagram through mouse wheel.
			 * Instead, we pass this event to parent control. So, when user
			 * uses the scroll wheel, they scroll through graphs present in
			 * the graph control. To scroll the individual graphs, users should
			 * use the scroll bars.
			 */
			diagramContainer.addEventListener('wheel', e => {
				this._parent.scrollTop += e.deltaY;
				//Hiding all tooltips when we scroll.
				const element = document.getElementsByClassName('mxTooltip');
				for (let i = 0; i < element.length; i++) {
					(<HTMLElement>element[i]).style.visibility = 'hidden';
				}
				e.preventDefault();
				e.stopPropagation();
			});

			this._planContainer.appendChild(diagramContainer);

			this.propertiesView.graphElement = this._model.root;
		}
	}

	public get model(): azdata.executionPlan.ExecutionPlanGraph | undefined {
		return this._model;
	}

	public openQuery() {
		return this._instantiationService.invokeFunction(openNewQuery, undefined, this.model.query, RunQueryOnConnectionMode.none).then();
	}

	public async openGraphFile() {
		const input = this._untitledEditorService.create({ mode: this.model.graphFile.graphFileType, initialValue: this.model.graphFile.graphFileContent });
		await input.resolve();
		await this._instantiationService.invokeFunction(formatDocumentWithSelectedProvider, input.textEditorModel, FormattingMode.Explicit, Progress.None, CancellationToken.None);
		input.setDirty(false);
		this.editorService.openEditor(input);
	}

	public hideActionBar() {
		this._actionBarContainer.style.display = 'none';
	}

	public compareCurrentExecutionPlan() {
		this._editorService.openEditor(this._instantiationService.createInstance(ExecutionPlanComparisonInput, {
			topExecutionPlan: this._executionPlanFileView.graphs,
			topPlanIndex: this._graphIndex - 1
		}), {
			pinned: true
		});
	}

	public openTopOperations() {
		this._queryResultsView.switchToTopOperationsTab();
		this._queryResultsView.scrollToTable(this._graphIndex);
	}
}

type ExecutionPlanActionSource = 'ContextMenu' | 'ActionBar' | 'HotKey';

export class OpenQueryAction extends Action {
	public static ID = 'ep.OpenQueryAction';
	public static LABEL = localize('openQueryAction', "Open Query");

	constructor(private source: ExecutionPlanActionSource,
		@IAdsTelemetryService private readonly telemetryService: IAdsTelemetryService
	) {
		super(OpenQueryAction.ID, OpenQueryAction.LABEL, openQueryIconClassNames);
	}

	public override async run(context: ExecutionPlanView): Promise<void> {
		this.telemetryService
			.createActionEvent(TelemetryKeys.TelemetryView.ExecutionPlan, TelemetryKeys.TelemetryAction.OpenQuery)
			.withAdditionalProperties({ source: this.source })
			.send();

		context.openQuery();
	}
}

export class PropertiesAction extends Action {
	public static ID = 'ep.propertiesAction';
	public static LABEL = localize('executionPlanPropertiesActionLabel', "Properties");

	constructor(private source: ExecutionPlanActionSource,
		@IAdsTelemetryService private readonly telemetryService: IAdsTelemetryService
	) {
		super(PropertiesAction.ID, PropertiesAction.LABEL, openPropertiesIconClassNames);
	}

	public override async run(context: ExecutionPlanView): Promise<void> {
		this.telemetryService
			.createActionEvent(TelemetryKeys.TelemetryView.ExecutionPlan, TelemetryKeys.TelemetryAction.OpenExecutionPlanProperties)
			.withAdditionalProperties({ source: this.source })
			.send();

		context.propertiesView.toggleVisibility();
	}
}

export class ZoomInAction extends Action {
	public static ID = 'ep.ZoomInAction';
	public static LABEL = localize('executionPlanZoomInActionLabel', "Zoom In");

	constructor(private source: ExecutionPlanActionSource,
		@IAdsTelemetryService private readonly telemetryService: IAdsTelemetryService
	) {
		super(ZoomInAction.ID, ZoomInAction.LABEL, zoomInIconClassNames);
	}

	public override async run(context: ExecutionPlanView): Promise<void> {
		this.telemetryService
			.createActionEvent(TelemetryKeys.TelemetryView.ExecutionPlan, TelemetryKeys.TelemetryAction.ZoomIn)
			.withAdditionalProperties({ source: this.source })
			.send();

		context.executionPlanDiagram.zoomIn();
	}
}

export class ZoomOutAction extends Action {
	public static ID = 'ep.ZoomOutAction';
	public static LABEL = localize('executionPlanZoomOutActionLabel', "Zoom Out");

	constructor(private source: ExecutionPlanActionSource,
		@IAdsTelemetryService private readonly telemetryService: IAdsTelemetryService
	) {
		super(ZoomOutAction.ID, ZoomOutAction.LABEL, zoomOutIconClassNames);
	}

	public override async run(context: ExecutionPlanView): Promise<void> {
		this.telemetryService
			.createActionEvent(TelemetryKeys.TelemetryView.ExecutionPlan, TelemetryKeys.TelemetryAction.ZoomOut)
			.withAdditionalProperties({ source: this.source })
			.send();

		context.executionPlanDiagram.zoomOut();
	}
}

export class ZoomToFitAction extends Action {
	public static ID = 'ep.FitGraph';
	public static LABEL = localize('executionPlanFitGraphLabel', "Zoom to fit");

	constructor(private source: ExecutionPlanActionSource,
		@IAdsTelemetryService private readonly telemetryService: IAdsTelemetryService
	) {
		super(ZoomToFitAction.ID, ZoomToFitAction.LABEL, zoomToFitIconClassNames);
	}

	public override async run(context: ExecutionPlanView): Promise<void> {
		this.telemetryService
			.createActionEvent(TelemetryKeys.TelemetryView.ExecutionPlan, TelemetryKeys.TelemetryAction.ZoomToFit)
			.withAdditionalProperties({ source: this.source })
			.send();

		context.executionPlanDiagram.zoomToFit();
	}
}

export class SavePlanFile extends Action {
	public static ID = 'ep.saveXML';
	public static LABEL = localize('executionPlanSavePlanXML', "Save Plan File");

	constructor() {
		super(SavePlanFile.ID, SavePlanFile.LABEL, savePlanIconClassNames);
	}

	public override async run(context: ExecutionPlanView): Promise<void> {
		const workspaceFolders = await context.workspaceContextService.getWorkspace().folders;
		const defaultFileName = 'plan';
		let currentWorkSpaceFolder: URI;
		if (workspaceFolders.length !== 0) {
			currentWorkSpaceFolder = workspaceFolders[0].uri;
			currentWorkSpaceFolder = URI.joinPath(currentWorkSpaceFolder, defaultFileName); //appending default file name to workspace uri
		} else {
			currentWorkSpaceFolder = URI.parse(defaultFileName); // giving default name
		}
		const saveFileUri = await context.fileDialogService.showSaveDialog({
			filters: [
				{
					extensions: ['sqlplan'], //TODO: Get this extension from provider
					name: localize('executionPlan.SaveFileDescription', 'Execution Plan Files') //TODO: Get the names from providers.
				}
			],
			defaultUri: currentWorkSpaceFolder // If no workspaces are opened this will be undefined
		});
		if (saveFileUri) {
			await context.fileService.writeFile(saveFileUri, VSBuffer.fromString(context.model.graphFile.graphFileContent));
		}
	}
}

export class CustomZoomAction extends Action {
	public static ID = 'ep.customZoom';
	public static LABEL = localize('executionPlanCustomZoom', "Custom Zoom");

	constructor(private source: ExecutionPlanActionSource,
		@IAdsTelemetryService private readonly telemetryService: IAdsTelemetryService
	) {
		super(CustomZoomAction.ID, CustomZoomAction.LABEL, customZoomIconClassNames);
	}

	public override async run(context: ExecutionPlanView): Promise<void> {
		this.telemetryService
			.createActionEvent(TelemetryKeys.TelemetryView.ExecutionPlan, TelemetryKeys.TelemetryAction.CustomZoom)
			.withAdditionalProperties({ source: this.source })
			.send();

		context.widgetController.toggleWidget(context._instantiationService.createInstance(CustomZoomWidget, context.widgetController, context.executionPlanDiagram));
	}
}

export class SearchNodeAction extends Action {
	public static ID = 'ep.searchNode';
	public static LABEL = localize('executionPlanSearchNodeAction', "Find Node");

	constructor(private source: ExecutionPlanActionSource,
		@IAdsTelemetryService private readonly telemetryService: IAdsTelemetryService
	) {
		super(SearchNodeAction.ID, SearchNodeAction.LABEL, searchIconClassNames);
	}

	public override async run(context: ExecutionPlanView): Promise<void> {
		this.telemetryService
			.createActionEvent(TelemetryKeys.TelemetryView.ExecutionPlan, TelemetryKeys.TelemetryAction.FindNode)
			.withAdditionalProperties({ source: this.source })
			.send();

		context.widgetController.toggleWidget(context._instantiationService.createInstance(NodeSearchWidget, context.widgetController, context.executionPlanDiagram));
	}
}

export class OpenPlanFile extends Action {
	public static ID = 'ep.openGraphFile';
	public static Label = localize('executionPlanOpenGraphFile', "Show Query Plan XML"); //TODO: add a contribution point for providers to set this text

	constructor() {
		super(OpenPlanFile.ID, OpenPlanFile.Label, openPlanFileIconClassNames);
	}

	public override async run(context: ExecutionPlanView): Promise<void> {
		await context.openGraphFile();
	}
}

export class ActionBarToggleTooltip extends Action {
	public static ID = 'ep.tooltipToggleActionBar';
	public static WHEN_TOOLTIPS_ENABLED_LABEL = localize('executionPlanEnableTooltip', "Tooltips enabled");
	public static WHEN_TOOLTIPS_DISABLED_LABEL = localize('executionPlanDisableTooltip', "Tooltips disabled");

	constructor() {
		super(ActionBarToggleTooltip.ID, ActionBarToggleTooltip.WHEN_TOOLTIPS_ENABLED_LABEL, enableTooltipIconClassName);
	}

	public override async run(context: ExecutionPlanView): Promise<void> {
		const state = context.executionPlanDiagram.toggleTooltip();
		if (!state) {
			this.class = disableTooltipIconClassName;
			this.label = ActionBarToggleTooltip.WHEN_TOOLTIPS_DISABLED_LABEL;
			context.contextMenuToggleTooltipAction.label = ContextMenuTooltipToggle.WHEN_TOOLTIPS_DISABLED_LABEL;
		} else {
			this.class = enableTooltipIconClassName;
			this.label = ActionBarToggleTooltip.WHEN_TOOLTIPS_ENABLED_LABEL;
			context.contextMenuToggleTooltipAction.label = ContextMenuTooltipToggle.WHEN_TOOLTIPS_ENABLED_LABEL;
		}
	}
}

export class ContextMenuTooltipToggle extends Action {
	public static ID = 'ep.tooltipToggleContextMenu';
	public static WHEN_TOOLTIPS_ENABLED_LABEL = localize('executionPlanContextMenuDisableTooltip', "Disable Tooltips");
	public static WHEN_TOOLTIPS_DISABLED_LABEL = localize('executionPlanContextMenuEnableTooltip', "Enable Tooltips");

	constructor() {
		super(ContextMenuTooltipToggle.ID, ContextMenuTooltipToggle.WHEN_TOOLTIPS_ENABLED_LABEL, enableTooltipIconClassName);
	}

	public override async run(context: ExecutionPlanView): Promise<void> {
		const state = context.executionPlanDiagram.toggleTooltip();
		if (!state) {
			this.label = ContextMenuTooltipToggle.WHEN_TOOLTIPS_DISABLED_LABEL;
			context.actionBarToggleTopTip.class = disableTooltipIconClassName;
			context.actionBarToggleTopTip.label = ActionBarToggleTooltip.WHEN_TOOLTIPS_DISABLED_LABEL;
		} else {
			this.label = ContextMenuTooltipToggle.WHEN_TOOLTIPS_ENABLED_LABEL;
			context.actionBarToggleTopTip.class = enableTooltipIconClassName;
			context.actionBarToggleTopTip.label = ActionBarToggleTooltip.WHEN_TOOLTIPS_ENABLED_LABEL;
		}
	}
}

export class CompareExecutionPlanAction extends Action {
	public static ID = 'ep.tooltipToggleContextMenu';
	public static COMPARE_PLAN = localize('executionPlanCompareExecutionPlanAction', "Compare execution plan");

	constructor(private source: ExecutionPlanActionSource,
		@IAdsTelemetryService private readonly telemetryService: IAdsTelemetryService
	) {
		super(CompareExecutionPlanAction.COMPARE_PLAN, CompareExecutionPlanAction.COMPARE_PLAN, executionPlanCompareIconClassName);
	}

	public override async run(context: ExecutionPlanView): Promise<void> {
		this.telemetryService
			.createActionEvent(TelemetryKeys.TelemetryView.ExecutionPlan, TelemetryKeys.TelemetryAction.CompareExecutionPlan)
			.withAdditionalProperties({ source: this.source })
			.send();

		context.compareCurrentExecutionPlan();
	}
}

export class TopOperationsAction extends Action {

	public static ID = 'ep.topOperationsAction';
	public static LABEL = localize('executionPlanTopOperationsAction', "Top Operations");

	constructor
		() {
		super(TopOperationsAction.ID, TopOperationsAction.LABEL, executionPlanTopOperations);
	}

	public override async run(context: ExecutionPlanView): Promise<void> {
		context.openTopOperations();
	}
}
