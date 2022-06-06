/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdata from 'azdata';
import { InfoBox } from 'sql/workbench/browser/ui/infoBox/infoBox';
import { LoadingSpinner } from 'sql/base/browser/ui/loadingSpinner/loadingSpinner';
import { ExecutionPlanView } from 'sql/workbench/contrib/executionPlan/browser/executionPlanView';
import { IExecutionPlanService } from 'sql/workbench/services/executionPlan/common/interfaces';
import * as DOM from 'vs/base/browser/dom';
import { localize } from 'vs/nls';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { contrastBorder, editorWidgetBackground, foreground, listHoverBackground, textLinkForeground, widgetShadow } from 'vs/platform/theme/common/colorRegistry';
import { IColorTheme, ICssStyleCollector, registerThemingParticipant } from 'vs/platform/theme/common/themeService';

export class ExecutionPlanFileView {
	private _parent: HTMLElement;
	private _loadingSpinner: LoadingSpinner;
	private _loadingErrorInfoBox: InfoBox;
	private _executionPlanViews: ExecutionPlanView[] = [];
	public graphs?: azdata.executionPlan.ExecutionPlanGraph[] = [];
	private _container = DOM.$('.eps-container');

	private _planCache: Map<string, azdata.executionPlan.ExecutionPlanGraph[]> = new Map();

	constructor(
		@IInstantiationService private instantiationService: IInstantiationService,
		@IExecutionPlanService private executionPlanService: IExecutionPlanService
	) {
	}

	public render(parent: HTMLElement): void {
		this._parent = parent;
		this._parent.appendChild(this._container);
	}

	public onShow(parentContainer: HTMLElement): void {
		this._parent = parentContainer;
		this._parent.appendChild(this._container);
	}

	public onHide(parentContainer: HTMLElement): void {
		if (parentContainer === this._parent && parentContainer.contains(this._container)) {
			this._parent.removeChild(this._container);
		}
	}

	dispose() {
	}

	/**
	 * Adds executionPlanGraph to the graph controller.
	 * @param newGraphs ExecutionPlanGraphs to be added.
	 */
	public addGraphs(newGraphs: azdata.executionPlan.ExecutionPlanGraph[] | undefined) {
		if (newGraphs) {
			newGraphs.forEach(g => {
				const ep = this.instantiationService.createInstance(ExecutionPlanView, this._container, this._executionPlanViews.length + 1, this);
				ep.model = g;
				this._executionPlanViews.push(ep);
				this.graphs.push(g);
				this.updateRelativeCosts();
			});
		}
	}

	/**
	 * Loads the graph file by converting the file to generic executionPlan graphs.
	 * This feature requires the right providers to be registered that can handle
	 * the graphFileType in the graphFile
	 * Please note: this method clears the existing graph in the graph control
	 * @param graphFile graph file to be loaded.
	 * @returns
	 */
	public async loadGraphFile(graphFile: azdata.executionPlan.ExecutionPlanGraphInfo) {
		this._loadingSpinner = new LoadingSpinner(this._container, { showText: true, fullSize: true });
		this._loadingSpinner.loadingMessage = localize('loadingExecutionPlanFile', "Generating execution plans");
		try {
			this._loadingSpinner.loading = true;
			if (this._planCache.has(graphFile.graphFileContent)) {
				this.addGraphs(this._planCache.get(graphFile.graphFileContent));
				return;
			} else {
				const graphs = (await this.executionPlanService.getExecutionPlan({
					graphFileContent: graphFile.graphFileContent,
					graphFileType: graphFile.graphFileType
				})).graphs;
				this.addGraphs(graphs);
				this._planCache.set(graphFile.graphFileContent, graphs);
			}
			this._loadingSpinner.loadingCompletedMessage = localize('executionPlanFileLoadingComplete', "Execution plans are generated");
		} catch (e) {
			this._loadingErrorInfoBox = this.instantiationService.createInstance(InfoBox, this._container, {
				text: e.toString(),
				style: 'error',
				isClickable: false
			});
			this._loadingErrorInfoBox.isClickable = false;
			this._loadingSpinner.loadingCompletedMessage = localize('executionPlanFileLoadingFailed', "Failed to load execution plan");
		} finally {
			this._loadingSpinner.loading = false;
		}
	}

	private updateRelativeCosts() {
		const sum = this.graphs.reduce((prevCost: number, cg) => {
			return prevCost += cg.root.subTreeCost + cg.root.cost;
		}, 0);

		if (sum > 0) {
			this._executionPlanViews.forEach(ep => {
				ep.planHeader.relativeCost = ((ep.model.root.subTreeCost + ep.model.root.cost) / sum) * 100;
			});
		}
	}
}


registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	const recommendationsColor = theme.getColor(textLinkForeground);
	if (recommendationsColor) {
		collector.addRule(`
		.eps-container .execution-plan .plan .header .recommendations {
			color: ${recommendationsColor};
		}
		`);
	}
	const shadow = theme.getColor(widgetShadow);
	if (shadow) {
		collector.addRule(`
		.eps-container .execution-plan .plan .plan-action-container .child {
			box-shadow: 0 0 8px 2px ${shadow};
		}
		`);
	}

	const menuBackgroundColor = theme.getColor(listHoverBackground);
	if (menuBackgroundColor) {
		collector.addRule(`
		.eps-container .execution-plan .plan .header,
		.eps-container .execution-plan .properties .title,
		.eps-container .execution-plan .properties .table-action-bar {
			background-color: ${menuBackgroundColor};
		}
		`);
	}

	const widgetBackgroundColor = theme.getColor(editorWidgetBackground);
	if (widgetBackgroundColor) {
		collector.addRule(`
		.eps-container .execution-plan .plan .plan-action-container .child,
		.mxTooltip {
			background-color: ${widgetBackgroundColor};
		}
		`);
	}

	const widgetBorderColor = theme.getColor(contrastBorder);
	if (widgetBorderColor) {
		collector.addRule(`
		.eps-container .execution-plan .plan .plan-action-container .child,
		.eps-container .execution-plan .plan .header,
		.eps-container .execution-plan .properties .title,
		.eps-container .execution-plan .properties .table-action-bar,
		.mxTooltip {
			border: 1px solid ${widgetBorderColor};
		}
		`);
	}

	const textColor = theme.getColor(foreground);
	if (textColor) {
		collector.addRule(`
		.mxTooltip  {
			color: ${textColor};
		}
		`);
	}
});
