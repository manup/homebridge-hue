// homebridge-hue/lib/HueBridgeService.js
// Copyright © 2016, 2017 Erik Baauw. All rights reserved.
//
// Homebridge plugin for Philips Hue.
//

const LibService = require('homebridge-lib').LibService;
const HueCharacteristic = require('./HueCharacteristic');

const characteristics = {
  enabled:      {name: 'Enabled'                           },
  heartrate:    {name: 'Heartrate',  unit: 's'             },
  lastupdated:  {name: 'LastUpdated'                       }
};

module.exports = class HueBridgeService extends LibService {

  constructor(bridge, context) {
    super(bridge , context);
    this.state = {
      enabled: context.enabled || 0,
      heartrate: context.heartrate || 30,
      lastupdated: context.lastupdated || 'n/a'
    };
    this.hueCharacteristics = [];
    for (const char in characteristics) {
      this.hueCharacteristics.push(new HueCharacteristic(this, {
        charName: characteristics[char].name,
        key: char,
        unit: characteristics[char].unit,
        value: this.state[char]
      }));
    }
  }

};
