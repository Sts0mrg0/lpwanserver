var assert = require('assert')
var chai = require('chai')
var chaiHttp = require('chai-http')
const { createApp } = require('../../../app/express-app')
var should = chai.should()

chai.use(chaiHttp)
var server

var npId1
var npId2

describe('NetworkProviders', function () {
  var adminToken

  before('User Sessions', async () => {
    const app = await createApp()
    server = chai.request(app).keepOpen()
    const res = await server
      .post('/api/sessions')
      .send({ 'login_username': 'admin', 'login_password': 'password' })
    adminToken = res.text
  })

  describe('POST /api/networkProviders', function () {
    it('should return 200 on creating new network Provider with admin account #1', function (done) {
      server
        .post('/api/networkProviders')
        .set('Authorization', 'Bearer ' + adminToken)
        .set('Content-Type', 'application/json')
        .send({ 'name': 'Kyrio' })
        .end(function (err, res) {
          if (err) return done(err)
          res.should.have.status(200)
          var ret = JSON.parse(res.text)
          npId1 = ret.id
          done()
        })
    })

    it('should return 200 on creating new network Provider with admin account #2', function (done) {
      server
        .post('/api/networkProviders')
        .set('Authorization', 'Bearer ' + adminToken)
        .set('Content-Type', 'application/json')
        .send({ 'name': 'TMobile' })
        .end(function (err, res) {
          if (err) return done(err)
          res.should.have.status(200)
          var ret = JSON.parse(res.text)
          npId2 = ret.id
          done()
        })
    })
  })
  describe('GET /api/networkProviders', function () {
    it('should return 200 with 2 Providers on admin', function (done) {
      server
        .get('/api/networkProviders')
        .set('Authorization', 'Bearer ' + adminToken)
        .set('Content-Type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)
          res.should.have.status(200)
          var result = JSON.parse(res.text)
          result.records.should.be.instanceof(Array)
          result.records.should.have.length(2)
          result.totalCount.should.equal(2)
          done()
        })
    })

    it('should return 200 with 1 Provider limit 1 offset 1', function (done) {
      server
        .get('/api/networkProviders?limit=1&offset=1')
        .set('Authorization', 'Bearer ' + adminToken)
        .set('Content-Type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)
          res.should.have.status(200)
          var result = JSON.parse(res.text)
          result.records.should.be.instanceof(Array)
          result.records.should.have.length(1)
          result.totalCount.should.equal(2)
          done()
        })
    })
  })

  describe('GET /api/networkProviders/{id}', function () {
    it('should return 200 on admin', function (done) {
      server
        .get('/api/networkProviders/' + npId1)
        .set('Authorization', 'Bearer ' + adminToken)
        .set('Content-Type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)
          res.should.have.status(200)
          done()
        })
    })

    it('should return 200 on admin', function (done) {
      server
        .get('/api/networkProviders/' + npId2)
        .set('Authorization', 'Bearer ' + adminToken)
        .set('Content-Type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)
          res.should.have.status(200)
          done()
        })
    })
  })

  describe('PUT /api/networkProviders', function () {

    it('should return 204 on admin', function (done) {
      server
        .put('/api/networkProviders/' + npId2)
        .set('Authorization', 'Bearer ' + adminToken)
        .set('Content-Type', 'application/json')
        .send('{"name": "Sprint NB-IoT" }')
        .end(function (err, res) {
          if (err) return done(err)
          res.should.have.status(204)
          done()
        })
    })

    it('should return 200 on get with new company name', function (done) {
      server
        .get('/api/networkProviders/' + npId2)
        .set('Authorization', 'Bearer ' + adminToken)
        .set('Content-Type', 'application/json')
        .send()
        .end(function (err, res) {
          if (err) return done(err)
          res.should.have.status(200)
          var coObj = JSON.parse(res.text)
          coObj.name.should.equal('Sprint NB-IoT')
          done()
        })
    })
  })

  describe('DELETE /api/networkProviders', function () {
    it('should return 204 on admin', function (done) {
      server
        .delete('/api/networkProviders/' + npId1)
        .set('Authorization', 'Bearer ' + adminToken)
        .end(function (err, res) {
          if (err) return done(err)
          res.should.have.status(204)
          done()
        })
    })
    it('should return 204 on admin', function (done) {
      server
        .delete('/api/networkProviders/' + npId2)
        .set('Authorization', 'Bearer ' + adminToken)
        .end(function (err, res) {
          if (err) return done(err)
          res.should.have.status(204)
          done()
        })
    })
  })
})
