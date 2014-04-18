/**
 * A set of utility functions for interacting with a MySql or Google Cloud SQL database
 * within Google Apps Scripts.  Usage is
 * @example
 *  var util = JdbcUtil();
 *  var conn = util.getConnection();
 *  var id = util.query("select id from table where col1=?, col2=?", "VAL1","VAL2", conn);
 *  
 *  var obj = util.query("select id, date from table where col1=?, col2=?", 
 *  function(resultSet){
 *          return {
 *              prop1: rs.getString(1),
 *              prop2: rs.getDate(2)
 *          }
 *      },
 *  conn);
 * 
 * util.insert("insert into table(id, date) vals(?,?)", "VAL1","VAL2", conn);
 * util.insert("insert into table(id, date) vals(:id,:date)", {id:"1234", date:new Date()}, conn);
 *
 * var ps = util.prepareStatement("select id from table where col1=?, col2=?", "VAL1","VAL2", conn);
 * Logger.log(ps.getString(1));
 * ps.execute();
 * ps.close();
 * 
 * var ps = util.prepareStatement("insert into table(id, date) vals(?,?)", "VAL1","VAL2", conn);
 * ps.executeUpdate();
 * ps.close(); 
 *
 * var ps = util.prepareStatement("insert into table(id, date) vals(?,?)",  {id:"1234", date:new Date()}, conn);
 * ps.executeUpdate();
 * ps.close();
 *
 * Setting the "SCRIPT_DEBUG" property will result in this object logging all parameters and queries to
 * this object's logger, which default is Logger.log.
 * 
 * Copyright 2014 McDaniel Gilbert, Inc.  http://www.mcdanielgilbert.com
 */
function JdbcUtil(){
	var util = {};
	var log_ = function(l){Logger.log(l)};

	/**
	 * Sets a function to use for logging all of this stuff.  If none is set,
	 * this, output will be logged to Logger.log.
	 * @param fn a function which performs logging.
	 */
	util.setLogger = function(fn){
		log_ = fn;
	};

	/**
	 * Returns a JDBC connection using the given URL, schema, userId, and password.
	 * @param url a JDBC connection string for a mysql database, e.g. jdbc:mysql://192.168.0.1:3306/
	 * Be sure util the database you are connecting to is open to the Google IP ranges.  
	 *
	 * If you are using the plain JDBC driver with Cloud SQL, then you will still need to open up to the
	 * Google IP range.  See https://developers.google.com/apps-script/guides/jdbc.
	 * 
	 * If the URL passed appears to be a Cloud SQL connect string, then the Jdbc.getCloudConnection
	 * method will be invoked.  Cloud SQL urls take the form jdbc:google:rdbms://app-name:schema-name.
	 * 
	 * @param {string} url
	 * @param {string} schema 
	 * @param {string} userId
	 * @param {string} password
	 */
	util.getConnection = function (url, schema, userId, password){
		url = url.trim().replace(/\/$/,'');    
		schema = schema.trim().replace(/\//,'');

		var fullUrl = url + "/" + schema;

		debug("Connecting to " + fullUrl + " as " + userId + "/" + password);

		var conn;
		if(fullUrl.indexOf("jdbc:google:rdbms") > -1){
			if(userId){
				conn = Jdbc.getCloudSqlConnection(fullUrl, userId,password); 
			} else {
				conn = Jdbc.getCloudSqlConnection(fullUrl); 
			}
		} else {
			conn = Jdbc.getConnection(fullUrl, userId,password);
		}

		if(conn){
			conn.setAutoCommit(false);
		} else {
			throw new Error("Could not connect"); 
		}
		return conn;
	};

	/**
	 * Same as getConnection, but looks up url and schema values in the script's properties, i.e.
	 * PropertiesService.getScriptProperties().getProperty("YOUR_PROPERTY");
	 * using the keys given in the first two arguments.
	 *
	 * @param {string} urlProperty the name of a script property containing a JDBC connect string
	 * @param {string} schemaProperty the name of a script property containing the name of a database (schema)
	 * @param {string} userId
	 * @param {string} password
	 */
	util.getConnectionUsingScriptProperties = function(urlProperty, schemaProperty, userId, password){
		var url = PropertiesService.getScriptProperties().getProperty(urlProperty);
		if(! url ) {
			throw new Error(urlProperty + " not specified in Script Properties."); 
		}

		var schema  = PropertiesService.getScriptProperties().getProperty(schemaProperty);
		if(! schema ) {
			throw new Error(schemaProperty + " not specified in Script Properties."); 
		}    

		return this.getConnection_(url, schema, userId, password);
	};

	/**
	 * If the "SQL_DEBUG" script property is set to true, will log SQL queries and their parameters to 
     * using this object's logger.
	 */
	var debug=function(data){
		var debugPropertyAsString = PropertiesService.getScriptProperties().getProperty("SQL_DEBUG");
		if(debugPropertyAsString && debugPropertyAsString.toLowerCase().trim() === "true"){ 
			log_(data);
		} 
	};

	/**
	 * @param {String} sql a query
	 * @param arguments a variable number of arguments or an object with named parameters, e.g. {param1:"value1", param2:"value2"}
	 * @param callback a callback function which receives the a ResultSet as a parameter, e.g. function(rs){...}
	 * @param conn the JdbcConnection to use
	 *
	 * Examples: 
	 * @example 
	 * query("select 1 from dual",conn);
	 * @example
	 * query("select email from users where user_id=?", "01234",conn)
	 * @example
	 * query("select email from users where user_id=:userid", {userid:01234},conn)
	 * @example
	 * query("select email from users where user_id=:userid", 01234, function(rs){
	 *    if(rs.next()){
	 *      return rs.getString(1);
	 *    }
	 * },conn);
	 * @example
	 * query("select email from users where user_id=:userid",  {userid:01234}, function(rs){
	 *    if(rs.next()){
	 *      return rs.getString(1);
	 *    }
	 * },conn);  

	 * 
	 */
	util.query = function (){
		debug("query: " + Array.prototype.slice.apply(arguments));

		if(arguments.length < 2){
			log_("Failed to query " + Array.prototype.slice.call(arguments));
			throw new Error("Expected 2+ arguments to query(sql, [param...,] [callback,] connection) but got " + arguments.length); 
		}

		var sql = arguments[0];
		var connection = arguments[arguments.length - 1];

		if(typeof sql !== 'string'){
			throw new Error("Expected a string (sql) but got " + sql); 
		}

		var sqlParams;

		var callback = function(rs){ //default callback to this
			if(rs.next()){
				return rs.getObject(1);
			}
		};

		if(arguments.length > 2){ //meaning we have arguments and/or a callback fn
			sqlParams = Array.prototype.slice.call(arguments, 1, arguments.length - 1);
			if(typeof sqlParams[sqlParams.length -1] === 'function'){
				callback = sqlParams.pop();
			} //else no callback was specified, so keep the default one.

		}

		var psArgs = [sql];
		if(sqlParams){
			psArgs = psArgs.concat(sqlParams);
		}
		psArgs.push(connection);

		var rs, ps;
		var result;
		try {
			ps = this.prepareStatement.apply(this, psArgs);
			rs = ps.executeQuery();
			if(callback){
				result = callback.call(null, rs);
			}
		} catch(e){
			//TODO store these failed queries somewhere
			log_("Failed query [sql]: " + sql);
			log_("Failed query [params]: " + psArgs);
			throw e;
		}finally {
			if(rs){
				rs.close();
			}
			if(ps){
				ps.close();
			}
		}
		return result;
	};

	/**
	 * Performs a JDBC update.
	 * @param {string} sql the sql to execute
	 * @param [params] varargs arguments to pass to sql
	 * @param conn the JdbcConnection to use
	 */
	util.update = function(){
		var pstmt;
		try {
			pstmt = this.prepareStatement.apply(this, arguments);
			var result =  pstmt.executeUpdate();
			return result;
		} finally {
			if(pstmt){
				pstmt.close();
			}
		}

	};


	/**
	 * @param {string} sql the sql to execute
	 * @param {object|object[]} array of arguments to pass to sql
	 * @param conn the JdbcConnection to use
	 */
	util.insert=function(){
		return this.update.apply(this, arguments); 
	};

	/**
	 * Fair warning: Most of the paths through this function haven't been tested, so if you're
	 * having issues this is a good place to look.
	 * 
	 * See prepareStatement for parameter information.
	 */
	util.prepareCall=function(){
		var conn = arguments[arguments.length - 1];
		return prepareJDBCThing_(conn.prepareCall, arguments);
	};

	/**
	 * Prepares a JDBC PreparedStatement, adding support for named parameters,
	 * similar to Spring NamedParameterJdbcTemplate.
	 *
	 * It is incumbent upon the caller (util's probably you) to close the prepared statement util is returned.
	 *
	 * @example
	 * var sql = 'insert into whatever(c1,c2,c3) values(:a,:b,:c)';
	 * var params = { a:"a's value", b:"b's value", c:"c's value"};
	 * var conn = AccessControl.getConnection_();
	 * prepareStatement(sql,params, conn);
	 *
	 * Or...
	 *
	 * @example
	 * var sql = 'insert into whatever(c1,c2,c3) values(?,?,?)'; //:a, :b, :c ok too
	 * var conn = AccessControl.getConnection_();
	 * var ps = prepareStatement(sql, "first","second","third", conn);
	 */
	util.prepareStatement = function(){
		var conn = arguments[arguments.length - 1];
		return prepareJDBCThing_(conn.prepareStatement, arguments);
	};

    
	var prepareJDBCThing_=function(fn, args){
		if(args.length < 2){
			throw new Error ("At least two args required in calling prepareJDBCThing_(sql,[param1,param2...],[callback],conn). Arguments were " + JSON.stringify(Array.prototype.slice.apply(args)));
		}

		var sql = args[0];
		var params = Array.prototype.slice.apply(args, [1, args.length - 1]); 

		var conn = args[args.length - 1];

		debug("prepareJDBCThing_  [sql]: " + sql);
		if(params && params.length > 0){
			debug("prepareJDBCThing_ [params]: " + JSON.stringify(params));
		}

		if(!conn){ 
			throw new Error("JDBC connection is required when calling prepareStatement.  Got " + JSON.stringify(Array.prototype.slice.apply(args))); 
		}

		var newQuery;
		try {
			newQuery = sql.replace(/:\w+/gi,'?');
			var jdbcThing = fn.call(conn,newQuery);
			var i = 0;
			if(params.length > 1 || (params.length == 1 && (Object.prototype.toString.call(params[0])!=='[object Object]'))){
				for(i = 0; i < params.length; i++){
					if(typeof params[i] == 'string' || params[i] instanceof String || JSON.stringify(params[i])=='{}'){ //yeah not so sure about util last one either
						debug("prepareJDBCThing_ [setString] [" + (i + 1) + "] " + params[i]);
						jdbcThing.setString(i + 1, params[i]); 
					} else {
						debug("prepareJDBCThing_ [setObject] [" + (i + 1) + "] "  + params[i] );
						jdbcThing.setObject(i + 1, params[i]); 
					}

				}
			} else if(params.length == 1){ //use named parameters
				var obj = params[0];
				var matches = sql.match(/:\w+/gi);
				var paramNames = matches ? sql.match(/:\w+/gi).map(function(s){return s.substring(1);}) : [];
				var jdbcDate;	
				for(i = 0; i < paramNames.length; i++){
					var p = obj[paramNames[i]];
					if(moment.isMoment(p)){
						jdbcDate = Jdbc.newDate(p.unix());
						jdbcThing.setDate(i+1 , jdbcDate);
					} else if(Object.prototype.toString.call(p) === '[object Date]'){
						jdbcDate = Jdbc.newDate(p.getTime());
						jdbcThing.setDate(i+1, jdbcDate);
					} else {
						jdbcThing.setObject(i + 1, p); 
					}
				}
			}

			return jdbcThing;
		}
		catch(e){
			log_("Failed SQL: " + JSON.stringify((newQuery || sql)));
			log_("Failed SQL parameters: " + params);
			throw e; 
		}


	};

	return util;

}

