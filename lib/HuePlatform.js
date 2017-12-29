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
// const semver = require('semver');
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
      format: Characteristic.Formats.UINT8,
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
      format: Characteristic.Formats.UINT8,
      minValue: -127,
      maxValue: 127,
      // Workaround for Eve bug.
      // stepValue: 1,
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
      maxValue: 127,
      stepValue: 1,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY,
              Characteristic.Perms.WRITE]
    }
  );
  LibPlatform.createCharacteristic(
    'Duration', '0000002C-0000-1000-8000-656261617577', {
      format: Characteristic.Formats.UINT16,
      unit: Characteristic.Units.SECONDS,
      minValue: 0,
      maxValue: 7200,
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
  LibPlatform.createCharacteristic(
    'TransitionTime', '0000002F-0000-1000-8000-656261617577', {
      format: Characteristic.Formats.FLOAT,
      unit: Characteristic.Units.SECONDS,
      minValue: 0,
      maxValue: 3600,
      stepValue: 0.1,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY,
              Characteristic.Perms.WRITE]
    },
    'Transition Time'
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
      Characteristic.Enabled
    ], [
      Characteristic.Heartrate, Characteristic.LastUpdated,
      Characteristic.TransitionTime,
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
  // Custom HomeKit service for a CLIPGenericStatus sensor.
  LibPlatform.createService(
    'AirPressureSensor', '00000014-0000-1000-8000-656261617577', [
      Characteristic.AirPressure
    ], [
    ]
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
  // Custom HomeKit characteristic for Air Pressure.
  // Source: as exposed by Eve Weather.
  LibPlatform.createCharacteristic(
    'AirPressure', 'E863F10F-079E-48FF-8F27-9C2605A29F52', {
      format: Characteristic.Formats.UINT16,
      unit: 'hPa',
      minValue: 800,
      maxValue: 1200,
      stepValue: 1,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    },
    'Air Pressure'
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
    customiseHomeKit(this.Service, this.Characteristic);
    this.parseConfigJson(config);
    this.foundBridges = {};
    this.hueBridges = {};

    if (this.config.hosts.length > 0) {
      for (const host of this.config.hosts) {
        this.foundBridge(host);
      }
    } else {
      this.on('upnpDeviceFound', this.upnpHandler.bind(this));
      this.on('upnpDeviceAlive', this.upnpHandler.bind(this));
    }
    this.on('heartbeat', (beat) => {
      if (beat % 300 === 0 && this.config.hosts.length === 0) {
        this.nupnp();
        this.nupnpDeconz();
      }
      for (const key in this.hueBridges) {
        this.hueBridges[key].heartbeat(beat);
      }
    });
    this.on('accessoryRestored', (className, context) => {
      if (className === 'HueBridgeAccessory') {
        this.foundBridge(context.host);
      }
    });
    this.on('accessoryCleanedUp', (className, context) => {
      if (className === 'HueBridge' && context.username) {
        this.deleteUser(context.host, context.username);
      }
    });
  }

  // ===== Config  =============================================================

  // Parse the platform section in config.json.
  parseConfigJson(config) {
    this.config = {
      excludeSensorTypes: {},
      groups: false,
      group0: false,
      heartrate: 5,
      hosts: [],
      lights: false,
      linkbutton: true,
      lowBattery: 25,
      nativeHomeKit: false,
      resource: true,
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
        case 'nativehomekit':
          this.config.nativeHomeKit = value ? true : false;
          break;
        case 'parallelrequests':
          this.config.parallelRequests = toIntBetween(
            value, 1, 30, this.config.parallelRequests
          );
          break;
        case 'platform':
          break;
        case 'resource':
          this.config.resource = value ? true : false;
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
  foundBridge(host) {
    const url = 'http://' + host + '/api/config';
    this.httpGet(url).then((config) => {
      if (!config.bridgeid || config.bridgeid === '0000000000000000') {
        this.warning('ingoring uninitialised bridge %j', config);
        return;
      }
      switch (config.modelid) {
        case 'BSB001':
        case 'BSB002':
          config.manufacturername = 'Philips';
          break;
        case 'deCONZ':
          config.manufacturername = 'dresden elektronik';
          break;
        default:
          config.manufacturername = '(unknown)';
          break;
      }
      if (this.hueBridges[config.bridgeid]) {
        if (host !== this.hueBridges[config.bridgeid].context.host) {
          this.debug('bridge %s now at %s', config.bridgeid, host);
          this.hueBridges[config.bridgeid].updateHost(host);
        }
      } else {
        this.debug('found bridge %s at %s', config.bridgeid, host);
        this.hueBridges[config.bridgeid] = new HueBridgeAccessory(this, {
          name: config.name,
          id: config.bridgeid,
          host: host,
          manufacturer: config.manufacturername,
          model: config.modelid,
          firmware: config.apiversion,
          category: this.Accessory.Categories.BRIDGE
        });
      }
    }).catch((error) => {
      this.error(error);
    });
  }

  // UPnP method: Find bridges through UPnP discovery.
  upnpHandler(ipaddress, response) {
    if (response['hue-bridgeid'] || response['gwid.phoscon.de']) {
      this.foundBridge(response.location.split('/')[2]);
    }
  }

  // nUPnP method: Find bridges by querying the meethue portal.
  nupnp() {
    this.httpGet('https://www.meethue.com/api/nupnp')
    .then((responses) => {
      this.debug('meethue portal: %d bridges registered', responses.length);
      for (const response of responses) {
        this.foundBridge(response.internalipaddress + ':80');
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
      this.debug('deconz portal: %d bridges registered', responses.length);
      for (const response of responses) {
        this.foundBridge(
          response.internalipaddress + ':' + response.internalport
        );
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
    let requestMsg = util.format('%s %s', requestObj.method, requestObj.url);
    this.debug(requestMsg);
    request(requestObj, (error, response, responseBody) => {
      if (error) {
        return d.reject(util.format('%s: %s', requestMsg, error.code));
      }
      this.debug(
        '%s: %s %s', requestMsg, response.statusCode, response.statusMessage
      );
      return d.resolve(responseBody);
    });
    return d.promise;
  }

  deleteUser(host, username) {
    var requestObj = {
      method: 'delete',
      url: util.format(
        'http://%s/api/%s/config/whitelist/%s', host, username, username
      ),
      timeout: this.config.timeout * 1000,
      json: true
    };
    let requestMsg = util.format('%s %s', requestObj.method, requestObj.url);
    this.debug(requestMsg);
    request(requestObj, (error, response, responseBody) => {
      if (error) {
        this.error('%s: %s', requestMsg, error.code);
        return;
      }
      this.debug(
        '%s: %s %s', requestMsg, response.statusCode, response.statusMessage
      );
      this.info('%s: deleted user %s', host, username);
    });
  }
};
