define({ "api": [
  {
    "type": "delete",
    "url": "/api/companies/:id",
    "title": "Delete Company",
    "group": "Companies",
    "permission": [
      {
        "name": "System Admin"
      }
    ],
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>The Create Session's returned token prepended with &quot;Bearer &quot;</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "URL Parameters": [
          {
            "group": "URL Parameters",
            "type": "Number",
            "optional": false,
            "field": "id",
            "description": "<p>The company's id</p>"
          }
        ]
      }
    },
    "version": "0.0.0",
    "filename": "../../../lpwanserver/rest/restCompanies.js",
    "groupTitle": "Companies",
    "name": "DeleteApiCompaniesId"
  },
  {
    "type": "get",
    "url": "/api/companies",
    "title": "Get Companies",
    "group": "Companies",
    "description": "<p>Returns an array of the companies that match the options. Note that company admin users are returned their own company.</p>",
    "permission": [
      {
        "name": "System Admin, or Company Admin (limits returned data to\n      user's own company)"
      }
    ],
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>The Create Session's returned token prepended with &quot;Bearer &quot;</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "Query Parameters": [
          {
            "group": "Query Parameters",
            "type": "Number",
            "optional": true,
            "field": "limit",
            "description": "<p>The maximum number of companies to return.  Use with offset to manage paging.  0 is the same as unspecified, returning all users that match other query parameters.</p>"
          },
          {
            "group": "Query Parameters",
            "type": "Number",
            "optional": true,
            "field": "offset",
            "description": "<p>The offset into the returned database query set.  Use with limit to manage paging.  0 is the same as unspecified, returning the list from the beginning.</p>"
          },
          {
            "group": "Query Parameters",
            "type": "String",
            "optional": true,
            "field": "search",
            "description": "<p>Search the companies based on name matches to the passed string.  In the string, use &quot;%&quot; to match 0 or more characters and &quot;_&quot; to match exactly one.  For example, to match names starting with &quot;D&quot;, use the string &quot;D%&quot;.</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "Object",
            "optional": false,
            "field": "object",
            "description": ""
          },
          {
            "group": "Success 200",
            "type": "Number",
            "optional": false,
            "field": "object.totalCount",
            "description": "<p>The total number of records that would have been returned if offset and limit were not specified. This allows for calculation of number of &quot;pages&quot; of data.</p>"
          },
          {
            "group": "Success 200",
            "type": "Object[]",
            "optional": false,
            "field": "object.records",
            "description": "<p>An array of company records.</p>"
          },
          {
            "group": "Success 200",
            "type": "Number",
            "optional": false,
            "field": "object.records.id",
            "description": "<p>The company's Id</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "object.records.name",
            "description": "<p>The company's name</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "object.records.type",
            "description": "<p>&quot;admin&quot; or &quot;vendor&quot;</p>"
          }
        ]
      }
    },
    "version": "0.0.0",
    "filename": "../../../lpwanserver/rest/restCompanies.js",
    "groupTitle": "Companies",
    "name": "GetApiCompanies"
  },
  {
    "type": "get",
    "url": "/api/companies/:id",
    "title": "Get Company",
    "group": "Companies",
    "permission": [
      {
        "name": "Any, but only System Admin can retrieve a company other\n     than their own."
      }
    ],
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>The Create Session's returned token prepended with &quot;Bearer &quot;</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "URL Parameters": [
          {
            "group": "URL Parameters",
            "type": "Number",
            "optional": false,
            "field": "id",
            "description": "<p>The company's id</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "Object",
            "optional": false,
            "field": "object",
            "description": ""
          },
          {
            "group": "Success 200",
            "type": "Number",
            "optional": false,
            "field": "object.id",
            "description": "<p>The company's Id</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "object.name",
            "description": "<p>The company's name</p>"
          },
          {
            "group": "Success 200",
            "type": "String",
            "optional": false,
            "field": "object.type",
            "description": "<p>&quot;admin&quot; or &quot;vendor&quot;</p>"
          }
        ]
      }
    },
    "version": "0.0.0",
    "filename": "../../../lpwanserver/rest/restCompanies.js",
    "groupTitle": "Companies",
    "name": "GetApiCompaniesId"
  },
  {
    "type": "post",
    "url": "/api/companies",
    "title": "Create Company",
    "group": "Companies",
    "permission": [
      {
        "name": "System Admin"
      }
    ],
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>The Create Session's returned token prepended with &quot;Bearer &quot;</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "Request Body": [
          {
            "group": "Request Body",
            "type": "String",
            "optional": false,
            "field": "name",
            "description": "<p>The company's name</p>"
          },
          {
            "group": "Request Body",
            "type": "String",
            "allowedValues": [
              "\"Admin\"",
              "\"Vendor\""
            ],
            "optional": false,
            "field": "type",
            "description": "<p>The company's type</p>"
          }
        ]
      }
    },
    "examples": [
      {
        "title": "Example body:",
        "content": "{\n    \"name\": \"IoT Stuff, Inc.\",\n    \"type\": \"vendor\"\n}",
        "type": "json"
      }
    ],
    "success": {
      "fields": {
        "Success 200": [
          {
            "group": "Success 200",
            "type": "Number",
            "optional": false,
            "field": "id",
            "description": "<p>The new company's id.</p>"
          }
        ]
      }
    },
    "version": "0.0.0",
    "filename": "../../../lpwanserver/rest/restCompanies.js",
    "groupTitle": "Companies",
    "name": "PostApiCompanies"
  },
  {
    "type": "put",
    "url": "/api/companies/:id",
    "title": "Update Company",
    "group": "Companies",
    "permission": [
      {
        "name": "System Admin, or Company Admin for this company."
      }
    ],
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>The Create Session's returned token prepended with &quot;Bearer &quot;</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "URL Parameters": [
          {
            "group": "URL Parameters",
            "type": "Number",
            "optional": false,
            "field": "id",
            "description": "<p>The company's id</p>"
          }
        ],
        "Request Body": [
          {
            "group": "Request Body",
            "type": "String",
            "optional": true,
            "field": "name",
            "description": "<p>The company's name</p>"
          },
          {
            "group": "Request Body",
            "type": "String",
            "allowedValues": [
              "\"Admin\"",
              "\"Vendor\""
            ],
            "optional": true,
            "field": "type",
            "description": "<p>The company's type</p>"
          }
        ]
      }
    },
    "examples": [
      {
        "title": "Example body:",
        "content": "{\n    \"name\": \"IoT Stuff, Inc.\",\n    \"type\": \"vendor\"\n}",
        "type": "json"
      }
    ],
    "version": "0.0.0",
    "filename": "../../../lpwanserver/rest/restCompanies.js",
    "groupTitle": "Companies",
    "name": "PutApiCompaniesId"
  },
  {
    "type": "delete",
    "url": "/api/sessions",
    "title": "Delete Session",
    "group": "Sessions",
    "description": "<p>Deletes the session.</p>",
    "version": "0.0.0",
    "filename": "../../../lpwanserver/rest/restSessions.js",
    "groupTitle": "Sessions",
    "name": "DeleteApiSessions"
  },
  {
    "type": "post",
    "url": "/api/sessions",
    "title": "Create Session",
    "group": "Sessions",
    "description": "<p>Returns a JWT token in the response body that the caller is to put into the Authorize header, prepended  with &quot;Bearer &quot;, for any authorized access to other REST interfaces.</p>",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "string",
            "optional": false,
            "field": "login_username",
            "description": "<p>The user's username</p>"
          },
          {
            "group": "Parameter",
            "type": "string",
            "optional": false,
            "field": "login_password",
            "description": "<p>The user's password</p>"
          }
        ]
      }
    },
    "examples": [
      {
        "title": "Example body:",
        "content": "{\n    \"login_username\": \"admin\",\n    \"login_password\": \"secretshhh\"\n}",
        "type": "json"
      }
    ],
    "success": {
      "fields": {
        "200": [
          {
            "group": "200",
            "type": "string",
            "optional": false,
            "field": "token",
            "description": "<p>The JWT token for the user.</p>"
          }
        ]
      }
    },
    "version": "0.0.0",
    "filename": "../../../lpwanserver/rest/restSessions.js",
    "groupTitle": "Sessions",
    "name": "PostApiSessions"
  }
] });