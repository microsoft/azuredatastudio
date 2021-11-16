class QueryResultsMode {
	constructor(private _mode: ('Grid' | 'Text' | 'File' | string) = 'Grid') {
	}

	public get selectedMode(): 'Grid' | 'Text' | 'File' | string {
		return this._mode;
	}

	public set selectedMode(mode: 'Grid' | 'Text' | 'File' | string) {
		this._mode = mode;
	}
}

// TODO lewissanchez: Need to find a better way to do this
export const queryResultsMode = new QueryResultsMode();
