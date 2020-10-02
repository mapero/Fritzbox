Fritz!Box (fritzbox)
======

## Description

A library to connect to the TR-064 and UPnP API of an AVM Fritz!Box and to interact with it.

This library is capable of:
* Supports the UPnP and TR-064 specification of the Fritz!Box
* Call actions of services
* Authentication with username/password on http authentication level
* SSL encryption with custom port settings
* Using promises instead of callbacks
* Subscribe to Events with included EventServer (not working at the moment)

More info about capabilities provided by the TR-064 specification: http://www.avm.de/de/Extern/files/tr-064/AVM_TR-064_first_steps.pdf

## Special thanks

This library is a complete rework of the tr-064 library from [Hendrik Westerberg](https://github.com/hendrikw01). Thanks for the initial work.

## Install

<pre>
  npm install tr-064
</pre>

## It is simple

Connect to the device and read a Service.

```javascript
var Fritzbox = require('fritzbox');
var options = {
  host: 'fritz.box',
  port: 49000,
  ssl: false,
  user: 'username',
  password: 'password'
}

var fritzbox = new Fritzbox(options);

fritzbox.initTR064Device().then(function(){
    console.log('Successfully initialized device');
    var wanip = fritzbox.services["urn:dslforum-org:service:WANIPConnection:1"];
    return wanip.actions.GetInfo();
  }).then(function(result) {
    console.log(result);
  }).catch(function(error) {
    console.log(error);
  });
```

## List All Services and Variables

Get the info from both protocols.

```javascript
var Fritzbox = require("./lib/Fritzbox");

var options = {
  host: 'fritz.box',
  port: 49000,
  ssl: false,
  user: 'username',
  password: 'password'
}

var fritzbox = new Fritzbox.Fritzbox(options);

//Initialize Device
Promise.all([fritzbox.initTR064Device(), fritzbox.initIGDDevice()])
//Print information about available services
  .then(function() {
    for (var serviceName in box.services) {
      console.log("=== "+serviceName+" ===");
      for (var actionName in box.services[serviceName].actionsInfo) {
        console.log("   # " + actionName + "()");
        box.services[serviceName].actionsInfo[actionName].inArgs.forEach(function(arg) {
          console.log("     IN : " + arg);
        });
        box.services[serviceName].actionsInfo[actionName].outArgs.forEach(function(arg) {
          console.log("     OUT : " + arg);
        });
      }
    }
  })
```

## Methods

### fritzbox.initTR064Device()

Initialize the TR - 064 UPnP controller and adds the TR-064 services to the services array.

Returns
* `Promise`

### fritzbox.initIGDDevice()

Initialize the TR - 064 IGD controller and adds the IGD services to the services array.

Returns
* `Promise`
