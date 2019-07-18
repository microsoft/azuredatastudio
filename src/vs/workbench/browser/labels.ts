/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';
import * as resources from 'vs/base/common/resources';
import { IconLabel, IIconLabelValueOptions, IIconLabelCreationOptions } from 'vs/base/browser/ui/iconLabel/iconLabel';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IModeService } from 'vs/editor/common/services/modeService';
import { toResource, IEditorInput, SideBySideEditor, Verbosity } from 'vs/workbench/common/editor';
import { PLAINTEXT_MODE_ID } from 'vs/editor/common/modes/modesRegistry';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IModelService } from 'vs/editor/common/services/modelService';
import { IUntitledEditorService } from 'vs/workbench/services/untitled/common/untitledEditorService';
import { IDecorationsService, IResourceDecorationChangeEvent, IDecorationData } from 'vs/workbench/services/decorations/browser/decorations';
import { Schemas } from 'vs/base/common/network';
import { FileKind, FILES_ASSOCIATIONS_CONFIG, IFileService } from 'vs/platform/files/common/files';
import { ITextModel } from 'vs/editor/common/model';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { Event, Emitter } from 'vs/base/common/event';
import { ILabelService } from 'vs/platform/label/common/label';
import { getIconClasses, detectModeId } from 'vs/editor/common/services/getIconClasses';
import { Disposable, dispose, IDisposable } from 'vs/base/common/lifecycle';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { withNullAsUndefined } from 'vs/base/common/types';

export interface IResourceLabelProps {
	resource?: URI;
	name?: string;
	description?: string;
}

export interface IResourceLabelOptions extends IIconLabelValueOptions {
	fileKind?: FileKind;
	fileDecorations?: { colors: boolean, badges: boolean, data?: IDecorationData };
	descriptionVerbosity?: Verbosity;
}

export interface IFileLabelOptions extends IResourceLabelOptions {
	hideLabel?: boolean;
	hidePath?: boolean;
}

export interface IResourceLabel extends IDisposable {
	readonly element: HTMLElement;
	readonly onDidRender: Event<void>;

	/**
	 * Most generic way to apply a label with raw information.
	 */
	setLabel(label?: string, description?: string, options?: IIconLabelValueOptions): void;

	/**
	 * Convenient method to apply a label by passing a resource along.
	 *
	 * Note: for file resources consider to use the #setFile() method instead.
	 */
	setResource(label: IResourceLabelProps, options?: IResourceLabelOptions): void;

	/**
	 * Convenient method to render a file label based on a resource.
	 */
	setFile(resource: URI, options?: IFileLabelOptions): void;

	/**
	 * Convenient method to apply a label by passing an editor along.
	 */
	setEditor(editor: IEditorInput, options?: IResourceLabelOptions): void;

	/**
	 * Resets the label to be empty.
	 */
	clear(): void;
}

export interface IResourceLabelsContainer {
	readonly onDidChangeVisibility: Event<boolean>;
}

export const DEFAULT_LABELS_CONTAINER: IResourceLabelsContainer = {
	onDidChangeVisibility: Event.None
};

export class ResourceLabels extends Disposable {
	private _widgets: ResourceLabelWidget[] = [];
	private _labels: IResourceLabel[] = [];

	constructor(
		container: IResourceLabelsContainer,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IExtensionService private readonly extensionService: IExtensionService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IModelService private readonly modelService: IModelService,
		@IDecorationsService private readonly decorationsService: IDecorationsService,
		@IThemeService private readonly themeService: IThemeService,
		@IFileService private readonly fileService: IFileService,
		@ILabelService private readonly labelService: ILabelService
	) {
		super();

		this.registerListeners(container);
	}

	private registerListeners(container: IResourceLabelsContainer): void {

		// notify when visibility changes
		this._register(container.onDidChangeVisibility(visible => {
			this._widgets.forEach(widget => widget.notifyVisibilityChanged(visible));
		}));

		// notify when extensions are registered with potentially new languages
		this._register(this.extensionService.onDidRegisterExtensions(() => this._widgets.forEach(widget => widget.notifyExtensionsRegistered())));

		// notify when model mode changes
		this._register(this.modelService.onModelModeChanged(e => {
			if (!e.model.uri) {
				return; // we need the resource to compare
			}

			if (this.fileService.canHandleResource(e.model.uri) && e.oldModeId === PLAINTEXT_MODE_ID) {
				return; // ignore transitions in files from no mode to specific mode because this happens each time a model is created
			}

			this._widgets.forEach(widget => widget.notifyModelModeChanged(e.model));
		}));

		// notify when model is added
		this._register(this.modelService.onModelAdded(model => {
			if (!model.uri) {
				return; // we need the resource to compare
			}

			this._widgets.forEach(widget => widget.notifyModelAdded(model));
		}));

		// notify when file decoration changes
		this._register(this.decorationsService.onDidChangeDecorations(e => this._widgets.forEach(widget => widget.notifyFileDecorationsChanges(e))));

		// notify when theme changes
		this._register(this.themeService.onThemeChange(() => this._widgets.forEach(widget => widget.notifyThemeChange())));

		// notify when files.associations changes
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(FILES_ASSOCIATIONS_CONFIG)) {
				this._widgets.forEach(widget => widget.notifyFileAssociationsChange());
			}
		}));

		this._register(this.labelService.onDidChangeFormatters(() => {
			this._widgets.forEach(widget => widget.notifyFormattersChange());
		}));
	}

	get(index: number): IResourceLabel {
		return this._labels[index];
	}

	create(container: HTMLElement, options?: IIconLabelCreationOptions): IResourceLabel {
		const widget = this.instantiationService.createInstance(ResourceLabelWidget, container, options);

		// Only expose a handle to the outside
		const label: IResourceLabel = {
			element: widget.element,
			onDidRender: widget.onDidRender,
			setLabel: (label?: string, description?: string, options?: IIconLabelValueOptions) => widget.setLabel(label, description, options),
			setResource: (label: IResourceLabelProps, options?: IResourceLabelOptions) => widget.setResource(label, options),
			setEditor: (editor: IEditorInput, options?: IResourceLabelOptions) => widget.setEditor(editor, options),
			setFile: (resource: URI, options?: IFileLabelOptions) => widget.setFile(resource, options),
			clear: () => widget.clear(),
			dispose: () => this.disposeWidget(widget)
		};

		// Store
		this._labels.push(label);
		this._widgets.push(widget);

		return label;
	}

	private disposeWidget(widget: ResourceLabelWidget): void {
		const index = this._widgets.indexOf(widget);
		if (index > -1) {
			this._widgets.splice(index, 1);
			this._labels.splice(index, 1);
		}

		dispose(widget);
	}

	clear(): void {
		this._widgets = dispose(this._widgets);
		this._labels = [];
	}

	dispose(): void {
		super.dispose();

		this.clear();
	}
}

/**
 * Note: please consider to use ResourceLabels if you are in need
 * of more than one label for your widget.
 */
export class ResourceLabel extends ResourceLabels {

	private _label: IResourceLabel;

	constructor(
		container: HTMLElement,
		options: IIconLabelCreationOptions,
		@IInstantiationService instantiationService: IInstantiationService,
		@IExtensionService extensionService: IExtensionService,
		@IConfigurationService configurationService: IConfigurationService,
		@IModelService modelService: IModelService,
		@IDecorationsService decorationsService: IDecorationsService,
		@IThemeService themeService: IThemeService,
		@IFileService fileService: IFileService,
		@ILabelService labelService: ILabelService
	) {
		super(DEFAULT_LABELS_CONTAINER, instantiationService, extensionService, configurationService, modelService, decorationsService, themeService, fileService, labelService);

		this._label = this._register(this.create(container, options));
	}

	get element(): IResourceLabel {
		return this._label;
	}
}

enum Redraw {
	Basic = 1,
	Full = 2
}

class ResourceLabelWidget extends IconLabel {

	private _onDidRender = this._register(new Emitter<void>());
	readonly onDidRender: Event<void> = this._onDidRender.event;

	private label?: IResourceLabelProps;
	private options?: IResourceLabelOptions;
	private computedIconClasses?: string[];
	private lastKnownDetectedModeId?: string;
	private computedPathLabel?: string;

	private needsRedraw?: Redraw;
	private isHidden: boolean = false;

	constructor(
		container: HTMLElement,
		options: IIconLabelCreationOptions,
		@IModeService private readonly modeService: IModeService,
		@IModelService private readonly modelService: IModelService,
		@IDecorationsService private readonly decorationsService: IDecorationsService,
		@ILabelService private readonly labelService: ILabelService,
		@IUntitledEditorService private readonly untitledEditorService: IUntitledEditorService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService
	) {
		super(container, options);
	}

	notifyVisibilityChanged(visible: boolean): void {
		if (visible === this.isHidden) {
			this.isHidden = !visible;

			if (visible && this.needsRedraw) {
				this.render(this.needsRedraw === Redraw.Basic ? false : true);
				this.needsRedraw = undefined;
			}
		}
	}

	notifyModelModeChanged(model: ITextModel): void {
		this.handleModelEvent(model);
	}

	notifyModelAdded(model: ITextModel): void {
		this.handleModelEvent(model);
	}

	private handleModelEvent(model: ITextModel): void {
		if (!this.label || !this.label.resource) {
			return; // only update if label exists
		}

		if (model.uri.toString() === this.label.resource.toString()) {
			if (this.lastKnownDetectedModeId !== model.getModeId()) {
				this.render(true); // update if the language id of the model has changed from our last known state
			}
		}
	}

	notifyFileDecorationsChanges(e: IResourceDecorationChangeEvent): void {
		if (!this.options || !this.label || !this.label.resource) {
			return;
		}

		if (this.options.fileDecorations && e.affectsResource(this.label.resource)) {
			this.render(false);
		}
	}

	notifyExtensionsRegistered(): void {
		this.render(true);
	}

	notifyThemeChange(): void {
		this.render(false);
	}

	notifyFileAssociationsChange(): void {
		this.render(true);
	}

	notifyFormattersChange(): void {
		if (this.label && this.label.resource) {
			this.setFile(this.label.resource, this.options);
		}
		this.render(false);
	}

	setResource(label: IResourceLabelProps, options?: IResourceLabelOptions): void {
		const hasResourceChanged = this.hasResourceChanged(label, options);

		this.label = label;
		this.options = options;

		if (hasResourceChanged) {
			this.computedPathLabel = undefined; // reset path label due to resource change
		}

		this.render(hasResourceChanged);
	}

	private hasResourceChanged(label: IResourceLabelProps, options?: IResourceLabelOptions): boolean {
		const newResource = label ? label.resource : undefined;
		const oldResource = this.label ? this.label.resource : undefined;

		const newFileKind = options ? options.fileKind : undefined;
		const oldFileKind = this.options ? this.options.fileKind : undefined;

		if (newFileKind !== oldFileKind) {
			return true; // same resource but different kind (file, folder)
		}

		if (newResource && this.computedPathLabel !== this.labelService.getUriLabel(newResource)) {
			return true;
		}

		if (newResource && oldResource) {
			return newResource.toString() !== oldResource.toString();
		}

		if (!newResource && !oldResource) {
			return false;
		}

		return true;
	}

	setEditor(editor: IEditorInput, options?: IResourceLabelOptions): void {
		this.setResource({
			resource: toResource(editor, { supportSideBySide: SideBySideEditor.MASTER }),
			name: withNullAsUndefined(editor.getName()),
			description: editor.getDescription(options ? options.descriptionVerbosity : undefined)
		}, options);
	}

	setFile(resource: URI, options?: IFileLabelOptions): void {
		const hideLabel = options && options.hideLabel;
		let name: string | undefined;
		if (!hideLabel) {
			if (options && options.fileKind === FileKind.ROOT_FOLDER) {
				const workspaceFolder = this.contextService.getWorkspaceFolder(resource);
				if (workspaceFolder) {
					name = workspaceFolder.name;
				}
			}

			if (!name) {
				name = resources.basenameOrAuthority(resource);
			}
		}

		let description: string | undefined;
		const hidePath = (options && options.hidePath) || (resource.scheme === Schemas.untitled && !this.untitledEditorService.hasAssociatedFilePath(resource));
		if (!hidePath) {
			description = this.labelService.getUriLabel(resources.dirname(resource), { relative: true });
		}

		this.setResource({ resource, name, description }, options);
	}

	clear(): void {
		this.label = undefined;
		this.options = undefined;
		this.lastKnownDetectedModeId = undefined;
		this.computedIconClasses = undefined;
		this.computedPathLabel = undefined;

		this.setLabel();
	}

	private render(clearIconCache: boolean): void {
		if (this.isHidden) {
			if (!this.needsRedraw) {
				this.needsRedraw = clearIconCache ? Redraw.Full : Redraw.Basic;
			}

			if (this.needsRedraw === Redraw.Basic && clearIconCache) {
				this.needsRedraw = Redraw.Full;
			}

			return;
		}

		if (this.label) {
			const detectedModeId = this.label.resource ? withNullAsUndefined(detectModeId(this.modelService, this.modeService, this.label.resource)) : undefined;
			if (this.lastKnownDetectedModeId !== detectedModeId) {
				clearIconCache = true;
				this.lastKnownDetectedModeId = detectedModeId;
			}
		}

		if (clearIconCache) {
			this.computedIconClasses = undefined;
		}

		if (!this.label) {
			return;
		}

		const iconLabelOptions: IIconLabelValueOptions = {
			title: '',
			italic: this.options && this.options.italic,
			matches: this.options && this.options.matches,
			extraClasses: []
		};

		const resource = this.label.resource;
		const label = this.label.name;

		if (this.options && typeof this.options.title === 'string') {
			iconLabelOptions.title = this.options.title;
		} else if (resource && resource.scheme !== Schemas.data /* do not accidentally inline Data URIs */) {
			if (!this.computedPathLabel) {
				this.computedPathLabel = this.labelService.getUriLabel(resource);
			}

			iconLabelOptions.title = this.computedPathLabel;
		}

		if (this.options && !this.options.hideIcon) {
			if (!this.computedIconClasses) {
				this.computedIconClasses = getIconClasses(this.modelService, this.modeService, resource, this.options && this.options.fileKind);
			}
			iconLabelOptions.extraClasses = this.computedIconClasses.slice(0);
		}
		if (this.options && this.options.extraClasses) {
			iconLabelOptions.extraClasses!.push(...this.options.extraClasses);
		}

		if (this.options && this.options.fileDecorations && resource) {
			const deco = this.decorationsService.getDecoration(
				resource,
				this.options.fileKind !== FileKind.FILE,
				this.options.fileDecorations.data
			);

			if (deco) {
				if (deco.tooltip) {
					iconLabelOptions.title = `${iconLabelOptions.title} • ${deco.tooltip}`;
				}

				if (this.options.fileDecorations.colors) {
					iconLabelOptions.extraClasses!.push(deco.labelClassName);
				}

				if (this.options.fileDecorations.badges) {
					iconLabelOptions.extraClasses!.push(deco.badgeClassName);
				}
			}
		}

		this.setLabel(label, this.label.description, iconLabelOptions);

		this._onDidRender.fire();
	}

	dispose(): void {
		super.dispose();

		this.label = undefined;
		this.options = undefined;
		this.lastKnownDetectedModeId = undefined;
		this.computedIconClasses = undefined;
		this.computedPathLabel = undefined;
	}
}
