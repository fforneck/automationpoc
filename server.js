var http = require('http');
var path = require('path');

var async = require('async');
var socketio = require('socket.io');
var express = require('express');
var opcua = require('node-opcua');

var router = express();
var server = http.createServer(router);
var io = socketio.listen(server);
router.use('/', express.static('client'));

var connections = {};

io.on('connection', function (socket) {

    socket.on('message', function (msg) {

        console.log("Message: " + msg);

    });

    socket.on('connectRemote', function(server) {
        console.log('Connect: id = ' + server.id + ' ip = ' + server.ip + ', port = ' + server.port);
        var client = new opcua.OPCUAClient(),
            session,
            subscription;
    	async.series([
    		function(callback){
    	        client.connect(server.endPointUrl, callback);
    		},
    		function(callback) {
    			client.createSession(function (err,newSession){
    				if (!err) {
    					session = newSession;
                    	console.log(" session created".yellow);
        			}
        			callback(err);
        		});	
    		},
    		function(callback) {
        		subscription=new opcua.ClientSubscription(session,{
        			requestedPublishingInterval: 200,
        			requestedMaxKeepAliveCount: 2000,
        			requestedLifetimeCount:     6000,
        			maxNotificationsPerPublish: 10,
        			publishingEnabled: false,
        			priority: 10
        		});
        		subscription.on("started",function(){
        			console.log("subscription started");
        			callback();

        		}).on("keepalive",function(){
        			console.log("keepalive");

        		}).on("terminated",function(){
        			console.log(" TERMINATED ------------------------------>")
        		});

    		},
    		function(callback) {
    			session.browse("RootFolder", function(err, results, diagnostics){
    				console.log(err);
    				console.log(results);
    				console.log(diagnostics);
    				socket.emit('results', results);
    				if (results) {
    					results.forEach(function(item){
    						if (item.references) {
    							item.references.forEach(function(){							
    								console.log(item.references);
    							});
    						}
    					});
    				}
    			});
    		}
    	], function(err){
    		if (!err){
    			console.log('Sem erro!');
    		} else {
    			console.log(err);
    		}
    	});
    });

    socket.on('disconnectRemote', function(server){
        console.log('Disconnect: ip = ' + server.ip + ', port = ' + server.port);
        var srv = connections[getServerId(server)];
        srv.client.disconnect(function(error){
            if (error) {
                console.log('Could not disconnect of endpoint ' + server.endPointUrl);
                console.log(error);
                socket.emit('disconnectRemoteFailure', {ip: server.ip, port: server.port, message: 'Could not disconnect of endpoint ' + server.endPointUrl});
            } else {
                console.log('Disconnected successfully of endpoint ' + server.endPointUrl);
                server.connected = false;
                socket.emit('disconnectRemoteSuccess', {ip: server.ip, port: server.port});
            }            
        });
    });

    socket.emit('message', 'welcome');
});

server.listen(process.env.PORT || 3000, process.env.IP ||  "0.0.0.0", function(){
    var addr = server.address();
    console.log("Automation server listening at", addr.address + ":" + addr.port);
});

function getServerId(server){
    return server.ip + ':' + server.port;
}