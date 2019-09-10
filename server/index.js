var https = require('https');
var fs = require('fs');
var options = {
    key: fs.readFileSync('keys/server.key'),
    cert: fs.readFileSync("keys/server.crt")
};
var socketIO = require('socket.io');

var SSL_PORT = 8443;
var apps = https.createServer(options);
apps.listen(SSL_PORT);

var io = socketIO.listen(apps);

io.sockets.on('connection', function(socket) {
    socket.on('disconnect', function(reason) {
        var sid = socket.id;
        console.error('disconnect: ' + sid + ", reason:" + reason);
        socket.broadcast.emit('exit', {
            from: sid,
            room: ''
        });
    });

    socket.on('createAndJoinRoom', function(message) {
        var room = message.room;
        console.log('Received: createAndJoinRoom ' + room);
        // determine whether or not the room exists
        var clientsInRoom = io.sockets.adapter.rooms[room];
        var clients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
        console.log('Room ' + room + ' now has ' + clients + ' clients online.');
        if (clientsInRoom) {
            console.log(Object.keys(clientsInRoom.sockets));
        }
        if (clients === 0) {
            socket.join(room);
            console.log('ClientId ' + socket.id + ' created room ' + room);
            
            socket.emit('created', {
                id: socket.id,
                room: room,
                peers: []
            });
        } else {
            io.sockets.in(room).emit('joined', {
                id: socket.id,
                room: room
            });

            var peers = [];
            var otherSockets = Object.keys(clientsInRoom.sockets);
            console.log('Socket size: ' + otherSockets.length);

            for (var i = 0; i < otherSockets; i++) {
                peers.push({
                    id: otherSockets[i]
                });
            }
            socket.emit('created', {
                id: socket.id,
                room: room,
                peers: peers
            });

            socket.join(room);
            console.log('ClientId ' + socket.id + " joined room" + room);
        }
    });

    socket.on('offer', function(message) {
        var room = Object.keys(socket.rooms)[1];
        console.log('Received offer: ' + message.from + ' , room: ' + room + ", message: " + JSON.stringify(message));

        var other = io.sockets.connected[message.to];
        if (!other) {
            return;
        }
        other.emit('offer', message);
    });

    socket.on('answer', function(message) {
        var room = Object.keys(socket.rooms)[1];
        console.log('Received answer: ' + message.from + ' , room: ' + room + ', message: ' + JSON.stringify(message));
        var other = io.sockets.connected[message.to];
        if (!other) {
            return;
        }
        other.emit('answer', message);
    });

    socket.on('candidate', function(message) {
        console.log('Received candidate: ' + message.from + ', message: ' + JSON.stringify(message));
        var other = io.sockets.connected[message.to];
        if (!other) {
            return;
        }
        other.emit('candidate', message);
    }); 

    socket.on('exit', function(message) {
        console.log('Received exit: ' + message.from + ', message: ' + JSON.stringify(message));
        var room = message.room;
        socket.leave(room);

        var clients = io.sockets.adapter.rooms[room];
        if (clients) {
            var others = Object.keys(clients.sockets);
            for(var i = 0; i < others.length; i++) {
                var other = io.sockets.connected[others[i]];
                other.emit('exit', message);
            }
        }
    }); 
});