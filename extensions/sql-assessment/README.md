# SQL Assessment *(preview)*

SQL Assessment for Azure Data Studio provides a mechanism to evaluate the configuration of SQL Server for best practices. It uses [SQL Assessment API](https://techcommunity.microsoft.com/t5/sql-server/released-sql-assessment-api-ga/ba-p/989677) to achieve this. With this preview version, you can:

- Assess a SQL Server or Azure SQL Managed Instance and its databases with built-in rules (Invoke Assessment)
- Get a list of all built-in rules applicable to an instance and its databases (View applicable rules)
- Export assessment results and the list of applicable rules as a script to store it in a SQL table (Export as script)
- Create HTML reports on assessments results (Create HTML Report)

![SqlAssessmentPic](https://user-images.githubusercontent.com/61055430/102236901-1aaf1400-3f05-11eb-9ffd-da9ab9b5d146.png)


### How do I start SQL Assessment?

After you install the SQL Assessment extension, open the list with your servers, right-click a server or database that you want to assess and select **Manage**. Then, in the **General** section, select **SQL Assessment**.
On the **Assessment** tab, click **Invoke Assessment** to perform assessment of the selected SQL Server or SQL Database. Once the results are available, you can use the filtering and sorting features.
Click **Export as Script** to get the results in an insert-into-table format. You can also click **Create HTML Report** to save the assessment results as an HTML file.
Some assessment rules are intended for particular SQL Server configurations and some for others. The same is true for database rules. For example, there are rules that are applicable only to SQL Server 2016 or the tempdb database.
The **View applicable rules** button displays the assessment rules that are used to perform assessment of your servers and databases after you click **Invoke Assessment**.
To view information about SQL Server and SQL Assessment API, click **Info**.
Assessment session results can be reviewed on the **History** tab.

## Code of Conduct
This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Privacy Statement

The [Microsoft Enterprise and Developer Privacy Statement](https://privacy.microsoft.com/en-us/privacystatement) describes the privacy statement of this software.

## License

Copyright (c) Microsoft Corporation. All rights reserved.

Licensed under the [Source EULA](https://raw.githubusercontent.com/Microsoft/azuredatastudio/main/LICENSE.txt).
