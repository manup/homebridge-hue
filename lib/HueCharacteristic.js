// homebridge-hue/lib/HueBridgeService.js
// Copyright © 2016, 2017 Erik Baauw. All rights reserved.
//
// Homebridge plugin for Philips Hue.
//

const LibCharacteristic = require('homebridge-lib').LibCharacteristic;

module.exports = class HueCharacteristic extends LibCharacteristic {
  constructor(hueService, context) {
    super(hueService, context);
  }
};
