// homebridge-hue/index.js
// Copyright © 2016, 2017 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Philips Hue.

'use strict';

const HuePlatform = require('./lib/HuePlatform');
const packageJson = require('./package.json');

// Called by homebridge when registering the plugin.
module.exports = function(homebridge) {
  HuePlatform.loadPlatform(homebridge, packageJson, 'Hue', HuePlatform);
};
