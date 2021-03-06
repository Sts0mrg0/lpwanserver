var { logger } = require('../log')
var restServer
var modelAPI
const { formatRelationshipsOut } = require('../lib/prisma')
const R = require('ramda')

exports.initialize = function (app, server) {
  restServer = server
  modelAPI = server.modelAPI

  /*********************************************************************
    * Applications API
    ********************************************************************/
  /**
     * Gets the applications available for access by the calling account.
     *
     * @api {get} /api/applications Get Applications
     * @apiGroup Applications
     * @apiDescription Returns an array of the Applications that match the
     *      options.
     * @apiPermission System Admin accesses all Applications, others access
     *       only their own Company's Applications.
     * @apiHeader {String} Authorization The Create Session's returned token
     *      prepended with "Bearer "
     * @apiParam (Query Parameters) {Number} [limit] The maximum number of
     *      records to return.  Use with offset to manage paging.  0 is the
     *      same as unspecified, returning all users that match other query
     *      parameters.
     * @apiParam (Query Parameters) {Number} [offset] The offset into the
     *      returned database query set.  Use with limit to manage paging.  0 is
     *      the same as unspecified, returning the list from the beginning.
     * @apiParam (Query Parameters) {String} [search] Search the Applications
     *      based on name matches to the passed string.  In the string, use "%"
     *      to match 0 or more characters and "_" to match exactly one.  For
     *      example, to match names starting with "D", use the string "D%".
     * @apiParam (Query Parameters) {String} [companyId] Limit the Applications
     *      to those belonging to the Company.
     * @apiParam (Query Parameters) {String} [reportingProtocolId] Limit the
     *      Applications to those that use the Reporting Protocol.
     * @apiSuccess {Object} object
     * @apiSuccess {Number} object.totalCount The total number of records that
     *      would have been returned if offset and limit were not specified.
     *      This allows for calculation of number of "pages" of data.
     * @apiSuccess {Object[]} object.records An array of Application records.
     * @apiSuccess {String} object.records.id The Application's Id
     * @apiSuccess {String} object.records.name The Application's name
     * @apiSuccess {String} object.records.description The Application's
     *      description
     * @apiSuccess {String} object.records.companyId The Id of the Company
     *      that the Application belongs to.
     * @apiSuccess {String} object.records.baseUrl The base URL used by the
     *      Reporting Protocol
     * @apiSuccess {String} object.records.reportingProtocolId The
     *      Id of the Reporting Protocol used by the Application.
     * @apiSuccess {Boolean} object.records.running If the Application is
     *      currently sending data received from the Networks to the baseUrl via
     *      the Reporting Protocol.
     * @apiVersion 1.2.1
     */
  app.get('/api/applications', [restServer.isLoggedIn,
    restServer.fetchCompany],
  function (req, res, next) {
    var options = {}
    if (req.company.type !== 'ADMIN') {
      // If they gave a companyId, make sure it's their own.
      if (req.query.companyId) {
        if (req.query.companyId !== req.user.company.id) {
          restServer.respond(res, 403, 'Cannot request applications for another company')
          return
        }
      }
      else {
        // Force the search to be limited to the user's company
        options.companyId = req.user.company.id
      }
    }

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
    // This may be redundant, but we've already verified that if the
    // user is not part of the admin company, then this is their companyId.
    if (req.query.companyId) {
      options.companyId = req.query.companyId
    }
    if (req.query.reportingProtocolId) {
      options.reportingProtocolId = req.query.reportingProtocolId
    }
    if (req.query.networkProtocolId) {
      options.networkProtocolId = req.query.networkProtocolId
    }
    modelAPI.applications.list(options, { includeTotal: true }).then(function ([recs, totalCount]) {
      const responseBody = { totalCount, records: recs.map(formatRelationshipsOut) }
      restServer.respondJson(res, null, responseBody)
    })
      .catch(function (err) {
        logger.error('Error getting applications: ', err)
        restServer.respond(res, err)
      })
  })

  /**
     * @apiDescription Gets the Application record with the specified id.
     *
     * @api {get} /api/applications/:id Get Application
     * @apiGroup Applications
     * @apiPermission Any, but only System Admin can retrieve an Application
     *      that is not owned by their Company.
     * @apiHeader {String} Authorization The Create Session's returned token
     *      prepended with "Bearer "
     * @apiParam (URL Parameters) {String} id The Application's id
     * @apiSuccess {Object} object
     * @apiSuccess {String} object.id The Application's Id
     * @apiSuccess {String} object.name The Application's name
     * @apiSuccess {String} object.description The Application's description
     * @apiSuccess {String} object.companyId The Id of the Company
     *      that the Application belongs to.
     * @apiSuccess {String} object.baseUrl The base URL used by the
     *      Reporting Protocol
     * @apiSuccess {String} object.reportingProtocolId The
     *      Id of the Reporting Protocol used by the Application.
     * @apiSuccess {Boolean} object.running If the Application is
     *      currently sending data received from the Networks to the baseUrl via
     *      the Reporting Protocol.
     * @apiVersion 1.2.1
     */
  app.get('/api/applications/:id', [restServer.isLoggedIn,
    restServer.fetchCompany],
  function (req, res, next) {
    modelAPI.applications.load(req.params.id).then(function (app) {
      if ((req.company.type !== 'ADMIN') &&
                 (app.company.id !== req.user.company.id)) {
        restServer.respond(res, 403)
      }
      else {
        restServer.respondJson(res, null, formatRelationshipsOut(app))
      }
    })
      .catch(function (err) {
        logger.error('Error getting application ' + req.params.id + ': ', err)
        restServer.respond(res, err)
      })
  })

  /**
     * @apiDescription Creates a new application record.
     *
     * @api {post} /api/applications Create Application
     * @apiGroup Applications
     * @apiPermission System Admin or Company Admin
     * @apiHeader {String} Authorization The Create Session's returned token
     *      prepended with "Bearer "
     * @apiParam (Request Body) {String} name The Application's name
     * @apiParam (Request Body) {String} description The Application's
     *      description
     * @apiParam (Request Body) {String} companyId The Id of the Company that
     *      the Application blongs to.  For a Company Admin user, this can
     *      only be the Id of their own Company.
     * @apiParam (Request Body) {String} baseURL The URL that the Reporting
     *      Protocol sends the data to.  This may have additional paths added,
     *      depending on the Reporting Protocol.
     * @apiParam (Request Body) {String} reportingProtocolId The Id of the
     *      Reporting Protocol the Application will use to pass Device data
     *      back to the Application Vendor.
     * @apiExample {json} Example body:
     *      {
     *          "name": "GPS Pet Tracker",
     *          "description": "Pet finder with occasional reporting",
     *          "companyId": J59j3Ddteoi8,
     *          "baseUrl": "https://IoTStuff.com/incomingData/GPSPetTracker"
     *          "reportingProtocolId": 6s3oi3j90ed9j
     *      }
     * @apiSuccess {String} id The new Application's id.
     * @apiVersion 1.2.1
     */
  app.post('/api/applications', [restServer.isLoggedIn,
    restServer.fetchCompany,
    restServer.isAdmin],
  function (req, res) {
    var rec = req.body
    // You can't specify an id.
    if (rec.id) {
      restServer.respond(res, 400, "Cannot specify the applocation's id in create")
      return
    }

    // Verify that required fields exist.
    if (!rec.name || !rec.description || !rec.companyId || !rec.reportingProtocolId || !rec.baseUrl) {
      restServer.respond(res, 400, 'Missing required data')
      return
    }

    // The user must be part of the admin group or the target company.
    if ((req.company.type !== 'ADMIN') && (req.user.company.id !== rec.companyId)) {
      restServer.respond(res, 403)
      return
    }

    // Do the add.
    modelAPI.applications.create(
      R.pick(['name', 'description', 'companyId', 'reportingProtocolId', 'baseUrl'], rec)
    ).then(function (rec) {
      var send = {}
      send.id = rec.id
      restServer.respondJson(res, 200, send, true)
    })
      .catch(function (err) {
        restServer.respond(res, err)
      })
  })

  /**
     * @apiDescription Updates the application record with the specified id.
     *
     * @api {put} /api/applications/:id Update Application
     * @apiGroup Applications
     * @apiPermission System Admin, or Company Admin for this Company.
     * @apiHeader {String} Authorization The Create Session's returned token
     *      prepended with "Bearer "
     * @apiParam (URL Parameters) {String} id The Application's id
     * @apiParam (Request Body) {String} [name] The Application's name
     * @apiParam (Request Body) {String} [description] The Application's
     *      description
     * @apiParam (Request Body) {String} [companyId] The Id of the Company that
     *      the Application blongs to.  For a Company Admin user, this can
     *      only be the Id of their own Company.
     * @apiParam (Request Body) {String} [baseURL] The URL that the Reporting
     *      Protocol sends the data to.  This may have additional paths added,
     *      depending on the Reporting Protocol.
     * @apiParam (Request Body) {String} [reportingProtocolId] The Id of the
     *      Reporting Protocol the Application will use to pass Device data
     *      back to the Application Vendor.
     * @apiExample {json} Example body:
     *      {
     *          "name": "GPS Pet Tracker",
     *          "description": "Pet finder with occasional reporting"
     *          "companyId": J59j3Ddteoi8,
     *          "baseUrl": "https://IoTStuff.com/incomingData/GPSPetTracker"
     *          "reportingProtocolId": 6s3oi3j90ed9j
     *      }
     * @apiVersion 1.2.1
     */
  app.put('/api/applications/:id', [restServer.isLoggedIn,
    restServer.fetchCompany,
    restServer.isAdmin],
  function (req, res, next) {
    var data = {}
    data.id = req.params.id
    // We'll start by getting the application, as a read is much less
    // expensive than a write, and then we'll be able to tell if anything
    // really changed before we even try to write.
    modelAPI.applications.load(data.id).then(function (app) {
      // Verify that the user can make the change.
      if ((req.company.type !== 'ADMIN') &&
                 (req.user.company.id !== app.company.id)) {
        restServer.respond(res, 403)
        return
      }

      var changed = 0
      if ((req.body.name) &&
                 (req.body.name !== app.name)) {
        data.name = req.body.name
        ++changed
      }

      if ((req.body.description) &&
                 (req.body.description !== app.description)) {
        data.description = req.body.description
        ++changed
      }

      // Can only change the companyId if an admin user.
      if ((req.body.companyId) &&
                 (req.body.companyId !== app.company.id) &&
                 (req.company.type !== 'ADMIN')) {
        restServer.respond(res, 400, "Cannot change application's company")
        return
      }

      if ((req.body.companyId) &&
                 (req.body.companyId !== app.company.id)) {
        data.companyId = req.body.companyId
        ++changed
      }
      if ((req.body.reportingProtocolId) &&
                 (req.body.reportingProtocolId !== app.reportingProtocol.id)) {
        data.reportingProtocolId = req.body.reportingProtocolId
        ++changed
      }
      if ((req.body.baseUrl) &&
                 (req.body.baseUrl !== app.baseUrl)) {
        data.baseUrl = req.body.baseUrl
        ++changed
      }
      if (changed === 0) {
        // No changes.  But returning 304 apparently causes Apache to strip
        // CORS info, causing the browser to throw a fit.  So just say,
        // "Yeah, we did that.  Really.  Trust us."
        restServer.respond(res, 204)
      }
      else {
        // Do the update.
        modelAPI.applications.update(data).then(function (rec) {
          console.log('*** UPDATED APP***', JSON.stringify(rec))
          restServer.respond(res, 204)
        })
          .catch(function (err) {
            restServer.respond(res, err)
          })
      }
    })
      .catch(function (err) {
        logger.error('Error getting application ' + req.body.name + ': ', err)
        restServer.respond(res, err)
      })
  })

  /**
     * @apiDescription Deletes the application record with the specified id.
     *
     * @api {delete} /api/applications/:id Delete Application
     * @apiGroup Applications
     * @apiPermission System Admin, or Company Admin for this company.
     * @apiHeader {String} Authorization The Create Session's returned token
     *      prepended with "Bearer "
     * @apiParam (URL Parameters) {String} id The Application's id
     * @apiVersion 1.2.1
     */
  app.delete('/api/applications/:id', [restServer.isLoggedIn,
    restServer.fetchCompany,
    restServer.isAdmin],
  function (req, res, next) {
    var id = req.params.id
    // If the caller is a global admin, we can just delete.
    if (req.company.type === 'ADMIN') {
      modelAPI.applications.remove(id).then(function () {
        restServer.respond(res, 204)
      })
        .catch(function (err) {
          logger.error('Error deleting application ' + id + ': ', err)
          restServer.respond(res, err)
        })
    }
    // Company admin
    else {
      modelAPI.applications.load(req.params.id).then(function (app) {
        // Verify that the user can delete.
        if (req.user.company.id !== app.company.id) {
          restServer.respond(res, 403)
          return
        }
        modelAPI.applications.remove(id).then(function () {
          restServer.respond(res, 204)
        })
          .catch(function (err) {
            logger.error('Error deleting application ' + id + ': ', err)
            restServer.respond(res, err)
          })
      })
        .catch(function (err) {
          logger.error('Error finding application ' + id + ' to delete: ', err)
          restServer.respond(res, err)
        })
    }
  })

  /**
     * @apiDescription Starts serving the data from the Networks to the
     *      Application server (baseUrl) using the Reporting Protocol for
     *      the Application.
     * @api {post} /api/applications/:id/start Start Application
     * @apiGroup Applications
     * @apiPermission System Admin, or Company Admin for this company.
     * @apiHeader {String} Authorization The Create Session's returned token
     *      prepended with "Bearer "
     * @apiParam (URL Parameters) {String} id The Application's id
     * @apiVersion 1.2.1
     */
  // Yeah, yeah, this isn't a pure REST call.  So sue me.  Gets the job done.
  async function startApplication (req, res) {
    var id = req.params.id
    if (req.company.type !== 'ADMIN') {
      const app = await modelAPI.applications.load(id)
      if (req.user.company.id !== app.company.id) {
        restServer.respond(res, 403)
        return
      }
    }
    try {
      const logs = await modelAPI.applications.startApplication(id)
      restServer.respond(res, 200, logs)
    }
    catch (err) {
      logger.error('Error starting application ' + id + ': ', err)
      restServer.respond(res, err)
    }
  }
  app.post(
    '/api/applications/:id/start',
    [restServer.isLoggedIn, restServer.fetchCompany, restServer.isAdmin],
    startApplication
  )

  /**
     * @apiDescription Stops serving the data from the Networks to the
     *      Application server (baseUrl).
     * @api {post} /api/applications/:id/stop Stop Application
     * @apiGroup Applications
     * @apiPermission System Admin, or Company Admin for this company.
     * @apiHeader {String} Authorization The Create Session's returned token
     *      prepended with "Bearer "
     * @apiParam (URL Parameters) {String} id The Application's id
     * @apiVersion 1.2.1
     */
  // Yeah, yeah, this isn't a pure REST call.  So sue me.  Gets the job done.
  async function stopApplication (req, res) {
    var id = req.params.id
    if (req.company.type !== 'ADMIN') {
      const app = await modelAPI.applications.load(id)
      if (req.user.company.id !== app.company.id) {
        restServer.respond(res, 403)
        return
      }
    }
    try {
      const logs = await modelAPI.applications.stopApplication(id)
      restServer.respond(res, 200, logs)
    }
    catch (err) {
      logger.error('Error stopping application ' + id + ': ', err)
      restServer.respond(res, err)
    }
  }
  app.post(
    '/api/applications/:id/stop',
    [restServer.isLoggedIn, restServer.fetchCompany, restServer.isAdmin],
    stopApplication
  )

  /**
     * Tests serving the data as if it came from a network.
     * Yeah, yeah, this isn't a pure REST call.  So sue me.  Gets the job done.
     */
  app.post('/api/applications/:id/test', function (req, res, next) {
    var id = req.params.id
    modelAPI.applications.testApplication(id, req.body).then(function (logs) {
      restServer.respond(res, 200)
    })
      .catch(function (err) {
        logger.error('Error testing application ' + id + ': ', err)
        restServer.respond(res, err)
      })
  })

  /**
     * Accepts the data from the remote networks to pass to the reporting
     * protocol on behalf of the application.
     * - Any caller can pass data to this method.  We don't require them to be
     *   logged in.  We will reject messages for unknown applicationIds and/or
     *   networkIds with a generic 404.
     */

  /**
   * @apiDescription Handle an uplink from a device on a network
   *
   * @api {post} /api/ingest/:applicationId/:networkId Uplink Message
   * @apiGroup Applications
   * @apiPermission Not protected
   * @apiParam (URL Parameters) {String} applicationId The Application's ID
   * @apiParam (URL Parameters) {String} networkId The Application's ID
   * @apiExample {json} Example body:
   *      {
   *          any: any
   *      }
   * @apiVersion 1.2.1
   */
  async function uplinkHandler (req, res) {
    var appId = req.params.applicationId
    var nwkId = req.params.networkId

    try {
      await modelAPI.applications.passDataToApplication(appId, nwkId, req.body)
      restServer.respond(res, 204)
    }
    catch (err) {
      logger.error(`Error passing data from network ${nwkId} to application ${appId}`, err)
      restServer.respond(res, err)
    }
  }
  app.post('/api/ingest/:applicationId/:networkId', uplinkHandler)

  /**
   * @apiDescription Upload a CSV file with devEUIs
   *
   * @api {post} /api/applications/:id/bulk-device-import Import Devices
   * @apiGroup Applications
   * @apiPermission System Admin, or Company Admin for this company.
   * @apiHeader {String} Authorization The Create Session's returned token
   *      prepended with "Bearer "
   * @apiParam (Request Body) {String} [deviceProfileId] The ID of the
   *      device profile for the devices being imported.
   * @apiParam (Request Body) {Object[]} [devices] List of device import data. devEUI required.
   * @apiExample {json} Example body:
   *      {
   *          "deviceProfileId": "gh4s56l0fewo0"
   *          "devices": [
   *            {
   *              "name": "GPS Pet Tracker",
   *              "description": "Pet finder with occasional reporting",
   *              "devEUI": 33:DD:99:FF:22:11:CC:BB
   *            }
   *          ]
   *      }
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     [
   *       { status: 'OK', deviceId: 'deviceId', devEUI, row: 0 },
   *       { status: 'ERROR', error: 'reason', devEUI, row: 1 }
   *     ]
   * @apiVersion 1.2.1
   */
  async function bulkDeviceImport (req, res) {
    try {
      let result = await modelAPI.devices.importDevices({
        ...req.body,
        applicationId: req.params.id
      })
      restServer.respond(res, 200, result, true)
    }
    catch (err) {
      logger.error(`Device bulk import failed for application ${req.params.id}`, err)
      restServer.respond(res, err)
    }
  }
  app.post(
    '/api/applications/:id/import-devices',
    [restServer.isLoggedIn, restServer.fetchCompany, restServer.isAdmin],
    bulkDeviceImport
  )
}
