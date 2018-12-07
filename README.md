# README

The chat room displays all users currently in the room on the upper-right corner of the web page after users enter a room.

You can just run npm start to start the server. 

# New Features
There are mainly four new features assoicated with small functions:

- Friend List

    Users can add other users in the same room as friend by clicking the add button, then that user will be added to a friend list. Users can send private message to or remove their friend by clicking corresponding buttons for each friend they added.

- Invite Friend to Join the Same Room

    In addition to the send and remove buttons for each friend on friend list, there is a invite button that allows user to invite a friend to join his room. User can invite a friend only when the user is in a room. The invited user will have a message and some buttons popped up for him to choose to accept, reject or block the invite. Only the friends who are not currently in the same room can be invited and the button will disappear if they are in the same room. If the invited user is in another room, accepting the invite would make him leave the current room and join the room that he is invited to. Also, if the invited user is already banned or kicked from the room, the invite would fail and alert the inviter about it.

- Block List

    Users can add other users in the same room to an editable block list by clicking the block button to block others' message or invite. Users can reply or block one's private message when they receive private message. Users will not be able to see the blocked people's message either in private or public, and be invited to join room. The people who are blocked by someone will receive notification that tells them they are blocked by the person they want to contact or invite.

- Kick Timer

    Users who are kicked by the room owner are not able to re-join the same room until the kick time duration passes(5 seconds for the good of test).
