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

	console.log('Connected socket ' + socket.id + '.');

	socket.on('message', function (msg) {

		console.log("Message: " + msg);

	});

	socket.on('connectRemote', function(connection) {

		console.log('Connect id ' + connection.id);
		socket.join(connection.id);

		if (!connections[connection.id]){

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
						io.to(connection.id).emit('remoteConnectionUpdate', connection);
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
						io.to(connection.id).emit('remoteConnectionUpdate', connection);
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
					connection.props = [];
					navigateTree(connection.props, "RootFolder");

					function navigateTree(parent, nodeName) {
						console.log('Browsing node "' + nodeName + '"...');
						session.browse(nodeName, function(err, results, diagnostics){
							if (!error) {
								results.forEach(function(entry){
									console.log('description = "' + entry.statusCode.description + '"');
									console.log('name = "' + entry.statusCode.name + '"');
									console.log('value = "' + entry.statusCode.value + '"');
									if (entry.references) {
										entry.references.forEach(function(reference){
											var children = [];
											parent.push({
												browseName: reference.browseName.name,
												namespaceIndex: reference.browseName.namespaceIndex,
												displayName: reference.displayName.text,
												nodeClass: reference.nodeClass,
												nodeId: reference.nodeId,
												children: children
											});
											io.to(connection.id).emit('remoteConnectionUpdate', connection);
											navigateTree(session, children, reference.browseName.name);
										});
									}

								});
								console.log('Browsed node "' + nodeName + '"...');
							} else {
								console.log('Error browsing node "' + nodeName + '":');
								console.log(error);
							}
						});
					}
				}
			], function(err){
				if (!err){
					console.log('Sem erro!');
				} else {
					console.log(err);
				}
			});
		}
	});

	socket.on('disconnectRemote', function(connection){
		console.log('Disconnect: ip = ' + connection.ip + ', port = ' + connection.port);
		var cnnt = connections[connection.id];
		async.series([function(callback){
			cnnt.client.disconnect(function(error){
				if (!error) {
					console.log('Disconnected successfully of endpoint ' + connection.endPointUrl);
					cnnt.status = 'Desconectado';
					io.to(connection.id).emit('remoteConnectionUpdate', cnnt);
				} else {
					console.log('Could not disconnect of endpoint ' + connection.endPointUrl);
					cnnt.status = 'Não Desconectado'; // não faz nenhum sentido, mas é necessário como feedback para o usuário
					console.log(error);
					io.to(connection.id).emit('remoteConnectionUpdate', cnnt);
				}
			});
		}], function(err){
			if (!err){
				console.log('Sem erro!');
			} else {
				console.log(err);
			}
		});
	});

	socket.emit('message', 'welcome');
});

server.listen(process.env.PORT || 3000, process.env.IP ||  "0.0.0.0", function(){
	var addr = server.address();
	console.log("Automation server listening at", addr.address + ":" + addr.port);
});