declare module 'find-remove' {
	namespace findRemove {
		interface FindRemoveApi {
			(path: string, options: FindRemoveOptions): JSON;
		}

		interface FindRemoveOptions {
			age?: {
				seconds?: number;
			};
			limit?: number;
		}
	}

	const findRemove: findRemove.FindRemoveApi;
	export = findRemove;
}
