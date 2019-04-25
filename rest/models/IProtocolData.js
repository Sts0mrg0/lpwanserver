const { prisma, formatInputData, formatRelationshipsIn } = require('../lib/prisma')
const httpError = require('http-errors')
const { onFail } = require('../lib/utils')

module.exports = class ProtocolData {
  createProtocolData (networkId, networkProtocolId, dataIdentifier, dataValue) {
    const data = formatInputData({
      networkId,
      networkProtocolId,
      dataIdentifier,
      dataValue
    })
    return prisma.createProtocolData(data).$fragment(fragments.basic)
  }

  async retrieveProtocolData (networkId, networkProtocolId, dataIdentifier) {
    const where = formatRelationshipsIn({ networkId, networkProtocolId, dataIdentifier })
    const [ record ] = await prisma.protocolDatas({ where })
    if (!record) throw httpError.NotFound()
    return record
  }

  updateProtocolData ({ id, ...data }) {
    if (!id) throw httpError(400, 'No existing ProtocolData ID')
    data = formatInputData(data)
    return prisma.updateProtocolData({ data, where: { id } }).$fragment(fragments.basic)
  }

  deleteProtocolData (id) {
    return onFail(400, () => prisma.deleteProtocolData({ id }))
  }

  clearProtocolData (networkId, networkProtocolId, keyStartsWith) {
    const where = formatRelationshipsIn({
      networkId,
      networkProtocolId,
      dataIdentifier_contains: keyStartsWith
    })
    return prisma.deleteManyProtocolDatas(where)
  }

  reverseLookupProtocolData (networkId, keyLike, dataValue) {
    const where = formatRelationshipsIn({
      networkId,
      dataIdentifier_contains: keyLike,
      dataValue
    })
    return prisma.protocolDatas({ where })
  }
}

// ******************************************************************************
// Fragments for how the data should be returned from Prisma.
// ******************************************************************************
const fragments = {
  basic: `fragment BasicProtocolData on ProtocolData {
    id
    dataIdentifier
    dataValue
    network {
      id
    }
    networkProtocol {
      id
    }
  }`
}
