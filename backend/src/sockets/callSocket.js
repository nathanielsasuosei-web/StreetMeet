export default function callSocket(io){

io.on("connection",(socket)=>{


socket.on(
"call-user",
(data)=>{

io.to(data.userToCall)
.emit(
"incoming-call",
{
from:data.from,
signal:data.signal,
callType:data.callType
}
);

});


socket.on(
"answer-call",
(data)=>{

io.to(data.to)
.emit(
"call-accepted",
data.signal
);

});


socket.on(
"end-call",
(data)=>{

io.to(data.to)
.emit(
"call-ended"
);

});


});


}