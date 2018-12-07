// Require the packages we will use:
var http = require("http"),
	socketio = require("socket.io"),
	fs = require("fs");

// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html:
var app = http.createServer(function (request, response) {
	if (request.url === "/mystyle.css") {
		fs.readFile("mystyle.css", function (err, data) {
			if (err) return response.writeHead(500);
			response.writeHead(200, { "Content-Type": "text/css" });
			response.end(data);
		})
	}
	else {
		response.writeHead(200, { "Content-Type": "text/html" });
		fs.readFile("client.html", function (err, data) {
			if (err) return response.writeHead(500);
			response.writeHead(200);
			response.end(data);
		});
	}
})
app.listen(3456);
var users = {};
var rooms = {};
var roompwd = {};
var roomowner = {};
var banlist = {};
var kicklist = {};
var friendlist = {};
var blocklist = {};
// Do the Socket.IO magic:
var io = socketio.listen(app);
io.sockets.on("connection", function (socket) {
	var nickname;
	socket.on('user_log_in', function (data) {
		// This callback runs when the server receives a new message from the client.
		nickname = data["nickname"]
		if (nickname in users) {
			socket.emit('log_in_failed');
		} else {
			users[nickname] = socket.id;
			blocklist[nickname] = [];
			friendlist[nickname] = [];
			socket.emit('log_in_succeeded', { rooms: rooms, roompwd: roompwd });
		}
	});
	// This callback runs when a new Socket.IO connection is established.
	socket.on('message_to_server', function (data) {
		// This callback runs when the server receives a new message from the client.
		const message = data["user"] + ": " + data["message"];
		const room = data["room"];
		io.sockets.in(room).emit("message_to_client", { message: message, from: data["user"] }) // broadcast the message to other users
	});

	//check blocklist to see if the public message should be blocked
	socket.on('check_blocklist', function (data) {
		const from = data["from"];
		const to = data["to"];
		if (blocklist[to] == null || blocklist[to].indexOf(from) === -1) {
			io.sockets.sockets[users[to]].emit("user_not_blocked", { message: data["message"], from: from });
		}
	});

	//private message
	socket.on('whisper', function (data) {
		const from = data["from"];
		const to = data["to"];
		if (blocklist[to] != null && blocklist[to].indexOf(from) != -1) {
			io.sockets.sockets[users[from]].emit("message_blocked", { to: to });
		} else {
			io.sockets.sockets[users[from]].emit("whisper_message_succeed", { to: to, message: data["message"] });
			io.sockets.sockets[users[to]].emit("whisper_message", { message: data["message"], from: from });
		}
	});

	//add friend
	socket.on('add_friend', function (data) {
		const from = data["from"];
		const to = data["to"];
		if (friendlist[from].indexOf(to) === -1) {
			friendlist[from].push(to);
			io.sockets.sockets[users[from]].emit("add_friend_succeed", { friendlist: friendlist[from] });
		}
	});

	//block user
	socket.on('block', function (data) {
		const from = data["from"];
		const to = data["to"];
		if (blocklist[from].indexOf(to) === -1) {
			blocklist[from].push(to);
			io.sockets.sockets[users[from]].emit("block_succeed", { blocklist: blocklist[from] });
		}
	});

	//remove blocked user
	socket.on('remove_blocked_user', function (data) {
		const from = data["from"];
		const to = data["to"];
		blocklist[from].splice(blocklist[from].indexOf(to), 1);
		io.sockets.sockets[users[from]].emit("remove_blocked_user_succeed", { blocklist: blocklist[from] });

	});

	//remove friend
	socket.on('remove_friend', function (data) {
		const from = data["from"];
		const to = data["to"];
		friendlist[from].splice(friendlist[from].indexOf(to), 1);
		io.sockets.sockets[users[from]].emit("remove_friend_succeed", { friendlist: friendlist[from] });

	});
	socket.on('invite', function(data){
		const from = data["from"];
		const to = data["to"];
		const room = data["room"];
		if (banlist[room].indexOf(to) == -1 && kicklist[room].indexOf(to) == -1 && blocklist[to].indexOf(from) == -1) {
			io.sockets.sockets[users[to]].emit("invite_message", {from:from, room:room});
		} else if (banlist[room].indexOf(to) != -1) {
			socket.emit("invite_failed_banned",{name:to});
		} else if (kicklist[room].indexOf(to) != -1) {
			socket.emit("invite_failed_kicked",{name:to});
		} else {
			socket.emit("invite_failed_blocked",{name:to});
		}
	});
	socket.on('accept_invite', function(data){
		const nickname = data["name"];
		const room = data["room"];
		io.sockets.sockets[users[data["inviter"]]].emit("invite_accepted", {name:nickname});
		socket.join(room);
		rooms[room].push(nickname);
		io.sockets.in(room).emit("usernames", { usernames: rooms[room], roomowner: roomowner[room] });
	});
	socket.on('reject_invite', function(data){
		const nickname = data["name"];
		io.sockets.sockets[users[data["inviter"]]].emit("invite_rejected", {name:nickname});
	});
	//join chat room
	socket.on('join', function (data) {
		const room = data["room"];
		const nickname = data["user"];
		if (banlist[room].indexOf(nickname) == -1 && kicklist[room].indexOf(nickname) == -1) {
			socket.join(room);
			rooms[room].push(nickname);
			socket.emit("join_succeeded");
			io.sockets.in(room).emit("usernames", { usernames: rooms[room], roomowner: roomowner[room] });
		} else if (banlist[room].indexOf(nickname) != -1) {
			socket.emit("banned");
		} else {
			socket.emit("kicked");
		}
	});

	//create chat room
	socket.on('create', function (data) {
		const room = data["room"];
		if (room in rooms) {
			socket.emit('room_created_failed');
		} else {
			socket.join(room);
			rooms[room] = [];
			banlist[room] = [];
			kicklist[room] = [];
			rooms[room].push(data["user"]);
			roomowner[data["room"]] = data["user"];
			if (data["roompwd"].length != 0) {
				roompwd[data["room"]] = data["roompwd"];
			}
			io.sockets.emit("room_created", { rooms: rooms, roompwd: roompwd });
			socket.emit("room_created_succeed");
			io.sockets.in(room).emit("usernames", { usernames: rooms[room], roomowner: roomowner[room] });
		}
	});

	//permanently ban user
	socket.on('ban', function (data) {
		const room = data["room"];
		const nickname = data["user"];
		io.sockets.sockets[users[nickname]].leave(room);
		io.sockets.sockets[users[nickname]].emit("banned");
		banlist[room].push(nickname);
		rooms[room].splice(rooms[room].indexOf(nickname), 1);
		io.sockets.in(room).emit("usernames", { usernames: rooms[room], roomowner: roomowner[room] });
	});

	//temporarily kick user
	socket.on('kick', function (data) {
		const room = data["room"];
		const nickname = data["user"];
		io.sockets.sockets[users[nickname]].leave(room);
		io.sockets.sockets[users[nickname]].emit("kicked");
		kicklist[room].push(nickname);
		var count = 0;
		var timer = setInterval(function () {
			count += 1;
			if (count > 5) {
				clearInterval(timer);
				kicklist[room].splice(kicklist[room].indexOf(nickname), 1);
			}
		}, 1000);
		rooms[room].splice(rooms[room].indexOf(nickname), 1);
		io.sockets.in(room).emit("usernames", { usernames: rooms[room], roomowner: roomowner[room] });
	});
	//user leave room
	socket.on('leave_room', function (data) {
		const room = data["room"];
		socket.leave(room);
		rooms[room].splice(rooms[room].indexOf(data["user"]), 1);
		io.sockets.in(room).emit("usernames", { usernames: rooms[room], roomowner: roomowner[room] });
	});
	//user disconnects
	socket.on('disconnect', function () {
		//delete username in the list
		delete users[nickname];
		//remove username in each room
		for (room in rooms) {
			if (rooms[room] != null) {
				if (rooms[room].indexOf(nickname) != -1) {
					rooms[room].splice(rooms[room].indexOf(nickname), 1);
					io.sockets.in(room).emit("usernames", { usernames: rooms[room], roomowner: roomowner[room] });
				}
			}
		}

		//remove friend 
		delete friendlist[nickname];
		for (friend in friendlist) {
			if (friendlist[friend].indexOf(nickname) != -1) {
				friendlist[friend].splice(friendlist[friend].indexOf(nickname), 1);
				io.sockets.sockets[users[friend]].emit("update_friendlist", { friendlist: friendlist[friend] });
			}
		}

		//remove blocklist 
		delete blocklist[nickname];
		for (user in blocklist) {
			if (blocklist[user].indexOf(nickname) != -1) {
				blocklist[user].splice(blocklist[user].indexOf(nickname), 1);
				io.sockets.sockets[users[user]].emit("update_blocklist", { blocklist: blocklist[user] });
			}
		}
	});
});