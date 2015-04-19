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
				console.log('Connecting ' + connection.endPointUrl + '...');
				client.connect(connection.endPointUrl, function(error){
					if (!error) {
						connection.status = 'Conectado';
						console.log('Connected ' + connection.endPointUrl + '.');

					} else {
						connection.status = 'Não Conectado';
						console.log('Not connected ' + connection.endPointUrl + '.');
						console.log(error);
					}
					socket.emit('remoteConnectionUpdate', connection);
					callback(error);
				});
			},
			function(callback) {
				console.log('Creating session ' + connection.endPointUrl + '...');
				client.createSession(function (error, newSession){
					if (!error) {
						session = newSession;
						connection.status = 'Sessão criada';
						console.log('Created session ' + connection.endPointUrl + '.');
					} else {
						connection.status = 'Sessão não criada';
						console.log('Session not created ' + connection.endPointUrl + '.');
						console.log(error);
					}
					socket.emit('remoteConnectionUpdate', connection);
					callback(error);
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
				console.log('Populating props ' + connection.endPointUrl + '...');
				session.browse("RootFolder", function(error, results) {
					if (!error) {
						connection.props = results;
						console.log('Props populated ' + connection.endPointUrl + '.');
					} else {
						console.log('Props not populated ' + connection.endPointUrl + '.');
						console.log(error);
					}
					socket.emit('remoteConnectionUpdate', connection);
				});
			}
		], function(err){
			if (!err){
				console.log('Sem erro!');
			} else {
				console.log(err);
			}
		});

		function navigateTree(nodeName, session) {
			var ret = [];
			session.browse(nodeName, function(err, results, diagnostics){
				if (results) {
					results.forEach(function(item){
						ret.push({
							nodeId: 1,
							nodeName: 2,
							children: navigateTree(3)
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