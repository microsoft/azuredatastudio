/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from 'vs/base/browser/dom';
import { IKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { CountBadge } from 'vs/base/browser/ui/countBadge/countBadge';
import { HighlightedLabel } from 'vs/base/browser/ui/highlightedlabel/highlightedLabel';
import { IconLabel } from 'vs/base/browser/ui/iconLabel/iconLabel';
import { IIdentityProvider, IKeyboardNavigationLabelProvider, IListVirtualDelegate } from 'vs/base/browser/ui/list/list';
import { IListAccessibilityProvider } from 'vs/base/browser/ui/list/listWidget';
import { IAsyncDataSource, ITreeNode, ITreeRenderer } from 'vs/base/browser/ui/tree/tree';
import { createMatches, FuzzyScore, IMatch } from 'vs/base/common/filters';
import { Disposable } from 'vs/base/common/lifecycle';
import { basename, dirname } from 'vs/base/common/resources';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
import { localize } from 'vs/nls';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { ILabelService } from 'vs/platform/label/common/label';
import { defaultCountBadgeStyles } from 'vs/platform/theme/browser/defaultStyles';
import { FileReferences, OneReference, ReferencesModel } from '../referencesModel';

//#region data source

export type TreeElement = FileReferences | OneReference;

export class DataSource implements IAsyncDataSource<ReferencesModel | FileReferences, TreeElement> {

	constructor(@ITextModelService private readonly _resolverService: ITextModelService) { }

	hasChildren(element: ReferencesModel | FileReferences | TreeElement): boolean {
		if (element instanceof ReferencesModel) {
			return true;
		}
		if (element instanceof FileReferences) {
			return true;
		}
		return false;
	}

	getChildren(element: ReferencesModel | FileReferences | TreeElement): TreeElement[] | Promise<TreeElement[]> {
		if (element instanceof ReferencesModel) {
			return element.groups;
		}

		if (element instanceof FileReferences) {
			return element.resolve(this._resolverService).then(val => {
				// if (element.failure) {
				// 	// refresh the element on failure so that
				// 	// we can update its rendering
				// 	return tree.refresh(element).then(() => val.children);
				// }
				return val.children;
			});
		}

		throw new Error('bad tree');
	}
}

//#endregion

export class Delegate implements IListVirtualDelegate<TreeElement> {
	getHeight(): number {
		return 23;
	}
	getTemplateId(element: FileReferences | OneReference): string {
		if (element instanceof FileReferences) {
			return FileReferencesRenderer.id;
		} else {
			return OneReferenceRenderer.id;
		}
	}
}

export class StringRepresentationProvider implements IKeyboardNavigationLabelProvider<TreeElement> {

	constructor(@IKeybindingService private readonly _keybindingService: IKeybindingService) { }

	getKeyboardNavigationLabel(element: TreeElement): { toString(): string } {
		if (element instanceof OneReference) {
			const parts = element.parent.getPreview(element)?.preview(element.range);
			if (parts) {
				return parts.value;
			}
		}
		// FileReferences or unresolved OneReference
		return basename(element.uri);
	}

	mightProducePrintableCharacter(event: IKeyboardEvent): boolean {
		return this._keybindingService.mightProducePrintableCharacter(event);
	}
}

export class IdentityProvider implements IIdentityProvider<TreeElement> {

	getId(element: TreeElement): { toString(): string } {
		return element instanceof OneReference ? element.id : element.uri;
	}
}

//#region render: File

class FileReferencesTemplate extends Disposable {

	readonly file: IconLabel;
	readonly badge: CountBadge;

	constructor(
		container: HTMLElement,
		@ILabelService private readonly _labelService: ILabelService
	) {
		super();
		const parent = document.createElement('div');
		parent.classList.add('reference-file');
		this.file = this._register(new IconLabel(parent, { supportHighlights: true }));

		this.badge = new CountBadge(dom.append(parent, dom.$('.count')), {}, defaultCountBadgeStyles);

		container.appendChild(parent);
	}

	set(element: FileReferences, matches: IMatch[]) {
		const parent = dirname(element.uri);
		this.file.setLabel(
			this._labelService.getUriBasenameLabel(element.uri),
			this._labelService.getUriLabel(parent, { relative: true }),
			{ title: this._labelService.getUriLabel(element.uri), matches }
		);
		const len = element.children.length;
		this.badge.setCount(len);
		if (len > 1) {
			this.badge.setTitleFormat(localize('referencesCount', "{0} references", len));
		} else {
			this.badge.setTitleFormat(localize('referenceCount', "{0} reference", len));
		}
	}
}

export class FileReferencesRenderer implements ITreeRenderer<FileReferences, FuzzyScore, FileReferencesTemplate> {

	static readonly id = 'FileReferencesRenderer';

	readonly templateId: string = FileReferencesRenderer.id;

	constructor(@IInstantiationService private readonly _instantiationService: IInstantiationService) { }

	renderTemplate(container: HTMLElement): FileReferencesTemplate {
		return this._instantiationService.createInstance(FileReferencesTemplate, container);
	}
	renderElement(node: ITreeNode<FileReferences, FuzzyScore>, index: number, template: FileReferencesTemplate): void {
		template.set(node.element, createMatches(node.filterData));
	}
	disposeTemplate(templateData: FileReferencesTemplate): void {
		templateData.dispose();
	}
}

//#endregion

//#region render: Reference
class OneReferenceTemplate {

	readonly label: HighlightedLabel;

	constructor(container: HTMLElement) {
		this.label = new HighlightedLabel(container);
	}

	set(element: OneReference, score?: FuzzyScore): void {
		const preview = element.parent.getPreview(element)?.preview(element.range);
		if (!preview || !preview.value) {
			// this means we FAILED to resolve the document or the value is the empty string
			this.label.set(`${basename(element.uri)}:${element.range.startLineNumber + 1}:${element.range.startColumn + 1}`);
		} else {
			// render search match as highlight unless
			// we have score, then render the score
			const { value, highlight } = preview;
			if (score && !FuzzyScore.isDefault(score)) {
				this.label.element.classList.toggle('referenceMatch', false);
				this.label.set(value, createMatches(score));
			} else {
				this.label.element.classList.toggle('referenceMatch', true);
				this.label.set(value, [highlight]);
			}
		}
	}
}

export class OneReferenceRenderer implements ITreeRenderer<OneReference, FuzzyScore, OneReferenceTemplate> {

	static readonly id = 'OneReferenceRenderer';

	readonly templateId: string = OneReferenceRenderer.id;

	renderTemplate(container: HTMLElement): OneReferenceTemplate {
		return new OneReferenceTemplate(container);
	}
	renderElement(node: ITreeNode<OneReference, FuzzyScore>, index: number, templateData: OneReferenceTemplate): void {
		templateData.set(node.element, node.filterData);
	}
	disposeTemplate(): void {
	}
}

//#endregion


export class AccessibilityProvider implements IListAccessibilityProvider<FileReferences | OneReference> {

	getWidgetAriaLabel(): string {
		return localize('treeAriaLabel', "References");
	}

	getAriaLabel(element: FileReferences | OneReference): string | null {
		return element.ariaMessage;
	}
}
