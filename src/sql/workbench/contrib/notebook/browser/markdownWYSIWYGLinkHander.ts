import { URI } from 'vs/base/common/uri';
import * as path from 'vs/base/common/path';

export class MarkdownWYSIWYGLinkHandler {
	private _isAnchorLink: boolean | undefined;
	private _isFile: boolean | undefined;
	private _isAbsolutePath: boolean | undefined;
	private _notebookDirectory: string;
	private _href: URI | undefined;

	constructor(private _notebookURI: URI, private _path: string | HTMLAnchorElement) {
		if (typeof this._path === 'string') {
			this._href = URI.parse(this._path);
			this._isFile = this._href.scheme === 'file';
			this._isAbsolutePath = path.isAbsolute(this._path);
			this._isAnchorLink = this._path.includes('#') && this._isFile;
		} else {
			this._href = this._path.attributes['href']?.nodeValue ? URI.parse(this._path.attributes['href']?.nodeValue) : undefined;
			this._isFile = this._path.protocol === 'file:';
			this._isAnchorLink = this._href?.fragment ? true : false;
			this._isAbsolutePath = this._path.attributes['is-absolute']?.nodeValue === 'true' ? true : false;
		}
		this._notebookDirectory = this._notebookURI ? path.dirname(this._notebookURI.fsPath) : '';
	}

	public getLinkUrl(): string {
		switch (typeof this._path) {
			case 'string': {
				if (this._isFile && !this._isAbsolutePath && !this._isAnchorLink) {
					const relativePath = (this._path).replace(/\\/g, path.posix.sep);
					const linkUrl = path.resolve(this._notebookDirectory, relativePath);
					return linkUrl;
				}
				return this._path;
			}
			case 'object': {
				if (this._href) {
					if (this._isFile) {
						if (!this._isAbsolutePath) {
							let absoluteURI: URI;
							if (this._isAnchorLink) {
								absoluteURI = this.getUriAnchorLink(this._path, this._notebookURI);
							} else {
								absoluteURI = this._href;
							}
							if (this._href.fsPath !== path.posix.sep) {
								return findPathRelativeToContent(this._notebookDirectory, absoluteURI);
							}
							return absoluteURI.fragment;
						}
					}
					return this._href.fsPath;
				}
				return '';
			}
		}
	}

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

export function findPathRelativeToContent(notebookFolder: string, contentPath: URI | undefined): string {
	if (notebookFolder) {
		if (contentPath?.scheme === 'file') {
			let relativePath = contentPath.fragment ? path.relative(notebookFolder, contentPath.fsPath).concat('#', contentPath.fragment) : path.relative(notebookFolder, contentPath.fsPath);
			//if path contains whitespaces then it's not identified as a link
			relativePath = relativePath.replace(/\s/g, '%20');
			if (relativePath.startsWith(path.join('..', path.sep) || path.join('.', path.sep))) {
				return relativePath;
			} else {
				// if the relative path does not contain ./ at the beginning, we need to add it so it's recognized as a link
				return `.${path.join(path.sep, relativePath)}`;
			}
		}
	}
	return '';
}
