// homebridge-hue/lib/HueAccessory.js
// Copyright © 2016, 2017 Erik Baauw. All rights reserved.
//
// Homebridge plugin for Philips Hue.

'use strict';

const deferred = require('deferred');
const request = require('request');
const util = require('util');

const LibAccessory = require('homebridge-lib').LibAccessory;

// ===== HueBridge =============================================================

module.exports = class HueAccessory extends LibAccessory {

  constructor(platform, params) {
    super(platform, params);
  }

};
