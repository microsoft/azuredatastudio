/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FileNode } from 'sql/workbench/services/fileBrowser/common/fileNode';
import { ITree, IRenderer } from 'sql/base/parts/tree/browser/tree';
import { FileKind } from 'vs/platform/files/common/files';
import { URI } from 'vs/base/common/uri';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { ResourceLabels, DEFAULT_LABELS_CONTAINER } from 'vs/workbench/browser/labels';
import { IFileTemplateData } from 'vs/workbench/contrib/files/browser/views/explorerViewer';

/**
 * Renders the tree items.
 * Uses the dom template to render file browser.
 */
export class FileBrowserRenderer implements IRenderer {
	public static readonly FILE_HEIGHT = 22;
	private static readonly FILE_TEMPLATE_ID = 'carbonFileBrowser';
	private resourceLabels: ResourceLabels;

	constructor(
		@IInstantiationService private instantiationService: IInstantiationService
	) {
		this.resourceLabels = this.instantiationService.createInstance(ResourceLabels, DEFAULT_LABELS_CONTAINER);
	}

	/**
	 * Returns the element's height in the tree, in pixels.
	 */
	public getHeight(tree: ITree, element: any): number {
		return FileBrowserRenderer.FILE_HEIGHT;
	}

	/**
	 * Returns a template ID for a given element.
	 */
	public getTemplateId(tree: ITree, element: any): string {
		return FileBrowserRenderer.FILE_TEMPLATE_ID;
	}

	/**
	 * Render template in a dom element based on template id
	 */
	public renderTemplate(tree: ITree, templateId: string, container: HTMLElement): IFileTemplateData {
		const templateDisposables = new DisposableStore();
		const label = this.resourceLabels.create(container);
		const templateData: IFileTemplateData = { templateDisposables, elementDisposables: templateDisposables.add(new DisposableStore()), label, container };
		return templateData;
	}

	/**
	 * Render a element, given an object bag returned by the template
	 */
	public renderElement(tree: ITree, element: FileNode, templateId: string, templateData: IFileTemplateData): void {
		if (element) {
			templateData.label.element.style.display = 'flex';
			const extraClasses = ['explorer-item'];

			let fileuri = URI.file(element.fullPath);
			let filekind;
			if (element.parent === null) {
				filekind = FileKind.ROOT_FOLDER;
			} else if (element.isFile === false) {
				filekind = FileKind.FOLDER;
			} else {
				filekind = FileKind.FILE;
			}

			templateData.label.setFile(fileuri, { hidePath: true, fileKind: filekind, extraClasses });
		}
	}

	public disposeTemplate(tree: ITree, templateId: string, templateData: IFileTemplateData): void {
		templateData.label.dispose();
	}
}
