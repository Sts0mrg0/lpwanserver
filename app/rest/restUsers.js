var { logger } = require('../log')
const { formatRelationshipsOut } = require('../lib/prisma')
var restServer
var modelAPI

exports.initialize = function (app, server) {
  restServer = server
  modelAPI = server.modelAPI

  /*********************************************************************
    * Users API
    ********************************************************************/
  /**
     * Gets the users available for access by the calling admin account.
     * - If the caller is not an Admin, they get an forbidden error.
     * - If the caller is with the admin company, the get all users for all
     *   companies, though they gave the option of including a query parameter
     *   (e.g., "/api/users?companyId=3") to specify limiting to a specific
     *   company.
     * - If the user is a company Admin, they get their own company's user list.
     * - If the request includes a limit query parameter, only that number of
     *   entries are returned.
     * - If the request includes an offset query parameter, the first offset
     *   records are skipped in the returned data.
     * - If the request includes a search query parameter, the users will be
     *   limited to matches of the passed string.  In the string, use "%" to
     *   match 0 or more characters and "_" to match exactly one.  So to match
     *   usernames starting with "d", use the string "d%".
     *
     * @api {get} /api/users Get Users
     * @apiGroup Users
     * @apiDescription Returns an array of the Users that match the options.
     * @apiPermission System Admin accesses all Users, Company Admin access
     *       only their own Company's Users.
     * @apiHeader {String} Authorization The Create Session's returned token
     *      prepended with "Bearer "
     * @apiParam (Query Parameters) {String} [limit] The maximum number of
     *      records to return.  Use with offset to manage paging.  0 is the
     *      same as unspecified, returning all users that match other query
     *      parameters.
     * @apiParam (Query Parameters) {String} [offset] The offset into the
     *      returned database query set.  Use with limit to manage paging.  0 is
     *      the same as unspecified, returning the list from the beginning.
     * @apiParam (Query Parameters) {String} [search] Search the Users
     *      based on username matches to the passed string.  In the string, use
     *      "%" to match 0 or more characters and "_" to match exactly one.  For
     *      example, to match names starting with "D", use the string "D%".
     * @apiParam (Query Parameters) {String} [companyId] Limit the Users to
     *      those belonging to the Company.
     * @apiSuccess {Object} object
     * @apiSuccess {Number} object.totalCount The total number of records that
     *      would have been returned if offset and limit were not specified.
     *      This allows for calculation of number of "pages" of data.
     * @apiSuccess {Object[]} object.records An array of User records.
     * @apiSuccess {String} object.records.id The User's Id
     * @apiSuccess {String} object.records.username The User's username
     * @apiSuccess {String} object.records.email The User's email
     * @apiSuccess {Boolean} object.records.emailVerified Is the user's email
     *      verified?
     * @apiSuccess {String=admin,user} object.records.role The User's role in
     *      the system.
     * @apiSuccess {String} object.records.companyId The Id of the Company
     *      that the User belongs to.
     * @apiVersion 1.2.1
     */
  app.get('/api/users', [restServer.isLoggedIn,
    restServer.fetchCompany,
    restServer.isAdmin],
  function (req, res) {
    var options = {}
    if (req.company.type === 'ADMIN') {
      // Check for a company limit.
      if (req.query.companyId) {
        options.companyId = req.query.companyId
      }
    }
    else if (req.user.role === 'ADMIN') {
      options.companyId = req.company.id
    }
    else {
      restServer.respond(res, 403, 'Cannot get users')
      return
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
    modelAPI.users.list(options, { includeTotal: true }).then(function ([ records, totalCount ]) {
      records = records.map(x => formatRelationshipsOut(x))
      restServer.respondJson(res, null, { records, totalCount })
    })
      .catch(function (err) {
        logger.error('Error getting users for company ' + req.company.name + ': ', err)
        restServer.respond(res, err)
      })
  })

  /**
     * @apiDescription Gets the User record for the logged-in user based on the
     *      Authorization header.
     *
     * @api {get} /api/users/me Get User "Me"
     * @apiGroup Users
     * @apiPermission Any logged-in user.
     * @apiHeader {String} Authorization The Create Session's returned token
     *      prepended with "Bearer "
     * @apiSuccess {Object} object The User record
     * @apiSuccess {String} object.id The User's Id
     * @apiSuccess {String} object.username The User's username
     * @apiSuccess {String} object.email The User's email
     * @apiSuccess {Boolean} object.emailVerified Is the user's email
     *      verified?
     * @apiSuccess {String=admin,user} object.role The User's role in
     *      the system.
     * @apiSuccess {String} object.companyId The Id of the Company
     *      that the User belongs to.
     * @apiVersion 1.2.1
     */
  app.get('/api/users/me', [restServer.isLoggedIn], function (req, res) {
    restServer.respondJson(res, null, formatRelationshipsOut(req.user))
  })

  /**
      * @apiDescription  Gets the User record with the specified id.
      *
      * @api {get} /api/users/:id Get User
      * @apiGroup Users
      * @apiPermission Any logged-in user.  System Admin's
      * @apiHeader {String} Authorization The Create Session's returned token
      *      prepended with "Bearer "
      * @apiParam (URL Parameters) {String} id The User's id
      * @apiSuccess {Object} object The User record
      * @apiSuccess {String} object.id The User's Id
      * @apiSuccess {String} object.username The User's username
      * @apiSuccess {String} object.email The User's email
      * @apiSuccess {Boolean} object.emailVerified Is the user's email
      *      verified?
      * @apiSuccess {String=admin,user} object.role The User's role in
      *      the system.
      * @apiSuccess {String} object.companyId The Id of the Company
      *      that the User belongs to.
      * @apiVersion 1.2.1
      */
  app.get('/api/users/:id', [restServer.isLoggedIn, restServer.fetchCompany], function (req, res) {
    modelAPI.users.load(req.params.id).then(function (user) {
      if ((req.company.type !== 'ADMIN') &&
                 ((req.user.role !== 'ADMIN') ||
                   (req.user.company.id !== user.company.id)) &&
                 (req.user.id !== user.id)) {
        restServer.respond(res, 403)
      }
      else {
        restServer.respondJson(res, null, formatRelationshipsOut(user))
      }
    })
      .catch(function (err) {
        logger.error('Error getting user ' + req.params.id + ' for company ' + req.company.name + ': ', err)
        restServer.respond(res, err)
      })
  })

  /**
     * @apiDescription Creates a new User record.
     *
     * @api {post} /api/users Create User
     * @apiGroup Users
     * @apiPermission System Admin, or Company Admin can create new Users for
     *      their own Company.
     * @apiHeader {String} Authorization The Create Session's returned token
     *      prepended with "Bearer "
     * @apiParam (Request Body) {String} username The User's username
     * @apiParam (Request Body) {String} [email] The User's email (required for
     *      Admin users)
     * @apiParam (Request Body) {String=admin,user} role The User's role
     *      in the system.
     * @apiParam (Request Body) {String} companyId The Id of the Company
     *      that the User belongs to.
     * @apiExample {json} Example body:
     *      {
     *          "username": "jetson",
     *          "email": "g.jetson@spacelysprockets.com",
     *          "role": "user",
     *          "companyId": 3
     *      }
     * @apiSuccess {String} id The new User's id.
     * @apiVersion 1.2.1
     */
  app.post('/api/users', [restServer.isLoggedIn,
    restServer.fetchCompany,
    restServer.isAdmin],
  function (req, res) {
    var rec = req.body
    // You can't specify an id.
    if (rec.id) {
      restServer.respond(res, 400, "Cannot specify the user's id in create")
      return
    }

    // Verify that required fields exist.
    if (!rec.username ||
             !rec.password ||
             !rec.role ||
             !rec.companyId) {
      restServer.respond(res, 400, 'Missing required data')
      return
    }

    // Company must match the user who is an admin role, or the user must be
    // part of the admin group.
    if (((req.user.role !== 'ADMIN') ||
               (rec.companyId !== req.user.company.id)) &&
             (req.company.type !== 'ADMIN')) {
      restServer.respond(res, 403)
      return
    }

    // Do the add.
    modelAPI.users.create(rec).then(function (rec) {
      var send = {}
      send.id = rec.id
      restServer.respondJson(res, 200, send)
    })
      .catch(function (err) {
        restServer.respond(res, err)
      })
  })

  /**
     * @apiDescription Updates the User record with the specified id.
     *
     * @api {put} /api/users/:id Update User
     * @apiGroup Users
     * @apiPermission System Admin, or Company Admin for this Company (cannot
     *      change companyId), or any logged-in User on their own record (cannot
     *      change companyId or role).
     * @apiHeader {String} Authorization The Create Session's returned token
     *      prepended with "Bearer "
     * @apiParam (URL Parameters) {String} id The User's id
     * @apiParam (Request Body) {String} [username] The User's username
     * @apiParam (Request Body) {String} [email] The User's email
     * @apiParam (Request Body) {String=admin,user} [role] The User's role
     *      in the system. (System or Company Admin only)
     * @apiParam (Request Body) {String} [companyId] The Id of the Company
     *      that the User belongs to. (System Admin only)
     * @apiExample {json} Example body:
     *      {
     *          "username": "jetson",
     *          "email": "g.jetson@cogswellcogs.com",
     *          "role": "user",
     *          "companyId": 4
     *      }
     * @apiVersion 1.2.1
     */
  app.put('/api/users/:id', [restServer.isLoggedIn,
    restServer.fetchCompany],
  function (req, res) {
    var data = {}
    data.id = req.params.id
    // We'll start by getting the user, as a read is much less expensive
    // than a write, and then we'll be able to tell if anything really
    // changed before we even try to write.
    modelAPI.users.load(data.id).then(function (user) {
      // Fields that may exist in the request body that anyone (with permissions)
      // can change.  Make sure they actually differ, though.
      var changed = 0
      if ((req.body.username) &&
                 (req.body.username !== user.username)) {
        data.username = req.body.username
        ++changed
      }

      // Note: can't check for a change in the password without hashing
      // the one passed in.  If we get one, just pass it through.
      if (req.body.password) {
        data.password = req.body.password
        ++changed
      }
      if ((req.body.email) &&
                 (req.body.email !== user.email)) {
        data.email = req.body.email
        ++changed
      }

      // In order to update a user record, the logged in user must either be
      // a system admin, a company admin for the user's company, or the user
      // themselves.
      if ((req.company.type !== 'ADMIN') &&
                 ((req.user.role.id !== modelAPI.users.ROLE_ADMIN) ||
                   (req.user.company.id !== user.company.id)) &&
                 (req.user.id !== user.id)) {
        // Nope.  Not allowed.
        restServer.respond(res, 403)
        return
      }
      else if (req.user.id !== user.id) {
        // Admin of some type.  They can change a couple of other
        // things.

        // Convert any role change from string to number.
        if (req.body.role) {
          var newrole = modelAPI.users.roles[ req.body.role ]
          if (newrole) {
            if (newrole !== user.role.id) {
              data.role = newrole
              ++changed
            }
          }
          else {
            // Bad role, bad request.
            restServer.respond(res, 400, 'invalid role')
            return
          }

          // If the new role is admin, we MUST have an email address.
          if ((data.role === modelAPI.users.ROLE_ADMIN) &&
                         (!data.email) &&
                         (!user.email)) {
            restServer.respond(res, 400, 'Admin user MUST have an email address')
            return
          }
        }

        // System admin can change companyId
        if ((req.body.companyId) &&
                     (req.body.companyId !== user.company.id)) {
          if (req.company.type === 'ADMIN') {
            // We COULD verify the company id here, but referential
            // integrity should tell us if we have an issue, anyway.
            data.companyId = req.body.companyId
            ++changed
          }
          else {
            // Not system admin.  Forbidden.
            restServer.respond(res, 403, 'Only system admin can change company of a user')
            return
          }
        }
      }

      // Ready.  Do we have anything to actually change?
      if (changed === 0) {
        // No changes.  But returning 304 apparently causes Apache to strip
        // CORS info, causing the browser to throw a fit.  So just say,
        // "Yeah, we did that.  Really.  Trust us."
        restServer.respond(res, 204)
      }
      else {
        // Do the update.
        modelAPI.users.update(data).then(function () {
          restServer.respond(res, 204)
        })
          .catch(function (err) {
            restServer.respond(res, 400, err)
          })
      }
    })
      .catch(function (err) {
        logger.error('Error getting user ' + req.params.id + ' for company ' + req.company.name + ': ', err)
        restServer.respond(res, err)
      })
  })

  /**
     * @apiDescription Deletes the User record with the specified id.
     *
     * @api {delete} /api/applications/:id Delete User
     * @apiGroup Users
     * @apiPermission System Admin, or Company Admin for this company, though
     *      the caller cannot delete their own record.
     * @apiHeader {String} Authorization The Create Session's returned token
     *      prepended with "Bearer "
     * @apiParam (URL Parameters) {String} id The User's id
     * @apiVersion 1.2.1
     */
  app.delete('/api/users/:id', [restServer.isLoggedIn,
    restServer.fetchCompany,
    restServer.isAdmin],
  function (req, res) {
    // Verify that the user is not trying to delete themselves.
    var id = req.params.id
    if (req.user.id === id) {
      // Forbidden.
      restServer.respond(res, 403, 'Cannot delete your own account')
      return
    }

    // If the caller is a global admin, we can just delete.
    if (req.company.type === 'ADMIN') {
      modelAPI.users.remove(id).then(function () {
        restServer.respond(res, 204)
      })
        .catch(function (err) {
          logger.error('Error deleting user ' + id + ': ', err)
          restServer.respond(res, err)
        })
    }
    else if (req.user.role.id === modelAPI.users.ROLE_ADMIN) {
      // Admin for a company.  Get the user and verify the same company.
      modelAPI.users.load(id).then(function (user) {
        if (user.company.id !== req.user.company.id) {
          restServer.respond(res, 403, 'Cannot delete a user from another company')
        }
        else {
          // OK to delete.
          modelAPI.users.remove(id).then(function () {
            restServer.respond(res, 204)
          })
            .catch(function (err) {
              logger.error('Error deleting user ' + id + ': ', err)
              restServer.respond(res, err)
            })
        }
      })
        .catch(function (err) {
          logger.error('Error retrieving user record for companyId comparison for delete', err)
          restServer.respond(res, err)
        })
    }
    else {
      // Regular user cannot delete accounts.
      restServer.respond(res, 403, 'Cannot delete users')
    }
  })

  /**
     * @apiDescription Verifies/rejects a user's email change
     *
     * @api {put} /api/users/verifyEmail/:uuid Verify User Email
     * @apiGroup Users
     * @apiPermission Any
     * @apiParam (URL Parameters) {UUID} uuid The UUID supplied via email to the
     *      email address.
     * @apiParam (Query Parameters) {String=accept,reject} function The action
     *      to take on the requested email change
     * @apiParam (Query Parameters) {String} source Where the email verification
     *      originated.
     */
  app.put('/api/users/verifyEmail/:uuid', function (req, res) {
    var uuid = req.params.uuid
    var func = req.query.function
    var source = req.query.source

    // Must have a valid function.
    if ((!func) ||
             ((func !== 'accept') &&
               (func !== 'reject'))) {
      restServer.respond(res, 400, 'missing function query parameter')
      return
    }

    // Do it.
    modelAPI.users.handleEmailVerifyResponse(uuid, func, source).then(function () {
      restServer.respond(res, 204)
    })
      .catch(function (err) {
        logger.error('Error verifying email with uuid ' + req.params.uuid + ': ', err)
        restServer.respond(res, err)
      })
  })
}
