/*-----------------------------------------------------------------------------
| Copyright (c) Jupyter Development Team.
| Distributed under the terms of the Modified BSD License.
|----------------------------------------------------------------------------*/

import { default as AnsiUp } from 'ansi_up';
import { IRenderMime } from 'sql/workbench/services/notebook/browser/outputs/renderMimeInterfaces';
import { URI } from 'vs/base/common/uri';


/**
 * Render HTML into a host node.
 *
 * @params options - The options for rendering.
 *
 * @returns A promise which resolves when rendering is complete.
 */
export function renderHTML(options: renderHTML.IOptions): Promise<void> {
	// Unpack the options.
	let {
		host,
		source,
		trusted,
		sanitizer,
		resolver,
		linkHandler,
		shouldTypeset,
		latexTypesetter
	} = options;

	let originalSource = source;

	// Bail early if the source is empty.
	if (!source) {
		host.textContent = '';
		return Promise.resolve(undefined);
	}

	// Sanitize the source if it is not trusted. This removes all
	// `<script>` tags as well as other potentially harmful HTML.
	if (!trusted) {
		originalSource = `${source}`;
		source = sanitizer.sanitize(source);
	}

	// Set the inner HTML of the host.
	host.innerHTML = source;

	if (host.getElementsByTagName('script').length > 0) {
		// If output it trusted, eval any script tags contained in the HTML.
		// This is not done automatically by the browser when script tags are
		// created by setting `innerHTML`.
		if (trusted) {
			Private.evalInnerHTMLScriptTags(host);
		} else {
			const container = document.createElement('div');
			const warning = document.createElement('pre');
			warning.textContent =
				'This HTML output contains inline scripts. Are you sure that you want to run arbitrary Javascript within your Notebook session?';
			const runButton = document.createElement('button');
			runButton.textContent = 'Run';
			runButton.onclick = event => {
				host.innerHTML = originalSource;
				Private.evalInnerHTMLScriptTags(host);
				host.removeChild(host.firstChild);
			};
			container.appendChild(warning);
			container.appendChild(runButton);
			host.insertBefore(container, host.firstChild);
		}
	}

	// Handle default behavior of nodes.
	Private.handleDefaults(host, resolver);

	// Patch the urls if a resolver is available.
	let promise: Promise<void>;
	if (resolver) {
		promise = Private.handleUrls(host, resolver, linkHandler);
	} else {
		promise = Promise.resolve(undefined);
	}

	// Return the final rendered promise.
	return promise.then(() => {
		if (shouldTypeset && latexTypesetter) {
			latexTypesetter.typeset(host);
		}
	});
}

/**
 * The namespace for the `renderHTML` function statics.
 */
export namespace renderHTML {
	/**
	 * The options for the `renderHTML` function.
	 */
	export interface IOptions {
		/**
		 * The host node for the rendered HTML.
		 */
		host: HTMLElement;

		/**
		 * The HTML source to render.
		 */
		source: string;

		/**
		 * Whether the source is trusted.
		 */
		trusted: boolean;

		/**
		 * The html sanitizer for untrusted source.
		 */
		sanitizer: IRenderMime.ISanitizer;

		/**
		 * An optional url resolver.
		 */
		resolver: IRenderMime.IResolver | null;

		/**
		 * An optional link handler.
		 */
		linkHandler: IRenderMime.ILinkHandler | null;

		/**
		 * Whether the node should be typeset.
		 */
		shouldTypeset: boolean;

		/**
		 * The LaTeX typesetter for the application.
		 */
		latexTypesetter: IRenderMime.ILatexTypesetter | null;
	}
}

/**
 * Render an image into a host node.
 *
 * @params options - The options for rendering.
 *
 * @returns A promise which resolves when rendering is complete.
 */
export function renderImage(
	options: renderImage.IRenderOptions
): Promise<void> {
	// Unpack the options.
	let {
		host,
		mimeType,
		source,
		width,
		height,
		needsBackground,
		unconfined
	} = options;

	// Clear the content in the host.
	host.textContent = '';

	// Create the image element.
	let img = document.createElement('img');

	// Set the source of the image.
	img.src = `data:${mimeType};base64,${source}`;

	// Set the size of the image if provided.
	if (typeof height === 'number') {
		img.height = height;
	}
	if (typeof width === 'number') {
		img.width = width;
	}

	if (needsBackground === 'light') {
		img.classList.add('jp-needs-light-background');
	} else if (needsBackground === 'dark') {
		img.classList.add('jp-needs-dark-background');
	}

	if (unconfined === true) {
		img.classList.add('jp-mod-unconfined');
	}

	// Add the image to the host.
	host.appendChild(img);

	// Return the rendered promise.
	return Promise.resolve(undefined);
}

/**
 * The namespace for the `renderImage` function statics.
 */
export namespace renderImage {
	/**
	 * The options for the `renderImage` function.
	 */
	export interface IRenderOptions {
		/**
		 * The image node to update with the content.
		 */
		host: HTMLElement;

		/**
		 * The mime type for the image.
		 */
		mimeType: string;

		/**
		 * The base64 encoded source for the image.
		 */
		source: string;

		/**
		 * The optional width for the image.
		 */
		width?: number;

		/**
		 * The optional height for the image.
		 */
		height?: number;

		/**
		 * Whether an image requires a background for legibility.
		 */
		needsBackground?: string;

		/**
		 * Whether the image should be unconfined.
		 */
		unconfined?: boolean;
	}
}

/**
 * Render LaTeX into a host node.
 *
 * @params options - The options for rendering.
 *
 * @returns A promise which resolves when rendering is complete.
 */
export function renderLatex(
	options: renderLatex.IRenderOptions
): Promise<void> {
	// Unpack the options.
	let { host, source, shouldTypeset, latexTypesetter } = options;

	// Set the source on the node.
	host.textContent = source;

	// Typeset the node if needed.
	if (shouldTypeset && latexTypesetter) {
		latexTypesetter.typeset(host);
	}

	// Return the rendered promise.
	return Promise.resolve(undefined);
}

/**
 * The namespace for the `renderLatex` function statics.
 */
export namespace renderLatex {
	/**
	 * The options for the `renderLatex` function.
	 */
	export interface IRenderOptions {
		/**
		 * The host node for the rendered LaTeX.
		 */
		host: HTMLElement;

		/**
		 * The LaTeX source to render.
		 */
		source: string;

		/**
		 * Whether the node should be typeset.
		 */
		shouldTypeset: boolean;

		/**
		 * The LaTeX typesetter for the application.
		 */
		latexTypesetter: IRenderMime.ILatexTypesetter | null;
	}
}

/**
 * The namespace for the `renderDataResource` function statics.
 */
export namespace renderDataResource {
	/**
	 * The options for the `renderDataResource` function.
	 */
	export interface IRenderOptions {
		/**
		 * The host node for the rendered LaTeX.
		 */
		host: HTMLElement;

		/**
		 * The DataResource source to render.
		 */
		source: string;
	}
}

/**
 * Render SVG into a host node.
 *
 * @params options - The options for rendering.
 *
 * @returns A promise which resolves when rendering is complete.
 */
export function renderSVG(options: renderSVG.IRenderOptions): Promise<void> {
	// Unpack the options.
	let { host, source, trusted, unconfined } = options;

	// Clear the content in the host.
	host.textContent = '';

	// Clear the content if there is no source.
	if (!source) {
		return Promise.resolve(undefined);
	}

	// Display a message if the source is not trusted.
	if (!trusted) {
		host.textContent =
			'Cannot display an untrusted SVG. Maybe you need to run the cell?';
		return Promise.resolve(undefined);
	}

	// Render in img so that user can save it easily
	const img = new Image();
	img.src = `data:image/svg+xml,${encodeURIComponent(source)}`;
	host.appendChild(img);

	if (unconfined === true) {
		host.classList.add('jp-mod-unconfined');
	}
	return Promise.resolve();
}

/**
 * The namespace for the `renderSVG` function statics.
 */
export namespace renderSVG {
	/**
	 * The options for the `renderSVG` function.
	 */
	export interface IRenderOptions {
		/**
		 * The host node for the rendered SVG.
		 */
		host: HTMLElement;

		/**
		 * The SVG source.
		 */
		source: string;

		/**
		 * Whether the source is trusted.
		 */
		trusted: boolean;

		/**
		 * Whether the svg should be unconfined.
		 */
		unconfined?: boolean;
	}
}

/**
 * Render text into a host node.
 *
 * @params options - The options for rendering.
 *
 * @returns A promise which resolves when rendering is complete.
 */
export function renderText(options: renderText.IRenderOptions): Promise<void> {
	// Unpack the options.
	let { host, source } = options;

	const ansiUp = new AnsiUp();
	ansiUp.escape_for_html = true;
	ansiUp.use_classes = true;

	// Create the HTML content.
	let content = ansiUp.ansi_to_html(source);

	// Set the inner HTML for the host node.
	host.innerHTML = `<pre>${content}</pre>`;

	// Return the rendered promise.
	return Promise.resolve(undefined);
}

/**
 * The namespace for the `renderText` function statics.
 */
export namespace renderText {
	/**
	 * The options for the `renderText` function.
	 */
	export interface IRenderOptions {
		/**
		 * The host node for the text content.
		 */
		host: HTMLElement;

		/**
		 * The source text to render.
		 */
		source: string;
	}
}

/**
 * The namespace for module implementation details.
 */
namespace Private {
	/**
	 * Eval the script tags contained in a host populated by `innerHTML`.
	 *
	 * When script tags are created via `innerHTML`, the browser does not
	 * evaluate them when they are added to the page. This function works
	 * around that by creating new equivalent script nodes manually, and
	 * replacing the originals.
	 */
	export function evalInnerHTMLScriptTags(host: HTMLElement): void {
		// Create a snapshot of the current script nodes.
		let scripts = host.getElementsByTagName('script');

		// Loop over each script node.
		for (let i = 0; i < scripts.length; i++) {
			let script = scripts.item(i);
			// Skip any scripts which no longer have a parent.
			if (!script.parentNode) {
				continue;
			}

			// Create a new script node which will be clone.
			let clone = document.createElement('script');

			// Copy the attributes into the clone.
			let attrs = script.attributes;
			for (let i = 0, n = attrs.length; i < n; ++i) {
				let { name, value } = attrs[i];
				clone.setAttribute(name, value);
			}

			// Copy the text content into the clone.
			clone.textContent = script.textContent;

			// Replace the old script in the parent.
			script.parentNode.replaceChild(clone, script);
		}
	}

	/**
	 * Handle the default behavior of nodes.
	 */
	export function handleDefaults(
		node: HTMLElement,
		resolver?: IRenderMime.IResolver
	): void {
		// Handle anchor elements.
		let anchors = node.getElementsByTagName('a');
		for (let i = 0; i < anchors.length; i++) {
			let path = anchors[i].href || '';
			let isLocal = isPathLocal(path, resolver);
			if (isLocal) {
				anchors[i].target = '_self';
			} else {
				anchors[i].target = '_blank';
			}
		}

		// Handle image elements.
		let imgs = node.getElementsByTagName('img');
		for (let i = 0; i < imgs.length; i++) {
			if (!imgs[i].alt) {
				imgs[i].alt = 'Image';
			}
		}
	}

	/**
	 * Resolve the relative urls in element `src` and `href` attributes.
	 *
	 * @param node - The head html element.
	 *
	 * @param resolver - A url resolver.
	 *
	 * @param linkHandler - An optional link handler for nodes.
	 *
	 * @returns a promise fulfilled when the relative urls have been resolved.
	 */
	export function handleUrls(
		node: HTMLElement,
		resolver: IRenderMime.IResolver,
		linkHandler: IRenderMime.ILinkHandler | null
	): Promise<void> {
		// Set up an array to collect promises.
		let promises: Promise<void>[] = [];

		// Handle HTML Elements with src attributes.
		let nodes = node.querySelectorAll('*[src]');
		for (let i = 0; i < nodes.length; i++) {
			promises.push(handleAttr(nodes[i] as HTMLElement, 'src', resolver));
		}

		// Handle anchor elements.
		let anchors = node.getElementsByTagName('a');
		for (let i = 0; i < anchors.length; i++) {
			promises.push(handleAnchor(anchors[i], resolver, linkHandler));
		}

		// Handle link elements.
		let links = node.getElementsByTagName('link');
		for (let i = 0; i < links.length; i++) {
			promises.push(handleAttr(links[i], 'href', resolver));
		}

		// Wait on all promises.
		return Promise.all(promises).then(() => undefined);
	}

	/**
	 * Apply ids to headers.
	 */
	export function headerAnchors(node: HTMLElement): void {
		let headerNames = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
		for (let headerType of headerNames) {
			let headers = node.getElementsByTagName(headerType);
			for (let i = 0; i < headers.length; i++) {
				let header = headers[i];
				header.id = encodeURIComponent(header.innerHTML.replace(/ /g, '-'));
				let anchor = document.createElement('a');
				anchor.target = '_self';
				anchor.textContent = '¶';
				anchor.href = '#' + header.id;
				anchor.classList.add('jp-InternalAnchorLink');
				header.appendChild(anchor);
			}
		}
	}

	/**
	 * Handle a node with a `src` or `href` attribute.
	 */
	function handleAttr(
		node: HTMLElement,
		name: 'src' | 'href',
		resolver: IRenderMime.IResolver
	): Promise<void> {
		let source = node.getAttribute(name) || '';
		let isLocal = isPathLocal(source, resolver);
		if (!source || !isLocal) {
			return Promise.resolve(undefined);
		}
		node.setAttribute(name, '');
		return resolver
			.resolveUrl(source)
			.then(path => {
				return resolver.getDownloadUrl(path);
			})
			.then(url => {
				// Check protocol again in case it changed:
				if (URI.parse(url).scheme !== 'data:') {
					// Bust caching for local src attrs.
					// https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/Using_XMLHttpRequest#Bypassing_the_cache
					url += (/\?/.test(url) ? '&' : '?') + new Date().getTime();
				}
				node.setAttribute(name, url);
			})
			.catch(err => {
				// If there was an error getting the url,
				// just make it an empty link.
				node.setAttribute(name, '');
			});
	}

	/**
	 * Handle an anchor node.
	 */
	function handleAnchor(
		anchor: HTMLAnchorElement,
		resolver: IRenderMime.IResolver,
		linkHandler: IRenderMime.ILinkHandler | null
	): Promise<void> {
		// Get the link path without the location prepended.
		// (e.g. "./foo.md#Header 1" vs "http://localhost:8888/foo.md#Header 1")
		let href = anchor.getAttribute('href') || '';
		let isLocal = isPathLocal(href, resolver);
		// Bail if it is not a file-like url.
		if (!href || !isLocal) {
			return Promise.resolve(undefined);
		}
		// Remove the hash until we can handle it.
		let hash = anchor.hash;
		if (hash) {
			// Handle internal link in the file.
			if (hash === href) {
				anchor.target = '_self';
				return Promise.resolve(undefined);
			}
			// For external links, remove the hash until we have hash handling.
			href = href.replace(hash, '');
		}
		// Get the appropriate file path.
		return resolver
			.resolveUrl(href)
			.then(path => {
				// Handle the click override.
				if (linkHandler) {
					linkHandler.handleLink(anchor, path, hash);
				}
				// Get the appropriate file download path.
				return resolver.getDownloadUrl(path);
			})
			.then(url => {
				// Set the visible anchor.
				anchor.href = url + hash;
			})
			.catch(err => {
				// If there was an error getting the url,
				// just make it an empty link.
				anchor.href = '';
			});
	}

	function isPathLocal(path: string, resolver: IRenderMime.IResolver): boolean {
		let isLocal: boolean;
		if (path && path.length > 0) {
			isLocal = resolver && resolver.isLocal
				? resolver.isLocal(path)
				: !!URI.parse(path).scheme;
		} else {
			// Empty string, so default to local
			isLocal = true;
		}
		return isLocal;
	}
}
