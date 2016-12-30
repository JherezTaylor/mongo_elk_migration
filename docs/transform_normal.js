module.exports = function(msg) {
    msg.data._id = msg.data._id.$oid;
    console.log(JSON.stringify(msg))
    return msg;
}
