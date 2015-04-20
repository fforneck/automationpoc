
var myApp = angular.module('poc', ['angularTreeview']);

myApp.controller('AutomationPocCtrl', ['$scope', function($scope){
	

	var socket = io.connect();

	reset();
	$scope.connections = {};
	$scope.messages = [];

	socket.on('message', function (msg) {
		$scope.messages.push(msg);
		$scope.$apply();
	});

	socket.on('remoteConnectionUpdate', function(connection){
		console.log('remoteConnectionUpdate ' + connection.id);
		$scope.connections[connection.id] = connection;
		console.log(connection.props);
		$scope.$apply();
	});

	$scope.connect = function() {
		console.log('Connecting to ip ' + $scope.ip + ' port ' + $scope.port);
		var id = $scope.ip + ':' + $scope.port,
				connection = {
					ip: $scope.ip,
					port: $scope.port,
					id: id,
					status: 'conectando',
					endPointUrl: 'opc.tcp://' + id + '/'
				};
		$scope.connections[connection.id] = connection;
		socket.emit('connectRemote', connection);
		reset();
	};

	$scope.disconnect = function(connection){
		console.log('Disconnecting of ip ' + connection.ip + ' port ' + connection.port);
		socket.emit('disconnectRemote', connection);
	};

	function reset(){
		$scope.ip = '192.168.0.12';
		$scope.port = '4842';
	}

}]);