/*-----------------------------------------------------------------------------
| Copyright (c) Jupyter Development Team.
| Distributed under the terms of the Modified BSD License.
|----------------------------------------------------------------------------*/

import { IRenderMime } from 'sql/workbench/services/notebook/browser/outputs/renderMimeInterfaces';
import { ReadonlyJSONObject } from 'sql/workbench/services/notebook/common/jsonext';
import { IAccessibilityService } from 'vs/platform/accessibility/common/accessibility';
import { IThemeService } from 'vs/platform/theme/common/themeService';

/**
 * The default mime model implementation.
 */
export class MimeModel implements IRenderMime.IMimeModel {
	/**
	 * Construct a new mime model.
	 */
	constructor(options: MimeModel.IOptions = {}) {
		this.trusted = !!options.trusted;
		this._data = options.data || {};
		this._metadata = options.metadata || {};
		this._callback = options.callback;
		this._themeService = options.themeService;
		this._accessibilityService = options.accessibilityService;
	}

	/**
	 * Whether the model is trusted.
	 */
	readonly trusted: boolean;

	/**
	 * The data associated with the model.
	 */
	get data(): ReadonlyJSONObject {
		return this._data;
	}

	/**
	 * The metadata associated with the model.
	 */
	get metadata(): ReadonlyJSONObject {
		return this._metadata;
	}

	get themeService(): IThemeService {
		return this._themeService;
	}

	get accessibilityService(): IAccessibilityService {
		return this._accessibilityService;
	}

	/**
	 * Set the data associated with the model.
	 *
	 * #### Notes
	 * Depending on the implementation of the mime model,
	 * this call may or may not have deferred effects,
	 */
	setData(options: IRenderMime.ISetDataOptions): void {
		this._data = options.data || this._data;
		this._metadata = options.metadata || this._metadata;
		this._callback(options);
	}

	private _callback: (options: IRenderMime.ISetDataOptions) => void;
	private _data: ReadonlyJSONObject;
	private _metadata: ReadonlyJSONObject;
	private _themeService: IThemeService;
	private _accessibilityService: IAccessibilityService;
}

/**
 * The namespace for MimeModel class statics.
 */
export namespace MimeModel {
	/**
	 * The options used to create a mime model.
	 */
	export interface IOptions {
		/**
		 * Whether the model is trusted.  Defaults to `false`.
		 */
		trusted?: boolean;

		/**
		 * A callback function for when the data changes.
		 */
		callback?: (options: IRenderMime.ISetDataOptions) => void;

		/**
		 * The initial mime data.
		 */
		data?: ReadonlyJSONObject;

		/**
		 * The initial mime metadata.
		 */
		metadata?: ReadonlyJSONObject;

		/**
		 * Theme service used to react to theme change events
		 */
		themeService?: IThemeService;

		accessibilityService?: IAccessibilityService;
	}
}
