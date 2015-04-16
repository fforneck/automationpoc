
var myApp = angular.module('poc', []);

myApp.controller('AutomationPocCtrl', ['$scope', function($scope){

  var socket = io.connect();

  reset();
  $scope.connections = {};
  $scope.messages = [];

  socket.on('message', function (msg) {
    $scope.messages.push(msg);
    $scope.$apply();
  });

  socket.on('connectRemoteFailure', function(connection){
    var cntn = $scope.connections[connection.ip + ':' + connection.port];
    cntn.status = 'Não conectado';
    $scope.$apply();
  });

  socket.on('connectRemoteSuccess', function(connection){
    var cntn = $scope.connections[connection.ip + ':' + connection.port];
    cntn.status = 'Conectado';
    $scope.$apply();
  });

  socket.on('disconnectRemoteFailure', function(connection){
    var cntn = $scope.connections[connection.ip + ':' + connection.port];
    $scope.$apply();
  });

  socket.on('disconnectRemoteSuccess', function(connection){
    var cntn = $scope.connections[connection.ip + ':' + connection.port];
    cntn.status = 'Não conectado';
    $scope.$apply();
  });

  socket.on('results', function(results){
    console.log(results);
    $scope.connection[results.id].props = results.props;
    $scope.$apply();
  });

  $scope.connect = function() {
    console.log('Connecting to ip ' + $scope.ip + ' port ' + $scope.port);
    var connection = {
      ip: $scope.ip,
      port: $scope.port,
      id: $scope.ip + ':' + $scope.port,
      status: 'conectando',
      endPointUrl: 'opc.tcp://' + $scope.id + '/';
    };
    $scope.connections[connection.id] = connection;
    socket.emit('connectRemote', connection);
    reset();
  };

  $scope.disconnect = function(connection){
    console.log('Disconnecting of ip ' + connection.ip + ' port ' + connection.port);
    var id = connection.ip + ':' + connection.port,
        cntn = $scope.connections[connection.id];
    socket.emit('disconnectRemote', {ip: connection.ip, port: connection.port});
    cntn.status = 'Desconectando';    
  };

  function reset(){
    $scope.ip = '192.168.0.12';
    $scope.port = '4842';
  }

}]);