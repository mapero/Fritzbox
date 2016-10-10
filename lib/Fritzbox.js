var parseString = require('xml2js').parseString;
var request = require('request');
var URL =  require('url');
var Promise = require('bluebird');
var _ = require('underscore');
var s = require('./Service');
var http = require('http');

var TR064_DESC_URL = "/tr64desc.xml";
var IGD_DESC_URL = "/igddesc.xml";
var PMR_DESC_URL = "/pmr/PersonalMessageReceiver.xml";

var DEFAULTS = {
  host: "fritz.box",
  port: 49000,
  ssl: false
};

function Fritzbox(options){
  this.options = options ? options : {};
  _.defaults(this.options, DEFAULTS);
  this.options.protocol = this.options.ssl ? "https://" : "http://";
  if(options.user && options.password) {
    this.options.auth = {
      user: options.user,
      pass: options.password,
      sendImmediately: false
    };
  }

  if(options.serverPort) {
    this._startSubscriptionResponseServer();
  }

  this.services = {};
  this.devices = {};
}

Fritzbox.prototype.initialize = function() {
  var that = this;
  //IGD

  //TR064
};

Fritzbox.prototype.initTR064Device = function(){
	return this._parseDesc(TR064_DESC_URL);
};
Fritzbox.prototype.initIGDDevice = function(){
	return this._parseDesc(IGD_DESC_URL);
};
Fritzbox.prototype.initPMRDevice = function(){
  return  this._parseDesc(PMR_DESC_URL);
};

Fritzbox.prototype._getServices = function(device) {
  var that = this;

  var serviceList = device.serviceList;
  delete device.serviceList;
  var deviceList = device.deviceList;
  delete device.deviceList;

  //Getting the service
  if(serviceList && Array.isArray(serviceList.service)) {
    serviceList.service.forEach(function(service) {
      that.services[service.serviceType] = new s.Service(service, device, that.options);
    });
  } else if (serviceList && serviceList.service) {
    that.services[serviceList.service.serviceType] = new s.Service(serviceList.service, device, that.options);
  }

  //Recursion
  if (deviceList && Array.isArray(deviceList.device)) {
      deviceList.device.forEach(function (dev) {
          that._getServices(dev);
          that.devices[dev.deviceType] = dev;
      });
  } else if (deviceList && deviceList.device) {
      that._getServices(deviceList.device);
      that.devices[deviceList.device.deviceType] = deviceList.device;
  }
};

Fritzbox.prototype._handleRequest = function(req, res) {
  console.log(req);
  res.end();
};

Fritzbox.prototype._startSubscriptionResponseServer = function() {
  var that = this;
  that.server = http.createServer();
  that.server.listen(that.options.serverPort, function() {
    that.server.on('request', that._handleRequest);
  });

};

Fritzbox.prototype.listServices = function(){
  var that = this;
  return Object.keys(that.services).map(function (key) { return that.services[key].meta; });
};

Fritzbox.prototype._parseDesc = function(url){
  var that = this;
  return new Promise(function(resolve, reject) {
    var uri = that.options.protocol + that.options.host + ":" + that.options.port + url;
    request({
      uri: uri,
      rejectUnauthorized: false
    }, function(error, response, body) {
      if(!error && response.statusCode == 200) {
        parseString(body, {explicitArray: false}, function(err, result) {
          if(!err) {
            that.devices[result.root.device.deviceType] = result.root.device;
            that._getServices(that.devices[result.root.device.deviceType]);
            //var d =  require('./Device');
            //new d.Device(devInfo, callback);
            resolve();
          } else {
            reject(err);
          }
        });
      } else {
        reject(error);
      }
    });
  }).then(function() {
    var promises = [];

    for (var key in that.services) {
      if (!that.services.hasOwnProperty(key)) continue;

      var service = that.services[key];
      promises.push(service.initialize());
    }
    return Promise.all(promises);
  });
};

exports.Fritzbox = Fritzbox;
