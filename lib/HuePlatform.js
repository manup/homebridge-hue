// homebridge-hue/lib/HuePlatform.js
// Copyright © 2016, 2017 Erik Baauw. All rights reserved.
//
// Homebridge plugin for Philips Hue.
//
// HuePlatform provides the platform for support Philips Hue compatible bridges
// and connected devices.  The platform provides discovery of bridges and
// setting up a heartbeat to poll the bridges.

'use strict';

const deferred = require('deferred');
const request = require('request');
const util = require('util');

const LibPlatform = require('homebridge-lib').LibPlatform;
const LibObject = require('homebridge-lib').LibObject;

const HueBridge = require('./HueBridge');

function toIntBetween(value, minValue, maxValue, defaultValue) {
  const n = Number(value);
  if (isNaN(n) || n !== Math.floor(n) || n < minValue || n > maxValue) {
    return defaultValue;
  }
  return n;
}

// ===== Homebridge ============================================================

let Accessory;
let Service;
let Characteristic;

function setHomebridge(homebridge) {
  Accessory = homebridge.platformAccessory;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  Characteristic.Resource = function() {
    Characteristic.call(this, 'Resource', Characteristic.Resource.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ]
    });
    this.value = this.getDefaultValue();
  };
  util.inherits(Characteristic.Resource, Characteristic);
  Characteristic.Resource.UUID = '00000021-0000-1000-8000-656261617577';

  Characteristic.Enabled = function() {
    Characteristic.call(this, 'Enabled', Characteristic.Enabled.UUID);
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY,
      	      Characteristic.Perms.WRITE]
    });
    this.value = this.getDefaultValue();
  };
  util.inherits(Characteristic.Enabled, Characteristic);
  Characteristic.Enabled.UUID = '00000022-0000-1000-8000-656261617577';

  Characteristic.LastUpdated = function() {
    Characteristic.call(this, 'Last Updated', Characteristic.LastUpdated.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  util.inherits(Characteristic.LastUpdated, Characteristic);
  Characteristic.LastUpdated.UUID = '00000023-0000-1000-8000-656261617577';

  Characteristic.Heartrate = function() {
    Characteristic.call(this, 'Heartrate', Characteristic.Heartrate.UUID);
    this.setProps({
      format: Characteristic.Formats.INT,
      unit: Characteristic.Units.SECONDS,
      minValue: 1,
      maxValue: 30,
      stepValue: 1,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY,
              Characteristic.Perms.WRITE]
    });
    this.value = this.getDefaultValue();
  };
  util.inherits(Characteristic.Heartrate, Characteristic);
  Characteristic.Heartrate.UUID = '00000024-0000-1000-8000-656261617577';

  Characteristic.Dark = function() {
    Characteristic.call(this, 'Dark', Characteristic.Dark.UUID);
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  util.inherits(Characteristic.Dark, Characteristic);
  Characteristic.Dark.UUID = '00000025-0000-1000-8000-656261617577';

  Characteristic.Daylight = function() {
    Characteristic.call(this, 'Daylight', Characteristic.Daylight.UUID);
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  util.inherits(Characteristic.Daylight, Characteristic);
  Characteristic.Daylight.UUID = '00000026-0000-1000-8000-656261617577';

  Characteristic.Status = function() {
    Characteristic.call(this, 'Status', Characteristic.Status.UUID);
    this.setProps({
      minValue: 0,
      maxValue: 255,
      minStep: 1,
      format: Characteristic.Formats.INT,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY,
              Characteristic.Perms.WRITE]
    });
    this.value = this.getDefaultValue();
  };
  util.inherits(Characteristic.Status, Characteristic);
  Characteristic.Status.UUID = '00000027-0000-1000-8000-656261617577';

  Characteristic.AnyOn = function() {
    Characteristic.call(this, 'Any On', Characteristic.AnyOn.UUID);
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY,
              Characteristic.Perms.WRITE]
    });
    this.value = this.getDefaultValue();
  };
  util.inherits(Characteristic.AnyOn, Characteristic);
  Characteristic.AnyOn.UUID = '00000028-0000-1000-8000-656261617577';

  Characteristic.LastTriggered = function() {
    Characteristic.call(
      this, 'Last Triggered', Characteristic.LastTriggered.UUID
    );
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  util.inherits(Characteristic.LastTriggered, Characteristic);
  Characteristic.LastTriggered.UUID = '00000029-0000-1000-8000-656261617577';

  Characteristic.TimesTriggered = function() {
    Characteristic.call(
      this, 'Times Triggered', Characteristic.TimesTriggered.UUID
    );
    this.setProps({
      format: Characteristic.Formats.INT,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  util.inherits(Characteristic.TimesTriggered, Characteristic);
  Characteristic.TimesTriggered.UUID = '0000002A-0000-1000-8000-656261617577';

  Characteristic.Sensitivity = function() {
    Characteristic.call(
      this, 'Sensitivity', Characteristic.Sensitivity.UUID
    );
    this.setProps({
      format: Characteristic.Formats.UINT8,
      minValue: 0,
      maxValue: 2,
      stepValue: 1,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY,
      	      Characteristic.Perms.WRITE]
    });
    this.value = this.getDefaultValue();
  };
  util.inherits(Characteristic.Sensitivity, Characteristic);
  Characteristic.Sensitivity.UUID = '0000002B-0000-1000-8000-656261617577';

  Characteristic.Duration = function() {
    Characteristic.call(
      this, 'Duration', Characteristic.Duration.UUID
    );
    this.setProps({
      format: Characteristic.Formats.UINT16,
      unit: 'm',
      minValue: 0,
      maxValue: 120,
      stepValue: 1,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY,
      	      Characteristic.Perms.WRITE]
    });
    this.value = this.getDefaultValue();
  };
  util.inherits(Characteristic.Duration, Characteristic);
  Characteristic.Duration.UUID = '0000002C-0000-1000-8000-656261617577';

  Characteristic.Link = function() {
    Characteristic.call(
      this, 'Link', Characteristic.Link.UUID
    );
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY,
              Characteristic.Perms.WRITE]
    });
    this.value = this.getDefaultValue();
  };
  util.inherits(Characteristic.Link, Characteristic);
  Characteristic.Link.UUID = '0000002D-0000-1000-8000-656261617577';

  Characteristic.Touchlink = function() {
    Characteristic.call(
      this, 'Touchlink', Characteristic.Touchlink.UUID
    );
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY,
              Characteristic.Perms.WRITE]
    });
    this.value = this.getDefaultValue();
  };
  util.inherits(Characteristic.Touchlink, Characteristic);
  Characteristic.Touchlink.UUID = '0000002E-0000-1000-8000-656261617577';

  // Custome HomeKit service for Hue bridge resource.
  Service.Resource = function(displayName, subtype) {
    Service.call(this, displayName, Service.Resource.UUID, subtype);
    this.addCharacteristic(Characteristic.Enabled);
    this.addOptionalCharacteristic(Characteristic.LastTriggered);
    this.addOptionalCharacteristic(Characteristic.TimesTriggered);
    this.addOptionalCharacteristic(Characteristic.StatusActive);
    this.addOptionalCharacteristic(Characteristic.Resource);
  };
  util.inherits(Service.Resource, Service);
  Service.Resource.UUID = '00000011-0000-1000-8000-656261617577';

  // Custome HomeKit service for a Hue bridge.
  Service.HueBridge = function(displayName, subtype) {
    Service.call(this, displayName, Service.HueBridge.UUID, subtype);
    this.addCharacteristic(Characteristic.Heartrate);
    this.addCharacteristic(Characteristic.LastUpdated);
    this.addOptionalCharacteristic(Characteristic.Link);
    this.addOptionalCharacteristic(Characteristic.Touchlink);
  };
  util.inherits(Service.HueBridge, Service);
  Service.HueBridge.UUID = '00000012-0000-1000-8000-656261617577';

  // Custom HomeKit service for a CLIPGenericStatus sensor.
  Service.Status = function(displayName, subtype) {
    Service.call(this, displayName, Service.Status.UUID, subtype);
    this.addCharacteristic(Characteristic.Status);
  };
  util.inherits(Service.Status, Service);
  Service.Status.UUID = '00000013-0000-1000-8000-656261617577';

  // Custom homekit characteristic for Colour Temperature in Kelvin.
  // Source: as exposed by Nanoleaf and recognised by Elgato's Eve.
  Characteristic.ColorTemperature = function() {
    Characteristic.call(
      this, 'Color Temperature', Characteristic.ColorTemperature.UUID
    );
    this.setProps({
      format: Characteristic.Formats.INT,
      unit: 'K',
      minValue: 2000,
      maxValue: 6536,
      stepValue: 1,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY,
      	      Characteristic.Perms.WRITE]
    });
    this.value = this.getDefaultValue();
  };
  util.inherits(Characteristic.ColorTemperature, Characteristic);
  Characteristic.ColorTemperature.UUID = 'A18E5901-CFA1-4D37-A10F-0071CEEEEEBD';

  // Custom homekit characteristic for Color Temperature in Mired.
  // Source: as exposed by the Philips Hue bridge v2.
  Characteristic.CT = function() {
    Characteristic.call(
      this, 'Color Temperature', Characteristic.CT.UUID
    );
    this.setProps({
      format: Characteristic.Formats.INT,
      unit: 'mired',
      minValue: 153,
      maxValue: 500,
      stepValue: 1,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY,
      	      Characteristic.Perms.WRITE]
    });
    this.value = this.getDefaultValue();
  };
  util.inherits(Characteristic.CT, Characteristic);
  Characteristic.CT.UUID = 'E887EF67-509A-552D-A138-3DA215050F46';

  // Custom HomeKit characteristic for Unique ID.
  // Source: as exposed by the Philips Hue bridge.  This characteristic is used
  // by the Hue app to select the accessories when syncing Hue bridge Room
  // groups to HomeKit rooms.
  Characteristic.UniqueID = function() {
    Characteristic.call(
      this, 'Unique ID', Characteristic.UniqueID.UUID
    );
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ]
    });
    this.value = this.getDefaultValue();
  };
  util.inherits(Characteristic.UniqueID, Characteristic);
  Characteristic.UniqueID.UUID = 'D8B76298-42E7-5FFD-B1D6-1782D9A1F936';
}

// ===== HuePlatform ===========================================================

// Class for homebridge-hue platform plugin.
module.exports = class HuePlatform extends LibPlatform {

  // Initialise the homebridge-hue platform.
  // Called by homebridge when initialising the plugin.
  constructor(log, configJson, homebridge) {
    super(log, configJson, homebridge);
    setHomebridge(homebridge);
    this.parseConfigJson();
    this.foundBridges = {};
    this.hueBridges = {};

    this.on('upnpDeviceFound', this.upnpHandler.bind(this));
    this.on('upnpDeviceAlive', this.upnpHandler.bind(this));
    this.on('heartbeat', function(beat) {
      if (beat % 300 === 0) {
        this.nupnp();
        this.nupnpDeconz();
      }
      for (const key in this.hueBridges) {
        this.hueBridges[key].heartbeat(beat);
      }
    }.bind(this));
  }

  // Parse the platform section in config.json.
  parseConfigJson() {
    this.config = {
      ct: false,
      excludeSensorTypes: {},
      groups: false,
      group0: false,
      heartrate: 5,
      hosts: [],
      lights: false,
      linkbutton: true,
      lowBattery: 25,
      philipsLights: false,
      rules: false,
      rooms: false,
      schedules: false,
      sensors: false,
      timeout: 5,
      users: {},
      waitTimeResend: 300,
      waitTimeUpdate: 20,
      wallSwitch: false
    };
    for (const key in this.configJson) {
      const value = this.configJson[key];
      switch (key.toLowerCase()) {
        case 'ct':
          this.config.ct = value ? true : false;
          break;
        case 'excludesensortypes':
          if (Array.isArray(value)) {
            for (const type of value) {
              this.config.excludeSensorTypes[type] = true;
              switch (type) {
                case 'ZLLPresence':
                  this.config.excludeSensorTypes.ZHAPresence = true;
                  break;
                case 'ZLLLightLevel':
                  this.config.excludeSensorTypes.ZHALight = true;
                  break;
                case 'ZLLTemperature':
                  this.config.excludeSensorTypes.ZHATemperature = true;
                  break;
                case 'ZLLSwitch':
                  this.config.excludeSensorTypes.ZHASwitch = true;
                  break;
                default:
                  break;
              }
            }
          } else {
            this.warning('config.json: %s: ignoring non-array value', key);
          }
          break;
        case 'groups':
          this.config.groups = value ? true : false;
          break;
        case 'group0':
          this.config.group0 = value ? true : false;
          break;
        case 'heartrate':
          this.config.heartrate = toIntBetween(
            value, 1, 30, this.config.heartrate
          );
          break;
        case 'host':
        case 'hosts':
          if (Array.isArray(value)) {
            for (const host of value) {
              if (host !== '') {
                this.config.hosts.push(host);
              }
            }
          } else if (value !== '') {
            this.config.hosts.push(value);
          }
          break;
        case 'lights':
          this.config.lights = value ? true : false;
          break;
        case 'linkbutton':
          this.config.linkbutton = value ? true : false;
          break;
        case 'lowbattery':
          this.config.lowBattery = toIntBetween(
            value, 0, 100, this.config.lowBattery
          );
          break;
        case 'name':
          this.name = value;
          break;
        case 'parallelrequests':
          this.config.parallelRequests = toIntBetween(
            value, 1, 30, this.config.parallelRequests
          );
          break;
        case 'philipslights':
          this.config.philipsLights = value ? true : false;
          break;
        case 'platform':
          break;
        case 'rooms':
          this.config.rooms = value ? true : false;
          break;
        case 'rules':
          this.config.rules = value ? true : false;
          break;
        case 'schedules':
          this.config.schedules = value ? true : false;
          break;
        case 'sensors':
          this.config.sensors = value ? true : false;
          break;
        case 'timeout':
          this.config.timeout = toIntBetween(
            value, 5, 30, this.config.timeout
          );
          break;
        case 'users':
          this.config.users = value;
          break;
        case 'waittimeresend':
          this.config.waitTimeResend = toIntBetween(
            value, 100, 1000, this.config.waitTimeResend
          );
          break;
        case 'waittimeupdate':
          this.config.waitTimeUpdate = toIntBetween(
            value, 0, 500, this.config.waitTimeUpdate
          );
          break;
        case 'wallswitch':
          this.config.wallSwitch = value ? true : false;
          break;
        default:
          this.warning('config.json: %s: ignoring unknown key', key);
      }
    }
  }

  // ===== Bridge Discovery ====================================================

  // Get bridge state and create/update corresponding HueBridge object.
  foundBridge(bridge) {
    if (bridge.id === '0000000000000000') {                     // HACK
      return;                                                   // HACK
    }                                                           // HACK
    if (this.foundBridges[bridge.id] === bridge.host) {
      // Same bridge found earlier.
      return;
    }
    this.getBridgeAccessory(bridge)
    .then(function (bridge) {
      if (this.foundBridges[bridge.id]) {
        this.debug('bridge %s now at %s', bridge.id, bridge.host);
        this.hueBridges[bridge.id].updateHost(bridge.host);
      } else {
        this.debug('found bridge %s at %s', bridge.id, bridge.host);
        this.hueBridges[bridge.id] = new HueBridge(this, bridge);
      }
      this.foundBridges[bridge.id] = bridge.host;
    }.bind(this))
    .catch(function(err) {
      this.error(err);
      delete this.foundBridges[bridge.id];
    }.bind(this));
  }

  // Return a promise to an Accessory for the bridge.
  getBridgeAccessory(bridge) {
    // const url = 'http://' + bridge.host + '/api/config';
    const url =                                                 // HACK
      bridge.manufacturer === 'dresden elektronik' ?            // HACK
      'http://' + bridge.host + '/api/philipshue/config' :      // HACK
      'http://' + bridge.host + '/api/config';                  // HACK
    return this.httpGet(url)
    .then(function(response) {
      bridge.name = response.name;
      // bridge.model = response.modelid;
      bridge.model = response.modelid || 'deCONZ';              // HACK
      bridge.apiversion = response.apiversion;
      bridge.type = 'HueBridge';
      return deferred(bridge);
    }.bind(this));
  }

  // UPnP method: Find bridges through UPnP discovery.
  upnpHandler(ipaddress, response) {
    if (response['hue-bridgeid']) {
      this.foundBridge({
        id: response['hue-bridgeid'],
        host: response.location.split('/')[2],
        manufacturer: 'Philips'
      });
    } else if (response['gwid.phoscon.de']) {
      this.foundBridge({
        id: response['gwid.phoscon.de'].substr(2).toUpperCase(),
        host: response.location.split('/')[2],
        manufacturer: 'dresden elektronik'
      });
    }
  }

  // nUPnP method: Find bridges by querying the meethue portal.
  nupnp() {
    this.httpGet('https://www.meethue.com/api/nupnp')
    .then(function(responses) {
      this.info('meethue portal: %d bridges registered', responses.length);
      for (const response of responses) {
        this.foundBridge({
          id: response.id.toUpperCase(),
          host: response.internalipaddress + ':80',
          manufacturer: 'Philips'
        });
      }
    }.bind(this))
    .catch(function(err) {
      this.error(err);
    }.bind(this));
  }

  // nUPnP method: Find bridges by querying the deCONZ portal.
  // deCONZ portal only works over IPv6.  Even then, it doesn't return the
  // correct bridgeid.
  nupnpDeconz() {
    this.httpGet('https://dresden-light.appspot.com/discover')
    .then(function(responses) {
      this.info('deconz portal: %d bridges registered', responses.length);
      for (const response of responses) {
        this.foundBridge({
          id: response.id.substr(2).toUpperCase(),
          host: response.internalipaddress + ':' + response.internalport,
          manufacturer: 'dresden elektronik'
        });
      }
    }.bind(this))
    .catch(function(err) {
      this.error(err);
    }.bind(this));
  }

  // ===== Communication =======================================================

  // Do an HTTP GET of url.  Return a promise for the responseBody.
  // httpGet(url) {
  httpGet(url, ipv6) {                                         // HACK
    const d = deferred();
    var requestObj = {
      method: 'get',
      url: url,
      timeout: this.config.timeout * 1000,
      json: true
    };
    if (ipv6) {                                                // HACK
      requestObj.family = 6;                                   // HACK
    }                                                          // HACK
    let requestMsg;
    requestMsg = this.msg('%s %s', requestObj.method, requestObj.url);
    this.debug(requestMsg);
    request(requestObj, function(err, response, responseBody) {
      if (err) {
        return d.reject(this.msg('%s: %s', requestMsg, err.code));
      }
      this.debug(
        '%s: %s %s', requestMsg,
        response.statusCode, response.statusMessage
      );
      return d.resolve(responseBody);
    }.bind(this));
    return d.promise;
  }
};
