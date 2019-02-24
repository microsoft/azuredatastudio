/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { FileNode } from 'sql/workbench/services/fileBrowser/common/fileNode';
import { ITree, IRenderer } from 'vs/base/parts/tree/browser/tree';
import { FileKind } from 'vs/platform/files/common/files';
import { URI } from 'vs/base/common/uri';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { FileLabel } from 'vs/workbench/browser/labels';
import { IFileTemplateData } from 'vs/workbench/parts/files/electron-browser/views/explorerViewer';
import { toDisposable } from 'vs/base/common/lifecycle';

const EmptyDisposable = toDisposable(() => null);

/**
 * Renders the tree items.
 * Uses the dom template to render file browser.
 */
export class FileBrowserRenderer implements IRenderer {
	public static readonly FILE_HEIGHT = 22;
	private static readonly FILE_TEMPLATE_ID = 'carbonFileBrowser';

	constructor(
		@IInstantiationService private instantiationService: IInstantiationService
	) {
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
		const elementDisposable = EmptyDisposable;
		const label = this.instantiationService.createInstance(FileLabel, container, void 0);
		return { elementDisposable, label, container };
	}

	/**
	 * Render a element, given an object bag returned by the template
	 */
	public renderElement(tree: ITree, element: FileNode, templateId: string, templateData: IFileTemplateData): void {
		if (element) {
			templateData.label.element.style.display = 'flex';
			const extraClasses = ['explorer-item'];

			var fileuri = URI.file(element.fullPath);
			var filekind;
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