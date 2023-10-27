# Data Virtualization extension for Azure Data Studio
This extension adds Data Virtualization support for SQL Server 2019 and above. This includes support for creating new SQL Server, Oracle, MongoDB, Teradata and HDFS External Data Sources and External Tables using interactive wizards.

## Supported Features
* SQL Server Polybase Data Virtualization Wizard
  * Create an external table and its supporting metadata structures with an easy to use wizard.
    * Remote SQL Server and Oracle servers are supported for all versions of SQL Server 2019 and above
    * Remote MongoDB and Teradata servers are supported for versions of SQL Server 2019 with CU5 and above
  * Launch Virtualize Data from CSV Files wizard in HDFS, which lets you create an external table in your SQL Server Master instance associated with the cluster. You can virtualize the data from the remote HDFS Data sources without ever needing to now move the data.

# Usage

### Polybase Data Virtualization Wizard
* From a SQL Server 2019 instance the Data Virtualization Wizard may be opened in three ways:
  * Right click on a server, choose Manage, click on the tab for SQL Server 2019, and choose Virtualize Data
  * With a SQL Server 2019 instance selected in the Object Explorer, bring up Data Virtualization Wizard via the Command Palette
  * Right click on a SQL Server 2019 database in the Object Explorer and choose Virtualize Data
* In this version of the extension, external tables may be created to access remote SQL Server, Oracle, MongoDB and Teradata tables. *Note: While the External Table functionality is a SQL 2019 feature, the remote SQL Server may be running an earlier version of SQL Server*
* Choose the server type you are connecting to on the first page of the wizard and continue
* You will be prompted to create a Database Master Key if one has not already been created. Passwords of insufficient complexity will be blocked.
* Create a data source connection and named credential for the remote server
* Choose which objects to map to your new external table
* Choose Generate Script or Create to finish the wizard
* After creation of the external table, it will appear in the object tree of the database where it was created immediately

###  Polybase Virtualize Data From CSV Files Wizard
* From connecting to the SQL Server big data cluster end point, you might need to create an external table over the files in your HDFS and this can be done in two ways:
  * Browse to the .csv file in HDFS over which you would like to create an External Table from, right click on the file and then launch the Virtualize Data From CSV Files wizard.
  * Next choose the active SQL Server connections from the drop down and this will fill in the connection details.  You will need to pass in the credentials to the SQL Server Master Instance which is associated with this end point for the SQL Server big data cluster connection end point.
  * Browse to the folder in HDFS which has the files with the same file extension and same schema and now when you launch the Virtualize Data From CSV Files then it will create an external table over all the files in the folder.

# Known Issues
* You will not be able to preview files in HDFS which are over 30MB.
* All the files in the HDFS folder for Virtualize Data From CSV Files to work properly would need to have the same file extension (.csv) and conform to the same schema. If there are .csv files which are of different schema then the wizard will still open but you will not be able to create the external table.

## Telemetry

This extension collects telemetry data, which is used to help understand how to improve the product. For example, this usage data helps to debug issues, such as slow start-up times, and to prioritize new features. While we appreciate the insights this data provides, we also know that not everyone wants to send usage data and you can disable telemetry as described in the Azure Data Studio [disable telemetry reporting](https://aka.ms/ads-disable-telemetry) documentation.

## Privacy Statement

To learn more about our Privacy Statement visit [this link](https://go.microsoft.com/fwlink/?LinkID=824704).

## License

Copyright (c) Microsoft Corporation. All rights reserved.

Licensed under the [MIT License](https://raw.githubusercontent.com/Microsoft/azuredatastudio/main/LICENSE.txt).
