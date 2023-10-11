## Integration tests

This extension is for running tests against specific features that require a connection to an actual server.

Unit tests that don't require this should be added as tests to the extensions or core directly.

Tests that require user interaction should be added to the smoke tests - see https://github.com/microsoft/azuredatastudio/blob/main/test/smoke/README.md for more information.

##### Folders
* `extensionInstallers` folder: VSIX packages of non-builtin extensions should be put here for the tests to run with, they will be installed upon startup of the tests.
* `src/test` folder: This is where the test files for features should be added, name the file like this: `feature.test.ts` e.g. `objectExplorer.test.ts`

## How to run the test

When these tests are ran, Azure Data Studio will be launched using new temp folders for installed extensions and data so that your local dev environment won't be changed.

1. In the build pipeline:
The integration test suite has been added to ADS windows pipeline to run the test and report the results, you can find the test results under the test tab.

2. Local environment:
	1. Install [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
	1. Close all currently active VS Code windows
	1. Open a terminal window/command line window
	1. Run `az login` to login with your Microsoft AAD account.
	1. Navigate to this folder and then run `node setEnvironmentVariables.js`, there are different options, by default VS Code will be opened.
		1. Terminal(Mac)/CMD(Windows): `node setEnvironmentVariables.js Terminal`
		2. Git-Bash on Windows: `node setEnvironmentVariables.js BashWin`
	1. A new window will be opened based on your selection and the new window will have the required environment variables set.
	2. In the new window navigate to the scripts folder and run sql-test-integration.[bat|sh]

## Skipping Python Installation Tests

The integration tests contain some tests that test the Python installation for Notebooks. This can take a long time to run and so if you do not need to run them you can skip them by setting the `SKIP_PYTHON_INSTALL_TEST` environment variable to `1`

## How to debug the tests
1. Set the debug target to `Attach to Extension Host`
1. Run the script to start the tests
1. Wait for the Window to reload (it does this after installing and activating the extensions)
1. Run the debug target - it should now attach to the Extension Host process and hit breakpoints set in the integration tests

## Code Coverage

Code coverage is enabled by default. After running the tests you can find the results in the `coverage` folder at the root of this extension.

This code coverage covers extension code only - it will not instrument code from the core.
