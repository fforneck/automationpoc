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

	socket.on('connectRemote', function(connection) {

		console.log('Connect id ' + connection.id);

		var client = new opcua.OPCUAClient(),
			session,
			subscription;

		async.series([
			function(callback){
				client.connect(connection.endPointUrl, callback);
				connection.status = 'Conectado';
				socket.emit('remoteConnectionUpdate', connection);
				callback(null, 'connectRemoteSuccess');
			},
			function(callback) {
				client.createSession(function (err, newSession){
					if (!err) {
						session = newSession;
						connection.status = 'Sessão criada';
						socket.emit('sessionRemoteSuccess', connection);
					}
					callback(err);
				});	
			},
			// function(callback) {
			// 	subscription=new opcua.ClientSubscription(session,{
			// 		requestedPublishingInterval: 200,
			// 		requestedMaxKeepAliveCount: 2000,
			// 		requestedLifetimeCount:     6000,
			// 		maxNotificationsPerPublish: 10,
			// 		publishingEnabled: false,
			// 		priority: 10
			// 	});
			// 	subscription.on("started",function(){
			// 		console.log("subscription started");
			// 		callback();

			// 	}).on("keepalive",function(){
			// 		console.log("keepalive");

			// 	}).on("terminated",function(){
			// 		console.log(" TERMINATED ------------------------------>")
			// 	});

			// },
			function(callback) {
				connection.props = navigateTree("RootFolder");
				socket.emit("remoteConnectionUpdate", connection);
				callback(null);
			}
		], function(err){
			if (!err){
				console.log('Sem erro!');
			} else {
				console.log(err);
			}
		});

		function navigateTree(nodeName) {
			var ret = [];
			session.browse(nodeName, function(err, results, diagnostics){
				if (results) {
					results.forEach(function(item){
						ret.push({
							nodeId: xxx,
							nodeName: xxx,
							children: navigateTree(xxx);
						});
					});
				}
			});
			return ret;
		}
	});

	socket.on('disconnectRemote', function(connection){
		console.log('Disconnect: ip = ' + connection.ip + ', port = ' + connection.port);
		var srv = connections[getconnectionId(connection)];
		srv.client.disconnect(function(error){
			if (error) {
				console.log('Could not disconnect of endpoint ' + connection.endPointUrl);
				console.log(error);
				socket.emit('disconnectRemoteFailure', {ip: connection.ip, port: connection.port, message: 'Could not disconnect of endpoint ' + connection.endPointUrl});
			} else {
				console.log('Disconnected successfully of endpoint ' + connection.endPointUrl);
				connection.connected = false;
				socket.emit('disconnectRemoteSuccess', {ip: connection.ip, port: connection.port});
			}            
		});
	});

	socket.emit('message', 'welcome');
});

server.listen(process.env.PORT || 3000, process.env.IP ||  "0.0.0.0", function(){
	var addr = server.address();
	console.log("Automation server listening at", addr.address + ":" + addr.port);
});