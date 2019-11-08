
/*-----------------------------------------------------------------------------
| Copyright (c) Jupyter Development Team.
| Distributed under the terms of the Modified BSD License.
|----------------------------------------------------------------------------*/
import { ReadonlyJSONObject } from '../../common/models/jsonext';
import { IThemeService } from 'vs/platform/theme/common/themeService';

/**
 * A namespace for rendermime associated interfaces.
 */
export namespace IRenderMime {
	/**
	 * A model for mime data.
	 */
	export interface IMimeModel {
		/**
		 * Whether the data in the model is trusted.
		 */
		readonly trusted: boolean;

		/**
		 * The data associated with the model.
		 */
		readonly data: ReadonlyJSONObject;

		/**
		 * The metadata associated with the model.
		 */
		readonly metadata: ReadonlyJSONObject;

		/**
		 * Set the data associated with the model.
		 *
		 * #### Notes
		 * Calling this function may trigger an asynchronous operation
		 * that could cause the renderer to be rendered with a new model
		 * containing the new data.
		 */
		setData(options: ISetDataOptions): void;

		/**
		 * Theme service used to react to theme change events
		 */
		readonly themeService: IThemeService;
	}

	/**
	 * The options used to update a mime model.
	 */
	export interface ISetDataOptions {
		/**
		 * The new data object.
		 */
		data?: ReadonlyJSONObject;

		/**
		 * The new metadata object.
		 */
		metadata?: ReadonlyJSONObject;
	}

	/**
	 * A widget which displays the contents of a mime model.
	 */
	export interface IRenderer {
		/**
		 * Render a mime model.
		 *
		 * @param model - The mime model to render.
		 *
		 * @returns A promise which resolves when rendering is complete.
		 *
		 * #### Notes
		 * This method may be called multiple times during the lifetime
		 * of the widget to update it if and when new data is available.
		 */
		renderModel(model: IRenderMime.IMimeModel): Promise<void>;

		/**
		 * Node to be updated by the renderer
		 */
		node: HTMLElement;
	}

	/**
	 * The interface for a renderer factory.
	 */
	export interface IRendererFactory {
		/**
		 * Whether the factory is a "safe" factory.
		 *
		 * #### Notes
		 * A "safe" factory produces renderer widgets which can render
		 * untrusted model data in a usable way. *All* renderers must
		 * handle untrusted data safely, but some may simply failover
		 * with a "Run cell to view output" message. A "safe" renderer
		 * is an indication that its sanitized output will be useful.
		 */
		readonly safe: boolean;

		/**
		 * The mime types handled by this factory.
		 */
		readonly mimeTypes: ReadonlyArray<string>;

		/**
		 * The default rank of the factory.  If not given, defaults to 100.
		 */
		readonly defaultRank?: number;

		/**
		 * Create a renderer which displays the mime data.
		 *
		 * @param options - The options used to render the data.
		 */
		createRenderer(options: IRendererOptions): IRenderer;
	}

	/**
	 * The options used to create a renderer.
	 */
	export interface IRendererOptions {
		/**
		 * The preferred mimeType to render.
		 */
		mimeType: string;

		/**
		 * The html sanitizer.
		 */
		sanitizer: ISanitizer;

		/**
		 * An optional url resolver.
		 */
		resolver?: IResolver | null;

		/**
		 * An optional link handler.
		 */
		linkHandler?: ILinkHandler | null;

		/**
		 * The LaTeX typesetter.
		 */
		latexTypesetter?: ILatexTypesetter | null;
	}

	/**
	 * An object that handles html sanitization.
	 */
	export interface ISanitizer {
		/**
		 * Sanitize an HTML string.
		 */
		sanitize(dirty: string): string;
	}

	/**
	 * An object that handles links on a node.
	 */
	export interface ILinkHandler {
		/**
		 * Add the link handler to the node.
		 *
		 * @param node: the node for which to handle the link.
		 *
		 * @param path: the path to open when the link is clicked.
		 *
		 * @param id: an optional element id to scroll to when the path is opened.
		 */
		handleLink(node: HTMLElement, path: string, id?: string): void;
	}

	/**
	 * An object that resolves relative URLs.
	 */
	export interface IResolver {
		/**
		 * Resolve a relative url to a correct server path.
		 */
		resolveUrl(url: string): Promise<string>;

		/**
		 * Get the download url of a given absolute server path.
		 */
		getDownloadUrl(path: string): Promise<string>;

		/**
		 * Whether the URL should be handled by the resolver
		 * or not.
		 *
		 * #### Notes
		 * This is similar to the `isLocal` check in `URLExt`,
		 * but can also perform additional checks on whether the
		 * resolver should handle a given URL.
		 */
		isLocal?: (url: string) => boolean;
	}

	/**
	 * The interface for a LaTeX typesetter.
	 */
	export interface ILatexTypesetter {
		/**
		 * Typeset a DOM element.
		 *
		 * @param element - the DOM element to typeset. The typesetting may
		 *   happen synchronously or asynchronously.
		 *
		 * #### Notes
		 * The application-wide rendermime object has a settable
		 * `latexTypesetter` property which is used wherever LaTeX
		 * typesetting is required. Extensions wishing to provide their
		 * own typesetter may replace that on the global `lab.rendermime`.
		 */
		typeset(element: HTMLElement): void;
	}
}
