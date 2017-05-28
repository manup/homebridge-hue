// homebridge-hue/lib/HueBridgeService.js
// Copyright © 2016, 2017 Erik Baauw. All rights reserved.
//
// Homebridge plugin for Philips Hue.
//

const LibService = require('homebridge-lib').LibService;
const HueCharacteristic = require('./HueCharacteristic');

const characteristics = [
  {
    key: 'enabled',
    charName: 'Enabled',
    default: 0
  }, {
    key: 'heartrate',
    charName: 'Heartrate',
    unit: 's',
    default: 5
  }, {
    key: 'lastupdated',
    charName: 'LastUpdated',
    default: 'n/a'
  }
];

module.exports = class HueBridgeService extends LibService {

  constructor(parent, params) {
    super(parent , params);
    this.hueCharacteristics = [];
    for (const char of characteristics) {
      this.hueCharacteristics.push(new HueCharacteristic(this, char));
    }
    this.on('didSet', (key, value) => {
      switch (key) {
        case 'enabled':
          if (value) {
            parent.enable();
          } else {
            parent.disable();
          }
          break;
        default:
          break;
      }
    });
  }

};
