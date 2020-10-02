var Fritzbox = require("./lib/Fritzbox");

var options = {
  host: "fritz.box",
  port: 49443,
  ssl: true,
  user: "user",
  password: "password",
  serverPort: 52400,
  serverAddress: "192.168.80.37"
};

var box = new Fritzbox.Fritzbox(options);

//Initialize Device
Promise.all([box.initTR064Device(), box.initIGDDevice()])
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
    console.log(box.listServices());
  })
  .then(function() {
    return Promise.all([
      box.services["urn:dslforum-org:service:LANHostConfigManagement:1"].subscribe(),
      box.services["urn:dslforum-org:service:WLANConfiguration:1"].subscribe(),
      box.services["urn:dslforum-org:service:WLANConfiguration:2"].subscribe(),
      box.services["urn:dslforum-org:service:Hosts:1"].subscribe(),
      box.services["urn:schemas-upnp-org:service:WANIPConnection:1"].subscribe()
    ]);
  }).then(function(result) {
    result.forEach(function(sid) {
      console.log("Subscribed: "+sid);
    });
    return box.services["urn:dslforum-org:service:Hosts:1"].actions.GetHostNumberOfEntries();
  })
  .then(function(result) {
    console.log(result);
  })
  .catch(function(err) {
    console.log(err);
  });
