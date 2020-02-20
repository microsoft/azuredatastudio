declare module 'linux-release-info' {
	namespace linuxReleaseInfo {
		/**
		 * Get Os release info (distribution name, version, arch, release, etc.) from '/etc/os-release' or '/usr/lib/os-release' files and from native os module. On Windows and Darwin platforms it only returns common node os module info (platform, hostname, release, and arch)
		 * {@param options} - input options of type {@link OsReleaseOptions} - allows user to request sync/async and point to custom file for discovery of release information on linux distributions. If absent, default is async call with no custom file specified.
		 * (@param debug) - whether the api call should spew debug information to the console. Default is false.
		 * {@link https://github.com/samuelcarreira/linux-release-info/blob/master/README.md }
		 */
		interface OsReleaseInfoApi {
			(options?: OsReleaseOptions, debug?: boolean): JSON | Promise<JSON>;
		}

		export interface OsReleaseOptions {
			/**
			 * api calling mode: async/sync - default is 'async'
			 */
			mode?: 'async'|'sync';
			/**
			 * path to custom file on the linux os that can be used to discover the distribution information
			 */
			customReleaseInfoFile?: string;

		}

	}
	const osReleaseInfo: linuxReleaseInfo.OsReleaseInfoApi;
	export = osReleaseInfo;
}
