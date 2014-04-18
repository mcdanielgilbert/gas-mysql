gas-mysql
=========

Utilities for using Google Apps Script's JDBC/Google Cloud SQL services.  This might help reduce the amount of boilerplate code required to use JDBC connections in GAS.

### Usage
#### Initialize the utilities
```javascript
var util = JdbcUtil();
```

#### Obtaining a JDBC connection 
```javascript
 var conn = util.getConnection("jdbc:mysql://10.10.10.10:3306/,"your-db-schema","preferablynotroot","password");
```

#### Obtaining a Google Cloud SQL connection
Using the default (root) connection
```javascript
//these are all equivalent
var cloudSqlConn = util.getConnection("jdbc:google:rdbms://appname:instancename", "your-schema");
var cloudSqlConn = util.getConnection("jdbc:google:rdbms://appname:instancename/", "your-schema");
var cloudSqlConn = util.getConnection("jdbc:google:rdbms://appname:instancename/your-schema");
```

Using a username and password
```
var cloudSqlConn = util.getConnection("jdbc:google:rdbms://appname:instancename/","your-schema","username","password");
```


#### Querying
Simple Query
```javascript
 var id = util.query("select id from table where col1=?, col2=?", conn);
 ```

Passing parameters
```javascript 
 var obj = util.query("select id from table where col1=?, col2=?", "VAL1","VAL2",conn);
```

Passing named parameters
```
var id = util.query("select id from table where col1=:id, col2=:val", {id:"123",val:new Date()} conn);
```


Passing parameters and handling complex results
```javascript
var obj = util.query("select id, date from table where col1=?, col2=?", "VAL1","VAL2"
 function(resultSet){
         return {
             prop1: rs.getString(1),
             prop2: rs.getDate(2)
         }
     },
conn);
```

#### Inserting
```javascript
//perform simple inserts
util.insert("insert into table(id, date) vals(?,?)", "VAL1","VAL2", conn);

//or used named parameters
util.insert("insert into table(id, date) vals(:id,:date)", {id:"1234", date:new Date()}, conn);
```

#### Updating
```javascript
//perform simple updates
util.update("update table set id=?, date=? where col=?", "VAL1",new Date(), "VAL2" conn);

//or used named parameters
util.update("update table set id=:id, date=:date where col=:col", {id:"VAL1",date:new Date(),col: "VAL2"} conn);
```

#### Prepared Statements
Querying
```javascript
var ps = util.prepareStatement("select id from table where col1=?, col2=?", "VAL1","VAL2", conn);
var rs = ps.execute();
Logger.log(rs.getString(1));
ps.close();
```
Simple Inserting/Updating
```javascript
var ps = util.prepareStatement("insert into table(id, date) vals(?,?)", "VAL1","VAL2", conn);
ps.executeUpdate();
ps.close(); 
```
Inserting/Updating using named parameters
```javascript
var ps = util.prepareStatement("insert into table(id, date) vals(:id,:date)",  {id:"1234", date:new Date()}, conn);
ps.executeUpdate();
ps.close();
```



### Allow IP Ranges

If you are attempting to use the Vanilla JDBC driver against a Google Cloud SQL database, you will need
to open up your instance to allow GAS to connect to it.  Likewise if you are running your own
MySQL instance, you will need to allow this group of IPs access.

```
216.239.32.0 - 216.239.63.255
64.233.160.0 - 64.233.191.255
66.249.80.0 - 66.249.95.255
72.14.192.0 - 72.14.255.255
209.85.128.0 - 209.85.255.255
66.102.0.0 - 66.102.15.255
74.125.0.0 - 74.125.255.255
64.18.0.0 - 64.18.15.255
207.126.144.0 - 207.126.159.255
173.194.0.0 - 173.194.255.255
```
Which translate to the following in CIDR notation

```
216.239.32.0/19
64.233.160.0/19
66.249.80.0/20
72.14.192.0/18
209.85.128.0/17
66.102.0.0/20
74.125.0.0/16
64.18.0.0/20
207.126.144.0/20
173.194.0.0/16
```

### Troubleshooting
[Not being able to connect with a username and password](https://code.google.com/p/google-apps-script-issues/issues/detail?id=3879&q=connect%20cloud%20sql&colspec=Stars%20Opened%20ID%20Type%20Status%20Summary%20Component%20Owner) might be an issue.

### License
Copyright 2014 [McDaniel Gilbert, Inc](http://mcdanielgilbert.com)

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

### Contact
Clone away if you like.  This code is available as a library within the Google Apps Library, but realistically you just want the code anyhow.  You can get me at [tom.mclaughlin@mcdanielgilbert.com](tom.mclaughlin@mcdanielgilbert.com).
