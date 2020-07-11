## Integration tests
The integration-tests suite is based on the extension testing feature provided by VS Code, We can use this for:
* Commands for setting up the environment for feature testing.
* Adding test cases that do not need UI interaction or the test scenarios not supported by the UI automation framework (e.g. object explorer context menu – not html based)

##### Folders
* extensionInstallers folder: Copy the VISX installers for the extensions we would like to run the tests with.
* src folder: This is where the test file for features should be added, name the file like this: feature.test.ts. e.g. objectExplorer.test.ts

## UI automation testing
The UI automation test cases should be added under $root/test/smoke/src/sql folder. Each feature should create its own folder and add 2 files, one for accessing the feature and the other for the test cases. For example: objectExplorer.ts and objectExplorer.test.ts. only tested on Windows for now.

For both Smoke test and Integration test, ADS will be launched using new temp folders: extension folder and data folder so that your local dev environment won't be changed.

## How to run the test
1. In the build pipeline:
The integration test suite has been added to ADS windows pipeline to run the test and report the results, you can find the test results under the test tab.

2. Local environment:
	1. Close all currently active VS Code windows
	1. open a terminal window/command line window
	1. navigate to this folder and then run 'node setEnvironmentVariables.js', there are different options, by default VSCode will be opened.
		1. Terminal(Mac)/CMD(Windows): node setEnvironmentVariables.js Terminal
		2. Git-Bash on Windows: node setEnvironmentVariables.js BashWin
	1. Follow the instructions in the window: you will be prompted to login to azure portal.
	1. A new window will be opened based on your selection and the new window will have the required environment variables set.
	1. Run the Test:
		1. For Integration Test: in the new window navigate to the scripts folder and run sql-test-integration.bat or sql-test-integration.sh based on your environment.
		2. Smoke Test can be launched in 2 ways:
			1. In the new window navigate to the test/smoke folder and run: node smoke/index.js
			2. Or, In a VSCode window opened by step above, open AzureDataStudio folder and then select the 'Launch Smoke Test' option.

## How to debug the tests
1. Set the debug target to `Attach to Extension Host`
1. Run the script to start the tests
1. Wait for the Window to reload (it does this after installing and activating the extensions)
1. Run the debug target - it should now attach to the Extension Host process and hit breakpoints set in the integration tests

## Code Coverage

Code coverage for these tests is enabled by default. After running the tests you can find the results in the `coverage` folder at the root of this extension.

This code coverage covers extension code only - it will not instrument code from the core.
