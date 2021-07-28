import { URI } from 'vs/base/common/uri';
import * as path from 'vs/base/common/path';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

const keepAbsolutePathConfigName = 'notebook.keepAbsolutePath';

export class NotebookLinkHandler {
	private _notebookUriLink: URI | undefined;
	private _href: string | undefined;
	private _notebookDirectory: string;
	private _isAnchorLink: boolean | undefined;
	private _isFile: boolean | undefined;
	private _isAbsolutePath: boolean | undefined;

	constructor(private _notebookURI: URI, private _link: string | HTMLAnchorElement, private _configurationService: IConfigurationService) {
		if (typeof this._link === 'string') {
			this._notebookUriLink = URI.parse(this._link);
			this._isFile = this._notebookUriLink.scheme === 'file';
			this._isAbsolutePath = path.isAbsolute(this._link);
			this._isAnchorLink = this._link.includes('#') && this._isFile;
		} else {
			// HTMLAnchorElement
			this._notebookUriLink = this._link.attributes['href']?.nodeValue ? URI.parse(this._link.attributes['href']?.nodeValue) : undefined;
			this._href = this._link.attributes['href']?.nodeValue;
			this._isFile = this._link.protocol === 'file:';
			this._isAnchorLink = this._notebookUriLink?.fragment ? true : false;
			this._isAbsolutePath = this._link.attributes['is-absolute']?.nodeValue === 'true' ? true : false;
		}
		this._notebookDirectory = this._notebookURI ? path.dirname(this._notebookURI.fsPath) : '';
	}

	/**
	 * Function to get the link for LinkCalloutDialog or htmlMarkdownConverter
	 * Always return a relative path given a absolute or relative path.
	 * Only return absolute path if Keep Absolute setting is enabled for absolute paths.
	 * Given a anchor element then we must traverse
	 * @returns the file link or web link in string
	 */
	public getLinkUrl(): string {
		switch (typeof this._link) {
			// cases where we only have the href link
			case 'string': {
				// Does not convert absolute path to relative path
				if (this._isFile && this._isAbsolutePath && this._configurationService.getValue(keepAbsolutePathConfigName) === true) {
					return this._link;
				}
				// returns the relative path of the target link to the current notebook
				if (this._isFile && !this._isAbsolutePath && !this._isAnchorLink) {
					const relativePath = (this._link).replace(/\\/g, path.posix.sep);
					const linkUrl = path.resolve(this._notebookDirectory, relativePath);
					return linkUrl;
				}
				return this._link;
			}
			// cases where we pass the HTMLAnchorElement
			case 'object': {
				if (this._notebookUriLink && this._isFile) {
					if (!this._isAbsolutePath) {
						let targetUri: URI;
						if (this._isAnchorLink) {
							targetUri = this.getUriAnchorLink(this._link, this._notebookURI);
						} else {
							targetUri = this._notebookUriLink;
						}
						// returns relative path of target notebook whether anchored or not
						if (this._notebookUriLink.fsPath !== path.posix.sep) {
							return findPathRelativeToContent(this._notebookDirectory, targetUri);
						}
						return targetUri.fragment;
						// Does not convert absolute path to relative path
					} else if (this._isFile && this._isAbsolutePath && this._configurationService.getValue(keepAbsolutePathConfigName) === true) {
						return this._href;
					}
				}
				return this._href || '';
			}
		}
	}

	/**
	 * Creates a URI for for a link with a anchor (#)
	 * @param node is the HTMLAnchorElement of the target notebook
	 * @param notebookUri is current notebook URI
	 * @returns URI
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

	public get isAbsolutePath(): boolean {
		return this._isAbsolutePath;
	}
}

/**
 * Finds the Relative Path from current notebook folder to target (linked) notebook
 * @param notebookFolder is the current notebook directory
 * @param contentPath is the URI path to the notebook we are linking to
 * @returns relative path from the current notebook to the target notebook
 */
export function findPathRelativeToContent(notebookFolder: string, contentPath: URI | undefined): string {
	if (contentPath?.scheme === 'file') {
		let relativePath = contentPath.fragment ? path.relative(notebookFolder, contentPath.fsPath).concat('#', contentPath.fragment) : path.relative(notebookFolder, contentPath.fsPath);
		//if path contains whitespaces then it's not identified as a link
		relativePath = relativePath.replace(/\s/g, '%20');
		if (relativePath.startsWith(path.join('..', path.sep)) || relativePath.startsWith(path.join('.', path.sep))) {
			return relativePath;
		} else {
			// if the relative path does not contain ./ at the beginning, we need to add it so it's recognized as a link
			return `.${path.join(path.sep, relativePath)}`;
		}
	}
	return '';
}
