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

var opcuaServers = {};

io.on('connection', function (socket) {

	console.log('Connected socket ' + socket.id + '.');

	socket.on('message', function (msg) {

		console.log("Message: " + msg);

	});

	socket.on('connectRemote', function(connection) {

		console.log('Connect id ' + connection.id);
		socket.join(connection.id);

		if (!opcuaServers[connection.id]){

			opcuaServers[connection.id] = {
				connection: connection,
				client: new opcua.OPCUAClient(),
				session: null,
				subscription: null
			}

			async.series([
				function(callback){
					console.log('Connecting ' + connection.endPointUrl + '...');
					opcuaServers[connection.id].client.connect(connection.endPointUrl, function(error){
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
					opcuaServers[connection.id].client.createSession(function (error, session){
						if (!error) {
							opcuaServers[connection.id].session = session;
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
				function(callback) {
					opcuaServers[connection.id].subscription = new opcua.ClientSubscription(opcuaServers[connection.id].session,{
						requestedPublishingInterval: 200,
						requestedMaxKeepAliveCount: 2000,
						requestedLifetimeCount:     6000,
						maxNotificationsPerPublish: 10,
						publishingEnabled: false,
						priority: 10
					});
					opcuaServers[connection.id].subscription.on("started",function(){
						console.log("subscription started");
						callback();

					}).on("keepalive",function(){
						console.log("keepalive");

					}).on("terminated",function(){
						console.log(" TERMINATED ------------------------------>")
					});

				/*},
				function(callback) {
					console.log('Populating props ' + connection.endPointUrl + '...');
					connection.props = [];
					navigateTree(connection.props, "RootFolder");

					function navigateTree(parent, nodeName) {
						console.log('Browsing node "' + nodeName + '"...');
						session.browse(nodeName, function(error, results, diagnostics){
							if (!error) {
								console.log(JSON.stringify(results));
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
					}*/
				}
			], function(err){
				if (!err){
					console.log('Sem erro!');
				} else {
					console.log('Com erro!');
					console.log(err);
				}
			});
		}
	});

	socket.on('disconnectRemote', function(connection){
		console.log('Disconnect id = ' + connection.id);
		async.series([
			function(callback){
				opcuaServers[connection.id].client.disconnect(function(error){
					if (!error) {
						console.log('Disconnected successfully of endpoint ' + connection.endPointUrl);
						opcuaServers[connection.id].connection.status = 'Desconectado';
					} else {
						console.log('Could not disconnect of endpoint ' + connection.endPointUrl);
						opcuaServers[connection.id].connection.status = 'Não Desconectado'; // não faz nenhum sentido, mas é necessário como feedback para o usuário
						console.log(error);
					}
					io.to(connection.id).emit('remoteConnectionUpdate', opcuaServers[connection.id].connection);
					callback(error);
				});
			}
		], function(err){
			if (!err){
				console.log('Sem erro!');
			} else {
				console.log('Com erro!');
				console.log(err);
			}
		});
	});

	socket.on('browseNode', function(connection){
		console.log('Browse node ' + connection.nodeName + ' of ' + connection.id);
		opcuaServers[connection.id].connection.nodeName = connection.nodeName;
		async.parallel([
			function(callback){
				opcuaServers[connection.id].session.readAllAttributes(connection.nodeName, function(error, nodesToRead, results, diagnostics){
					if (!error) {
						console.log('Read all attributes of node ' + connection.nodeName + ' of ' + connection.id + '.');
					} else {
						console.log('Could not read all attributes of node ' + connection.nodeName + ' of ' + connection.id + '.');
						console.log(JSON.stringify(error));
					}
					opcuaServers[connection.id].connection.nodesToRead = nodesToRead;
					opcuaServers[connection.id].connection.allAttributes = results;
					socket.emit('remoteConnectionUpdate', opcuaServers[connection.id].connection);
					callback(error);
				});

			}, 
			function(callback){
				opcuaServers[connection.id].session.browse(connection.nodeName, function(error, results, diagnostics){
					if (!error) {
						console.log('Browsed node ' + connection.nodeName + ' of ' + connection.id + '.');
					} else {
						console.log('Could not browse node ' + connection.nodeName + ' of ' + connection.id + '.');
						console.log(JSON.stringify(error));
					}
					opcuaServers[connection.id].connection.browseResults = results;
					socket.emit('remoteConnectionUpdate', opcuaServers[connection.id].connection);
					callback(error);
				});
			}
		], function(err){
			if (!err){
				console.log('Sem erro!');
			} else {
				console.log('Com erro!');
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