/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as renderers from './renderers';
import { Deferred } from 'sql/base/common/promise';
import { ReadonlyJSONObject } from 'sql/workbench/services/notebook/common/jsonext';
import * as tableRenderers from 'sql/workbench/contrib/notebook/browser/outputs/tableRenderers';
import type { IRenderMime } from 'sql/workbench/services/notebook/browser/outputs/renderMimeInterfaces';

/**
 * A common base class for mime renderers.
 */
export abstract class RenderedCommon implements IRenderMime.IRenderer {
	private _node: HTMLElement;
	private cachedClasses: string[] = [];
	/**
	 * Construct a new rendered common widget.
	 *
	 * @param options - The options for initializing the widget.
	 */
	constructor(options: IRenderMime.IRendererOptions) {
		this.mimeType = options.mimeType;
		this.sanitizer = options.sanitizer;
		this.resolver = options.resolver;
		this.linkHandler = options.linkHandler;
		this.latexTypesetter = options.latexTypesetter;
	}

	public get node(): HTMLElement {
		return this._node;
	}

	public set node(value: HTMLElement) {
		this._node = value;
		value.dataset['mimeType'] = this.mimeType;
		this._node.classList.add(...this.cachedClasses);
		this.cachedClasses = [];
	}

	toggleClass(className: string, enabled: boolean): void {
		if (enabled) {
			this.addClass(className);
		} else {
			this.removeClass(className);
		}
	}

	addClass(className: string): void {
		if (!this._node) {
			this.cachedClasses.push(className);
		} else if (!this._node.classList.contains(className)) {
			this._node.classList.add(className);
		}
	}

	removeClass(className: string): void {
		if (!this._node) {
			this.cachedClasses = this.cachedClasses.filter(c => c !== className);
		} else if (this._node.classList.contains(className)) {
			this._node.classList.remove(className);
		}
	}

	/**
	 * The mimetype being rendered.
	 */
	readonly mimeType: string;

	/**
	 * The sanitizer used to sanitize untrusted html inputs.
	 */
	readonly sanitizer: IRenderMime.ISanitizer;

	/**
	 * The resolver object.
	 */
	readonly resolver: IRenderMime.IResolver | null;

	/**
	 * The link handler.
	 */
	readonly linkHandler: IRenderMime.ILinkHandler | null;

	/**
	 * The latexTypesetter.
	 */
	readonly latexTypesetter: IRenderMime.ILatexTypesetter;

	/**
	 * Render a mime model.
	 *
	 * @param model - The mime model to render.
	 *
	 * @returns A promise which resolves when rendering is complete.
	 */
	renderModel(model: IRenderMime.IMimeModel): Promise<void> {
		// TODO compare model against old model for early bail?

		// Toggle the trusted class on the widget.
		this.toggleClass('jp-mod-trusted', model.trusted);

		// Render the actual content.
		return this.render(model);
	}

	/**
	 * Render the mime model.
	 *
	 * @param model - The mime model to render.
	 *
	 * @returns A promise which resolves when rendering is complete.
	 */
	abstract render(model: IRenderMime.IMimeModel): Promise<void>;
}

/**
 * A common base class for HTML mime renderers.
 */
export abstract class RenderedHTMLCommon extends RenderedCommon {
	/**
	 * Construct a new rendered HTML common widget.
	 *
	 * @param options - The options for initializing the widget.
	 */
	constructor(options: IRenderMime.IRendererOptions) {
		super(options);
		this.addClass('jp-RenderedHTMLCommon');
	}
}

/**
 * A mime renderer for displaying HTML and math.
 */
export class RenderedHTML extends RenderedHTMLCommon {
	/**
	 * Construct a new rendered HTML widget.
	 *
	 * @param options - The options for initializing the widget.
	 */
	constructor(options: IRenderMime.IRendererOptions) {
		super(options);
		this.addClass('jp-RenderedHTML');
	}

	/**
	 * Render a mime model.
	 *
	 * @param model - The mime model to render.
	 *
	 * @returns A promise which resolves when rendering is complete.
	 */
	render(model: IRenderMime.IMimeModel): Promise<void> {
		return renderers.renderHTML({
			host: this.node,
			source: String(model.data[this.mimeType]),
			trusted: model.trusted,
			resolver: this.resolver,
			sanitizer: this.sanitizer,
			linkHandler: this.linkHandler,
			shouldTypeset: true, //this.isAttached,
			latexTypesetter: this.latexTypesetter
		});
	}

	// /**
	//  * A message handler invoked on an `'after-attach'` message.
	//  */
	// onAfterAttach(msg: Message): void {
	//     if (this.latexTypesetter) {
	//         this.latexTypesetter.typeset(this.node);
	//     }
	// }
}

// /**
//  * A mime renderer for displaying LaTeX output.
//  */
// export class RenderedLatex extends RenderedCommon {
//     /**
//      * Construct a new rendered LaTeX widget.
//      *
//      * @param options - The options for initializing the widget.
//      */
//     constructor(options: IRenderMime.IRendererOptions) {
//         super(options);
//         this.addClass('jp-RenderedLatex');
//     }

//     /**
//      * Render a mime model.
//      *
//      * @param model - The mime model to render.
//      *
//      * @returns A promise which resolves when rendering is complete.
//      */
//     render(model: IRenderMime.IMimeModel): Promise<void> {
//         return renderers.renderLatex({
//             host: this.node,
//             source: String(model.data[this.mimeType]),
//             shouldTypeset: this.isAttached,
//             latexTypesetter: this.latexTypesetter
//         });
//     }

//     /**
//      * A message handler invoked on an `'after-attach'` message.
//      */
//     onAfterAttach(msg: Message): void {
//         if (this.latexTypesetter) {
//             this.latexTypesetter.typeset(this.node);
//         }
//     }
// }

/**
 * A mime renderer for displaying images.
 */
export class RenderedImage extends RenderedCommon {
	/**
	 * Construct a new rendered image widget.
	 *
	 * @param options - The options for initializing the widget.
	 */
	constructor(options: IRenderMime.IRendererOptions) {
		super(options);
		this.addClass('jp-RenderedImage');
	}

	/**
	 * Render a mime model.
	 *
	 * @param model - The mime model to render.
	 *
	 * @returns A promise which resolves when rendering is complete.
	 */
	render(model: IRenderMime.IMimeModel): Promise<void> {
		let metadata = model.metadata[this.mimeType] as ReadonlyJSONObject;
		return renderers.renderImage({
			host: this.node,
			mimeType: this.mimeType,
			source: String(model.data[this.mimeType]),
			width: metadata && (metadata.width as number | undefined),
			height: metadata && (metadata.height as number | undefined),
			needsBackground: model.metadata['needs_background'] as string | undefined,
			unconfined: metadata && (metadata.unconfined as boolean | undefined)
		});
	}
}

/**
 * A widget for displaying SVG content.
 */
export class RenderedSVG extends RenderedCommon {
	/**
	 * Construct a new rendered SVG widget.
	 *
	 * @param options - The options for initializing the widget.
	 */
	constructor(options: IRenderMime.IRendererOptions) {
		super(options);
		this.addClass('jp-RenderedSVG');
	}

	/**
	 * Render a mime model.
	 *
	 * @param model - The mime model to render.
	 *
	 * @returns A promise which resolves when rendering is complete.
	 */
	render(model: IRenderMime.IMimeModel): Promise<void> {
		let metadata = model.metadata[this.mimeType] as ReadonlyJSONObject;
		return renderers.renderSVG({
			host: this.node,
			source: String(model.data[this.mimeType]),
			trusted: model.trusted,
			unconfined: metadata && (metadata.unconfined as boolean | undefined)
		});
	}

	// /**
	//  * A message handler invoked on an `'after-attach'` message.
	//  */
	// onAfterAttach(msg: Message): void {
	//     if (this.latexTypesetter) {
	//         this.latexTypesetter.typeset(this.node);
	//     }
	// }
}

/**
 * A widget for displaying plain text and console text.
 */
export class RenderedText extends RenderedCommon {
	/**
	 * Construct a new rendered text widget.
	 *
	 * @param options - The options for initializing the widget.
	 */
	constructor(options: IRenderMime.IRendererOptions) {
		super(options);
		this.addClass('jp-RenderedText');
	}

	/**
	 * Render a mime model.
	 *
	 * @param model - The mime model to render.
	 *
	 * @returns A promise which resolves when rendering is complete.
	 */
	render(model: IRenderMime.IMimeModel): Promise<void> {
		return renderers.renderText({
			host: this.node,
			source: String(model.data[this.mimeType])
		});
	}
}

/**
 * A widget for displaying deprecated JavaScript output.
 */
export class RenderedJavaScript extends RenderedCommon {
	/**
	 * Construct a new rendered text widget.
	 *
	 * @param options - The options for initializing the widget.
	 */
	constructor(options: IRenderMime.IRendererOptions) {
		super(options);
		this.addClass('jp-RenderedJavaScript');
	}

	/**
	 * Render a mime model.
	 *
	 * @param model - The mime model to render.
	 *
	 * @returns A promise which resolves when rendering is complete.
	 */
	render(model: IRenderMime.IMimeModel): Promise<void> {
		return renderers.renderText({
			host: this.node,
			source: 'JavaScript output is disabled in Notebooks'
		});
	}
}

/**
 * A widget for displaying Data Resource schemas and data.
 */
export class RenderedDataResource extends RenderedCommon {
	/**
	 * Construct a new rendered data resource widget.
	 *
	 * @param options - The options for initializing the widget.
	 */
	constructor(options: IRenderMime.IRendererOptions) {
		super(options);
		this.addClass('jp-RenderedDataResource');
	}

	/**
	 * Render a mime model.
	 *
	 * @param model - The mime model to render.
	 *
	 * @returns A promise which resolves when rendering is complete.
	 */
	render(model: IRenderMime.IMimeModel): Promise<void> {
		return tableRenderers.renderDataResource({
			host: this.node,
			source: JSON.stringify(model.data[this.mimeType]),
			themeService: model.themeService
		});
	}
}

/**
 * A dummy widget for (not) displaying ipywidgets.
 */
export class RenderedIPyWidget extends RenderedCommon {
	/**
	 * Construct a new rendered widget.
	 *
	 * @param options - The options for initializing the widget.
	 */
	constructor(options: IRenderMime.IRendererOptions) {
		super(options);
		this.addClass('jp-RenderedIPyWidget');
	}

	/**
	 * Render a mime model.
	 *
	 * @param model - The mime model to render.
	 *
	 * @returns A promise which resolves when rendering is complete.
	 */
	render(model: IRenderMime.IMimeModel): Promise<void> {
		let deferred = new Deferred<void>();
		deferred.resolve();
		return deferred.promise;
	}
}
