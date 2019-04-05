#Integration tests
This integration-tests suite is based on the extension testing feature provided by VS Code, We can use this for:
a.	Commands for setting up the environment for feature testing.
b.	Adding test cases that do not need UI interaction or the test scenarios not supported by the UI automation framework (e.g. object explorer context menu – not html based)

extensionInstallers folder: copy the VISX installers for the extensions we would like to run the tests with.
src folder: this is where the test file for features should be added, name the file like this: feature.test.ts. e.g. objectExplorer.test.ts

ADS will be launched using new temp folders: extension folder and data folder so that your local dev environment won't be changed.

##How to run the test:
1.	In the build pipeline:
The integration test suite has been added to ADS windows pipeline to run the test and report the results, you can find the test results under the test tab.

2.	Local environment:
a. open a terminal window/command line window.
b. navigate to this folder and then run 'node setEnvironmentVariables.js'
	there are different options, by default VSCode will be opened.
    Terminal(Mac)/CMD(Windows): node setEnvironmentVariables.js Terminal
	Git-Bash on Windows: node setEnvironmentVariables.js GitWin
	VSCode: node setEnvironmentVariables.js Code
c. follow the instructions in the window: you will be prompted to login to azure portal.
d. a new window will be opened based on your selection and the new window will have the required environment variables set.
e. in the new window navigate to the scripts folder and run sql-test-integration.bat or sql-test-integration.sh based on your environment.


#UI automation testing:
the ADS UI automation test cases should be added under $root/test/smoke/src/sql folder. Each feature should create its own folder and add 2 files, one for accessing the feature and the other for the test cases. For example: objectExplorer.ts and objectExplorer.test.ts. only tested on Windows for now.

##How to run the test:

1. In the build pipeline:
The smoke test suite has been added to ADS windows pipeline to run the test and report the results, you can find the test results under the test tab.

2. Local environment
navigate to test/smoke folder and run: node test/index.js
You can also run UI automation from VSCode by selecting the launch option: Launch Smoke Test.