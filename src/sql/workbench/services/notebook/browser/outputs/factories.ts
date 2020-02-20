/*-----------------------------------------------------------------------------
| Copyright (c) Jupyter Development Team.
| Distributed under the terms of the Modified BSD License.
|----------------------------------------------------------------------------*/

import * as widgets from 'sql/workbench/contrib/notebook/browser/outputs/widgets';
import { IRenderMime } from './renderMimeInterfaces';

/**
 * A mime renderer factory for raw html.
 */
export const htmlRendererFactory: IRenderMime.IRendererFactory = {
	safe: true,
	mimeTypes: ['text/html'],
	defaultRank: 50,
	createRenderer: options => new widgets.RenderedHTML(options)
};

/**
 * A mime renderer factory for images.
 */
export const imageRendererFactory: IRenderMime.IRendererFactory = {
	safe: true,
	mimeTypes: ['image/bmp', 'image/png', 'image/jpeg', 'image/gif'],
	defaultRank: 90,
	createRenderer: options => new widgets.RenderedImage(options)
};

// /**
//  * A mime renderer factory for LaTeX.
//  */
// export const latexRendererFactory: IRenderMime.IRendererFactory = {
//   safe: true,
//   mimeTypes: ['text/latex'],
//   defaultRank: 70,
//   createRenderer: options => new widgets.RenderedLatex(options)
// };

/**
 * A mime renderer factory for svg.
 */
export const svgRendererFactory: IRenderMime.IRendererFactory = {
	safe: false,
	mimeTypes: ['image/svg+xml'],
	defaultRank: 80,
	createRenderer: options => new widgets.RenderedSVG(options)
};

/**
 * A mime renderer factory for plain and jupyter console text data.
 */
export const textRendererFactory: IRenderMime.IRendererFactory = {
	safe: true,
	mimeTypes: [
		'text/plain',
		'application/vnd.jupyter.stdout',
		'application/vnd.jupyter.stderr'
	],
	defaultRank: 120,
	createRenderer: options => new widgets.RenderedText(options)
};

/**
 * A placeholder factory for deprecated rendered JavaScript.
 */
export const javaScriptRendererFactory: IRenderMime.IRendererFactory = {
	safe: false,
	mimeTypes: ['text/javascript', 'application/javascript'],
	defaultRank: 110,
	createRenderer: options => new widgets.RenderedJavaScript(options)
};

export const dataResourceRendererFactory: IRenderMime.IRendererFactory = {
	safe: true,
	mimeTypes: [
		'application/vnd.dataresource+json',
		'application/vnd.dataresource'
	],
	defaultRank: 40,
	createRenderer: options => new widgets.RenderedDataResource(options)
};

export const ipywidgetFactory: IRenderMime.IRendererFactory = {
	safe: false,
	mimeTypes: [
		'application/vnd.jupyter.widget-view',
		'application/vnd.jupyter.widget-view+json'
	],
	defaultRank: 45,
	createRenderer: options => new widgets.RenderedIPyWidget(options)
};

/**
 * The standard factories provided by the rendermime package.
 */
export const standardRendererFactories: ReadonlyArray<IRenderMime.IRendererFactory> = [
	htmlRendererFactory,
	// latexRendererFactory,
	svgRendererFactory,
	imageRendererFactory,
	javaScriptRendererFactory,
	textRendererFactory,
	dataResourceRendererFactory,
	ipywidgetFactory
];
