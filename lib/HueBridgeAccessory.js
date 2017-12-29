// homebridge-hue/lib/HueBridgeAccessory.js
// Copyright © 2016, 2017 Erik Baauw. All rights reserved.
//
// Homebridge plugin for Philips Hue.
//
// HueBridgeAccessory provides support for Philips Hue compatible bridges.

'use strict';

const deferred = require('deferred');
const fs = require('fs');
const os = require('os');
const request = require('request');
const util = require('util');

const LibAccessory = require('homebridge-lib').LibAccessory;
const HueAccessory = require('./HueAccessory');
const HueBridgeService = require('./HueBridgeService');

// ===== HueBridge =============================================================

module.exports = class HueBridgeAccessory extends LibAccessory {

  // Create a new HueBridgeAccessory.
  constructor(platform, params) {
    super(platform, params);
    this.bridge = new HueBridgeService(this, {
      serviceName: 'HueBridge',
      name: this.name
    });
    this.updateHost(params.host);
    this.configure();
    this.request = deferred.gate(
      this._request, this.context.parallelRequests
    );

    this.state = {
      request: 0,
      touchlink: false
    };
    this.lights = {};
    this.groups = {};
    this.sensors = {};
    this.schedules = {};
    this.rules = {};

    this.on('identify', () => {
      this.onIdentify();
      this.dumpState();
    });
  }

  configure() {
    this.context.parallelRequests = 10;
    switch (this.model) {
      case 'BSB001':                // Philips Hue v1 (round) bridge;
        this.context.parallelRequests = 3;
        this.context.nativeHomeKit = false;
        /* falls through */
      case 'BSB002':                // Philips Hue v2 (square) bridge;
        const versions = this.firmware.split('.');
        const major = Number(versions[0]);
        const minor = Number(versions[1]);
        if (major !== 1 || minor < 15 || minor > 22) {
          this.warning('api version %s', this.firmware);
        }
        return;
      case 'deCONZ':
        if (this.firmware !== '1.0.5') {
          this.warning('api version %s', this.firmware);
        }
        // this.config.linkbutton = false;
        return;
      default:
        this.warning('unknown bridge %j', this.context);
        break;
    }
  }

  onIdentify() {
    this.info(
      '%s %s bridge, api v%s at %s', this.manufacturer,
      this.model, this.firmware, this.context.host
    );
    if (!this.bridge.enabled) {
      this.warning('set Enabled to use this bridge');
    }
  }

  dumpState() {
    const d = deferred;
    this.request('get', '/')
    .then((body) => {
      const filename = this.storagePath + "/" + this.name + '.json';
      this.info('dumping masked state to %s', filename);
      body.config.bridgeid = 'xxxxxxFFFExxxxxx';
      body.config.mac = 'xx:xx:xx:xx:xx:xx';
      body.config.ipaddress = 'xxx.xxx.xxx.xxx';
      body.config.gateway = 'xxx.xxx.xxx.xxx';
      if (body.config.proxyaddress !== 'none') {
        body.config.proxyaddress = 'xxx.xxx.xxx.xxx';
      }
      let json = JSON.stringify(body);
      let i = 0;
      for (const username in body.config.whitelist) {
        i += 1;
        const regexp = RegExp(username, 'g');
        let mask = username.replace(/./g, 'x');
        mask = (mask + i).slice(-username.length);
        json = json.replace(regexp, mask);
      }
      fs.writeFile(filename, json, function(err) {
        if (err) {
          this.error('cannot create %s: error %s', filename, err.code);
          return d.reject();
        }
      }.bind(this));
      return d.resolve();
    });
    return d.promise;
  }

  updateHost(host) {
    this.context.host = host;
    this.url = this.context.username ? util.format(
      'http://%s/api/%s', this.context.host, this.context.username
    ) : util.format('http://%s/api', this.context.host);
    this.onIdentify();
  }

  enable() {
    this.url = 'http://' + this.context.host + '/api';
    if (this.model === 'deCONZ') {
      this.warning('unlock gateway to use this bridge');
    } else {
      this.warning('press link button to use this bridge');
    }
  }

  disable() {
    if (this.context.username) {
      this.request('delete', '/config/whitelist/' + this.context.username)
      .then((obj) => {
        this.info('deleted user %s', this.context.username);
        delete this.context.username;
      });
    }
    delete this.url;
  }

  // ===== Heartbeat =========-=================================================

  heartbeat(beat) {
    if (!this.bridge.enabled || beat % this.bridge.heartrate !== 0) {
      return;
    }
    this.getUser()
    .then(this.getConfig.bind(this))
    .then(this.getSensors.bind(this))
    .then(this.getLights.bind(this))
    .then(this.getGroup0.bind(this))
    .then(this.getGroups.bind(this))
    .then(this.getSchedules.bind(this))
    .then(this.getRules.bind(this));
  }

  getUser() {
    if (this.context.username) {
      return deferred(true);
    }
    const devicetype = ('homebridge-hue#' + os.hostname().split('.')[0])
      .substr(0, 40);
    return this.request('post', '/', {devicetype: devicetype})
    .then((obj) => {
      const username = obj[0].success.username;
      this.context.username = username;
      this.url += '/' + username;
      this.info('created user %s', username);
    });
  }

  getConfig() {
    return this.request('get', '/config').then((config) => {
      if (!config.UTC) {
        // Hue bridge treated this as an unauthenticated GET /api/config.
        return deferred(false);
      }
      this.bridge.heartbeat(config);
      return deferred(true);
    });
  }

  getSensors() {
    if (!this.platform.config.sensors) {
      return deferred(true);
    }
    return this.request('get', '/sensors').then((sensors) => {
      for (const id in sensors) {
        const a = this.sensors[id];
        if (a) {
          a.heartbeat(sensors[id]);
        } else {
        }
      }
    });
  }

  getLights() {
    if (!this.platform.config.lights) {
      return deferred(true);
    }
    return this.request('get', '/lights').then((lights) => {
      for (const id in lights) {
        const a = this.lights[id];
        if (a) {
          a.heartbeat(lights[id]);
        } else {
        }
      }
    });
  }

  getGroup0() {
    if (!this.platform.config.groups || !this.platform.config.group0) {
      return deferred(true);
    }
    return this.request('get', '/groups/0').then((group0) => {
      const a = this.groups['0'];
      if (a) {
        a.heartbeat(group0);
      } else {
      }
    });
  }

  getGroups() {
    if (!this.platform.config.groups) {
      return deferred(true);
    }
    return this.request('get', '/groups').then((groups) => {
      for (const id in groups) {
        const a = this.groups[id];
        if (a) {
          a.heartbeat(groups[id]);
        } else {
        }
      }
    });
  }

  getSchedules() {
    if (!this.platform.config.schedules) {
      return deferred(true);
    }
    return this.request('get', '/schedules').then((schedules) => {
      for (const id in schedules) {
        const a = this.schedules[id];
        if (a) {
          a.heartbeat(schedules[id]);
        } else {
        }
      }
    });
  }

  getRules() {
    if (!this.platform.config.rules) {
      return deferred(true);
    }
    return this.request('get', '/rules').then((rules) => {
      for (const id in rules) {
        const a = this.rules[id];
        if (a) {
          a.heartbeat(rules[id]);
        } else {
        }
      }
    });
  }

  // ===== Bridge Communication ==================================================

  // Send request to the bridge and return a promise to the result.
  _request(method, resource, body) {
    const d = deferred();
    const requestObj = {
      method: method,
      url: this.url + (resource === '/' ? '' : resource),
      timeout: this.platform.config.timeout * 1000,
      json: true
    };
    // if (this.context.model === 'deCONZ') {
    //   requestObj.headers = {
    //     Accept: 'application/vnd.ddel.v1'
    //   };
    // }
    const requestNumber = ++this.state.request;
    let requestMsg;
    requestMsg = util.format(
      'bridge request %d: %s %s', requestNumber, method, resource
    );
    if (body) {
      requestObj.body = body;
      requestMsg = util.format('%s %j', requestMsg, body);
    }
    this.debug(requestMsg);
    request(requestObj, (error, response, responseBody) => {
      if (error) {
        // if (error.code === 'ECONNRESET') {
        //   this.debug(requestMsg);
        //   this.debug(
        //     'bridge request %d: communication error %s - retrying in %dms',
        //     requestNumber, error.code, this.platform.config.waitTimeResend
        //   );
        //   setTimeout(function () {
        //     d.resolve(this._request(method, resource, body));
        //   }.bind(this), this.platform.config.waitTimeResend);
        //   return;
        // }
        this.error(requestMsg);
        this.error('communication error %s', error.code ? error.code : error);
        // TODO: mark bridge as unreachable when too many errors.
        return d.reject();
      }
      if (responseBody === '' && response.statusCode !== 200) {
        this.error(requestMsg);
        this.error('http status %s %s', response.statusCode, response.statusMessage);
        return d.reject();
      }
      this.debug(
        'bridge request %d: http status %s %s', requestNumber,
        response.statusCode, response.statusMessage
      );
      if (Array.isArray(responseBody)) {
        for (const id in responseBody) {
          const e = responseBody[id].error;
          if (e) {
            if (e.type === 101) { // link button not pressed
              this.debug('bridge error %d: %s', e.type, e.description);
              return d.reject();
            }
            this.error('bridge error %d: %s', e.type, e.description);
            if (e.type === 1) { // unauthorised user
              this.bridge.enabled = 0;
              delete this.context.username;
              delete this.url;
            }
            return d.reject();
          }
        }
      }
      return d.resolve(responseBody);
    });
    return d.promise;
  }

};
