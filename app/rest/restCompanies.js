// Logging
var { logger } = require('../log')

var restServer
var modelAPI

exports.initialize = function (app, server) {
  restServer = server
  modelAPI = server.modelAPI

  /*********************************************************************
    * Companies API
    ********************************************************************/
  /**
     * Gets the companies available for access by the calling admin account.
     *
     * @api {get} /api/companies Get Companies
     * @apiGroup Companies
     * @apiDescription Returns an array of the Companies that match the options.
     *      Note that Company Admin users can only access their own Company.
     * @apiPermission System Admin, or Company Admin (limits returned data to
     *       user's own company)
     * @apiHeader {String} Authorization The Create Session's returned token
     *      prepended with "Bearer "
     * @apiParam (Query Parameters) {Number} [limit] The maximum number of
     *      records to return.  Use with offset to manage paging.  0 is the
     *      same as unspecified, returning all users that match other query
     *      parameters.
     * @apiParam (Query Parameters) {Number} [offset] The offset into the
     *      returned database query set.  Use with limit to manage paging.  0 is
     *      the same as unspecified, returning the list from the beginning.
     * @apiParam (Query Parameters) {String} [search] Search the Companies based
     *      on name matches to the passed string.  In the string, use "%" to
     *      match 0 or more characters and "_" to match exactly one.  For
     *      example, to match names starting with "D", use the string "D%".
     * @apiSuccess {Object} object
     * @apiSuccess {Number} object.totalCount The total number of records that
     *      would have been returned if offset and limit were not specified.
     *      This allows for calculation of number of "pages" of data.
     * @apiSuccess {Object[]} object.records An array of Company records.
     * @apiSuccess {String} object.records.id The Company's Id
     * @apiSuccess {String} object.records.name The Company's name
     * @apiSuccess {String} object.records.type "admin" or "vendor"
     * @apiVersion 1.2.1
     */
  app.get('/api/companies', [restServer.isLoggedIn,
    restServer.fetchCompany,
    restServer.isAdmin],
  async (req, res) => {
    try {
      if (req.company.type !== 'ADMIN') {
        // Only return user's own company
        const co = await modelAPI.companies.load(req.company.id)
        restServer.respond(res, 200, { totalCount: 1, records: [ co ] })
      }
      var options = {}
      if (req.query.limit) {
        var limitInt = parseInt(req.query.limit, 10)
        if (!isNaN(limitInt)) {
          options.limit = limitInt
        }
      }
      if (req.query.offset) {
        var offsetInt = parseInt(req.query.offset, 10)
        if (!isNaN(offsetInt)) {
          options.offset = offsetInt
        }
      }
      if (req.query.search) {
        options.search = req.query.search
      }
      const [ records, totalCount ] = await modelAPI.companies.list(options, { includeTotal: true })
      restServer.respond(res, 200, { records, totalCount }, true)
    }
    catch (err) {
      logger.error('Error getting companies: ', err)
      restServer.respond(res, err)
    }
  })

  /**
     * @apiDescription Gets the company record with the specified id.
     *
     * @api {get} /api/companies/:id Get Company
     * @apiGroup Companies
     * @apiPermission Any, but only System Admin can retrieve a Company other
     *      than their own.
     * @apiHeader {String} Authorization The Create Session's returned token
     *      prepended with "Bearer "
     * @apiParam (URL Parameters) {String} id The Company's id
     * @apiSuccess {Object} object
     * @apiSuccess {String} object.id The Company's Id
     * @apiSuccess {String} object.name The Company's name
     * @apiSuccess {String} object.type "admin" or "vendor"
     * @apiVersion 1.2.1
     */
  app.get('/api/companies/:id', [restServer.isLoggedIn,
    restServer.fetchCompany],
  function (req, res) {
    var id = req.params.id
    if ((req.company.type !== 'ADMIN') &&
             (req.company.id !== id)) {
      restServer.respond(res, 403)
      return
    }
    modelAPI.companies.load(req.params.id).then(function (co) {
      restServer.respondJson(res, null, co)
    })
      .catch(function (err) {
        logger.error('Error getting company ' + req.params.id + ': ', err)
        restServer.respond(res, err)
      })
  })

  /**
     * @apiDescription Creates a new company record.
     *
     * @api {post} /api/companies Create Company
     * @apiGroup Companies
     * @apiPermission System Admin
     * @apiHeader {String} Authorization The Create Session's returned token
     *      prepended with "Bearer "
     * @apiParam (Request Body) {String} name The Company's name
     * @apiParam (Request Body) {String="Admin","Vendor"} type The Company's type
     * @apiExample {json} Example body:
     *      {
     *          "name": "IoT Stuff, Inc.",
     *          "type": "vendor"
     *      }
     * @apiSuccess {String} id The new Company's id.
     * @apiVersion 1.2.1
     */
  app.post('/api/companies', [restServer.isLoggedIn,
    restServer.fetchCompany,
    restServer.isAdminCompany],
  function (req, res) {
    var rec = req.body
    // You can't specify an id.
    if (rec.id) {
      restServer.respond(res, 400, "Cannot specify the company's id in create")
      return
    }

    // Verify that required fields exist.
    if (!rec.name || !rec.type) {
      restServer.respond(res, 400, 'Missing required data')
    }

    // Do the add.
    modelAPI.companies.create(rec.name,
      rec.type).then(function (rec) {
      var send = {}
      send.id = rec.id
      restServer.respondJson(res, 200, send)
    })
      .catch(function (err) {
        restServer.respond(res, err)
      })
  })

  /**
     * @apiDescription Updates the company record with the specified id.
     *
     * @api {put} /api/companies/:id Update Company
     * @apiGroup Companies
     * @apiPermission System Admin, or Company Admin for this company.
     * @apiHeader {String} Authorization The Create Session's returned token
     *      prepended with "Bearer "
     * @apiParam (URL Parameters) {String} id The Company's id
     * @apiParam (Request Body) {String} [name] The Company's name
     * @apiParam (Request Body) {String="Admin","Vendor"} [type] The Company's type
     * @apiExample {json} Example body:
     *      {
     *          "name": "IoT Stuff, Inc.",
     *          "type": "vendor"
     *      }
     * @apiVersion 1.2.1
     */
  app.put('/api/companies/:id', [restServer.isLoggedIn,
    restServer.fetchCompany,
    restServer.isAdmin],
  function (req, res) {
    var data = {}
    data.id = req.params.id
    // We'll start by getting the company, as a read is much less expensive
    // than a write, and then we'll be able to tell if anything really
    // changed before we even try to write.
    modelAPI.companies.load(req.params.id).then(function (company) {
      // Fields that may exist in the request body that anyone (with permissions)
      // can change.  Make sure they actually differ, though.
      var changed = 0
      if ((req.body.name) &&
                 (req.body.name !== company.name)) {
        data.name = req.body.name
        ++changed
      }

      // In order to update a company record, the logged in user must
      // either be part of the admin company, or a company admin for the
      // company.
      if ((req.company.type !== 'ADMIN') &&
                 (req.user.company.id !== data.id)) {
        // Nope.  Not allowed.
        restServer.respond(res, 403)
        return
      }

      // Ready.  DO we have anything to actually change?
      if (changed === 0) {
        // No changes.  But returning 304 apparently causes Apache to strip
        // CORS info, causing the browser to throw a fit.  So just say,
        // "Yeah, we did that.  Really.  Trust us."
        restServer.respond(res, 204)
      }
      else {
        // Do the update.
        modelAPI.companies.update(data).then(function () {
          restServer.respond(res, 204)
        })
          .catch(function (err) {
            restServer.respond(res, err)
          })
      }
    })
      .catch(function (err) {
        logger.error('Error getting company ' + req.body.name + ': ', err)
        restServer.respond(res, err)
      })
  })

  /**
     * @apiDescription Deletes the company record with the specified id.
     *
     * @api {delete} /api/companies/:id Delete Company
     * @apiGroup Companies
     * @apiPermission System Admin
     * @apiHeader {String} Authorization The Create Session's returned token
     *      prepended with "Bearer "
     * @apiParam (URL Parameters) {String} id The Company's id
     * @apiVersion 1.2.1
     */
  app.delete('/api/companies/:id', [restServer.isLoggedIn,
    restServer.fetchCompany,
    restServer.isAdminCompany],
  function (req, res) {
    let id = req.params.id
    modelAPI.companies.remove(id).then(function () {
      restServer.respond(res, 204)
    })
      .catch(function (err) {
        logger.error('Error deleting company ' + id + ': ', err)
        restServer.respond(res, err)
      })
  })
}
