/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/resourceViewerView';
import { ResourceType, ResourceViewerResourcesRegistry, Extensions } from 'sql/platform/resourceViewer/common/resourceViewerRegistry';
import { append, $ } from 'vs/base/browser/dom';
import { IIdentityProvider, IListVirtualDelegate } from 'vs/base/browser/ui/list/list';
import { IListAccessibilityProvider } from 'vs/base/browser/ui/list/listWidget';
import { IDataSource, ITreeMouseEvent, ITreeNode, ITreeRenderer } from 'vs/base/browser/ui/tree/tree';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { WorkbenchDataTree } from 'vs/platform/list/browser/listService';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { Registry } from 'vs/platform/registry/common/platform';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IViewPaneOptions, ViewPane } from 'vs/workbench/browser/parts/views/viewPaneContainer';
import { IViewDescriptorService } from 'vs/workbench/common/views';

type TreeElement = ResourceType;

export class ResourceViewerView extends ViewPane {
	private listContainer!: HTMLElement;
	private tree!: WorkbenchDataTree<TreeModel, TreeElement>;
	private model!: TreeModel;

	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IThemeService themeService: IThemeService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@ICommandService private readonly commandService: ICommandService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IOpenerService openerService: IOpenerService,
		@ITelemetryService telemetryService: ITelemetryService
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, telemetryService);
	}

	protected renderBody(container: HTMLElement): void {
		super.renderBody(container);

		this.listContainer = append(container, $('.resource-view'));

		const renderers: ITreeRenderer<TreeElement, any, any>[] = [new ResourceRenderer()];

		this.model = new TreeModel();

		this.tree = this.instantiationService.createInstance(
			WorkbenchDataTree,
			'Resource View',
			this.listContainer,
			new ListDelegate(),
			renderers,
			new DataSource(),
			{
				identityProvider: new IdentityProvider(),
				horizontalScrolling: false,
				setRowLineHeight: false,
				transformOptimization: false,
				accessibilityProvider: new ListAccessibilityProvider()
			}) as WorkbenchDataTree<TreeModel, TreeElement>;

		this.tree.setInput(this.model);

		this._register(Registry.as<ResourceViewerResourcesRegistry>(Extensions.ResourceViewerExtension).onDidRegisterResource(() => this.tree.updateChildren(this.model)));
		this._register(this.tree.onMouseDblClick(this.onDoubleClick, this));
	}

	private onDoubleClick(event: ITreeMouseEvent<TreeElement | null>) {
		if (event.element) {
			this.commandService.executeCommand('resourceViewer.openResourceViewer', event.element.id);
		}
	}

	protected layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.tree.layout(height, width);
	}
}

interface ResourceTypeTemplate {
	readonly icon: HTMLElement;
	readonly name: HTMLElement;
}

class ResourceRenderer implements ITreeRenderer<ResourceType, void, ResourceTypeTemplate> {
	public static TEMPLATEID = 'resourceType';
	public readonly templateId = ResourceRenderer.TEMPLATEID;

	renderTemplate(parent: HTMLElement): ResourceTypeTemplate {
		const container = append(parent, $('span'));
		const icon = append(container, $('.icon'));
		const name = append(container, $('.name'));
		return { name, icon };
	}

	renderElement(element: ITreeNode<ResourceType, void>, index: number, templateData: ResourceTypeTemplate, height: number): void {
		templateData.name.innerText = element.element.name;
	}

	disposeTemplate(templateData: ResourceTypeTemplate): void {

	}

}

class ListDelegate implements IListVirtualDelegate<TreeElement> {
	getHeight(): number {
		return 22;
	}

	getTemplateId(element: TreeElement): string {
		return ResourceRenderer.TEMPLATEID;
	}
}

class IdentityProvider implements IIdentityProvider<TreeElement> {
	getId(element: TreeElement): string {
		return element.id;
	}
}

class TreeModel {
	private readonly registry = Registry.as<ResourceViewerResourcesRegistry>(Extensions.ResourceViewerExtension);

	getChildren(): ResourceType[] {
		return this.registry.allResources.slice();
	}
}

class ListAccessibilityProvider implements IListAccessibilityProvider<TreeElement> {
	getAriaLabel(element: TreeElement): string {
		return element.name;
	}

	getWidgetAriaLabel(): string {
		return 'Resource Viewer Tree';
	}
}

class DataSource implements IDataSource<TreeModel, TreeElement> {
	hasChildren(element: TreeModel | TreeElement): boolean {
		return element instanceof TreeModel;
	}

	getChildren(element: TreeModel | TreeElement): Iterable<TreeElement> {
		if (element instanceof TreeModel) {
			return element.getChildren();
		}
		return [];
	}
}
