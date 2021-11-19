/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';
import * as path from 'vs/base/common/path';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { replaceInvalidLinkPath } from 'sql/workbench/contrib/notebook/common/utils';
import { isWindows } from 'vs/base/common/platform';

const useAbsolutePathConfigName = 'notebook.useAbsoluteFilePaths';

export class NotebookLinkHandler {
	private _notebookUriLink: URI;
	private _href: string;
	private _notebookDirectory: string;
	private _isAnchorLink: boolean;
	private _isFile: boolean;
	public readonly isAbsolutePath: boolean;
	public readonly isMarkdown: boolean;
	public readonly isEncoded: boolean;

	constructor(
		private _notebookURI: URI,
		private _link: string | HTMLAnchorElement,
		@IConfigurationService private _configurationService: IConfigurationService,
	) {
		/**
		 * If link is string
		 * 	- string link is passed in via onInsertButtonClick (markdownToolbar.component.ts)
		 *  - string in form of 'https://','http://', or 'file://'
		 * If link is HTMLAnchorElement
		 * 	- the node element is passed in via getCurrentLinkUrl() in markdownToolbar.component.ts
		 * 	- the node element is passed in via anchor rule in htmlMarkdownConverter.ts
		 * The link / href we receive is not escaped initially so we need to encode the special characters
		 * such as space and %20 to return the proper path.
		 * The link that we return should be the encoded, as that will allow the linkHandler to then decode the
		 * link via uri.parse to open the correct file or web link.
		 */
		if (typeof this._link === 'string') {
			this._notebookUriLink = URI.parse(this._link);
			this._isFile = this._notebookUriLink.scheme === 'file';
			this.isAbsolutePath = path.isAbsolute(this._link);
			this._isAnchorLink = this._link.includes('#') && this._isFile;
		} else {
			// HTMLAnchorElement
			// windows files need to use the link.href instead as it contains the file:// prefix
			// which enables us to get the proper relative path
			this.isAbsolutePath = this._link.attributes['is-absolute']?.nodeValue === 'true' ? true : false;
			this.isMarkdown = this._link.attributes['is-markdown']?.nodeValue === 'true' ? true : false;
			this.isEncoded = this._link.attributes['is-encoded']?.nodeValue === 'true' ? true : false;
			this._isFile = this._link.protocol === 'file:';
			// Given an anchor element for windows href link will need to use nodeValue instead as that does not encode the url
			if (isWindows) {
				this._href = this.isMarkdown || this.isEncoded ? this._link.href?.replace(/%5C/g, '\\') : this._link.attributes['href']?.nodeValue;
			} else {
				this._href = this._link.attributes['href']?.nodeValue;
			}
			this._notebookUriLink = this._href ? URI.parse(encodeURI(this._href)) : undefined;
			this._isAnchorLink = this._notebookUriLink?.fragment ? true : false;
		}
		this._notebookDirectory = this._notebookURI ? path.dirname(this._notebookURI.fsPath) : '';
	}

	/**
	 * Function to get the link for LinkCalloutDialog or htmlMarkdownConverter
	 * When a user inserts a new link via the LinkCalloutDialog it will go through the string case to
	 * get the absolute path of the file and then will be converted to anchor element that will be called again
	 * to the object case in which we will find the relative path of the file unless the user has the
	 * keep absolute setting enabled then we don't convert absolute paths to relative paths
	 * @returns the file link or web link
	 */
	public getLinkUrl(): string {
		// cases where we only have the href link
		if (typeof this._link === 'string') {
			// Does not convert absolute path to relative path
			if (this._isFile && this.isAbsolutePath && this._configurationService.getValue(useAbsolutePathConfigName) === true) {
				return this._link;
			}
			// sets the string to absolute path to be used to resolve
			if (this._isFile && !this.isAbsolutePath && !this._isAnchorLink) {
				const relativePath = (this._link).replace(/\\/g, path.posix.sep);
				const linkUrl = path.resolve(this._notebookDirectory, relativePath);
				return linkUrl;
			}
			/**
			 * We return the absolute path for the link so that it will get used in the as the href for the anchor HTML element
			 * (in linkCalloutDialog document.execCommand('insertHTML') and therefore will call getLinkURL() with HTMLAnchorElement to then get the relative path
			*/
			return this._link;
		} else {
			// cases where we pass the HTMLAnchorElement
			if (this._notebookUriLink && this._isFile) {
				let targetUri: URI;
				// Does not convert absolute path to relative path if keep Absolute Path setting is enabled
				if (this.isAbsolutePath && this._configurationService.getValue(useAbsolutePathConfigName) === true) {
					return this._href;
				} else {
					if (this._isAnchorLink) {
						targetUri = this.getUriAnchorLink(this._link, this._notebookURI);
					} else {
						//On Windows, if notebook is not trusted then the href attr is removed for all non-web URL links
						// href contains either a hyperlink or a URI-encoded absolute path. (See resolveUrls method in notebookMarkdown.ts)
						targetUri = this._link ? this._notebookUriLink : URI.file(this._link.title);
					}
					// returns relative path of target notebook to the current notebook directory
					if (this._notebookUriLink.fsPath !== this._notebookURI.fsPath && !targetUri?.fragment) {
						return findPathRelativeToContent(this._notebookDirectory, targetUri, this.isMarkdown, this.isEncoded);
					} else {
						// if the anchor link is to a section in the same notebook then just add the fragment
						return targetUri.fragment;
					}
				}
			}
			// Web links
			return this._href || '';
		}
	}

	/**
	 * Creates a URI for for a link with a anchor (#)
	 * @param node is the HTMLAnchorElement of the target notebook
	 * @param notebookUri is current notebook URI
	 * @returns URI of the link with the anchor
	 */
	public getUriAnchorLink(node, notebookUri: URI): URI {
		const sectionLinkToAnotherFile = node.href.includes('#') && !node.attributes.href?.nodeValue.startsWith('#');
		if (sectionLinkToAnotherFile) {
			let absolutePath = !path.isAbsolute(node.attributes.href?.nodeValue) ? path.resolve(path.dirname(notebookUri.fsPath), node.attributes.href?.nodeValue) : node.attributes.href?.nodeValue;
			// if section link is different from the current notebook
			return URI.file(absolutePath);
		} else {
			// else build an uri using the current notebookUri
			return URI.from({ scheme: 'file', path: notebookUri.path, fragment: node.attributes.href?.nodeValue });
		}
	}

}

/**
 * Finds the Relative Path from current notebook folder to target (linked) notebook
 * @param notebookFolder is the current notebook directory
 * @param contentPath is the URI path to the notebook we are linking to
 */
/**
 * Finds the Relative Path from current notebook folder to target (linked) notebook
 * @param notebookFolder is the current notebook directory
 * @param contentPath is the URI path to the notebook we are linking to
 * @param isMarkdown is checked to see if the link is already in markdown format
 * @param isEncoded is checked to know if the link is already encoded
 * @returns relative path from the current notebook to the target notebook
 */
export function findPathRelativeToContent(notebookFolder: string, contentPath: URI | undefined, isMarkdown?: boolean, isEncoded?: boolean): string {
	if (contentPath?.scheme === 'file') {
		let relativePath = contentPath.fragment ? path.relative(notebookFolder, contentPath.fsPath).concat('#', contentPath.fragment) : path.relative(notebookFolder, contentPath.fsPath);
		// if relativePath contains improper directory format due to marked js parsing returning an invalid path (ex. ....\) then we need to replace it to ensure the directories are formatted properly (ex. ..\..\)
		relativePath = isMarkdown || isEncoded ? replaceInvalidLinkPath(relativePath) : encodeURI(replaceInvalidLinkPath(relativePath)).replace(/%5C/g, '\\');
		if (relativePath.startsWith(path.join('..', path.sep)) || relativePath.startsWith(path.join('.', path.sep))) {
			return relativePath;
		} else {
			// if the relative path does not contain ./ at the beginning, we need to add it so it's recognized as a link
			return `.${path.join(path.sep, relativePath)}`;
		}
	}
	return '';
}
