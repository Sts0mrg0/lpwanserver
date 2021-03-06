const NetworkProtocol = require('../../NetworkProtocol')
const R = require('ramda')
const { logger } = require('../../../log')
const { joinUrl, renameKeys, attempt } = require('../../../lib/utils')
const httpError = require('http-errors')
const config = require('../../../config')
const { encrypt, decrypt, genKey } = require('../../../lib/crypto')

module.exports = class LoraOpenSource extends NetworkProtocol {
  async connect (network) {
    await this.client.getSession(network)
  }

  async test (network) {
    await this.client.listApplications(network, { limit: 1, offset: 0 })
    return true
  }

  getCompanyAccessAccount (network) {
    const result = super.getCompanyAccessAccount(network)
    return {
      ...R.pick(['username', 'password'], result),
      isAdmin: true
    }
  }

  async getCompanyAccount (network, dataAPI, companyId, generateIfMissing) {
    // Obtain the security data from the protocol storage in the dataAPI, then
    // access it for the user.
    var srd
    var kd
    var secData
    try {
      srd = await this.modelAPI.protocolData.loadValue(network, makeCompanyDataKey(companyId, 'sd'))
      kd = await this.modelAPI.protocolData.loadValue(network, makeCompanyDataKey(companyId, 'kd'))
    }
    catch (err) {
      // Something's off.  Generate new if allowed.
      if (generateIfMissing) {
        logger.info('Generating account for ' + companyId)
        // Take the company name, make it suitable for a user name, and then
        // add "admin" for the username.
        var corec = await dataAPI.getCompanyById(companyId)
        var uname = corec.name.replace(/[^a-zA-Z0-9]/g, '')
        uname += 'admin'
        var pass = await genKey(12)
        kd = await genKey()
        secData = { 'username': uname, 'password': pass }
        srd = encrypt(secData, kd)

        // Save for future reference.networkId, networkProtocolId, key, data
        await this.modelAPI.protocolData.upsert(network, makeCompanyDataKey(companyId, 'sd'), srd)
        await this.modelAPI.protocolData.upsert(network, makeCompanyDataKey(companyId, 'kd'), kd)
        return secData
      }
      else {
        logger.error('LoraOS: Company security data is missing for company id ' + companyId, err)
        return null
      }
    }

    try {
      secData = await decrypt(srd, kd)
    }
    catch (err) {
      return null
    }

    if (!secData.username || !secData.password) {
      logger.error('Company security data is incomplete for company id ' + companyId)
      return null
    }

    return secData
  }

  async addCompany (network, companyId, dataAPI) {
    let company = await dataAPI.getCompanyById(companyId)
    let org = await this.client.createOrganization(network, {
      name: company.name,
      displayName: company.name,
      canHaveGateways: false
    })

    await this.modelAPI.protocolData.upsert(network, makeCompanyDataKey(company.id, 'coNwkId'), org.id)

    try {
      await this.addDefaultOrgAdminUser(network, company, dataAPI, org.id)
      const networkSettings = await this.addDefaultOrgServiceProfile(network, company, dataAPI, org.id)
      return { ...networkSettings, organizationId: org.id }
    }
    catch (err) {
      logger.error(`Failed to add ancillary data to remote host`, err)
      throw err
    }
  }

  async addDefaultOrgAdminUser (network, company, dataAPI, organizationId) {
    var creds = await this.getCompanyAccount(network, dataAPI, company.id, true)
    const body = await this.client.createUser(network, {
      password: creds.password,
      organizations: [
        { isAdmin: true, organizationID: organizationId }
      ],
      username: creds.username,
      isActive: true,
      isAdmin: false,
      sessionTTL: 0,
      email: 'fake@emailaddress.com',
      note: 'Created by and for LPWAN Server'
    })

    await this.modelAPI.protocolData.upsert(network, makeCompanyDataKey(company.id, 'coUsrId'), body.id)

    return body
  }

  async addDefaultOrgServiceProfile (network, company, dataAPI, organizationId) {
    var networkServerId = await this.getANetworkServerID(network)
    const body = await this.client.createServiceProfile(network, {
      name: 'defaultForLPWANServer',
      networkServerID: networkServerId,
      organizationID: organizationId,
      addGWMetadata: true,
      devStatusReqFreq: 1,
      dlBucketSize: 0,
      ulRate: 100000,
      dlRate: 100000,
      dlRatePolicy: 'DROP',
      ulRatePolicy: 'DROP',
      drMax: 3,
      drMin: 0,
      reportDevStatusBattery: true,
      reportDevStatusMargin: true
    })

    // Save the ServiceProfile ID from the remote network.
    await this.modelAPI.protocolData.upsert(network, makeCompanyDataKey(company.id, 'coSPId'), body.id)
    // TODO: Remove this HACK.  Should not store the service profile locally
    // in case it gets changed on the remote server.
    await this.modelAPI.protocolData.upsert(network, makeCompanyDataKey(company.id, 'coSPNwkId'), networkServerId)
    return { serviceProfileId: body.id, networkServerId }
  }

  async getANetworkServerID (network) {
    logger.info('LoRaOpenSource: getANetworkServerID')
    const { result: nsList } = await this.client.listNetworkServers(network, { limit: 20, offset: 0 })
    if (!nsList.length) {
      logger.info('Empty list of Network Servers returned')
      throw httpError.NotFound()
    }
    return nsList[0].id
  }

  async getServiceProfileForOrg (network, orgId, companyId) {
    const body = await this.client.listServiceProfiles(network, {
      organizationID: orgId,
      limit: 20,
      offset: 0
    })
    const serviceProfile = body.result[0]
    if (serviceProfile) {
      logger.warn('LoraOpenSource service profile found', { serviceProfile })
      // TODO: Remove this HACK.  Should not store the service profile locally
      //       in case it gets changed on the remote server.
      await this.modelAPI.protocolData.upsert(network, makeCompanyDataKey(companyId, 'coSPNwkId'), serviceProfile.networkServerID)
      await this.modelAPI.protocolData.upsert(network, makeCompanyDataKey(companyId, 'coSPId'), serviceProfile.id)
    }
    return serviceProfile
  }

  async getCompany (network, companyId, dataAPI) {
    // Get the remote company id.
    const company = await dataAPI.getCompanyById(companyId)
    let orgId = await attempt(
      () => this.modelAPI.protocolData.loadValue(network, makeCompanyDataKey(company.id, 'coNwkId')),
      err => logger.error(`Company ${company.name} does not have a key for the remote network.  Company has not yet been created.`, err)
    )
    return this.client.loadCompany(network, orgId)
  }

  async updateCompany (network, companyId, dataAPI) {
    // Get the remote company id.
    const company = await dataAPI.getCompanyById(companyId)
    let orgId = await attempt(
      () => this.modelAPI.protocolData.loadValue(network, makeCompanyDataKey(company.id, 'coNwkId')),
      err => logger.error(`Company ${company.name} does not have a key for the remote network.  Company has not yet been created.`, err)
    )
    await this.client.updateOrganization(network, orgId, {
      'id': orgId,
      'name': company.name,
      'displayName': company.name,
      canHaveGateways: false
    })
  }

  async deleteCompany (network, companyId, dataAPI) {
    // Get the remote company id.
    let orgId
    let userId
    try {
      orgId = await this.modelAPI.protocolData.loadValue(network, makeCompanyDataKey(companyId, 'coNwkId'))
      // Get the admin user's id, too.
      userId = await this.modelAPI.protocolData.loadValue(network, makeCompanyDataKey(companyId, 'coUsrId'))
    }
    catch (err) {
      // No data.
      logger.info(`Company ${companyId} does not have a key for the remote network.  Company has not yet been created.  ${err}`)
      throw err
    }
    await attempt(
      () => this.client.deleteUser(network, userId),
      err => logger.error(`Error on delete admin user for company ${companyId}`, err)
    )
    await this.client.deleteOrganization(network, orgId)
    // Clear the data for this company from the
    // protocolData store.
    await dataAPI.deleteProtocolDataForKey(
      network.id,
      network.networkProtocol.id,
      makeCompanyDataKey(companyId, 'kd')
    )
    await dataAPI.deleteProtocolDataForKey(
      network.id,
      network.networkProtocol.id,
      makeCompanyDataKey(companyId, 'coUsrId')
    )
    await dataAPI.deleteProtocolDataForKey(
      network.id,
      network.networkProtocol.id,
      makeCompanyDataKey(companyId, 'coNwkId')
    )
    await dataAPI.deleteProtocolDataForKey(
      network.id,
      network.networkProtocol.id,
      makeCompanyDataKey(companyId, 'sd')
    )
    await dataAPI.deleteProtocolDataForKey(
      network.id,
      network.networkProtocol.id,
      makeCompanyDataKey(companyId, 'coSPId')
    )
    // TODO: Remove this HACK.  Should not store the
    // service profile locally in case it gets changed on
    // the remote server.
    await dataAPI.deleteProtocolDataForKey(
      network.id,
      network.networkProtocol.id,
      makeCompanyDataKey(companyId, 'coSPNwkId')
    )
  }

  async pushNetwork (network, dataAPI, modelAPI) {
    await Promise.all([
      this.pushDeviceProfiles(network, modelAPI, dataAPI),
      this.pushApplications(network, modelAPI, dataAPI)
    ])
    await this.pushDevices(network, modelAPI, dataAPI)
  }

  async pushApplications (network, modelAPI, dataAPI) {
    let [apps] = await this.modelAPI.applications.list()
    await Promise.all(apps.map(x => this.pushApplication(network, x, dataAPI, false)))
  }

  async pushApplication (network, app, dataAPI, update = true) {
    let appNetworkId
    try {
      appNetworkId = await this.modelAPI.protocolData.loadValue(network, makeApplicationDataKey(app.id, 'appNwkId'))
      logger.info(`PUSH_APPLICATION: ${appNetworkId}`)
      if (update && appNetworkId) {
        return this.updateApplication(network, app.id, dataAPI)
      }
      else if (appNetworkId) {
        logger.info('Ignoring Application  ' + app.id + ' already on network ' + network.name)
        return { localApplication: app.id, remoteApplication: appNetworkId }
      }
      throw new Error('Bad things in the Protocol Table')
    }
    catch (err) {
      appNetworkId = await this.addApplication(network, app.id, dataAPI)
      logger.info('Added application ' + app.id + ' to network ' + network.name)
      return { localApplication: app.id, remoteApplication: appNetworkId }
    }
  }

  async pushDeviceProfiles (network, modelAPI, dataAPI) {
    let [ dps ] = await this.modelAPI.deviceProfiles.list()
    await Promise.all(dps.map(x => this.pushDeviceProfile(network, x, dataAPI, false)))
  }

  async pushDeviceProfile (network, deviceProfile, dataAPI, update = true) {
    let dpNetworkId
    try {
      dpNetworkId = await this.modelAPI.protocolData.loadValue(network, makeDeviceProfileDataKey(deviceProfile.id, 'dpNwkId'))
      if (update && dpNetworkId) {
        return this.updateDeviceProfile(network, deviceProfile.id, dataAPI)
      }
      else if (dpNetworkId) {
        logger.info('Ignoring DeviceProfile  ' + deviceProfile.id + ' already on network ' + network.name)
        return { localDeviceProfile: deviceProfile.id, remoteDeviceProfile: dpNetworkId }
      }
      throw new Error('Bad things in the Protocol Table')
    }
    catch (err) {
      dpNetworkId = await this.addDeviceProfile(network, deviceProfile.id, dataAPI)
      logger.info('Added DeviceProfile ' + deviceProfile.id + ' to network ' + network.name)
      return { localDeviceProfile: deviceProfile.id, remoteDeviceProfile: dpNetworkId }
    }
  }

  async pushDevices (network, modelAPI, dataAPI) {
    let [ devices ] = await this.modelAPI.devices.list()
    await Promise.all(devices.map(x => this.pushDevice(network, x, dataAPI, false)))
  }

  async pushDevice (network, device, dataAPI, update = true) {
    let devNetworkId
    try {
      devNetworkId = await this.modelAPI.protocolData.loadValue(network, makeDeviceDataKey(device.id, 'devNwkId'))
      if (update && devNetworkId) {
        return this.updateDevice(network, device.id, dataAPI)
      }
      else if (devNetworkId) {
        logger.info('Ignoring Device  ' + device.id + ' already on network ' + network.name)
        return { localDevice: device.id, remoteDevice: devNetworkId }
      }
      throw new Error('Bad things in the Protocol Table')
    }
    catch (err) {
      devNetworkId = await this.addDevice(network, device.id, dataAPI)
      logger.info('Added Device ' + device.id + ' to network ' + network.name)
      return { localDevice: device.id, remoteDevice: devNetworkId }
    }
  }

  async pullNetwork (network, dataAPI, modelAPI) {
    const companyNtl = await this.setupOrganization(network, modelAPI, dataAPI)
    const [pulledDevProfiles, pulledApps] = await Promise.all([
      this.pullDeviceProfiles(network, modelAPI, companyNtl, dataAPI),
      this.pullApplications(network, modelAPI, dataAPI, companyNtl)
    ])
    await Promise.all(pulledApps.map(x =>
      this.pullDevices(network, x.remoteApplication, x.localApplication, pulledDevProfiles, modelAPI, dataAPI)
    ))
  }

  async setupOrganization (network, modelAPI, dataAPI) {
    const [ cos ] = await this.modelAPI.companies.list({ limit: 1 })
    let company = cos[0]
    let companyNtl = await dataAPI.getCompanyNetworkType(company.id, network.networkType.id)
    let loraNetworkSettings = { network: network.id }
    if (!companyNtl) {
      companyNtl = await this.modelAPI.companyNetworkTypeLinks.create(company.id, network.networkType.id, {}, { remoteOrigin: true })
    }
    const { result } = await attempt(
      () => this.client.listOrganizations(network, { search: company.name, limit: 1 }),
      err => logger.error(`Error getting operator ${company.name} from network ${network.name}`, err)
    )
    let organization = result[0]
    if (!organization) {
      logger.warn('Adding company to network ')
      let networkSettings = await this.addCompany(network, company.id, dataAPI)
      networkSettings = { ...companyNtl.networkSettings, networkSettings }
      // add serviceProfileId, networkServerId, and organizationId to networkSettings
      await this.modelAPI.companyNetworkTypeLinks.update({ id: companyNtl.id, networkSettings }, { remoteOrigin: true })
      return networkSettings.networkSettings
    }
    logger.warn('Setting up company to match network Organization')
    let serviceProfile = await this.getServiceProfileForOrg(network, organization.id, company.id, dataAPI)
    await this.modelAPI.protocolData.upsert(network, makeCompanyDataKey(company.id, 'coNwkId'), organization.id)
    const networkServer = await this.client.loadNetworkServer(network, serviceProfile.networkServerID)
    loraNetworkSettings.serviceProfileId = serviceProfile.id
    loraNetworkSettings.networkServerId = serviceProfile.networkServerID
    loraNetworkSettings.organizationId = organization.id
    loraNetworkSettings.networkId = network.id

    companyNtl.networkSettings.serviceProfile = { region: networkServer.region }
    companyNtl.networkSettings[network.name] = loraNetworkSettings
    await this.modelAPI.companyNetworkTypeLinks.update(R.pick(['id', 'networkSettings'], companyNtl), { remoteOrigin: true })
    return loraNetworkSettings
  }

  async pullDeviceProfiles (network, modelAPI, companyNtl, dataAPI) {
    const { result } = await this.client.listDeviceProfiles(network, {
      organizationID: companyNtl.organizationId,
      limit: 9999,
      offset: 0
    })
    return Promise.all(result.map(x => this.addRemoteDeviceProfile(network, x.id, modelAPI, dataAPI)))
  }

  async addRemoteDeviceProfile (network, remoteDevProfileId) {
    const [ cos ] = await this.modelAPI.companies.list({ limit: 1 })
    let company = cos[0]
    const remoteDeviceProfile = await this.client.loadDeviceProfile(network, remoteDevProfileId)
    logger.info('Adding ' + remoteDeviceProfile.name)
    const [ dps ] = await this.modelAPI.deviceProfiles.list({ search: remoteDeviceProfile.name, limit: 1 })
    if (dps.length) {
      let localDp = dps[0]
      logger.info(localDp.name + ' already exists')
      await this.modelAPI.protocolData.upsert(network, makeDeviceProfileDataKey(localDp.id, 'dpNwkId'), remoteDeviceProfile.id)
      return {
        localDeviceProfile: localDp.id,
        remoteDeviceProfile: remoteDeviceProfile.id
      }
    }
    logger.info('creating ' + remoteDeviceProfile.name)
    let networkSettings = this.buildDeviceProfileNetworkSettings(remoteDeviceProfile)
    let localDp = await this.modelAPI.deviceProfiles.create(
      network.networkType.id,
      company.id,
      remoteDeviceProfile.name,
      'Device Profile managed by LPWAN Server, perform changes via LPWAN',
      networkSettings,
      { remoteOrigin: true }
    )
    await this.modelAPI.protocolData.upsert(network, makeDeviceProfileDataKey(localDp.id, 'dpNwkId'), remoteDeviceProfile.id)
    return {
      localDeviceProfile: localDp.id,
      remoteDeviceProfile: remoteDeviceProfile.id
    }
  }

  async pullApplications (network, modelAPI, dataAPI, companyNtl) {
    let { result } = await this.client.listApplications(network, {
      organizationID: companyNtl.organizationId,
      limit: 9999,
      offset: 0
    })
    return Promise.all(result.map(app => this.addRemoteApplication(network, app.id, modelAPI, dataAPI)))
  }

  async addRemoteApplication (network, remoteAppId, modelAPI, dataAPI) {
    const remoteApp = await this.client.loadApplication(network, remoteAppId)
    let integration
    try {
      integration = await this.client.loadApplicationIntegration(network, remoteAppId, 'http')
    }
    catch (err) {
      if (err.statusCode !== 404) throw err
    }
    // Check for local app with the same name
    const [localApps] = await this.modelAPI.applications.list({ search: remoteApp.name })
    let localApp = localApps[0]
    const [ cos ] = await this.modelAPI.companies.list({ limit: 1 })
    const [ reportingProtos ] = await this.modelAPI.reportingProtocols.list()
    if (!localApp) {
      let localAppData = {
        ...R.pick(['name', 'description'], remoteApp),
        companyId: cos[0].id,
        reportingProtocolId: reportingProtos[0].id
      }
      if (integration) localAppData.baseUrl = integration.uplinkDataURL
      localApp = await this.modelAPI.applications.create(localAppData)
      logger.info('Created ' + localApp.name)
    }
    await this.modelAPI.protocolData.upsert(network, makeApplicationDataKey(localApp.id, 'appNwkId'), remoteApp.id)

    const [ appNtls ] = await this.modelAPI.applicationNetworkTypeLinks.list({ applicationId: localApp.id })
    let appNtl = appNtls[0]
    if (appNtl) {
      logger.info(localApp.name + ' link already exists')
    }
    else {
      appNtl = await this.modelAPI.applicationNetworkTypeLinks.create(
        {
          applicationId: localApp.id,
          networkTypeId: network.networkType.id,
          networkSettings: this.buildApplicationNetworkSettings(remoteApp)
        },
        {
          companyId: localApp.company.id,
          remoteOrigin: true
        }
      )
    }
    if (localApp.baseUrl) await this.startApplication(network, localApp.id, dataAPI)
    return { localApplication: localApp.id, remoteApplication: remoteApp.id }
  }

  async pullDevices (network, remoteAppId, localAppId, dpMap, modelAPI, dataAPI) {
    const params = { limit: 9999, offset: 0 }
    const { result } = await this.client.listDevices(network, remoteAppId, params)
    return Promise.all(result.map(device => this.addRemoteDevice(network, device.devEUI, localAppId, dpMap, modelAPI, dataAPI)))
  }

  async addRemoteDevice (network, remoteDeviceId, localAppId, dpMap, modelAPI, dataAPI) {
    const remoteDevice = await this.client.loadDevice(network, remoteDeviceId)
    logger.info('Adding ' + remoteDevice.name)
    let deviceProfileIdMap = dpMap.find(o => o.remoteDeviceProfile === remoteDevice.deviceProfileID)
    let deviceProfile = await dataAPI.getDeviceProfileById(deviceProfileIdMap.localDeviceProfile)
    try {
      if (deviceProfile.networkSettings.supportsJoin) {
        remoteDevice.deviceKeys = await this.client.loadDeviceKeys(network, remoteDevice.devEUI)
      }
      else {
        remoteDevice.deviceActivation = await this.client.loadDeviceActivation(network, remoteDevice.devEUI)
      }
    }
    catch (err) {
      logger.info('Device does not have keys or activation')
    }

    let [ localDevices ] = await this.modelAPI.devices.list({ search: remoteDevice.name }, { limit: 1 })
    let localDevice
    if (localDevices.length) {
      localDevice = localDevices[0]
      logger.info(localDevice.name + ' already exists')
    }
    else {
      logger.info('creating ' + remoteDevice.name)
      const devData = { ...R.pick(['name', 'description'], remoteDevice), applicationId: localAppId }
      localDevice = await this.modelAPI.devices.create(devData)
      logger.info('Created ' + localDevice.name)
    }
    let [ devNtls ] = await this.modelAPI.deviceNetworkTypeLinks.list({ deviceId: localDevice.id, limit: 1 })
    if (devNtls.length) {
      logger.info(localDevice.name + ' link already exists')
    }
    else {
      const [ cos ] = await this.modelAPI.companies.list({ limit: 1 })
      let company = cos[0]
      logger.info('creating Network Link for ' + localDevice.name)
      let networkSettings = this.buildDeviceNetworkSettings(remoteDevice, deviceProfile)
      let devNtlData = {
        deviceId: localDevice.id,
        networkTypeId: network.networkType.id,
        deviceProfileId: deviceProfile.id,
        networkSettings
      }
      await this.modelAPI.deviceNetworkTypeLinks.create(devNtlData, { validateCompanyId: company.id, remoteOrigin: true })
    }
    await this.modelAPI.protocolData.upsert(network, makeDeviceDataKey(localDevice.id, 'devNwkId'), remoteDevice.devEUI)
    return localDevice.id
  }

  async addApplication (network, appId, dataAPI) {
    try {
      // Get the local application data.
      const localApp = await dataAPI.getApplicationById(appId)
      const appNtl = await dataAPI.getApplicationNetworkType(appId, network.networkType.id)
      const coNetworkId = await this.modelAPI.protocolData.loadValue(network, makeCompanyDataKey(localApp.company.id, 'coNwkId'))
      const coSPId = await this.modelAPI.protocolData.loadValue(network, makeCompanyDataKey(localApp.company.id, 'coSPId'))
      const body = await this.client.createApplication(network, this.buildRemoteApplication(
        appNtl && appNtl.networkSettings,
        coSPId,
        coNetworkId,
        localApp
      ))
      // Save the application ID from the remote network.
      await this.modelAPI.protocolData.upsert(network, makeApplicationDataKey(localApp.id, 'appNwkId'), body.id)
      // Start application if baseUrl
      if (localApp.baseUrl && localApp.running) await this.startApplication(network, appId)
    }
    catch (err) {
      logger.info('Failed to get required data for addApplication: ' + err)
      throw err
    }
  }

  async getApplication (network, appId) {
    const appNetworkId = await this.modelAPI.protocolData.loadValue(network, makeApplicationDataKey(appId, 'appNwkId'))
    return this.client.loadApplication(network, appNetworkId)
  }

  async updateApplication (network, appId, dataAPI) {
    // Get the application data.
    var localApp = await dataAPI.getApplicationById(appId)
    var coNetworkId = await this.modelAPI.protocolData.loadValue(network, makeCompanyDataKey(localApp.company.id, 'coNwkId'))
    var appNetworkId = await this.modelAPI.protocolData.loadValue(network, makeApplicationDataKey(appId, 'appNwkId'))
    var applicationData = await dataAPI.getApplicationNetworkType(appId, network.networkType.id)
    let coSPId = await this.modelAPI.protocolData.loadValue(network, makeCompanyDataKey(localApp.company.id, 'coSPId'))
    let reqBody = this.buildRemoteApplication(
      applicationData.networkSettings,
      coSPId,
      coNetworkId,
      localApp
    )

    reqBody.id = appNetworkId

    // Optional data
    if (applicationData && applicationData.networkSettings) {
      let props = ['isABP', 'isClassC', 'relaxFCnt', 'rXDelay', 'rX1DROffset', 'rXWindow', 'rX2DR', 'aDRInterval', 'installationMargin', 'payloadDecoderScript', 'payloadEncoderScript']
      Object.assign(reqBody, R.pick(props, applicationData.networkSettings))
      if (applicationData.networkSettings.payloadCodec && applicationData.networkSettings.payloadCodec !== 'NONE') {
        reqBody.payloadCodec = applicationData.networkSettings.payloadCodec
      }
    }
    await this.client.updateApplication(network, reqBody.id, reqBody)
  }

  async deleteApplication (network, appId, dataAPI) {
    var appNetworkId = await this.modelAPI.protocolData.loadValue(network, makeApplicationDataKey(appId, 'appNwkId'))
    await this.client.deleteApplication(network, appNetworkId)
    await dataAPI.deleteProtocolDataForKey(
      network.id,
      network.networkProtocol.id,
      makeApplicationDataKey(appId, 'appNwkId')
    )
  }

  async startApplication (network, appId) {
    // Create a new endpoint to get POSTs, and call the deliveryFunc.
    // Use the local applicationId and the networkId to create a unique
    // URL.
    const url = joinUrl(config.base_url, 'api/ingest', appId, network.id)

    // Set up the Forwarding with LoRa App Server
    var appNwkId = await this.modelAPI.protocolData.loadValue(network, makeApplicationDataKey(appId, 'appNwkId'))

    const body = {
      ackNotificationURL: url,
      errorNotificationURL: url,
      joinNotificationURL: url,
      uplinkDataURL: url,
      statusNotificationURL: url,
      locationNotificationURL: url
    }

    try {
      await this.client.loadApplicationIntegration(network, appNwkId, 'http')
      await this.client.updateApplicationIntegration(network, appNwkId, 'http', body)
    }
    catch (err) {
      if (err.statusCode !== 404) throw err
      await this.client.createApplicationIntegration(network, appNwkId, 'http', body)
    }
  }

  async stopApplication (network, appId) {
    let appNwkId
    try {
      appNwkId = await this.modelAPI.protocolData.loadValue(network, makeApplicationDataKey(appId, 'appNwkId'))
      try {
        await this.client.loadApplicationIntegration(network, appNwkId, 'http')
      }
      catch (err) {
        if (err.statusCode === 404) return
        throw err
      }
      await this.client.deleteApplicationIntegration(network, appNwkId, 'http')
    }
    catch (err) {
      logger.error(`Cannot delete http integration for application ${appId} on network ${network.name}`, err)
      throw err
    }
  }

  async addDeviceProfile (network, deviceProfileId, dataAPI) {
    logger.info('Adding DP ' + deviceProfileId)
    // Get the deviceProfile data.
    const deviceProfile = await dataAPI.getDeviceProfileById(deviceProfileId)
    const [ cos ] = await this.modelAPI.companies.list({ limit: 1 })
    let company = cos[0]
    let orgId = await this.modelAPI.protocolData.loadValue(network, makeCompanyDataKey(company.id, 'coNwkId'))
    let networkServerId = await this.modelAPI.protocolData.loadValue(network, makeCompanyDataKey(company.id, 'coSPNwkId'))
    const { id } = await this.client.createDeviceProfile(network, this.buildRemoteDeviceProfile(
      deviceProfile,
      networkServerId,
      orgId
    ))
    await this.modelAPI.protocolData.upsert(network, makeDeviceProfileDataKey(deviceProfile.id, 'dpNwkId'), id)
    return id
  }

  async getDeviceProfile (network, deviceProfileId) {
    var dpNetworkId
    try {
      dpNetworkId = await this.modelAPI.protocolData.loadValue(network, makeDeviceProfileDataKey(deviceProfileId, 'dpNwkId'))
    }
    catch (err) {
      logger.error('Error on get deviceProfile network ID:', err)
      throw err
    }
    return this.client.loadDeviceProfile(network, dpNetworkId)
  }

  async updateDeviceProfile (network, deviceProfileId, dataAPI) {
    // Get the application data.
    var deviceProfile
    var dpNetworkId
    var coNetworkId
    try {
      deviceProfile = await dataAPI.getDeviceProfileById(deviceProfileId)
      dpNetworkId = await this.modelAPI.protocolData.loadValue(network, makeDeviceProfileDataKey(deviceProfileId, 'dpNwkId'))
      coNetworkId = await this.modelAPI.protocolData.loadValue(network, makeCompanyDataKey(deviceProfile.company.id, 'coNwkId'))
    }
    catch (err) {
      logger.error('Error getting supporting data for update device Profile:', err)
      throw err
    }
    const reqBody = {
      id: dpNetworkId,
      name: deviceProfile.name,
      organizationID: coNetworkId
    }
    // Optional data
    if (deviceProfile.networkSettings) {
      let props = [
        'macVersion',
        'regParamsRevision',
        'supportsJoin',
        'classBTimeout',
        'classCTimeout',
        'factoryPresetFreqs',
        'maxDutyCycle',
        'maxEIRP',
        'pingSlotDR',
        'pingSlotFreq',
        'pingSlotPeriod',
        'rfRegion',
        'rxDROffset1',
        'rxDataRate2',
        'rxDelay1',
        'rxFreq2',
        'supports32bitFCnt',
        'supportsClassB',
        'supportsClassC'
      ]
      Object.assign(reqBody, R.pick(props, deviceProfile.networkSettings))
      await this.client.updateDeviceProfile(network, reqBody.id, reqBody)
    }
  }

  async deleteDeviceProfile (network, deviceProfileId, dataAPI) {
    let dpNetworkId
    try {
      dpNetworkId = await this.modelAPI.protocolData.loadValue(network, makeDeviceProfileDataKey(deviceProfileId, 'dpNwkId'))
      await dataAPI.deleteProtocolDataForKey(
        network.id,
        network.networkProtocol.id,
        makeDeviceProfileDataKey(deviceProfileId, 'dpNwkId')
      )
    }
    catch (err) {
      logger.error('Error getting supporting data for delete deviceProfile:', err)
      throw err
    }
    await this.client.deleteDeviceProfile(network, dpNetworkId)
  }

  async addDevice (network, deviceId, dataAPI) {
    logger.info(`Adding Device ${deviceId} to ${network.name}`)
    const device = await dataAPI.getDeviceById(deviceId)
    const dntl = await dataAPI.getDeviceNetworkType(deviceId, network.networkType.id)
    if (!dntl) return
    const deviceProfile = await dataAPI.getDeviceProfileById(dntl.deviceProfile.id)
    if (!dntl.networkSettings || !dntl.networkSettings.devEUI) {
      logger.error('deviceNetworkTypeLink MUST have networkSettings which MUST have devEUI')
      throw httpError.BadRequest()
    }
    const appNwkId = await this.modelAPI.protocolData.loadValue(network, makeApplicationDataKey(device.application.id, 'appNwkId'))
    const dpNwkId = await this.modelAPI.protocolData.loadValue(network, makeDeviceProfileDataKey(dntl.deviceProfile.id, 'dpNwkId'))

    let deviceData = this.buildRemoteDevice(
      device,
      dntl,
      deviceProfile,
      appNwkId,
      dpNwkId
    )
    await this.client.createDevice(network, deviceData.device)
    await this.modelAPI.protocolData.upsert(network, makeDeviceDataKey(device.id, 'devNwkId'), deviceData.device.devEUI)
    if (deviceProfile.networkSettings.supportsJoin && deviceData.deviceKeys) {
      await this.client.createDeviceKeys(network, deviceData.device.devEUI, deviceData.deviceKeys)
    }
    else if (deviceData.deviceActivation && deviceData.deviceActivation.fCntUp >= 0) {
      await this.client.activateDevice(network, deviceData.device.devEUI, deviceData.deviceActivation)
    }
    else {
      logger.error('Remote Device ' + deviceData.device.name + ' does not have authentication parameters')
    }
    return dntl.networkSettings.devEUI
  }

  async getDevice (network, deviceId) {
    var devNetworkId = await this.modelAPI.protocolData.loadValue(network, makeDeviceDataKey(deviceId, 'devNwkId'))
    return this.client.loadDevice(network, devNetworkId)
  }

  async updateDevice (network, deviceId, dataAPI) {
    let device = await dataAPI.getDeviceById(deviceId)
    const dntl = await dataAPI.getDeviceNetworkType(device.id, network.networkType.id)
    const deviceProfile = await dataAPI.getDeviceProfileById(dntl.deviceProfile.id)
    const devNetworkId = await this.modelAPI.protocolData.loadValue(network, makeDeviceDataKey(device.id, 'devNwkId'))
    const appNwkId = await this.modelAPI.protocolData.loadValue(network, makeApplicationDataKey(device.application.id, 'appNwkId'))
    const dpNwkId = await this.modelAPI.protocolData.loadValue(network, makeDeviceProfileDataKey(deviceProfile.id, 'dpNwkId'))
    let deviceData = this.buildRemoteDevice(
      device,
      dntl,
      deviceProfile,
      appNwkId,
      dpNwkId
    )
    await this.client.updateDevice(network, devNetworkId, deviceData.device)
    if (deviceProfile.networkSettings.supportsJoin && deviceData.deviceKeys) {
      await this.client.updateDeviceKeys(network, deviceData.device.devEUI, deviceData.deviceKeys)
    }
    else if (deviceData.deviceActivation) {
      // This is the ABP path.
      await this.client.deleteDeviceActivation(network, deviceData.device.devEUI)
      await this.client.activateDevice(network, deviceData.device.devEUI, deviceData.deviceActivation)
    }
    else {
      logger.info('Remote Device ' + deviceData.device.name + ' does not have authentication parameters')
    }
  }

  async deleteDevice (network, deviceId, dataAPI) {
    var devNetworkId
    try {
      devNetworkId = await this.modelAPI.protocolData.loadValue(network, makeDeviceDataKey(deviceId, 'devNwkId'))
    }
    catch (err) {
      // Can't delete without the remote ID.
      logger.error("Failed to get remote network's device ID:", err)
      throw err
    }
    await this.client.deleteDevice(network, devNetworkId)
    try {
      await dataAPI.deleteProtocolDataForKey(
        network.id,
        network.networkProtocol.id,
        makeDeviceDataKey(deviceId, 'devNwkId'))
    }
    catch (err) {
      logger.error("Failed to delete remote network's device ID: ", err)
    }
    await this.client.deleteDeviceKeys(network, devNetworkId)
  }

  async passDataToDevice (network, appId, deviceId, body) {
    // Ensure network is enabled
    if (!network.securityData.enabled) return
    const devNwkId = await this.modelAPI.protocolData.loadValue(network, makeDeviceDataKey(deviceId, 'devNwkId'))
    body = renameKeys({ jsonData: 'jsonObject' }, body)
    return this.client.createDeviceMessage(network, devNwkId, { ...body, devEUI: devNwkId })
  }

  buildApplicationNetworkSettings (remoteApplication) {
    const keys = ['payloadCodec', 'payloadDecoderScript', 'payloadEncoderScript']
    return R.pick(keys, remoteApplication)
  }

  buildRemoteApplication (networkSettings, serviceProfileId, organizationId, app) {
    const result = {
      ...R.pick(['name', 'description'], app),
      'organizationID': organizationId,
      'serviceProfileID': serviceProfileId
    }
    if (networkSettings) {
      Object.assign(result, R.pick(['payloadCodec', 'payloadDecoderScript', 'payloadEncoderScript'], networkSettings))
    }
    return result
  }

  buildDeviceProfileNetworkSettings (remoteDeviceProfile) {
    return R.omit(['createdAt', 'updatedAt'], remoteDeviceProfile)
  }

  buildRemoteDeviceProfile (deviceProfile, networkServerId, organizationId) {
    return {
      ...R.pick(['name'], deviceProfile),
      ...deviceProfile.networkSettings,
      networkServerID: networkServerId,
      organizationID: organizationId
    }
  }

  buildDeviceNetworkSettings (remoteDevice) {
    return R.pick([
      'devEUI',
      'skipFCntCheck',
      'deviceStatusBattery',
      'deviceStatusMargin',
      'lastSeenAt',
      'deviceKeys',
      'deviceActivation'
    ], remoteDevice)
  }

  buildRemoteDevice (device, deviceNtl, deviceProfile, remoteAppId, remoteDeviceProfileId) {
    return { device: {
      ...R.pick(['name', 'description'], device),
      ...R.pick(['devEUI', 'skipFCntCheck'], deviceNtl.networkSettings),
      applicationID: remoteAppId,
      deviceProfileID: remoteDeviceProfileId
    } }
  }
}

function makeCompanyDataKey (companyId, dataName) {
  return 'co:' + companyId + '/' + dataName
}

function makeApplicationDataKey (applicationId, dataName) {
  return 'app:' + applicationId + '/' + dataName
}

function makeDeviceDataKey (deviceId, dataName) {
  return 'dev:' + deviceId + '/' + dataName
}

function makeDeviceProfileDataKey (deviceProfileId, dataName) {
  return 'dp:' + deviceProfileId + '/' + dataName
}
