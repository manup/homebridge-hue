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

const HueBridgeAccessory = require('./HueBridgeAccessory');

// ===== Customise HomeKit  ==================================================

function customiseHomeKit(Service, Characteristic) {
  LibPlatform.createCharacteristic(
    'Resource', '00000021-0000-1000-8000-656261617577', {
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ]
    }
  );
  LibPlatform.createCharacteristic(
    'Enabled', '00000022-0000-1000-8000-656261617577', {
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY,
              Characteristic.Perms.WRITE]
    }
  );
  LibPlatform.createCharacteristic(
    'LastUpdated', '00000023-0000-1000-8000-656261617577', {
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    },
    'Last Updated'
  );
  LibPlatform.createCharacteristic(
    'Heartrate', '00000024-0000-1000-8000-656261617577', {
      format: Characteristic.Formats.INT,
      unit: Characteristic.Units.SECONDS,
      minValue: 1,
      maxValue: 30,
      stepValue: 1,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY,
              Characteristic.Perms.WRITE]
    }
  );
  LibPlatform.createCharacteristic(
    'Dark', '00000025-0000-1000-8000-656261617577', {
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    }
  );
  LibPlatform.createCharacteristic(
    'Daylight', '00000026-0000-1000-8000-656261617577', {
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    }
  );
  LibPlatform.createCharacteristic(
    'Status', '00000027-0000-1000-8000-656261617577', {
      minValue: 0,
      maxValue: 255,
      minStep: 1,
      format: Characteristic.Formats.INT,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY,
              Characteristic.Perms.WRITE]
    }
  );
  LibPlatform.createCharacteristic(
    'AnyOn', '00000028-0000-1000-8000-656261617577', {
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY,
              Characteristic.Perms.WRITE]
    },
    'Any On'
  );
  LibPlatform.createCharacteristic(
    'LastTriggered', '00000029-0000-1000-8000-656261617577', {
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    },
    'Last Triggered'
  );
  LibPlatform.createCharacteristic(
    'TimesTriggered', '0000002A-0000-1000-8000-656261617577', {
      format: Characteristic.Formats.INT,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    },
    'Times Triggered'
  );
  LibPlatform.createCharacteristic(
    'Sensitivity', '0000002B-0000-1000-8000-656261617577', {
      format: Characteristic.Formats.UINT8,
      minValue: 0,
      maxValue: 2,
      stepValue: 1,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY,
              Characteristic.Perms.WRITE]
    }
  );
  LibPlatform.createCharacteristic(
    'Duration', '0000002C-0000-1000-8000-656261617577', {
      format: Characteristic.Formats.UINT16,
      unit: 'm',
      minValue: 0,
      maxValue: 120,
      stepValue: 1,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY,
              Characteristic.Perms.WRITE]
    }
  );
  LibPlatform.createCharacteristic(
    'Link', '0000002D-0000-1000-8000-656261617577', {
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY,
              Characteristic.Perms.WRITE]
    }
  );
  LibPlatform.createCharacteristic(
    'Touchlink', '0000002E-0000-1000-8000-656261617577', {
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY,
              Characteristic.Perms.WRITE]
    }
  );
  // Custome HomeKit service for Hue bridge resource.
  LibPlatform.createService(
    'Resource', '00000011-0000-1000-8000-656261617577', [
      Characteristic.Enabled
    ], [
      Characteristic.LastTriggered, Characteristic.TimesTriggered,
      Characteristic.StatusActive, Characteristic.Resource
    ]
  );
  // Custome HomeKit service for a Hue bridge.
  LibPlatform.createService(
    'HueBridge', '00000012-0000-1000-8000-656261617577', [
      Characteristic.Enabled,
      Characteristic.Heartrate, Characteristic.LastUpdated
    ], [
      Characteristic.Link, Characteristic.Touchlink
    ]
  );
  // Custom HomeKit service for a CLIPGenericStatus sensor.
  LibPlatform.createService(
    'Status', '00000013-0000-1000-8000-656261617577', [
      Characteristic.Status
    ], [
    ]
  );
  // Custom homekit characteristic for Colour Temperature in Kelvin.
  // Source: as exposed by Nanoleaf and recognised by Elgato's Eve.
  LibPlatform.createCharacteristic(
    'ColorTemperature', 'A18E5901-CFA1-4D37-A10F-0071CEEEEEBD', {
      format: Characteristic.Formats.INT,
      unit: 'K',
      minValue: 2000,
      maxValue: 6536,
      stepValue: 1,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY,
              Characteristic.Perms.WRITE]
    },
    'Color Temperature'
  );
  // Custom homekit characteristic for Color Temperature in Mired.
  // Source: as exposed by the Philips Hue bridge v2.
  LibPlatform.createCharacteristic(
    'CT', 'E887EF67-509A-552D-A138-3DA215050F46', {
      format: Characteristic.Formats.INT,
      unit: 'mired',
      minValue: 153,
      maxValue: 500,
      stepValue: 1,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY,
              Characteristic.Perms.WRITE]
    },
    'Color Temperature'
  );
  // Custom HomeKit characteristic for Unique ID.
  // Source: as exposed by the Philips Hue bridge.  This characteristic is
  // used by the Hue app to select the accessories when syncing Hue bridge
  // Room groups to HomeKit rooms.
  LibPlatform.createCharacteristic(
    'UniqueID', 'D8B76298-42E7-5FFD-B1D6-1782D9A1F936', {
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ]
    },
    'Unique ID'
  );
}

function toIntBetween(value, minValue, maxValue, defaultValue) {
  const n = Number(value);
  if (isNaN(n) || n !== Math.floor(n) || n < minValue || n > maxValue) {
    return defaultValue;
  }
  return n;
}

// Class for homebridge-hue platform plugin.
module.exports = class HuePlatform extends LibPlatform {

  // ===== Init  ===============================================================

  // Initialise the homebridge-hue platform.
  // Called by homebridge when initialising the plugin.
  constructor(log, config, homebridge) {
    super(log, config, homebridge);
    // Service = this.Service;
    // Characteristic = this.Characteristic;
    customiseHomeKit(this.Service, this.Characteristic);
    this.parseConfigJson(config);
    this.foundBridges = {};
    this.hueBridges = {};

    // if (this.config.hosts.length > 0) {
    //   for (const host of this.config.hosts) {
    //     this.verifyBridge({host: host}).then((bridge) => {
    //
    //     });
    //   }
    // } else {
      this.on('upnpDeviceFound', this.upnpHandler.bind(this));
      this.on('upnpDeviceAlive', this.upnpHandler.bind(this));
    // }
    this.on('heartbeat', (beat) => {
      if (beat % 300 === 0 && this.config.hosts.length === 0) {
        this.nupnp();
        this.nupnpDeconz();
      }
      for (const key in this.hueBridges) {
        this.hueBridges[key].heartbeat(beat);
      }
    });
    this.on('accessoryRestored', (context) => {
      if (context.type === 'HueBridge') {
        this.foundBridge(context);
      }
    });
  }

  // ===== Config  =============================================================

  // Parse the platform section in config.json.
  parseConfigJson(config) {
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
      waitTimeResend: 300,
      waitTimeUpdate: 20,
      wallSwitch: false
    };
    for (const key in config) {
      const value = config[key];
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

  // Get bridge state and create/update corresponding HueBridgeAccessory object.
  foundBridge(bridge) {
    if (this.foundBridges[bridge.id] === bridge.host) {
      return;
    }
    this.verifyBridge(bridge)
    .then((config) => {
      if (config.id === '0000000000000000') {
        this.debug('ignoring bridge %s at %s', config.id, config.host);
        return;
      }
      if (this.foundBridges[config.id]) {
        if (config.id === bridge.id) {
          this.debug('bridge %s now at %s', config.id, config.host);
          this.hueBridges[config.id].updateHost(config.host);
        }
      } else {
        this.debug('found bridge %s at %s', config.id, config.host);
        this.hueBridges[config.id] = new HueBridgeAccessory(this, config);
      }
      this.foundBridges[config.id] = config.host;
    })
    .catch((error) => {
      this.error(error);
      delete this.foundBridges[bridge.id];
    });
  }

  // Return a promise to an Accessory for the bridge.
  verifyBridge(bridge) {
    const url = 'http://' + bridge.host + '/api/config';
    return this.httpGet(url)
    .then((response) => {
      bridge.name = response.name;
      bridge.id = response.bridgeid;
      bridge.model = response.modelid;
      bridge.apiversion = response.apiversion;
      bridge.type = 'HueBridge';
      return deferred(bridge);
    });
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
        id: response['gwid.phoscon.de'],
        host: response.location.split('/')[2],
        manufacturer: 'dresden elektronik'
      });
    }
  }

  // nUPnP method: Find bridges by querying the meethue portal.
  nupnp() {
    this.httpGet('https://www.meethue.com/api/nupnp')
    .then((responses) => {
      this.info('meethue portal: %d bridges registered', responses.length);
      for (const response of responses) {
        this.foundBridge({
          id: response.id.toUpperCase(),
          host: response.internalipaddress + ':80',
          manufacturer: 'Philips'
        });
      }
    })
    .catch((error) => {
      this.error(error);
    });
  }

  // nUPnP method: Find bridges by querying the deCONZ portal.
  // deCONZ portal only works over IPv6.
  nupnpDeconz() {
    this.httpGet('https://dresden-light.appspot.com/discover', true)
    .then((responses) => {
      this.info('deconz portal: %d bridges registered', responses.length);
      for (const response of responses) {
        this.foundBridge({
          id: response.id,
          host: response.internalipaddress + ':' + response.internalport,
          manufacturer: 'dresden elektronik'
        });
      }
    })
    .catch((error) => {
      this.error(error);
    });
  }

  // ===== Communication =======================================================

  // Do an HTTP GET of url.  Return a promise for the responseBody.
  // httpGet(url) {
  httpGet(url, ipv6 = false) {
    const d = deferred();
    var requestObj = {
      method: 'get',
      url: url,
      timeout: this.config.timeout * 1000,
      json: true
    };
    requestObj.family = ipv6 ? 6 : 4;
    let requestMsg;
    requestMsg = this.msg('%s %s', requestObj.method, requestObj.url);
    this.debug(requestMsg);
    request(requestObj, (error, response, responseBody) => {
      if (error) {
        return d.reject(this.msg('%s: %s', requestMsg, error.code));
      }
      this.debug(
        '%s: %s %s', requestMsg,
        response.statusCode, response.statusMessage
      );
      return d.resolve(responseBody);
    });
    return d.promise;
  }
};
